import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";
import { createZipArchive, buildTimestampSlug, type ZipArchiveEntry } from "./audioStorage";
import { SONG_SEED_ROOT, toRelativeManagedPath } from "./storagePaths";
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

/**
 * SHA-256 of a file's contents. Hashes the base64 representation (consistent on backup
 * and restore), avoiding a byte-array conversion. Files are read one at a time so memory
 * stays bounded during an occasional backup.
 */
async function sha256OfFile(absUri: string): Promise<string> {
    const base64 = await FileSystem.readAsStringAsync(absUri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    return sha256OfString(base64);
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

/**
 * Build an exact backup archive into a temp location. Read-only with respect to the live
 * library — it only reads existing files and writes a new archive. The caller is
 * responsible for persisting the archive offsite (SAF folder / Files / iCloud) and for
 * cleaning up the temp file afterward.
 */
export async function buildDisasterRecoveryBackup(
    state: AppStore,
    opts?: { appVersion?: string }
): Promise<DrBackupResult> {
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
    const seen = new Set<string>();

    for (const ref of collectMediaRefs(snapshotAbs.workspaces)) {
        if (!ref.relativePath) {
            // A referenced file outside managed storage cannot be reliably backed up.
            if (ref.critical) {
                missing.push({ path: ref.absUri, kind: ref.kind, critical: true, ref: ref.ref });
            }
            continue;
        }
        if (seen.has(ref.relativePath)) continue;
        seen.add(ref.relativePath);

        const info = await FileSystem.getInfoAsync(ref.absUri);
        if (!info.exists) {
            missing.push({ path: ref.relativePath, kind: ref.kind, critical: ref.critical, ref: ref.ref });
            continue;
        }

        const sha256 = await sha256OfFile(ref.absUri);
        entries.push({ archiveName: `${MEDIA_PREFIX}${ref.relativePath}`, fileUri: ref.absUri });
        files.push({ path: ref.relativePath, sha256, sizeBytes: info.size ?? 0 });
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

    const dirInfo = await FileSystem.getInfoAsync(DR_TEMP_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DR_TEMP_DIR, { intermediates: true });
    }
    const archiveTitle = `Song Seed Backup ${buildTimestampSlug()}.${DR_BACKUP_FILE_SUFFIX}.zip`;
    const archiveUri = `${DR_TEMP_DIR}/${archiveTitle}`;
    await createZipArchive(archiveUri, entries);

    return { archiveUri, archiveTitle, manifest };
}
