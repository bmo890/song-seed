import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import {
    composeManifest,
    DR_BACKUP_FORMAT_VERSION,
    prepareBackupContents,
    type DrBackupFileRecord,
    type DrBackupManifest,
} from "./disasterRecoveryBackup";
import { validateDisasterRecoveryManifest } from "./disasterRecoveryValidation";
import { sha256OfFileBase64 } from "./fileHashing";
import { collectSatelliteSnapshot } from "./satelliteSnapshot";
import { collectSetAsideWorkspaceRows } from "./libraryBackup";
import {
    BackupOperationCancelledError,
    throwIfBackupCancelled,
    type BackupOperationOptions,
} from "./backupOperation";
import { DrRestoreError } from "./disasterRecoveryErrors";
import type { DrRestoreSource } from "./disasterRecoveryRestore";
import { STORE_VERSION, type AppStore } from "../state/useStore";
import { NATIVE_IO_CANCELLED, nativeBackupFolder, type BackupFolderChild } from "../../modules/songnook-file-io";

/**
 * Automatic backup (founder decision C, 2026-11-02): ONE backup, kept current in place,
 * in a folder the person picks once. Never several old copies.
 *
 * Layout, inside "SongNook Backup" in the picked location:
 *   media/<encoded path>          every recording, layer, mix, archive package and
 *                                 waveform sidecar, named by its library path
 *   snapshot-<stamp>.json         the same snapshot the .zip backup carries
 *   manifest-<stamp>.json         the same manifest, written LAST: it is the commit
 *
 * A run copies only media the folder lacks (recordings never change after they are
 * made; an edit makes a new file), then writes a new snapshot + manifest generation and
 * deletes the older one. Interrupting a run anywhere is harmless: the previous
 * generation stays whole until the new manifest lands, and the next run continues.
 * Media the library no longer uses stays 30 days (as Recently deleted does), then goes.
 */

export const AUTO_BACKUP_FOLDER_NAME = "SongNook Backup";
const MEDIA_DIR = "media";
const MANIFEST_PREFIX = "manifest-";
const SNAPSHOT_PREFIX = "snapshot-";
const JSON_SUFFIX = ".json";
const PARTIAL_PREFIX = ".partial-";
export const AUTO_BACKUP_PRUNE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const FREE_SPACE_RESERVE_BYTES = 64 * 1024 * 1024;

/** The native calls, injectable for tests. */
export type BackupFolderIO = typeof nativeBackupFolder;

/** The folder's manifest: the exact-backup manifest plus what the folder remembers. */
export type FolderBackupManifest = DrBackupManifest & {
    folder: {
        layout: 1;
        /** Media no longer in the library, by file name: when it was first seen unused. */
        retired: Record<string, number>;
    };
};

export class AutoBackupError extends Error {
    constructor(
        readonly code: "folderUnavailable" | "lowSpace" | "failed",
        message: string
    ) {
        super(message);
        this.name = "AutoBackupError";
    }
}

/** Media file name for a library path: reversible, one flat folder, no separators. */
export function mediaFileName(relativePath: string) {
    return encodeURIComponent(relativePath);
}

export function mediaPathOfFileName(name: string): string | null {
    try {
        const path = decodeURIComponent(name);
        return path.startsWith("songnook/") ? path : null;
    } catch {
        return null;
    }
}

/** Sortable generation stamp (milliseconds, zero-padded). */
function generationStamp(now: number) {
    return String(Math.max(0, Math.floor(now))).padStart(15, "0");
}

function generationOf(name: string, prefix: string) {
    if (!name.startsWith(prefix) || !name.endsWith(JSON_SUFFIX)) return null;
    const stamp = name.slice(prefix.length, -JSON_SUFFIX.length);
    return /^\d{15}$/.test(stamp) ? stamp : null;
}

function folderError(error: unknown): never {
    const message = error instanceof Error ? error.message : String(error);
    if (/SONGNOOK_FOLDER_(GONE|NO_ACCESS)/.test(message)) {
        throw new AutoBackupError("folderUnavailable", message);
    }
    throw error;
}

/**
 * The backup root inside a picked folder: the folder itself when it already holds
 * generations (the person picked "SongNook Backup" itself), else its "SongNook Backup"
 * child, created when `create` is set.
 */
export async function locateBackupRoot(io: BackupFolderIO, pickedUri: string, create: boolean) {
    const listing = await io.list(pickedUri);
    if (listing.some((child) => generationOf(child.name, MANIFEST_PREFIX))) return pickedUri;
    const existing = listing.find((child) => child.isDirectory && child.name === AUTO_BACKUP_FOLDER_NAME);
    if (existing) return existing.uri;
    if (!create) return null;
    const created = await io.child(pickedUri, AUTO_BACKUP_FOLDER_NAME, true);
    if (!created) throw new AutoBackupError("failed", "Could not create the backup folder.");
    return created;
}

export type FolderGeneration = {
    stamp: string;
    manifest: FolderBackupManifest;
    manifestUri: string;
    snapshotUri: string;
};

/** The newest generation whose manifest reads and validates and whose snapshot exists. */
export async function readNewestGeneration(
    io: BackupFolderIO,
    rootListing: BackupFolderChild[]
): Promise<FolderGeneration | null> {
    const snapshots = new Map<string, BackupFolderChild>();
    for (const child of rootListing) {
        const stamp = generationOf(child.name, SNAPSHOT_PREFIX);
        if (stamp) snapshots.set(stamp, child);
    }
    const manifests = rootListing
        .map((child) => ({ child, stamp: generationOf(child.name, MANIFEST_PREFIX) }))
        .filter((item): item is { child: BackupFolderChild; stamp: string } => item.stamp != null)
        .sort((a, b) => (a.stamp < b.stamp ? 1 : -1));
    for (const { child, stamp } of manifests) {
        const snapshot = snapshots.get(stamp);
        if (!snapshot) continue;
        try {
            const value = JSON.parse(await io.readText(child.uri));
            const manifest = validateDisasterRecoveryManifest(value, DR_BACKUP_FORMAT_VERSION, STORE_VERSION);
            const retired = value?.folder?.retired;
            return {
                stamp,
                manifest: {
                    ...manifest,
                    folder: {
                        layout: 1,
                        retired:
                            retired && typeof retired === "object" && !Array.isArray(retired)
                                ? Object.fromEntries(
                                      Object.entries(retired as Record<string, unknown>).filter(
                                          (entry): entry is [string, number] => Number.isFinite(entry[1])
                                      )
                                  )
                                : {},
                    },
                },
                manifestUri: child.uri,
                snapshotUri: snapshot.uri,
            };
        } catch (error) {
            // An unreadable or newer-format generation: try the one before it.
            console.warn(`[AutoBackup] generation ${stamp} unreadable`, error);
        }
    }
    return null;
}

export type FolderBackupResult = {
    status: DrBackupManifest["status"];
    manifest: FolderBackupManifest;
    copiedFiles: number;
    copiedBytes: number;
    prunedFiles: number;
};

export type FolderBackupOptions = BackupOperationOptions & {
    io?: BackupFolderIO;
    now?: number;
    /** Awaited between files, so a run yields to the person using the app. */
    betweenFiles?: () => Promise<void>;
    /** Test seams for the snapshot extras gathered from the device. */
    satellites?: Awaited<ReturnType<typeof collectSatelliteSnapshot>>;
    setAsideWorkspaceRows?: Record<string, string>;
};

/**
 * Bring the backup folder up to date with the library. Read-only toward the library.
 */
export async function runFolderBackup(
    state: AppStore,
    folderHandle: string,
    options?: FolderBackupOptions
): Promise<FolderBackupResult> {
    const io = options?.io ?? nativeBackupFolder;
    const now = options?.now ?? Date.now();
    throwIfBackupCancelled(options?.signal);

    const resolved = await io.resolve(folderHandle).catch(folderError);
    const root = await locateBackupRoot(io, resolved.uri, true).catch(folderError);
    const mediaDir = await io.child(root!, MEDIA_DIR, true).catch(folderError);
    if (!mediaDir) throw new AutoBackupError("failed", "Could not create the media folder.");

    const contents = await prepareBackupContents(state, {
        ...options,
        satellites: options?.satellites ?? (await collectSatelliteSnapshot()),
        setAsideWorkspaceRows: options?.setAsideWorkspaceRows ?? (await collectSetAsideWorkspaceRows()),
    });

    const rootListing = await io.list(root!);
    const previous = await readNewestGeneration(io, rootListing);
    const previousByPath = new Map((previous?.manifest.files ?? []).map((file) => [file.path, file]));
    const mediaListing = new Map((await io.list(mediaDir)).map((child) => [child.name, child]));

    const files: DrBackupFileRecord[] = [];
    const missing = [...contents.missing];
    const keptNames = new Set<string>();
    let copiedFiles = 0;
    let copiedBytes = 0;

    for (const ref of contents.readableRefs) {
        throwIfBackupCancelled(options?.signal);
        const path = ref.relativePath!;
        const name = mediaFileName(path);
        const inFolder = mediaListing.get(name);
        const before = previousByPath.get(path);
        try {
            let sha256: string;
            if (inFolder && before && before.sizeBytes === ref.sizeBytes && (inFolder.size < 0 || inFolder.size === ref.sizeBytes)) {
                // Already there from an earlier run: nothing to read or copy.
                sha256 = before.sha256;
            } else if (inFolder && !before && inFolder.size === ref.sizeBytes) {
                // Placed by a run that stopped before its manifest (files only ever land
                // whole, under their final name): fingerprint the phone's copy.
                sha256 = await sha256OfFileBase64(ref.absUri, ref.sizeBytes, options);
            } else {
                const free = await FileSystem.getFreeDiskStorageAsync().catch(() => Number.POSITIVE_INFINITY);
                if (Number.isFinite(free) && free < ref.sizeBytes + FREE_SPACE_RESERVE_BYTES) {
                    throw new AutoBackupError("lowSpace", "Not enough free storage to copy a recording.");
                }
                const placed = await io.writeFile(mediaDir, name, ref.absUri);
                if (placed.sizeBytes !== ref.sizeBytes) {
                    throw new Error(`The backup folder received an incomplete file: ${path}`);
                }
                sha256 = await sha256OfFileBase64(ref.absUri, ref.sizeBytes, options);
                copiedFiles += 1;
                copiedBytes += ref.sizeBytes;
            }
            files.push({ path, sha256, sizeBytes: ref.sizeBytes });
            keptNames.add(name);
        } catch (error) {
            if (error instanceof AutoBackupError) throw error;
            throwIfBackupCancelled(options?.signal);
            const message = error instanceof Error ? error.message : String(error);
            if (/SONGNOOK_FOLDER_/.test(message)) folderError(error);
            // One unreadable recording never sinks the run; it is named as missing, as in
            // the .zip backup. Optional sidecars are simply skipped.
            if (!ref.optional) missing.push({ path, kind: ref.kind, critical: ref.critical, ref: ref.ref });
        }
        await options?.betweenFiles?.();
    }

    // A recording the library still points at but this phone can no longer read keeps
    // the copy an earlier run made: the folder is then the only place it survives, so
    // it must stay listed (and never be pruned) rather than be reported missing.
    for (let index = missing.length - 1; index >= 0; index -= 1) {
        const lost = missing[index];
        const before = previousByPath.get(lost.path);
        const name = mediaFileName(lost.path);
        if (!before || !mediaListing.has(name) || keptNames.has(name)) continue;
        files.push(before);
        keptNames.add(name);
        missing.splice(index, 1);
    }

    // Media the library no longer uses: remembered from the first run that saw it
    // unused, deleted 30 days later. A leftover partial copy goes now.
    const retired: Record<string, number> = {};
    let prunedFiles = 0;
    for (const child of mediaListing.values()) {
        if (keptNames.has(child.name) || child.isDirectory) continue;
        const since = child.name.startsWith(PARTIAL_PREFIX) ? 0 : previous?.manifest.folder.retired[child.name] ?? now;
        if (now - since >= AUTO_BACKUP_PRUNE_AFTER_MS || child.name.startsWith(PARTIAL_PREFIX)) {
            await io.remove(child.uri).catch(() => {});
            prunedFiles += 1;
        } else {
            retired[child.name] = since;
        }
    }

    const manifest: FolderBackupManifest = {
        ...composeManifest(
            contents.snapshotAbs,
            contents.snapshotSha256,
            files,
            missing,
            Constants.expoConfig?.version ?? undefined
        ),
        folder: { layout: 1, retired },
    };
    // Never let a generation sort before the one it replaces (a clock set back).
    const stamp = generationStamp(Math.max(now, previous ? Number(previous.stamp) + 1 : 0));
    throwIfBackupCancelled(options?.signal);
    await io.writeText(root!, `${SNAPSHOT_PREFIX}${stamp}${JSON_SUFFIX}`, contents.snapshotJson);
    // The manifest is the commit: until it lands, the previous generation is the backup.
    await io.writeText(root!, `${MANIFEST_PREFIX}${stamp}${JSON_SUFFIX}`, JSON.stringify(manifest));

    for (const child of rootListing) {
        const old = generationOf(child.name, MANIFEST_PREFIX) ?? generationOf(child.name, SNAPSHOT_PREFIX);
        if ((old && old !== stamp) || child.name.startsWith(PARTIAL_PREFIX)) {
            await io.remove(child.uri).catch(() => {});
        }
    }

    return { status: manifest.status, manifest, copiedFiles, copiedBytes, prunedFiles };
}

/**
 * The backup folder as a restore source: the newest whole generation and its media,
 * presented under the same names a .zip backup uses.
 */
export async function openFolderRestoreSource(
    folderHandle: string,
    options?: { io?: BackupFolderIO }
): Promise<DrRestoreSource & { createdAt: string }> {
    const io = options?.io ?? nativeBackupFolder;
    const resolved = await io.resolve(folderHandle).catch(() => {
        throw new DrRestoreError("fileMissing", "The backup folder can't be opened.");
    });
    const root = await locateBackupRoot(io, resolved.uri, false);
    const generation = root ? await readNewestGeneration(io, await io.list(root)) : null;
    if (!root || !generation) {
        throw new DrRestoreError("notBackup", "This folder holds no SongNook backup.");
    }
    const mediaDir = await io.child(root, MEDIA_DIR, false);
    const media = mediaDir ? await io.list(mediaDir) : [];

    const uris = new Map<string, string>([
        ["snapshot.json", generation.snapshotUri],
        ["manifest.json", generation.manifestUri],
    ]);
    const entries = new Map<string, { sizeBytes: number }>([
        ["snapshot.json", { sizeBytes: -1 }],
        ["manifest.json", { sizeBytes: -1 }],
    ]);
    for (const child of media) {
        const path = mediaPathOfFileName(child.name);
        if (!path || child.isDirectory) continue;
        uris.set(`media/${path}`, child.uri);
        entries.set(`media/${path}`, { sizeBytes: child.size });
    }
    return {
        createdAt: generation.manifest.createdAt,
        entries,
        exactEntries: false,
        totalSizeBytes: Number.MAX_SAFE_INTEGER,
        readEntryText: async (name) => io.readText(uris.get(name)!),
        extractEntry: async (name, targetUri, extractOptions) => {
            try {
                const result = await io.copyOut(uris.get(name)!, targetUri, {
                    sha256: true,
                    signal: extractOptions.signal,
                    onProgress: ({ completedBytes }) => extractOptions.onBytes?.(completedBytes),
                });
                return result.sha256 ?? "";
            } catch (error) {
                if (extractOptions.signal?.aborted || (error instanceof Error && error.message === NATIVE_IO_CANCELLED)) {
                    throw new BackupOperationCancelledError();
                }
                throw error;
            }
        },
    };
}
