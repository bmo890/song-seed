jest.mock("expo-file-system/legacy", () => ({
    cacheDirectory: "file:///app/Library/Caches/",
    deleteAsync: jest.fn(async () => {}),
}));

import * as FileSystem from "expo-file-system/legacy";
import { discardPickedCopies, isInAppCache, sweepPickerCache } from "../pickedCopies";

/**
 * A long video picked on a phone short of space: the picker's copy must go the moment
 * it isn't needed, and the user's original must never be touched (founder, 2026-10-20).
 */
const deleteAsync = FileSystem.deleteAsync as jest.Mock;

beforeEach(() => deleteAsync.mockClear());

it("deletes the pickers' copies inside the app's cache", async () => {
    await discardPickedCopies([
        { uri: "file:///app/Library/Caches/ImagePicker/long.mov", discardSourceAfterImport: true },
        { uri: "file:///app/Library/Caches/DocumentPicker/rehearsal.mp4", discardSourceAfterImport: true },
    ]);
    expect(deleteAsync).toHaveBeenCalledWith("file:///app/Library/Caches/ImagePicker/long.mov", { idempotent: true });
    expect(deleteAsync).toHaveBeenCalledWith("file:///app/Library/Caches/DocumentPicker/rehearsal.mp4", { idempotent: true });
});

it("never touches an original: outside the cache, a content URI, or an untagged file", async () => {
    await discardPickedCopies([
        { uri: "content://media/external/video/42", discardSourceAfterImport: true },
        { uri: "ph://ABC-123", discardSourceAfterImport: true },
        { uri: "file:///var/mobile/Media/DCIM/100APPLE/IMG_0001.MOV", discardSourceAfterImport: true },
        { uri: "file:///app/Library/Caches/DocumentPicker/kept.m4a" },
    ]);
    expect(deleteAsync).not.toHaveBeenCalled();
});

it("knows what is inside the app's cache", () => {
    expect(isInAppCache("file:///app/Library/Caches/ImagePicker/x.mov")).toBe(true);
    expect(isInAppCache("file:///app/Documents/songnook/audio/x.m4a")).toBe(false);
    expect(isInAppCache(undefined)).toBe(false);
});

it("the launch sweep clears only the two picker folders", async () => {
    await sweepPickerCache();
    expect(deleteAsync.mock.calls.map((call) => call[0]).sort()).toEqual([
        "file:///app/Library/Caches/DocumentPicker",
        "file:///app/Library/Caches/ImagePicker",
    ]);
});
