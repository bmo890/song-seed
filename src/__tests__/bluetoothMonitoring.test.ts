import {
  buildBluetoothMonitoringRouteKey,
  buildBluetoothMonitoringRouteLabel,
  getBluetoothMonitoringCalibrationForRoute,
  isBluetoothLikeAudioDevice,
} from "../domain/bluetoothMonitoring";
import type { BluetoothMonitoringCalibration } from "../types";

const A2DP_BUDS = { name: "AirPods Pro", type: "bluetooth", profile: "a2dp" };
const HFP_BUDS = { name: "AirPods Pro", type: "bluetooth", profile: "hfp" };
const LE_BUDS = { name: "AirPods Pro", type: "bluetooth", profile: "le" };
const LEGACY_BUDS = { name: "AirPods Pro", type: "bluetooth" };

describe("buildBluetoothMonitoringRouteKey", () => {
  it("keeps the legacy un-suffixed key for A2DP, LE, and profile-less routes", () => {
    expect(buildBluetoothMonitoringRouteKey(A2DP_BUDS)).toBe("bluetooth:airpods-pro");
    expect(buildBluetoothMonitoringRouteKey(LE_BUDS)).toBe("bluetooth:airpods-pro");
    expect(buildBluetoothMonitoringRouteKey(LEGACY_BUDS)).toBe("bluetooth:airpods-pro");
  });

  it("gives HFP (mic-active) sessions their own key so A2DP calibrations never apply", () => {
    expect(buildBluetoothMonitoringRouteKey(HFP_BUDS)).toBe("bluetooth-hfp:airpods-pro");
    expect(buildBluetoothMonitoringRouteKey(HFP_BUDS)).not.toBe(
      buildBluetoothMonitoringRouteKey(A2DP_BUDS)
    );
  });

  it("ignores the hfp profile on non-bluetooth types", () => {
    expect(
      buildBluetoothMonitoringRouteKey({ name: "Wired", type: "wired_headphones", profile: "hfp" })
    ).toBe("wired-headphones:wired");
  });

  it("suffixes the nameless fallback key too", () => {
    expect(buildBluetoothMonitoringRouteKey({ name: "", type: "bluetooth", profile: "hfp" })).toBe(
      "bluetooth-hfp"
    );
  });
});

describe("calibration lookup across profiles", () => {
  const a2dpCalibration: BluetoothMonitoringCalibration = {
    routeKey: "bluetooth:airpods-pro",
    routeLabel: "AirPods Pro",
    offsetMs: 340,
    clickOffsetMs: 200,
    updatedAt: 1,
  };

  it("an HFP session finds no calibration instead of the A2DP one", () => {
    const hfpKey = buildBluetoothMonitoringRouteKey(HFP_BUDS);
    expect(getBluetoothMonitoringCalibrationForRoute([a2dpCalibration], hfpKey)).toBeNull();
  });

  it("the A2DP session still finds its saved calibration", () => {
    const a2dpKey = buildBluetoothMonitoringRouteKey(A2DP_BUDS);
    expect(getBluetoothMonitoringCalibrationForRoute([a2dpCalibration], a2dpKey)).toBe(
      a2dpCalibration
    );
  });
});

describe("buildBluetoothMonitoringRouteLabel", () => {
  it("marks HFP routes so saved calibrations stay distinguishable", () => {
    expect(buildBluetoothMonitoringRouteLabel(HFP_BUDS)).toBe("AirPods Pro (mic active)");
    expect(buildBluetoothMonitoringRouteLabel(A2DP_BUDS)).toBe("AirPods Pro");
    expect(buildBluetoothMonitoringRouteLabel({ name: "", type: "bluetooth", profile: "hfp" })).toBe(
      "Bluetooth audio (mic active)"
    );
  });
});

describe("isBluetoothLikeAudioDevice", () => {
  it("treats both profiles as bluetooth", () => {
    expect(isBluetoothLikeAudioDevice(HFP_BUDS)).toBe(true);
    expect(isBluetoothLikeAudioDevice(A2DP_BUDS)).toBe(true);
  });
});

describe("wired routes are not Bluetooth (audit 2026-10-18)", () => {
  it("never asks wired headphones or a headset to calibrate", () => {
    expect(isBluetoothLikeAudioDevice({ name: "Headphones", type: "wired_headphones" })).toBe(false);
    expect(isBluetoothLikeAudioDevice({ name: "EarPods headset", type: "wired_headset" })).toBe(false);
    expect(isBluetoothLikeAudioDevice({ name: "USB headset", type: "usb_headset" })).toBe(false);
    expect(isBluetoothLikeAudioDevice({ name: "Speaker", type: "speaker" })).toBe(false);
  });
  it("still recognises a Bluetooth headset the platform couldn't type", () => {
    expect(isBluetoothLikeAudioDevice({ name: "Galaxy Buds2", type: "unknown" })).toBe(true);
  });
});

describe("route names go through the translator when given", () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    options?.name ? `${key}:${String(options.name)}` : key;
  it("translates the fallbacks and the mic-on mark, keeps a device's own name", () => {
    expect(buildBluetoothMonitoringRouteLabel({ name: "", type: "wired_headphones" }, t)).toBe("bluetoothRoute.wired");
    expect(buildBluetoothMonitoringRouteLabel(HFP_BUDS, t)).toBe("bluetoothRoute.micActive:AirPods Pro");
    expect(buildBluetoothMonitoringRouteLabel(A2DP_BUDS, t)).toBe("AirPods Pro");
  });
});
