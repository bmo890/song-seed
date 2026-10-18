jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
jest.mock("../../services/waveformAnalysis", () => ({}));
jest.mock("../../services/audioStorage", () => ({}));

import { useStore } from "../useStore";

/** A fresh calibration replaces every number; only a fine-tune keeps what it didn't
 *  touch. An old click number beside a new music number mis-times every take. */

const ROUTE = "bluetooth:airpods-pro";

beforeEach(() => {
    useStore.setState({ bluetoothMonitoringCalibrations: [] });
    useStore.getState().setBluetoothMonitoringCalibration(ROUTE, "AirPods Pro", 300, 200, 180, "fresh");
});

test("a fresh run whose click pass failed does not keep the old click number", () => {
    useStore.getState().setBluetoothMonitoringCalibration(ROUTE, "AirPods Pro", 340, undefined, undefined, "fresh");
    const saved = useStore.getState().bluetoothMonitoringCalibrations[0]!;
    expect(saved.offsetMs).toBe(340);
    expect(saved.clickOffsetMs).toBeUndefined();
    expect(saved.osOutputAtCalibrationMs).toBeUndefined();
});

test("a fine-tune of the music number keeps the click number and the OS report", () => {
    useStore.getState().setBluetoothMonitoringCalibration(ROUTE, "AirPods Pro", 310, undefined, undefined, "fineTune");
    const saved = useStore.getState().bluetoothMonitoringCalibrations[0]!;
    expect(saved.offsetMs).toBe(310);
    expect(saved.clickOffsetMs).toBe(200);
    expect(saved.osOutputAtCalibrationMs).toBe(180);
});
