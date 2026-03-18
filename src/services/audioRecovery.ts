import * as FileSystem from "expo-file-system/legacy";
import { SONG_SEED_AUDIO_DIR } from "./storagePaths";
import { loadAudioDurationMs } from "./audioStorage";
import { buildStaticWaveform } from "../utils";
import type { SongIdea, ClipVersion, Workspace } from "../types";

export type RecoveredClip = {
    ideaId: string;
    clipId: string;
    title: string;
    audioUri: string;
    durationMs?: number;
    waveformPeaks?: number[];
    fileModifiedAt?: number;
};

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
