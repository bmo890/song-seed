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

/**
 * Assign a timestamp to its smart date bucket.
 *
 * The bucket boundaries are computed relative to `Date.now()` so they stay
 * current across session usage without caching.
 */
export function getDateBucket(ts: number): DateBucket {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - DAY_MS;
  const weekAgoStart = todayStart - 6 * DAY_MS;
  const thisMonthStart = startOfMonth(now);

  const lastMonthDate = new Date(thisMonthStart);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStart = lastMonthDate.getTime();

  const currentYear = new Date(now).getFullYear();

  if (ts >= todayStart) {
    return { key: "today", label: "Today", startTs: todayStart };
  }
  if (ts >= yesterdayStart) {
    return { key: "yesterday", label: "Yesterday", startTs: yesterdayStart };
  }
  if (ts >= weekAgoStart) {
    return { key: "last-week", label: "Last week", startTs: weekAgoStart };
  }
  if (ts >= thisMonthStart) {
    return { key: "this-month", label: "This month", startTs: thisMonthStart };
  }
  if (ts >= lastMonthStart) {
    return { key: "last-month", label: "Last month", startTs: lastMonthStart };
  }

  // Group by calendar month
  const d = new Date(ts);
  const monthStart = startOfMonth(ts);
  const monthName = d.toLocaleDateString("en-US", { month: "long" });

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
