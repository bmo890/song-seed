import { restoreRemovedItem, undoMadeSketch, type MadeSketch } from "../undoPatch";

/**
 * Audit 2026-11-02, root cause 3 (04-M6, 12g G-L3): Undo reverses only what its action
 * did. It used to put back everything as it was before, erasing whatever happened in
 * the five-second window.
 */
const clip = (id: string, extra: Record<string, unknown> = {}) =>
    ({ id, title: id, notes: "", createdAt: 1, isPrimary: false, ...extra }) as any;
const idea = (id: string, clips: any[], extra: Record<string, unknown> = {}) =>
    ({ id, title: id, notes: "", status: "clip", completionPct: 0, kind: "clip", collectionId: "col", clips, createdAt: 1, lastActivityAt: 1, ...extra }) as any;

describe("undo Make sketch", () => {
    const a = idea("a", [clip("ca", { isPrimary: true })]);
    const b = idea("b", [clip("cb", { isPrimary: true })]);
    const sketch = idea("sketch", [clip("ca", { isPrimary: true }), clip("cb")], { kind: "project", isDraft: true });
    const collections = [{ id: "col", ideasListState: { hiddenIdeaIds: ["b"], hiddenDays: [] } }] as any;
    const made: MadeSketch = {
        workspaceId: "ws",
        sketch,
        gatheredIdeas: [a, b],
        collections,
        activityEvents: [{ id: "e1", ideaId: "a", clipId: "ca", at: 1 }] as any,
        playlists: [{ id: "p", items: [{ id: "i1", ideaId: "b", clipId: "cb" }] }] as any,
    };
    const afterGather = (ideas: any[]) => ({
        workspaces: [{ id: "ws", collections: [{ id: "col", ideasListState: { hiddenIdeaIds: [], hiddenDays: [] } }], ideas }],
        activityEvents: [{ id: "e1", ideaId: "sketch", clipId: "ca", at: 1 }, { id: "e2", ideaId: "new", at: 2 }],
        playlists: [{ id: "p", items: [{ id: "i1", ideaId: "sketch", clipId: "cb" }] }],
    }) as any;

    it("keeps what reached the workspace in the window, and brings the clips back", () => {
        const imported = idea("new", [clip("cn")]);
        const patch = undoMadeSketch(afterGather([imported, sketch]), made);
        const ws = patch.workspaces![0]!;
        expect(ws.ideas.map((item: { id: string }) => item.id).sort()).toEqual(["a", "b", "new"]);
        expect(ws.collections[0]!.ideasListState.hiddenIdeaIds).toEqual(["b"]);
        expect(patch.activityEvents!.map((event: { ideaId: string }) => event.ideaId)).toEqual(["a", "new"]);
        expect(patch.playlists![0]!.items[0]!.ideaId).toBe("b");
    });

    it("a sketch the person made their own keeps what it gained", () => {
        const recordedInto = { ...sketch, clips: [clip("fresh", { isPrimary: false }), ...sketch.clips] };
        const patch = undoMadeSketch(afterGather([recordedInto]), made);
        const kept = patch.workspaces![0]!.ideas.find((item: { id: string }) => item.id === "sketch")!;
        expect(kept.clips.map((c: { id: string }) => c.id)).toEqual(["fresh"]);
        expect(kept.clips[0]!.isPrimary).toBe(true);
    });
});

describe("undo a removed word", () => {
    it("puts the word back where it stood, keeping words added since", () => {
        const before = [{ id: "w1" }, { id: "w2" }, { id: "w3" }];
        const live = [{ id: "w1" }, { id: "w3" }, { id: "w4" }];
        expect(restoreRemovedItem(live, before, "w2").map((w) => w.id)).toEqual(["w1", "w2", "w3", "w4"]);
        expect(restoreRemovedItem([{ id: "w9" }], before, "w1").map((w) => w.id)).toEqual(["w1", "w9"]);
        expect(restoreRemovedItem(live, before, "w1")).toBe(live);
    });
});
