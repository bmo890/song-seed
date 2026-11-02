// A zone with daylight saving, so the DST cases are real.
process.env.TZ = "America/New_York";

import { getDateBucket } from "../dateBuckets";
import {
  addHiddenDays,
  createHiddenDayMatcher,
  hiddenDayForGroup,
  isIdeaInHiddenDays,
  normalizeHiddenDays,
  removeHiddenDays,
} from "../hiddenDayGroups";
import type { IdeasHiddenDay, SongIdea } from "../../types";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

function withNow<T>(now: number, run: () => T): T {
  const spy = jest.spyOn(Date, "now").mockReturnValue(now);
  try {
    return run();
  } finally {
    spy.mockRestore();
  }
}

/** Fold the group holding `ts` the way the list does: from the group's start. */
function fold(now: number, ts: number): IdeasHiddenDay[] {
  return withNow(now, () => addHiddenDays([], [hiddenDayForGroup("created", getDateBucket(ts).startTs, now)]));
}

describe("folded date groups are calendar days (07-H1)", () => {
  const oct7 = at(2026, 10, 7);

  it("Today folded on 7 Oct stays folded on 8 Oct (now as Yesterday), and 8 Oct's ideas stay open", () => {
    const hidden = fold(oct7, oct7);
    expect(hidden).toEqual([{ metric: "created", fromDay: "2026-10-07", toDay: "2026-10-07" }]);
    const matches = createHiddenDayMatcher(hidden);
    withNow(at(2026, 10, 8), () => {
      expect(matches("created", at(2026, 10, 7, 9))).toBe(true);
      expect(matches("created", at(2026, 10, 8, 9))).toBe(false);
    });
  });

  it("Last week folded on 7 Oct never folds a month nobody hid", () => {
    const hidden = fold(oct7, at(2026, 10, 3));
    expect(hidden).toEqual([{ metric: "created", fromDay: "2026-10-01", toDay: "2026-10-05" }]);
    const matches = createHiddenDayMatcher(hidden);
    // 8 Oct: the same ideas are still folded.
    expect(matches("created", at(2026, 10, 3))).toBe(true);
    // 15 Nov / 1 Mar 2027: an idea from 20 Oct was never folded and never is.
    withNow(at(2026, 11, 15), () => expect(matches("created", at(2026, 10, 20))).toBe(false));
    withNow(at(2027, 3, 1), () => expect(matches("created", at(2026, 10, 20))).toBe(false));
  });

  it("Today folded on the 1st does not fold the rest of the month", () => {
    const hidden = fold(at(2026, 10, 1), at(2026, 10, 1));
    const matches = createHiddenDayMatcher(hidden);
    expect(matches("created", at(2026, 10, 1, 8))).toBe(true);
    expect(matches("created", at(2026, 10, 5))).toBe(false);
  });

  it("does not depend on the zone's offset (07-M1)", () => {
    const hidden = fold(oct7, oct7);
    process.env.TZ = "Asia/Jerusalem";
    try {
      // 7 Oct, mid-morning in Jerusalem, is still 7 Oct: still folded.
      expect(createHiddenDayMatcher(hidden)("created", at(2026, 10, 7, 10))).toBe(true);
    } finally {
      process.env.TZ = "America/New_York";
    }
  });

  it("files an idea from 00:30 the day before into Yesterday across the autumn change (07-L1)", () => {
    // 2 Nov 2026: the day after the clocks went back in New York.
    withNow(at(2026, 11, 2, 10), () => {
      expect(getDateBucket(at(2026, 11, 1, 0, 30)).key).toBe("yesterday");
    });
  });

  it("unfolds exactly the group tapped, shrinking a wider fold around it", () => {
    const wide: IdeasHiddenDay[] = [{ metric: "created", fromDay: "2026-10-01", toDay: "2026-10-31" }];
    const cut = removeHiddenDays(wide, [{ metric: "created", fromDay: "2026-10-10", toDay: "2026-10-12" }]);
    expect(cut).toEqual([
      { metric: "created", fromDay: "2026-10-01", toDay: "2026-10-09" },
      { metric: "created", fromDay: "2026-10-13", toDay: "2026-10-31" },
    ]);
    expect(removeHiddenDays(wide, [{ metric: "updated", fromDay: "2026-10-10", toDay: "2026-10-12" }])).toEqual(wide);
  });

  it("merges touching folds", () => {
    const merged = addHiddenDays(
      [{ metric: "created", fromDay: "2026-10-07", toDay: "2026-10-07" }],
      [{ metric: "created", fromDay: "2026-10-06", toDay: "2026-10-06" }]
    );
    expect(merged).toEqual([{ metric: "created", fromDay: "2026-10-06", toDay: "2026-10-07" }]);
  });
});

describe("migrating the old moving-start keys keeps what the list shows today", () => {
  const now = at(2026, 10, 7, 15);
  const dayStart = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();

  it("maps each relative group's start to the days that group covers now", () => {
    expect(
      normalizeHiddenDays(
        [
          { metric: "created", dayStartTs: dayStart(2026, 10, 7) }, // Today
          { metric: "updated", dayStartTs: dayStart(2026, 10, 1) }, // Last week (1 Oct)
        ],
        now
      )
    ).toEqual([
      { metric: "created", fromDay: "2026-10-07", toDay: "2026-10-07" },
      { metric: "updated", fromDay: "2026-10-01", toDay: "2026-10-05" },
    ]);
  });

  it("keeps an older month, drops a stale key that folds nothing today", () => {
    expect(
      normalizeHiddenDays(
        [
          { metric: "created", dayStartTs: dayStart(2026, 7, 1) }, // July
          { metric: "created", dayStartTs: dayStart(2026, 9, 23) }, // a past "Last week": folds nothing now
          { metric: "created", dayStartTs: Number.NaN },
          { metric: "sideways", fromDay: "2026-10-01", toDay: "2026-10-02" },
        ],
        now
      )
    ).toEqual([{ metric: "created", fromDay: "2026-07-01", toDay: "2026-07-31" }]);
  });

  it("drops a This-month key in the first week (the group is empty then)", () => {
    // 4 Oct: 1 Oct sits inside Last week, so the old This-month key folded nothing.
    expect(normalizeHiddenDays([{ metric: "created", dayStartTs: dayStart(2026, 10, 1) }], at(2026, 10, 4))).toEqual([]);
  });
});

describe("Revisit and the list ask one predicate (07-H2)", () => {
  it("keeps every idea of a folded October out of Revisit, not only 1 October's", () => {
    const october: IdeasHiddenDay[] = [{ metric: "created", fromDay: "2026-10-01", toDay: "2026-10-31" }];
    const matcher = createHiddenDayMatcher(october);
    const idea = (createdAt: number) =>
      ({ id: `i${createdAt}`, kind: "clip", createdAt, lastActivityAt: createdAt, clips: [] }) as unknown as SongIdea;
    expect(isIdeaInHiddenDays(matcher, idea(at(2026, 10, 1)))).toBe(true);
    expect(isIdeaInHiddenDays(matcher, idea(at(2026, 10, 20)))).toBe(true);
    expect(isIdeaInHiddenDays(matcher, idea(at(2026, 11, 2)))).toBe(false);
  });
});
