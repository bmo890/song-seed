import {
  ActivityDateRegion,
  ActivityDayEntry,
  ActivityMetricFilter,
  buildActivityDateRegion,
  filterActivityEvents,
  formatActivityDayLabel,
  getActivityCollectionPath,
  startOfActivityDay,
} from "../../activity";
import { IdeaStatus, Workspace } from "../../types";

export const CELL_SIZE = 15;
export const CELL_GAP = 4;
export const CELL_STRIDE = CELL_SIZE + CELL_GAP;

export type ActivityDayWorkspaceGroup = {
  workspaceId: string;
  workspaceTitle: string;
  entries: ActivityDayEntry[];
};

export type ActivityItemResult = ActivityDayEntry & {
  ideaStatus: IdeaStatus;
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
  if (ratio >= 0.55) return "#824f3f";
  if (ratio >= 0.3) return "#b07060";
  return "#c9968a";
}

export function formatEntryMetrics(entry: ActivityDayEntry) {
  return formatActivityMatch(entry.createdCount, entry.updatedCount);
}

export function formatActivityMatch(createdCount: number, updatedCount: number) {
  const parts: string[] = [];
  if (createdCount > 0) {
    parts.push(createdCount > 1 ? `${createdCount} created` : "Created");
  }
  if (updatedCount > 0) {
    parts.push(updatedCount > 1 ? `${updatedCount} updated` : "Updated");
  }
  return parts.join(" • ");
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

export function formatMonthRangeLabel(year: number, month: number, metric: ActivityMetricFilter) {
  const region = buildActivityDateRegion("month", new Date(year, month, 1).getTime());
  return formatActivityRegionLabel(region, metric);
}

export function formatDayRangeLabel(ts: number, metric: ActivityMetricFilter) {
  return formatActivityRegionLabel(buildActivityDateRegion("day", ts), metric);
}

function formatActivityDateLabel(ts: number, includeYear = true) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

export function formatActivityListDayLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

export function formatActivityRegionLabel(region: ActivityDateRegion, metric: ActivityMetricFilter) {
  if (region.kind === "day") {
    return `${formatActivityDayLabel(region.startTs)}${formatMetricSuffix(metric)}`;
  }

  if (region.kind === "week") {
    const startLabel = formatActivityDateLabel(region.startTs, true);
    const endLabel = formatActivityDateLabel(region.endTs, region.startTs !== region.endTs);
    return `Week of ${startLabel} – ${endLabel}${formatMetricSuffix(metric)}`;
  }

  return `${new Date(region.startTs).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}${formatMetricSuffix(metric)}`;
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

export function getMonthEventCount(
  events: ReturnType<typeof filterActivityEvents>,
  year: number,
  month: number
) {
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 1).getTime();
  return events.filter((event) => event.at >= start && event.at < end).length;
}

export function buildActivityItemResults(
  entries: ActivityDayEntry[],
  workspaces: Workspace[]
): ActivityItemResult[] {
  return entries.map((entry) => {
    const workspace = workspaces.find((candidate) => candidate.id === entry.workspaceId);
    const idea = workspace?.ideas.find((candidate) => candidate.id === entry.ideaId);

    return {
      ...entry,
      ideaStatus: idea?.status ?? (entry.ideaKind === "song" ? "seed" : "clip"),
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
