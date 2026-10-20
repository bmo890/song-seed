import type { ClipVersion } from "../types";
import {
    collectManagedClipAudioUris,
    deleteManagedAudioUris,
    filterUnreferencedManagedAudioUris,
} from "../services/managedMedia";
import { flushPersistedSnapshot, useStore } from "./useStore";

/**
 * The law (founder, 2026-10-19): no media stays on the phone that the library
 * can't reach. Call this after a write that drops clips from the library: once
 * that library is durable, every file the dropped clips owned (take, source,
 * rendered mix, each layer) moves to the trash (14-day hold), unless a clip
 * that remains still uses it. Returns at once; the move happens behind.
 */
export function trashFilesOfDroppedClips(droppedClips: ClipVersion[], reason: string) {
    trashFilesNoLongerUsed(
        droppedClips.flatMap((clip) => Array.from(collectManagedClipAudioUris(clip))),
        reason
    );
}

/** The same law for a list of files: those the library no longer uses go to the trash
 *  once the write that dropped them is durable. */
export function trashFilesNoLongerUsed(candidates: string[], reason: string) {
    const uris = filterUnreferencedManagedAudioUris(candidates, useStore.getState().workspaces);
    if (uris.length === 0) return;
    void flushPersistedSnapshot()
        .then(() => deleteManagedAudioUris(uris))
        .catch((error) => {
            console.warn(`[DataSafety] ${reason}: files kept, metadata was not durable.`, error);
        });
}
