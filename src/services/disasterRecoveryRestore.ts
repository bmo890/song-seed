import * as FileSystem from "expo-file-system/legacy";
import { i18n } from "../i18n/instance";
import { File } from "expo-file-system";
import { strFromU8 } from "fflate";
import { resolveManagedUri } from "./storagePaths";
import { commitShardedWrite, persistRawSnapshot } from "../state/db/storage";
import { quarantinedWorkspaceRowKey } from "../state/shardedPersistStorage";
import {
    DR_BACKUP_FORMAT_VERSION,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import { MERGE_MIN_STORE_VERSION, STORE_NAME, STORE_VERSION } from "../state/useStore";
import { canMergeStoreVersion } from "../state/storeVersion";
import { setPersistBlocked } from "../state/persistRuntime";
import { requireRestoreRestart } from "../state/restoreRuntime";
import type { Workspace } from "../types";
import {
    prepareDisasterRecoverySnapshot,
    validateDisasterRecoveryManifest,
    type SalvageSkippedItem,
} from "./disasterRecoveryValidation";
import {
    BackupOperationCancelledError,
    ensureBackupDiskSpace,
    isBackupOperationCancelled,
    reportBackupProgress,
    throwIfBackupCancelled,
    type BackupOperationOptions,
} from "./backupOperation";
import { sha256OfFileBase64, sha256OfString } from "./fileHashing";
import { NATIVE_IO_CANCELLED, extractRangeNative, isNativeZipAvailable } from "../../modules/songnook-file-io";
import { recordLibraryOperationThroughput } from "./operationPacing";
import {
    indexStoredZipArchive,
    readStoredZipEntryBytes,
    streamStoredZipEntry,
} from "./storedZipArchive";
import {
    beginDisasterRecoveryRestoreJournal,
    completeDisasterRecoveryRestoreJournal,
    markDisasterRecoveryRestoreCommitted,
} from "./disasterRecoveryTemp";
import { collectManagedLibraryFilePathsFromWorkspaces } from "./managedMedia";
import {
    DrRestoreError,
    DrRestoreIncompleteError,
    toDrRestoreError,
} from "./disasterRecoveryErrors";
import { sanitizeSatelliteSnapshot, writeSatelliteSnapshot } from "./satelliteSnapshot";
import { mergeRestoredLibrary } from "./libraryMergeRestore";
import { toRelativeWorkspacesManagedMedia } from "../state/rebaseManagedMedia";
import type { PersistedAppStore } from "../state/storeTypes";

/**
 * Restore from a disaster-recovery archive produced by `buildDisasterRecoveryBackup`.
 *
 * Safety model: the live library is NEVER touched until every check passes. Media files
 * are streamed to unique staging destinations (each extraction CRC-32 verified against
 * the ZIP directory), then every WRITTEN file is SHA-256 verified against the backup
 * manifest — catching both archive corruption and write corruption — before the metadata
 * snapshot is committed LAST. Any failure deletes the staged (still unreferenced) files,
 * and a restore journal lets the next launch clean files left by a killed restore process.
 *
 * The snapshot stores relative media paths; it is committed to SQLite and rebased
 * to absolute URIs by `sanitizePersistedState` on the next hydration, so the caller must
 * restart the app to finish loading the restored library.
 */

const SNAPSHOT_ENTRY = "snapshot.json";
const MANIFEST_ENTRY = "manifest.json";
const MEDIA_PREFIX = "media/";

export type DrRestoreResult = {
    status: "complete" | "incomplete";
    counts: DrBackupManifest["counts"];
    /** Non-critical files the original backup recorded as missing (informational). */
    missing: DrBackupManifest["missing"];
    /** Items dropped by a salvage restore (non-empty only when allowIncomplete was used). */
    skipped: SalvageSkippedItem[];
    /** Restore commits to storage; the app must restart to hydrate the restored library. */
    needsRestart: true;
};

export type DisasterRecoveryRestoreMode = "replace" | "merge";

export type DisasterRecoveryRestoreOptions = BackupOperationOptions & {
    displacedWorkspaces?: Workspace[];
    /**
     * "replace" (default): the backup becomes the entire library and displaced current
     * media is quarantined. "merge": keep-newer-items — the current library survives,
     * backup-only items are restored into it, and NOTHING is displaced or quarantined.
     */
    mode?: DisasterRecoveryRestoreMode;
    /**
     * Required for merge mode: the live library to merge the restored one into. Read at
     * commit time, after writes are blocked, so anything saved while the restore ran
     * (a take recorded during a ten-minute verify) is part of the merge.
     */
    currentSnapshot?: () => PersistedAppStore;
    /**
     * Salvage: restore an INCOMPLETE backup (one that recorded missing critical
     * recordings when it was created), dropping the affected items and restoring
     * everything else. Only set after the user explicitly confirms.
     */
    allowIncomplete?: boolean;
};

// Error classes live in disasterRecoveryErrors.ts (shared with the validator); re-exported
// so existing importers keep working.
export { DrRestoreError, DrRestoreIncompleteError } from "./disasterRecoveryErrors";

function parentDirOf(uri: string): string {
    const idx = uri.lastIndexOf("/");
    return idx === -1 ? uri : uri.slice(0, idx);
}

async function cleanupWrittenRestoreFiles(uris: Iterable<string>) {
    const targets = Array.from(uris);
    await Promise.all(
        targets.map(async (uri) => {
            try {
                await FileSystem.deleteAsync(uri, { idempotent: true });
            } catch {
                // Failed restore files are unreferenced. Startup integrity cleanup can recover
                // from a filesystem provider refusing immediate deletion.
            }
        })
    );
    const remaining = await Promise.all(
        targets.map(async (uri) => {
            try {
                return (await FileSystem.getInfoAsync(uri)).exists;
            } catch {
                return true;
            }
        })
    );
    return remaining.every((exists) => !exists);
}

async function restoreSetAsideWorkspaceRows(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const writes = Object.entries(value as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && /^[\w-]+$/.test(entry[0]))
        .map(([id, raw]) => ({ key: quarantinedWorkspaceRowKey(STORE_NAME, id), value: raw }));
    if (writes.length === 0) return;
    try {
        await commitShardedWrite(writes, []);
    } catch (error) {
        console.warn("[Backup] Failed to keep set-aside workspace rows", error);
    }
}

/**
 * Where a restore reads from: a backup .zip, or the automatic-backup folder (2026-11-02).
 * Both present the same names: snapshot.json, manifest.json, media/<relativePath>.
 */
export type DrRestoreSource = {
    /** Every entry the source holds; sizeBytes < 0 when the provider can't say yet. */
    entries: Map<string, { sizeBytes: number }>;
    /** A zip must hold exactly the manifest's entries; a folder may hold more. */
    exactEntries: boolean;
    /** Upper bound for the media sizes the manifest may claim. */
    totalSizeBytes: number;
    readEntryText(name: string, options?: BackupOperationOptions): Promise<string>;
    /**
     * Write one entry to `targetUri`. Returns the SHA-256 of its base64 form when it was
     * computed from the same bytes, or null when the caller must verify the file after.
     */
    extractEntry(
        name: string,
        targetUri: string,
        options: BackupOperationOptions & { onBytes?: (completedBytes: number) => void }
    ): Promise<string | null>;
};

/** The .zip backup as a restore source (unchanged behaviour). */
export async function openZipRestoreSource(
    archiveUri: string,
    options?: BackupOperationOptions
): Promise<DrRestoreSource> {
    throwIfBackupCancelled(options?.signal);
    const info = await FileSystem.getInfoAsync(archiveUri);
    if (!info.exists) {
        throw new DrRestoreError("fileMissing", "Backup file could not be found.");
    }

    let archiveIndex: Awaited<ReturnType<typeof indexStoredZipArchive>>;
    try {
        archiveIndex = await indexStoredZipArchive(archiveUri, options);
    } catch (err) {
        if (isBackupOperationCancelled(err)) throw err;
        throw new DrRestoreError(
            "unreadable",
            `Backup archive is corrupt or unreadable: ${err instanceof Error ? err.message : String(err)}`
        );
    }
    // Builds with the native file module copy and fingerprint each file in one read.
    const nativeRestore = isNativeZipAvailable();
    return {
        entries: archiveIndex.entries,
        exactEntries: true,
        totalSizeBytes: archiveIndex.archiveSizeBytes,
        readEntryText: async (name, readOptions) =>
            strFromU8(await readStoredZipEntryBytes(archiveIndex, archiveIndex.entries.get(name)!, undefined, readOptions)),
        extractEntry: async (name, targetUri, extractOptions) => {
            const entry = archiveIndex.entries.get(name)!;
            if (nativeRestore) {
                // One native read per file: copied out and fingerprinted on the way, so it
                // is checked against the zip's CRC and the manifest's SHA-256 by the caller,
                // and the separate verify pass has nothing left to read (2026-10-20).
                let extracted: Awaited<ReturnType<typeof extractRangeNative>>;
                try {
                    extracted = await extractRangeNative(archiveIndex.archiveUri, entry.dataOffset, entry.sizeBytes, targetUri, {
                        sha256: true,
                        signal: extractOptions.signal,
                        onProgress: ({ completedBytes }) => extractOptions.onBytes?.(completedBytes),
                    });
                } catch (error) {
                    if (extractOptions.signal?.aborted || (error instanceof Error && error.message === NATIVE_IO_CANCELLED)) {
                        throw new BackupOperationCancelledError();
                    }
                    throw error;
                }
                if (extracted.crc32 !== entry.crc32 >>> 0) {
                    throw new DrRestoreError("integrity", `Backup ZIP checksum failed for ${name}`);
                }
                return extracted.sizeBytes === entry.sizeBytes ? extracted.sha256 ?? "" : "";
            }
            const targetHandle = new File(targetUri).open();
            try {
                await streamStoredZipEntry(archiveIndex, entry, (chunk) => targetHandle.writeBytes(chunk), {
                    ...extractOptions,
                    phase: "restoring",
                });
            } finally {
                targetHandle.close();
            }
            return null;
        },
    };
}

export async function restoreFromDisasterRecoveryBackup(
    archiveUri: string,
    options?: DisasterRecoveryRestoreOptions
): Promise<DrRestoreResult> {
    return restoreFromSource(await openZipRestoreSource(archiveUri, options), options);
}

export async function restoreFromSource(
    source: DrRestoreSource,
    options?: DisasterRecoveryRestoreOptions
): Promise<DrRestoreResult> {
    throwIfBackupCancelled(options?.signal);
    if (!source.entries.has(SNAPSHOT_ENTRY) || !source.entries.has(MANIFEST_ENTRY)) {
        throw new DrRestoreError("notBackup", "Backup is missing its snapshot or manifest — not a SongNook backup.");
    }

    let manifestJson: string;
    try {
        manifestJson = await source.readEntryText(MANIFEST_ENTRY, options);
    } catch (error) {
        if (isBackupOperationCancelled(error)) throw error;
        throw new DrRestoreError(
            "unreadable",
            error instanceof Error ? error.message : "Backup metadata is unreadable."
        );
    }

    let manifestValue: unknown;
    try {
        manifestValue = JSON.parse(manifestJson);
    } catch {
        throw new DrRestoreError("unreadable", "Backup manifest is unreadable.");
    }
    let manifest;
    try {
        manifest = validateDisasterRecoveryManifest(
            manifestValue,
            DR_BACKUP_FORMAT_VERSION,
            STORE_VERSION
        );
    } catch (error) {
        throw toDrRestoreError(error, "integrity");
    }
    const missingCritical = manifest.missing.filter((entry) => entry.critical);
    const incomplete = missingCritical.length > 0 || manifest.status === "incomplete";
    const salvage = incomplete && options?.allowIncomplete === true;
    if (incomplete && !salvage) {
        throw new DrRestoreIncompleteError(
            `This backup is incomplete and cannot safely restore the library. ${missingCritical.length} ` +
                `critical recording${missingCritical.length === 1 ? " is" : "s are"} missing.`,
            missingCritical.length
        );
    }

    const mergeMode = options?.mode === "merge";
    if (mergeMode) {
        if (!options?.currentSnapshot) {
            throw new DrRestoreError("internal", "Merge restore requires the current library snapshot.");
        }
        // A merged snapshot mixes current-shape data with the backup's, so it is committed
        // at the CURRENT store version — which is only safe when the backup's data shape
        // already matches. Older backups must migrate first via a full replace.
        // Data versions from MERGE_MIN_STORE_VERSION up to this build's merge: every
        // hydrate sanitizes, which covers those shapes (11-M1: the version now moves).
        if (!canMergeStoreVersion(manifest.storeVersion, STORE_VERSION, MERGE_MIN_STORE_VERSION ?? STORE_VERSION)) {
            throw new DrRestoreError(
                "mergeNeedsReplace",
                "This backup was made by an older app version and can't be merged. Use Replace Everything to restore it."
            );
        }
    }

    let snapshotJson: string;
    try {
        snapshotJson = await source.readEntryText(SNAPSHOT_ENTRY, options);
    } catch (error) {
        if (isBackupOperationCancelled(error)) throw error;
        throw new DrRestoreError(
            "unreadable",
            error instanceof Error ? error.message : "Backup snapshot is unreadable."
        );
    }

    // ── Verify EVERYTHING before writing anything ──
    const snapshotSha = await sha256OfString(snapshotJson);
    if (snapshotSha !== manifest.snapshotSha256) {
        throw new DrRestoreError("integrity", "Backup metadata failed its integrity check (snapshot checksum mismatch).");
    }

    let snapshotValue: unknown;
    try {
        snapshotValue = JSON.parse(snapshotJson);
    } catch {
        throw new DrRestoreError("unreadable", "Backup snapshot is unreadable.");
    }
    // The satellite block (Shelf, transposition, filters, UI language) rides inside
    // snapshot.json but is NOT part of the library store: peel it off before validation
    // so the committed store snapshot stays exactly the persisted shape.
    let rawSatellites: unknown;
    let rawSetAsideRows: unknown;
    if (snapshotValue && typeof snapshotValue === "object" && !Array.isArray(snapshotValue)) {
        const { satellites, setAsideWorkspaceRows, ...librarySnapshot } = snapshotValue as Record<string, unknown>;
        rawSatellites = satellites;
        rawSetAsideRows = setAsideWorkspaceRows;
        snapshotValue = librarySnapshot;
    }

    const restoreToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let prepared;
    try {
        prepared = prepareDisasterRecoverySnapshot(snapshotValue, manifest, restoreToken, {
            salvage,
        });
    } catch (error) {
        throw toDrRestoreError(error, "integrity");
    }
    if (salvage && prepared.skipped.length > 0) {
        console.log(
            `[restore] salvage: skipping ${prepared.skipped.length} item(s) whose audio the backup recorded as missing:\n` +
                prepared.skipped.map((item) => `  • ${item.kind} ${item.ref} — ${item.label}`).join("\n")
        );
    }

    const expectedEntries = new Set([
        SNAPSHOT_ENTRY,
        MANIFEST_ENTRY,
        ...manifest.files.map((record) => `${MEDIA_PREFIX}${record.path}`),
    ]);
    if (source.exactEntries) {
        const unexpectedEntry = Array.from(source.entries.keys()).find((entry) => !expectedEntries.has(entry));
        if (unexpectedEntry) {
            throw new DrRestoreError("integrity", `Backup contains an unexpected archive entry: ${unexpectedEntry}`);
        }
        if (source.entries.size !== expectedEntries.size) {
            throw new DrRestoreError("integrity", "Backup archive entry count does not match its manifest.");
        }
    }

    let totalMediaBytes = 0;
    for (const record of manifest.files) {
        const entry = source.entries.get(`${MEDIA_PREFIX}${record.path}`);
        if (!entry) {
            throw new DrRestoreError(
                "integrity",
                `Backup is missing audio file listed in its manifest: ${record.path}`
            );
        }
        if (entry.sizeBytes >= 0 && entry.sizeBytes !== record.sizeBytes) {
            throw new DrRestoreError(
                "integrity",
                `Audio file size does not match the backup manifest: ${record.path}`
            );
        }
        totalMediaBytes += record.sizeBytes;
        if (!Number.isSafeInteger(totalMediaBytes) || totalMediaBytes > source.totalSizeBytes) {
            throw new DrRestoreError("integrity", "Backup media sizes are invalid.");
        }
    }
    await ensureBackupDiskSpace(totalMediaBytes, "restore");
    throwIfBackupCancelled(options?.signal);

    // Write every restored file to a unique managed destination. Existing live files are
    // never overwritten: if the process stops before metadata commits, the old library is
    // untouched and the partial restore consists only of harmless unreferenced files.
    // Each extraction is CRC-32 verified in-stream; SHA-256 verification of the written
    // files (natively, off the JS thread) happens below, before anything is committed.
    const restoreStartedAt = Date.now();
    const ensuredDirs = new Set<string>();
    const writtenUris: string[] = [];
    let persistenceLocked = false;
    let journalStarted = false;
    let restoredBytes = 0;
    try {
        await beginDisasterRecoveryRestoreJournal(
            restoreToken,
            prepared.destinationPathBySourcePath.values(),
            // Merge keeps the current library, so nothing is displaced and nothing may be
            // quarantined after commit.
            mergeMode
                ? []
                : collectManagedLibraryFilePathsFromWorkspaces(options?.displacedWorkspaces ?? [])
        );
        journalStarted = true;
        // Files fingerprinted in the same pass that wrote them need no second read.
        const verifiedInPass = new Set<string>();
        reportBackupProgress(options, {
            phase: "restoring",
            completedBytes: 0,
            totalBytes: totalMediaBytes,
            message: i18n.t("process.restoringClips"),
        });

        for (const record of manifest.files) {
            throwIfBackupCancelled(options?.signal);
            const destinationPath = prepared.destinationPathBySourcePath.get(record.path);
            if (!destinationPath) {
                throw new DrRestoreError("internal", `Backup restore destination is missing for ${record.path}`);
            }
            const targetUri = resolveManagedUri(destinationPath);
            const dir = parentDirOf(targetUri);
            if (!ensuredDirs.has(dir)) {
                const dirInfo = await FileSystem.getInfoAsync(dir);
                if (!dirInfo.exists) {
                    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
                }
                ensuredDirs.add(dir);
            }
            const existingTarget = await FileSystem.getInfoAsync(targetUri);
            if (existingTarget.exists) {
                throw new DrRestoreError("destinationConflict", `Restore destination already exists for ${record.path}`);
            }

            const targetFile = new File(targetUri);
            targetFile.create({ intermediates: true, overwrite: false });
            writtenUris.push(targetUri);
            const before = restoredBytes;
            const sha = await source.extractEntry(`${MEDIA_PREFIX}${record.path}`, targetUri, {
                signal: options?.signal,
                onProgress: options?.onProgress,
                onBytes: (completedBytes) =>
                    reportBackupProgress(options, {
                        phase: "restoring",
                        completedBytes: before + completedBytes,
                        totalBytes: totalMediaBytes,
                        message: i18n.t("process.restoringClips"),
                    }),
            });
            if (sha !== null) {
                if (sha !== record.sha256) {
                    // Before calling the file bad, ask the proven JS route: a native hashing
                    // fault must never refuse a good backup.
                    const written = new File(targetUri);
                    const proven =
                        written.exists && written.size === record.sizeBytes
                            ? await sha256OfFileBase64(targetUri, record.sizeBytes, options).catch(() => null)
                            : null;
                    if (proven !== record.sha256) {
                        throw new DrRestoreError("verifyFailed", `Audio file failed its integrity check: ${record.path}`);
                    }
                }
                verifiedInPass.add(record.path);
            } else if (!targetFile.exists || targetFile.size !== record.sizeBytes) {
                throw new DrRestoreError("verifyFailed", `Could not verify restored audio file: ${record.path}`);
            }
            restoredBytes += record.sizeBytes;
            reportBackupProgress(options, {
                phase: "restoring",
                completedBytes: restoredBytes,
                totalBytes: totalMediaBytes,
                message: i18n.t("process.restoringClips"),
            });
        }

        // Verify every WRITTEN file against the backup manifest before committing anything.
        // Native hashing (base64 read + SHA-256 digest) reproduces the v1 manifest format
        // off the JS thread; a mismatch aborts the restore and deletes the staged files.
        let verifiedBytes = 0;
        reportBackupProgress(options, {
            phase: "verifying",
            completedBytes: 0,
            totalBytes: totalMediaBytes,
            message: i18n.t("process.verifyingRestoredClips"),
        });
        for (const record of manifest.files.filter((file) => !verifiedInPass.has(file.path))) {
            throwIfBackupCancelled(options?.signal);
            const destinationPath = prepared.destinationPathBySourcePath.get(record.path);
            if (!destinationPath) {
                throw new DrRestoreError("internal", `Backup restore destination is missing for ${record.path}`);
            }
            const targetUri = resolveManagedUri(destinationPath);
            let sha: string;
            try {
                sha = await sha256OfFileBase64(targetUri, record.sizeBytes, options);
            } catch (error) {
                if (isBackupOperationCancelled(error)) throw error;
                throw new DrRestoreError(
                    "verifyFailed",
                    error instanceof Error
                        ? error.message
                        : `Could not verify restored audio file: ${record.path}`
                );
            }
            if (sha !== record.sha256) {
                throw new DrRestoreError("verifyFailed", `Audio file failed its integrity check: ${record.path}`);
            }
            verifiedBytes += record.sizeBytes;
            reportBackupProgress(options, {
                phase: "verifying",
                completedBytes: verifiedBytes,
                totalBytes: totalMediaBytes,
                message: i18n.t("process.verifyingRestoredClips"),
            });
        }

        // Stop new Zustand writes, wait behind any write already in flight, then commit the
        // restored metadata last. The serialized SQLite queue guarantees this snapshot wins.
        throwIfBackupCancelled(options?.signal);
        reportBackupProgress(options, {
            phase: "committing",
            completedBytes: totalMediaBytes,
            totalBytes: totalMediaBytes,
            message: i18n.t("process.finishingRestore"),
        });
        setPersistBlocked(true);
        persistenceLocked = true;
        // Merge: fold the restored snapshot into the current library (current wins
        // collisions; backup-only items return). Current media URIs are stored relative,
        // matching the restored snapshot's style, so hydration rebases both uniformly.
        const liveSnapshot = mergeMode ? options!.currentSnapshot!() : null;
        const snapshotToCommit = liveSnapshot
            ? mergeRestoredLibrary(prepared.snapshot, {
                  ...liveSnapshot,
                  workspaces: toRelativeWorkspacesManagedMedia(liveSnapshot.workspaces),
              })
            : prepared.snapshot;
        await persistRawSnapshot(
            STORE_NAME,
            JSON.stringify({ state: snapshotToCommit, version: manifest.storeVersion })
        );
    } catch (error) {
        if (persistenceLocked) {
            setPersistBlocked(false);
        }
        const cleanupComplete = await cleanupWrittenRestoreFiles(writtenUris);
        if (journalStarted && cleanupComplete) {
            await completeDisasterRecoveryRestoreJournal(restoreToken);
        }
        if (isBackupOperationCancelled(error)) {
            throw error;
        }
        throw toDrRestoreError(error);
    }

    // Lock persistence so the still-loaded (pre-restore) in-memory store cannot write back
    // over the restored snapshot before the app reloads. Publish the blocking runtime state
    // before any best-effort journal bookkeeping so there is no interactive stale-state gap.
    recordLibraryOperationThroughput("restore", totalMediaBytes, Date.now() - restoreStartedAt);

    // Satellite stores (Shelf, transposition, filters, UI language): written under their
    // own persist keys AFTER the library commit and BEFORE the restart. Best-effort — the
    // library is already durable, so a failure here must not fail the restore.
    const satellites = sanitizeSatelliteSnapshot(rawSatellites);
    if (satellites) {
        try {
            await writeSatelliteSnapshot(satellites, mergeMode ? "merge" : "replace");
        } catch (error) {
            console.warn("[Backup] Failed to restore satellite stores", error);
        }
    }

    // Rows of workspaces the backed-up phone had set aside (G10) are kept the same way
    // here: under their quarantine key, out of the library, for a later repair.
    await restoreSetAsideWorkspaceRows(rawSetAsideRows);

    const result: DrRestoreResult = {
        status: manifest.status,
        counts: manifest.counts,
        missing: manifest.missing,
        skipped: prepared.skipped,
        needsRestart: true,
    };
    requireRestoreRestart(result.counts, result.missing.length);

    // Keep the committed journal until the restored snapshot hydrates. Startup finalization
    // verifies the restored destinations before quarantining files displaced by the restore.
    await markDisasterRecoveryRestoreCommitted(restoreToken).catch((error) => {
        console.warn("[Backup] Failed to mark completed restore journal", error);
    });
    return result;
}
