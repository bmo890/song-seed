import { useTranslation } from "react-i18next";
import { windowedSliderBounds } from "../../domain/markSliderWindow";
export { spanNeighbors } from "../../domain/spanNeighbors";
import { MARK_NUDGE_BASE_MS, MARK_NUDGE_MIN_MS, MarkInspector, nudgeStepMsForZoom } from "./MarkInspector";

/** Why an edge moved, so the owner can preview a slide, snap a release, and
 *  leave a nudge exactly where the caret put it. */
export type SpanEdgeCause = "slide" | "slideEnd" | "nudge" | "type" | "playhead" | "neighbor";

/**
 * The one editor for a span on the tape (2026-10-16, founder: "a shared
 * component"): the player's sections, its loop, and the clip editor's parts all
 * hold an edge here, so the readouts, the slider's window, the step of the
 * carets, typed times, use-playhead and the neighbour snap are the same thing
 * in every room by construction.
 *
 * - The slider spans what the reel shows (`windowedSliderBounds`), so a drag
 *   moves the edge at the scale you are looking at.
 * - The carets step like every mark: a second at rest, finer as the reel zooms.
 * - Every value lands inside the span's legal range (never shorter than
 *   `minLengthMs`); the owner decides what a cause means (preview, snap, commit).
 */
export function SpanInspector({
  startMs,
  endMs,
  edge,
  onPickEdge,
  durationMs,
  minLengthMs,
  visibleStartMs,
  visibleEndMs,
  zoomMultiple,
  playheadMs,
  onEdge,
  neighbors,
  startLabel,
  endLabel,
}: {
  startMs: number;
  endMs: number;
  edge: "start" | "end";
  onPickEdge: (edge: "start" | "end") => void;
  durationMs: number;
  minLengthMs: number;
  visibleStartMs: number;
  visibleEndMs: number;
  zoomMultiple: number;
  playheadMs: number;
  onEdge: (edge: "start" | "end", ms: number, cause: SpanEdgeCause) => void;
  /** From `spanNeighbors`; omit where a span has no siblings (the loop). */
  neighbors?: { prevEndMs: number | null; nextStartMs: number | null };
  startLabel?: string;
  endLabel?: string;
}) {
  const { t } = useTranslation();
  const span = Math.max(1, durationMs);
  const legalFor = (which: "start" | "end") =>
    which === "start"
      ? { minMs: 0, maxMs: Math.max(0, endMs - minLengthMs) }
      : { minMs: Math.min(startMs + minLengthMs, span), maxMs: span };
  const clampTo = (which: "start" | "end", ms: number) => {
    const legal = legalFor(which);
    return Math.max(legal.minMs, Math.min(legal.maxMs, Math.round(ms)));
  };
  const legal = legalFor(edge);
  const currentMs = edge === "start" ? startMs : endMs;
  const { min: sliderMin, max: sliderMax } = windowedSliderBounds(
    legal.minMs,
    legal.maxMs,
    currentMs,
    visibleStartMs,
    visibleEndMs
  );
  const canUsePlayhead =
    edge === "start" ? playheadMs <= endMs - minLengthMs : playheadMs >= startMs + minLengthMs;
  // Start meets the previous span's end, end meets the next one's start, so
  // spans can sit flush without slider fiddling. Only offered when legal.
  const neighborMs = (() => {
    if (!neighbors) return null;
    if (edge === "start") {
      const prev = neighbors.prevEndMs;
      return prev != null && prev <= endMs - minLengthMs ? prev : null;
    }
    const next = neighbors.nextStartMs;
    return next != null && next >= startMs + minLengthMs ? next : null;
  })();

  return (
    <MarkInspector
      startMs={startMs}
      endMs={endMs}
      edge={edge}
      startLabel={startLabel ?? t("player.start")}
      endLabel={endLabel ?? t("player.end")}
      onPickEdge={onPickEdge}
      minMs={sliderMin}
      maxMs={sliderMax}
      onSlide={(ms) => onEdge(edge, clampTo(edge, ms), "slide")}
      onSlideCommit={(ms) => onEdge(edge, clampTo(edge, ms), "slideEnd")}
      onNudge={(deltaMs) => onEdge(edge, clampTo(edge, currentMs + deltaMs), "nudge")}
      onUsePlayhead={() => onEdge(edge, clampTo(edge, playheadMs), "playhead")}
      usePlayheadDisabled={!canUsePlayhead}
      nudgeStepMs={nudgeStepMsForZoom(zoomMultiple, MARK_NUDGE_BASE_MS, MARK_NUDGE_MIN_MS)}
      neighborLabel={
        neighborMs != null ? (edge === "start" ? t("player.snapPrevEnd") : t("player.snapNextStart")) : null
      }
      onUseNeighbor={neighborMs != null ? () => onEdge(edge, clampTo(edge, neighborMs), "neighbor") : undefined}
      // Hold a readout to type its time; the same legal range applies.
      onTypeTime={(which, ms) => onEdge(which, clampTo(which, ms), "type")}
      typeRangeFor={legalFor}
    />
  );
}
