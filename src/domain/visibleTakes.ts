import type { ClipGroup } from "../types";
import type { ClipLineage } from "./clipGraph";

/**
 * The takes a sketch page shows right now, for "All" in its selection (12b B-M3).
 * "All" used to select every take in the sketch, those a filter hid and those
 * folded in a group or behind "N older" included, and Delete then removed them.
 * `lineages` are the filtered ones the page lists.
 *
 *   timeline   every take of every listed lineage is a row
 *   evolution  a lineage shows its newest take; its older ones only when its thread
 *              is open; nothing of it while its group is folded
 */
export function visibleTakeIds(
    lineages: ClipLineage[],
    view: {
        mode: "timeline" | "evolution";
        expandedLineageIds: Record<string, boolean>;
        groups?: ClipGroup[];
        groupAssignments?: Record<string, string>;
    }
): string[] {
    if (view.mode === "timeline") return lineages.flatMap((lineage) => lineage.clipsOldestToNewest.map((clip) => clip.id));
    const collapsedGroups = new Set((view.groups ?? []).filter((group) => group.collapsed).map((group) => group.id));
    const ids: string[] = [];
    for (const lineage of lineages) {
        const groupId = view.groupAssignments?.[lineage.root.id];
        if (groupId && collapsedGroups.has(groupId)) continue;
        if (view.expandedLineageIds[lineage.root.id]) {
            ids.push(...lineage.clipsNewestToOldest.map((clip) => clip.id));
        } else {
            ids.push(lineage.latestClip.id);
        }
    }
    return ids;
}

// What the open sketch page lists, published by its list and read by "All".
let published: string[] | null = null;

export function publishVisibleTakeIds(ids: string[] | null): void {
    published = ids;
}

export function readVisibleTakeIds(): string[] | null {
    return published;
}
