/**
 * Video import (2026-10-19): a video's sound comes in as a clip, the picture is
 * dropped, and the library never holds the video. These pin the format rules, the
 * share-sheet classification, and the import path's contract with the native
 * extractor — including the refusals that must read as "unsupported", not as a
 * clip that imports and then never plays.
 */
jest.mock("../../../modules/songnook-pitch-shift", () => ({
    __esModule: true,
    default: {},
}));
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    cacheDirectory: "file:///cache/",
    getInfoAsync: jest.fn(async () => ({ exists: true })),
    makeDirectoryAsync: jest.fn(async () => {}),
    copyAsync: jest.fn(async () => {}),
    deleteAsync: jest.fn(async () => {}),
}));
jest.mock("expo-file-system", () => ({ File: class {} }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));
jest.mock("../waveformAnalysis", () => ({
    computeWaveformPeaks: jest.fn(async () => []),
    computeWaveformWithNativeDuration: jest.fn(async () => ({ peaks: [], durationMs: 0 })),
    getNativeAudioDurationMs: jest.fn(async () => 4200),
}));

import * as FileSystem from "expo-file-system/legacy";
import SongNookPitchShiftModule from "../../../modules/songnook-pitch-shift";
import {
    NO_AUDIO_FORMAT,
    VIDEO_FORMAT,
    isNoAudioTrackError,
    isUnsupportedAudioFormatError,
    isVideoImport,
} from "../audioImportFormat";
import { importAudioAsset } from "../audioStorage";
import { isSharedAudioFile } from "../shareImport";

const nativeMock = SongNookPitchShiftModule as unknown as { extractAudioTrack?: jest.Mock };
const fs = FileSystem as unknown as { copyAsync: jest.Mock; deleteAsync: jest.Mock };

describe("isVideoImport", () => {
    it.each([
        ["IMG_1234.MOV", null],
        ["ScreenRecording.mp4", undefined],
        ["clip.m4v", ""],
        ["old.3gp", null],
        [undefined, "video/mp4"],
        [null, "video/quicktime"],
        ["noext", "VIDEO/X-M4V"],
    ])("treats %j (%j) as a video", (name, mime) => {
        expect(isVideoImport(name, mime)).toBe(true);
    });

    it.each([
        ["song.m4a", null],
        ["song.mp4", "audio/mp4"], // an audio-labelled .mp4 is already audio
        ["clip.webm", "video/webm"], // left out on purpose: iOS can't open it
        ["clip.mkv", null],
        [undefined, undefined],
    ])("does not treat %j (%j) as a video", (name, mime) => {
        expect(isVideoImport(name, mime)).toBe(false);
    });
});

describe("isNoAudioTrackError", () => {
    it("matches the native marker inside Expo's wrapped rejection", () => {
        expect(isNoAudioTrackError(new Error("Call rejected.\n→ Caused by: java.lang.IllegalStateException: NO_AUDIO_TRACK"))).toBe(true);
        expect(isNoAudioTrackError(new Error("export failed"))).toBe(false);
        expect(isNoAudioTrackError(null)).toBe(false);
    });
});

describe("isSharedAudioFile", () => {
    it("accepts phone videos alongside audio", () => {
        expect(isSharedAudioFile({ fileName: "IMG_1234.MOV", mimeType: "video/quicktime" })).toBe(true);
        expect(isSharedAudioFile({ fileName: "rehearsal.mp4", mimeType: "video/mp4" })).toBe(true);
        expect(isSharedAudioFile({ fileName: "take.m4a", mimeType: "audio/mp4" })).toBe(true);
    });

    it("still refuses what can't become a clip", () => {
        expect(isSharedAudioFile({ fileName: "clip.webm", mimeType: "video/webm" })).toBe(false);
        expect(isSharedAudioFile({ fileName: "photo.jpg", mimeType: "image/jpeg" })).toBe(false);
    });
});

describe("importAudioAsset — video", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete nativeMock.extractAudioTrack;
    });

    it("lifts the sound out and stores only an .m4a", async () => {
        nativeMock.extractAudioTrack = jest.fn().mockResolvedValue({
            outputUri: "file:///tmp/clip-1-video.m4a",
            durationMs: 4200,
        });

        const result = await importAudioAsset(
            { uri: "file:///picked/IMG_1234.MOV", name: "IMG_1234.MOV", mimeType: "video/quicktime" },
            "clip-1",
            { lightweight: true }
        );

        expect(nativeMock.extractAudioTrack).toHaveBeenCalledWith({
            inputUri: "file:///picked/IMG_1234.MOV",
            outputFileName: "clip-1-video.m4a",
        });
        expect(fs.copyAsync).toHaveBeenCalledWith({
            from: "file:///tmp/clip-1-video.m4a",
            to: "file:///docs/songnook/audio/clip-1.m4a",
        });
        // The video itself is never copied into the library.
        expect(fs.copyAsync).toHaveBeenCalledTimes(1);
        expect(fs.deleteAsync).toHaveBeenCalledWith("file:///tmp/clip-1-video.m4a", { idempotent: true });
        expect(result.audioUri).toBe("file:///docs/songnook/audio/clip-1.m4a");
        expect(result.durationMs).toBe(4200);
    });

    it("refuses a silent video as unsupported, copying nothing", async () => {
        nativeMock.extractAudioTrack = jest.fn().mockRejectedValue(new Error("NO_AUDIO_TRACK"));

        const error = await importAudioAsset(
            { uri: "file:///picked/silent.mp4", name: "silent.mp4", mimeType: "video/mp4" },
            "clip-2"
        ).catch((caught: unknown) => caught);

        expect(isUnsupportedAudioFormatError(error)).toBe(true);
        expect((error as { format: string }).format).toBe(NO_AUDIO_FORMAT);
        expect(fs.copyAsync).not.toHaveBeenCalled();
    });

    it("refuses a video on a build without the extractor, never copying it as audio", async () => {
        const error = await importAudioAsset(
            { uri: "file:///picked/a.mov", name: "a.mov" },
            "clip-3"
        ).catch((caught: unknown) => caught);

        expect(isUnsupportedAudioFormatError(error)).toBe(true);
        expect((error as { format: string }).format).toBe(VIDEO_FORMAT);
        expect(fs.copyAsync).not.toHaveBeenCalled();
    });

    it("treats a photo-library pick as a video whatever its container", async () => {
        nativeMock.extractAudioTrack = jest.fn().mockResolvedValue({ outputUri: "file:///tmp/x.m4a", durationMs: 1 });

        await importAudioAsset(
            { uri: "file:///cache/ImagePicker/abc.webm", mimeType: "video/webm", isVideo: true },
            "clip-4",
            { lightweight: true }
        );

        expect(nativeMock.extractAudioTrack).toHaveBeenCalled();
    });

    it("discards the picker's temp copy — but only a file inside our cache", async () => {
        nativeMock.extractAudioTrack = jest.fn().mockResolvedValue({ outputUri: "file:///tmp/x.m4a", durationMs: 1 });

        await importAudioAsset(
            { uri: "file:///cache/ImagePicker/abc.mov", isVideo: true, discardSourceAfterImport: true },
            "clip-5",
            { lightweight: true }
        );
        expect(fs.deleteAsync).toHaveBeenCalledWith("file:///cache/ImagePicker/abc.mov", { idempotent: true });

        fs.deleteAsync.mockClear();
        await importAudioAsset(
            { uri: "content://media/external/video/42", isVideo: true, discardSourceAfterImport: true },
            "clip-6",
            { lightweight: true }
        );
        expect(fs.deleteAsync).not.toHaveBeenCalledWith("content://media/external/video/42", expect.anything());
    });

    it("discards the temp copy even when the import is refused", async () => {
        nativeMock.extractAudioTrack = jest.fn().mockRejectedValue(new Error("NO_AUDIO_TRACK"));

        await importAudioAsset(
            { uri: "file:///cache/ImagePicker/silent.mov", isVideo: true, discardSourceAfterImport: true },
            "clip-7"
        ).catch(() => {});

        expect(fs.deleteAsync).toHaveBeenCalledWith("file:///cache/ImagePicker/silent.mov", { idempotent: true });
    });

    it("copies an audio file as-is, with no extraction", async () => {
        nativeMock.extractAudioTrack = jest.fn();

        await importAudioAsset({ uri: "file:///picked/take.m4a", name: "take.m4a" }, "clip-8", { lightweight: true });

        expect(nativeMock.extractAudioTrack).not.toHaveBeenCalled();
        expect(fs.copyAsync).toHaveBeenCalledWith({
            from: "file:///picked/take.m4a",
            to: "file:///docs/songnook/audio/clip-8.m4a",
        });
    });
});
