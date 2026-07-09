import { useStore } from "../state/useStore";

/**
 * Tracks whether the user-facing audio path is currently busy, so non-urgent background
 * audio work (waveform decodes, duration probes during library hydration) can stand down
 * and never contend with it.
 *
 * On Android the decoder and the audio player share the MediaCodec pool and audio focus,
 * so running a background decode — or worse, spinning up a native player to probe a
 * duration — while the full player is loading or playing stalls foreground playback. The
 * background queue waits (see waitForForegroundAudioIdle) until this reports idle.
 */

let foregroundLoadDepth = 0;

/** Bracket a foreground player load (openPlayer / syncPlayerSource) so background audio
 *  work stays clear of the acute load window even before playback flips to "playing". */
export function beginForegroundAudioLoad() {
  foregroundLoadDepth += 1;
}

export function endForegroundAudioLoad() {
  foregroundLoadDepth = Math.max(0, foregroundLoadDepth - 1);
}

export function isForegroundAudioBusy(): boolean {
  if (foregroundLoadDepth > 0) return true;
  const state = useStore.getState();
  return state.playerIsPlaying || state.inlineIsPlaying;
}

/**
 * Resolve once the foreground audio path has been idle for `quietMs` continuously. Caps
 * out at `maxWaitMs` so a user who plays back-to-back for a long stretch still lets the
 * queue make eventual progress (accepting at most one job's worth of contention), rather
 * than starving hydration forever.
 */
export async function waitForForegroundAudioIdle(
  { quietMs = 350, pollMs = 250, maxWaitMs = 45000 }: { quietMs?: number; pollMs?: number; maxWaitMs?: number } = {}
): Promise<void> {
  const startedAt = Date.now();
  let quietSince: number | null = isForegroundAudioBusy() ? null : Date.now();

  while (Date.now() - startedAt < maxWaitMs) {
    if (!isForegroundAudioBusy()) {
      if (quietSince == null) quietSince = Date.now();
      if (Date.now() - quietSince >= quietMs) return;
    } else {
      quietSince = null;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
