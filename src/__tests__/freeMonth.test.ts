import {
  FREE_MONTH_DAYS,
  decideFounding,
  freeMonthNow,
  freeMonthStart,
  freeMonthStatus,
  isFoundingInstall,
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

  // Sweep P1-2: founding is decided once and stored; a restored backup's firstLaunchAt
  // cannot carry it, and erase-all cannot drop it.
  it("decides founding once, then reads the stored flag alone", () => {
    const release = START + 40 * DAY;
    expect(decideFounding(null, START, release)).toEqual({ founding: true, store: "1" });
    expect(decideFounding(null, release + DAY, release)).toEqual({ founding: false, store: "0" });
    expect(decideFounding(null, null, release)).toEqual({ founding: false, store: "0" });
    // The flag wins over whatever firstLaunchAt says now (a restored tester backup, or a
    // fresh firstLaunchAt after Erase everything).
    expect(decideFounding("1", release + DAY, release)).toEqual({ founding: true, store: null });
    expect(decideFounding("0", START, release)).toEqual({ founding: false, store: null });
    // No release date yet: nobody is founding and nothing is stored, so the testers are
    // not locked out before the release build decides.
    expect(decideFounding(null, START, null)).toEqual({ founding: false, store: null });
  });
});
