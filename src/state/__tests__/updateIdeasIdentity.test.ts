jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { createStore } from "zustand/vanilla";
import { createDataSlice, type DataSlice } from "../dataSlice";

/**
 * updateIdeas is the library's main write path (45 call sites). It used to hand EVERY
 * idea a fresh object on every call — defeating row memoization across the whole
 * collection — and, because a fresh object never equals its predecessor, stamped every
 * sketch in the workspace "active now" whenever anything changed (2026-09-21). These
 * pin the contract: an edit touches the edited idea and nothing else.
 */

const OLD = Date.now() - 90 * 24 * 60 * 60 * 1000;

const makeIdea = (id: string, kind: "project" | "clip", collectionId = "col-a") =>
    ({
        id,
        title: id,
        kind,
        collectionId,
        notes: "",
        status: "idea",
        completionPct: 0,
        createdAt: OLD,
        updatedAt: OLD,
        lastActivityAt: OLD,
        clips: [
            {
                id: `${id}-clip`,
                title: "take",
                notes: "",
                createdAt: OLD,
                isPrimary: true,
                audioUri: `file:///${id}.m4a`,
                durationMs: 1000,
            },
        ],
    }) as never;

function makeStore() {
    const store = createStore<DataSlice>()((set, get, api) =>
        createDataSlice(set as never, get as never, api as never)
    );
    const collection = (id: string) => ({
        id,
        title: id,
        workspaceId: "ws",
        parentCollectionId: null,
        createdAt: OLD,
        updatedAt: OLD,
        ideasListState: { hiddenIdeaIds: ["sketch-b"], hiddenDays: [] },
    });
    store.setState({
        activeWorkspaceId: "ws",
        workspaces: [{ id: "ws", title: "W", collections: [collection("col-a"), collection("col-b")], ideas: [] }],
    } as never);
    store.getState().updateIdeas(
        () => [makeIdea("sketch-a", "project"), makeIdea("sketch-b", "project"), makeIdea("clip-c", "clip")],
        { preserveActivity: true }
    );
    return store;
}

const workspaceOf = (store: ReturnType<typeof makeStore>) => store.getState().workspaces[0]!;
const ideaOf = (store: ReturnType<typeof makeStore>, id: string) =>
    workspaceOf(store).ideas.find((idea) => idea.id === id)!;

describe("updateIdeas", () => {
    it("leaves untouched ideas identical — same object, same lastActivityAt", () => {
        const store = makeStore();
        const before = { a: ideaOf(store, "sketch-a"), b: ideaOf(store, "sketch-b") };

        store.getState().updateIdeas((ideas) =>
            ideas.map((idea) => (idea.id === "clip-c" ? { ...idea, title: "renamed" } : idea))
        );

        expect(ideaOf(store, "clip-c").title).toBe("renamed");
        expect(ideaOf(store, "sketch-a")).toBe(before.a);
        expect(ideaOf(store, "sketch-b")).toBe(before.b);
        expect(ideaOf(store, "sketch-a").lastActivityAt).toBe(before.a.lastActivityAt);
    });

    it("stamps only the edited sketch as active", () => {
        const store = makeStore();
        const untouchedBefore = ideaOf(store, "sketch-b").lastActivityAt;
        const editedBefore = ideaOf(store, "sketch-a").lastActivityAt;

        store.getState().updateIdeas((ideas) =>
            ideas.map((idea) => (idea.id === "sketch-a" ? { ...idea, notes: "new verse" } : idea))
        );

        expect(ideaOf(store, "sketch-a").lastActivityAt).toBeGreaterThan(editedBefore);
        expect(ideaOf(store, "sketch-b").lastActivityAt).toBe(untouchedBefore);
    });

    it("keeps collection objects when membership did not change", () => {
        const store = makeStore();
        const collectionsBefore = workspaceOf(store).collections;

        store.getState().updateIdeas((ideas) =>
            ideas.map((idea) => (idea.id === "clip-c" ? { ...idea, title: "renamed" } : idea))
        );

        expect(workspaceOf(store).collections).toBe(collectionsBefore);
    });

    it("re-derives list state for exactly the collections an idea left or joined", () => {
        const store = makeStore();
        const [colABefore, colBBefore] = workspaceOf(store).collections;

        // sketch-b is hidden in col-a; moving it out must prune the stale hidden id there.
        store.getState().updateIdeas((ideas) =>
            ideas.map((idea) => (idea.id === "sketch-b" ? { ...idea, collectionId: "col-b" } : idea))
        );

        const [colA, colB] = workspaceOf(store).collections;
        expect(colA).not.toBe(colABefore);
        expect(colB).not.toBe(colBBefore);
        expect(colA!.ideasListState?.hiddenIdeaIds).toEqual([]);
    });

    it("prunes list state when an idea is deleted", () => {
        const store = makeStore();
        store.getState().updateIdeas((ideas) => ideas.filter((idea) => idea.id !== "sketch-b"));
        expect(workspaceOf(store).collections[0]!.ideasListState?.hiddenIdeaIds).toEqual([]);
    });
});

describe("updateIdeas no-op", () => {
    it("notifies nobody when the updater changes nothing", () => {
        const store = makeStore();
        const listener = jest.fn();
        const unsubscribe = store.subscribe(listener);
        const before = store.getState();

        store.getState().updateIdeas((ideas) => ideas.map((idea) => idea));

        expect(listener).not.toHaveBeenCalled();
        expect(store.getState()).toBe(before);
        unsubscribe();
    });
});
