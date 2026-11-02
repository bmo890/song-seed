/**
 * Audit 06-3 remainder: every file shared into SongNook is first copied by the share
 * intake (iOS: the App Group container; Android: cache/share-intake) and those copies
 * were never deleted: after import, after deleting the clip, after Erase everything.
 */
const mockFiles = new Map<string, { isDirectory?: boolean; modificationTime?: number }>();
jest.mock("expo-file-system/legacy", () => ({
    cacheDirectory: "file:///app/Library/Caches/",
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
    }),
    getInfoAsync: jest.fn(async (uri: string) =>
        mockFiles.has(uri) ? { exists: true, ...mockFiles.get(uri) } : { exists: false }
    ),
    readDirectoryAsync: jest.fn(async (dir: string) =>
        [...mockFiles.keys()]
            .filter((uri) => uri.startsWith(dir) && !uri.slice(dir.length).includes("/"))
            .map((uri) => uri.slice(dir.length))
    ),
}));
jest.mock("expo-file-system", () => ({
    Paths: {
        get appleSharedContainers() {
            return { "group.com.bmostudio.songnook": { uri: "file:///private/var/mobile/Containers/Shared/AppGroup/G1/" } };
        },
    },
}));

import * as FileSystem from "expo-file-system/legacy";
import { discardSharedInCopies, isSharedInCopy, sweepSharedInCopies } from "../sharedInCopies";
import { discardPickedCopies } from "../pickedCopies";

const GROUP = "file:///private/var/mobile/Containers/Shared/AppGroup/G1/";
const INTAKE = "file:///app/Library/Caches/share-intake/";
const UUID = "6F1C2A4E-9B1D-4C3E-8A2F-1D2C3B4A5E6F";
/** A video's thumbnail: its copy's name in base64, "==" dropped. */
const THUMB = `${Buffer.from(`${UUID}.mov`).toString("base64").replace("==", "")}.jpg`;
const deleteAsync = FileSystem.deleteAsync as jest.Mock;
const NOW = 1_800_000_000_000;

beforeEach(() => {
    mockFiles.clear();
    deleteAsync.mockClear();
    jest.spyOn(Date, "now").mockReturnValue(NOW);
});
afterEach(() => jest.restoreAllMocks());

describe("isSharedInCopy", () => {
    it("knows the share intake's own copies on both phones", () => {
        expect(isSharedInCopy(`${GROUP}${UUID}.opus`)).toBe(true);
        // iOS hands paths both with and without the /private prefix.
        expect(isSharedInCopy(`file:///var/mobile/Containers/Shared/AppGroup/G1/${UUID}.m4a`)).toBe(true);
        expect(isSharedInCopy(`${INTAKE}${UUID}.ogg`)).toBe(true);
    });

    it("never claims anything else", () => {
        expect(isSharedInCopy(`${GROUP}Library/Preferences/x.plist`)).toBe(false);
        expect(isSharedInCopy(`${INTAKE}../../files/SQLite/songnook.db`)).toBe(false);
        expect(isSharedInCopy("file:///app/Documents/songnook/audio/clip.m4a")).toBe(false);
        expect(isSharedInCopy("content://com.whatsapp.provider/media/123")).toBe(false);
        expect(isSharedInCopy(undefined)).toBe(false);
    });
});

describe("after an import", () => {
    it("the import's own discard takes shared-in copies too", async () => {
        await discardPickedCopies([{ uri: `${GROUP}${UUID}.m4a`, discardSourceAfterImport: true }]);
        expect(deleteAsync).toHaveBeenCalledWith(`${GROUP}${UUID}.m4a`, { idempotent: true });
    });

    it("cancelling deletes what the share left", async () => {
        await discardSharedInCopies([`${GROUP}${UUID}.m4a`, "/Users/me/original.m4a", `${INTAKE}${UUID}.zip`]);
        expect(deleteAsync.mock.calls.map((call) => call[0]).sort()).toEqual([`${GROUP}${UUID}.m4a`, `${INTAKE}${UUID}.zip`].sort());
    });
});

describe("the launch sweep", () => {
    it("clears shared-in copies a day old, never the container's own folders or a fresh share", async () => {
        const old = { modificationTime: (NOW - 2 * 24 * 3600 * 1000) / 1000 };
        mockFiles.set(`${GROUP}${UUID}.opus`, old);
        mockFiles.set(`${GROUP}${THUMB}`, old);
        mockFiles.set(`${GROUP}Library`, { ...old, isDirectory: true });
        mockFiles.set(`${GROUP}notes.txt`, old);
        mockFiles.set(`${GROUP}7A1C2A4E-9B1D-4C3E-8A2F-1D2C3B4A5E6F.m4a`, { modificationTime: NOW / 1000 });
        mockFiles.set(`${INTAKE}${UUID}.ogg`, old);
        mockFiles.set("file:///app/Library/Caches/shared-archive-1790000000000.zip", old);

        await sweepSharedInCopies();

        expect(deleteAsync.mock.calls.map((call) => call[0]).sort()).toEqual(
            [
                `${GROUP}${THUMB}`,
                `${GROUP}${UUID}.opus`,
                `${INTAKE}${UUID}.ogg`,
                "file:///app/Library/Caches/shared-archive-1790000000000.zip",
            ].sort()
        );
    });

    it("Erase everything clears them all, fresh or not", async () => {
        mockFiles.set(`${GROUP}${UUID}.m4a`, { modificationTime: NOW / 1000 });
        await sweepSharedInCopies({ olderThanMs: 0 });
        expect(deleteAsync).toHaveBeenCalledWith(`${GROUP}${UUID}.m4a`, { idempotent: true });
    });
});
