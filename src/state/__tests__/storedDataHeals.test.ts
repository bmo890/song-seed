jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
jest.mock("../../services/waveformAnalysis", () => ({}));
jest.mock("../../services/audioStorage", () => ({}));

import { normalizeWorkspaces } from "../dataSlice";
import { useStore } from "../useStore";
import { appActions } from "../actions";
import { getCollectionAncestors } from "../../utils";
import { buildClipGraph } from "../../domain/clipGraph";
import type { ClipVersion, SongIdea, Workspace } from "../../types";

/**
 * Stored data that an older import, a backup or an old bug left broken heals on
 * the way in, and every walk over parent links ends (data-safety audit 2026-11-02:
 * 09 H1, 07 M2, 08 R2, 08 R3).
 */

const T = Date.UTC(2026, 0, 10);

const take = (id: string, extra: Partial<ClipVersion> = {}): ClipVersion =>
    ({ id, title: id, notes: "", createdAt: T, isPrimary: false, ...extra }) as ClipVersion;

const idea = (id: string, extra: Partial<SongIdea> = {}): SongIdea =>
    ({
        id,
        title: id,
        notes: "",
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId: "col",
        createdAt: T,
        lastActivityAt: T,
        clips: [take(`${id}-t`, { isPrimary: true })],
        ...extra,
    }) as SongIdea;

const workspace = (id: string, ideas: SongIdea[], collections?: Workspace["collections"]): Workspace =>
    ({
        id,
        title: id,
        collections: collections ?? [
            { id: "col", title: "Ideas", workspaceId: id, parentCollectionId: null, createdAt: T, updatedAt: T, ideasListState: { hiddenIdeaIds: [], hiddenDays: [] } },
        ],
        ideas,
    }) as Workspace;

describe("stored ideas heal at hydration", () => {
    it("a title that isn't text becomes text (it threw in render on every launch)", () => {
        const [ws] = normalizeWorkspaces([
            workspace("w", [idea("a", { title: null as unknown as string, clips: [take("t", { title: { x: 1 } as unknown as string, isPrimary: true })] })]),
        ]);
        expect(typeof ws!.ideas[0]!.title).toBe("string");
        expect(ws!.ideas[0]!.clips[0]!.title).toBe("");
    });

    it("a missing creation date takes the take's date, not NaN", () => {
        const [ws] = normalizeWorkspaces([
            workspace("w", [idea("a", { createdAt: undefined as unknown as number, lastActivityAt: undefined as unknown as number, kind: "project", clips: [] }), idea("b", { createdAt: undefined as unknown as number, clips: [take("bt", { createdAt: T - 5, isPrimary: true })] })]),
        ]);
        const [a, b] = ws!.ideas;
        expect(Number.isFinite(a!.createdAt)).toBe(true);
        expect(Number.isFinite(a!.lastActivityAt)).toBe(true);
        expect(b!.createdAt).toBe(T - 5);
    });

    it("a date saved as null (NaN through JSON) never becomes 1970", () => {
        const [ws] = normalizeWorkspaces([
            workspace("w", [idea("a", { createdAt: null as unknown as number, clips: [take("t", { createdAt: null as unknown as number, isPrimary: true })], importedAt: T - 9 })]),
        ]);
        expect(ws!.ideas[0]!.createdAt).toBe(T - 9);
        expect(ws!.ideas[0]!.clips[0]!.createdAt).toBe(T - 9);
        expect(ws!.ideas[0]!.lastActivityAt).toBeGreaterThan(0);
    });

    it("two ideas with one id (in one workspace or two) get distinct ids; both stay", () => {
        const out = normalizeWorkspaces([workspace("w1", [idea("A"), idea("A")]), workspace("w2", [idea("A")])]);
        const ids = out.flatMap((ws) => ws.ideas.map((i) => i.id));
        expect(ids).toHaveLength(3);
        expect(new Set(ids).size).toBe(3);
        expect(ids[0]).toBe("A");
    });

    it("a collection loop and a dangling parent are cut: every collection reaches the top", () => {
        const col = (id: string, parent: string | null) =>
            ({ id, title: id, workspaceId: "w", parentCollectionId: parent, createdAt: T, updatedAt: T, ideasListState: { hiddenIdeaIds: [], hiddenDays: [] } });
        const [ws] = normalizeWorkspaces([
            workspace("w", [idea("a", { collectionId: "A" })], [col("A", "B"), col("B", "A"), col("S", "S"), col("D", "gone")]),
        ]);
        const parentOf = new Map(ws!.collections.map((c) => [c.id, c.parentCollectionId]));
        expect(parentOf.get("S")).toBeNull();
        expect(parentOf.get("D")).toBeNull();
        expect([parentOf.get("A"), parentOf.get("B")]).toContain(null);
        expect(ws!.ideas.map((i) => i.id)).toEqual(["a"]);
    });
});

describe("walks over parent links end", () => {
    it("getCollectionAncestors stops at a loop (it spun Revisit and Activity forever)", () => {
        const ws = workspace("w", [], [
            { id: "A", title: "A", workspaceId: "w", parentCollectionId: "B" },
            { id: "B", title: "B", workspaceId: "w", parentCollectionId: "A" },
        ] as Workspace["collections"]);
        const ancestors = getCollectionAncestors(ws, "A");
        expect(ancestors.map((c) => c.id)).toEqual(["B"]);
    });

    it("a take loop or a self-parent no longer hides the takes", () => {
        const graph = buildClipGraph([take("r"), take("x", { parentClipId: "y" }), take("y", { parentClipId: "x" }), take("self", { parentClipId: "self" })]);
        const reachable = new Set<string>();
        const visit = (id: string) => {
            reachable.add(id);
            for (const child of graph.childrenByParentId.get(id) ?? []) visit(child.id);
        };
        graph.roots.forEach((root) => visit(root.id));
        expect([...reachable].sort()).toEqual(["r", "self", "x", "y"]);
    });
});

describe("a take moved out of a sketch gets its own idea id (08 R2)", () => {
    it("moving the sketch's first take out never makes a second idea with the sketch's id", async () => {
        // A sketch made from a moved-out clip carries the clip's id as its own.
        const sketch = idea("A", {
            kind: "project",
            status: "seed",
            clips: [take("A", { isPrimary: true }), take("B")],
        });
        useStore.setState({ activeWorkspaceId: "w", workspaces: normalizeWorkspaces([workspace("w", [sketch])]) } as never);
        useStore.getState().setClipClipboard({
            mode: "move",
            itemType: "clip",
            sourceWorkspaceId: "w",
            sourceIdeaId: "A",
            clipIds: ["A"],
            from: "project",
        });
        const moved = await appActions.pasteClipboardToCollection("col");
        expect(moved).toHaveLength(1);
        const ids = useStore.getState().workspaces.flatMap((ws) => ws.ideas.map((i) => i.id));
        expect(new Set(ids).size).toBe(ids.length);
        expect(moved[0]).not.toBe("A");
    });
});
