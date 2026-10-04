import { threadClipsOldestToNewest } from "../clipLineageTitles";
import { buildClipLineages } from "../clipGraph";
import type { ClipVersion } from "../../types";

const clip = (id: string, createdAt: number, title = id): ClipVersion => ({
    id,
    title,
    notes: "",
    createdAt,
    isPrimary: false,
    audioUri: `file:///${id}.m4a`,
    durationMs: 1000,
});

describe("threadClipsOldestToNewest (Combine into thread)", () => {
    it("chains oldest → newest: v1 is the root, the newest the head; titles untouched", () => {
        const threaded = threadClipsOldestToNewest([clip("b", 200, "Chorus B"), clip("c", 300), clip("a", 100)]);
        expect(threaded.map((c) => c.id)).toEqual(["a", "b", "c"]);
        expect(threaded.map((c) => c.parentClipId)).toEqual([undefined, "a", "b"]);
        expect(threaded.find((c) => c.id === "b")?.title).toBe("Chorus B");

        const lineages = buildClipLineages(threaded);
        expect(lineages).toHaveLength(1);
        expect(lineages[0].clipsOldestToNewest.map((c) => c.id)).toEqual(["a", "b", "c"]);
        expect(lineages[0].latestClip.id).toBe("c");
    });

    it("keeps the order when every clip shares a createdAt (one import batch)", () => {
        const threaded = threadClipsOldestToNewest([clip("a", 100), clip("b", 100), clip("c", 100)]);
        const lineages = buildClipLineages(threaded);
        expect(lineages).toHaveLength(1);
        expect(lineages[0].clipsOldestToNewest.map((c) => c.id)).toEqual(["a", "b", "c"]);
        expect(lineages[0].root.id).toBe("a");
    });
});
