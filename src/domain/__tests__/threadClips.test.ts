import { buildDraftThreadRenames, threadClipsOldestToNewest } from "../clipLineageTitles";
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

describe("threadClipsOldestToNewest (2026-10-03: several clips → one thread)", () => {
    it("chains oldest → newest: v1 is the root, the newest is the head and primary", () => {
        const threaded = threadClipsOldestToNewest([clip("b", 200), clip("c", 300), clip("a", 100)], "Porch");
        expect(threaded.map((c) => c.id)).toEqual(["a", "b", "c"]);
        expect(threaded.map((c) => c.parentClipId)).toEqual([undefined, "a", "b"]);
        expect(threaded.map((c) => c.isPrimary)).toEqual([false, false, true]);
        expect(threaded.map((c) => c.title)).toEqual(["Porch", "Porch v2", "Porch v3"]);

        const lineages = buildClipLineages(threaded);
        expect(lineages).toHaveLength(1);
        expect(lineages[0].clipsOldestToNewest.map((c) => c.id)).toEqual(["a", "b", "c"]);
        expect(lineages[0].latestClip.id).toBe("c");
    });

    it("keeps the order when every clip shares a createdAt (one import batch)", () => {
        const threaded = threadClipsOldestToNewest([clip("a", 100), clip("b", 100), clip("c", 100)], "Porch");
        const lineages = buildClipLineages(threaded);
        expect(lineages).toHaveLength(1);
        expect(lineages[0].clipsOldestToNewest.map((c) => c.id)).toEqual(["a", "b", "c"]);
        expect(lineages[0].root.id).toBe("a");
        expect(threaded.find((c) => c.isPrimary)?.id).toBe("c");
        expect(buildDraftThreadRenames(threaded, "Evening").get("c")).toBe("Evening v3");
    });

    it("leaves a single clip's title alone", () => {
        const [only] = threadClipsOldestToNewest([clip("a", 100, "Riff")], "Porch");
        expect(only.title).toBe("Riff");
        expect(only.isPrimary).toBe(true);
        expect(only.parentClipId).toBeUndefined();
    });
});

describe("buildDraftThreadRenames", () => {
    it("retitles a thread after the sketch's name, leaving lone takes alone", () => {
        const threaded = threadClipsOldestToNewest([clip("a", 100), clip("b", 200)], "Idea 3");
        const lone = clip("z", 300, "Bridge idea");
        const renames = buildDraftThreadRenames([...threaded, lone], "Evening Porch");
        expect(renames.get("a")).toBe("Evening Porch");
        expect(renames.get("b")).toBe("Evening Porch v2");
        expect(renames.has("z")).toBe(false);
    });
});
