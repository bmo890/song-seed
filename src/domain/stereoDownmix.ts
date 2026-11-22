/**
 * A stereo take's live stream arrives interleaved (L R L R). Everything that reads the
 * stream while it rolls — the live tape, the click's onset envelope the beat grid is
 * checked against — counts time in samples of ONE channel (RECORDING_TAKE_SHAPE is mono).
 * Fed two channels, its clock would run twice as fast: the head trim, the grid and the
 * live ruler would all be wrong. So the stream is folded to mono on arrival; the FILE
 * keeps both channels.
 */
export function downmixInterleaved(samples: Float32Array, channels: number): Float32Array {
  if (!Number.isInteger(channels) || channels <= 1) return samples;
  const frames = Math.floor(samples.length / channels);
  const mono = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    const at = frame * channels;
    for (let channel = 0; channel < channels; channel++) sum += samples[at + channel];
    mono[frame] = sum / channels;
  }
  return mono;
}

/**
 * Is a stereo take really stereo? (2026-11-22.) Some phones answer a two-channel request
 * by copying one mic into both sides, or by leaving one side silent. Measured while the
 * take rolls, from the stream already in hand, so nothing is read back from the file.
 *
 * Both channels are first-differenced (a crude high-pass): two mics a few centimetres
 * apart hear the low end almost identically, so the raw signal would make a real stereo
 * pair look like a copy. What is left is compared as side energy (L − R) against the
 * energy of both sides.
 */
export type StereoMeter = {
  frames: number;
  left: number;
  right: number;
  side: number;
  prevLeft: number;
  prevRight: number;
};

export type StereoVerdict = "stereo" | "copied" | "one-sided" | "unsure";

export function createStereoMeter(): StereoMeter {
  return { frames: 0, left: 0, right: 0, side: 0, prevLeft: 0, prevRight: 0 };
}

/** Feed interleaved L R samples. */
export function meterStereo(meter: StereoMeter, samples: Float32Array): void {
  const frames = Math.floor(samples.length / 2);
  let { left, right, side, prevLeft, prevRight } = meter;
  for (let frame = 0; frame < frames; frame++) {
    const l = samples[frame * 2];
    const r = samples[frame * 2 + 1];
    const dl = l - prevLeft;
    const dr = r - prevRight;
    prevLeft = l;
    prevRight = r;
    left += dl * dl;
    right += dr * dr;
    const ds = dl - dr;
    side += ds * ds;
  }
  meter.frames += frames;
  meter.left = left;
  meter.right = right;
  meter.side = side;
  meter.prevLeft = prevLeft;
  meter.prevRight = prevRight;
}

/** Below this much sound there is nothing to judge (a silent room says nothing). */
const MIN_MEAN_ENERGY = 1e-7;
/** At least two seconds at 44.1 kHz. */
const MIN_FRAMES = 88_200;
/** Side energy under −40 dB of the pair: the two channels are one signal. */
const COPIED_RATIO = 1e-4;
/** One side under −20 dB of the other: a channel is missing. */
const ONE_SIDED_RATIO = 1e-2;

export function judgeStereo(meter: StereoMeter): StereoVerdict {
  if (meter.frames < MIN_FRAMES) return "unsure";
  const both = meter.left + meter.right;
  if (both / meter.frames < MIN_MEAN_ENERGY) return "unsure";
  const louder = Math.max(meter.left, meter.right);
  const quieter = Math.min(meter.left, meter.right);
  if (quieter / louder < ONE_SIDED_RATIO) return "one-sided";
  if (meter.side / both < COPIED_RATIO) return "copied";
  return "stereo";
}
