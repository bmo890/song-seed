import { useStore } from "../state/useStore";

/**
 * Tracks whether the user-facing audio path is currently busy, so non-urgent background
 * audio work (waveform decodes, duration probes during library hydration) can stand down
 * and never contend with it.
 *
 * Recording counts as busy too: capture must never queue behind derived-data work.
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

// Recording activity is tracked HERE, not read off the store's recording ids: those
// ids can outlive the recorder (open it on a sketch, back out without a take), and a
// "busy" that never clears would switch off every background decode for the session.
// Both inputs below are driven by mounted components, so they end when the UI does.
let recorderScreensOpen = 0;
let recorderCapturing = false;
const recordingActivityListeners = new Set<(active: boolean) => void>();

/** True while the recorder screen is open, or a take is running/paused (minimized
 *  included). The recorder, the file system and the metronome share one native queue
 *  with the waveform decoder, so a background decode in flight makes Record, Redo and
 *  Save wait out the whole file (2026-09-21). */
export function isRecordingActive(): boolean {
  return recorderScreensOpen > 0 || recorderCapturing;
}

function updateRecordingActivity(change: () => void) {
  const before = isRecordingActive();
  change();
  const after = isRecordingActive();
  if (before !== after) [...recordingActivityListeners].forEach((listener) => listener(after));
}

/** Call with true on recorder-screen mount and false on unmount. */
export function setRecorderScreenOpen(open: boolean) {
  updateRecordingActivity(() => {
    recorderScreensOpen = Math.max(0, recorderScreensOpen + (open ? 1 : -1));
  });
}

/** Mirrors the shared recorder's recording/paused state (it outlives the screen). */
export function setRecorderCapturing(capturing: boolean) {
  updateRecordingActivity(() => {
    recorderCapturing = capturing;
  });
}

export function onRecordingActivityChange(listener: (active: boolean) => void): () => void {
  recordingActivityListeners.add(listener);
  return () => {
    recordingActivityListeners.delete(listener);
  };
}

export function isForegroundAudioBusy(): boolean {
  if (foregroundLoadDepth > 0) return true;
  const state = useStore.getState();
  return state.playerIsPlaying || state.inlineIsPlaying || isRecordingActive();
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
