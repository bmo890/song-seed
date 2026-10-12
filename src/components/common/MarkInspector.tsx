import React, { useRef, useState } from "react";
import { I18nManager, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, text } from "../../design/tokens";
import { fmtDuration } from "../../utils";
import { useTranslation } from "react-i18next";
import { ltrRow } from "../../i18n/direction";
import { Press } from "./Press";
import { Slider } from "./Slider";

/**
 * The one editor for anything that sits at a position on the reel — a pin, a section
 * edge, the loop, a trim part. Edge chips that cue the playhead, a drag slider with live
 * preview, zoom-scaled nudge carets and use-playhead.
 *
 * Shared by the player's practice drawers and the clip editor so precision feels the
 * same in both rooms; the editor especially needs it, since its edits are destructive.
 *
 * RTL law: the time axis stays put and language mirrors. Rows that map to the reel's
 * left-to-right timeline are pinned LTR (`ltrRow`); the slider mirrors, because a value
 * track reads with the language.
 */

/** Re-exported for call sites that already reach for it through the inspector. */
export { ltrRow };

/** Zoom in, nudge finer: the caret step shrinks as the reel magnifies, so a nudge is
 *  always a small move at whatever scale the musician is actually looking at.
 *  `baseMs` is the step at the reel's resting zoom; `minMs` the floor it shrinks to. */
export function nudgeStepMsForZoom(zoomMultiple: number, baseMs = 100, minMs = 10): number {
  return Math.max(minMs, Math.round(baseMs / Math.max(1, zoomMultiple)));
}

/** Pins and sections are placed by ear, not to the millisecond: a tap moves a
 *  whole second at rest (founder, 2026-10-12), halving as the reel zooms in,
 *  never finer than 50 ms. The slider and "use playhead" cover the rest. */
export const MARK_NUDGE_BASE_MS = 1000;
export const MARK_NUDGE_MIN_MS = 50;

function EdgeChip({
  label,
  timeMs,
  active,
  onPress,
}: {
  label: string;
  timeMs: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Press
      // Only ONE edge is being edited at a time; the other chip recedes so
      // there is never a question of which end the slider and nudges move.
      style={[mi.edgeChip, active ? mi.edgeChipActive : mi.edgeChipIdle]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} ${fmtDuration(timeMs)}`}
    >
      <Text style={[mi.edgeChipLabel, active ? mi.edgeChipLabelActive : null]}>{label}</Text>
      <Text style={[mi.edgeChipTime, active ? null : mi.edgeChipTimeIdle]}>
        {fmtDuration(timeMs)}
      </Text>
    </Press>
  );
}

export type MarkInspectorProps = {
  startMs: number;
  /** null for a pin — a single point in time. */
  endMs: number | null;
  edge: "start" | "end";
  onPickEdge: (edge: "start" | "end") => void;
  minMs: number;
  maxMs: number;
  onSlide: (ms: number) => void;
  onSlideCommit: (ms: number) => void;
  onNudge: (deltaMs: number) => void;
  onUsePlayhead: () => void;
  usePlayheadDisabled: boolean;
  nudgeStepMs: number;
  startLabel: string;
  endLabel: string;
  /** Replaces the default "drag is live · ‹ › ±N ms" line — the editor uses it to say
   *  whether edges are snapping to the bar grid. */
  hint?: string;
  /** Optional one-tap snap to a neighboring mark — the player's section editor uses
   *  it for "start at the previous section's end" / "end at the next section's
   *  start". Rendered only when both label and handler are given. */
  neighborLabel?: string | null;
  onUseNeighbor?: () => void;
};

export function MarkInspector({
  startMs,
  endMs,
  edge,
  onPickEdge,
  minMs,
  maxMs,
  onSlide,
  onSlideCommit,
  onNudge,
  onUsePlayhead,
  usePlayheadDisabled,
  nudgeStepMs,
  startLabel,
  endLabel,
  hint,
  neighborLabel,
  onUseNeighbor,
}: MarkInspectorProps) {
  const { t } = useTranslation();
  const [dragMs, setDragMs] = useState<number | null>(null);
  const current = edge === "start" || endMs == null ? startMs : endMs;
  const displayMs = dragMs ?? current;
  // The bounds follow the reel's view between drags; DURING a drag they hold
  // still, or the track would re-map under the thumb as the preview moves.
  const latchedBoundsRef = useRef<{ min: number; max: number } | null>(null);
  const bounds = latchedBoundsRef.current ?? { min: minMs, max: Math.max(minMs + 1, maxMs) };
  return (
    <View style={mi.inspector}>
      <View style={[mi.edgesRow, ltrRow]}>
        <EdgeChip
          label={startLabel}
          timeMs={edge === "start" ? displayMs : startMs}
          active={edge === "start" || endMs == null}
          onPress={() => onPickEdge("start")}
        />
        {endMs != null ? (
          <>
            <Text style={mi.edgeArrow}>→</Text>
            <EdgeChip
              label={endLabel}
              timeMs={edge === "end" ? displayMs : endMs}
              active={edge === "end"}
              onPress={() => onPickEdge("end")}
            />
          </>
        ) : null}
      </View>
      <View style={[mi.dragRow, ltrRow]}>
        {/* The nudge carets tick (Press: `tap`) — a detent you feel, the same
            tick the slider gives at every second. Callers no longer fire one. */}
        <Press
          style={mi.nudgeBtn}
          onPress={() => onNudge(-nudgeStepMs)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.nudgeEarlier")}
        >
          <Ionicons name="chevron-back" size={15} color={colors.textStrong} />
        </Press>
        {/* A position slider: no fill, since "how much" means nothing here. It
            ticks once a second so a drag across the window is felt, not buzzed. */}
        <Slider
          style={mi.dragSlider}
          fill={false}
          inverted={I18nManager.isRTL}
          minimumValue={bounds.min}
          maximumValue={bounds.max}
          step={50}
          detent={1000}
          value={Math.max(bounds.min, Math.min(bounds.max, current))}
          onSlidingStart={() => {
            latchedBoundsRef.current = { min: minMs, max: Math.max(minMs + 1, maxMs) };
          }}
          onValueChange={(value) => {
            const next = Math.round(value);
            setDragMs(next);
            onSlide(next);
          }}
          onSlidingComplete={(value) => {
            onSlideCommit(Math.round(value));
            setDragMs(null);
            latchedBoundsRef.current = null;
          }}
          accessibilityLabel={edge === "start" || endMs == null ? startLabel : endLabel}
        />
        <Press
          style={mi.nudgeBtn}
          onPress={() => onNudge(nudgeStepMs)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.nudgeLater")}
        >
          <Ionicons name="chevron-forward" size={15} color={colors.textStrong} />
        </Press>
        {/* Use-playhead rides the slider row it acts on — icon-only, since the
            row's job is already "move this edge". */}
        <Press
          style={mi.nudgeBtn}
          onPress={onUsePlayhead}
          disabled={usePlayheadDisabled}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.usePlayhead")}
        >
          <Ionicons name="locate-outline" size={15} color={colors.primaryDeep} />
        </Press>
      </View>
      {/* Only rendered when there is something to SAY — a snap hint from the
          editor or a neighbor to meet. "Drag is live" told nobody anything. */}
      {hint || (neighborLabel && onUseNeighbor) ? (
        <View style={mi.hintRow}>
          {hint ? (
            <Text style={mi.inspectorHint} numberOfLines={1}>
              {hint}
            </Text>
          ) : (
            <View style={mi.hintSpacer} />
          )}
          {neighborLabel && onUseNeighbor ? (
            <Press
              style={mi.usePlayheadBtn}
              onPress={onUseNeighbor}
              accessibilityRole="button"
              accessibilityLabel={neighborLabel}
            >
              <Ionicons name="magnet-outline" size={13} color={colors.primaryDeep} />
              <Text style={mi.usePlayheadText}>{neighborLabel}</Text>
            </Press>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const mi = StyleSheet.create({
  inspector: { paddingHorizontal: 10, gap: 9 },
  edgesRow: { alignItems: "center", gap: 8 },
  edgeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  edgeChipActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  edgeChipIdle: {
    opacity: 0.45,
  },
  edgeChipLabel: {
    ...text.annotation,
    fontSize: 9,
    color: colors.textSecondary,
  },
  edgeChipLabelActive: { color: colors.primaryDeep },
  edgeChipTime: {
    ...text.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontVariant: ["tabular-nums"],
  },
  edgeChipTimeIdle: {
    color: colors.textSecondary,
  },
  edgeArrow: { ...text.supporting, color: colors.textMuted },
  dragRow: { alignItems: "center", gap: 8 },
  dragSlider: { flex: 1, height: 32 },
  nudgeBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hintSpacer: { flex: 1 },
  inspectorHint: {
    ...text.annotation,
    flex: 1,
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: "none",
    color: colors.textMuted,
  },
  usePlayheadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  usePlayheadText: { ...text.caption, color: colors.primaryDeep },
});
