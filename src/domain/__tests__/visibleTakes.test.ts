import { buildClipLineages, filterClipLineagesByVisibleClipIds } from "../clipGraph";
import { visibleTakeIds } from "../visibleTakes";
import type { ClipVersion } from "../../types";

/**
 * 12b B-M3: "All" in a sketch's selection selected every take, those hidden by a
 * filter, a folded group or a folded "N older" included, and Delete removed them.
 */

const clip = (id: string, createdAt: number, parentClipId?: string, tags: string[] = []): ClipVersion =>
    ({ id, title: id, notes: "", createdAt, isPrimary: id === "a1", parentClipId, tags }) as ClipVersion;

const clips = [
    clip("a1", 1, undefined, ["chorus"]),
    clip("a2", 2, "a1", ["chorus"]),
    clip("a3", 3, "a2", ["chorus"]),
    clip("b1", 4),
    clip("c1", 5, undefined, ["chorus"]),
];
const all = buildClipLineages(clips);

it("evolution view: a folded thread offers only its newest take", () => {
    expect(visibleTakeIds(all, { mode: "evolution", expandedLineageIds: {} }).sort()).toEqual(["a3", "b1", "c1"]);
    expect(visibleTakeIds(all, { mode: "evolution", expandedLineageIds: { a1: true } }).sort()).toEqual(["a1", "a2", "a3", "b1", "c1"]);
});

it("a folded group's takes are not offered", () => {
    const ids = visibleTakeIds(all, {
        mode: "evolution",
        expandedLineageIds: {},
        groups: [{ id: "g", name: "Old", collapsed: true, createdAt: 0, updatedAt: 0 }],
        groupAssignments: { c1: "g" },
    });
    expect(ids.sort()).toEqual(["a3", "b1"]);
});

it("a filter's hidden takes are not offered", () => {
    const chorus = filterClipLineagesByVisibleClipIds(all, new Set(clips.filter((c) => c.tags?.includes("chorus")).map((c) => c.id)));
    expect(visibleTakeIds(chorus, { mode: "timeline", expandedLineageIds: {} })).not.toContain("b1");
});
