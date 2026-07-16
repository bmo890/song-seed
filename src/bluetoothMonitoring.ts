import type { AudioDevice } from "@siteed/audio-studio";
import type { BluetoothMonitoringCalibration } from "./types";

// Keep this just under one full beat at the calibration tempo (90 BPM = 667 ms)
// so very late taps do not become ambiguous with the next beat.
export const MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS = 640;
export const MAX_BLUETOOTH_MONITORING_MANUAL_OFFSET_MS = 700;
export const MAX_BLUETOOTH_MONITORING_OFFSET_MS = MAX_BLUETOOTH_MONITORING_AUTO_OFFSET_MS;
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
 *  songseed-metronome module. `profile` is only present on Bluetooth routes reported by
 *  newer native binaries: "hfp" while the headset's mic is in use (phone-call profile),
 *  "a2dp"/"le" otherwise. */
export type AudioRouteLike = Pick<AudioDevice, "name" | "type"> & { profile?: string | null };

export function isBluetoothLikeAudioDevice(device: AudioRouteLike | null | undefined) {
  if (!device) {
    return false;
  }
  if (device.type === "bluetooth") {
    return true;
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

export function buildBluetoothMonitoringRouteLabel(
  device: AudioRouteLike | null | undefined
) {
  if (!device) {
    return "Unknown Bluetooth route";
  }

  const hfpSuffix = device.type === "bluetooth" && device.profile === "hfp" ? " (mic active)" : "";
  const trimmedName = device.name.trim();
  if (trimmedName.length > 0) {
    return `${trimmedName}${hfpSuffix}`;
  }

  switch (device.type) {
    case "bluetooth":
      return `Bluetooth audio${hfpSuffix}`;
    case "wired_headset":
    case "wired_headphones":
      return "Wired headphones";
    case "builtin_mic":
      return "Built-in mic";
    default:
      return "Audio route";
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
