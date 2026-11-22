import { useEffect, useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExpoAudioStreamModule } from "@siteed/audio-studio";
import type { StereoVerdict } from "../domain/stereoDownmix";

/**
 * Can this phone record stereo from its own mics? (2026-11-22.)
 *
 * Two answers combine. The native recorder says whether the phone OFFERS stereo: Android
 * at once (two or more built-in mics), iOS only while the audio session allows input, so
 * outside a take it may answer "unknown" and the recorder asks again once its session is
 * up. Then the phone's own takes say whether it DELIVERS it: a take whose two channels
 * are one signal copied, or with one side silent, marks this phone as mono for good
 * (domain/stereoDownmix.ts `judgeStereo`), unless a real stereo take was heard first.
 * The finding is kept on this phone only (not in backups: it is about the hardware).
 *
 * The stereo switches are hidden only on a definite "no".
 */
export type StereoSupport = "yes" | "no" | "unknown";

const VERDICT_KEY = "songnook.stereoVerdict";
type DeviceVerdict = "verified" | "fake" | null;

let offered: StereoSupport = "unknown";
let deviceVerdict: DeviceVerdict = null;
let verdictLoaded = false;
const listeners = new Set<() => void>();

function current(): StereoSupport {
  if (offered === "no" || deviceVerdict === "fake") return "no";
  return offered;
}

let lastPublished: StereoSupport = current();
function publish() {
  const next = current();
  if (next === lastPublished) return;
  lastPublished = next;
  listeners.forEach((listener) => listener());
}

function loadVerdictOnce() {
  if (verdictLoaded) return;
  verdictLoaded = true;
  void AsyncStorage.getItem(VERDICT_KEY)
    .then((raw) => {
      if (raw === "verified" || raw === "fake") {
        deviceVerdict = raw;
        publish();
      }
    })
    .catch(() => {});
}

/** Ask the native recorder again. Never downgrades a known answer to "unknown". */
export function refreshStereoSupport(): StereoSupport {
  loadVerdictOnce();
  try {
    const probe = (ExpoAudioStreamModule as unknown as { songNookStereoSupport?: () => unknown })
      .songNookStereoSupport;
    const answer = probe?.();
    // An older binary without the probe cannot record stereo at all.
    const next: StereoSupport | null = !probe ? "no" : answer === "yes" || answer === "no" ? answer : null;
    if (next) {
      offered = next;
      publish();
    }
  } catch {
    // Unknown stays unknown.
  }
  return current();
}

/**
 * What a finished stereo take showed. Returns true when this take is the one that found
 * the phone fakes stereo (the caller says so once).
 */
export function noteStereoTake(verdict: StereoVerdict): boolean {
  if (verdict === "unsure") return false;
  if (verdict === "stereo") {
    if (deviceVerdict !== "verified") {
      deviceVerdict = "verified";
      void AsyncStorage.setItem(VERDICT_KEY, "verified").catch(() => {});
    }
    return false;
  }
  // A phone heard in real stereo once keeps it: a later copied take is a route that fell
  // back mid-take (a headset plugged in), not the hardware.
  if (deviceVerdict !== null) return false;
  deviceVerdict = "fake";
  void AsyncStorage.setItem(VERDICT_KEY, "fake").catch(() => {});
  publish();
  return true;
}

export function getStereoSupport(): StereoSupport {
  return current();
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
