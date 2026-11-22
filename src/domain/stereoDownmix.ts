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
