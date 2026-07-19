import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { strFromU8 } from "fflate";
import { resolveManagedUri } from "./storagePaths";
import { persistRawSnapshot } from "../state/db/storage";
import {
    DR_BACKUP_FORMAT_VERSION,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import { STORE_NAME, STORE_VERSION } from "../state/useStore";
import { setPersistBlocked } from "../state/persistRuntime";
import { requireRestoreRestart } from "../state/restoreRuntime";
import type { Workspace } from "../types";
import {
    prepareDisasterRecoverySnapshot,
    validateDisasterRecoveryManifest,
    type SalvageSkippedItem,
} from "./disasterRecoveryValidation";
import {
    ensureBackupDiskSpace,
    isBackupOperationCancelled,
    reportBackupProgress,
    throwIfBackupCancelled,
    type BackupOperationOptions,
} from "./backupOperation";
import { sha256OfFileBase64, sha256OfString } from "./fileHashing";
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
    /** Required for merge mode: the live library snapshot to merge the restored one into. */
    currentSnapshot?: PersistedAppStore;
    /**
     * Salvage: restore an INCOMPLETE backup (one that recorded missing critical
     * recordings when it was created), dropping the affected items and restoring
     * everything else. Only set after the user explicitly confirms.
     */
    allowIncomplete?: boolean;
};

export class DrRestoreError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "DrRestoreError";
    }
}

/**
 * The backup itself recorded missing critical recordings. Callers can catch this and
 * re-run with `allowIncomplete: true` (salvage) after the user explicitly opts in —
 * in a real disaster an incomplete backup beats no restore at all.
 */
export class DrRestoreIncompleteError extends DrRestoreError {
    readonly missingCriticalCount: number;

    constructor(message: string, missingCriticalCount: number) {
        super(message);
        this.name = "DrRestoreIncompleteError";
        this.missingCriticalCount = missingCriticalCount;
    }
}

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

export async function restoreFromDisasterRecoveryBackup(
    archiveUri: string,
    options?: DisasterRecoveryRestoreOptions
): Promise<DrRestoreResult> {
    throwIfBackupCancelled(options?.signal);
    const info = await FileSystem.getInfoAsync(archiveUri);
    if (!info.exists) {
        throw new DrRestoreError("Backup file could not be found.");
    }

    let archiveIndex;
    try {
        archiveIndex = await indexStoredZipArchive(archiveUri, options);
    } catch (err) {
        if (isBackupOperationCancelled(err)) throw err;
        throw new DrRestoreError(
            `Backup archive is corrupt or unreadable: ${err instanceof Error ? err.message : String(err)}`
        );
    }

    const snapshotEntry = archiveIndex.entries.get(SNAPSHOT_ENTRY);
    const manifestEntry = archiveIndex.entries.get(MANIFEST_ENTRY);
    if (!snapshotEntry || !manifestEntry) {
        throw new DrRestoreError("Backup is missing its snapshot or manifest — not a SongNook backup.");
    }

    let manifestJson: string;
    try {
        manifestJson = strFromU8(
            await readStoredZipEntryBytes(archiveIndex, manifestEntry, undefined, options)
        );
    } catch (error) {
        if (isBackupOperationCancelled(error)) throw error;
        throw new DrRestoreError(
            error instanceof Error ? error.message : "Backup metadata is unreadable."
        );
    }

    let manifestValue: unknown;
    try {
        manifestValue = JSON.parse(manifestJson);
    } catch {
        throw new DrRestoreError("Backup manifest is unreadable.");
    }
    let manifest;
    try {
        manifest = validateDisasterRecoveryManifest(
            manifestValue,
            DR_BACKUP_FORMAT_VERSION,
            STORE_VERSION
        );
    } catch (error) {
        throw new DrRestoreError(error instanceof Error ? error.message : "Backup manifest is invalid.");
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
            throw new DrRestoreError("Merge restore requires the current library snapshot.");
        }
        // A merged snapshot mixes current-shape data with the backup's, so it is committed
        // at the CURRENT store version — which is only safe when the backup's data shape
        // already matches. Older backups must migrate first via a full replace.
        if (manifest.storeVersion !== STORE_VERSION) {
            throw new DrRestoreError(
                "This backup was made by an older app version and can't be merged. Use Replace Everything to restore it."
            );
        }
    }

    let snapshotJson: string;
    try {
        snapshotJson = strFromU8(
            await readStoredZipEntryBytes(archiveIndex, snapshotEntry, undefined, options)
        );
    } catch (error) {
        if (isBackupOperationCancelled(error)) throw error;
        throw new DrRestoreError(
            error instanceof Error ? error.message : "Backup snapshot is unreadable."
        );
    }

    // ── Verify EVERYTHING before writing anything ──
    const snapshotSha = await sha256OfString(snapshotJson);
    if (snapshotSha !== manifest.snapshotSha256) {
        throw new DrRestoreError("Backup metadata failed its integrity check (snapshot checksum mismatch).");
    }

    let snapshotValue: unknown;
    try {
        snapshotValue = JSON.parse(snapshotJson);
    } catch {
        throw new DrRestoreError("Backup snapshot is unreadable.");
    }

    const restoreToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let prepared;
    try {
        prepared = prepareDisasterRecoverySnapshot(snapshotValue, manifest, restoreToken, {
            salvage,
        });
    } catch (error) {
        throw new DrRestoreError(error instanceof Error ? error.message : "Backup snapshot is invalid.");
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
    const unexpectedEntry = Array.from(archiveIndex.entries.keys()).find(
        (entry) => !expectedEntries.has(entry)
    );
    if (unexpectedEntry) {
        throw new DrRestoreError(`Backup contains an unexpected archive entry: ${unexpectedEntry}`);
    }
    if (archiveIndex.entries.size !== expectedEntries.size) {
        throw new DrRestoreError("Backup archive entry count does not match its manifest.");
    }

    let totalMediaBytes = 0;
    for (const record of manifest.files) {
        const entry = archiveIndex.entries.get(`${MEDIA_PREFIX}${record.path}`);
        if (!entry) {
            throw new DrRestoreError(
                `Backup is missing audio file listed in its manifest: ${record.path}`
            );
        }
        if (entry.sizeBytes !== record.sizeBytes) {
            throw new DrRestoreError(
                `Audio file size does not match the backup manifest: ${record.path}`
            );
        }
        totalMediaBytes += record.sizeBytes;
        if (!Number.isSafeInteger(totalMediaBytes) || totalMediaBytes > archiveIndex.archiveSizeBytes) {
            throw new DrRestoreError("Backup media sizes are invalid.");
        }
    }
    await ensureBackupDiskSpace(totalMediaBytes, "restore this backup");
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
        reportBackupProgress(options, {
            phase: "restoring",
            completedBytes: 0,
            totalBytes: totalMediaBytes,
            message: "Restoring recordings",
        });

        for (const record of manifest.files) {
            throwIfBackupCancelled(options?.signal);
            const destinationPath = prepared.destinationPathBySourcePath.get(record.path);
            if (!destinationPath) {
                throw new DrRestoreError(`Backup restore destination is missing for ${record.path}`);
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
                throw new DrRestoreError(`Restore destination already exists for ${record.path}`);
            }

            const entry = archiveIndex.entries.get(`${MEDIA_PREFIX}${record.path}`);
            if (!entry) {
                throw new DrRestoreError(`Backup is missing audio file listed in its manifest: ${record.path}`);
            }
            const targetFile = new File(targetUri);
            targetFile.create({ intermediates: true, overwrite: false });
            writtenUris.push(targetUri);
            const targetHandle = targetFile.open();
            try {
                await streamStoredZipEntry(
                    archiveIndex,
                    entry,
                    (chunk) => targetHandle.writeBytes(chunk),
                    {
                        ...options,
                        phase: "restoring",
                        progressOffsetBytes: restoredBytes,
                        progressTotalBytes: totalMediaBytes,
                        progressMessage: "Restoring recordings",
                    }
                );
            } finally {
                targetHandle.close();
            }
            if (!targetFile.exists || targetFile.size !== record.sizeBytes) {
                throw new DrRestoreError(`Could not verify restored audio file: ${record.path}`);
            }
            restoredBytes += record.sizeBytes;
            reportBackupProgress(options, {
                phase: "restoring",
                completedBytes: restoredBytes,
                totalBytes: totalMediaBytes,
                message: "Restoring recordings",
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
            message: "Verifying restored recordings",
        });
        for (const record of manifest.files) {
            throwIfBackupCancelled(options?.signal);
            const destinationPath = prepared.destinationPathBySourcePath.get(record.path);
            if (!destinationPath) {
                throw new DrRestoreError(`Backup restore destination is missing for ${record.path}`);
            }
            const targetUri = resolveManagedUri(destinationPath);
            let sha: string;
            try {
                sha = await sha256OfFileBase64(targetUri, record.sizeBytes, options);
            } catch (error) {
                if (isBackupOperationCancelled(error)) throw error;
                throw new DrRestoreError(
                    error instanceof Error
                        ? error.message
                        : `Could not verify restored audio file: ${record.path}`
                );
            }
            if (sha !== record.sha256) {
                throw new DrRestoreError(`Audio file failed its integrity check: ${record.path}`);
            }
            verifiedBytes += record.sizeBytes;
            reportBackupProgress(options, {
                phase: "verifying",
                completedBytes: verifiedBytes,
                totalBytes: totalMediaBytes,
                message: "Verifying restored recordings",
            });
        }

        // Stop new Zustand writes, wait behind any write already in flight, then commit the
        // restored metadata last. The serialized SQLite queue guarantees this snapshot wins.
        throwIfBackupCancelled(options?.signal);
        reportBackupProgress(options, {
            phase: "committing",
            completedBytes: totalMediaBytes,
            totalBytes: totalMediaBytes,
            message: "Finishing restore",
        });
        setPersistBlocked(true);
        persistenceLocked = true;
        // Merge: fold the restored snapshot into the current library (current wins
        // collisions; backup-only items return). Current media URIs are stored relative,
        // matching the restored snapshot's style, so hydration rebases both uniformly.
        const snapshotToCommit = mergeMode
            ? mergeRestoredLibrary(prepared.snapshot, {
                  ...options!.currentSnapshot!,
                  workspaces: toRelativeWorkspacesManagedMedia(options!.currentSnapshot!.workspaces),
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
        throw error instanceof DrRestoreError
            ? error
            : new DrRestoreError(error instanceof Error ? error.message : "Backup restore failed.");
    }

    // Lock persistence so the still-loaded (pre-restore) in-memory store cannot write back
    // over the restored snapshot before the app reloads. Publish the blocking runtime state
    // before any best-effort journal bookkeeping so there is no interactive stale-state gap.
    recordLibraryOperationThroughput("restore", totalMediaBytes, Date.now() - restoreStartedAt);
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
