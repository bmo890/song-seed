// Use a document directory whose own path contains the substring "songnook" — exactly the
// real-world Android case (package `com.anonymous.songnook`). This is what surfaced the
// accreting-path corruption bug; a base without "songnook" hid it.
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///data/user/0/com.anonymous.songnook/files/",
}));

import {
    toRelativeManagedPath,
    resolveManagedUri,
    rebaseManagedUri,
    repairManagedPathCorruption,
} from "../storagePaths";

const BASE = "file:///data/user/0/com.anonymous.songnook/files/";
const STALE = "file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/songnook/audio/clip-1.m4a";
const CURRENT = `${BASE}songnook/audio/clip-1.m4a`;

describe("managed path helpers", () => {
    it("extracts the container-independent relative path", () => {
        expect(toRelativeManagedPath(STALE)).toBe("songnook/audio/clip-1.m4a");
        expect(toRelativeManagedPath(CURRENT)).toBe("songnook/audio/clip-1.m4a");
    });

    it("returns null for non-managed and empty URIs", () => {
        expect(toRelativeManagedPath("file:///somewhere/else/foo.m4a")).toBeNull();
        expect(toRelativeManagedPath(undefined)).toBeNull();
        expect(toRelativeManagedPath(null)).toBeNull();
    });

    it("does not mistake the 'songnook' in the container/package name for the managed root", () => {
        // The first literal "songnook/" in CURRENT is inside `com.anonymous.songnook/`.
        // A bare indexOf would have returned "songnook/files/songnook/audio/clip-1.m4a".
        expect(toRelativeManagedPath(CURRENT)).toBe("songnook/audio/clip-1.m4a");
    });

    it("resolves a relative managed path against the live document directory", () => {
        expect(resolveManagedUri("songnook/audio/clip-1.m4a")).toBe(CURRENT);
        expect(resolveManagedUri("/songnook/audio/clip-1.m4a")).toBe(CURRENT);
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

    describe("songnook/files/ corruption repair", () => {
        const corruptManaged = `${BASE}songnook/files/songnook/files/songnook/audio/clip-1.m4a`;
        const corruptNonManaged = `${BASE}songnook/files/songnook/files/recording_42.wav`;

        it("collapses accreted songnook/files/ segments for managed audio", () => {
            expect(repairManagedPathCorruption(corruptManaged)).toBe(`${BASE}songnook/audio/clip-1.m4a`);
        });

        it("recovers the original non-managed path (file lived in the docs root)", () => {
            expect(repairManagedPathCorruption(corruptNonManaged)).toBe(`${BASE}recording_42.wav`);
        });

        it("never touches the 'songnook' inside the package name", () => {
            expect(repairManagedPathCorruption(CURRENT)).toBe(CURRENT);
            expect(repairManagedPathCorruption(`${BASE}recording_42.wav`)).toBe(`${BASE}recording_42.wav`);
        });

        it("rebaseManagedUri heals corrupted managed and non-managed paths", () => {
            expect(rebaseManagedUri(corruptManaged)).toBe(`${BASE}songnook/audio/clip-1.m4a`);
            expect(rebaseManagedUri(corruptNonManaged)).toBe(`${BASE}recording_42.wav`);
        });

        it("is idempotent — healing an already-healed path is a no-op", () => {
            const once = rebaseManagedUri(corruptManaged);
            expect(rebaseManagedUri(once)).toBe(once);
        });
    });
});
