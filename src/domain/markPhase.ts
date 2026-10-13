/**
 * Where a mark stands against the playhead, for the Marks list's timeline cue
 * (founder, 2026-10-13): the list should show at a glance where you are in the
 * song. The convention is a transit line's: what you have passed recedes, where
 * you are is lit, what is ahead waits in plain ink.
 */
export type MarkPhase = "past" | "now" | "ahead";

/** A pin has no length, so it is "now" for a moment either side of the playhead. */
export const PIN_NOW_WINDOW_MS = 1000;

/** A section is "now" from its start up to, not including, its end — so two
 *  touching sections are never both lit. */
export function sectionPhase(startMs: number, endMs: number, playheadMs: number): MarkPhase {
  if (playheadMs >= endMs) return "past";
  return playheadMs >= startMs ? "now" : "ahead";
}

export function pinPhase(atMs: number, playheadMs: number): MarkPhase {
  if (Math.abs(playheadMs - atMs) <= PIN_NOW_WINDOW_MS) return "now";
  return playheadMs > atMs ? "past" : "ahead";
}

/**
 * Pins that fall inside a section belong to it (founder, 2026-10-13): in the
 * Marks list they read as one group with their section, so a pin you have
 * passed never looks "played" while the section it sits in is still lit.
 */
export type ListedMark =
  | { kind: "section"; id: string; startMs: number; endMs: number }
  | { kind: "pin"; id: string; atMs: number };

export type MarkGroupPosition = {
  /** The section this row is grouped under: its own id for a section that has
   *  pins inside it, the containing section's id for such a pin, else null. */
  sectionId: string | null;
  /** `head` = a section with pins inside · `member` = one of those pins ·
   *  `lone` = a section with no pins, or a pin outside every section. */
  role: "lone" | "head" | "member";
  /** The group's final row, where its rail and wash end. */
  last: boolean;
};

/** Group positions for marks already in list order (by time, a section ahead
 *  of a pin on the same instant). */
export function markGroupPositions(marks: ListedMark[]): MarkGroupPosition[] {
  const positions: MarkGroupPosition[] = marks.map(() => ({ sectionId: null, role: "lone", last: false }));
  let headIndex = -1;
  let lastMemberIndex = -1;
  const close = () => {
    if (headIndex >= 0 && lastMemberIndex >= 0) positions[lastMemberIndex].last = true;
    headIndex = -1;
    lastMemberIndex = -1;
  };
  marks.forEach((mark, index) => {
    if (mark.kind === "section") {
      close();
      headIndex = index;
      return;
    }
    const head = headIndex >= 0 ? marks[headIndex] : null;
    if (head && head.kind === "section" && mark.atMs >= head.startMs && mark.atMs < head.endMs) {
      positions[headIndex] = { sectionId: head.id, role: "head", last: false };
      positions[index] = { sectionId: head.id, role: "member", last: false };
      lastMemberIndex = index;
    } else {
      close();
    }
  });
  close();
  return positions;
}

export type MarkRowTimeline = {
  /** Wears the "you are here" wash. */
  lit: boolean;
  /** Its name goes a weight up: the section you are in, or a pin at the playhead. */
  strong: boolean;
  /** Recedes: passed. */
  past: boolean;
};

/** How one row reads against the playhead. A pin inside a section follows its
 *  section: lit with it, faded only once the whole section has passed. */
export function markRowTimeline(
  mark: ListedMark,
  group: { role: MarkGroupPosition["role"]; sectionPhase: MarkPhase | null },
  playheadMs: number
): MarkRowTimeline {
  if (mark.kind === "section") {
    const phase = sectionPhase(mark.startMs, mark.endMs, playheadMs);
    return { lit: phase === "now", strong: phase === "now", past: phase === "past" };
  }
  const own = pinPhase(mark.atMs, playheadMs);
  if (group.role !== "member" || group.sectionPhase == null) {
    return { lit: own === "now", strong: own === "now", past: own === "past" };
  }
  if (group.sectionPhase === "now") return { lit: true, strong: own === "now", past: false };
  return { lit: false, strong: false, past: group.sectionPhase === "past" };
}
