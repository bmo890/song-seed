import type { SongTimelineSortMetric } from "../../clipGraph";

export const SONG_CLIP_TAG_OPTIONS = [
  { key: "riff", label: "Riff" },
  { key: "verse", label: "Verse" },
  { key: "prechorus", label: "Pre-chorus" },
  { key: "chorus", label: "Chorus" },
  { key: "intro", label: "Intro" },
  { key: "outro", label: "Outro" },
  { key: "interlude", label: "Interlude" },
] as const;

export type SongClipBuiltInTag = (typeof SONG_CLIP_TAG_OPTIONS)[number]["key"];

export type SongClipTagFilter = "all" | "untagged" | SongClipBuiltInTag;

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

export function getSongClipTagFilterSummary(tagFilter: SongClipTagFilter) {
  if (tagFilter === "all") return "All";
  if (tagFilter === "untagged") return "Untagged";
  return SONG_CLIP_TAG_OPTIONS.find((option) => option.key === tagFilter)?.label ?? "All";
}

export function getSongMainTakeFilterSummary(mainTakesOnly: boolean) {
  return mainTakesOnly ? "Main takes only" : "All takes";
}
