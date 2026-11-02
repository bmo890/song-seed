import type { IdeasHiddenDay, IdeasTimelineMetric, SongIdea } from "../types";
import {
  getBucketBoundaries,
  getDateBucketDayRange,
  getRelativeBucketSpans,
  localDayKey,
  spanToDayRange,
} from "./dateBuckets";
import { getIdeaCreatedAt, getIdeaUpdatedAt } from "./ideaSort";

/**
 * Folded date groups (07-H1, H2, M1, 2026-11-02).
 *
 * A fold is stored as the local calendar days the group covered when it was
 * folded ("YYYY-MM-DD", inclusive). The old shape stored the group's start
 * millisecond, which for "Today", "Yesterday" and "Last week" moves every day:
 * a fold undid itself the next day and the stale key later folded a whole
 * month nobody hid, a time-zone change reopened everything, and Revisit read
 * the keys a different way from the list. Calendar days don't move, don't
 * depend on the zone's offset, and one matcher serves the list and Revisit.
 */

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function isDayKey(value: unknown): value is string {
  return typeof value === "string" && DAY_KEY.test(value);
}

function isMetric(value: unknown): value is IdeasTimelineMetric {
  return value === "created" || value === "updated";
}

function dayKeyToDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function shiftDayKey(key: string, days: number): string {
  const d = dayKeyToDate(key);
  d.setDate(d.getDate() + days);
  return localDayKey(d.getTime());
}

/** What a stored legacy `dayStartTs` folds on the day it is migrated, so the
 *  list looks the same before and after the update ("keep today's meaning").
 *  Mirrors the old bucket starts exactly (fixed 24 h steps), then names the
 *  days that group covers now. Null when it folds nothing today. */
function migrateLegacyDayStart(dayStartTs: number, now: number): { fromDay: string; toDay: string } | null {
  const { todayStart, thisMonthStart, lastMonthStart } = getBucketBoundaries(now);
  const DAY_MS = 86_400_000;
  // The old code's group starts, in its own order (first match won).
  const legacyStarts = [
    todayStart,
    todayStart - DAY_MS,
    todayStart - 6 * DAY_MS,
    thisMonthStart,
    lastMonthStart,
  ];
  const groupIndex = legacyStarts.indexOf(dayStartTs);
  if (groupIndex >= 0) {
    // Old builds matched a group by its start, so the key folded that group,
    // even when an earlier group shares the number (the 1st: Today = This
    // month). The group with that start in the old order wins; an empty span
    // folded nothing.
    for (let index = 0; index < legacyStarts.length; index += 1) {
      if (legacyStarts[index] !== dayStartTs) continue;
      const span = getRelativeBucketSpans(now)[index];
      const range = spanToDayRange(span.startMs, span.endMs);
      if (range) return range;
    }
    return null;
  }
  // An older calendar month: its start was the 1st at local midnight.
  const monthStart = new Date(dayStartTs);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  if (monthStart.getTime() === dayStartTs && dayStartTs < lastMonthStart) {
    return getDateBucketDayRange(dayStartTs, now);
  }
  return null;
}

/** Merge each metric's ranges so overlapping or touching folds become one. */
function mergeRanges(days: IdeasHiddenDay[]): IdeasHiddenDay[] {
  const out: IdeasHiddenDay[] = [];
  for (const metric of ["created", "updated"] as const) {
    const ranges = days
      .filter((day) => day.metric === metric)
      .sort((a, b) => (a.fromDay < b.fromDay ? -1 : a.fromDay > b.fromDay ? 1 : 0));
    let current: IdeasHiddenDay | null = null;
    for (const range of ranges) {
      if (current && range.fromDay <= shiftDayKey(current.toDay, 1)) {
        if (range.toDay > current.toDay) current = { metric, fromDay: current.fromDay, toDay: range.toDay };
        continue;
      }
      if (current) out.push(current);
      current = { metric, fromDay: range.fromDay, toDay: range.toDay };
    }
    if (current) out.push(current);
  }
  return out;
}

/** Validate stored folds, migrate the legacy `dayStartTs` shape, merge. */
export function normalizeHiddenDays(raw: unknown, now: number = Date.now()): IdeasHiddenDay[] {
  if (!Array.isArray(raw)) return [];
  const days: IdeasHiddenDay[] = [];
  for (const entry of raw as any[]) {
    if (!entry || !isMetric(entry.metric)) continue;
    if (isDayKey(entry.fromDay) && isDayKey(entry.toDay) && entry.fromDay <= entry.toDay) {
      days.push({ metric: entry.metric, fromDay: entry.fromDay, toDay: entry.toDay });
      continue;
    }
    if (Number.isFinite(entry.dayStartTs)) {
      const range = migrateLegacyDayStart(entry.dayStartTs, now);
      if (range) days.push({ metric: entry.metric, ...range });
    }
  }
  return mergeRanges(days);
}

/** The fold that hides the date group holding `ts`, as that group stands now. */
export function hiddenDayForGroup(metric: IdeasTimelineMetric, ts: number, now: number = Date.now()): IdeasHiddenDay {
  return { metric, ...getDateBucketDayRange(ts, now) };
}

export function addHiddenDays(existing: IdeasHiddenDay[], days: IdeasHiddenDay[]): IdeasHiddenDay[] {
  return mergeRanges([...normalizeHiddenDays(existing), ...normalizeHiddenDays(days)]);
}

/** Unfold exactly the given days: ranges around them shrink or split. */
export function removeHiddenDays(existing: IdeasHiddenDay[], days: IdeasHiddenDay[]): IdeasHiddenDay[] {
  let ranges = normalizeHiddenDays(existing);
  for (const cut of normalizeHiddenDays(days)) {
    const next: IdeasHiddenDay[] = [];
    for (const range of ranges) {
      if (range.metric !== cut.metric || range.toDay < cut.fromDay || range.fromDay > cut.toDay) {
        next.push(range);
        continue;
      }
      if (range.fromDay < cut.fromDay) {
        next.push({ metric: range.metric, fromDay: range.fromDay, toDay: shiftDayKey(cut.fromDay, -1) });
      }
      if (range.toDay > cut.toDay) {
        next.push({ metric: range.metric, fromDay: shiftDayKey(cut.toDay, 1), toDay: range.toDay });
      }
    }
    ranges = next;
  }
  return ranges;
}

export type HiddenDayMatcher = (metric: IdeasTimelineMetric, ts: number) => boolean;

/** THE predicate for "is this moment inside a fold" — the list, its
 *  selection, and Revisit all ask this one (07-H2). Tolerates legacy entries. */
export function createHiddenDayMatcher(hiddenDays: unknown): HiddenDayMatcher {
  const ranges = normalizeHiddenDays(hiddenDays);
  if (ranges.length === 0) return () => false;
  return (metric, ts) => {
    if (!Number.isFinite(ts)) return false;
    const day = localDayKey(ts);
    return ranges.some((range) => range.metric === metric && range.fromDay <= day && day <= range.toDay);
  };
}

/** Revisit's view: an idea folded under either date is kept out of the feed. */
export function isIdeaInHiddenDays(matcher: HiddenDayMatcher, idea: SongIdea): boolean {
  return matcher("created", getIdeaCreatedAt(idea)) || matcher("updated", getIdeaUpdatedAt(idea));
}
