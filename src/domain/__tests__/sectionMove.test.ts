import type { ClipSection } from "../../types";
import { MIN_SECTION_LENGTH_MS, moveSection, sectionMoveBounds, sectionPushBounds } from "../playerSections";

const sec = (id: string, startMs: number, endMs: number): ClipSection => ({
  id,
  startMs,
  endMs,
  label: id,
  kind: "verse",
});

// intro 0-4s · (gap) · verse 6-10s · chorus 10-14s · clip is 20s
const sections = [sec("intro", 0, 4000), sec("verse", 6000, 10000), sec("chorus", 10000, 14000)];
const DURATION = 20000;
const span = (list: ClipSection[], id: string) => {
  const found = list.find((section) => section.id === id)!;
  return [found.startMs, found.endMs];
};

describe("sectionMoveBounds", () => {
  it("lets a section slide between its neighbours, keeping its length", () => {
    // verse may start as early as intro's end, and no later than where it already
    // touches the chorus.
    expect(sectionMoveBounds(sections, "verse", DURATION)).toEqual({ minStartMs: 4000, maxStartMs: 6000 });
  });

  it("uses the clip's edges where there is no neighbour", () => {
    expect(sectionMoveBounds(sections, "intro", DURATION)).toEqual({ minStartMs: 0, maxStartMs: 2000 });
    expect(sectionMoveBounds(sections, "chorus", DURATION)).toEqual({ minStartMs: 10000, maxStartMs: 16000 });
  });

  it("is null for a section that is not there", () => {
    expect(sectionMoveBounds(sections, "nope", DURATION)).toBeNull();
  });
});

describe("moveSection", () => {
  it("slides the section whole and leaves every other section alone", () => {
    const moved = moveSection(sections, "verse", 5000, DURATION);
    expect(span(moved, "verse")).toEqual([5000, 9000]);
    expect(span(moved, "intro")).toEqual([0, 4000]);
    expect(span(moved, "chorus")).toEqual([10000, 14000]);
  });

  it("stops at a neighbour instead of pushing or shrinking it", () => {
    expect(span(moveSection(sections, "verse", 1000, DURATION), "verse")).toEqual([4000, 8000]);
    expect(span(moveSection(sections, "verse", 9000, DURATION), "verse")).toEqual([6000, 10000]);
    expect(span(moveSection(sections, "intro", 3000, DURATION), "intro")).toEqual([2000, 6000]);
  });

  it("stops at the end of the clip", () => {
    expect(span(moveSection(sections, "chorus", 19000, DURATION), "chorus")).toEqual([16000, 20000]);
  });
});

describe("leaning past a neighbour", () => {
  it("may go as far as leaves the neighbour its minimum length", () => {
    // verse (6-10s, 4s long) against chorus (10-14s): its end may reach 14s - min.
    expect(sectionPushBounds(sections, "verse", DURATION)).toEqual({
      pushMinStartMs: MIN_SECTION_LENGTH_MS,
      pushMaxStartMs: 14000 - MIN_SECTION_LENGTH_MS - 4000,
      prevId: "intro",
      nextId: "chorus",
    });
  });

  it("has nothing to push at the clip's edges", () => {
    const push = sectionPushBounds(sections, "chorus", DURATION)!;
    expect(push.nextId).toBeNull();
    expect(push.pushMaxStartMs).toBe(16000);
  });

  it("moves only the touching edge of the neighbour, and nothing else", () => {
    const moved = moveSection(sections, "verse", 8000, DURATION, { push: true });
    expect(span(moved, "verse")).toEqual([8000, 12000]);
    expect(span(moved, "chorus")).toEqual([12000, 14000]); // start pushed, end untouched
    expect(span(moved, "intro")).toEqual([0, 4000]);
  });

  it("pushes an earlier neighbour's end the same way", () => {
    const moved = moveSection(sections, "verse", 2000, DURATION, { push: true });
    expect(span(moved, "verse")).toEqual([2000, 6000]);
    expect(span(moved, "intro")).toEqual([0, 2000]);
    expect(span(moved, "chorus")).toEqual([10000, 14000]);
  });

  it("stops when the neighbour is down to its minimum, never cascading", () => {
    const moved = moveSection(sections, "verse", 19000, DURATION, { push: true });
    expect(span(moved, "chorus")).toEqual([14000 - MIN_SECTION_LENGTH_MS, 14000]);
    expect(span(moved, "verse")[1]).toBe(14000 - MIN_SECTION_LENGTH_MS);
  });

  it("without push the neighbour is still a wall", () => {
    expect(span(moveSection(sections, "verse", 8000, DURATION), "verse")).toEqual([6000, 10000]);
  });
});
