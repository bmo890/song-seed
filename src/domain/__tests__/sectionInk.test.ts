import { colors } from "../../design/tokens";
import {
  buildSectionBands,
  getSectionColor,
  nearestSectionInk,
  SECTION_INKS,
} from "../playerSections";
import type { ClipSection } from "../../types";

function section(over: Partial<ClipSection> = {}): ClipSection {
  return {
    id: "s1",
    kind: "verse",
    label: "Verse",
    startMs: 0,
    endMs: 10_000,
    ...over,
  } as ClipSection;
}

describe("section ink", () => {
  it("draws every preset from the three-weight family, never an outside hue", () => {
    const kinds = ["intro", "verse", "prechorus", "chorus", "bridge", "solo", "outro", "custom"] as const;
    for (const kind of kinds) {
      const ink = getSectionColor({ kind, color: undefined });
      expect(SECTION_INKS).toContain(ink);
    }
  });

  it("puts the peak of the song in the deepest ink and the edges in the lightest", () => {
    expect(getSectionColor({ kind: "chorus", color: undefined })).toBe(colors.markDeep);
    expect(getSectionColor({ kind: "solo", color: undefined })).toBe(colors.markDeep);
    expect(getSectionColor({ kind: "intro", color: undefined })).toBe(colors.markLight);
    expect(getSectionColor({ kind: "outro", color: undefined })).toBe(colors.markLight);
  });

  describe("legacy sections saved under the old eight-hue palette", () => {
    // These are the exact colours the retired palette wrote into stored clips.
    it.each([
      ["#3F9C82", "teal intro"],
      ["#C98A3C", "amber verse"],
      ["#C8463A", "red chorus"],
      ["#5775A6", "blue bridge"],
      ["#9B6FB2", "purple solo"],
      ["#6F7E8C", "slate outro"],
      ["#B0568A", "magenta custom"],
    ])("snaps %s (%s) onto the family instead of orphaning it", (stored) => {
      expect(SECTION_INKS).toContain(nearestSectionInk(stored));
    });

    it("keeps a dark stored colour dark and a light one light", () => {
      // #C8463A (old chorus) is darker than #CDA695, so it must not land on markLight.
      expect(nearestSectionInk("#C8463A")).not.toBe(colors.markLight);
      // A near-white stored colour has nowhere darker to go than the lightest weight.
      expect(nearestSectionInk("#F5EFEA")).toBe(colors.markLight);
    });

    it("falls back to the mid weight for a missing or unreadable colour", () => {
      expect(nearestSectionInk(undefined)).toBe(colors.markMid);
      expect(nearestSectionInk("")).toBe(colors.markMid);
      expect(nearestSectionInk("not-a-colour")).toBe(colors.markMid);
    });
  });

  it("keeps the band fill faint enough to read the audio through", () => {
    const [band] = buildSectionBands([section()], 20_000);
    const alpha = Number(band.color.match(/([\d.]+)\)$/)![1]);
    // The old 0.32 fill hid the waveform outright — the one thing the reel exists to show.
    expect(alpha).toBeLessThanOrEqual(0.12);
    // The rail stays solid: it is what identifies the part.
    expect(band.railColor).toBe(colors.markMid);
  });
});

describe("stored colours render in the family too", () => {
  it("snaps a section saved with an old-palette hex, not just the editor's preview", () => {
    // The exact case in the dev library: a Chorus stored as #C8463A before the change.
    const ink = getSectionColor({ kind: "chorus", color: "#C8463A" });
    expect(SECTION_INKS).toContain(ink);
    expect(ink).not.toBe("#C8463A");
  });

  it("does not rewrite what is stored — only what is drawn", () => {
    const stored = section({ kind: "chorus", color: "#C8463A" });
    getSectionColor(stored);
    expect(stored.color).toBe("#C8463A");
  });

  it("bands built from a legacy section use family ink for the rail", () => {
    const [band] = buildSectionBands([section({ kind: "chorus", color: "#C8463A" })], 20_000);
    expect(SECTION_INKS).toContain(band.railColor);
  });
});
