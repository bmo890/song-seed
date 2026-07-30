/**
 * The onset envelope — a signal in which a metronome click actually exists.
 *
 * Self-alignment (see `clickGridAlignment.ts`) needs to find the recorded click bleed in a
 * take and shift the beat grid onto it. It used to comb the waveform SIDECAR, and measurement
 * showed that cannot work: the sidecar is a loudness envelope built for drawing pictures —
 * 2048 RMS bins over the whole file (15ms each on a half-minute take), log-compressed to dB
 * and quantised to 8 bits, with no high-pass anywhere. A click is a couple of milliseconds of
 * mostly high-frequency energy; averaged into a 15ms RMS bin underneath sustained musical
 * content it disappears. On a real take the app's comb reported contrast 1.07 — no signal —
 * where a sample-level measurement of the same audio reported 30.3
 * (`docs/qa/grid-truth.md`).
 *
 * So build the right signal instead, and build it at the only moment it is free: while
 * recording. The recorder already hands JS every captured buffer as float32 PCM, so:
 *
 *   1. First-difference the samples. Crude as high-passes go, but it is one subtract per
 *      sample and it is what separates a transient tick from a sung note or a strummed
 *      chord — the whole reason the sidecar is blind.
 *   2. Sum the energy of that into fixed 1ms bins. One millisecond is the resolution the
 *      grid-truth harness validated at ±0.2ms, and 15× finer than the sidecar.
 *   3. At save, take the POSITIVE difference between neighbouring bins. That is the rising
 *      edge — where a sound starts, which is where a beat is.
 *
 * No decode, no re-read, no background work to be preempted, and nothing to go stale.
 */

/**
 * Target envelope resolution, in ms. Matches the validated harness in
 * `scripts/grid-truth.py`.
 *
 * TARGET, not actual: a bin holds a whole number of frames, and at 44100Hz one millisecond
 * is 44.1 of them. Rounding to 44 makes each bin 0.9977ms, so an envelope that CLAIMED 1ms
 * bins would run 0.23% fast — 45ms of accumulated error across a 20-second take, which is
 * enough to smear the comb and bias the phase it reports by ~9ms. `binMs` on the finished
 * envelope is always the real figure; never assume this constant is it.
 */
export const ONSET_BIN_MS = 1;
/** Memory ceiling: 10 minutes at 1ms. A take longer than this doesn't get self-aligned,
 *  which is already true of the sidecar path (30-minute analysis cap). */
export const MAX_ONSET_BINS = 10 * 60 * 1000;

export type OnsetEnvelope = {
    /** TRUE bin duration: `framesPerBin / sampleRate × 1000`, not the nominal target. */
    binMs: number;
    /** Root-energy of the high-passed signal per bin, in capture order. */
    bins: number[];
    /** True when the take outran MAX_ONSET_BINS and the tail is missing. */
    truncated: boolean;
};

export type OnsetEnvelopeState = {
    sampleRate: number;
    channels: number;
    framesPerBin: number;
    bins: number[];
    /** Energy accumulated into the bin currently being filled. */
    partialEnergy: number;
    partialFrames: number;
    /** Last sample of the previous buffer, so the high-pass is continuous across deliveries. */
    lastSample: number;
    truncated: boolean;
};

export function createOnsetEnvelopeState(sampleRate: number, channels = 1): OnsetEnvelopeState {
    return {
        sampleRate,
        channels,
        framesPerBin: Math.max(1, Math.round((sampleRate * ONSET_BIN_MS) / 1000)),
        bins: [],
        partialEnergy: 0,
        partialFrames: 0,
        lastSample: 0,
        truncated: false,
    };
}

/**
 * Fold one delivery of float32 PCM into the envelope, in place.
 *
 * Mutates rather than returning a new state: this runs on every audio delivery (~25/s) for
 * the whole take, and the array it appends to is the point. Multi-channel input is averaged
 * to mono first — a click is present in both channels, and mono halves the work.
 */
export function appendOnsetSamples(state: OnsetEnvelopeState, samples: Float32Array): void {
    if (state.truncated || samples.length === 0) return;
    const { channels } = state;
    const frameCount = Math.floor(samples.length / channels);

    for (let frame = 0; frame < frameCount; frame += 1) {
        let value = 0;
        if (channels === 1) {
            value = samples[frame] ?? 0;
        } else {
            const base = frame * channels;
            for (let channel = 0; channel < channels; channel += 1) {
                value += samples[base + channel] ?? 0;
            }
            value /= channels;
        }

        const difference = value - state.lastSample;
        state.lastSample = value;
        state.partialEnergy += difference * difference;
        state.partialFrames += 1;

        if (state.partialFrames >= state.framesPerBin) {
            state.bins.push(Math.sqrt(state.partialEnergy));
            state.partialEnergy = 0;
            state.partialFrames = 0;
            if (state.bins.length >= MAX_ONSET_BINS) {
                state.truncated = true;
                return;
            }
        }
    }
}

/**
 * Close the envelope for use.
 *
 * `trimHeadMs` drops the front of the envelope so it lands in the same axis as the SAVED
 * file: the envelope is accumulated in capture ms, but a record-through count-in is cut off
 * the head at save, and every grid number downstream is in file ms.
 */
export function onsetBinMs(state: OnsetEnvelopeState): number {
    return (state.framesPerBin / state.sampleRate) * 1000;
}

export function finishOnsetEnvelope(
    state: OnsetEnvelopeState,
    trimHeadMs = 0
): OnsetEnvelope | null {
    if (state.bins.length === 0) return null;
    const dropped = Math.max(0, Math.round(trimHeadMs / onsetBinMs(state)));
    const bins = dropped > 0 ? state.bins.slice(dropped) : state.bins;
    if (bins.length === 0) return null;
    return { binMs: onsetBinMs(state), bins, truncated: state.truncated };
}

/**
 * The rising edge of the envelope: `max(0, bin − previous bin)`.
 *
 * Separated from accumulation so what is stored stays a plain energy envelope — reusable,
 * and derivable into whatever a later measurement wants.
 */
export function onsetFlux(bins: number[]): number[] {
    const flux = new Array<number>(bins.length);
    for (let index = 0; index < bins.length; index += 1) {
        flux[index] = index === 0 ? 0 : Math.max(0, bins[index] - bins[index - 1]);
    }
    return flux;
}
