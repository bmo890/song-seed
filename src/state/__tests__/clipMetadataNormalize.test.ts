jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

import { normalizeWorkspaces } from "../dataSlice";
import type { Workspace } from "../../types";

/**
 * The per-clip creative fields (sections, markers, edit regions, analysis, tags) reach the
 * store from OUTSIDE the app too — a received `.songnook` archive is authored on someone
 * else's device. The normalizer must keep well-formed entries and drop the rest, without
 * touching data the app wrote itself.
 */

function workspaceWithClip(clip: Record<string, unknown>): Workspace {
    return {
        id: "ws",
        title: "WS",
        collections: [
            { id: "col", title: "C", workspaceId: "ws", createdAt: 0, updatedAt: 0, ideasListState: { hiddenIdeaIds: [], hiddenDays: [] } },
        ],
        ideas: [
            {
                id: "idea",
                title: "Idea",
                notes: "",
                status: "seed",
                completionPct: 0,
                kind: "project",
                collectionId: "col",
                createdAt: 0,
                lastActivityAt: 0,
                clips: [
                    { id: "clip", title: "Clip", notes: "", createdAt: 0, isPrimary: true, ...clip } as never,
                ],
            },
        ],
    };
}

function normalizedClip(clip: Record<string, unknown>) {
    return normalizeWorkspaces([workspaceWithClip(clip)])[0].ideas[0].clips[0];
}

describe("normalizeClip — creative metadata guards", () => {
    it("keeps well-formed sections, markers, regions, analysis and tags untouched", () => {
        const clip = normalizedClip({
            sections: [{ id: "s1", startMs: 0, endMs: 4000, label: "Intro", kind: "intro" }],
            practiceMarkers: [{ id: "m1", label: "Solo", atMs: 8000, note: "try IV" }],
            editRegions: [{ id: "e1", startMs: 1000, endMs: 2000, type: "remove" }],
            analysis: { schemaVersion: 2, analyzedAt: 5, key: null, mode: null, keyConfidence: 0, bpm: 120, bpmSteadiness: 0.9, bpmConfidence: 0.8, confirmed: true },
            tags: ["verse", "keeper"],
            lyricsVersionId: "lv-1",
        });
        expect(clip.sections).toEqual([{ id: "s1", startMs: 0, endMs: 4000, label: "Intro", kind: "intro" }]);
        expect(clip.practiceMarkers).toEqual([{ id: "m1", label: "Solo", atMs: 8000, note: "try IV" }]);
        expect(clip.editRegions).toEqual([{ id: "e1", startMs: 1000, endMs: 2000, type: "remove" }]);
        expect(clip.analysis).toMatchObject({ schemaVersion: 2, bpm: 120, bpmConfidence: 0.8, confirmed: true });
        expect(clip.tags).toEqual(["verse", "keeper"]);
        expect(clip.lyricsVersionId).toBe("lv-1");
    });

    it("drops malformed entries and unknown shapes instead of storing them", () => {
        const clip = normalizedClip({
            sections: [
                { id: "ok", startMs: 10, endMs: 20, label: "A", kind: "verse" },
                { id: "weird-kind", startMs: 30, endMs: 40, label: "B", kind: "banana" },
                { startMs: 50, endMs: 60, label: "no id", kind: "verse" },
                { id: "nan", startMs: "soon", endMs: 60, label: "x", kind: "verse" },
                "not an object",
                null,
            ],
            practiceMarkers: [{ id: "m", atMs: "later" }, { id: "ok", atMs: 5 }, 42],
            editRegions: [{ id: "e", startMs: 0, endMs: 10, type: "explode" }, { id: "ok", startMs: 0, endMs: 10, type: "keep" }],
            analysis: { key: "C" },
            tags: ["a", 7, "", "a", null],
            lyricsVersionId: "",
        });
        expect(clip.sections?.map((s) => [s.id, s.kind])).toEqual([["ok", "verse"], ["weird-kind", "custom"]]);
        expect(clip.practiceMarkers).toEqual([{ id: "ok", label: "", atMs: 5 }]);
        expect(clip.editRegions).toEqual([{ id: "ok", startMs: 0, endMs: 10, type: "keep" }]);
        expect(clip.analysis).toBeUndefined();
        expect(clip.tags).toEqual(["a"]);
        expect(clip.lyricsVersionId).toBeUndefined();
    });

    it("turns non-arrays and empty lists into absent fields", () => {
        const clip = normalizedClip({ sections: "x", practiceMarkers: {}, editRegions: [], analysis: null, tags: [] });
        expect(clip.sections).toBeUndefined();
        expect(clip.practiceMarkers).toBeUndefined();
        expect(clip.editRegions).toBeUndefined();
        expect(clip.analysis).toBeUndefined();
        expect(clip.tags).toBeUndefined();
    });

    it("keeps a legacy section without endMs so the player can backfill it", () => {
        const clip = normalizedClip({ sections: [{ id: "legacy", startMs: 100, label: "Old", kind: "chorus" }] });
        expect(clip.sections?.[0]).toMatchObject({ id: "legacy", startMs: 100, kind: "chorus" });
        expect(clip.sections?.[0].endMs).toBeUndefined();
    });
});
