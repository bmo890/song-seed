import { appActions } from "../state/actions";
import { enqueueBackgroundWaveformHydration } from "./backgroundWaveformHydration";

/**
 * Buffers imported clip payloads and commits them to a collection in CHUNKS via
 * the batched importClipsToCollection action, then enqueues background waveform/
 * duration hydration for each committed clip.
 *
 * Why: adding 200 imported clips one at a time was ~600 store mutations (idea +
 * activity + recently-added per clip), each re-serializing the whole workspace
 * shard and re-rendering the list — the persist write-storm that froze the UI.
 * Chunking (~25) collapses that to a handful of mutations while still bounding the
 * crash-loss window (a hard kill mid-import loses at most one un-flushed chunk;
 * the audio files are already in managed storage) and letting cards appear
 * progressively instead of in one monster batch at the very end.
 */

export const CLIP_IMPORT_CHUNK_SIZE = 25;

export type ClipImportPayload = {
    title: string;
    audioUri: string;
    durationMs?: number;
    waveformPeaks?: number[];
    createdAt?: number;
    importedAt?: number;
    sourceCreatedAt?: number;
};

export type ClipImportBatcher = {
    /** Buffer one clip; auto-flushes when the buffer reaches the chunk size. */
    add: (payload: ClipImportPayload) => void;
    /** Commit any remaining buffered clips — call once after the import loop. */
    flush: () => void;
};

export function createClipImportBatcher(args: {
    collectionId: string;
    /** Workspace the collection belongs to, for hydration enqueue. Null skips hydration. */
    workspaceId: string | null;
    chunkSize?: number;
}): ClipImportBatcher {
    const chunkSize = args.chunkSize ?? CLIP_IMPORT_CHUNK_SIZE;
    let buffer: ClipImportPayload[] = [];

    const commit = () => {
        if (buffer.length === 0) return;
        const chunk = buffer;
        buffer = [];
        const created = appActions.importClipsToCollection(args.collectionId, chunk);
        if (!args.workspaceId) return;
        created.forEach((result, index) => {
            const payload = chunk[index];
            if (!payload) return;
            enqueueBackgroundWaveformHydration({
                workspaceId: args.workspaceId!,
                ideaId: result.ideaId,
                clipId: result.clipId,
                audioUri: payload.audioUri,
            });
        });
    };

    return {
        add: (payload) => {
            buffer.push(payload);
            if (buffer.length >= chunkSize) commit();
        },
        flush: commit,
    };
}
