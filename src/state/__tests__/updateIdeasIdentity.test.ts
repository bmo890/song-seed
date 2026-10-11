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

describe("activity on clip ideas (2026-10-03)", () => {
    it("a rename counts as editing the clip", () => {
        const store = makeStore();
        const before = ideaOf(store, "clip-c").lastActivityAt;

        store.getState().updateIdeas((ideas) =>
            ideas.map((idea) => (idea.id === "clip-c" ? { ...idea, title: "Porch riff" } : idea))
        );

        expect(ideaOf(store, "clip-c").lastActivityAt).toBeGreaterThan(before);
    });

    it("a move between collections does not", () => {
        const store = makeStore();
        const before = ideaOf(store, "clip-c").lastActivityAt;

        store.getState().updateIdeas((ideas) =>
            ideas.map((idea) => (idea.id === "clip-c" ? { ...idea, collectionId: "col-b" } : idea))
        );

        expect(ideaOf(store, "clip-c").lastActivityAt).toBe(before);
    });
});

describe("updated means work (2026-10-12)", () => {
    const edit = (store: ReturnType<typeof makeStore>, id: string, patch: (idea: any) => any) =>
        store.getState().updateIdeas((ideas) => ideas.map((idea) => (idea.id === id ? patch(idea) : idea)));
    const clipPatch = (patch: (clip: any) => any) => (idea: any) => ({
        ...idea,
        clips: idea.clips.map((clip: any, index: number) => (index === 0 ? patch(clip) : clip)),
    });
    const stem = { id: "stem-1", title: "Harmony", gainDb: 0, offsetMs: 0, tonePreset: "neutral", isMuted: false, createdAt: OLD };
    const withStem = (idea: any) => clipPatch((clip) => ({ ...clip, overdub: { stems: [stem] } }))(idea);

    const counts: Array<[string, (idea: any) => any]> = [
        ["a stage change", (idea) => ({ ...idea, status: "stem", completionPct: 40 })],
        ["a section on the reel", clipPatch((clip) => ({ ...clip, sections: [{ id: "s1", startMs: 0, endMs: 500, label: "Verse", kind: "verse" }] }))],
        ["a pin", clipPatch((clip) => ({ ...clip, practiceMarkers: [{ id: "p1", label: "here", atMs: 200 }] }))],
        ["a tag", clipPatch((clip) => ({ ...clip, tags: ["riff"] }))],
        ["a new take", (idea) => ({ ...idea, clips: [...idea.clips, { ...idea.clips[0], id: "take-2", isPrimary: false, createdAt: OLD }] })],
        ["a layer's gain", (idea) => clipPatch((clip) => ({ ...clip, overdub: { stems: [{ ...stem, gainDb: -6 }] } }))(withStem(idea))],
        ["a layer's offset", (idea) => clipPatch((clip) => ({ ...clip, overdub: { stems: [{ ...stem, offsetMs: 40 }] } }))(withStem(idea))],
        ["a layer removed", (idea) => clipPatch((clip) => ({ ...clip, overdub: { stems: [] } }))(withStem(idea))],
        ["the chart", (idea) => ({ ...idea, chordSheet: { sections: [{ id: "c1", label: "A", measures: [{ id: "m1", chords: ["Am"] }], notes: "" }], updatedAt: OLD } })],
    ];
    const doesNot: Array<[string, (idea: any) => any]> = [
        ["a bookmark", (idea) => ({ ...idea, isBookmarked: true })],
        ["a move between collections", (idea) => ({ ...idea, collectionId: "col-b" })],
        ["a group", (idea) => ({ ...idea, clipGroups: [{ id: "g1", name: "Keepers", collapsed: false, createdAt: OLD, updatedAt: OLD }] })],
        ["the planned song grid", (idea) => ({ ...idea, songGridUpdatedAt: OLD + 1 })],
        ["a layer's mute", (idea) => clipPatch((clip) => ({ ...clip, overdub: { stems: [{ ...stem, isMuted: true }] } }))(withStem(idea))],
        ["a layer's colour or name", (idea) => clipPatch((clip) => ({ ...clip, overdub: { stems: [{ ...stem, title: "Low harmony", color: "#123456" }] } }))(withStem(idea))],
        ["a rendered mix", (idea) => clipPatch((clip) => ({ ...clip, overdub: { stems: [stem], renderedMixUri: "file:///mix.m4a", lastRenderedAt: OLD + 1 } }))(withStem(idea))],
        ["hydrated waveform or duration", clipPatch((clip) => ({ ...clip, waveformPeaks: [0.1, 0.2], durationMs: 2000 }))],
        ["tempo analysis", clipPatch((clip) => ({ ...clip, analysis: { schemaVersion: 2, analyzedAt: OLD + 1, key: null, mode: null, keyConfidence: 0, bpm: 120, bpmSteadiness: 1 } }))],
    ];

    for (const kind of ["project", "clip"] as const) {
        const id = kind === "project" ? "sketch-a" : "clip-c";
        describe(`on a ${kind === "project" ? "sketch" : "clip"}`, () => {
            it.each(counts)("%s counts", (_label, patch) => {
                const store = makeStore();
                // Layer cases start from an idea that already has the layer.
                if (_label.startsWith("a layer")) {
                    store.getState().updateIdeas((ideas) => ideas.map((idea) => (idea.id === id ? withStem(idea) : idea)), { preserveActivity: true });
                }
                const before = ideaOf(store, id).lastActivityAt;
                edit(store, id, patch);
                expect(ideaOf(store, id).lastActivityAt).toBeGreaterThan(before);
            });

            it.each(doesNot)("%s does not", (_label, patch) => {
                const store = makeStore();
                if (_label.startsWith("a layer") || _label === "a rendered mix") {
                    store.getState().updateIdeas((ideas) => ideas.map((idea) => (idea.id === id ? withStem(idea) : idea)), { preserveActivity: true });
                }
                const before = ideaOf(store, id).lastActivityAt;
                edit(store, id, patch);
                expect(ideaOf(store, id).lastActivityAt).toBe(before);
            });
        });
    }

    it("sections and pins set through their own actions stamp the idea", () => {
        const store = makeStore();
        const before = ideaOf(store, "clip-c").lastActivityAt;
        store.getState().setClipSections("clip-c", "clip-c-clip", [{ id: "s1", startMs: 0, endMs: 500, label: "Verse", kind: "verse" }]);
        expect(ideaOf(store, "clip-c").lastActivityAt).toBeGreaterThan(before);

        const sketchBefore = ideaOf(store, "sketch-a").lastActivityAt;
        store.getState().addClipPracticeMarker("sketch-a", "sketch-a-clip", { id: "p1", label: "here", atMs: 200 });
        expect(ideaOf(store, "sketch-a").lastActivityAt).toBeGreaterThan(sketchBefore);
    });

    it("a title-only rename of a sketch counts", () => {
        const store = makeStore();
        const before = ideaOf(store, "sketch-a").lastActivityAt;
        store.getState().renameIdea("sketch-a", "Porch song");
        expect(ideaOf(store, "sketch-a").lastActivityAt).toBeGreaterThan(before);
    });

    it("a bookmark through its own action does not", () => {
        const store = makeStore();
        const before = ideaOf(store, "sketch-a").lastActivityAt;
        store.getState().toggleClipBookmark("sketch-a", "sketch-a-clip");
        expect(ideaOf(store, "sketch-a").lastActivityAt).toBe(before);
    });
});

describe("importing is not editing (2026-10-03)", () => {
    const SOURCE = OLD - 400 * 24 * 60 * 60 * 1000;
    const IMPORTED = OLD;

    const importedClip = (id: string, lastActivityAt: number) => {
        const idea = makeIdea(id, "clip") as unknown as Record<string, unknown>;
        const clip = (idea.clips as Array<Record<string, unknown>>)[0]!;
        return {
            ...idea,
            createdAt: SOURCE,
            importedAt: IMPORTED,
            sourceCreatedAt: SOURCE,
            lastActivityAt,
            clips: [{ ...clip, createdAt: SOURCE, importedAt: IMPORTED }],
        } as never;
    };

    it("an idea still stamped with its import time sorts by its own date", () => {
        const store = makeStore();
        store.getState().updateIdeas((ideas) => [...ideas, importedClip("imp", IMPORTED)], { preserveActivity: true });
        expect(ideaOf(store, "imp").lastActivityAt).toBe(SOURCE);
    });

    it("an imported idea edited afterwards keeps the edit as its activity", () => {
        const store = makeStore();
        const EDITED = IMPORTED + 5000;
        store.getState().updateIdeas((ideas) => [...ideas, importedClip("imp", EDITED)], { preserveActivity: true });
        expect(ideaOf(store, "imp").lastActivityAt).toBe(EDITED);
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
