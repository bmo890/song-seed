import { FREE_MONTH_DAYS, freeMonthStatus, isFoundingInstall, noticeDue } from "../domain/freeMonth";

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
});
