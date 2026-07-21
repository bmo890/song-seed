import { i18n } from "../i18n/instance";

/**
 * The Shelf — a temporary place to set things aside and be quietly reminded of
 * them soon. Every shelved item is a POINTER ({kind, id}); the item itself
 * never leaves its collection, so nothing here can lose data.
 *
 * Lifecycle: set aside → stay (7 days) → decision window (last 48h, surfaced as
 * a "Leaving shelf" card + nav dot) → if unseen, the sweep moves it to a small
 * "recently left the shelf" buffer (bounded, oldest rolls off) from which it
 * can be re-shelved with a fresh stay.
 *
 * `kind` is future-proofing: today only ideas (clips + songs) are shelvable;
 * lyrics/notes/charts can join without a schema change.
 */

export type ShelfRefKind = "idea";

export type ShelfRef = {
  kind: ShelfRefKind;
  id: string;
};

export type ShelfEntry = ShelfRef & {
  /** `${kind}:${id}` — stable identity for the entry. */
  key: string;
  shelvedAt: number;
  expiresAt: number;
  /** How many times "Keep 7 more days" restarted the stay. */
  keepCount: number;
};

export type ShelfDeparture = ShelfRef & {
  key: string;
  leftAt: number;
};

export const SHELF_STAY_MS = 7 * 24 * 60 * 60 * 1000;
/** The stay's final stretch, when the keep-or-leave decision is surfaced. */
export const SHELF_DECISION_WINDOW_MS = 48 * 60 * 60 * 1000;
/** Max rows kept under "Recently left the shelf" — oldest rolls off. */
export const SHELF_DEPARTED_LIMIT = 5;

export function shelfKeyFor(ref: ShelfRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function buildShelfEntry(ref: ShelfRef, now: number): ShelfEntry {
  return {
    key: shelfKeyFor(ref),
    kind: ref.kind,
    id: ref.id,
    shelvedAt: now,
    expiresAt: now + SHELF_STAY_MS,
    keepCount: 0,
  };
}

export function isEntryExpired(entry: ShelfEntry, now: number): boolean {
  return now >= entry.expiresAt;
}

/** In the final stretch of its stay (but not yet expired). */
export function isEntryInDecisionWindow(entry: ShelfEntry, now: number): boolean {
  return !isEntryExpired(entry, now) && now >= entry.expiresAt - SHELF_DECISION_WINDOW_MS;
}

/** Something on the shelf wants a keep-or-leave answer (drives the nav dot). */
export function shelfNeedsDecision(entries: ShelfEntry[], now: number): boolean {
  return entries.some(
    (entry) => isEntryInDecisionWindow(entry, now) || isEntryExpired(entry, now)
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days remaining, rounded up — an entry expiring in 90 minutes has "1 day". */
export function daysLeft(entry: ShelfEntry, now: number): number {
  return Math.max(0, Math.ceil((entry.expiresAt - now) / DAY_MS));
}

/** Quiet footer countdown: "6 days left" / "1 day left" / "leaving today". */
export function stayCountdownLabel(entry: ShelfEntry, now: number): string {
  const days = daysLeft(entry, now);
  if (days <= 0) return i18n.t("shelf.leavingTodayLower");
  if (days === 1) return i18n.t("shelf.oneDayLeft");
  return i18n.t("shelf.daysLeft", { count: days });
}

/** Calendar days between two timestamps' local midnights — "today"/"tomorrow"
 *  words must follow the calendar, not 24h blocks (an item expiring in 90
 *  minutes is leaving TODAY, not "tomorrow"). */
function calendarDaysUntil(ts: number, now: number): number {
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(ts);
  to.setHours(0, 0, 0, 0);
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** Decision-card eyebrow: "Leaving shelf today" / "… tomorrow" / "… in N days". */
export function leavingLabel(entry: ShelfEntry, now: number): string {
  const days = calendarDaysUntil(entry.expiresAt, now);
  if (days <= 0) return i18n.t("shelf.leavingToday");
  if (days === 1) return i18n.t("shelf.leavingTomorrow");
  return i18n.t("shelf.leavingDays", { count: days });
}

/** "2d ago" for the departed buffer. */
export function departedAgoLabel(departure: ShelfDeparture, now: number): string {
  const days = Math.max(0, Math.floor((now - departure.leftAt) / DAY_MS));
  if (days === 0) return i18n.t("shelf.today");
  return i18n.t("shelf.daysAgo", { count: days });
}

/**
 * Move expired entries into the departed buffer (newest first, capped — oldest
 * rolls off). Pure; returns the same arrays when nothing changed so store
 * writes can be skipped.
 */
export function sweepExpiredEntries(
  entries: ShelfEntry[],
  departed: ShelfDeparture[],
  now: number
): { entries: ShelfEntry[]; departed: ShelfDeparture[]; changed: boolean } {
  const expired = entries.filter((entry) => isEntryExpired(entry, now));
  if (expired.length === 0) return { entries, departed, changed: false };

  const remaining = entries.filter((entry) => !isEntryExpired(entry, now));
  const departures: ShelfDeparture[] = expired.map((entry) => ({
    key: entry.key,
    kind: entry.kind,
    id: entry.id,
    leftAt: entry.expiresAt,
  }));
  const survivorDeparted = departed.filter(
    (item) => !departures.some((departure) => departure.key === item.key)
  );
  const nextDeparted = [...departures, ...survivorDeparted]
    .sort((a, b) => b.leftAt - a.leftAt)
    .slice(0, SHELF_DEPARTED_LIMIT);

  return { entries: remaining, departed: nextDeparted, changed: true };
}
