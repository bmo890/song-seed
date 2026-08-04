import type { ClipSection, ClipSectionKind } from "../types";
import { colors } from "../design/tokens";

export type SectionPreset = {
  kind: ClipSectionKind;
  label: string;
  /** Vivid base colour. Band fill, rail, swatch and reel label all derive from this. */
  color: string;
};

/** A resolved reel band rectangle (contiguous span) ready to draw on the canvas. */
export type SectionBand = {
  id: string;
  startMs: number;
  endMs: number;
  label: string;
  /** Translucent fill drawn behind the waveform. */
  color: string;
  /** Solid rail/label colour. */
  railColor: string;
};

/** Shortest section we allow — also the minimum gap kept when boundaries are pushed. */
export const MIN_SECTION_LENGTH_MS = 200;

/**
 * One ink per structural role, fixed for every song — see `colors.section*` for why the
 * set is harmonised rather than hand-picked. A musician learns the mapping once and then
 * reads an arrangement at a glance instead of reading seven labels.
 */
const PRESETS: Record<ClipSectionKind, SectionPreset> = {
  intro: { kind: "intro", label: "Intro", color: colors.sectionIntro },
  verse: { kind: "verse", label: "Verse", color: colors.sectionVerse },
  prechorus: { kind: "prechorus", label: "Pre-chorus", color: colors.sectionPrechorus },
  chorus: { kind: "chorus", label: "Chorus", color: colors.sectionChorus },
  bridge: { kind: "bridge", label: "Bridge", color: colors.sectionBridge },
  solo: { kind: "solo", label: "Solo", color: colors.sectionSolo },
  outro: { kind: "outro", label: "Outro", color: colors.sectionOutro },
  custom: { kind: "custom", label: "Section", color: colors.sectionCustom },
};

/** The inks a section may carry — the eight roles, offered in the editor in song order. */
export const SECTION_INKS = [
  colors.sectionIntro,
  colors.sectionVerse,
  colors.sectionPrechorus,
  colors.sectionChorus,
  colors.sectionBridge,
  colors.sectionSolo,
  colors.sectionOutro,
  colors.sectionCustom,
] as const;

/**
 * How strongly a section tints the reel behind the waveform.
 *
 * Measured against the two things it has to do at once. At 0.09 the hue lived only in the
 * label chip and the bands were indistinguishable mid-playback — the tint may as well not
 * have existed. At the retired 0.32 it swallowed the waveform, the one thing the reel is
 * for. 0.20 reads across a room and still lets the audio through.
 */
export const SECTION_FILL_ALPHA = 0.2;

/**
 * Snap any stored colour onto the role palette. Sections saved before this change keep
 * working: a hand-picked hue resolves to the closest role ink rather than being dropped or
 * left as an orphan the editor can no longer represent.
 */
export function nearestSectionInk(color: string | undefined | null): string {
  if (!color) return colors.sectionCustom;
  const target = hexToRgb(color);
  if (!target) return colors.sectionCustom;
  let best: string = colors.sectionCustom;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const ink of SECTION_INKS) {
    const candidate = hexToRgb(ink)!;
    // Compare in RGB space, not by luminance: the family now varies by HUE at one fixed
    // lightness, so "nearest" has to mean "closest colour". Matching on brightness alone
    // would map every legacy hex onto whichever ink happened to share its darkness.
    const distance =
      (candidate.r - target.r) ** 2 +
      (candidate.g - target.g) ** 2 +
      (candidate.b - target.b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = ink;
    }
  }
  return best;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  const value =
    clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (value.length !== 6) return null;
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0,
  };
}

export const SECTION_PRESETS: SectionPreset[] = [
  PRESETS.intro,
  PRESETS.verse,
  PRESETS.prechorus,
  PRESETS.chorus,
  PRESETS.bridge,
  PRESETS.solo,
  PRESETS.outro,
];

/** Preset kinds offered in the picker, in order (custom is handled separately). */
export const SECTION_QUICK_ADD: ClipSectionKind[] = [
  "intro",
  "verse",
  "prechorus",
  "chorus",
  "bridge",
  "solo",
  "outro",
];

export function getSectionPreset(kind: ClipSectionKind): SectionPreset {
  return PRESETS[kind] ?? PRESETS.custom;
}

/**
 * Resolve a section's ink. A stored colour (set via the editor) wins for any kind, but it is
 * snapped onto the role palette on the way out — so a clip saved under an older palette
 * draws in the current ink everywhere, without a migration pass over stored data. Sections
 * keep whatever hex they were saved with; only the rendering is unified.
 */
export function getSectionColor(section: Pick<ClipSection, "kind" | "color">): string {
  if (section.color) return nearestSectionInk(section.color);
  return getSectionPreset(section.kind).color;
}

/** Convert a #RRGGBB hex to an rgba() string at the given alpha. */
export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const value =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function sortClipSections(sections: ClipSection[]): ClipSection[] {
  return [...sections].sort((a, b) => a.startMs - b.startMs);
}

/** True when the label is still the preset's default (i.e. the user hasn't renamed it). */
export function isDefaultSectionLabel(section: ClipSection): boolean {
  return section.label.trim() === getSectionPreset(section.kind).label;
}

/**
 * Sort and repair a section list: backfill missing/legacy ends, clamp to the clip, enforce
 * a minimum length, and trim any overlaps so the set is always a valid non-overlapping
 * sequence. Run on load and before any edit so downstream code can trust start/end.
 */
export function normalizeSections(sections: ClipSection[], durationMs: number): ClipSection[] {
  const ceiling = durationMs > 0 ? Math.round(durationMs) : Number.MAX_SAFE_INTEGER;
  const sorted = sortClipSections(sections);
  const result: ClipSection[] = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const section = sorted[i];
    const nextStart = sorted[i + 1]?.startMs ?? ceiling;
    const start = Math.max(0, Math.min(section.startMs, ceiling - MIN_SECTION_LENGTH_MS));
    // Use the stored end when valid; otherwise fall back to the next start / clip end.
    const rawEnd =
      typeof section.endMs === "number" && section.endMs > start ? section.endMs : nextStart;
    const end = Math.max(
      start + MIN_SECTION_LENGTH_MS,
      Math.min(rawEnd, nextStart > start ? nextStart : ceiling, ceiling)
    );
    result.push({ ...section, startMs: Math.round(start), endMs: Math.round(end) });
  }
  return result;
}

/** Build the reel band rectangles from sections (explicit start/end). */
export function buildSectionBands(sections: ClipSection[], durationMs: number): SectionBand[] {
  if (durationMs <= 0 || sections.length === 0) return [];
  return normalizeSections(sections, durationMs).map((section) => {
    const base = getSectionColor(section);
    return {
      id: section.id,
      startMs: Math.max(0, Math.min(durationMs, section.startMs)),
      endMs: Math.max(0, Math.min(durationMs, section.endMs)),
      label: section.label,
      color: hexToRgba(base, SECTION_FILL_ALPHA),
      railColor: base,
    };
  });
}

/** Distinct custom section types currently in use, for the picker (deleting the last one of
 *  a name drops it from the options). Keyed by label so renamed customs stay unique. */
export function getCustomSectionOptions(
  sections: ClipSection[]
): { label: string; color: string }[] {
  const seen = new Map<string, string>();
  for (const section of sections) {
    if (section.kind !== "custom") continue;
    const label = section.label.trim();
    if (!label || seen.has(label)) continue;
    seen.set(label, section.color ?? getSectionPreset("custom").color);
  }
  return Array.from(seen.entries()).map(([label, color]) => ({ label, color }));
}

/**
 * Apply a start and/or end edit to one section and resolve the whole list so nothing
 * overlaps. Edits push neighbours: dragging an end into the next section shoves its start
 * (cascading), and dragging a start into the previous section shoves its end. Everything is
 * clamped to [0, duration] with at least MIN_SECTION_LENGTH_MS per section.
 */
export function resolveSectionEdit(
  sections: ClipSection[],
  id: string,
  patch: { startMs?: number; endMs?: number },
  durationMs: number
): ClipSection[] {
  const ceiling = durationMs > 0 ? Math.round(durationMs) : Number.MAX_SAFE_INTEGER;
  const list = normalizeSections(sections, durationMs);
  const idx = list.findIndex((section) => section.id === id);
  if (idx < 0) return list;

  const self = { ...list[idx] };
  if (patch.startMs != null) {
    self.startMs = Math.max(0, Math.min(Math.round(patch.startMs), self.endMs - MIN_SECTION_LENGTH_MS));
  }
  if (patch.endMs != null) {
    self.endMs = Math.min(ceiling, Math.max(Math.round(patch.endMs), self.startMs + MIN_SECTION_LENGTH_MS));
  }
  list[idx] = self;

  // Push forward: each later section starts no earlier than the running end.
  let runningEnd = self.endMs;
  for (let i = idx + 1; i < list.length; i += 1) {
    const section = { ...list[i] };
    if (section.startMs >= runningEnd) break;
    section.startMs = Math.min(runningEnd, ceiling - MIN_SECTION_LENGTH_MS);
    if (section.endMs < section.startMs + MIN_SECTION_LENGTH_MS) {
      section.endMs = Math.min(ceiling, section.startMs + MIN_SECTION_LENGTH_MS);
    }
    list[i] = section;
    runningEnd = section.endMs;
  }

  // Push backward: each earlier section ends no later than the running start.
  let runningStart = self.startMs;
  for (let i = idx - 1; i >= 0; i -= 1) {
    const section = { ...list[i] };
    if (section.endMs <= runningStart) break;
    section.endMs = Math.max(runningStart, MIN_SECTION_LENGTH_MS);
    if (section.startMs > section.endMs - MIN_SECTION_LENGTH_MS) {
      section.startMs = Math.max(0, section.endMs - MIN_SECTION_LENGTH_MS);
    }
    list[i] = section;
    runningStart = section.startMs;
  }

  return list;
}

/** A new section's default length when the clip offers no better hint: about a
 *  sung verse, not a whole song. */
const DEFAULT_SECTION_SPAN_MS = 30000;

/** Find a sensible default span for a new section starting at `startMs`.
 *
 *  The span is a typical section's worth — the median length of the sections
 *  already mapped, or ~30s on an unmapped clip — never "everything until the end
 *  of the song". The next section's start (or the clip end) still caps it, and
 *  when the room left is only about a section anyway (≤1.5× the typical span)
 *  the new section takes all of it, since a sliver of leftover would be noise. */
export function defaultSectionEndMs(
  sections: ClipSection[],
  startMs: number,
  durationMs: number
): number {
  const ceiling = durationMs > 0 ? Math.round(durationMs) : startMs + 15000;
  const nextStart = sections
    .map((section) => section.startMs)
    .filter((value) => value > startMs)
    .sort((a, b) => a - b)[0];
  const boundary = Math.min(nextStart ?? ceiling, ceiling);

  const lengths = sections
    .map((section) => section.endMs - section.startMs)
    .filter((value) => value >= MIN_SECTION_LENGTH_MS)
    .sort((a, b) => a - b);
  const typicalSpan =
    lengths.length > 0 ? lengths[Math.floor(lengths.length / 2)] : DEFAULT_SECTION_SPAN_MS;

  const room = boundary - startMs;
  const end = room <= typicalSpan * 1.5 ? boundary : startMs + typicalSpan;
  return Math.max(startMs + MIN_SECTION_LENGTH_MS, Math.min(end, ceiling));
}
