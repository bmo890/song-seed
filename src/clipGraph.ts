import { ClipVersion } from "./types";

export type SongTimelineSortMetric = "created" | "title" | "length";
export type SongTimelineSortDirection = "asc" | "desc";

export type ClipGraph = {
  clipsById: Map<string, ClipVersion>;
  childrenByParentId: Map<string | null, ClipVersion[]>;
  roots: ClipVersion[];
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

function buildDepthMap(graph: ClipGraph) {
  const depthMap = new Map<string, number>();
  const visit = (clip: ClipVersion, depth: number) => {
    depthMap.set(clip.id, depth);
    const children = graph.childrenByParentId.get(clip.id) ?? [];
    children.forEach((child) => visit(child, depth + 1));
  };
  graph.roots.forEach((root) => visit(root, 0));
  return depthMap;
}

export function buildTimelineEntries(
  clips: ClipVersion[],
  options: {
    metric?: SongTimelineSortMetric;
    direction?: SongTimelineSortDirection;
  } = {}
): TimelineClipEntry[] {
  const graph = buildClipGraph(clips);
  const depthMap = buildDepthMap(graph);
  const metric = options.metric ?? "created";
  const direction = options.direction ?? "asc";

  return [...clips]
    .sort((a, b) => {
      const base = compareClipsForTimeline(a, b, metric);
      return direction === "desc" ? -base : base;
    })
    .map((clip) => {
      const childCount = (graph.childrenByParentId.get(clip.id) ?? []).length;
      return {
        kind: "timeline" as const,
        clip,
        depth: depthMap.get(clip.id) ?? 0,
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
