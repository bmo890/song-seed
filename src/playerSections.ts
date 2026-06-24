import type { ClipSection, ClipSectionKind } from "./types";

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
 * Bolder, multi-hue palette so sections read clearly against the waveform instead of
 * washing into the paper. Still earthy rather than neon; chorus keeps the terracotta accent.
 */
const PRESETS: Record<ClipSectionKind, SectionPreset> = {
  intro: { kind: "intro", label: "Intro", color: "#3F9C82" },
  verse: { kind: "verse", label: "Verse", color: "#C98A3C" },
  prechorus: { kind: "prechorus", label: "Pre-chorus", color: "#D6743F" },
  chorus: { kind: "chorus", label: "Chorus", color: "#C8463A" },
  bridge: { kind: "bridge", label: "Bridge", color: "#5775A6" },
  solo: { kind: "solo", label: "Solo", color: "#9B6FB2" },
  outro: { kind: "outro", label: "Outro", color: "#6F7E8C" },
  custom: { kind: "custom", label: "Section", color: "#B0568A" },
};

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

/** Swatch palette offered when creating a custom section. */
export const SECTION_CUSTOM_COLORS: string[] = [
  "#C8463A",
  "#D6743F",
  "#C98A3C",
  "#3F9C82",
  "#5775A6",
  "#9B6FB2",
  "#B0568A",
  "#6F7E8C",
  "#3D8C5F",
  "#B23B6F",
];

export function getSectionPreset(kind: ClipSectionKind): SectionPreset {
  return PRESETS[kind] ?? PRESETS.custom;
}

/** Resolve a section's base colour. A stored colour (set via the editor) wins for any kind;
 *  otherwise the preset's colour is used. */
export function getSectionColor(section: Pick<ClipSection, "kind" | "color">): string {
  return section.color ?? getSectionPreset(section.kind).color;
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

/** Length of a section from its explicit bounds. */
export function getSectionDurationMs(section: ClipSection): number {
  return Math.max(0, section.endMs - section.startMs);
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
      color: hexToRgba(base, 0.32),
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

/** Find a sensible default span for a new section starting at `startMs`. */
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
  const end = nextStart ?? ceiling;
  return Math.max(startMs + MIN_SECTION_LENGTH_MS, Math.min(end, ceiling));
}
