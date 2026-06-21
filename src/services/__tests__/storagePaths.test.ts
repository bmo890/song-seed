jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
}));

import { toRelativeManagedPath, resolveManagedUri, rebaseManagedUri } from "../storagePaths";

const STALE = "file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/songseed/audio/clip-1.m4a";
const CURRENT = "file:///doc/songseed/audio/clip-1.m4a";

describe("managed path helpers", () => {
    it("extracts the container-independent relative path", () => {
        expect(toRelativeManagedPath(STALE)).toBe("songseed/audio/clip-1.m4a");
        expect(toRelativeManagedPath(CURRENT)).toBe("songseed/audio/clip-1.m4a");
    });

    it("returns null for non-managed and empty URIs", () => {
        expect(toRelativeManagedPath("file:///somewhere/else/foo.m4a")).toBeNull();
        expect(toRelativeManagedPath(undefined)).toBeNull();
        expect(toRelativeManagedPath(null)).toBeNull();
    });

    it("resolves a relative managed path against the live document directory", () => {
        expect(resolveManagedUri("songseed/audio/clip-1.m4a")).toBe(CURRENT);
        expect(resolveManagedUri("/songseed/audio/clip-1.m4a")).toBe(CURRENT);
    });

    it("rebases a stale absolute managed URI onto the live container", () => {
        expect(rebaseManagedUri(STALE)).toBe(CURRENT);
    });

    it("leaves already-correct, non-managed, and empty URIs unchanged", () => {
        expect(rebaseManagedUri(CURRENT)).toBe(CURRENT);
        expect(rebaseManagedUri("file:///external/foo.m4a")).toBe("file:///external/foo.m4a");
        expect(rebaseManagedUri(undefined)).toBeUndefined();
        expect(rebaseManagedUri(null)).toBeNull();
    });
});
