import type { SongIdea } from "../../../types";
import { EMPTY_SEARCH_META, computeIdeaSearchMeta } from "../ideaSearchMeta";

const clip = (notes: string) => ({ id: `clip-${notes}`, notes }) as unknown as SongIdea["clips"][number];
const base = (over: Partial<SongIdea>): SongIdea =>
    ({ id: "i", title: "Porch swing melody", notes: "", clips: [], kind: "clip", ...over }) as unknown as SongIdea;

describe("computeIdeaSearchMeta", () => {
    it("an empty needle matches everything with no snippet", () => {
        expect(computeIdeaSearchMeta(base({}), "")).toBe(EMPTY_SEARCH_META);
    });

    it("a title match needs no snippet", () => {
        const meta = computeIdeaSearchMeta(base({}), "porch");
        expect(meta.matches).toBe(true);
        expect(meta.title).toBe(true);
        expect(meta.snippet).toBeNull();
    });

    it("a note match shows the matched line", () => {
        const meta = computeIdeaSearchMeta(base({ title: "x", clips: [clip("A porch light line")] }), "porch");
        expect(meta.matches).toBe(true);
        expect(meta.notes).toBe(true);
        expect(meta.snippetField).toBe("notes");
        expect(meta.snippet).toContain("porch");
    });

    it("lyrics win over notes for the snippet", () => {
        const idea = base({
            title: "x",
            kind: "project",
            notes: "porch in notes",
            lyrics: {
                versions: [{ document: { lines: [{ text: "Hello Porch light", chords: [] }] } }],
            } as unknown as SongIdea["lyrics"],
        });
        const meta = computeIdeaSearchMeta(idea, "porch");
        expect(meta.lyrics).toBe(true);
        expect(meta.snippetField).toBe("lyrics");
    });

    it("no match anywhere", () => {
        const meta = computeIdeaSearchMeta(base({}), "zzz");
        expect(meta.matches).toBe(false);
    });
});
