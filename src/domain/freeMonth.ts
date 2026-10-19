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
 * founding members. `null` until release: nobody is founding yet (everything is still
 * free behind ALL_FEATURES_FREE anyway). Set it in the release commit.
 */
export const APP_STORE_RELEASE_AT: number | null = null;

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
