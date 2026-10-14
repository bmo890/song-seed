jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { createStore } from "zustand/vanilla";
import { createDataSlice, type DataSlice } from "../dataSlice";

/**
 * The take's level and tone live on its root overdub settings and stand on their
 * own (Sound room, 2026-10-14). The overdub cleanup used to drop the whole state
 * when a take had no layers and no mix, so a tuned plain take snapped back to
 * neutral the moment it was set. These pin: the root's sound survives without
 * layers, and a neutral root on a stemless take still leaves nothing behind.
 */

const NOW = Date.now();

function makeStore() {
    const store = createStore<DataSlice>()((set, get, api) =>
        createDataSlice(set as never, get as never, api as never)
    );
    store.setState({
        activeWorkspaceId: "ws",
        workspaces: [
            {
                id: "ws",
                title: "W",
                collections: [
                    {
                        id: "col",
                        title: "col",
                        workspaceId: "ws",
                        parentCollectionId: null,
                        createdAt: NOW,
                        updatedAt: NOW,
                        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                    },
                ],
                ideas: [],
            },
        ],
    } as never);
    store.getState().updateIdeas(
        () => [
            {
                id: "idea",
                title: "idea",
                kind: "clip",
                collectionId: "col",
                notes: "",
                status: "idea",
                completionPct: 0,
                createdAt: NOW,
                updatedAt: NOW,
                lastActivityAt: NOW,
                clips: [
                    {
                        id: "take",
                        title: "take",
                        notes: "",
                        createdAt: NOW,
                        isPrimary: true,
                        audioUri: "file:///take.m4a",
                        durationMs: 1000,
                    },
                ],
            } as never,
        ],
        { preserveActivity: true }
    );
    return store;
}

const takeOf = (store: ReturnType<typeof makeStore>) =>
    store.getState().workspaces[0]!.ideas[0]!.clips[0]!;

describe("the root's sound on a take without layers", () => {
    it("keeps a level set on a plain take", () => {
        const store = makeStore();
        store.getState().updateClipOverdubRoot("idea", "take", { gainDb: 6 });
        expect(takeOf(store).overdub?.root).toEqual({ gainDb: 6, tonePreset: "neutral" });
        expect(takeOf(store).overdub?.stems).toEqual([]);
    });

    it("keeps a tone set on a plain take, the new flag included", () => {
        const store = makeStore();
        store.getState().updateClipOverdubRoot("idea", "take", { tonePreset: "low-boost+hi-cut" });
        expect(takeOf(store).overdub?.root?.tonePreset).toBe("low-boost+hi-cut");
    });

    it("survives the rendered mix being cleared", () => {
        const store = makeStore();
        store.getState().updateClipOverdubRoot("idea", "take", { gainDb: -3, tonePreset: "low-cut" });
        store.getState().clearClipOverdubRenderedMix("idea", "take");
        expect(takeOf(store).overdub?.root).toEqual({ gainDb: -3, tonePreset: "low-cut" });
    });

    it("leaves nothing behind once the root is back at neutral", () => {
        const store = makeStore();
        store.getState().updateClipOverdubRoot("idea", "take", { gainDb: 6 });
        store.getState().updateClipOverdubRoot("idea", "take", { gainDb: 0 });
        expect(takeOf(store).overdub).toBeUndefined();
    });
});
