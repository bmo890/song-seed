import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExpoAudioStreamModule } from "@siteed/audio-studio";
import type { StereoVerdict } from "../domain/stereoDownmix";

/**
 * Can this phone record stereo from its own mics? (2026-11-22.)
 *
 * Two answers combine. The native recorder says whether the phone OFFERS stereo: Android
 * at once (two or more built-in mics), iOS only while the audio session allows input, so
 * outside a take it may answer "unknown" and the recorder asks again once its session is
 * up. Then an Android phone's own takes say whether it DELIVERS it: takes whose two
 * channels are one signal copied, or with one side silent (domain/stereoDownmix.ts
 * `judgeStereo`). One such take only raises a doubt (a finger or a case over one mic
 * reads the same); a second, with no real stereo take between, marks the phone as mono.
 * A real stereo take, once heard, settles it the other way for good. iPhones are never
 * judged: their stereo is Apple's own, and a take that came out as one signal there is a
 * route that fell back to a headset, not the hardware (2026-11-23).
 * The finding is kept on this phone only (not in backups: it is about the hardware).
 *
 * The stereo switches are hidden only on a definite "no".
 */
export type StereoSupport = "yes" | "no" | "unknown";

const VERDICT_KEY = "songnook.stereoVerdict";
type DeviceVerdict = "verified" | "doubted" | "fake" | null;

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
      if (raw === "verified" || raw === "doubted" || raw === "fake") {
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

function keepVerdict(next: Exclude<DeviceVerdict, null>) {
  deviceVerdict = next;
  void AsyncStorage.setItem(VERDICT_KEY, next).catch(() => {});
}

/**
 * What a finished stereo take showed. Returns true when this take is the one that settled
 * that the phone fakes stereo (the caller says so once).
 */
export function noteStereoTake(verdict: StereoVerdict, platform: string = Platform.OS): boolean {
  if (platform !== "android" || verdict === "unsure") return false;
  if (verdict === "stereo") {
    if (deviceVerdict !== "verified") {
      keepVerdict("verified");
      publish();
    }
    return false;
  }
  // A phone heard in real stereo once keeps it: a later copied take is a route that fell
  // back mid-take (a headset plugged in), not the hardware.
  if (deviceVerdict === "verified" || deviceVerdict === "fake") return false;
  if (deviceVerdict === null) {
    keepVerdict("doubted");
    return false;
  }
  keepVerdict("fake");
  publish();
  return true;
}

/** Tests only: forget what the takes showed. */
export function resetStereoVerdictForTests() {
  deviceVerdict = null;
  verdictLoaded = true;
  offered = "unknown";
  lastPublished = current();
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
