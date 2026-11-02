/**
 * Audit 03-6 / 05-E12: a recorded take was COPIED into the library, so a long take on a
 * nearly full phone needed its size free twice and could never be saved. The take is
 * now moved (a rename on the same volume). A moved take is the only copy: a failed
 * import must never delete it.
 */
jest.mock("../../../modules/songnook-pitch-shift", () => ({ __esModule: true, default: {} }));
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    cacheDirectory: "file:///cache/",
    getInfoAsync: jest.fn(async () => ({ exists: true })),
    makeDirectoryAsync: jest.fn(async () => {}),
    copyAsync: jest.fn(async () => {}),
    moveAsync: jest.fn(async () => {}),
    deleteAsync: jest.fn(async () => {}),
}));
jest.mock("expo-file-system", () => ({ File: class {} }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));
const mockProbe = jest.fn(async (_uri: string) => 4200);
jest.mock("../waveformAnalysis", () => ({
    computeWaveformPeaks: jest.fn(async () => []),
    computeWaveformWithNativeDuration: jest.fn(async () => ({ peaks: [], durationMs: 0 })),
    getNativeAudioDurationMs: (uri: string) => mockProbe(uri),
}));

import * as FileSystem from "expo-file-system/legacy";
import { importRecordedAudioAsset } from "../audioStorage";

const fs = FileSystem as unknown as { copyAsync: jest.Mock; moveAsync: jest.Mock; deleteAsync: jest.Mock };
const TAKE = "file:///docs/AAD92B42.wav";
// The 4th argument is how the take arrives; older code ignored it.
const importTake = importRecordedAudioAsset as (
    uri: string,
    id: string,
    options: { lightweight: boolean },
    moveIntoLibrary?: "scratch" | "take"
) => ReturnType<typeof importRecordedAudioAsset>;

beforeEach(() => {
    jest.clearAllMocks();
    mockProbe.mockImplementation(async () => 4200);
});

describe("a recorded take coming into the library", () => {
    it("moves a marked take instead of copying it", async () => {
        const managed = await importTake(TAKE, "clip-1", { lightweight: true }, "take");
        expect(fs.moveAsync).toHaveBeenCalledWith({ from: TAKE, to: "file:///docs/songnook/audio/clip-1.wav" });
        expect(fs.copyAsync).not.toHaveBeenCalled();
        expect(managed.audioUri).toBe("file:///docs/songnook/audio/clip-1.wav");
    });

    it("moves the trim render (our scratch file) too", async () => {
        await importTake("file:///tmp/clip-2-trim.m4a", "clip-2", { lightweight: true }, "scratch");
        expect(fs.moveAsync).toHaveBeenCalledWith({
            from: "file:///tmp/clip-2-trim.m4a",
            to: "file:///docs/songnook/audio/clip-2.m4a",
        });
        expect(fs.copyAsync).not.toHaveBeenCalled();
    });

    it("never deletes a moved take when the import fails after the move", async () => {
        mockProbe.mockImplementation(async () => {
            throw new Error("probe failed");
        });
        await expect(importTake(TAKE, "clip-3", { lightweight: true }, "take")).rejects.toThrow();
        expect(fs.moveAsync).toHaveBeenCalled();
        expect(fs.deleteAsync).not.toHaveBeenCalledWith("file:///docs/songnook/audio/clip-3.wav", expect.anything());
    });

    it("still removes a failed scratch import's library copy", async () => {
        mockProbe.mockImplementation(async () => {
            throw new Error("probe failed");
        });
        await expect(importTake("file:///tmp/clip-4-trim.m4a", "clip-4", { lightweight: true }, "scratch")).rejects.toThrow();
        expect(fs.deleteAsync).toHaveBeenCalledWith("file:///docs/songnook/audio/clip-4.m4a", { idempotent: true });
    });

    it("copies a take that has no marker, as before", async () => {
        await importTake(TAKE, "clip-5", { lightweight: true });
        expect(fs.copyAsync).toHaveBeenCalledWith({ from: TAKE, to: "file:///docs/songnook/audio/clip-5.wav" });
        expect(fs.moveAsync).not.toHaveBeenCalled();
    });
});
