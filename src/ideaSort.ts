import { IdeaSort, SongIdea } from "./types";

export type IdeaSortMetric = "created" | "updated" | "title" | "length" | "progress";
export type IdeaSortDirection = "asc" | "desc";

const VALID_IDEA_SORTS: readonly IdeaSort[] = [
  "newest",
  "oldest",
  "updated-newest",
  "updated-oldest",
  "title-az",
  "title-za",
  "duration-long",
  "duration-short",
  "completion-high",
  "completion-low",
];

export function isIdeaSort(value: unknown): value is IdeaSort {
  return typeof value === "string" && VALID_IDEA_SORTS.includes(value as IdeaSort);
}

export function getIdeaSortState(sort: IdeaSort): {
  metric: IdeaSortMetric;
  direction: IdeaSortDirection;
} {
  switch (sort) {
    case "newest":
      return { metric: "created", direction: "desc" };
    case "oldest":
      return { metric: "created", direction: "asc" };
    case "updated-newest":
      return { metric: "updated", direction: "desc" };
    case "updated-oldest":
      return { metric: "updated", direction: "asc" };
    case "title-az":
      return { metric: "title", direction: "asc" };
    case "title-za":
      return { metric: "title", direction: "desc" };
    case "duration-long":
      return { metric: "length", direction: "desc" };
    case "duration-short":
      return { metric: "length", direction: "asc" };
    case "completion-high":
      return { metric: "progress", direction: "desc" };
    case "completion-low":
      return { metric: "progress", direction: "asc" };
    default:
      return { metric: "created", direction: "desc" };
  }
}

export function getIdeaSortValue(
  metric: IdeaSortMetric,
  direction: IdeaSortDirection
): IdeaSort {
  if (metric === "created") return direction === "desc" ? "newest" : "oldest";
  if (metric === "updated") return direction === "desc" ? "updated-newest" : "updated-oldest";
  if (metric === "title") return direction === "asc" ? "title-az" : "title-za";
  if (metric === "length") return direction === "desc" ? "duration-long" : "duration-short";
  return direction === "desc" ? "completion-high" : "completion-low";
}

export function getIdeaCreatedAt(idea: SongIdea): number {
  if (idea.clips.length === 0) {
    return idea.createdAt;
  }

  // "Created" on the Ideas timeline follows the first clip/import date
  // once an idea has audio, so old projects stay anchored to their first seed.
  return idea.clips.reduce((minTs, clip) => Math.min(minTs, clip.createdAt), idea.createdAt);
}

export function getIdeaUpdatedAt(idea: SongIdea): number {
  let latestTs = getIdeaCreatedAt(idea);

  for (const clip of idea.clips) {
    latestTs = Math.max(latestTs, clip.createdAt);
  }

  if (idea.kind === "project") {
    for (const version of idea.lyrics?.versions ?? []) {
      latestTs = Math.max(latestTs, version.updatedAt || version.createdAt);
    }
  }

  if (typeof idea.lastActivityAt === "number") {
    latestTs = Math.max(latestTs, idea.lastActivityAt);
  }

  return latestTs;
}

export function getIdeaDurationMs(idea: SongIdea): number {
  const primary = idea.clips.find((clip) => clip.isPrimary) ?? idea.clips[0];
  return primary?.durationMs ?? 0;
}

export function getIdeaSortTimestamp(idea: SongIdea, sort: IdeaSort): number {
  const { metric } = getIdeaSortState(sort);
  if (metric === "created") return getIdeaCreatedAt(idea);
  if (metric === "updated") return getIdeaUpdatedAt(idea);
  return idea.createdAt;
}

export function usesIdeaTimelineDividers(sort: IdeaSort): boolean {
  const { metric } = getIdeaSortState(sort);
  return metric === "created" || metric === "updated";
}

function compareNumbers(a: number, b: number, direction: IdeaSortDirection) {
  return direction === "desc" ? b - a : a - b;
}

function compareStrings(a: string, b: string, direction: IdeaSortDirection) {
  const result = a.localeCompare(b);
  return direction === "desc" ? -result : result;
}

function tieBreakIdeas(a: SongIdea, b: SongIdea) {
  return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
}

export function compareIdeas(a: SongIdea, b: SongIdea, sort: IdeaSort) {
  const { metric, direction } = getIdeaSortState(sort);

  if (metric === "created") {
    return (
      compareNumbers(getIdeaCreatedAt(a), getIdeaCreatedAt(b), direction) ||
      compareNumbers(getIdeaUpdatedAt(a), getIdeaUpdatedAt(b), "desc") ||
      tieBreakIdeas(a, b)
    );
  }

  if (metric === "updated") {
    return (
      compareNumbers(getIdeaUpdatedAt(a), getIdeaUpdatedAt(b), direction) ||
      compareNumbers(getIdeaCreatedAt(a), getIdeaCreatedAt(b), direction) ||
      tieBreakIdeas(a, b)
    );
  }

  if (metric === "title") {
    return (
      compareStrings(a.title, b.title, direction) ||
      compareNumbers(getIdeaCreatedAt(a), getIdeaCreatedAt(b), "desc") ||
      tieBreakIdeas(a, b)
    );
  }

  if (metric === "length") {
    return (
      compareNumbers(getIdeaDurationMs(a), getIdeaDurationMs(b), direction) ||
      compareNumbers(getIdeaCreatedAt(a), getIdeaCreatedAt(b), "desc") ||
      tieBreakIdeas(a, b)
    );
  }

  return (
    compareNumbers(a.completionPct, b.completionPct, direction) ||
    compareNumbers(getIdeaUpdatedAt(a), getIdeaUpdatedAt(b), "desc") ||
    tieBreakIdeas(a, b)
  );
}
