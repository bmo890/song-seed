import { ActivityDayEntry, ActivityMetricFilter, filterActivityEvents, formatActivityDayLabel } from "../../activity";

export const CELL_SIZE = 14;
export const CELL_GAP = 4;
export const CELL_STRIDE = CELL_SIZE + CELL_GAP;

export type ActivityCollectionGroup = {
  collectionId: string;
  collectionTitle: string;
  pathLabel: string;
  itemCount: number;
  eventCount: number;
};

export type ActivityDayWorkspaceGroup = {
  workspaceId: string;
  workspaceTitle: string;
  entries: ActivityDayEntry[];
};

export type ActivityRangeWorkspaceGroup = {
  workspaceId: string;
  workspaceTitle: string;
  collections: ActivityCollectionGroup[];
};

export function getActivityCellBackground(count: number, maxCount: number, inYear: boolean) {
  if (!inYear) return "#edf2f7";
  if (count <= 0) return "#ffffff";
  if (maxCount <= 1) return "#93c5fd";

  const ratio = count / maxCount;
  if (ratio >= 0.8) return "#1e3a8a";
  if (ratio >= 0.55) return "#2563eb";
  if (ratio >= 0.3) return "#60a5fa";
  return "#93c5fd";
}

export function formatEntryMetrics(entry: ActivityDayEntry) {
  const parts: string[] = [];
  if (entry.createdCount > 0) {
    parts.push(`${entry.createdCount} created`);
  }
  if (entry.updatedCount > 0) {
    parts.push(`${entry.updatedCount} updated`);
  }
  return parts.join(" • ");
}

export function formatMonthRangeLabel(year: number, month: number, metric: ActivityMetricFilter) {
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  if (metric === "both") return monthLabel;
  return `${monthLabel} • ${metric === "created" ? "Created" : "Updated"}`;
}

export function formatDayRangeLabel(ts: number, metric: ActivityMetricFilter) {
  const label = formatActivityDayLabel(ts);
  if (metric === "both") return label;
  return `${label} • ${metric === "created" ? "Created" : "Updated"}`;
}

function formatActivityDateLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatSelectedRangeLabel(startTs: number, endTs: number, metric: ActivityMetricFilter) {
  const startLabel = formatActivityDateLabel(startTs);
  const endLabel = formatActivityDateLabel(endTs);
  const base = startTs === endTs ? startLabel : `${startLabel} – ${endLabel}`;
  if (metric === "both") return base;
  return `${base} • ${metric === "created" ? "Created" : "Updated"}`;
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
