import type { SongTimelineSortMetric } from "../../clipGraph";
import type { CustomTagDefinition } from "../../types";

export type TagColor = { bg: string; text: string };

export const SONG_CLIP_TAG_OPTIONS = [
  { key: "riff", label: "Riff", bg: "#dbeafe", text: "#2563eb" },
  { key: "verse", label: "Verse", bg: "#dcfce7", text: "#16a34a" },
  { key: "prechorus", label: "Pre-chorus", bg: "#fef3c7", text: "#d97706" },
  { key: "chorus", label: "Chorus", bg: "#fce7f3", text: "#db2777" },
  { key: "intro", label: "Intro", bg: "#e0e7ff", text: "#4f46e5" },
  { key: "outro", label: "Outro", bg: "#f3e8ff", text: "#9333ea" },
  { key: "interlude", label: "Interlude", bg: "#ccfbf1", text: "#0d9488" },
] as const;

export type SongClipBuiltInTag = (typeof SONG_CLIP_TAG_OPTIONS)[number]["key"];

export type SongClipTagFilter = "all" | "untagged" | string;

const CUSTOM_TAG_PALETTE: TagColor[] = [
  { bg: "#fee2e2", text: "#dc2626" },
  { bg: "#ffedd5", text: "#ea580c" },
  { bg: "#fef9c3", text: "#ca8a04" },
  { bg: "#d1fae5", text: "#059669" },
  { bg: "#e0f2fe", text: "#0284c7" },
  { bg: "#ede9fe", text: "#7c3aed" },
  { bg: "#fce7f3", text: "#db2777" },
  { bg: "#f1f5f9", text: "#475569" },
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
    return palette ?? { bg: projectTag.color, text: "#374151" };
  }

  const globalTag = globalCustomTags?.find((t) => t.key === key);
  if (globalTag) {
    const palette = CUSTOM_TAG_PALETTE.find((p) => p.bg === globalTag.color);
    return palette ?? { bg: globalTag.color, text: "#374151" };
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

export function getSongTimelineSortMetricIcon(metric: SongTimelineSortMetric) {
  switch (metric) {
    case "created":
      return "calendar-outline";
    case "title":
      return "text-outline";
    case "length":
      return "time-outline";
    default:
      return "options-outline";
  }
}

export function getSongClipTagFilterSummary(
  tagFilter: SongClipTagFilter,
  projectCustomTags?: CustomTagDefinition[],
  globalCustomTags?: CustomTagDefinition[]
) {
  if (tagFilter === "all") return "All";
  if (tagFilter === "untagged") return "Untagged";
  return getTagLabel(tagFilter, projectCustomTags, globalCustomTags);
}

export function getSongMainTakeFilterSummary(mainTakesOnly: boolean) {
  return mainTakesOnly ? "Main takes only" : "All takes";
}
