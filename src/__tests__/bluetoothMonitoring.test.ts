import {
  buildBluetoothMonitoringRouteKey,
  buildBluetoothMonitoringRouteLabel,
  getBluetoothMonitoringCalibrationForRoute,
  isBluetoothLikeAudioDevice,
} from "../bluetoothMonitoring";
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
