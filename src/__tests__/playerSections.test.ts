import type { ClipSection } from "../types";
import {
  defaultSectionEndMs,
  getCustomSectionOptions,
  MIN_SECTION_LENGTH_MS,
  normalizeSections,
  resolveSectionEdit,
} from "../playerSections";

const DURATION = 60000;

function section(over: Partial<ClipSection> & { id: string; startMs: number }): ClipSection {
  return { kind: "verse", label: "Verse", endMs: over.startMs + 10000, ...over };
}

describe("normalizeSections", () => {
  it("sorts and backfills a missing/legacy end from the next start", () => {
    const legacy = [
      { id: "b", startMs: 20000, kind: "chorus", label: "Chorus" },
      { id: "a", startMs: 0, kind: "intro", label: "Intro" },
    ] as unknown as ClipSection[];
    const result = normalizeSections(legacy, DURATION);
    expect(result.map((s) => s.id)).toEqual(["a", "b"]);
    expect(result[0].endMs).toBe(20000); // fills to next start
    expect(result[1].endMs).toBe(DURATION); // last fills to clip end
  });

  it("enforces a minimum section length", () => {
    const result = normalizeSections([section({ id: "a", startMs: 1000, endMs: 1000 })], DURATION);
    expect(result[0].endMs - result[0].startMs).toBeGreaterThanOrEqual(MIN_SECTION_LENGTH_MS);
  });
});

describe("resolveSectionEdit", () => {
  const base = [
    section({ id: "a", startMs: 0, endMs: 10000 }),
    section({ id: "b", startMs: 10000, endMs: 20000 }),
  ];

  it("pushes the next section's start when an end is dragged past it", () => {
    const result = resolveSectionEdit(base, "a", { endMs: 14000 }, DURATION);
    const a = result.find((s) => s.id === "a")!;
    const b = result.find((s) => s.id === "b")!;
    expect(a.endMs).toBe(14000);
    expect(b.startMs).toBe(14000); // pushed
    expect(b.endMs).toBe(20000); // far edge unchanged (room remained)
  });

  it("leaves a gap (no push) when an end is dragged short of the next start", () => {
    const result = resolveSectionEdit(base, "a", { endMs: 7000 }, DURATION);
    expect(result.find((s) => s.id === "a")!.endMs).toBe(7000);
    expect(result.find((s) => s.id === "b")!.startMs).toBe(10000);
  });

  it("clamps a start so it can't cross its own end", () => {
    const result = resolveSectionEdit(base, "b", { startMs: 19999 }, DURATION);
    const b = result.find((s) => s.id === "b")!;
    expect(b.startMs).toBeLessThanOrEqual(b.endMs - MIN_SECTION_LENGTH_MS);
  });

  it("pushes a previous section's end when a start is dragged back into it", () => {
    const result = resolveSectionEdit(base, "b", { startMs: 6000 }, DURATION);
    const a = result.find((s) => s.id === "a")!;
    const b = result.find((s) => s.id === "b")!;
    expect(b.startMs).toBe(6000);
    expect(a.endMs).toBe(6000); // pushed back
  });
});

describe("getCustomSectionOptions", () => {
  it("returns distinct custom types and drops duplicates", () => {
    const sections = [
      section({ id: "1", startMs: 0, kind: "custom", label: "Drop", color: "#fff" }),
      section({ id: "2", startMs: 10000, kind: "custom", label: "Drop", color: "#fff" }),
      section({ id: "3", startMs: 20000, kind: "verse", label: "Verse" }),
    ];
    expect(getCustomSectionOptions(sections)).toEqual([{ label: "Drop", color: "#fff" }]);
  });
});

describe("defaultSectionEndMs", () => {
  it("extends a new section up to the next section's start", () => {
    const sections = [section({ id: "later", startMs: 30000, endMs: 40000 })];
    expect(defaultSectionEndMs(sections, 5000, DURATION)).toBe(30000);
  });

  it("extends to the clip end when nothing follows", () => {
    expect(defaultSectionEndMs([], 5000, DURATION)).toBe(DURATION);
  });
});
