import { ClipGroup, ClipVersion } from "./types";
import { getDateBucket } from "./dateBuckets";

export type SongTimelineSortMetric = "created" | "title" | "length";
export type SongTimelineSortDirection = "asc" | "desc";

export type ClipGraph = {
  clipsById: Map<string, ClipVersion>;
  childrenByParentId: Map<string | null, ClipVersion[]>;
  roots: ClipVersion[];
};

export type ClipLineage = {
  root: ClipVersion;
  clipsOldestToNewest: ClipVersion[];
  clipsNewestToOldest: ClipVersion[];
  latestClip: ClipVersion;
};

export type TimelineClipEntry = {
  kind: "timeline";
  clip: ClipVersion;
  depth: number;
  childCount: number;
  hasChildren: boolean;
};

export type EvolutionListClipEntry = {
  kind: "evolution";
  clip: ClipVersion;
  lineageRootId: string;
  compactPreview: boolean;
  indented: boolean;
  continuesThreadBelow: boolean;
  hasOlderVersions: boolean;
};

export type TimelineListRow =
  | { kind: "day-divider"; label: string; dayStartTs: number }
  | { kind: "clip"; entry: TimelineClipEntry };

export type EvolutionListRow =
  | {
      kind: "group";
      groupId: string;
      name: string;
      collapsed: boolean;
      lineageCount: number;
      lastUpdatedAt: number | null;
    }
  | { kind: "clip"; entry: EvolutionListClipEntry }
  | { kind: "more"; lineageRootId: string; hiddenCount: number; expanded: boolean };

function byCreatedAtAsc(a: ClipVersion, b: ClipVersion) {
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id.localeCompare(b.id);
}

function byLineageAssignedAtAsc(a: ClipVersion, b: ClipVersion) {
  const aOrder = a.parentAssignedAt ?? a.createdAt;
  const bOrder = b.parentAssignedAt ?? b.createdAt;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return byCreatedAtAsc(a, b);
}

function compareClipsForTimeline(
  a: ClipVersion,
  b: ClipVersion,
  metric: SongTimelineSortMetric
) {
  if (metric === "title") {
    const titleOrder = a.title.localeCompare(b.title, undefined, {
      sensitivity: "base",
      numeric: true,
    });
    if (titleOrder !== 0) return titleOrder;
  } else if (metric === "length") {
    const lengthOrder = (a.durationMs ?? 0) - (b.durationMs ?? 0);
    if (lengthOrder !== 0) return lengthOrder;
  } else if (a.createdAt !== b.createdAt) {
    return a.createdAt - b.createdAt;
  }

  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id.localeCompare(b.id);
}

export function buildClipGraph(clips: ClipVersion[]): ClipGraph {
  const clipsById = new Map<string, ClipVersion>();
  const childrenByParentId = new Map<string | null, ClipVersion[]>();

  clips.forEach((clip) => {
    clipsById.set(clip.id, clip);
  });

  clips.forEach((clip) => {
    const rawParentId = clip.parentClipId ?? null;
    const parentId = rawParentId && clipsById.has(rawParentId) ? rawParentId : null;
    const current = childrenByParentId.get(parentId) ?? [];
    current.push(clip);
    childrenByParentId.set(parentId, current);
  });

  childrenByParentId.forEach((children, parentId) => {
    childrenByParentId.set(parentId, [...children].sort(byCreatedAtAsc));
  });

  return {
    clipsById,
    childrenByParentId,
    roots: childrenByParentId.get(null) ?? [],
  };
}

function collectLineageClips(graph: ClipGraph, root: ClipVersion) {
  const clips: ClipVersion[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) continue;
    clips.push(next);

    const children = graph.childrenByParentId.get(next.id) ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]);
    }
  }

  return clips.sort(byLineageAssignedAtAsc);
}

export function buildClipLineages(clips: ClipVersion[]): ClipLineage[] {
  const graph = buildClipGraph(clips);

  return graph.roots
    .map((root) => {
      const clipsOldestToNewest = collectLineageClips(graph, root);
      return {
        root,
        clipsOldestToNewest,
        clipsNewestToOldest: [...clipsOldestToNewest].reverse(),
        latestClip: clipsOldestToNewest[clipsOldestToNewest.length - 1],
      };
    })
    .sort((a, b) => byCreatedAtAsc(a.root, b.root));
}

export function filterClipLineagesByVisibleClipIds(
  lineages: ClipLineage[],
  visibleClipIds: Set<string>
): ClipLineage[] {
  return lineages
    .map((lineage) => {
      const clipsOldestToNewest = lineage.clipsOldestToNewest.filter((clip) =>
        visibleClipIds.has(clip.id)
      );
      if (clipsOldestToNewest.length === 0) return null;
      return {
        root: lineage.root,
        clipsOldestToNewest,
        clipsNewestToOldest: [...clipsOldestToNewest].reverse(),
        latestClip: clipsOldestToNewest[clipsOldestToNewest.length - 1]!,
      };
    })
    .filter((lineage): lineage is ClipLineage => lineage != null);
}

export function findLineageForClip(clips: ClipVersion[], clipId: string): ClipLineage | null {
  const lineages = buildClipLineages(clips);
  return lineages.find((lineage) =>
    lineage.clipsOldestToNewest.some((clip) => clip.id === clipId)
  ) ?? null;
}

export function getLineageRootId(clips: ClipVersion[], clipId: string): string | null {
  const lineage = findLineageForClip(clips, clipId);
  return lineage?.root.id ?? null;
}

export function buildTimelineEntries(
  clips: ClipVersion[],
  options: {
    metric?: SongTimelineSortMetric;
    direction?: SongTimelineSortDirection;
    mainTakesOnly?: boolean;
  } = {}
): TimelineClipEntry[] {
  return buildTimelineEntriesFromLineages(buildClipLineages(clips), options);
}

export function buildTimelineEntriesFromLineages(
  lineages: ClipLineage[],
  options: {
    metric?: SongTimelineSortMetric;
    direction?: SongTimelineSortDirection;
    mainTakesOnly?: boolean;
  } = {}
): TimelineClipEntry[] {
  const visibleClips = lineages.flatMap((lineage) => lineage.clipsOldestToNewest);
  const sourceClips = options.mainTakesOnly
    ? lineages.map((lineage) => lineage.latestClip)
    : visibleClips;
  const graph = buildClipGraph(visibleClips);
  const metric = options.metric ?? "created";
  const direction = options.direction ?? "desc";

  return [...sourceClips]
    .sort((a, b) => {
      const base = compareClipsForTimeline(a, b, metric);
      return direction === "desc" ? -base : base;
    })
    .map((clip) => {
      const childCount = (graph.childrenByParentId.get(clip.id) ?? []).length;
      return {
        kind: "timeline" as const,
        clip,
        depth: 0,
        childCount,
        hasChildren: childCount > 0,
      };
    });
}

export function buildTimelineListRows(
  clips: ClipVersion[],
  options: {
    metric?: SongTimelineSortMetric;
    direction?: SongTimelineSortDirection;
    mainTakesOnly?: boolean;
  } = {}
): TimelineListRow[] {
  return buildTimelineListRowsFromLineages(buildClipLineages(clips), options);
}

export function buildTimelineListRowsFromLineages(
  lineages: ClipLineage[],
  options: {
    metric?: SongTimelineSortMetric;
    direction?: SongTimelineSortDirection;
    mainTakesOnly?: boolean;
  } = {}
): TimelineListRow[] {
  const rows: TimelineListRow[] = [];
  let lastBucketKey: string | null = null;

  buildTimelineEntriesFromLineages(lineages, options).forEach((entry) => {
    if ((options.metric ?? "created") === "created") {
      const bucket = getDateBucket(entry.clip.createdAt);
      if (bucket.key !== lastBucketKey) {
        rows.push({
          kind: "day-divider",
          label: bucket.label,
          dayStartTs: bucket.startTs,
        });
        lastBucketKey = bucket.key;
      }
    }

    rows.push({ kind: "clip", entry });
  });

  return rows;
}

export function buildEvolutionListRows(
  clips: ClipVersion[],
  expandedLineageIds: Record<string, boolean>,
  direction: SongTimelineSortDirection = "desc",
  groups: ClipGroup[] = [],
  groupAssignments: Record<string, string> = {}
): EvolutionListRow[] {
  return buildEvolutionListRowsFromLineages(
    buildClipLineages(clips),
    expandedLineageIds,
    direction,
    groups,
    groupAssignments
  );
}

export function buildEvolutionListRowsFromLineages(
  lineages: ClipLineage[],
  expandedLineageIds: Record<string, boolean>,
  direction: SongTimelineSortDirection = "desc",
  groups: ClipGroup[] = [],
  groupAssignments: Record<string, string> = {}
): EvolutionListRow[] {
  const rows: EvolutionListRow[] = [];
  const dir = direction === "asc" ? -1 : 1;

  const sortedLineages = lineages
    .slice()
    .sort((a, b) => {
      if (a.latestClip.createdAt !== b.latestClip.createdAt) {
        return (b.latestClip.createdAt - a.latestClip.createdAt) * dir;
      }
      return b.latestClip.id.localeCompare(a.latestClip.id) * dir;
    });

  const groupIds = new Set(groups.map((group) => group.id));
  const lineagesByGroupId = new Map<string, ClipLineage[]>();
  const unassignedLineages: ClipLineage[] = [];

  sortedLineages.forEach((lineage) => {
    const groupId = groupAssignments[lineage.root.id];
    if (groupId && groupIds.has(groupId)) {
      const group = lineagesByGroupId.get(groupId) ?? [];
      group.push(lineage);
      lineagesByGroupId.set(groupId, group);
      return;
    }
    unassignedLineages.push(lineage);
  });

  const pushLineageRows = (lineage: ClipLineage) => {
      const newestClip = lineage.latestClip;
      const olderClips = lineage.clipsNewestToOldest.filter((clip) => clip.id !== newestClip.id);
      const isExpanded = !!expandedLineageIds[lineage.root.id];

      rows.push({
        kind: "clip",
        entry: {
          kind: "evolution",
          clip: newestClip,
          lineageRootId: lineage.root.id,
          compactPreview: false,
          indented: false,
          continuesThreadBelow: false,
          hasOlderVersions: olderClips.length > 0,
        },
      });

      if (olderClips.length === 0) return;

      rows.push({
        kind: "more",
        lineageRootId: lineage.root.id,
        hiddenCount: olderClips.length,
        expanded: isExpanded,
      });

      if (!isExpanded) return;

      olderClips.forEach((clip, index) => {
        rows.push({
          kind: "clip",
          entry: {
            kind: "evolution",
            clip,
            lineageRootId: lineage.root.id,
            compactPreview: true,
            indented: true,
            continuesThreadBelow: index < olderClips.length - 1,
            hasOlderVersions: false,
          },
        });
      });
  };

  unassignedLineages.forEach(pushLineageRows);

  groups.forEach((group) => {
    const lineages = lineagesByGroupId.get(group.id) ?? [];
    rows.push({
      kind: "group",
      groupId: group.id,
      name: group.name,
      collapsed: group.collapsed,
      lineageCount: lineages.length,
      lastUpdatedAt: lineages.reduce<number | null>((latestAt, lineage) => {
        const timestamp = lineage.latestClip.createdAt;
        return latestAt == null || timestamp > latestAt ? timestamp : latestAt;
      }, null),
    });

    if (group.collapsed) return;
    lineages.forEach(pushLineageRows);
  });

  return rows;
}
