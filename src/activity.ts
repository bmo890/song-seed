import { getIdeaCreatedAt, getIdeaUpdatedAt } from "./ideaSort";
import { getCollectionById, getCollectionScopeIds } from "./utils";
import type { ActivityEvent, ActivityMetric, ActivitySource, SongIdea, Workspace } from "./types";

export type ActivityMetricFilter = ActivityMetric | "both";
export type ActivityRegionKind = "day" | "week" | "month";

export type ActivityDateRegion = {
  kind: ActivityRegionKind;
  anchorTs: number;
  startTs: number;
  endTs: number;
};

export type ActivityDayEntry = {
  ideaId: string;
  ideaKind: "song" | "clip";
  ideaTitle: string;
  workspaceId: string;
  collectionId: string;
  createdCount: number;
  updatedCount: number;
  latestAt: number;
  latestMetric: ActivityMetric;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const HISTORY_SEED_SOURCE: ActivitySource = "history-seed";

function getActivityIdeaKind(idea: SongIdea): "song" | "clip" {
  return idea.kind === "project" ? "song" : "clip";
}

export function startOfActivityDay(ts: number) {
  const date = new Date(ts);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function endOfActivityDay(ts: number) {
  return startOfActivityDay(ts) + DAY_MS - 1;
}

export function startOfActivityWeek(ts: number) {
  const date = new Date(startOfActivityDay(ts));
  date.setDate(date.getDate() - date.getDay());
  return date.getTime();
}

export function endOfActivityWeek(ts: number) {
  return startOfActivityWeek(ts) + 6 * DAY_MS;
}

export function startOfActivityMonth(ts: number) {
  const date = new Date(startOfActivityDay(ts));
  date.setDate(1);
  return date.getTime();
}

export function endOfActivityMonth(ts: number) {
  const date = new Date(startOfActivityMonth(ts));
  date.setMonth(date.getMonth() + 1, 0);
  return startOfActivityDay(date.getTime());
}

export function buildActivityDateRegion(kind: ActivityRegionKind, anchorTs: number): ActivityDateRegion {
  const normalizedAnchor = startOfActivityDay(anchorTs);

  if (kind === "day") {
    return {
      kind,
      anchorTs: normalizedAnchor,
      startTs: normalizedAnchor,
      endTs: normalizedAnchor,
    };
  }

  if (kind === "week") {
    return {
      kind,
      anchorTs: normalizedAnchor,
      startTs: startOfActivityWeek(normalizedAnchor),
      endTs: endOfActivityWeek(normalizedAnchor),
    };
  }

  return {
    kind,
    anchorTs: normalizedAnchor,
    startTs: startOfActivityMonth(normalizedAnchor),
    endTs: endOfActivityMonth(normalizedAnchor),
  };
}

function buildSyntheticEvent(
  workspaceId: string,
  idea: SongIdea,
  at: number,
  metric: ActivityMetric
): ActivityEvent {
  return {
    id: `${HISTORY_SEED_SOURCE}:${workspaceId}:${idea.id}:${metric}`,
    at,
    workspaceId,
    collectionId: idea.collectionId,
    ideaId: idea.id,
    ideaKind: getActivityIdeaKind(idea),
    ideaTitle: idea.title,
    clipId: null,
    metric,
    source: HISTORY_SEED_SOURCE,
  };
}

function buildActivityValidityMaps(workspaces: Workspace[]) {
  const workspaceIds = new Set<string>();
  const collectionIdsByWorkspace = new Map<string, Set<string>>();
  const ideaIdsByWorkspace = new Map<string, Set<string>>();

  for (const workspace of workspaces) {
    workspaceIds.add(workspace.id);
    collectionIdsByWorkspace.set(
      workspace.id,
      new Set(workspace.collections.map((collection) => collection.id))
    );
    ideaIdsByWorkspace.set(
      workspace.id,
      new Set(workspace.ideas.map((idea) => idea.id))
    );
  }

  return { workspaceIds, collectionIdsByWorkspace, ideaIdsByWorkspace };
}

export function filterOrphanedActivityEvents(
  workspaces: Workspace[],
  events: ActivityEvent[]
) {
  const { workspaceIds, collectionIdsByWorkspace, ideaIdsByWorkspace } = buildActivityValidityMaps(workspaces);

  return events.filter((event) => {
    if (!workspaceIds.has(event.workspaceId)) return false;
    const collectionIds = collectionIdsByWorkspace.get(event.workspaceId);
    if (!collectionIds?.has(event.collectionId)) return false;
    const ideaIds = ideaIdsByWorkspace.get(event.workspaceId);
    if (!ideaIds?.has(event.ideaId)) return false;
    return true;
  });
}

export function buildSyntheticActivityEvents(
  workspaces: Workspace[],
  persistedEvents: ActivityEvent[]
) {
  const existingKeys = new Set(
    persistedEvents.map((event) => `${event.workspaceId}:${event.ideaId}:${event.metric}`)
  );
  const synthetic: ActivityEvent[] = [];

  for (const workspace of workspaces) {
    for (const idea of workspace.ideas) {
      const createdAt = getIdeaCreatedAt(idea);
      const createdKey = `${workspace.id}:${idea.id}:created`;
      if (!existingKeys.has(createdKey)) {
        synthetic.push(buildSyntheticEvent(workspace.id, idea, createdAt, "created"));
      }

      if (idea.kind !== "project") continue;
      const updatedAt = getIdeaUpdatedAt(idea);
      const updatedKey = `${workspace.id}:${idea.id}:updated`;
      if (updatedAt > createdAt && !existingKeys.has(updatedKey)) {
        synthetic.push(buildSyntheticEvent(workspace.id, idea, updatedAt, "updated"));
      }
    }
  }

  return synthetic;
}

export function getActivityEventsWithHistory(
  workspaces: Workspace[],
  persistedEvents: ActivityEvent[]
) {
  const persistedLiveEvents = filterOrphanedActivityEvents(workspaces, persistedEvents);

  return [...persistedLiveEvents, ...buildSyntheticActivityEvents(workspaces, persistedLiveEvents)].sort(
    (a, b) => b.at - a.at
  );
}

export function filterActivityEvents(
  events: ActivityEvent[],
  workspaces: Workspace[],
  {
    workspaceId,
    collectionId,
    metric,
    year,
  }: {
    workspaceId?: string | null;
    collectionId?: string | null;
    metric: ActivityMetricFilter;
    year: number;
  }
) {
  const workspace = workspaceId
    ? workspaces.find((candidate) => candidate.id === workspaceId) ?? null
    : null;
  const collectionScopeIds =
    workspace && collectionId ? getCollectionScopeIds(workspace, collectionId) : null;
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();

  return events.filter((event) => {
    if (event.at < start || event.at >= end) return false;
    if (workspaceId && event.workspaceId !== workspaceId) return false;
    if (collectionScopeIds && !collectionScopeIds.has(event.collectionId)) return false;
    if (metric !== "both" && event.metric !== metric) return false;
    return true;
  });
}

export function buildActivityCountsByDay(events: ActivityEvent[]) {
  const counts = new Map<number, number>();
  for (const event of events) {
    const dayTs = startOfActivityDay(event.at);
    counts.set(dayTs, (counts.get(dayTs) ?? 0) + 1);
  }
  return counts;
}

export function buildActivityDayEntries(events: ActivityEvent[], dayTs: number) {
  return buildActivityRangeEntries(events, dayTs, dayTs);
}

export function buildActivityRangeEntries(
  events: ActivityEvent[],
  startDayTs: number,
  endDayTs: number
) {
  const start = startOfActivityDay(Math.min(startDayTs, endDayTs));
  const end = startOfActivityDay(Math.max(startDayTs, endDayTs));
  const grouped = new Map<string, ActivityDayEntry>();

  for (const event of events) {
    const eventDay = startOfActivityDay(event.at);
    if (eventDay < start || eventDay > end) continue;
    const key = `${event.workspaceId}:${event.ideaId}`;
    const existing = grouped.get(key);
    if (existing) {
      if (event.at > existing.latestAt) {
        existing.latestAt = event.at;
        existing.latestMetric = event.metric;
      }
      if (event.metric === "created") existing.createdCount += 1;
      if (event.metric === "updated") existing.updatedCount += 1;
      if (event.ideaTitle.length > 0) existing.ideaTitle = event.ideaTitle;
      continue;
    }
    grouped.set(key, {
      ideaId: event.ideaId,
      ideaKind: event.ideaKind,
      ideaTitle: event.ideaTitle,
      workspaceId: event.workspaceId,
      collectionId: event.collectionId,
      createdCount: event.metric === "created" ? 1 : 0,
      updatedCount: event.metric === "updated" ? 1 : 0,
      latestAt: event.at,
      latestMetric: event.metric,
    });
  }

  return [...grouped.values()].sort((a, b) => b.latestAt - a.latestAt);
}

export function buildActivityHeatmapMatrix(year: number) {
  const start = startOfActivityWeek(new Date(year, 0, 1).getTime());
  const end = endOfActivityWeek(new Date(year, 11, 31).getTime());
  const weeks: number[][] = [];

  for (let cursor = start; cursor <= end; cursor += WEEK_MS) {
    const week: number[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      week.push(cursor + offset * DAY_MS);
    }
    weeks.push(week);
  }

  const monthMarkers = Array.from({ length: 12 }, (_, month) => {
    const monthStart = startOfActivityDay(new Date(year, month, 1).getTime());
    const weekIndex = Math.max(0, Math.floor((startOfActivityWeek(monthStart) - start) / WEEK_MS));
    return {
      month,
      label: new Date(year, month, 1).toLocaleDateString("en-US", { month: "short" }),
      weekIndex,
    };
  }).filter((marker, index, items) => index === 0 || marker.weekIndex !== items[index - 1].weekIndex);

  return { weeks, monthMarkers };
}

export function formatActivityDayLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getActivityCollectionPath(
  workspaces: Workspace[],
  workspaceId: string,
  collectionId: string
) {
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId) ?? null;
  if (!workspace) return "";
  const collection = getCollectionById(workspace, collectionId);
  if (!collection) return workspace.title;

  const path: string[] = [collection.title];
  let currentParentId = collection.parentCollectionId ?? null;
  while (currentParentId) {
    const parent = getCollectionById(workspace, currentParentId);
    if (!parent) break;
    path.unshift(parent.title);
    currentParentId = parent.parentCollectionId ?? null;
  }
  return `${workspace.title} / ${path.join(" / ")}`;
}
