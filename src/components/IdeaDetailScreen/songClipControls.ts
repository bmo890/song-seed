import type { CustomTagDefinition } from "../../types";
import { colors } from "../../design/tokens";

export type TagColor = { bg: string; text: string };

export const SONG_CLIP_TAG_OPTIONS = [
  { key: "riff",       label: "Riff",       bg: "#F5E6DC", text: "#9C5A3C" },
  { key: "verse",      label: "Verse",      bg: "#DDE8D5", text: "#4A7251" },
  { key: "prechorus",  label: "Pre-chorus", bg: "#F5EAC8", text: "#7A5C1E" },
  { key: "chorus",     label: "Chorus",     bg: "#F0DADA", text: "#8B4040" },
  { key: "intro",      label: "Intro",      bg: "#DAE4F0", text: "#3D5A7A" },
  { key: "outro",      label: "Outro",      bg: "#E8DFF0", text: "#614A7A" },
  { key: "interlude",  label: "Interlude",  bg: "#D6E8E2", text: "#35706A" },
] as const;


/** Empty array = "all clips". Otherwise shows clips that have at least one of the listed tags
 *  (use "untagged" in the array to include clips with no tags). */
export type SongClipTagFilter = string[];

export type SongClipGroupFilter = string[];

const CUSTOM_TAG_PALETTE: TagColor[] = [
  { bg: "#F5E6DC", text: "#9C5A3C" },
  { bg: "#F5EAC8", text: "#7A5C1E" },
  { bg: "#F0DADA", text: "#8B4040" },
  { bg: "#DDE8D5", text: "#4A7251" },
  { bg: "#DAE4F0", text: "#3D5A7A" },
  { bg: "#E8DFF0", text: "#614A7A" },
  { bg: "#D6E8E2", text: "#35706A" },
  { bg: colors.surfaceHigh, text: "#6B5E56" },
];

export const CUSTOM_TAG_COLOR_OPTIONS = CUSTOM_TAG_PALETTE;

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getTagColor(
  key: string,
  projectCustomTags?: CustomTagDefinition[],
  globalCustomTags?: CustomTagDefinition[]
): TagColor {
  const builtIn = SONG_CLIP_TAG_OPTIONS.find((t) => t.key === key);
  if (builtIn) return { bg: builtIn.bg, text: builtIn.text };

  const projectTag = projectCustomTags?.find((t) => t.key === key);
  if (projectTag) {
    const palette = CUSTOM_TAG_PALETTE.find((p) => p.bg === projectTag.color);
    return palette ?? { bg: projectTag.color, text: colors.textStrong };
  }

  const globalTag = globalCustomTags?.find((t) => t.key === key);
  if (globalTag) {
    const palette = CUSTOM_TAG_PALETTE.find((p) => p.bg === globalTag.color);
    return palette ?? { bg: globalTag.color, text: colors.textStrong };
  }

  return CUSTOM_TAG_PALETTE[hashString(key) % CUSTOM_TAG_PALETTE.length];
}

export function getTagLabel(
  key: string,
  projectCustomTags?: CustomTagDefinition[],
  globalCustomTags?: CustomTagDefinition[]
): string {
  const builtIn = SONG_CLIP_TAG_OPTIONS.find((t) => t.key === key);
  if (builtIn) return builtIn.label;

  const projectTag = projectCustomTags?.find((t) => t.key === key);
  if (projectTag) return projectTag.label;

  const globalTag = globalCustomTags?.find((t) => t.key === key);
  if (globalTag) return globalTag.label;

  return key;
}

/** Section tags whose name appears as a whole word in the clip title and aren't
 * already applied — surfaced as one-tap suggestions on the card. Word-boundary
 * matching avoids false hits like "introspective" → intro. */
export function suggestedSectionTagsForClip(
  title: string | undefined,
  existingKeys: Iterable<string>
): { key: string; label: string }[] {
  const text = (title ?? "").toLowerCase();
  if (!text.trim()) return [];
  const existing = new Set(existingKeys);
  const matched = SONG_CLIP_TAG_OPTIONS.filter((tag) => {
    if (existing.has(tag.key)) return false;
    const needle = tag.label.toLowerCase().replace(/[-\s]+/g, "[-\\s]?");
    return new RegExp(`\\b${needle}\\b`, "i").test(text);
  }).map((tag) => ({ key: tag.key, label: tag.label }));
  // "Pre-chorus" also trips the plain "chorus" matcher — keep only the specific one.
  return matched.some((m) => m.key === "prechorus")
    ? matched.filter((m) => m.key !== "chorus")
    : matched;
}

export function getSongClipTagFilterSummary(
  tagFilter: SongClipTagFilter,
  projectCustomTags?: CustomTagDefinition[],
  globalCustomTags?: CustomTagDefinition[]
) {
  if (tagFilter.length === 0) return "All";
  if (tagFilter.length === 1) {
    const key = tagFilter[0];
    if (key === "untagged") return "Untagged";
    return getTagLabel(key, projectCustomTags, globalCustomTags);
  }
  return `${tagFilter.length} tags`;
}
