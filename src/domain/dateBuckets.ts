import { i18n } from "../i18n/instance";
import { getMonthName } from "./dateNames";

/**
 * Smart date bucketing for chronological list dividers.
 *
 * Groups timestamps into human-friendly sections:
 *   Today → Yesterday → Last week → This month → Last month
 *   → [Month name] (same year) → [Month name Year] (older)
 */

const DAY_MS = 86_400_000;

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

function getBoundaries(now: number): BucketBoundaries {
  const todayStart = startOfDay(now);
  if (cachedBoundaries && cachedBoundaries.todayStart === todayStart) return cachedBoundaries;

  const thisMonthStart = startOfMonth(now);
  const lastMonthDate = new Date(thisMonthStart);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

  cachedBoundaries = {
    todayStart,
    yesterdayStart: todayStart - DAY_MS,
    weekAgoStart: todayStart - 6 * DAY_MS,
    thisMonthStart,
    lastMonthStart: lastMonthDate.getTime(),
    currentYear: new Date(now).getFullYear(),
  };
  return cachedBoundaries;
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
  const monthName = getMonthName(i18n.language === "he" ? "he-IL" : "en-US", d.getMonth(), "long");

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
