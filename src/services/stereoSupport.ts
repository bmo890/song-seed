import { useEffect, useSyncExternalStore } from "react";
import { ExpoAudioStreamModule } from "@siteed/audio-studio";

/**
 * Can this phone record stereo from its own mics? (2026-11-22, the Pro stereo setting.)
 *
 * Android answers at once (two or more built-in mics). iOS can only see the mic's
 * stereo patterns while the audio session allows input, so outside a take it may answer
 * "unknown"; the recorder asks again once its session is up, and the last real answer
 * stands. Settings hides the stereo row only on a definite "no".
 */
export type StereoSupport = "yes" | "no" | "unknown";

let support: StereoSupport = "unknown";
const listeners = new Set<() => void>();

/** Ask the native recorder again. Never downgrades a known answer to "unknown". */
export function refreshStereoSupport(): StereoSupport {
  try {
    const probe = (ExpoAudioStreamModule as unknown as { songNookStereoSupport?: () => unknown })
      .songNookStereoSupport;
    const answer = probe?.();
    // An older binary without the probe cannot record stereo at all.
    const next: StereoSupport | null = !probe ? "no" : answer === "yes" || answer === "no" ? answer : null;
    if (next && next !== support) {
      support = next;
      listeners.forEach((listener) => listener());
    }
  } catch {
    // Unknown stays unknown.
  }
  return support;
}

export function getStereoSupport(): StereoSupport {
  return support;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStereoSupport(): StereoSupport {
  useEffect(() => {
    refreshStereoSupport();
  }, []);
  return useSyncExternalStore(subscribe, getStereoSupport);
}
