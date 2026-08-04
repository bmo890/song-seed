import { defaultSectionEndMs, MIN_SECTION_LENGTH_MS } from "../playerSections";
import type { ClipSection } from "../../types";

const section = (id: string, startMs: number, endMs: number): ClipSection => ({
  id,
  startMs,
  endMs,
  kind: "verse",
  label: "Verse",
});

describe("defaultSectionEndMs", () => {
  it("takes ~30s on a long unmapped clip instead of running to the end", () => {
    expect(defaultSectionEndMs([], 0, 240_000)).toBe(30_000);
  });

  it("takes the whole clip when the clip is only about a section's worth", () => {
    // 40s left ≤ 1.5 × 30s default — a 10s leftover sliver would be noise.
    expect(defaultSectionEndMs([], 0, 40_000)).toBe(40_000);
  });

  it("caps at the next section's start when it is close", () => {
    const sections = [section("a", 35_000, 60_000)];
    // Room to the neighbor (35s) ≤ 1.5 × the neighbor's 25s length → fill the gap.
    expect(defaultSectionEndMs(sections, 0, 240_000)).toBe(35_000);
  });

  it("uses the typical section length when the gap to the neighbor is wide", () => {
    const sections = [section("a", 0, 20_000), section("b", 120_000, 140_000)];
    // Starting at 25s with the next section 95s away: a typical (20s) span, not the gap.
    expect(defaultSectionEndMs(sections, 25_000, 240_000)).toBe(45_000);
  });

  it("still reaches at least the minimum section length past the start", () => {
    // A tiny clip: the end is the ceiling, and even mid-clip starts keep MIN room.
    expect(defaultSectionEndMs([], 0, 500)).toBe(500);
    expect(defaultSectionEndMs([], 400, 500)).toBe(400 + MIN_SECTION_LENGTH_MS);
  });
});
