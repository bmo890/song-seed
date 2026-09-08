jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("../manifestSync", () => ({ readManifest: jest.fn(async () => null) }));
jest.mock("../../state/db/storage", () => ({ getKvNewestUpdatedAt: jest.fn(async () => null) }));

import { compareManifestToStore, MANIFEST_NEWER_THRESHOLD_MS } from "../manifestFreshness";
import type { ManifestData } from "../manifestSync";
import type { Workspace } from "../../types";

const T0 = 1_800_000_000_000;

const ws = (id: string, ideas: { id: string; clips: { id: string }[] }[]) =>
    ({ id, ideas }) as unknown as Workspace;

const manifest = (workspaces: Workspace[]): ManifestData =>
    ({ schemaVersion: 1, lastWrittenAt: new Date(T0).toISOString(), workspaces }) as unknown as ManifestData;

describe("compareManifestToStore", () => {
    const storeWorkspaces = [ws("w1", [{ id: "idea-1", clips: [] }])];
    const richer = manifest([
        ws("w1", [
            { id: "idea-1", clips: [{ id: "clip-1" }, { id: "clip-2" }] },
            { id: "idea-2", clips: [{ id: "clip-3" }] },
        ]),
    ]);

    it("flags a manifest that is newer AND holds work the store lacks", () => {
        const result = compareManifestToStore({
            manifest: richer,
            manifestAt: T0,
            storeAt: T0 - MANIFEST_NEWER_THRESHOLD_MS,
            storeWorkspaces,
        });
        expect(result).toMatchObject({ missingIdeas: 1, missingClips: 3 });
    });

    it("ignores ordinary debounce skew", () => {
        expect(
            compareManifestToStore({
                manifest: richer,
                manifestAt: T0,
                storeAt: T0 - MANIFEST_NEWER_THRESHOLD_MS + 1,
                storeWorkspaces,
            })
        ).toBeNull();
    });

    it("ignores a newer manifest that adds nothing (deletes are not losses)", () => {
        const smaller = manifest([ws("w1", [])]);
        expect(
            compareManifestToStore({
                manifest: smaller,
                manifestAt: T0,
                storeAt: T0 - 10 * MANIFEST_NEWER_THRESHOLD_MS,
                storeWorkspaces,
            })
        ).toBeNull();
    });

    it("ignores an older manifest even if it holds more", () => {
        expect(
            compareManifestToStore({
                manifest: richer,
                manifestAt: T0 - MANIFEST_NEWER_THRESHOLD_MS,
                storeAt: T0,
                storeWorkspaces,
            })
        ).toBeNull();
    });

    it("refuses to judge without timestamps", () => {
        expect(
            compareManifestToStore({ manifest: richer, manifestAt: NaN, storeAt: T0, storeWorkspaces })
        ).toBeNull();
    });
});
