import { recoverStrandedDraftIdeas } from "../../domain/draftRecovery";
import type { Workspace } from "../../types";

const idea = (id: string, isDraft: boolean, clipCount: number) =>
    ({
        id,
        title: id,
        kind: "project",
        collectionId: "col",
        notes: "",
        status: "seed",
        completionPct: 0,
        createdAt: 1,
        lastActivityAt: 1,
        isDraft,
        clips: Array.from({ length: clipCount }, (_, i) => ({
            id: `${id}-c${i}`,
            title: "take",
            notes: "",
            createdAt: 1,
            isPrimary: i === 0,
            audioUri: `file:///${id}-${i}.m4a`,
        })),
    }) as never;

describe("recoverStrandedDraftIdeas (2026-10-04)", () => {
    it("a draft with clips becomes a sketch; an empty draft is removed; the rest untouched", () => {
        const workspaces = [
            { id: "ws", title: "W", collections: [], ideas: [idea("saved", false, 1), idea("stranded", true, 2), idea("empty", true, 0)] },
            { id: "other", title: "O", collections: [], ideas: [idea("plain", false, 1)] },
        ] as unknown as Workspace[];

        const result = recoverStrandedDraftIdeas(workspaces);
        expect(result.recovered).toBe(1);
        expect(result.removed).toBe(1);
        const ideas = result.workspaces[0]!.ideas;
        expect(ideas.map((i) => i.id)).toEqual(["saved", "stranded"]);
        expect(ideas.every((i) => !i.isDraft)).toBe(true);
        expect(ideas[0]).toBe(workspaces[0]!.ideas[0]);
        expect(result.workspaces[1]).toBe(workspaces[1]);
    });

    it("is a no-op without drafts", () => {
        const workspaces = [{ id: "ws", title: "W", collections: [], ideas: [idea("a", false, 1)] }] as unknown as Workspace[];
        expect(recoverStrandedDraftIdeas(workspaces).workspaces).toBe(workspaces);
    });
});
