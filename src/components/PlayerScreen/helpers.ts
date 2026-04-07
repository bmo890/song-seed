import type { PracticeMarker } from "../../types";

export function getVisibleTimelineRange(durationMs: number, anchorMs: number, zoomMultiple: number) {
  if (durationMs <= 0) {
    return { start: 0, end: 0 };
  }

  const safeZoom = Math.max(1, zoomMultiple);
  const visibleDurationMs = Math.min(durationMs, Math.max(1, durationMs / safeZoom));
  const maxStartMs = Math.max(0, durationMs - visibleDurationMs);
  const startMs = Math.max(0, Math.min(anchorMs - visibleDurationMs / 2, maxStartMs));

  return {
    start: Math.round(startMs),
    end: Math.round(startMs + visibleDurationMs),
  };
}

export function extractLyricsMarkers(lyricsText: string, durationMs: number): PracticeMarker[] {
  if (durationMs <= 0) return [];

  const headingLines = lyricsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && (line.endsWith(":") || /^\[[^\]]+\]$/.test(line)))
    .slice(0, 4)
    .map((line, index, items) => {
      const cleaned = line.replace(/[:\[\]]/g, "").trim();
      const denominator = Math.max(1, items.length - 1);
      return {
        id: `heading-${index}`,
        label: cleaned || `Marker ${index + 1}`,
        atMs: Math.round(durationMs * (0.1 + (0.72 * index) / denominator)),
      };
    });

  return headingLines;
}

export function getNoteSummary(notes: string) {
  const trimmed = notes.trim();
  if (!trimmed) return "No clip notes yet.";
  return trimmed;
}
