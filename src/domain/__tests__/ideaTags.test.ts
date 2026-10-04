import { collectClipIdeaTagsInUse, getClipIdeaTags, ideaMatchesTagFilter, UNTAGGED_FILTER_KEY } from "../ideaTags";
import type { SongIdea } from "../../types";

const idea = (id: string, kind: "clip" | "project", tags?: string[]): SongIdea =>
    ({
        id,
        title: id,
        kind,
        notes: "",
        status: kind === "clip" ? "clip" : "seed",
        completionPct: 0,
        collectionId: "c",
        createdAt: 1,
        lastActivityAt: 1,
        clips: [{ id: `${id}-clip`, title: id, notes: "", createdAt: 1, isPrimary: true, audioUri: "file:///a.m4a", tags }],
    }) as unknown as SongIdea;

describe("tags in the collection (clips only, 2026-10-03)", () => {
    it("a clip idea's tags are its clips' tags; a sketch carries none here", () => {
        expect(getClipIdeaTags(idea("a", "clip", ["riff", "verse"]))).toEqual(["riff", "verse"]);
        expect(getClipIdeaTags(idea("s", "project", ["riff"]))).toEqual([]);
    });

    it("matches any listed tag, or none at all via untagged; an empty filter is everything", () => {
        const riff = idea("a", "clip", ["riff"]);
        const bare = idea("b", "clip");
        const sketch = idea("s", "project", ["riff"]);
        expect(ideaMatchesTagFilter(riff, [])).toBe(true);
        expect(ideaMatchesTagFilter(riff, ["riff"])).toBe(true);
        expect(ideaMatchesTagFilter(riff, ["verse"])).toBe(false);
        expect(ideaMatchesTagFilter(bare, [UNTAGGED_FILTER_KEY])).toBe(true);
        expect(ideaMatchesTagFilter(bare, ["riff"])).toBe(false);
        expect(ideaMatchesTagFilter(sketch, ["riff"])).toBe(false);
    });

    it("lists tags in use, most used first", () => {
        const ideas = [idea("a", "clip", ["riff"]), idea("b", "clip", ["verse", "riff"]), idea("c", "clip", ["chorus"])];
        expect(collectClipIdeaTagsInUse(ideas)).toEqual(["riff", "chorus", "verse"]);
    });
});
