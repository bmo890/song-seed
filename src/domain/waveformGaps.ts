/**
 * Display repair for a waveform the native decoder left with holes.
 *
 * Both decoders (iOS AVAssetReader, Android MediaCodec, modules/songnook-pitch-shift)
 * drop each decoded buffer WHOLE into the one bin its timestamp falls in. When a buffer
 * is longer than a bin, the bins it also covers receive no samples and come back at
 * the floor value. iOS hands out ~186 ms buffers, so at 2048 detail bins every clip
 * under ~6 minutes is a comb: one real bar, then stubs (measured 2026-11-12: a 64 s
 * clip had one real bin in 5.8). On a moving reel those lone bars flash past the
 * playhead a few times a second.
 *
 * This fills the holes for DRAWING only. Stored peaks and sidecars stay as decoded,
 * so nothing that measures them (the click self-align's sidecar fallback) changes.
 * The proper fix is in the decoders (spread a buffer across the bins it spans) and
 * needs a store build; with it this becomes a no-op, because a dense wave is returned
 * untouched.
 *
 * Pure, and safe to run twice: a repaired or dense wave has no comb to find.
 */

/** A bin at or under this got no samples (the decoders' 0.004 floor; 1/255 once it has
 *  been through a sidecar). Real room tone sits well above it; only digital silence
 *  reads the same, which is why a hole is only filled next to a real bin. */
export const WAVEFORM_EMPTY_BIN_MAX = 0.0045;

/** A comb has a real bin every N bins. Under this typical spacing the wave is dense. */
const MIN_COMB_SPACING = 2;

/**
 * Returns `peaks` with the decoder's holes filled, or `peaks` itself (same reference)
 * when there is no comb. A hole between two real bins is drawn as the line between
 * them. A longer empty stretch is real silence: only the bins the last buffer still
 * covered are filled, at that buffer's level, and the rest stays silent.
 */
export function fillWaveformBinGaps(peaks: number[]): number[] {
    const count = peaks.length;
    if (count < 3) return peaks;

    const filled: number[] = [];
    for (let i = 0; i < count; i += 1) {
        if (peaks[i] > WAVEFORM_EMPTY_BIN_MAX) filled.push(i);
    }
    if (filled.length < 2) return peaks;

    const spacings: number[] = [];
    for (let i = 1; i < filled.length; i += 1) spacings.push(filled[i] - filled[i - 1]);
    spacings.sort((a, b) => a - b);
    const spacing = spacings[Math.floor(spacings.length / 2)];
    if (spacing < MIN_COMB_SPACING) return peaks;

    const repaired = peaks.slice();
    for (let i = 1; i < filled.length; i += 1) {
        const from = filled[i - 1];
        const to = filled[i];
        const gap = to - from;
        if (gap <= 1) continue;
        if (gap <= spacing + 1) {
            const step = (peaks[to] - peaks[from]) / gap;
            for (let bin = from + 1; bin < to; bin += 1) repaired[bin] = peaks[from] + step * (bin - from);
        } else {
            for (let bin = from + 1; bin < from + spacing; bin += 1) repaired[bin] = peaks[from];
        }
    }
    // The last buffer covers the bins after it too.
    const last = filled[filled.length - 1];
    for (let bin = last + 1; bin < Math.min(count, last + spacing); bin += 1) repaired[bin] = peaks[last];
    return repaired;
}
