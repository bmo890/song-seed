import {
  ActivityDayEntry,
  ActivityMetricFilter,
  formatActivityDayLabel,
  getActivityCollectionPath,
  startOfActivityDay,
} from "../../domain/activity";
import { IdeaStatus, SongIdea, Workspace } from "../../types";
import { colors } from "../../design/tokens";

export const CELL_SIZE = 15;
export const CELL_GAP = 4;
export const CELL_STRIDE = CELL_SIZE + CELL_GAP;

export type ActivityItemResult = ActivityDayEntry & {
  ideaStatus: IdeaStatus;
  completionPct: number;
  activityLabel: string;
  timeLabel: string;
  contextLabel: string;
};

export function getActivityCellBackground(count: number, maxCount: number, inYear: boolean) {
  if (!inYear) return "#ddd8d3";
  if (count <= 0) return "#e4deda";
  if (maxCount <= 1) return "#c9968a";

  const ratio = count / maxCount;
  if (ratio >= 0.8) return "#5c2d1e";
  if (ratio >= 0.55) return colors.primaryDeep;
  if (ratio >= 0.3) return "#b07060";
  return "#c9968a";
}

export function formatActivityCardMatch(
  createdCount: number,
  updatedCount: number,
  latestMetric: "created" | "updated"
) {
  if (createdCount > 0 && updatedCount > 0) {
    return latestMetric === "updated" ? "Updated" : "Created";
  }
  if (createdCount > 0) return "Created";
  if (updatedCount > 0) return "Updated";
  return "";
}

function formatActivityDateLabel(ts: number, includeYear = true) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

export function formatActivityTimeLabel(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMetricSuffix(metric: ActivityMetricFilter) {
  if (metric === "both") return "";
  return ` • ${metric === "created" ? "Created" : "Updated"}`;
}

export function formatSelectedRangeLabel(
  startTs: number,
  endTs: number,
  metric: ActivityMetricFilter
) {
  const normalizedStart = startOfActivityDay(Math.min(startTs, endTs));
  const normalizedEnd = startOfActivityDay(Math.max(startTs, endTs));
  const base =
    normalizedStart === normalizedEnd
      ? formatActivityDayLabel(normalizedStart)
      : `${formatActivityDateLabel(normalizedStart)} – ${formatActivityDateLabel(normalizedEnd)}`;

  return `${base}${formatMetricSuffix(metric)}`;
}

export function buildActivityItemResults(
  entries: ActivityDayEntry[],
  workspaces: Workspace[]
): ActivityItemResult[] {
  // Index ideas by workspace:idea once so this is O(entries), not O(entries × ideas).
  const ideaByKey = new Map<string, SongIdea>();
  for (const workspace of workspaces) {
    for (const idea of workspace.ideas) {
      ideaByKey.set(`${workspace.id}:${idea.id}`, idea);
    }
  }

  return entries.map((entry) => {
    const idea = ideaByKey.get(`${entry.workspaceId}:${entry.ideaId}`);

    return {
      ...entry,
      ideaStatus: idea?.status ?? (entry.ideaKind === "song" ? "seed" : "clip"),
      completionPct: idea?.completionPct ?? 0,
      activityLabel: formatActivityCardMatch(
        entry.createdCount,
        entry.updatedCount,
        entry.latestMetric
      ),
      timeLabel: `${formatActivityDateLabel(entry.latestAt)} • ${formatActivityTimeLabel(entry.latestAt)}`,
      contextLabel: getActivityCollectionPath(workspaces, entry.workspaceId, entry.collectionId),
    };
  });
}
