import { i18n } from "../i18n/instance";
import { currentFormatLocale } from "../i18n/formatLocale";
import { getMonthName } from "./dateNames";

/**
 * Smart date bucketing for chronological list dividers.
 *
 * Groups timestamps into human-friendly sections:
 *   Today → Yesterday → Last week → This month → Last month
 *   → [Month name] (same year) → [Month name Year] (older)
 */


function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export type DateBucket = {
  /** Stable identifier for grouping – items in the same bucket share this key. */
  key: string;
  /** Human-readable label for the divider row. */
  label: string;
  /**
   * Representative start timestamp for this bucket.
   * Used as the identifier for show/hide section features.
   */
  startTs: number;
};

// Boundaries depend only on "today", and month names only on the language — yet a list
// asks for a bucket per idea, several times per render. Computing both per call cost
// ~6 Date objects and (for anything older than last month) an Intl month lookup per
// idea; on Android that lookup alone is milliseconds. Cache per day and per language.
type BucketBoundaries = {
  todayStart: number;
  yesterdayStart: number;
  weekAgoStart: number;
  thisMonthStart: number;
  lastMonthStart: number;
  currentYear: number;
};

let cachedBoundaries: BucketBoundaries | null = null;

/** Local midnight `days` calendar days before `dayStart` (DST-safe: a calendar
 *  step, not 24 h blocks — 07-L1). */
function daysBefore(dayStart: number, days: number): number {
  const d = new Date(dayStart);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function getBucketBoundaries(now: number): BucketBoundaries {
  const todayStart = startOfDay(now);
  if (cachedBoundaries && cachedBoundaries.todayStart === todayStart) return cachedBoundaries;

  const thisMonthStart = startOfMonth(now);
  const lastMonthDate = new Date(thisMonthStart);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

  cachedBoundaries = {
    todayStart,
    yesterdayStart: daysBefore(todayStart, 1),
    weekAgoStart: daysBefore(todayStart, 6),
    thisMonthStart,
    lastMonthStart: lastMonthDate.getTime(),
    currentYear: new Date(now).getFullYear(),
  };
  return cachedBoundaries;
}

const getBoundaries = getBucketBoundaries;

const pad2 = (value: number) => (value < 10 ? `0${value}` : `${value}`);

/** The local calendar day of a timestamp, "YYYY-MM-DD". Sorts as text. */
export function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export type RelativeBucketKey = "today" | "yesterday" | "last-week" | "this-month" | "last-month";

/** The relative groups' spans today, newest first, as [start, end) local
 *  midnights. A span can be empty (no "This month" in the first week). */
export function getRelativeBucketSpans(now: number): { key: RelativeBucketKey; startMs: number; endMs: number }[] {
  const { todayStart, yesterdayStart, weekAgoStart, thisMonthStart, lastMonthStart } = getBoundaries(now);
  return [
    { key: "today", startMs: todayStart, endMs: daysBefore(todayStart, -1) },
    { key: "yesterday", startMs: yesterdayStart, endMs: todayStart },
    { key: "last-week", startMs: weekAgoStart, endMs: yesterdayStart },
    { key: "this-month", startMs: thisMonthStart, endMs: weekAgoStart },
    { key: "last-month", startMs: lastMonthStart, endMs: Math.min(thisMonthStart, weekAgoStart) },
  ];
}

/** A [start, end) span as inclusive local days; null when the span is empty. */
export function spanToDayRange(startMs: number, endMs: number): { fromDay: string; toDay: string } | null {
  if (endMs <= startMs) return null;
  return { fromDay: localDayKey(startMs), toDay: localDayKey(endMs - 1) };
}

/** The local calendar days (inclusive) the date group holding `ts` covers today. */
export function getDateBucketDayRange(ts: number, now: number = Date.now()): { fromDay: string; toDay: string } {
  const spans = getRelativeBucketSpans(now);
  // Today has no upper bound (a future-dated idea files there too).
  if (ts >= spans[0].startMs) return spanToDayRange(spans[0].startMs, spans[0].endMs)!;
  for (const span of spans.slice(1)) {
    if (ts >= span.startMs && ts < span.endMs) return spanToDayRange(span.startMs, span.endMs)!;
  }
  const { lastMonthStart } = getBoundaries(now);
  const monthStart = startOfMonth(ts);
  const nextMonth = new Date(monthStart);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return spanToDayRange(monthStart, Math.min(nextMonth.getTime(), lastMonthStart)) ?? {
    fromDay: localDayKey(ts),
    toDay: localDayKey(ts),
  };
}

/**
 * Assign a timestamp to its smart date bucket.
 *
 * The bucket boundaries are relative to today and refresh when the day changes.
 */
export function getDateBucket(ts: number): DateBucket {
  const { todayStart, yesterdayStart, weekAgoStart, thisMonthStart, lastMonthStart, currentYear } =
    getBoundaries(Date.now());

  if (ts >= todayStart) {
    return { key: "today", label: i18n.t("time.today"), startTs: todayStart };
  }
  if (ts >= yesterdayStart) {
    return { key: "yesterday", label: i18n.t("time.yesterday"), startTs: yesterdayStart };
  }
  if (ts >= weekAgoStart) {
    return { key: "last-week", label: i18n.t("time.lastWeek"), startTs: weekAgoStart };
  }
  if (ts >= thisMonthStart) {
    return { key: "this-month", label: i18n.t("time.thisMonth"), startTs: thisMonthStart };
  }
  if (ts >= lastMonthStart) {
    return { key: "last-month", label: i18n.t("time.lastMonth"), startTs: lastMonthStart };
  }

  // Group by calendar month
  const d = new Date(ts);
  const monthStart = startOfMonth(ts);
  const monthName = getMonthName(currentFormatLocale(), d.getMonth(), "long");

  if (d.getFullYear() === currentYear) {
    return { key: `month-${d.getMonth()}`, label: monthName, startTs: monthStart };
  }
  return {
    key: `month-${d.getFullYear()}-${d.getMonth()}`,
    label: `${monthName} ${d.getFullYear()}`,
    startTs: monthStart,
  };
}

/**
 * Convenience wrapper: returns only the label string for a timestamp.
 */
export function getDateBucketLabel(ts: number): string {
  return getDateBucket(ts).label;
}
