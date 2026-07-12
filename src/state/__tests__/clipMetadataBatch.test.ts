import { applyClipMetadataBatch } from "../clipMetadataBatch";
import type { Collection, SongIdea, Workspace } from "../../types";

function collection(id: string, workspaceId: string): Collection {
    return {
        id,
        title: id,
        workspaceId,
        parentCollectionId: null,
        createdAt: 1,
        updatedAt: 1,
        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
    };
}

function clipIdea(id: string, collectionId: string, clipId: string, durationMs?: number): SongIdea {
    return {
        id,
        title: id,
        notes: "",
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId,
        createdAt: 1,
        lastActivityAt: 1,
        clips: [
            {
                id: clipId,
                title: clipId,
                notes: "",
                createdAt: 1,
                isPrimary: true,
                audioUri: `file:///${clipId}.m4a`,
                durationMs,
            },
        ],
    };
}

function workspace(id: string, colId: string, ideas: SongIdea[]): Workspace {
    return { id, title: id, collections: [collection(colId, id)], ideas };
}

describe("applyClipMetadataBatch — reference identity (the persist-storm guard)", () => {
    it("returns the SAME array when no entry is relevant (empty / peaks-only-empty)", () => {
        const workspaces = [workspace("ws-1", "col-1", [clipIdea("i1", "col-1", "c1")])];
        expect(applyClipMetadataBatch(workspaces, [])).toBe(workspaces);
        expect(
            applyClipMetadataBatch(workspaces, [
                { workspaceId: "ws-1", ideaId: "i1", clipId: "c1", waveformPeaks: [] },
            ])
        ).toBe(workspaces);
    });

    it("keeps untouched workspaces, ideas, and clips reference-identical", () => {
        const wsA = workspace("ws-A", "col-A", [
            clipIdea("idea-A1", "col-A", "clip-A1"),
            clipIdea("idea-A2", "col-A", "clip-A2"),
        ]);
        const wsB = workspace("ws-B", "col-B", [clipIdea("idea-B1", "col-B", "clip-B1")]);
        const untouchedIdea = wsA.ideas.find((i) => i.id === "idea-A2")!;

        const next = applyClipMetadataBatch([wsA, wsB], [
            { workspaceId: "ws-A", ideaId: "idea-A1", clipId: "clip-A1", durationMs: 4321 },
        ]);

        const nextA = next.find((w) => w.id === "ws-A")!;
        const nextB = next.find((w) => w.id === "ws-B")!;

        // Untouched workspace keeps identity — its shard won't re-serialize.
        expect(nextB).toBe(wsB);
        // Touched workspace is a new object, but its untouched idea keeps identity.
        expect(nextA).not.toBe(wsA);
        expect(nextA.ideas.find((i) => i.id === "idea-A2")).toBe(untouchedIdea);
        // Targeted clip got the duration.
        expect(nextA.ideas.find((i) => i.id === "idea-A1")!.clips[0]!.durationMs).toBe(4321);
    });

    it("applies many clips across ideas in one pass", () => {
        const ws = workspace("ws-1", "col-1", [
            clipIdea("i1", "col-1", "c1"),
            clipIdea("i2", "col-1", "c2"),
            clipIdea("i3", "col-1", "c3"),
        ]);
        const next = applyClipMetadataBatch([ws], [
            { workspaceId: "ws-1", ideaId: "i1", clipId: "c1", durationMs: 100 },
            { workspaceId: "ws-1", ideaId: "i3", clipId: "c3", durationMs: 300 },
        ]);
        const ideas = next[0]!.ideas;
        expect(ideas.find((i) => i.id === "i1")!.clips[0]!.durationMs).toBe(100);
        expect(ideas.find((i) => i.id === "i3")!.clips[0]!.durationMs).toBe(300);
        // i2 untouched → identity preserved.
        expect(ideas.find((i) => i.id === "i2")).toBe(ws.ideas.find((i) => i.id === "i2"));
    });

    it("never overwrites existing peaks with an empty placeholder", () => {
        const existing = [0.1, 0.2, 0.3];
        const idea = clipIdea("i1", "col-1", "c1", 1000);
        idea.clips[0]!.waveformPeaks = existing;
        const next = applyClipMetadataBatch([workspace("ws-1", "col-1", [idea])], [
            { workspaceId: "ws-1", ideaId: "i1", clipId: "c1", waveformPeaks: [], durationMs: 2000 },
        ]);
        expect(next[0]!.ideas[0]!.clips[0]!.waveformPeaks).toBe(existing);
        expect(next[0]!.ideas[0]!.clips[0]!.durationMs).toBe(2000);
    });
});
