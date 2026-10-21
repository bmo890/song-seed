import type { NativePitchShiftPlaybackState } from "../../modules/songnook-pitch-shift";

/**
 * When a pitch-engine report is worth a React render (2026-10-21).
 *
 * The engine reports ~10×/second. Every report used to re-render the whole
 * player, where the plain player renders once a second and hands the reel its
 * position on a channel (useThrottledAudioPlayerStatus). This is the same rule:
 * a change of state renders now, a jump renders now, and plain playback renders
 * when the second on the clock turns over. The reel and the loop take every
 * report from the channel, so nothing that moves smoothly waits on this.
 */
export const NATIVE_POSITION_COMMIT_MS = 200;
const JUMP_MS = 1500;

export function shouldCommitNativeState(
  previous: NativePitchShiftPlaybackState,
  next: NativePitchShiftPlaybackState,
  lastCommitAtMs: number,
  nowMs: number
): boolean {
  if (
    previous.isPlaying !== next.isPlaying ||
    previous.isLoaded !== next.isLoaded ||
    previous.isAvailable !== next.isAvailable ||
    previous.didJustFinish !== next.didJustFinish ||
    previous.durationMs !== next.durationMs ||
    previous.playbackRate !== next.playbackRate ||
    previous.pitchShiftSemitones !== next.pitchShiftSemitones ||
    previous.sourceUri !== next.sourceUri ||
    (previous.soundGainDb ?? 0) !== (next.soundGainDb ?? 0) ||
    (previous.soundTonePreset ?? "neutral") !== (next.soundTonePreset ?? "neutral")
  ) {
    return true;
  }
  if (Math.abs(next.currentTimeMs - previous.currentTimeMs) > JUMP_MS) return true;
  const secondChanged =
    Math.floor(previous.currentTimeMs / 1000) !== Math.floor(next.currentTimeMs / 1000);
  return secondChanged && nowMs - lastCommitAtMs >= NATIVE_POSITION_COMMIT_MS;
}
