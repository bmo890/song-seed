/**
 * Audit 11-M2 (2026-11-02): CAF plays only on iPhone and Ogg/Opus (WhatsApp voice notes)
 * only on Android, yet both were kept as-is and travel to the other phone in backups and
 * Send, where they never play. They now become M4A on import with the phone's own
 * encoder (the full-range render AIFF already uses). If that fails, the original is
 * kept only where this phone plays it; anywhere else it is refused, plainly.
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
const mockDurations = new Map<string, number>();
jest.mock("../waveformAnalysis", () => ({
    computeWaveformPeaks: jest.fn(async () => []),
    computeWaveformWithNativeDuration: jest.fn(async () => ({ peaks: [], durationMs: 0 })),
    getNativeAudioDurationMs: jest.fn(async (uri: string) => {
        // The library's own copy always reads (the import probes it last).
        const known = mockDurations.get(uri) ?? (uri.includes("/songnook/audio/") ? 5_000 : null);
        if (known == null) throw new Error("can't open");
        return known;
    }),
}));

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import SongNookPitchShiftModule from "../../../modules/songnook-pitch-shift";
import { isUnsupportedAudioFormatError } from "../audioImportFormat";
import { importAudioAsset } from "../audioStorage";

const native = SongNookPitchShiftModule as unknown as { renderTrim?: jest.Mock };
const fs = FileSystem as unknown as { copyAsync: jest.Mock; moveAsync: jest.Mock; deleteAsync: jest.Mock };

function onPlatform(os: "ios" | "android") {
    Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
}

/** A render that writes `<name>` in tmp, `durationMs` long. */
function renderWorks(durationMs: number) {
    native.renderTrim = jest.fn(async ({ outputFileName }: { outputFileName: string }) => {
        const outputUri = `file:///tmp/${outputFileName}`;
        mockDurations.set(outputUri, durationMs);
        return { outputUri };
    });
}

function renderFails() {
    native.renderTrim = jest.fn(async () => {
        throw new Error("Transformer: no extractor");
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    mockDurations.clear();
    delete native.renderTrim;
});

describe("formats that play on one phone only", () => {
    it("turns an iPhone CAF into M4A on import", async () => {
        onPlatform("ios");
        mockDurations.set("file:///picked/memo.caf", 61_200);
        renderWorks(61_200);

        const managed = await importAudioAsset({ uri: "file:///picked/memo.caf", name: "memo.caf" }, "clip-1", {
            lightweight: true,
        });

        expect(native.renderTrim).toHaveBeenCalledWith({
            inputUri: "file:///picked/memo.caf",
            ranges: [{ startTimeMs: 0, endTimeMs: 61_200 }],
            outputFileName: "clip-1-import.m4a",
        });
        expect(managed.audioUri).toBe("file:///docs/songnook/audio/clip-1.m4a");
        expect(fs.moveAsync).toHaveBeenCalledWith({
            from: "file:///tmp/clip-1-import.m4a",
            to: "file:///docs/songnook/audio/clip-1.m4a",
        });
        expect(fs.copyAsync).not.toHaveBeenCalled();
    });

    it("turns a WhatsApp voice note (Opus) into M4A on Android", async () => {
        onPlatform("android");
        mockDurations.set("file:///picked/PTT-2026.opus", 9_000);
        renderWorks(9_000);

        const managed = await importAudioAsset({ uri: "file:///picked/PTT-2026.opus", name: "PTT-2026.opus" }, "clip-2", {
            lightweight: true,
        });
        expect(managed.audioUri).toBe("file:///docs/songnook/audio/clip-2.m4a");
    });

    it("keeps the original Ogg on Android when the render fails, since Android plays it", async () => {
        onPlatform("android");
        mockDurations.set("file:///picked/idea.ogg", 9_000);
        renderFails();

        const managed = await importAudioAsset({ uri: "file:///picked/idea.ogg", name: "idea.ogg" }, "clip-3", {
            lightweight: true,
        });
        expect(managed.audioUri).toBe("file:///docs/songnook/audio/clip-3.ogg");
        expect(fs.copyAsync).toHaveBeenCalledWith({
            from: "file:///picked/idea.ogg",
            to: "file:///docs/songnook/audio/clip-3.ogg",
        });
    });

    it("refuses a CAF on Android it can't convert, copying nothing", async () => {
        onPlatform("android");
        renderFails();

        const error = await importAudioAsset({ uri: "file:///picked/memo.caf", name: "memo.caf" }, "clip-4", {
            lightweight: true,
        }).catch((caught) => caught);
        expect(isUnsupportedAudioFormatError(error)).toBe(true);
        expect(error.format).toBe("caf");
        expect(fs.copyAsync).not.toHaveBeenCalled();
        expect(fs.moveAsync).not.toHaveBeenCalled();
    });

    it("refuses an Opus voice note on iPhone it can't convert", async () => {
        onPlatform("ios");
        renderWorks(9_000); // never reached: the phone can't even read its length

        const error = await importAudioAsset({ uri: "file:///picked/PTT.opus", name: "PTT.opus" }, "clip-5", {
            lightweight: true,
        }).catch((caught) => caught);
        expect(isUnsupportedAudioFormatError(error)).toBe(true);
        expect(error.format).toBe("opus");
        expect(fs.copyAsync).not.toHaveBeenCalled();
    });

    it("never keeps a render that came out shorter than the original", async () => {
        onPlatform("android");
        mockDurations.set("file:///picked/idea.ogg", 60_000);
        renderWorks(30_000);

        const managed = await importAudioAsset({ uri: "file:///picked/idea.ogg", name: "idea.ogg" }, "clip-6", {
            lightweight: true,
        });
        expect(managed.audioUri).toBe("file:///docs/songnook/audio/clip-6.ogg");
        expect(fs.deleteAsync).toHaveBeenCalledWith("file:///tmp/clip-6-import.m4a", { idempotent: true });
    });
});
