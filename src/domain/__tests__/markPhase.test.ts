import { pinPhase, sectionPhase } from "../markPhase";

describe("sectionPhase", () => {
  it("is ahead, then now, then past as the playhead crosses it", () => {
    expect(sectionPhase(4000, 9000, 3999)).toBe("ahead");
    expect(sectionPhase(4000, 9000, 4000)).toBe("now");
    expect(sectionPhase(4000, 9000, 8999)).toBe("now");
    expect(sectionPhase(4000, 9000, 9000)).toBe("past");
  });

  it("never lights two touching sections at once", () => {
    const at = 9000;
    expect([sectionPhase(4000, 9000, at), sectionPhase(9000, 14000, at)]).toEqual(["past", "now"]);
  });
});

describe("pinPhase", () => {
  it("is now for a second either side, then past", () => {
    expect(pinPhase(6000, 4999)).toBe("ahead");
    expect(pinPhase(6000, 5000)).toBe("now");
    expect(pinPhase(6000, 7000)).toBe("now");
    expect(pinPhase(6000, 7001)).toBe("past");
  });
});

import { markGroupPositions, markRowTimeline, type ListedMark } from "../markPhase";

// Verse 49-98 s with a pin at 76 s inside it; loose pins at 142 s and 188 s;
// a second verse 196-210 s with nothing in it.
const listed: ListedMark[] = [
  { kind: "section", id: "verse1", startMs: 49000, endMs: 98000 },
  { kind: "pin", id: "drums", atMs: 76000 },
  { kind: "pin", id: "slow", atMs: 142000 },
  { kind: "pin", id: "pin", atMs: 188000 },
  { kind: "section", id: "verse2", startMs: 196000, endMs: 210000 },
];

describe("markGroupPositions", () => {
  it("groups a pin under the section it falls in, and leaves the rest alone", () => {
    expect(markGroupPositions(listed)).toEqual([
      { sectionId: "verse1", role: "head", last: false },
      { sectionId: "verse1", role: "member", last: true },
      { sectionId: null, role: "lone", last: false },
      { sectionId: null, role: "lone", last: false },
      { sectionId: null, role: "lone", last: false },
    ]);
  });

  it("marks only the final pin of a group as last", () => {
    const positions = markGroupPositions([
      { kind: "section", id: "a", startMs: 0, endMs: 10000 },
      { kind: "pin", id: "p1", atMs: 2000 },
      { kind: "pin", id: "p2", atMs: 8000 },
      { kind: "section", id: "b", startMs: 10000, endMs: 20000 },
      { kind: "pin", id: "p3", atMs: 10000 },
    ]);
    expect(positions.map((p) => `${p.role}${p.last ? "!" : ""}`)).toEqual([
      "head",
      "member",
      "member!",
      "head",
      "member!",
    ]);
  });

  it("does not claim a pin sitting on a section's end", () => {
    const positions = markGroupPositions([
      { kind: "section", id: "a", startMs: 0, endMs: 10000 },
      { kind: "pin", id: "p", atMs: 10000 },
    ]);
    expect(positions.map((p) => p.role)).toEqual(["lone", "lone"]);
  });
});

describe("markRowTimeline", () => {
  const member = (sectionPhase: "past" | "now" | "ahead") => ({ role: "member" as const, sectionPhase });
  const drums = listed[1];

  it("keeps a passed pin lit, not faded, while its section is playing", () => {
    // The founder's case: playhead 1:29, pin at 1:16 inside Verse 1.
    expect(markRowTimeline(drums, member("now"), 89000)).toEqual({ lit: true, strong: false, past: false });
  });

  it("goes a weight up as the playhead reaches it", () => {
    expect(markRowTimeline(drums, member("now"), 76500)).toEqual({ lit: true, strong: true, past: false });
  });

  it("fades with its section once the section has passed", () => {
    expect(markRowTimeline(drums, member("past"), 120000)).toEqual({ lit: false, strong: false, past: true });
  });

  it("waits with its section when the section is ahead", () => {
    expect(markRowTimeline(drums, member("ahead"), 10000)).toEqual({ lit: false, strong: false, past: false });
  });

  it("leaves a pin outside every section on its own clock", () => {
    const lone = { role: "lone" as const, sectionPhase: null };
    expect(markRowTimeline(listed[2], lone, 150000)).toEqual({ lit: false, strong: false, past: true });
    expect(markRowTimeline(listed[2], lone, 142500)).toEqual({ lit: true, strong: true, past: false });
  });
});
