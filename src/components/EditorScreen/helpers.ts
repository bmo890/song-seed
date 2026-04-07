import type { AudioAnalysis } from "@siteed/audio-studio";
import type { ClipVersion, EditRegion } from "../../types";
import { buildDefaultIdeaTitle, metersToWaveformPeaks } from "../../utils";

export const MIN_REGION_DURATION_MS = 1000;
export const NEW_REGION_FRACTION_OF_DURATION = 8;

export type EditableSelection = {
  id: string;
  start: number;
  end: number;
  type: "keep" | "remove";
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

export function buildWaveformPeaks(analysis: AudioAnalysis) {
  const levelsAsDb = analysis.dataPoints.map((point) =>
    Number.isFinite(point.dB) ? point.dB : point.amplitude > 0 ? 20 * Math.log10(point.amplitude) : -60
  );
  return metersToWaveformPeaks(levelsAsDb, 96);
}

export function cloneEditRegions(editRegions?: EditRegion[]) {
  return editRegions?.map((region) => ({ ...region }));
}

export function cloneTags(tags?: string[]) {
  return tags?.length ? [...tags] : undefined;
}

export function clonePracticeMarkers(practiceMarkers?: ClipVersion["practiceMarkers"]) {
  return practiceMarkers?.map((marker) => ({ ...marker }));
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
