/**
 * Encodes lossless takes to AAC for a SongNook Send parcel (2026-10-14).
 * The library keeps its WAV; the copies made here live in the cache for the
 * length of one seal and are deleted after the upload. The encoder is the
 * native trim renderer with one full-length range: AVAssetExportSession on
 * iOS, Media3 Transformer on Android, both writing .m4a. Where it is missing
 * (no native module) the files are packed as they are.
 */
import * as FileSystem from "expo-file-system/legacy";
import SongNookPitchShiftModule from "../../modules/songnook-pitch-shift";
import { throwIfBackupCancelled } from "./backupOperation";

/** Bytes of source audio done, and the take in flight (1-based) of how many. */
export type EncodeProgress = (completedBytes: number, totalBytes: number, index: number, count: number) => void;

export type EncodedAudio = {
    /** Source URI → encoded .m4a URI, for the files that encoded. */
    encoded: Map<string, string>;
    /** Every file this call wrote; delete them when the parcel has left. */
    tempUris: string[];
};

async function sizeOf(uri: string): Promise<number> {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && !info.isDirectory ? info.size ?? 0 : 0;
}

/** One at a time: the encoder shares the decoder pool with playback on Android,
 *  and two export sessions at once gain nothing on a phone. */
export async function encodeAudioForLink(
    sourceUris: string[],
    options?: { signal?: AbortSignal; onProgress?: EncodeProgress }
): Promise<EncodedAudio> {
    const result: EncodedAudio = { encoded: new Map(), tempUris: [] };
    const native = SongNookPitchShiftModule;
    if (!native?.renderTrim || sourceUris.length === 0) return result;

    const sizes = await Promise.all(sourceUris.map(sizeOf));
    const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
    let completedBytes = 0;
    options?.onProgress?.(0, totalBytes, 1, sourceUris.length);
    const stamp = Date.now().toString(36);

    for (const [index, uri] of sourceUris.entries()) {
        throwIfBackupCancelled(options?.signal);
        // The module's own probe, not waveformAnalysis: that file drags the whole
        // decode stack (and a second native module) into every export import.
        const durationMs = await native
            .getAudioDurationMs?.({ inputUri: uri })
            .then((probe) => (probe.durationMs > 0 ? Math.round(probe.durationMs) : undefined))
            .catch(() => undefined);
        if (durationMs && durationMs > 0) {
            try {
                const rendered = await native.renderTrim({
                    inputUri: uri,
                    ranges: [{ startTimeMs: 0, endTimeMs: durationMs }],
                    outputFileName: `link-${stamp}-${index}.m4a`,
                });
                result.tempUris.push(rendered.outputUri);
                result.encoded.set(uri, rendered.outputUri);
            } catch (error) {
                // A take the encoder cannot read is packed as it is; the parcel
                // is still whole, just heavier.
                console.warn("[send] encode failed, packing the original", error);
            }
        }
        completedBytes += sizes[index] ?? 0;
        options?.onProgress?.(completedBytes, totalBytes, Math.min(index + 2, sourceUris.length), sourceUris.length);
    }
    return result;
}

export async function deleteEncodedAudio(tempUris: string[]): Promise<void> {
    await Promise.all(
        tempUris.map((uri) => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined))
    );
}
