import React, { useState } from "react";
import { I18nManager, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, text } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { styles as appStyles } from "../../styles";
import { fmtDuration } from "../../utils";
import { useTranslation } from "react-i18next";

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

/** Pin a row's visual order to LTR regardless of language direction. */
export const ltrRow: ViewStyle = { flexDirection: I18nManager.isRTL ? "row-reverse" : "row" };

/** Zoom in, nudge finer: the caret step shrinks as the reel magnifies, so a nudge is
 *  always a small move at whatever scale the musician is actually looking at. */
export function nudgeStepMsForZoom(zoomMultiple: number): number {
  return Math.max(10, Math.round(100 / Math.max(1, zoomMultiple)));
}

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
    <Pressable
      style={({ pressed }) => [
        mi.edgeChip,
        active ? mi.edgeChipActive : null,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} ${fmtDuration(timeMs)}`}
    >
      <Text style={[mi.edgeChipLabel, active ? mi.edgeChipLabelActive : null]}>{label}</Text>
      <Text style={mi.edgeChipTime}>{fmtDuration(timeMs)}</Text>
    </Pressable>
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
}: MarkInspectorProps) {
  const { t } = useTranslation();
  const [dragMs, setDragMs] = useState<number | null>(null);
  const current = edge === "start" || endMs == null ? startMs : endMs;
  const displayMs = dragMs ?? current;
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
        <Pressable
          style={mi.nudgeBtn}
          onPress={() => onNudge(-nudgeStepMs)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.nudgeEarlier")}
        >
          <Ionicons name="chevron-back" size={15} color={colors.textStrong} />
        </Pressable>
        <Slider
          style={mi.dragSlider}
          inverted={I18nManager.isRTL}
          minimumValue={minMs}
          maximumValue={Math.max(minMs + 1, maxMs)}
          step={50}
          value={Math.max(minMs, Math.min(maxMs, current))}
          onValueChange={(value) => {
            const next = Math.round(value);
            setDragMs(next);
            onSlide(next);
          }}
          onSlidingComplete={(value) => {
            haptic.tap();
            onSlideCommit(Math.round(value));
            setDragMs(null);
          }}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.surfaceHigh}
          thumbTintColor={colors.primary}
        />
        <Pressable
          style={mi.nudgeBtn}
          onPress={() => onNudge(nudgeStepMs)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={t("player.nudgeLater")}
        >
          <Ionicons name="chevron-forward" size={15} color={colors.textStrong} />
        </Pressable>
      </View>
      <View style={mi.hintRow}>
        <Text style={mi.inspectorHint} numberOfLines={1}>
          {hint ?? t("player.inspectorHint", { step: nudgeStepMs })}
        </Text>
        <Pressable
          style={({ pressed }) => [
            mi.usePlayheadBtn,
            usePlayheadDisabled ? { opacity: 0.4 } : null,
            pressed ? appStyles.pressDown : null,
          ]}
          onPress={onUsePlayhead}
          disabled={usePlayheadDisabled}
          accessibilityRole="button"
          accessibilityLabel={t("player.usePlayhead")}
        >
          <Ionicons name="locate-outline" size={13} color={colors.primaryDeep} />
          <Text style={mi.usePlayheadText}>{t("player.usePlayhead")}</Text>
        </Pressable>
      </View>
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
  inspectorHint: {
    ...text.annotation,
    flexShrink: 1,
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: "none",
    color: colors.textMuted,
  },
  usePlayheadBtn: {
    marginLeft: "auto",
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
