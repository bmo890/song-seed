import { defaultKeepPlan, keepLabelKey, parcelRows } from "../receivedParcel";
import type { Workspace } from "../../types";

const copy = {
    takes: (n: number) => `${n} takes`,
    items: (n: number) => `${n} items`,
    lyrics: "Lyrics",
    chart: "Chart",
};
const received = (shareKind: string) =>
    ({ senderName: "Ben", senderUserId: null, transferId: "t", receivedAt: 0, shareKind, shareTitle: "x" }) as Workspace["received"];
const idea = (id: string, collectionId: string, over: Record<string, unknown> = {}) =>
    ({ id, title: id, collectionId, kind: "clip", clips: [{ id: `${id}-c` }], ...over }) as unknown as Workspace["ideas"][number];
const ws = (over: Partial<Workspace>): Workspace =>
    ({ id: "p", title: "p", origin: "received", collections: [], ideas: [], ...over }) as unknown as Workspace;

describe("parcelRows", () => {
    it("lists a workspace's collections with their counts, nested included", () => {
        const pkg = ws({
            received: received("workspace"),
            collections: [
                { id: "a", title: "Songs" },
                { id: "b", title: "Demos" },
                { id: "a1", title: "Old", parentCollectionId: "a" },
            ] as Workspace["collections"],
            ideas: [idea("1", "a"), idea("2", "a1"), idea("3", "b")],
        });
        expect(parcelRows(pkg, copy)).toEqual([
            { key: "c-a", icon: "folder", title: "Songs", meta: "2 items" },
            { key: "c-b", icon: "folder", title: "Demos", meta: "1 items" },
        ]);
    });
    it("opens a single collection to its sub-collections and ideas", () => {
        const pkg = ws({
            received: received("collection"),
            collections: [{ id: "a", title: "Set" }, { id: "a1", title: "Old", parentCollectionId: "a" }] as Workspace["collections"],
            ideas: [
                idea("s", "a", {
                    kind: "project",
                    clips: [{}, {}],
                    lyrics: { versions: [{ document: { lines: [{ text: "la" }] } }] },
                    chordSheet: { sections: [{ measures: [{ chords: ["C"] }] }] },
                }),
                idea("x", "a1"),
            ],
        });
        expect(parcelRows(pkg, copy)).toEqual([
            { key: "c-a1", icon: "folder", title: "Old", meta: "1 items" },
            { key: "i-s", icon: "sketch", title: "s", meta: "2 takes · Lyrics · Chart" },
        ]);
    });
    it("lists clips one per row", () => {
        const pkg = ws({
            received: received("clips"),
            collections: [{ id: "f", title: "Files" }] as Workspace["collections"],
            ideas: [idea("one", "f"), idea("two", "f")],
        });
        expect(parcelRows(pkg, copy).map((row) => [row.icon, row.title, row.meta])).toEqual([
            ["clip", "one", "1 takes"],
            ["clip", "two", "1 takes"],
        ]);
    });
});

describe("defaultKeepPlan", () => {
    const mine = { id: "m", origin: undefined } as unknown as Workspace;
    it("keeps a workspace as its own, everything else into the active workspace", () => {
        expect(defaultKeepPlan(ws({ received: received("workspace") }), mine)).toEqual({ mode: "own-workspace" });
        expect(defaultKeepPlan(ws({ received: received("collection") }), mine)).toEqual({ mode: "into", workspaceId: "m" });
        expect(defaultKeepPlan(ws({ received: received("clips") }), mine)).toEqual({ mode: "into", workspaceId: "m" });
    });
    it("falls back to its own workspace with nowhere of yours to land", () => {
        expect(defaultKeepPlan(ws({ received: received("sketch") }), null)).toEqual({ mode: "own-workspace" });
        expect(defaultKeepPlan(ws({ received: received("sketch") }), { id: "r", origin: "received" } as Workspace)).toEqual({ mode: "own-workspace" });
    });
});

describe("keepLabelKey", () => {
    it("names the key by kind", () => {
        expect(keepLabelKey("workspace")).toBe("received.keepWorkspace");
        expect(keepLabelKey("sketch")).toBe("received.keepSketch");
        expect(keepLabelKey("setlist")).toBe("received.keepParcel");
    });
});
