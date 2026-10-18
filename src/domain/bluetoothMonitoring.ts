import type { AudioDevice } from "@siteed/audio-studio";
import type { BluetoothMonitoringCalibration } from "../types";

// Keep this just under one full beat at the calibration tempo (90 BPM = 667 ms)
// so very late taps do not become ambiguous with the next beat.
export const MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS = 640;
export const MAX_BLUETOOTH_MONITORING_MANUAL_OFFSET_MS = 700;
const MONITORING_OFFSET_ROUNDING_MS = 10;

export function clampBluetoothMonitoringOffsetMs(
  value: number,
  maxOffsetMs = MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS
) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(maxOffsetMs, value));
}

export function normalizeBluetoothMonitoringOffsetMs(
  value: number,
  maxOffsetMs = MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS
) {
  const clamped = clampBluetoothMonitoringOffsetMs(value, maxOffsetMs);
  return Math.round(clamped / MONITORING_OFFSET_ROUNDING_MS) * MONITORING_OFFSET_ROUNDING_MS;
}

export function normalizeBluetoothMonitoringSavedOffsetMs(value: number) {
  return normalizeBluetoothMonitoringOffsetMs(value, MAX_BLUETOOTH_MONITORING_MANUAL_OFFSET_MS);
}

/** A route as reported by either the audio-studio device manager or the native
 *  songnook-metronome module. `profile` is only present on Bluetooth routes reported by
 *  newer native binaries: "hfp" while the headset's mic is in use (phone-call profile),
 *  "a2dp"/"le" otherwise. */
export type AudioRouteLike = Pick<AudioDevice, "name" | "type"> & { profile?: string | null };

const NON_BLUETOOTH_TYPES = /^(?:wired|usb|builtin|built_in|speaker|earpiece|hdmi|line)/i;

export function isBluetoothLikeAudioDevice(device: AudioRouteLike | null | undefined) {
  if (!device) {
    return false;
  }
  if (device.type === "bluetooth") {
    return true;
  }
  // A route the system already named as wired, built in or a speaker is not
  // Bluetooth, whatever its name says ("wired_headphones" matched "headphones" and
  // asked wired listeners to calibrate; audit 2026-10-18). The name test below is for
  // routes the platform could not type (Android LE Audio arrives as "unknown").
  if (NON_BLUETOOTH_TYPES.test(device.type ?? "")) {
    return false;
  }

  const label = `${device.name} ${device.type}`.toLowerCase();
  return /airpods|airpods pro|airpods max|bluetooth|buds|earbuds|headphones|headset/.test(label);
}

export function buildBluetoothMonitoringRouteKey(
  device: AudioRouteLike | null | undefined
) {
  if (!device) {
    return null;
  }

  let normalizedType = (device.type || "unknown").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
  // HFP (the phone-call profile active while a Bluetooth mic is in use) has a completely
  // different latency than the same headphones on A2DP — a calibration taken on one must
  // never be applied to the other. A2DP/LE keep the legacy un-suffixed key so existing
  // saved calibrations stay valid.
  if (normalizedType === "bluetooth" && device.profile === "hfp") {
    normalizedType = "bluetooth-hfp";
  }
  const normalizedName = (device.name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedName) {
    return normalizedType || "unknown";
  }

  return `${normalizedType}:${normalizedName}`;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** A route's name for people. The device's own name when it has one; otherwise a
 *  plain description, through `translate` when given (saved as the calibration's
 *  label, so it must not be English-only). */
export function buildBluetoothMonitoringRouteLabel(
  device: AudioRouteLike | null | undefined,
  translate?: Translate
) {
  const say = (key: string, fallback: string, options?: Record<string, unknown>) =>
    translate ? translate(`bluetoothRoute.${key}`, options) : fallback;
  if (!device) {
    return say("unknown", "Unknown Bluetooth route");
  }

  const onCall = device.type === "bluetooth" && device.profile === "hfp";
  const withMic = (name: string) => (onCall ? say("micActive", `${name} (mic active)`, { name }) : name);
  const trimmedName = device.name.trim();
  if (trimmedName.length > 0) {
    return withMic(trimmedName);
  }

  switch (device.type) {
    case "bluetooth":
      return withMic(say("bluetooth", "Bluetooth audio"));
    case "wired_headset":
    case "wired_headphones":
      return say("wired", "Wired headphones");
    case "builtin_mic":
      return say("builtinMic", "Built-in mic");
    default:
      return say("other", "Audio route");
  }
}

export function normalizeBluetoothMonitoringCalibration(
  calibration: BluetoothMonitoringCalibration
): BluetoothMonitoringCalibration {
  return {
    routeKey: calibration.routeKey,
    routeLabel: calibration.routeLabel,
    offsetMs: normalizeBluetoothMonitoringSavedOffsetMs(calibration.offsetMs),
    clickOffsetMs:
      typeof calibration.clickOffsetMs === "number" && Number.isFinite(calibration.clickOffsetMs)
        ? normalizeBluetoothMonitoringSavedOffsetMs(calibration.clickOffsetMs)
        : undefined,
    osOutputAtCalibrationMs:
      typeof calibration.osOutputAtCalibrationMs === "number" &&
      Number.isFinite(calibration.osOutputAtCalibrationMs) &&
      calibration.osOutputAtCalibrationMs > 0
        ? Math.min(1000, Math.round(calibration.osOutputAtCalibrationMs))
        : undefined,
    updatedAt: Number.isFinite(calibration.updatedAt) ? calibration.updatedAt : Date.now(),
  };
}

export function normalizeBluetoothMonitoringCalibrations(
  calibrations: BluetoothMonitoringCalibration[] | undefined | null
) {
  if (!Array.isArray(calibrations)) {
    return [];
  }

  const byRouteKey = new Map<string, BluetoothMonitoringCalibration>();
  calibrations.forEach((calibration) => {
    if (!calibration || typeof calibration.routeKey !== "string" || calibration.routeKey.trim().length === 0) {
      return;
    }

    const normalized = normalizeBluetoothMonitoringCalibration(calibration);
    byRouteKey.set(normalized.routeKey, normalized);
  });

  return Array.from(byRouteKey.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getBluetoothMonitoringCalibrationForRoute(
  calibrations: BluetoothMonitoringCalibration[],
  routeKey: string | null | undefined
) {
  if (!routeKey) {
    return null;
  }
  return calibrations.find((calibration) => calibration.routeKey === routeKey) ?? null;
}
