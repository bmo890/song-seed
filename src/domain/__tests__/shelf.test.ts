import {
  SHELF_DECISION_WINDOW_MS,
  SHELF_DEPARTED_LIMIT,
  SHELF_STAY_MS,
  buildShelfEntry,
  daysLeft,
  departedAgoLabel,
  isEntryExpired,
  isEntryInDecisionWindow,
  leavingLabel,
  shelfKeyFor,
  shelfNeedsDecision,
  stayCountdownLabel,
  sweepExpiredEntries,
  type ShelfDeparture,
  type ShelfEntry,
} from "../shelf";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function entryExpiring(inMs: number, id = `idea-${inMs}`): ShelfEntry {
  return {
    key: shelfKeyFor({ kind: "idea", id }),
    kind: "idea",
    id,
    shelvedAt: NOW + inMs - SHELF_STAY_MS,
    expiresAt: NOW + inMs,
    keepCount: 0,
  };
}

describe("shelf entry lifecycle", () => {
  it("builds an entry with a full stay", () => {
    const entry = buildShelfEntry({ kind: "idea", id: "abc" }, NOW);
    expect(entry.key).toBe("idea:abc");
    expect(entry.expiresAt).toBe(NOW + SHELF_STAY_MS);
    expect(entry.keepCount).toBe(0);
    expect(isEntryExpired(entry, NOW)).toBe(false);
    expect(isEntryInDecisionWindow(entry, NOW)).toBe(false);
  });

  it("enters the decision window in the final stretch, then expires", () => {
    const entry = buildShelfEntry({ kind: "idea", id: "abc" }, NOW);
    const justBeforeWindow = entry.expiresAt - SHELF_DECISION_WINDOW_MS - 1;
    const inWindow = entry.expiresAt - SHELF_DECISION_WINDOW_MS + 1;

    expect(isEntryInDecisionWindow(entry, justBeforeWindow)).toBe(false);
    expect(isEntryInDecisionWindow(entry, inWindow)).toBe(true);
    expect(isEntryExpired(entry, inWindow)).toBe(false);
    expect(isEntryExpired(entry, entry.expiresAt)).toBe(true);
    // Expired entries are no longer "in the window" — they're past it.
    expect(isEntryInDecisionWindow(entry, entry.expiresAt)).toBe(false);
  });

  it("needs a decision when any entry is in the window or expired", () => {
    const fresh = entryExpiring(6 * DAY_MS, "fresh");
    const deciding = entryExpiring(DAY_MS, "deciding");
    const expired = entryExpiring(-DAY_MS, "expired");

    expect(shelfNeedsDecision([fresh], NOW)).toBe(false);
    expect(shelfNeedsDecision([fresh, deciding], NOW)).toBe(true);
    expect(shelfNeedsDecision([fresh, expired], NOW)).toBe(true);
    expect(shelfNeedsDecision([], NOW)).toBe(false);
  });
});

describe("shelf labels", () => {
  it("counts days remaining, rounding up", () => {
    expect(daysLeft(entryExpiring(6 * DAY_MS + 1), NOW)).toBe(7);
    expect(daysLeft(entryExpiring(DAY_MS), NOW)).toBe(1);
    expect(daysLeft(entryExpiring(90 * 60 * 1000), NOW)).toBe(1);
    expect(daysLeft(entryExpiring(-1), NOW)).toBe(0);
  });

  it("renders countdown and leaving copy", () => {
    expect(stayCountdownLabel(entryExpiring(6 * DAY_MS + 1), NOW)).toBe("7 days left");
    expect(stayCountdownLabel(entryExpiring(DAY_MS), NOW)).toBe("1 day left");
    expect(stayCountdownLabel(entryExpiring(-1), NOW)).toBe("leaving today");

    // Leaving copy follows the CALENDAR: anchor "now" at a local noon so the
    // day boundaries are deterministic in any timezone.
    const noon = new Date(2026, 5, 15, 12, 0, 0).getTime();
    const HOUR_MS = 60 * 60 * 1000;
    const at = (offsetMs: number): Parameters<typeof leavingLabel>[0] => ({
      key: "idea:cal",
      kind: "idea",
      id: "cal",
      shelvedAt: noon + offsetMs - SHELF_STAY_MS,
      expiresAt: noon + offsetMs,
      keepCount: 0,
    });

    expect(leavingLabel(at(90 * 60 * 1000), noon)).toBe("Leaving shelf today"); // 90 min → same day
    expect(leavingLabel(at(20 * HOUR_MS), noon)).toBe("Leaving shelf tomorrow"); // 8am next day
    expect(leavingLabel(at(40 * HOUR_MS), noon)).toBe("Leaving shelf in 2 days"); // 4am day after
    expect(leavingLabel(at(-2 * HOUR_MS), noon)).toBe("Leaving shelf today"); // already past
  });

  it("renders departed-ago copy", () => {
    const departure: ShelfDeparture = { key: "idea:x", kind: "idea", id: "x", leftAt: NOW - 2 * DAY_MS };
    expect(departedAgoLabel(departure, NOW)).toBe("2d ago");
    expect(departedAgoLabel({ ...departure, leftAt: NOW - 60 * 1000 }, NOW)).toBe("today");
  });
});

describe("sweepExpiredEntries", () => {
  it("returns unchanged arrays when nothing has expired", () => {
    const entries = [entryExpiring(3 * DAY_MS)];
    const departed: ShelfDeparture[] = [];
    const result = sweepExpiredEntries(entries, departed, NOW);
    expect(result.changed).toBe(false);
    expect(result.entries).toBe(entries);
    expect(result.departed).toBe(departed);
  });

  it("moves expired entries to the departed buffer, stamped at their expiry", () => {
    const fresh = entryExpiring(3 * DAY_MS, "fresh");
    const expired = entryExpiring(-DAY_MS, "expired");
    const result = sweepExpiredEntries([fresh, expired], [], NOW);

    expect(result.changed).toBe(true);
    expect(result.entries).toEqual([fresh]);
    expect(result.departed).toHaveLength(1);
    expect(result.departed[0]).toEqual({
      key: expired.key,
      kind: "idea",
      id: "expired",
      leftAt: expired.expiresAt,
    });
  });

  it("caps the departed buffer, dropping the oldest", () => {
    const existing: ShelfDeparture[] = Array.from({ length: SHELF_DEPARTED_LIMIT }, (_, i) => ({
      key: `idea:old-${i}`,
      kind: "idea" as const,
      id: `old-${i}`,
      leftAt: NOW - (i + 2) * DAY_MS,
    }));
    const expired = entryExpiring(-DAY_MS, "newcomer");
    const result = sweepExpiredEntries([expired], existing, NOW);

    expect(result.departed).toHaveLength(SHELF_DEPARTED_LIMIT);
    expect(result.departed[0]!.id).toBe("newcomer");
    // The stalest row rolled off.
    expect(result.departed.some((item) => item.id === `old-${SHELF_DEPARTED_LIMIT - 1}`)).toBe(false);
  });

  it("does not duplicate a key already present in the buffer", () => {
    const expired = entryExpiring(-DAY_MS, "twice");
    const existing: ShelfDeparture[] = [
      { key: expired.key, kind: "idea", id: "twice", leftAt: NOW - 3 * DAY_MS },
    ];
    const result = sweepExpiredEntries([expired], existing, NOW);
    expect(result.departed.filter((item) => item.key === expired.key)).toHaveLength(1);
  });
});
