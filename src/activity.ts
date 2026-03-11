import { getIdeaCreatedAt, getIdeaUpdatedAt } from "./ideaSort";
import { getCollectionById, getCollectionScopeIds } from "./utils";
import type { ActivityEvent, ActivityMetric, ActivitySource, SongIdea, Workspace } from "./types";

export type ActivityMetricFilter = ActivityMetric | "both";

export type ActivityDayEntry = {
  ideaId: string;
  ideaKind: "song" | "clip";
  ideaTitle: string;
  workspaceId: string;
  collectionId: string;
  createdCount: number;
  updatedCount: number;
  latestAt: number;
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

export function startOfActivityWeek(ts: number) {
  const date = new Date(startOfActivityDay(ts));
  date.setDate(date.getDate() - date.getDay());
  return date.getTime();
}

export function endOfActivityWeek(ts: number) {
  return startOfActivityWeek(ts) + 6 * DAY_MS;
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
  return [...persistedEvents, ...buildSyntheticActivityEvents(workspaces, persistedEvents)].sort(
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
      existing.latestAt = Math.max(existing.latestAt, event.at);
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
