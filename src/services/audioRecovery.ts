import * as FileSystem from "expo-file-system/legacy";
import { strFromU8, unzipSync } from "fflate";
import { SONG_SEED_AUDIO_DIR, SONG_SEED_WORKSPACE_ARCHIVE_DIR } from "./storagePaths";
import { loadAudioDurationMs } from "./audioStorage";
import { buildStaticWaveform } from "../utils";
import type { SongIdea, ClipVersion, Workspace } from "../types";

/* ── Types ──────────────────────────────────────────────────────── */

export type RecoveredClip = {
    ideaId: string;
    clipId: string;
    title: string;
    audioUri: string;
    durationMs?: number;
    waveformPeaks?: number[];
    fileModifiedAt?: number;
};

export type ArchiveRecoveryResult = {
    workspace: Workspace;
    archiveUri: string;
    audioFileCount: number;
    restoredAudioCount: number;
    warnings: string[];
};

export type FullRecoveryResult = {
    restoredFromArchives: ArchiveRecoveryResult[];
    orphanedClipCount: number;
    totalRestoredIdeas: number;
    warnings: string[];
};

/* ── Base64 helpers (matching workspaceArchive.ts) ──────────────── */

function base64ToBytes(base64: string) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
    let buffer = 0;
    let bits = 0;
    const output: number[] = [];

    for (const char of clean) {
        if (char === "=") break;
        const index = alphabet.indexOf(char);
        if (index < 0) continue;
        buffer = (buffer << 6) | index;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            output.push((buffer >> bits) & 0xff);
        }
    }

    return Uint8Array.from(output);
}

function bytesToBase64(bytes: Uint8Array) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let output = "";

    for (let index = 0; index < bytes.length; index += 3) {
        const a = bytes[index] ?? 0;
        const b = bytes[index + 1] ?? 0;
        const c = bytes[index + 2] ?? 0;
        const chunk = (a << 16) | (b << 8) | c;

        output += alphabet[(chunk >> 18) & 0x3f];
        output += alphabet[(chunk >> 12) & 0x3f];
        output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 0x3f] : "=";
        output += index + 2 < bytes.length ? alphabet[chunk & 0x3f] : "=";
    }

    return output;
}

async function readFileBytes(fileUri: string) {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToBytes(base64);
}

async function writeFileBytes(fileUri: string, bytes: Uint8Array) {
    const parentDirectory = fileUri.slice(0, fileUri.lastIndexOf("/"));
    if (parentDirectory) {
        await FileSystem.makeDirectoryAsync(parentDirectory, { intermediates: true });
    }
    await FileSystem.writeAsStringAsync(fileUri, bytesToBase64(bytes), {
        encoding: FileSystem.EncodingType.Base64,
    });
}

/* ── Archive-based recovery ─────────────────────────────────────── */

type ArchiveManifest = {
    schemaVersion: number;
    workspaceId: string;
    workspaceTitle: string;
    archivedAt: string;
    audioFiles: { archivePath: string; liveUri: string; originalSizeBytes: number }[];
    missingFileUris: string[];
};

/**
 * Scan the workspace-archives directory for .songseed-workspace.zip files.
 * Returns metadata about each archive found without extracting them yet.
 */
export async function findWorkspaceArchives(): Promise<
    { archiveUri: string; workspaceId: string; workspaceTitle: string; archivedAt: string }[]
> {
    const dirInfo = await FileSystem.getInfoAsync(SONG_SEED_WORKSPACE_ARCHIVE_DIR);
    if (!dirInfo.exists) return [];

    const files = await FileSystem.readDirectoryAsync(SONG_SEED_WORKSPACE_ARCHIVE_DIR);
    const archives: { archiveUri: string; workspaceId: string; workspaceTitle: string; archivedAt: string }[] = [];

    for (const filename of files) {
        if (!filename.endsWith(".songseed-workspace.zip")) continue;

        const archiveUri = `${SONG_SEED_WORKSPACE_ARCHIVE_DIR}/${filename}`;
        try {
            const zipBytes = await readFileBytes(archiveUri);
            const zipEntries = unzipSync(zipBytes);
            const manifestEntry = zipEntries["manifest.json"];
            if (!manifestEntry) continue;

            const manifest = JSON.parse(strFromU8(manifestEntry)) as ArchiveManifest;
            archives.push({
                archiveUri,
                workspaceId: manifest.workspaceId,
                workspaceTitle: manifest.workspaceTitle,
                archivedAt: manifest.archivedAt,
            });
        } catch {
            // Corrupted archive — skip but don't crash recovery
        }
    }

    return archives;
}

/**
 * Restore a full workspace from a .songseed-workspace.zip archive.
 * Extracts all audio files back to their original URIs and returns the
 * complete Workspace object with all metadata intact.
 */
export async function restoreWorkspaceFromArchive(
    archiveUri: string,
    onProgress?: (done: number, total: number) => void
): Promise<ArchiveRecoveryResult> {
    const zipBytes = await readFileBytes(archiveUri);
    const zipEntries = unzipSync(zipBytes);

    const manifestEntry = zipEntries["manifest.json"];
    const workspaceEntry = zipEntries["workspace.json"];

    if (!manifestEntry || !workspaceEntry) {
        throw new Error("Archive is missing manifest.json or workspace.json.");
    }

    const manifest = JSON.parse(strFromU8(manifestEntry)) as ArchiveManifest;
    const workspace = JSON.parse(strFromU8(workspaceEntry)) as Workspace;

    // Restore the workspace as non-archived (it's being fully restored)
    workspace.isArchived = false;
    workspace.archiveState = undefined;

    const warnings: string[] = [];
    let restoredAudioCount = 0;
    const totalFiles = manifest.audioFiles.length;

    // Restore each audio file from the archive
    for (let i = 0; i < manifest.audioFiles.length; i++) {
        const audioFile = manifest.audioFiles[i];
        onProgress?.(i, totalFiles);

        const entryBytes = zipEntries[audioFile.archivePath];
        if (!entryBytes) {
            warnings.push(`Missing archive entry: ${audioFile.archivePath}`);
            continue;
        }

        try {
            // Check if the file already exists at the live URI
            const existingInfo = await FileSystem.getInfoAsync(audioFile.liveUri);
            if (existingInfo.exists) {
                // File already on disk — skip writing but count it
                restoredAudioCount++;
                continue;
            }

            await writeFileBytes(audioFile.liveUri, entryBytes);
            restoredAudioCount++;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            warnings.push(`Failed to restore ${audioFile.archivePath}: ${msg}`);
        }
    }

    onProgress?.(totalFiles, totalFiles);

    if (manifest.missingFileUris.length > 0) {
        warnings.push(
            `${manifest.missingFileUris.length} audio file(s) were already missing when this workspace was archived.`
        );
    }

    return {
        workspace,
        archiveUri,
        audioFileCount: totalFiles,
        restoredAudioCount,
        warnings,
    };
}

/**
 * Full recovery: first restores from any workspace archives found on disk,
 * then recovers any remaining orphaned audio files not covered by archives.
 *
 * This is the primary entry point for data recovery.
 */
export async function performFullRecovery(
    currentWorkspaces: Workspace[],
    onProgress?: (phase: string, done: number, total: number) => void
): Promise<FullRecoveryResult> {
    const allWarnings: string[] = [];
    const archiveResults: ArchiveRecoveryResult[] = [];

    // Phase 1: Restore from workspace archives
    onProgress?.("Scanning archives...", 0, 1);
    const archives = await findWorkspaceArchives();

    if (archives.length > 0) {
        // Filter out archives for workspaces already fully loaded in the store
        const currentWorkspaceIds = new Set(
            currentWorkspaces
                .filter((ws) => !ws.isArchived && ws.ideas.length > 0)
                .map((ws) => ws.id)
        );

        const archivesToRestore = archives.filter(
            (a) => !currentWorkspaceIds.has(a.workspaceId)
        );

        for (let i = 0; i < archivesToRestore.length; i++) {
            const archive = archivesToRestore[i];
            onProgress?.(
                `Restoring "${archive.workspaceTitle}"...`,
                i,
                archivesToRestore.length
            );

            try {
                const result = await restoreWorkspaceFromArchive(
                    archive.archiveUri,
                    (done, total) => {
                        onProgress?.(
                            `Restoring "${archive.workspaceTitle}" (${done}/${total} files)...`,
                            i,
                            archivesToRestore.length
                        );
                    }
                );
                archiveResults.push(result);
                allWarnings.push(...result.warnings);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                allWarnings.push(`Failed to restore archive "${archive.workspaceTitle}": ${msg}`);
            }
        }
    }

    // Phase 2: Build a combined set of all known audio URIs (current + just-restored)
    const allWorkspaces = [
        ...currentWorkspaces,
        ...archiveResults.map((r) => r.workspace),
    ];

    onProgress?.("Scanning for orphaned files...", 0, 1);
    const orphans = await findOrphanedAudioFiles(allWorkspaces);
    let orphanedClipCount = 0;

    if (orphans.length > 0) {
        onProgress?.("Enriching orphaned clips...", 0, orphans.length);
        const enriched = await enrichOrphanedClips(orphans, (done, total) => {
            onProgress?.("Enriching orphaned clips...", done, total);
        });
        orphanedClipCount = enriched.length;
    }

    const totalRestoredIdeas = archiveResults.reduce(
        (sum, r) => sum + r.workspace.ideas.length,
        0
    ) + orphanedClipCount;

    return {
        restoredFromArchives: archiveResults,
        orphanedClipCount,
        totalRestoredIdeas,
        warnings: allWarnings,
    };
}

/* ── Orphaned audio file recovery (fallback) ────────────────────── */

/**
 * Scans the managed audio directory for files that are not referenced
 * by any clip in any workspace. Returns metadata for each orphaned file
 * so the caller can create ideas from them.
 */
export async function findOrphanedAudioFiles(
    workspaces: Workspace[]
): Promise<RecoveredClip[]> {
    const dirInfo = await FileSystem.getInfoAsync(SONG_SEED_AUDIO_DIR);
    if (!dirInfo.exists) return [];

    const files = await FileSystem.readDirectoryAsync(SONG_SEED_AUDIO_DIR);
    if (files.length === 0) return [];

    // Build a set of all audioUri values currently referenced by the store
    const knownUris = new Set<string>();
    for (const ws of workspaces) {
        for (const idea of ws.ideas) {
            for (const clip of idea.clips) {
                if (clip.audioUri) knownUris.add(clip.audioUri);
                if (clip.sourceAudioUri) knownUris.add(clip.sourceAudioUri);
            }
        }
    }

    const audioExtensions = new Set(["m4a", "mp3", "wav", "aac", "ogg", "flac", "mp4"]);
    const orphans: RecoveredClip[] = [];

    for (const filename of files) {
        const ext = filename.split(".").pop()?.toLowerCase();
        if (!ext || !audioExtensions.has(ext)) continue;

        const fullUri = `${SONG_SEED_AUDIO_DIR}/${filename}`;
        if (knownUris.has(fullUri)) continue;

        // This file is orphaned — not referenced by any clip
        const baseName = filename.replace(/\.[^.]+$/, "");
        const now = Date.now();
        const ideaId = `recovered-idea-${now}-${Math.random().toString(36).slice(2, 7)}`;
        const clipId = `recovered-clip-${now}-${Math.random().toString(36).slice(2, 7)}`;

        // Try to get file modification time for sorting
        let fileModifiedAt: number | undefined;
        try {
            const info = await FileSystem.getInfoAsync(fullUri);
            if (info.exists && "modificationTime" in info && typeof info.modificationTime === "number") {
                fileModifiedAt = info.modificationTime > 1e12
                    ? info.modificationTime
                    : info.modificationTime * 1000;
            }
        } catch { /* ignore */ }

        // Build a human-readable title from the filename
        const title = buildRecoveredTitle(baseName);

        orphans.push({
            ideaId,
            clipId,
            title,
            audioUri: fullUri,
            fileModifiedAt,
        });
    }

    // Sort by modification time (newest first) if available
    orphans.sort((a, b) => (b.fileModifiedAt ?? 0) - (a.fileModifiedAt ?? 0));

    return orphans;
}

/**
 * Lightweight enrichment: only loads duration (via a short-lived audio player)
 * and generates a static waveform. Avoids extractAudioAnalysis which is too
 * heavy to run on many files in sequence and causes crashes.
 *
 * Waveforms will be properly regenerated when the user plays each clip.
 */
export async function enrichOrphanedClips(
    orphans: RecoveredClip[],
    onProgress?: (done: number, total: number) => void
): Promise<RecoveredClip[]> {
    const enriched: RecoveredClip[] = [];

    for (let i = 0; i < orphans.length; i++) {
        const orphan = orphans[i];
        onProgress?.(i, orphans.length);

        let durationMs: number | undefined;
        try {
            durationMs = await loadAudioDurationMs(orphan.audioUri, 3000);
        } catch {
            // Duration unknown — still recoverable
        }

        // Use a lightweight static waveform instead of full audio analysis
        const waveformPeaks = buildStaticWaveform(
            `${orphan.clipId}-${durationMs ?? 0}`,
            96
        );

        enriched.push({
            ...orphan,
            durationMs,
            waveformPeaks,
        });

        // Small delay between files to avoid overwhelming the audio subsystem
        if (i < orphans.length - 1) {
            await new Promise((r) => setTimeout(r, 100));
        }
    }

    onProgress?.(orphans.length, orphans.length);
    return enriched;
}

/**
 * Build SongIdea objects from recovered clips, ready to insert into a workspace.
 */
export function buildRecoveredIdeas(
    clips: RecoveredClip[],
    collectionId: string
): SongIdea[] {
    const now = Date.now();

    return clips.map((clip) => {
        const createdAt = clip.fileModifiedAt ?? now;

        const clipVersion: ClipVersion = {
            id: clip.clipId,
            title: clip.title,
            notes: "",
            createdAt,
            isPrimary: true,
            audioUri: clip.audioUri,
            durationMs: clip.durationMs,
            waveformPeaks: clip.waveformPeaks,
        };

        const idea: SongIdea = {
            id: clip.ideaId,
            title: clip.title,
            notes: "",
            status: "clip",
            completionPct: 0,
            kind: "clip",
            collectionId,
            clips: [clipVersion],
            createdAt,
            lastActivityAt: createdAt,
            importedAt: now,
        };

        return idea;
    });
}

function buildRecoveredTitle(baseName: string): string {
    // Strip common prefixes like "audio-1234567890-0-abc1234"
    const audioIdMatch = baseName.match(/^audio-(\d+)-(\d+)-/);
    if (audioIdMatch) {
        const timestamp = parseInt(audioIdMatch[1], 10);
        if (timestamp > 1e12) {
            const date = new Date(timestamp);
            return `Recovered — ${date.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            })}`;
        }
    }

    // Strip "clip-" prefix
    const clipMatch = baseName.match(/^clip-(\d+)/);
    if (clipMatch) {
        const timestamp = parseInt(clipMatch[1], 10);
        if (timestamp > 1e12) {
            const date = new Date(timestamp);
            return `Recovered — ${date.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            })}`;
        }
    }

    // Fallback: clean up the filename
    return baseName
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim() || "Recovered Clip";
}
