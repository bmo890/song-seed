import { defaultKeepPlan, keepLabelKey, parcelRows, withSenderNote } from "../receivedParcel";
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
                    clips: [{ id: "c1", createdAt: 1 }, { id: "c2", createdAt: 2 }],
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
    it("counts a sketch's takes as the sketch page does: older versions fold into their take", () => {
        const pkg = ws({
            received: received("sketch"),
            collections: [{ id: "a", title: "Harbor Lights" }] as Workspace["collections"],
            ideas: [
                idea("s", "a", {
                    kind: "project",
                    clips: [
                        { id: "v1", createdAt: 1 },
                        { id: "v2", createdAt: 2, parentClipId: "v1" },
                        { id: "v3", createdAt: 3, parentClipId: "v2" },
                        { id: "live", createdAt: 4 },
                    ],
                }),
            ],
        });
        expect(parcelRows(pkg, copy)[0]?.meta).toBe("2 takes");
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

describe("withSenderNote", () => {
    const withNote = (over: Partial<Workspace>) =>
        ws({ received: { ...received("sketch")!, senderName: "Sam", message: "Learn the bridge" }, ...over });

    it("files a sketch's note in the sketch notes, above what was there", () => {
        const kept = withSenderNote(withNote({ ideas: [idea("s", "a", { kind: "project", notes: "Capo 2" })] }));
        expect(kept.ideas[0]!.notes).toBe("Sam: Learn the bridge\n\nCapo 2");
        expect(kept.received?.message).toBeUndefined();
    });
    it("files a clip's note on its primary take", () => {
        const kept = withSenderNote(
            withNote({ ideas: [idea("c", "a", { clips: [{ id: "x", notes: "" }, { id: "y", notes: "", isPrimary: true }] })] })
        );
        expect(kept.ideas[0]!.clips.map((clip) => clip.notes)).toEqual(["", "Sam: Learn the bridge"]);
    });
    it("files a collection's note in its description; more than one goes to the workspace", () => {
        const one = withSenderNote(
            withNote({ collections: [{ id: "a", title: "Set" }] as Workspace["collections"], ideas: [idea("1", "a"), idea("2", "a")] })
        );
        expect(one.collections[0]!.description).toBe("Sam: Learn the bridge");
        const two = withSenderNote(
            withNote({
                collections: [{ id: "a", title: "A" }, { id: "b", title: "B" }] as Workspace["collections"],
                ideas: [idea("1", "a"), idea("2", "b")],
            })
        );
        expect(two.description).toBe("Sam: Learn the bridge");
    });
    it("never files the same note twice, and leaves a parcel without one alone", () => {
        const pkg = withNote({ ideas: [idea("s", "a", { kind: "project", notes: "Sam: Learn the bridge" })] });
        expect(withSenderNote(pkg).ideas[0]!.notes).toBe("Sam: Learn the bridge");
        const plain = ws({ received: received("sketch"), ideas: [idea("s", "a", { kind: "project", notes: "" })] });
        expect(withSenderNote(plain)).toBe(plain);
    });
});
