// Mock the native surface + heavy deps so importing waveformAnalysis doesn't drag in
// the @siteed / expo native modules (which throw at import in the jest environment).
// The factory owns a plain mutable object as the module default; the test grabs that
// same object via its own import and attaches/removes `getAudioDurationMs` to simulate
// builds with and without the native method. (The factory can't close over an outer
// const — imports are hoisted above it, so the const would be in the TDZ.)
jest.mock("../../../modules/songnook-pitch-shift", () => ({
    __esModule: true,
    default: {},
}));
jest.mock("@siteed/audio-studio", () => ({ extractPreview: jest.fn() }));
jest.mock("../audioForegroundActivity", () => ({
    isForegroundAudioBusy: () => false,
    waitForForegroundAudioIdle: () => Promise.resolve(),
}));

import SongNookPitchShiftModule from "../../../modules/songnook-pitch-shift";
import { getNativeAudioDurationMs } from "../waveformAnalysis";

// Same object the wrapper captured — mutating it toggles the native method's presence.
const nativeMock = SongNookPitchShiftModule as unknown as { getAudioDurationMs?: jest.Mock };

describe("getNativeAudioDurationMs — graceful degradation contract", () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        delete nativeMock.getAudioDurationMs;
        warnSpy.mockRestore();
    });

    it("returns undefined when the native method is absent (older build / web)", async () => {
        // No getAudioDurationMs on the module — must degrade, not throw.
        await expect(getNativeAudioDurationMs("file:///a.m4a")).resolves.toBeUndefined();
    });

    it("returns the rounded duration when the probe succeeds", async () => {
        nativeMock.getAudioDurationMs = jest.fn().mockResolvedValue({ durationMs: 3210.6 });
        await expect(getNativeAudioDurationMs("file:///a.m4a")).resolves.toBe(3211);
        expect(nativeMock.getAudioDurationMs).toHaveBeenCalledWith({ inputUri: "file:///a.m4a" });
    });

    it("returns undefined when the probe reports a non-positive / invalid duration", async () => {
        nativeMock.getAudioDurationMs = jest.fn().mockResolvedValue({ durationMs: 0 });
        await expect(getNativeAudioDurationMs("file:///a.m4a")).resolves.toBeUndefined();

        nativeMock.getAudioDurationMs = jest.fn().mockResolvedValue({ durationMs: undefined });
        await expect(getNativeAudioDurationMs("file:///a.m4a")).resolves.toBeUndefined();
    });

    it("returns undefined (never throws into the import path) when the probe rejects", async () => {
        nativeMock.getAudioDurationMs = jest.fn().mockRejectedValue(new Error("no audio track"));
        await expect(getNativeAudioDurationMs("file:///a.m4a")).resolves.toBeUndefined();
    });
});
