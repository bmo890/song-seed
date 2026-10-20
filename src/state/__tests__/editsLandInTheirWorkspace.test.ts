jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { createStore } from "zustand/vanilla";
import { createDataSlice, ideaWorkspaceId, type DataSlice } from "../dataSlice";

/**
 * The player opens clips from any workspace (search, Activity, playlists), but every
 * idea edit used to land only in the ACTIVE workspace: a layer removed from a clip that
 * lives elsewhere silently stayed (overnight check 2026-10-20). Edits keyed by an idea
 * now name its workspace.
 */

const NOW = Date.now();

function workspace(id: string, ideas: unknown[]) {
    return {
        id,
        title: id,
        collections: [
            {
                id: `${id}-col`,
                title: "col",
                workspaceId: id,
                parentCollectionId: null,
                createdAt: NOW,
                updatedAt: NOW,
                ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
            },
        ],
        ideas,
    };
}

function layeredClipIdea(collectionId: string) {
    return {
        id: "away-idea",
        title: "away",
        kind: "clip",
        collectionId,
        notes: "",
        status: "idea",
        completionPct: 0,
        createdAt: NOW,
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
                overdub: {
                    stems: [
                        { id: "layer-1", title: "Layer 1", audioUri: "file:///layer-1.m4a", offsetMs: 0, gainDb: 0 },
                        { id: "layer-2", title: "Layer 2", audioUri: "file:///layer-2.m4a", offsetMs: 0, gainDb: 0 },
                    ],
                },
            },
        ],
    };
}

function makeStore() {
    const store = createStore<DataSlice>()((set, get, api) =>
        createDataSlice(set as never, get as never, api as never)
    );
    store.setState({
        activeWorkspaceId: "here",
        workspaces: [workspace("here", []), workspace("away", [layeredClipIdea("away-col")])],
    } as never);
    return store;
}

const stemsOf = (store: ReturnType<typeof makeStore>) =>
    store.getState().workspaces[1]!.ideas[0]!.clips[0]!.overdub?.stems.map((stem) => stem.id);

describe("edits land in the idea's own workspace", () => {
    it("finds the workspace that holds an idea", () => {
        const store = makeStore();
        expect(ideaWorkspaceId(store.getState().workspaces, "away-idea")).toBe("away");
        expect(ideaWorkspaceId(store.getState().workspaces, "nowhere")).toBeNull();
    });

    it("removes a layer from a clip outside the active workspace", () => {
        const store = makeStore();
        store.getState().removeClipOverdubStem("away-idea", "take", "layer-1");
        expect(stemsOf(store)).toEqual(["layer-2"]);
    });

    it("changes a layer there too", () => {
        const store = makeStore();
        store.getState().updateClipOverdubStem("away-idea", "take", "layer-2", { gainDb: -6 });
        const stem = store.getState().workspaces[1]!.ideas[0]!.clips[0]!.overdub!.stems[1]!;
        expect(stem.gainDb).toBe(-6);
    });

    it("leaves the active workspace untouched", () => {
        const store = makeStore();
        const before = store.getState().workspaces[0];
        store.getState().removeClipOverdubStem("away-idea", "take", "layer-1");
        expect(store.getState().workspaces[0]).toBe(before);
    });
});
