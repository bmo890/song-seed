/**
 * The free month (founder, 2026-10-19): every feature is open for 30 days from the
 * first launch, with no card and no store trial. When it ends nothing is lost: work
 * made with Pro tools still opens and plays, gates only stop creating new.
 *
 * Founding members: an install whose first launch predates the App Store release
 * (the TestFlight testers; the TestFlight → App Store upgrade keeps the same data)
 * keeps Pro. RevenueCat promotional entitlements cover anyone that misses.
 *
 * Pure: every function takes the clock and the stored dates, so it is unit-testable.
 */

export const FREE_MONTH_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the App Store version shipped. Installs that first launched before this are
 * founding members. `null` means not released: nobody is founding. Set in the release
 * commit (2026-11-11); the lifetime launch price below is counted from it.
 */
export const APP_STORE_RELEASE_AT: number | null = Date.UTC(2026, 10, 11);

/**
 * Lifetime's launch price (founder, 2026-11-01): $59.99 for the first 90 days after
 * the App Store release, then $79.99. A fixed date, printed on the Pro sheet, so it
 * is the same for everyone and never quietly lapses inside someone's free month.
 * The store price itself is changed by hand on that day (pricing-and-marketing.md).
 */
export const LIFETIME_LAUNCH_DAYS = 90;

/** When the lifetime launch price ends, or null before the release date is set. */
export function lifetimeLaunchEndsAt(releaseAt: number | null = APP_STORE_RELEASE_AT): number | null {
  return releaseAt == null ? null : releaseAt + LIFETIME_LAUNCH_DAYS * DAY_MS;
}

export type FreeMonthStatus = {
  active: boolean;
  /** Whole days left, counting today; 0 once it has ended. */
  daysLeft: number;
  endsAt: number;
};

export function freeMonthStatus(startedAt: number, now: number): FreeMonthStatus {
  const endsAt = startedAt + FREE_MONTH_DAYS * DAY_MS;
  const active = now < endsAt;
  return { active, daysLeft: active ? Math.ceil((endsAt - now) / DAY_MS) : 0, endsAt };
}

/**
 * The date the month is counted from (sweep P1-1, 2026-10-22): the install's first
 * launch, or the first launch of a build WITH the paywall, whichever is later. v1.0
 * ships with everything free, so a month that ran from first launch would already be
 * spent when the update that turns Pro on arrives; `paywallSinceAt` is written the
 * first time such a build runs (services/freeMonthClock.ts).
 */
export function freeMonthStart(startedAt: number, paywallSinceAt: number | null | undefined): number {
  return paywallSinceAt != null && paywallSinceAt > startedAt ? paywallSinceAt : startedAt;
}

/**
 * The clock the month is judged by (sweep P2-2): never earlier than the latest moment
 * the app has already seen, so turning the device's date back does not reopen the month.
 * `lastSeenAt` is the stored high-water mark.
 */
export function freeMonthNow(now: number, lastSeenAt: number | null | undefined): number {
  return lastSeenAt != null && lastSeenAt > now ? lastSeenAt : now;
}

/**
 * How far the clock may move forward between two launches and still be believed at
 * once (07-M4, 2026-11-02). A bigger jump is believed for this launch only; it becomes
 * the stored high-water mark when a launch at least `CLOCK_JUMP_CONFIRM_MS` later
 * still agrees. One launch with the date set ahead (a game, a phone that booted with
 * a bad clock before network time) used to end the month for good: the mark only
 * rises and lives in the Keychain.
 */
export const CLOCK_JUMP_LIMIT_MS = 2 * DAY_MS;
export const CLOCK_JUMP_CONFIRM_MS = 60 * 60 * 1000;

export type FreeMonthClockMarks = {
  /** The trusted high-water mark: the latest moment the app has believed. */
  lastSeenAt: number | null;
  /** A big forward jump waiting for a later launch to confirm it. */
  pendingAt: number | null;
};

/**
 * The clock this launch is judged by, and the marks to store. Turning the date back
 * never reopens the month (the trusted mark holds); a big jump forward ends nothing
 * for good until a later launch confirms it; ordinary time just advances the mark.
 */
export function advanceFreeMonthClock(
  now: number,
  marks: FreeMonthClockMarks
): { judgeAt: number; next: FreeMonthClockMarks } {
  const { lastSeenAt, pendingAt } = marks;
  if (lastSeenAt == null) return { judgeAt: now, next: { lastSeenAt: now, pendingAt: null } };
  // Set back (or not moved): the trusted mark holds, and an unconfirmed jump was the
  // odd one out.
  if (now <= lastSeenAt) return { judgeAt: lastSeenAt, next: { lastSeenAt, pendingAt: null } };
  if (now - lastSeenAt <= CLOCK_JUMP_LIMIT_MS) return { judgeAt: now, next: { lastSeenAt: now, pendingAt: null } };
  // A big jump: this launch is judged by the device's clock, but nothing is kept
  // until a launch an hour or more later still agrees.
  if (pendingAt != null && now >= pendingAt + CLOCK_JUMP_CONFIRM_MS) {
    return { judgeAt: now, next: { lastSeenAt: now, pendingAt: null } };
  }
  if (pendingAt != null && now >= pendingAt) return { judgeAt: now, next: { lastSeenAt, pendingAt } };
  return { judgeAt: now, next: { lastSeenAt, pendingAt: now } };
}

/**
 * Founding membership (11-H1, 2026-11-02). A "1" is stored once and is final. It is
 * decided from records that never ride a backup, so a restored backup cannot make
 * anyone founding (sweep P1-2):
 *
 *  - `startedAt`: the free month's start in the durable store, written at an
 *    install's first launch of a build with the free month (2026-10-19). On iPhone
 *    it is in the Keychain, which outlives deleting the app, "Erase everything",
 *    swapping the TestFlight app for the App Store one, and an empty boot.
 *  - `firstLaunchAtAtBirth`: the library's own first launch as it stood when that
 *    record was born (`undefined` for records born before this field). It covers a
 *    tester whose first launch since 2026-10-19 comes after the release. A fresh
 *    install's first sync runs before the library stamps its first launch, so it
 *    records none, and a later restore of someone's backup can't count.
 *
 * Nothing ever stores "0": a wrong "0" in the Keychain was permanent, and an empty
 * boot or a reinstall wrote one for testers. A stored "0" from an older build is
 * simply decided again. With no release date set nobody is founding yet.
 */
export type FoundingDecision = { founding: boolean; store: "1" | null };

export type FoundingEvidence = {
  startedAt: number | null | undefined;
  firstLaunchAtAtBirth?: number | null;
};

export function decideFounding(
  storedFlag: string | null | undefined,
  evidence: FoundingEvidence,
  releaseAt: number | null = APP_STORE_RELEASE_AT
): FoundingDecision {
  if (storedFlag === "1") return { founding: true, store: null };
  if (releaseAt == null) return { founding: false, store: null };
  const founding =
    isFoundingInstall(evidence.startedAt, releaseAt) || isFoundingInstall(evidence.firstLaunchAtAtBirth, releaseAt);
  return { founding, store: founding ? "1" : null };
}

/** The quiet notes the free month gives, each shown once: a few days ahead, the last day, after. */
export type FreeMonthNotice = "fewDaysLeft" | "lastDay" | "ended";

/** Days left when the "a few days left" note appears. */
export const FEW_DAYS_LEFT = 5;

/**
 * The note to show now, if any, given the ones already shown. Only the most recent
 * stage is shown: opening the app for the first time in two weeks after the month
 * ended shows "ended", not three notes in a row.
 */
export function noticeDue(status: FreeMonthStatus, shown: ReadonlyArray<FreeMonthNotice>): FreeMonthNotice | null {
  const stage: FreeMonthNotice | null = !status.active
    ? "ended"
    : status.daysLeft <= 1
      ? "lastDay"
      : status.daysLeft <= FEW_DAYS_LEFT
        ? "fewDaysLeft"
        : null;
  if (!stage || shown.includes(stage)) return null;
  return stage;
}

/** Whether this install is a founding member: first launched before the App Store release. */
export function isFoundingInstall(firstLaunchAt: number | null | undefined, releaseAt: number | null = APP_STORE_RELEASE_AT): boolean {
  if (releaseAt == null || firstLaunchAt == null || !Number.isFinite(firstLaunchAt) || firstLaunchAt <= 0) return false;
  return firstLaunchAt < releaseAt;
}
