import * as FileSystem from "expo-file-system/legacy";
import { readManifest, type ManifestData } from "./manifestSync";
import { SONG_NOOK_MANIFEST_PATH } from "./storagePaths";
import { getKvNewestUpdatedAt } from "../state/db/storage";
import { STORE_NAME } from "../state/persistedSnapshot";
import type { Workspace } from "../types";

/**
 * Boot-time check: is the shadow manifest NEWER than what SQLite just hydrated, and does
 * it hold work the store lacks? That is the fingerprint of a session whose store writes
 * stopped landing while the manifest kept mirroring the in-memory library (2026-09-07
 * field report). Until now the manifest was only consulted when the library came up
 * empty, so a stale-but-non-empty store silently won.
 */

/** Normal skew: the manifest trails the store by its own debounce (≤ 15 s). */
export const MANIFEST_NEWER_THRESHOLD_MS = 60_000;

export type NewerManifest = {
    manifest: ManifestData;
    manifestAt: number;
    storeAt: number;
    missingIdeas: number;
    missingClips: number;
};

function collectIds(workspaces: Workspace[]) {
    const ideaIds = new Set<string>();
    const clipIds = new Set<string>();
    for (const workspace of workspaces) {
        for (const idea of workspace.ideas) {
            ideaIds.add(idea.id);
            for (const clip of idea.clips) clipIds.add(clip.id);
        }
    }
    return { ideaIds, clipIds };
}

/** Pure comparison, so the rule is testable without disk. */
export function compareManifestToStore(args: {
    manifest: ManifestData;
    manifestAt: number;
    storeAt: number;
    storeWorkspaces: Workspace[];
}): NewerManifest | null {
    const { manifest, manifestAt, storeAt, storeWorkspaces } = args;
    if (!Number.isFinite(manifestAt) || !Number.isFinite(storeAt)) return null;
    if (manifestAt - storeAt < MANIFEST_NEWER_THRESHOLD_MS) return null;

    const store = collectIds(storeWorkspaces);
    let missingIdeas = 0;
    let missingClips = 0;
    for (const workspace of manifest.workspaces) {
        for (const idea of workspace.ideas ?? []) {
            if (!store.ideaIds.has(idea.id)) missingIdeas += 1;
            for (const clip of idea.clips ?? []) {
                if (!store.clipIds.has(clip.id)) missingClips += 1;
            }
        }
    }
    if (missingIdeas === 0 && missingClips === 0) return null;
    return { manifest, manifestAt, storeAt, missingIdeas, missingClips };
}

export async function detectNewerManifest(storeWorkspaces: Workspace[]): Promise<NewerManifest | null> {
    const storeAt = await getKvNewestUpdatedAt([STORE_NAME], [`${STORE_NAME}::ws::`]);
    if (storeAt == null) return null;
    // Cheap gate before parsing a manifest that can be megabytes: the file's own mtime
    // must already be past the threshold, or there is nothing to look at.
    try {
        const info = await FileSystem.getInfoAsync(SONG_NOOK_MANIFEST_PATH);
        if (!info.exists) return null;
        const mtime = "modificationTime" in info && typeof info.modificationTime === "number"
            ? info.modificationTime > 1e12 ? info.modificationTime : info.modificationTime * 1000
            : null;
        if (mtime != null && mtime - storeAt < MANIFEST_NEWER_THRESHOLD_MS) return null;
    } catch {
        return null;
    }
    const manifest = await readManifest();
    if (!manifest) return null;
    const manifestAt = Date.parse(manifest.lastWrittenAt);
    return compareManifestToStore({ manifest, manifestAt, storeAt, storeWorkspaces });
}
