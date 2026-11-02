import {
  CLOCK_JUMP_CONFIRM_MS,
  CLOCK_JUMP_LIMIT_MS,
  FREE_MONTH_DAYS,
  advanceFreeMonthClock,
  decideFounding,
  freeMonthNow,
  freeMonthStart,
  freeMonthStatus,
  isFoundingInstall,
  lifetimeLaunchEndsAt,
  noticeDue,
} from "../domain/freeMonth";

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 1);

describe("the free month", () => {
  it("lasts 30 days, counting today", () => {
    expect(FREE_MONTH_DAYS).toBe(30);
    expect(freeMonthStatus(START, START)).toMatchObject({ active: true, daysLeft: 30 });
    expect(freeMonthStatus(START, START + 29.5 * DAY)).toMatchObject({ active: true, daysLeft: 1 });
    expect(freeMonthStatus(START, START + 30 * DAY)).toMatchObject({ active: false, daysLeft: 0 });
  });

  it("gives each note once, a few days ahead, on the last day, then after", () => {
    expect(noticeDue(freeMonthStatus(START, START + 10 * DAY), [])).toBeNull();
    expect(noticeDue(freeMonthStatus(START, START + 26 * DAY), [])).toBe("fewDaysLeft");
    expect(noticeDue(freeMonthStatus(START, START + 26 * DAY), ["fewDaysLeft"])).toBeNull();
    expect(noticeDue(freeMonthStatus(START, START + 29.5 * DAY), ["fewDaysLeft"])).toBe("lastDay");
    expect(noticeDue(freeMonthStatus(START, START + 31 * DAY), ["fewDaysLeft", "lastDay"])).toBe("ended");
    expect(noticeDue(freeMonthStatus(START, START + 31 * DAY), ["ended"])).toBeNull();
  });

  it("after a long absence shows only the latest note", () => {
    expect(noticeDue(freeMonthStatus(START, START + 60 * DAY), [])).toBe("ended");
  });

  it("founding members first launched before the App Store release", () => {
    const release = START + 40 * DAY;
    expect(isFoundingInstall(START, release)).toBe(true);
    expect(isFoundingInstall(release + DAY, release)).toBe(false);
    expect(isFoundingInstall(START, null)).toBe(false); // no release date yet: nobody
    expect(isFoundingInstall(null, release)).toBe(false);
    expect(isFoundingInstall(0, release)).toBe(false);
  });

  // Sweep P1-1: v1.0 ships all-free, so the month counts from the first launch WITH a paywall.
  it("counts from the first launch with a paywall, never from before it", () => {
    const flip = START + 60 * DAY;
    expect(freeMonthStart(START, null)).toBe(START); // paywall not live yet: the install's start
    expect(freeMonthStart(START, flip)).toBe(flip); // a v1.0 install gets a full month at the flip
    expect(freeMonthStart(flip + DAY, flip)).toBe(flip + DAY); // installed after the flip: its own start
    expect(freeMonthStatus(freeMonthStart(START, flip), flip)).toMatchObject({ active: true, daysLeft: 30 });
  });

  // Sweep P2-2: a date set back must not reopen the month.
  it("judges by the latest moment already seen when the clock goes back", () => {
    const seen = START + 31 * DAY;
    expect(freeMonthNow(START + 32 * DAY, seen)).toBe(START + 32 * DAY); // forward: the clock
    expect(freeMonthNow(START + 5 * DAY, seen)).toBe(seen); // back a month: still ended
    expect(freeMonthNow(START + 5 * DAY, null)).toBe(START + 5 * DAY);
    expect(freeMonthStatus(START, freeMonthNow(START + 5 * DAY, seen)).active).toBe(false);
  });

  // 11-H1: founding comes from records no backup carries, "1" once and never "0".
  it("decides founding from the durable first-launch record, and never stores a 0", () => {
    const release = START + 40 * DAY;
    expect(decideFounding(null, { startedAt: START }, release)).toEqual({ founding: true, store: "1" });
    // A record born after the release: not founding, and nothing stored.
    expect(decideFounding(null, { startedAt: release + DAY }, release)).toEqual({ founding: false, store: null });
    // A tester whose first launch since the free month shipped came after the release:
    // the library's own first launch, as it stood when the record was born, counts.
    expect(decideFounding(null, { startedAt: release + DAY, firstLaunchAtAtBirth: START }, release)).toEqual({
      founding: true,
      store: "1",
    });
    // A fresh install records none at birth; a restored backup's date can't count later.
    expect(decideFounding(null, { startedAt: release + DAY, firstLaunchAtAtBirth: null }, release).founding).toBe(false);
    // "1" is final; an old "0" is decided again from the evidence.
    expect(decideFounding("1", { startedAt: release + DAY }, release)).toEqual({ founding: true, store: null });
    expect(decideFounding("0", { startedAt: START }, release)).toEqual({ founding: true, store: "1" });
    // No release date yet: nobody is founding and nothing is stored.
    expect(decideFounding(null, { startedAt: START }, null)).toEqual({ founding: false, store: null });
  });
});

// 07-M4: one launch with the clock set ahead must not end the month for good.
describe("the free month's clock", () => {
  const marks = (lastSeenAt: number | null, pendingAt: number | null = null) => ({ lastSeenAt, pendingAt });

  it("advances with ordinary time and holds when the date is set back", () => {
    expect(advanceFreeMonthClock(START + DAY, marks(START))).toEqual({ judgeAt: START + DAY, next: marks(START + DAY) });
    expect(advanceFreeMonthClock(START - 10 * DAY, marks(START))).toEqual({ judgeAt: START, next: marks(START) });
  });

  it("believes a big jump for one launch only, until a later launch confirms it", () => {
    const ahead = START + 40 * DAY;
    const jumped = advanceFreeMonthClock(ahead, marks(START));
    expect(jumped.judgeAt).toBe(ahead);
    expect(jumped.next).toEqual(marks(START, ahead));
    // Back to the real date: the month is open again and the jump is forgotten.
    const back = advanceFreeMonthClock(START + 2 * 60 * 60 * 1000, jumped.next);
    expect(back.next).toEqual(marks(START + 2 * 60 * 60 * 1000));
    expect(freeMonthStatus(START, back.judgeAt).active).toBe(true);
    // A real long absence: the next launch, an hour on, confirms it.
    const confirmed = advanceFreeMonthClock(ahead + CLOCK_JUMP_CONFIRM_MS, jumped.next);
    expect(confirmed.next).toEqual(marks(ahead + CLOCK_JUMP_CONFIRM_MS));
    // Once confirmed, setting the date back can't reopen the month.
    expect(freeMonthStatus(START, advanceFreeMonthClock(START + DAY, confirmed.next).judgeAt).active).toBe(false);
  });

  it("keeps an unconfirmed jump pending within the hour, then confirms it", () => {
    const ahead = START + 40 * DAY;
    let state = advanceFreeMonthClock(ahead, marks(START)).next;
    state = advanceFreeMonthClock(ahead + 10 * 60 * 1000, state).next;
    expect(state).toEqual(marks(START, ahead));
    expect(advanceFreeMonthClock(ahead + CLOCK_JUMP_LIMIT_MS, state).next).toEqual(marks(ahead + CLOCK_JUMP_LIMIT_MS));
  });
});

describe("lifetime launch price", () => {
  it("runs 90 days from the release, and has no end before a release date is set", () => {
    expect(lifetimeLaunchEndsAt(START)).toBe(START + 90 * DAY);
    expect(lifetimeLaunchEndsAt(null)).toBeNull();
  });
});
