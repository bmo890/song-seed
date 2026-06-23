import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import { createZipArchive, buildTimestampSlug, type ZipArchiveEntry } from "./audioStorage";
import { SONG_SEED_ROOT, toRelativeManagedPath } from "./storagePaths";
import {
    ensureBackupDiskSpace,
    reportBackupProgress,
    throwIfBackupCancelled,
    yieldToBackupUi,
    type BackupOperationOptions,
} from "./backupOperation";
import { IncrementalBase64Sha256, IncrementalCrc32 } from "./streamingIntegrity";
import { toRelativeWorkspacesManagedMedia } from "../state/rebaseManagedMedia";
import {
    buildPersistedAppStoreSnapshot,
    STORE_VERSION,
    type AppStore,
    type PersistedAppStore,
} from "../state/useStore";
import type { Workspace } from "../types";

/**
 * Disaster-recovery backup: an EXACT, checksummed snapshot of the persisted library
 * plus every canonical audio file. Distinct from the human-readable share/export in
 * `libraryExport.ts` — this format preserves exact IDs and every persisted field so it
 * can fully reconstruct the library on a fresh install or new device.
 *
 * Archive layout:
 *   snapshot.json          exact PersistedAppStore (media URIs stored relative)
 *   manifest.json          format/version, per-file SHA-256, counts, status
 *   media/<relativePath>   each managed audio file at its container-independent path
 */

export const DR_BACKUP_FORMAT_VERSION = 1;
export const DR_BACKUP_FILE_SUFFIX = "songseed-backup";

const DR_TEMP_DIR = `${SONG_SEED_ROOT}/backup-tmp`;
const SNAPSHOT_ENTRY = "snapshot.json";
const MANIFEST_ENTRY = "manifest.json";
const MEDIA_PREFIX = "media/";
const BACKUP_STREAM_CHUNK_BYTES = 256 * 1024;
const BACKUP_UI_YIELD_BYTES = 2 * 1024 * 1024;
const BACKUP_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type DrMediaKind =
    | "clip-audio"
    | "clip-source"
    | "overdub-stem"
    | "overdub-mix"
    | "workspace-archive";

export type DrBackupFileRecord = { path: string; sha256: string; sizeBytes: number };
export type DrBackupMissingRecord = { path: string; kind: DrMediaKind; critical: boolean; ref: string };

export type DrBackupManifest = {
    formatVersion: number;
    storeVersion: number;
    appVersion?: string;
    createdAt: string;
    /** "incomplete" whenever a CRITICAL (irreplaceable) audio file could not be backed up. */
    status: "complete" | "incomplete";
    counts: { workspaces: number; collections: number; ideas: number; clips: number };
    snapshotSha256: string;
    files: DrBackupFileRecord[];
    missing: DrBackupMissingRecord[];
};

export type DrBackupResult = {
    archiveUri: string;
    archiveTitle: string;
    manifest: DrBackupManifest;
};

type MediaRef = {
    /** Container-independent path, e.g. `songseed/audio/<id>.m4a`. */
    relativePath: string | null;
    absUri: string;
    kind: DrMediaKind;
    /** Irreplaceable content whose absence makes the backup incomplete. */
    critical: boolean;
    /** Human-readable reference for diagnostics (e.g. song / clip id). */
    ref: string;
};

async function sha256OfString(data: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

async function inspectFileIntegrity(
    absUri: string,
    expectedSizeBytes: number,
    options: BackupOperationOptions | undefined,
    progressOffsetBytes: number,
    progressTotalBytes: number
) {
    const file = new File(absUri);
    const handle = file.open();
    const sha256 = new IncrementalBase64Sha256();
    const crc32 = new IncrementalCrc32();
    let sizeBytes = 0;
    let bytesSinceYield = 0;

    try {
        while (true) {
            throwIfBackupCancelled(options?.signal);
            const chunk = handle.readBytes(BACKUP_STREAM_CHUNK_BYTES);
            if (chunk.length === 0) break;
            sha256.update(chunk);
            crc32.update(chunk);
            sizeBytes += chunk.length;
            bytesSinceYield += chunk.length;

            if (bytesSinceYield >= BACKUP_UI_YIELD_BYTES) {
                reportBackupProgress(options, {
                    phase: "hashing",
                    completedBytes: progressOffsetBytes + sizeBytes,
                    totalBytes: progressTotalBytes,
                    message: "Verifying recordings",
                });
                bytesSinceYield = 0;
                await yieldToBackupUi(options?.signal);
            }
        }
    } finally {
        handle.close();
    }

    if (sizeBytes !== expectedSizeBytes) {
        throw new Error("File changed while it was being backed up.");
    }
    return { sha256: sha256.digestHex(), crc32: crc32.digest(), sizeBytes };
}

function pushManagedRef(
    refs: MediaRef[],
    uri: string | undefined,
    kind: DrMediaKind,
    critical: boolean,
    ref: string
) {
    if (!uri) return;
    refs.push({ relativePath: toRelativeManagedPath(uri), absUri: uri, kind, critical, ref });
}

/** Every canonical audio file referenced by the (absolute, in-memory) library. */
function collectMediaRefs(workspaces: Workspace[]): MediaRef[] {
    const refs: MediaRef[] = [];
    for (const workspace of workspaces) {
        // Archived workspaces keep their only copy of audio inside the archive package.
        if (workspace.archiveState?.archiveUri) {
            pushManagedRef(
                refs,
                workspace.archiveState.archiveUri,
                "workspace-archive",
                true,
                `workspace:${workspace.id}`
            );
        }
        for (const idea of workspace.ideas) {
            for (const clip of idea.clips) {
                const clipRef = `idea:${idea.id}/clip:${clip.id}`;
                pushManagedRef(refs, clip.audioUri, "clip-audio", true, clipRef);
                // Source/original import and rendered mix are best-effort (mix is re-derivable).
                pushManagedRef(refs, clip.sourceAudioUri, "clip-source", false, clipRef);
                if (clip.overdub) {
                    pushManagedRef(refs, clip.overdub.renderedMixUri, "overdub-mix", false, clipRef);
                    for (const stem of clip.overdub.stems) {
                        pushManagedRef(refs, stem.audioUri, "overdub-stem", true, `${clipRef}/stem:${stem.id}`);
                    }
                }
            }
        }
    }
    return refs;
}

function countEntities(workspaces: Workspace[]) {
    let collections = 0;
    let ideas = 0;
    let clips = 0;
    for (const workspace of workspaces) {
        collections += workspace.collections.length;
        ideas += workspace.ideas.length;
        for (const idea of workspace.ideas) clips += idea.clips.length;
    }
    return { workspaces: workspaces.length, collections, ideas, clips };
}

export function estimateStoredZipArchiveBytes(entries: ZipArchiveEntry[]) {
    const encoder = new TextEncoder();
    return (
        entries.reduce((sum, entry) => {
            const nameLength = encoder.encode(entry.archiveName).length;
            const dataLength =
                entry.sizeBytes ??
                (typeof entry.data === "string"
                    ? encoder.encode(entry.data).length
                    : entry.data?.length ?? 0);
            return sum + 30 + nameLength + dataLength + 46 + nameLength;
        }, 0) + 22
    );
}

export function assertZip32ArchiveSize(entries: ZipArchiveEntry[]) {
    const projectedArchiveBytes = estimateStoredZipArchiveBytes(entries);
    if (projectedArchiveBytes > 0xffffffff) {
        throw new Error(
            "This library exceeds the supported 4 GB ZIP32 backup limit. Split the library before backing it up with this app version."
        );
    }
    return projectedArchiveBytes;
}

/**
 * Build an exact backup archive into a temp location. Read-only with respect to the live
 * library — it only reads existing files and writes a new archive. The caller is
 * responsible for persisting the archive offsite (SAF folder / Files / iCloud) and for
 * cleaning up the temp file afterward.
 */
export async function buildDisasterRecoveryBackup(
    state: AppStore,
    opts?: BackupOperationOptions & { appVersion?: string }
): Promise<DrBackupResult> {
    throwIfBackupCancelled(opts?.signal);
    reportBackupProgress(opts, {
        phase: "preparing",
        completedBytes: 0,
        totalBytes: 0,
        message: "Preparing library backup",
    });
    const snapshotAbs = buildPersistedAppStoreSnapshot(state);

    // Snapshot stores RELATIVE media paths so it restores onto any container/device.
    const snapshot: PersistedAppStore = {
        ...snapshotAbs,
        workspaces: toRelativeWorkspacesManagedMedia(snapshotAbs.workspaces),
    };
    const snapshotJson = JSON.stringify(snapshot);
    const snapshotSha256 = await sha256OfString(snapshotJson);

    const entries: ZipArchiveEntry[] = [{ archiveName: SNAPSHOT_ENTRY, data: snapshotJson }];
    const files: DrBackupFileRecord[] = [];
    const missing: DrBackupMissingRecord[] = [];
    const managedRefs = new Map<string, MediaRef>();

    for (const ref of collectMediaRefs(snapshotAbs.workspaces)) {
        if (!ref.relativePath) {
            // A referenced file outside managed storage cannot be reliably backed up.
            missing.push({
                path: ref.absUri,
                kind: ref.kind,
                critical: ref.critical,
                ref: ref.ref,
            });
            continue;
        }
        const previous = managedRefs.get(ref.relativePath);
        if (!previous || (!previous.critical && ref.critical)) {
            managedRefs.set(ref.relativePath, ref);
        }
    }

    const readableRefs: Array<MediaRef & { sizeBytes: number }> = [];
    for (const ref of managedRefs.values()) {
        throwIfBackupCancelled(opts?.signal);

        const info = await FileSystem.getInfoAsync(ref.absUri);
        if (!info.exists) {
            missing.push({ path: ref.relativePath!, kind: ref.kind, critical: ref.critical, ref: ref.ref });
            continue;
        }
        const sizeBytes = typeof info.size === "number" ? info.size : new File(ref.absUri).size;
        if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
            missing.push({ path: ref.relativePath!, kind: ref.kind, critical: ref.critical, ref: ref.ref });
            continue;
        }
        readableRefs.push({ ...ref, sizeBytes });
    }

    const totalMediaBytes = readableRefs.reduce((sum, ref) => sum + ref.sizeBytes, 0);
    if (readableRefs.length + 2 >= 0xffff || totalMediaBytes > 0xffffffff) {
        throw new Error(
            "This library exceeds the supported 4 GB ZIP32 backup limit. Split the library before backing it up with this app version."
        );
    }
    // Fail before an expensive checksum pass when the temporary archive cannot fit.
    await ensureBackupDiskSpace(totalMediaBytes, "create this backup");
    throwIfBackupCancelled(opts?.signal);
    let hashedMediaBytes = 0;
    reportBackupProgress(opts, {
        phase: "hashing",
        completedBytes: 0,
        totalBytes: totalMediaBytes,
        message: "Verifying recordings",
    });

    for (const ref of readableRefs) {
        throwIfBackupCancelled(opts?.signal);
        let integrity: Awaited<ReturnType<typeof inspectFileIntegrity>>;
        try {
            integrity = await inspectFileIntegrity(
                ref.absUri,
                ref.sizeBytes,
                opts,
                hashedMediaBytes,
                totalMediaBytes
            );
        } catch (error) {
            if (opts?.signal?.aborted) throw error;
            missing.push({
                path: ref.relativePath!,
                kind: ref.kind,
                critical: ref.critical,
                ref: ref.ref,
            });
            hashedMediaBytes += ref.sizeBytes;
            continue;
        }

        entries.push({
            archiveName: `${MEDIA_PREFIX}${ref.relativePath}`,
            fileUri: ref.absUri,
            sizeBytes: integrity.sizeBytes,
            crc32: integrity.crc32,
        });
        files.push({
            path: ref.relativePath!,
            sha256: integrity.sha256,
            sizeBytes: integrity.sizeBytes,
        });
        hashedMediaBytes += integrity.sizeBytes;
        reportBackupProgress(opts, {
            phase: "hashing",
            completedBytes: hashedMediaBytes,
            totalBytes: totalMediaBytes,
            message: "Verifying recordings",
        });
    }

    const manifest: DrBackupManifest = {
        formatVersion: DR_BACKUP_FORMAT_VERSION,
        storeVersion: STORE_VERSION,
        appVersion: opts?.appVersion,
        createdAt: new Date().toISOString(),
        status: missing.some((m) => m.critical) ? "incomplete" : "complete",
        counts: countEntities(snapshotAbs.workspaces),
        snapshotSha256,
        files,
        missing,
    };
    entries.push({ archiveName: MANIFEST_ENTRY, data: JSON.stringify(manifest) });

    const projectedArchiveBytes = assertZip32ArchiveSize(entries);
    // Authoritative ZIP32 guard: the *archive* (media + per-entry headers + snapshot +
    // manifest) must stay under 4 GB, not just the media. A library a few MB under the
    // limit can otherwise produce an archive whose uint32 offsets overflow and which the
    // restore reader then rejects as unreadable.
    await ensureBackupDiskSpace(projectedArchiveBytes, "create this backup");
    throwIfBackupCancelled(opts?.signal);

    const dirInfo = await FileSystem.getInfoAsync(DR_TEMP_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DR_TEMP_DIR, { intermediates: true });
    }
    const archiveTitle = `Song Seed Backup ${buildTimestampSlug()}.${DR_BACKUP_FILE_SUFFIX}.zip`;
    const archiveUri = `${DR_TEMP_DIR}/${archiveTitle}`;
    reportBackupProgress(opts, {
        phase: "packaging",
        completedBytes: 0,
        totalBytes: totalMediaBytes,
        message: "Packaging backup",
    });
    await createZipArchive(archiveUri, entries, opts);

    return { archiveUri, archiveTitle, manifest };
}

export async function cleanupStaleDisasterRecoveryBackupFiles(
    maxAgeMs = BACKUP_TEMP_MAX_AGE_MS
) {
    try {
        const directoryInfo = await FileSystem.getInfoAsync(DR_TEMP_DIR);
        if (!directoryInfo.exists) return;
        const now = Date.now();
        const filenames = await FileSystem.readDirectoryAsync(DR_TEMP_DIR);
        await Promise.all(
            filenames.map(async (filename) => {
                const uri = `${DR_TEMP_DIR}/${filename}`;
                const info = await FileSystem.getInfoAsync(uri);
                if (!info.exists) return;
                const modificationTime =
                    typeof info.modificationTime === "number"
                        ? info.modificationTime > 1e12
                            ? info.modificationTime
                            : info.modificationTime * 1000
                        : null;
                if (modificationTime == null || now - modificationTime < maxAgeMs) return;
                await FileSystem.deleteAsync(uri, { idempotent: true });
            })
        );
    } catch (error) {
        console.warn("[Backup] Failed to clean stale backup files", error);
    }
}
