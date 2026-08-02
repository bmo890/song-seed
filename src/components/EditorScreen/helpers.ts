import type { AudioAnalysis } from "@siteed/audio-studio";
import { colors } from "../../design/tokens";
import type { EditRegion } from "../../types";
import { buildDefaultIdeaTitle } from "../../utils";

export const MIN_REGION_DURATION_MS = 1000;
export const NEW_REGION_FRACTION_OF_DURATION = 8;

/**
 * One ink per meaning, drawn from the palette: keeping a part is the house action, so it
 * wears terracotta; removing one is destruction, so it wears danger. The same pair is
 * used on the reel, the intent control and the part rows — before this the reel spoke
 * Tailwind blue/red while the list below it spoke green/brick, for the same two words.
 */
export const KEEP_COLOR = colors.primaryDeep;
export const CUT_COLOR = colors.danger;

export type EditableSelection = {
  id: string;
  start: number;
  end: number;
  type: "keep" | "remove";
  /** Name the musician typed on the row. Empty means "use the suggested one" — naming
   *  happens while marking, so the save step never has to be a form. */
  title?: string;
};

export function buildFallbackClipTitle() {
  return buildDefaultIdeaTitle();
}

export function buildClipId() {
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getInitialRegionDurationMs(durationMs: number) {
  return Math.max(MIN_REGION_DURATION_MS, Math.floor(durationMs / NEW_REGION_FRACTION_OF_DURATION));
}

export function cloneEditRegions(editRegions?: EditRegion[]) {
  return editRegions?.map((region) => ({ ...region }));
}

export function cloneTags(tags?: string[]) {
  return tags?.length ? [...tags] : undefined;
}

export function buildFallbackAnalysis(durationMs: number): AudioAnalysis {
  return {
    segmentDurationMs: Math.max(100, Math.floor(durationMs / 96)),
    durationMs,
    bitDepth: 16,
    samples: 0,
    numberOfChannels: 1,
    sampleRate: 44100,
    dataPoints: [],
    amplitudeRange: { min: 0, max: 0 },
    rmsRange: { min: 0, max: 0 },
    extractionTimeMs: 0,
  };
}

export function formatSelectionDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}hr ${minutes}min ${seconds}sec`;
  }
  if (minutes > 0) {
    return `${minutes}min ${String(seconds).padStart(2, "0")}sec`;
  }
  return `${seconds} sec`;
}
