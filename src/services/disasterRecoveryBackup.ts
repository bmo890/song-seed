import * as FileSystem from "expo-file-system/legacy";
import { i18n } from "../i18n/instance";
import { UserFacingError } from "../i18n/userFacingError";
import { File } from "expo-file-system";
import { buildTimestampSlug } from "./audioStorage";
import {
    createZipArchive,
    needsZip64Value,
    projectStoredZipBytes,
    rethrowNativeCancel,
    type ZipArchiveEntry,
} from "./zipArchive";
import {
    NATIVE_IO_CANCELLED,
    NativeZipWriter,
    excludeFromDeviceBackup,
    isNativeZip64Available,
    isNativeZipAvailable,
} from "../../modules/songnook-file-io";
import { SONG_NOOK_ROOT, toRelativeManagedPath, waveformSidecarUri } from "./storagePaths";
import type { DrSatelliteSnapshot } from "./satelliteSnapshot";
import {
    ensureBackupDiskSpace,
    reportBackupProgress,
    throwIfBackupCancelled,
    yieldToBackupUi,
    type BackupOperationOptions,
} from "./backupOperation";
import { IncrementalCrc32 } from "./streamingIntegrity";
import { sha256OfFileBase64, sha256OfString } from "./fileHashing";
import { recordLibraryOperationThroughput } from "./operationPacing";
import { toRelativeDeletedItemsManagedMedia, toRelativeWorkspacesManagedMedia } from "../state/rebaseManagedMedia";
import { getHydrationDegradedWorkspaceIds } from "../state/persistRuntime";
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
 *   snapshot.json          exact PersistedAppStore (media URIs stored relative), plus an
 *                          optional `satellites` block — the small AsyncStorage stores
 *                          (Shelf, transposition, filters, …) and the UI language
 *   manifest.json          format/version, per-file SHA-256, counts, status
 *   media/<relativePath>   each managed audio file at its container-independent path,
 *                          and each clip's detail-waveform sidecar (`<audio>.waveform`)
 *                          when present — regenerable, but restoring it saves a full
 *                          re-analysis pass on a new device
 */

export const DR_BACKUP_FORMAT_VERSION = 1;
export const DR_BACKUP_FILE_SUFFIX = "songnook-backup";

const DR_TEMP_DIR = `${SONG_NOOK_ROOT}/backup-tmp`;
const SNAPSHOT_ENTRY = "snapshot.json";
const MANIFEST_ENTRY = "manifest.json";
const MEDIA_PREFIX = "media/";
const BACKUP_STREAM_CHUNK_BYTES = 512 * 1024;
const BACKUP_UI_YIELD_BYTES = 2 * 1024 * 1024;
const BACKUP_TEMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** The temp folder a .zip backup is built in, kept out of the iPhone's iCloud device
 *  backup (G12: a stale multi-GB archive used to ride along). */
async function ensureBackupTempDir() {
    const dirInfo = await FileSystem.getInfoAsync(DR_TEMP_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DR_TEMP_DIR, { intermediates: true });
    }
    await excludeFromDeviceBackup(DR_TEMP_DIR).catch(() => {});
}

export type DrMediaKind =
    | "clip-audio"
    | "clip-source"
    | "overdub-stem"
    | "overdub-mix"
    | "workspace-archive"
    | "waveform-sidecar";

/** The exact backup's snapshot.json: the persisted library plus the satellite block. */
export type DrBackupSnapshot = PersistedAppStore & {
    satellites?: DrSatelliteSnapshot;
    /** Raw rows of workspaces set aside at launch (unreadable), by workspace id, so
     *  their bytes leave the phone with the backup (audit 2026-11-02 G10). */
    setAsideWorkspaceRows?: Record<string, string>;
};

/** Missing-record ref of a workspace that was set aside at launch and is NOT in the backup. */
export const SET_ASIDE_WORKSPACE_REF_PREFIX = "set-aside:";

/**
 * A workspace the launch could not read lives only as quarantined bytes, never in
 * memory, so a backup built from memory leaves it out. Saying "complete" would be a lie
 * (audit G10): each one is recorded as critical missing content, which marks the backup
 * incomplete and names it. ("workspace-archive" is the closest kind older builds accept.)
 */
function setAsideWorkspaceRecords(): DrBackupMissingRecord[] {
    return getHydrationDegradedWorkspaceIds().map((id) => ({
        path: `${SET_ASIDE_WORKSPACE_REF_PREFIX}${id}`,
        kind: "workspace-archive" as const,
        critical: true,
        ref: `${SET_ASIDE_WORKSPACE_REF_PREFIX}${id}`,
    }));
}

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
    /** Container-independent path, e.g. `songnook/audio/<id>.m4a`. */
    relativePath: string | null;
    absUri: string;
    kind: DrMediaKind;
    /** Irreplaceable content whose absence makes the backup incomplete. */
    critical: boolean;
    /** Human-readable reference for diagnostics (e.g. song / clip id). */
    ref: string;
    /** Derived data that may legitimately not exist yet (waveform sidecars): absence is
     *  neither recorded as missing nor does it affect the backup's status. */
    optional?: boolean;
};

async function inspectFileIntegrity(
    absUri: string,
    expectedSizeBytes: number,
    options: BackupOperationOptions | undefined,
    progressOffsetBytes: number,
    progressTotalBytes: number
) {
    // CRC-32 (needed up front for the ZIP entry header) streams native chunks through
    // the slice-by-16 JS table; SHA-256 (the v1 manifest digest) is computed natively
    // off the JS thread by sha256OfFileBase64. Together this replaces the pure-JS
    // hash loop that ran at ~0.6MB/s and froze the UI for the whole pass.
    const file = new File(absUri);
    const handle = file.open();
    const crc32 = new IncrementalCrc32();
    let sizeBytes = 0;
    let bytesSinceYield = 0;

    try {
        while (true) {
            throwIfBackupCancelled(options?.signal);
            const chunk = handle.readBytes(BACKUP_STREAM_CHUNK_BYTES);
            if (chunk.length === 0) break;
            crc32.update(chunk);
            sizeBytes += chunk.length;
            bytesSinceYield += chunk.length;

            if (bytesSinceYield >= BACKUP_UI_YIELD_BYTES) {
                reportBackupProgress(options, {
                    phase: "hashing",
                    completedBytes: progressOffsetBytes + sizeBytes,
                    totalBytes: progressTotalBytes,
                    message: i18n.t("process.verifyingClips"),
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
    const sha256 = await sha256OfFileBase64(absUri, sizeBytes, options);
    return { sha256, crc32: crc32.digest(), sizeBytes };
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
    if (kind !== "workspace-archive") {
        // The detail waveform lives right next to its audio and restores to the same
        // token-scoped folder, so `waveformSidecarUri(restoredAudio)` keeps resolving.
        const sidecar = waveformSidecarUri(uri);
        refs.push({
            relativePath: toRelativeManagedPath(sidecar),
            absUri: sidecar,
            kind: "waveform-sidecar",
            critical: false,
            ref,
            optional: true,
        });
    }
}

/** Every canonical audio file referenced by the (absolute, in-memory) library. */
function collectMediaRefs(workspaces: Workspace[]): MediaRef[] {
    const refs: MediaRef[] = [];
    for (const workspace of workspaces) {
        // Archived workspaces keep their only copy of audio inside the archive package —
        // unless it was offloaded to the user's own storage, in which case the file is
        // deliberately not on this device and must not mark the backup incomplete.
        if (workspace.archiveState?.archiveUri && !workspace.archiveState.offloadedAt) {
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

/** Whole-archive bytes, Zip64 records included where the library needs them (G1). */
export function estimateStoredZipArchiveBytes(entries: ZipArchiveEntry[]) {
    const encoder = new TextEncoder();
    return projectStoredZipBytes(
        entries.map((entry) => ({
            nameLength: encoder.encode(entry.archiveName).length,
            size:
                entry.sizeBytes ??
                (typeof entry.data === "string" ? encoder.encode(entry.data).length : entry.data?.length ?? 0),
        }))
    );
}

/**
 * Bytes the archive will take. Past 4 GB it is a Zip64 archive (audit 2026-11-02 G1:
 * a library over 4 GB used to have no backup at all); the only refusal left is a
 * library too large to count exactly, which no phone holds.
 */
export function projectBackupArchiveBytes(entries: ZipArchiveEntry[]) {
    const projectedArchiveBytes = estimateStoredZipArchiveBytes(entries);
    if (!Number.isSafeInteger(projectedArchiveBytes)) {
        throw new UserFacingError(i18n.t("backupOperation.tooLarge"));
    }
    return projectedArchiveBytes;
}

export type DrBackupEstimate = { fileCount: number; totalBytes: number };

/**
 * Cheap pre-run estimate of what a backup will cover — file count + total bytes only,
 * no hashing or reading. Feeds the "961 MB · about 2 minutes" confirmation copy.
 */
export async function estimateDisasterRecoveryBackup(state: AppStore): Promise<DrBackupEstimate> {
    const snapshotAbs = buildPersistedAppStoreSnapshot(state);
    const managedRefs = new Map<string, MediaRef>();
    for (const ref of collectMediaRefs(snapshotAbs.workspaces)) {
        if (!ref.relativePath) continue;
        if (!managedRefs.has(ref.relativePath)) managedRefs.set(ref.relativePath, ref);
    }
    let fileCount = 0;
    let totalBytes = 0;
    for (const ref of managedRefs.values()) {
        const info = await FileSystem.getInfoAsync(ref.absUri);
        if (!info.exists || typeof info.size !== "number" || info.size < 0) continue;
        fileCount += 1;
        totalBytes += info.size;
    }
    return { fileCount, totalBytes };
}

export type ReadableMediaRef = MediaRef & { sizeBytes: number };

export type PreparedBackupContents = {
    snapshotAbs: ReturnType<typeof buildPersistedAppStoreSnapshot>;
    snapshotJson: string;
    snapshotSha256: string;
    /** Every managed file that exists, deduplicated by relative path, with its size. */
    readableRefs: ReadableMediaRef[];
    /** Referenced files that could not be found, plus set-aside workspaces (G10). */
    missing: DrBackupMissingRecord[];
};

/**
 * What any exact backup holds, before it is packed anywhere: the snapshot (relative
 * media paths, satellites, set-aside rows) and the files it references. Shared by the
 * .zip backup and the automatic backup folder, so both carry exactly the same thing.
 */
export async function prepareBackupContents(
    state: AppStore,
    opts?: BackupOperationOptions & {
        satellites?: DrSatelliteSnapshot;
        setAsideWorkspaceRows?: Record<string, string>;
    }
): Promise<PreparedBackupContents> {
    const snapshotAbs = buildPersistedAppStoreSnapshot(state);

    // Snapshot stores RELATIVE media paths so it restores onto any container/device.
    const snapshot: DrBackupSnapshot = {
        ...snapshotAbs,
        workspaces: toRelativeWorkspacesManagedMedia(snapshotAbs.workspaces),
        recentlyDeleted: toRelativeDeletedItemsManagedMedia(snapshotAbs.recentlyDeleted ?? []),
        ...(opts?.satellites ? { satellites: opts.satellites } : null),
        ...(opts?.setAsideWorkspaceRows && Object.keys(opts.setAsideWorkspaceRows).length > 0
            ? { setAsideWorkspaceRows: opts.setAsideWorkspaceRows }
            : null),
    };
    const snapshotJson = JSON.stringify(snapshot);
    const snapshotSha256 = await sha256OfString(snapshotJson);

    const missing: DrBackupMissingRecord[] = setAsideWorkspaceRecords();
    const managedRefs = new Map<string, MediaRef>();

    for (const ref of collectMediaRefs(snapshotAbs.workspaces)) {
        if (!ref.relativePath) {
            // A sidecar of a non-managed file has no stable identity either — skip it.
            if (ref.optional) continue;
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

    const readableRefs: ReadableMediaRef[] = [];
    for (const ref of managedRefs.values()) {
        throwIfBackupCancelled(opts?.signal);

        const info = await FileSystem.getInfoAsync(ref.absUri);
        if (!info.exists) {
            if (!ref.optional) {
                missing.push({ path: ref.relativePath!, kind: ref.kind, critical: ref.critical, ref: ref.ref });
            }
            continue;
        }
        const sizeBytes = typeof info.size === "number" ? info.size : new File(ref.absUri).size;
        if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
            missing.push({ path: ref.relativePath!, kind: ref.kind, critical: ref.critical, ref: ref.ref });
            continue;
        }
        readableRefs.push({ ...ref, sizeBytes });
    }
    return { snapshotAbs, snapshotJson, snapshotSha256, readableRefs, missing };
}

/**
 * Build an exact backup archive into a temp location. Read-only with respect to the live
 * library — it only reads existing files and writes a new archive. The caller is
 * responsible for persisting the archive offsite (SAF folder / Files / iCloud) and for
 * cleaning up the temp file afterward.
 */
export async function buildDisasterRecoveryBackup(
    state: AppStore,
    opts?: BackupOperationOptions & {
        appVersion?: string;
        /** Satellite stores + UI language, gathered by the caller (see satelliteSnapshot.ts). */
        satellites?: DrSatelliteSnapshot;
        /** Quarantined rows of set-aside workspaces, gathered by the caller. */
        setAsideWorkspaceRows?: Record<string, string>;
    }
): Promise<DrBackupResult> {
    throwIfBackupCancelled(opts?.signal);
    reportBackupProgress(opts, {
        phase: "preparing",
        completedBytes: 0,
        totalBytes: 0,
        message: i18n.t("process.preparingBackup"),
    });
    const { snapshotAbs, snapshotJson, snapshotSha256, readableRefs, missing } = await prepareBackupContents(
        state,
        opts
    );
    const entries: ZipArchiveEntry[] = [{ archiveName: SNAPSHOT_ENTRY, data: snapshotJson }];
    const files: DrBackupFileRecord[] = [];

    const totalMediaBytes = readableRefs.reduce((sum, ref) => sum + ref.sizeBytes, 0);
    // Fail before an expensive checksum pass when the temporary archive cannot fit.
    await ensureBackupDiskSpace(totalMediaBytes, "backup");
    throwIfBackupCancelled(opts?.signal);

    // A build whose native writer predates Zip64 makes a > 4 GB backup the JS way.
    const fitsZip32 =
        readableRefs.length + 2 < 0xffff &&
        !needsZip64Value(
            estimateStoredZipArchiveBytes([
                { archiveName: SNAPSHOT_ENTRY, data: snapshotJson },
                ...readableRefs.map((ref) => ({
                    archiveName: `${MEDIA_PREFIX}${ref.relativePath}`,
                    sizeBytes: ref.sizeBytes,
                })),
                { archiveName: MANIFEST_ENTRY, sizeBytes: manifestAllowanceBytes(readableRefs.length) },
            ])
        );
    if (isNativeZipAvailable() && (fitsZip32 || isNativeZip64Available())) {
        const native = await buildBackupArchiveNatively({
            snapshotAbs,
            snapshotJson,
            snapshotSha256,
            readableRefs,
            missing: [...missing],
            opts,
        });
        if (native) return native;
        // The native fingerprint disagreed with the proven JS one: this build's native
        // pass is not trusted, and the backup is made the slower way instead.
    }
    const totalMediaMb = totalMediaBytes / (1024 * 1024);
    console.log(
        `[backup] starting: ${readableRefs.length} files, ${totalMediaMb.toFixed(1)}MB media ` +
            `(native SHA-256 + sliced CRC-32, then a packaging pass)`
    );
    let hashedMediaBytes = 0;
    reportBackupProgress(opts, {
        phase: "hashing",
        completedBytes: 0,
        totalBytes: totalMediaBytes,
        message: i18n.t("process.verifyingClips"),
    });

    const hashStartedAt = Date.now();
    for (const ref of readableRefs) {
        throwIfBackupCancelled(opts?.signal);
        const fileStartedAt = Date.now();
        let integrity: Awaited<ReturnType<typeof inspectFileIntegrity>>;
        try {
            integrity = await inspectFileIntegrity(
                ref.absUri,
                ref.sizeBytes,
                opts,
                hashedMediaBytes,
                totalMediaBytes
            );
            const fileMs = Date.now() - fileStartedAt;
            // Surface individual slow files (a big recording that dominates the pass).
            if (fileMs > 800) {
                console.log(
                    `[backup] slow hash: ${(ref.sizeBytes / (1024 * 1024)).toFixed(1)}MB in ${fileMs}ms ` +
                        `(${((ref.sizeBytes / (1024 * 1024)) / (fileMs / 1000)).toFixed(1)}MB/s) — ${ref.relativePath}`
                );
            }
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
            message: i18n.t("process.verifyingClips"),
        });
    }

    const hashMs = Date.now() - hashStartedAt;
    console.log(
        `[backup] hashing (sha256+crc32) done: ${totalMediaMb.toFixed(1)}MB in ${(hashMs / 1000).toFixed(1)}s ` +
            `(${(totalMediaMb / (hashMs / 1000 || 1)).toFixed(1)}MB/s)`
    );

    if (missing.length > 0) {
        // Surface exactly which library references have no file on disk. Critical entries
        // (clip audio / overdub stems) are irreplaceable and mark the backup incomplete;
        // non-critical ones (source imports, re-derivable mixes) are informational.
        console.log(
            `[backup] ${missing.length} referenced file(s) missing from storage:\n` +
                missing
                    .map(
                        (entry) =>
                            `  • ${entry.critical ? "CRITICAL " : ""}${entry.kind} ${entry.ref} → ${entry.path}`
                    )
                    .join("\n")
        );
    }

    const manifest = composeManifest(snapshotAbs, snapshotSha256, files, missing, opts?.appVersion);
    entries.push({ archiveName: MANIFEST_ENTRY, data: JSON.stringify(manifest) });

    const projectedArchiveBytes = projectBackupArchiveBytes(entries);
    // The whole archive (media + per-entry headers + snapshot + manifest, Zip64 records
    // where it passes 4 GB) must fit on the device before packaging starts.
    await ensureBackupDiskSpace(projectedArchiveBytes, "backup");
    throwIfBackupCancelled(opts?.signal);

    await ensureBackupTempDir();
    const archiveTitle = `SongNook Backup ${buildTimestampSlug()}.${DR_BACKUP_FILE_SUFFIX}.zip`;
    const archiveUri = `${DR_TEMP_DIR}/${archiveTitle}`;
    reportBackupProgress(opts, {
        phase: "packaging",
        completedBytes: 0,
        totalBytes: totalMediaBytes,
        message: i18n.t("process.packagingBackup"),
    });
    const packStartedAt = Date.now();
    await createZipArchive(archiveUri, entries, opts);
    const packMs = Date.now() - packStartedAt;
    const totalMs = Date.now() - hashStartedAt;
    console.log(
        `[backup] packaging done: ${totalMediaMb.toFixed(1)}MB in ${(packMs / 1000).toFixed(1)}s ` +
            `(${(totalMediaMb / (packMs / 1000 || 1)).toFixed(1)}MB/s). ` +
            `Backup total: ${(totalMs / 1000).toFixed(1)}s`
    );
    recordLibraryOperationThroughput("backup", totalMediaBytes, totalMs);

    return { archiveUri, archiveTitle, manifest };
}

export function composeManifest(
    snapshotAbs: ReturnType<typeof buildPersistedAppStoreSnapshot>,
    snapshotSha256: string,
    files: DrBackupFileRecord[],
    missing: DrBackupMissingRecord[],
    appVersion: string | undefined
): DrBackupManifest {
    return {
        formatVersion: DR_BACKUP_FORMAT_VERSION,
        storeVersion: STORE_VERSION,
        appVersion,
        createdAt: new Date().toISOString(),
        status: missing.some((m) => m.critical) ? "incomplete" : "complete",
        counts: countEntities(snapshotAbs.workspaces),
        snapshotSha256,
        files,
        missing,
    };
}

/** Room the manifest may take, for the up-front size guards (it is written last). */
function manifestAllowanceBytes(fileCount: number) {
    return 64 * 1024 + fileCount * 512;
}

/**
 * The backup in ONE native pass (2026-10-20): the snapshot goes in first, then every
 * recording is read once, streamed into the archive and fingerprinted on the way (CRC-32
 * for the zip, SHA-256 of its base64 form for the manifest), then the manifest last. The
 * JS path read each file four times through JavaScript (1.7 GB took 17 minutes). Same
 * archive layout and the same manifest, so every backup restores either way.
 */
async function buildBackupArchiveNatively({
    snapshotAbs,
    snapshotJson,
    snapshotSha256,
    readableRefs,
    missing,
    opts,
}: {
    snapshotAbs: ReturnType<typeof buildPersistedAppStoreSnapshot>;
    snapshotJson: string;
    snapshotSha256: string;
    readableRefs: Array<MediaRef & { sizeBytes: number }>;
    missing: DrBackupMissingRecord[];
    opts?: BackupOperationOptions & { appVersion?: string };
}): Promise<DrBackupResult | null> {
    const totalMediaBytes = readableRefs.reduce((sum, ref) => sum + ref.sizeBytes, 0);
    // Self-check: the first file the native pass writes is fingerprinted again by the
    // proven JS route. A disagreement means this build's native code can't be trusted
    // with a backup someone's library depends on.
    const probe = [...readableRefs].sort((a, b) => a.sizeBytes - b.sizeBytes)[0];
    const projectedArchiveBytes = projectBackupArchiveBytes([
        { archiveName: SNAPSHOT_ENTRY, data: snapshotJson },
        ...readableRefs.map((ref) => ({
            archiveName: `${MEDIA_PREFIX}${ref.relativePath}`,
            fileUri: ref.absUri,
            sizeBytes: ref.sizeBytes,
        })),
        { archiveName: MANIFEST_ENTRY, sizeBytes: manifestAllowanceBytes(readableRefs.length) },
    ]);
    await ensureBackupDiskSpace(projectedArchiveBytes, "backup");
    throwIfBackupCancelled(opts?.signal);

    await ensureBackupTempDir();
    const archiveTitle = `SongNook Backup ${buildTimestampSlug()}.${DR_BACKUP_FILE_SUFFIX}.zip`;
    const archiveUri = `${DR_TEMP_DIR}/${archiveTitle}`;
    const startedAt = Date.now();
    const files: DrBackupFileRecord[] = [];
    let doneBytes = 0;
    const report = (completedBytes: number) =>
        reportBackupProgress(opts, {
            phase: "packaging",
            completedBytes,
            totalBytes: totalMediaBytes,
            message: i18n.t("process.packagingBackup"),
        });
    report(0);

    const writer = await NativeZipWriter.create(archiveUri);
    let finished = false;
    try {
        await writer.addText(SNAPSHOT_ENTRY, snapshotJson);
        for (const ref of readableRefs) {
            throwIfBackupCancelled(opts?.signal);
            const before = doneBytes;
            try {
                const written = await writer.addFile(`${MEDIA_PREFIX}${ref.relativePath}`, ref.absUri, {
                    expectedSizeBytes: ref.sizeBytes,
                    sha256: true,
                    signal: opts?.signal,
                    onProgress: ({ completedBytes }) => report(before + completedBytes),
                });
                if (!written.sha256) throw new Error("No fingerprint for a backed-up file.");
                if (ref === probe) {
                    const proven = await sha256OfFileBase64(ref.absUri, ref.sizeBytes, opts);
                    if (proven !== written.sha256) {
                        console.warn("[backup] native fingerprint disagreed with JS; using the JS path");
                        return null;
                    }
                }
                files.push({ path: ref.relativePath!, sha256: written.sha256, sizeBytes: written.sizeBytes });
            } catch (error) {
                if (opts?.signal?.aborted || (error instanceof Error && error.message === NATIVE_IO_CANCELLED)) {
                    throw error;
                }
                // Unreadable or changed mid-read: the writer left the archive as it was,
                // and the file is recorded as missing, exactly as the JS path does.
                missing.push({ path: ref.relativePath!, kind: ref.kind, critical: ref.critical, ref: ref.ref });
            }
            doneBytes += ref.sizeBytes;
            report(doneBytes);
        }

        const manifest = composeManifest(snapshotAbs, snapshotSha256, files, missing, opts?.appVersion);
        await writer.addText(MANIFEST_ENTRY, JSON.stringify(manifest));
        await writer.finish();
        finished = true;

        const totalMs = Date.now() - startedAt;
        console.log(
            `[backup] native single pass: ${(totalMediaBytes / (1024 * 1024)).toFixed(1)}MB in ` +
                `${(totalMs / 1000).toFixed(1)}s (${(totalMediaBytes / (1024 * 1024) / (totalMs / 1000 || 1)).toFixed(1)}MB/s)`
        );
        recordLibraryOperationThroughput("backup", totalMediaBytes, totalMs);
        return { archiveUri, archiveTitle, manifest };
    } catch (error) {
        return rethrowNativeCancel(error, opts?.signal);
    } finally {
        if (!finished) await writer.abort();
    }
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
