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

export function isBluetoothLikeAudioDevice(device: Pick<AudioDevice, "name" | "type"> | null | undefined) {
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
  device: Pick<AudioDevice, "name" | "type"> | null | undefined
) {
  if (!device) {
    return null;
  }

  const normalizedType = (device.type || "unknown").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
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
  device: Pick<AudioDevice, "name" | "type"> | null | undefined
) {
  if (!device) {
    return "Unknown Bluetooth route";
  }

  const trimmedName = device.name.trim();
  if (trimmedName.length > 0) {
    return trimmedName;
  }

  switch (device.type) {
    case "bluetooth":
      return "Bluetooth audio";
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
