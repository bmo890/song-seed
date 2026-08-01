import { colors } from "../../design/tokens";
import {
  buildSectionBands,
  getSectionColor,
  nearestSectionInk,
  SECTION_FILL_ALPHA,
  SECTION_INKS,
} from "../playerSections";
import type { ClipSection, ClipSectionKind } from "../../types";

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

const ROLES: ClipSectionKind[] = [
  "intro",
  "verse",
  "prechorus",
  "chorus",
  "bridge",
  "solo",
  "outro",
  "custom",
];

function rgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** WCAG relative luminance. */
function relLuminance(hex: string) {
  const { r, g, b } = rgb(hex);
  const lin = [r, g, b].map((v) => {
    const u = v / 255;
    return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a: string, b: string) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("section ink", () => {
  it("gives every role its own ink — no two parts share a colour", () => {
    const inks = ROLES.map((kind) => getSectionColor({ kind, color: undefined }));
    expect(new Set(inks).size).toBe(ROLES.length);
  });

  it("draws only from the declared palette", () => {
    for (const kind of ROLES) {
      expect(SECTION_INKS).toContain(getSectionColor({ kind, color: undefined }));
    }
  });

  /**
   * The retired palette's real defect: hand-picked hexes whose lightness ranged 0.52–0.68,
   * so the chorus shouted and the outro whispered. These two guard the fix — hue may vary
   * freely, brightness may not.
   */
  it("holds every ink at one lightness, so no part shouts over another", () => {
    const luminances = SECTION_INKS.map(relLuminance);
    const spread = Math.max(...luminances) - Math.min(...luminances);
    expect(spread).toBeLessThan(0.035);
  });

  it("keeps every ink legible against both its white label and the page", () => {
    for (const ink of SECTION_INKS) {
      expect(contrast(ink, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(ink, colors.page)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("actually varies in hue — a set of near-identical colours would defeat the point", () => {
    // Max channel-spread across the palette: a one-hue ramp collapses this toward zero.
    const spreads = SECTION_INKS.map((ink) => {
      const { r, g, b } = rgb(ink);
      return Math.max(r, g, b) - Math.min(r, g, b);
    });
    expect(Math.min(...spreads)).toBeGreaterThan(20);
  });

  describe("sections saved under an older palette", () => {
    it.each([
      ["#3F9C82", "teal intro"],
      ["#C98A3C", "amber verse"],
      ["#D6743F", "orange pre-chorus"],
      ["#C8463A", "red chorus"],
      ["#5775A6", "blue bridge"],
      ["#9B6FB2", "purple solo"],
      ["#6F7E8C", "slate outro"],
      ["#B0568A", "magenta custom"],
      ["#B87D6B", "mid terracotta (the one-hue ramp)"],
      ["#824F3F", "deep terracotta (the one-hue ramp)"],
    ])("resolves %s (%s) to a palette ink", (stored) => {
      expect(SECTION_INKS).toContain(nearestSectionInk(stored));
    });

    it("snaps to the nearest HUE, not merely the nearest brightness", () => {
      // The whole family sits at one lightness, so a luminance-only match would scatter
      // these arbitrarily. Each legacy colour must land on its own hue's ink.
      expect(nearestSectionInk("#C8463A")).toBe(colors.sectionChorus); // red   -> terracotta
      expect(nearestSectionInk("#5775A6")).toBe(colors.sectionBridge); // blue  -> indigo
      expect(nearestSectionInk("#9B6FB2")).toBe(colors.sectionSolo); // purple -> plum
      expect(nearestSectionInk("#3F9C82")).toBe(colors.sectionIntro); // teal  -> sage
    });

    it("falls back to the custom ink for a missing or unreadable colour", () => {
      expect(nearestSectionInk(undefined)).toBe(colors.sectionCustom);
      expect(nearestSectionInk("")).toBe(colors.sectionCustom);
      expect(nearestSectionInk("not-a-colour")).toBe(colors.sectionCustom);
    });

    it("renders a stored colour in the new ink without rewriting what is stored", () => {
      const stored = section({ kind: "chorus", color: "#C8463A" });
      expect(getSectionColor(stored)).toBe(colors.sectionChorus);
      expect(stored.color).toBe("#C8463A");
    });
  });

  describe("the reel band", () => {
    it("tints strongly enough to read the arrangement mid-playback", () => {
      const [band] = buildSectionBands([section()], 20_000);
      const alpha = Number(band.color.match(/([\d.]+)\)$/)![1]);
      // At 0.09 the hue lived only in the label chip and the bands were indistinguishable.
      expect(alpha).toBeGreaterThanOrEqual(0.15);
      // At the retired 0.32 the fill swallowed the waveform.
      expect(alpha).toBeLessThanOrEqual(0.24);
      expect(alpha).toBe(SECTION_FILL_ALPHA);
    });

    it("keeps the rail solid — it is what names the part", () => {
      const [band] = buildSectionBands([section({ kind: "chorus" })], 20_000);
      expect(band.railColor).toBe(colors.sectionChorus);
    });
  });
});
