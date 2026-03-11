import { ClipVersion } from "./types";

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

export type EvolutionClipEntry = {
  kind: "evolution";
  clip: ClipVersion;
  depth: number;
  childCount: number;
  hasChildren: boolean;
  branchMask: boolean[];
  isLastSibling: boolean;
};

function byCreatedAtAsc(a: ClipVersion, b: ClipVersion) {
  if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
  return a.id.localeCompare(b.id);
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

  return clips.sort(byCreatedAtAsc);
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

export function buildTimelineEntries(
  clips: ClipVersion[],
  options: {
    metric?: SongTimelineSortMetric;
    direction?: SongTimelineSortDirection;
    mainTakesOnly?: boolean;
  } = {}
): TimelineClipEntry[] {
  const graph = buildClipGraph(clips);
  const metric = options.metric ?? "created";
  const direction = options.direction ?? "desc";
  const sourceClips = options.mainTakesOnly
    ? buildClipLineages(clips).map((lineage) => lineage.latestClip)
    : [...clips];

  return sourceClips
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

export function buildEvolutionEntries(
  clips: ClipVersion[],
  collapsedClipIds: Set<string> = new Set()
): EvolutionClipEntry[] {
  const graph = buildClipGraph(clips);
  const entries: EvolutionClipEntry[] = [];

  const walk = (nodes: ClipVersion[], depth: number, branchMask: boolean[]) => {
    nodes.forEach((clip, index) => {
      const children = graph.childrenByParentId.get(clip.id) ?? [];
      const isLastSibling = index === nodes.length - 1;
      const hasChildren = children.length > 0;

      entries.push({
        kind: "evolution",
        clip,
        depth,
        childCount: children.length,
        hasChildren,
        branchMask,
        isLastSibling,
      });

      if (hasChildren && !collapsedClipIds.has(clip.id)) {
        walk(children, depth + 1, [...branchMask, !isLastSibling]);
      }
    });
  };

  walk(graph.roots, 0, []);

  return entries;
}
