import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { SharedValue, runOnJS, useAnimatedReaction, useAnimatedStyle } from "react-native-reanimated";
import { colors, text as textTokens } from "../../design/tokens";
import { styles as appStyles } from "../../styles";
import { useTranslation } from "react-i18next";
import { Press } from "./Press";
import { useLayerPrefsStore } from "../../state/useLayerPrefsStore";

/**
 * The layers a take carries, under its reel (2026-10-17, founder: "sit orderly,
 * marked, never overstimulating"). One row per layer, in the order they were
 * recorded, so adding a layer never reshuffles the others. Each row is its name
 * in a left column and its sound in ink, where it plays on the take: the
 * waveform rides the reel's own pan and zoom, so it stays glued to the tape
 * above. No colour: the shape, the name and the place tell layers apart.
 *
 * Calm at any count: past three rows the lanes scroll inside a fixed height, so
 * the reel never gets pushed around, and the header folds them away entirely.
 */

export type OverdubLayerLane = {
  id: string;
  title: string;
  offsetMs: number;
  durationMs: number;
  isMuted: boolean;
  /** The layer's own waveform (any scale); a flat line stands in without one. */
  peaks?: number[];
  /** Typed names wear Lora; machine names ("Layer 2") stay in quiet Jakarta. */
  readsAsName?: boolean;
};

const ROW_HEIGHT = 32;
/** A folded layer: its name line only. */
const ROW_HEIGHT_FOLDED = 22;
const WAVE_HEIGHT = 14;
export const MAX_VISIBLE_LANE_ROWS = 3;
const MIN_BARS = 4;
const MAX_BARS = 480;
/** One bar per this many points of drawn width (bar + gap): the same even grain
 *  at every length and zoom. Counting bars by audio length instead stretched a
 *  short layer, or any layer zoomed in, into a few bars far apart (founder,
 *  2026-10-22: "looks too stretched out"). */
export const LANE_BAR_PITCH = 3.5;

/** Bar count for a wave drawn `widthPx` wide. */
export function laneBarCount(widthPx: number): number {
  return Math.max(MIN_BARS, Math.min(MAX_BARS, Math.round(widthPx / LANE_BAR_PITCH)));
}

/** The reel's zoom, rounded to half-octaves: the bars re-cut only when the zoom
 *  has moved enough to show, not on every pinch frame. */
function zoomStep(scale: number): number {
  "worklet";
  return Math.pow(2, Math.round(Math.log2(Math.max(scale, 0.01)) * 2) / 2);
}

export function barHeights(peaks: number[] | undefined, count: number): number[] {
  if (!peaks || peaks.length === 0) {
    return new Array(count).fill(0.12);
  }
  const max = peaks.reduce((m, p) => (Number.isFinite(p) && Math.abs(p) > m ? Math.abs(p) : m), 0) || 1;
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const from = Math.floor((i / count) * peaks.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / count) * peaks.length));
    let top = 0;
    for (let j = from; j < to && j < peaks.length; j += 1) {
      const v = Math.abs(peaks[j]);
      if (Number.isFinite(v) && v > top) top = v;
    }
    out.push(Math.max(0.12, top / max));
  }
  return out;
}

function LaneWave({
  lane,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
}: {
  lane: OverdubLayerLane;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
}) {
  const [zoom, setZoom] = React.useState(() => zoomStep(timelineScale.value));
  useAnimatedReaction(
    () => zoomStep(timelineScale.value),
    (next, previous) => {
      if (next !== previous) runOnJS(setZoom)(next);
    }
  );
  const widthPx = lane.durationMs * pixelsPerMs * zoom;
  const heights = React.useMemo(() => barHeights(lane.peaks, laneBarCount(widthPx)), [lane.peaks, widthPx]);
  const placement = useAnimatedStyle(() => ({
    transform: [{ translateX: lane.offsetMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value }],
    width: Math.max(3, lane.durationMs * pixelsPerMs * timelineScale.value),
  }));
  return (
    <Animated.View style={[laneStyles.wave, placement]} pointerEvents="none">
      {heights.map((h, index) => (
        <View
          key={index}
          style={[
            laneStyles.bar,
            lane.isMuted ? laneStyles.barMuted : null,
            { height: Math.max(2, Math.round(h * WAVE_HEIGHT)) },
          ]}
        />
      ))}
    </Animated.View>
  );
}

function LaneRow({
  lane,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  onOpenLane,
}: {
  lane: OverdubLayerLane;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  onOpenLane?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const folded = useLayerPrefsStore((state) => state.collapsedLayerIds.includes(lane.id));
  const label = lane.isMuted ? `${lane.title} · ${t("player.mutedShort")}` : lane.title;
  const name = (
    <Text
      style={[
        laneStyles.nameText,
        lane.readsAsName ? laneStyles.nameTyped : laneStyles.nameMachine,
        lane.isMuted ? laneStyles.nameMuted : null,
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );
  const body = folded ? (
    name
  ) : (
    <>
      {name}
      <View style={laneStyles.track}>
        <View style={[laneStyles.baseline, lane.isMuted ? laneStyles.baselineMuted : null]} />
        <LaneWave
          lane={lane}
          pixelsPerMs={pixelsPerMs}
          timelineTranslateX={timelineTranslateX}
          timelineScale={timelineScale}
        />
      </View>
    </>
  );
  const rowStyle = [laneStyles.row, folded ? laneStyles.rowFolded : null];
  return (
    <View style={laneStyles.rowWrap}>
      {onOpenLane ? (
        <Pressable
          // Haptics: none of its own — the bench it opens is navigation (silent).
          style={({ pressed }) => [...rowStyle, laneStyles.rowFill, pressed ? appStyles.pressDown : null]}
          onPress={() => onOpenLane(lane.id)}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          {body}
        </Pressable>
      ) : (
        <View style={[...rowStyle, laneStyles.rowFill]}>{body}</View>
      )}
      <LayerFoldKey layerId={lane.id} title={lane.title} folded={folded} />
    </View>
  );
}

/** One layer's fold: a small chevron at the end of its name line. */
export function LayerFoldKey({
  layerId,
  title,
  folded,
  inline = false,
}: {
  layerId: string;
  title: string;
  folded: boolean;
  /** In a row of controls (the bench) rather than over a lane's name line. */
  inline?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Press
      feel="glyph"
      // Haptics vocabulary: `tap` — a control toggles.
      style={inline ? laneStyles.foldKeyInline : laneStyles.foldKey}
      onPress={() => useLayerPrefsStore.getState().toggleLayerCollapsed(layerId)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ expanded: !folded }}
      accessibilityLabel={folded ? t("player.expandLayer", { title }) : t("player.collapseLayer", { title })}
    >
      <Ionicons name={folded ? "chevron-down" : "chevron-up"} size={13} color={colors.textMuted} />
    </Press>
  );
}

/** "Collapse all" / "Expand all" for one take's layers: collapses all while any
 *  layer is open, expands all once every layer is folded. */
export function LayerFoldAllKey({ layerIds }: { layerIds: string[] }) {
  const { t } = useTranslation();
  const allFolded = useLayerPrefsStore(
    (state) => layerIds.length > 0 && layerIds.every((id) => state.collapsedLayerIds.includes(id))
  );
  if (layerIds.length === 0) return null;
  return (
    <Press
      feel="glyph"
      // Haptics vocabulary: `tap` — a control toggles.
      style={laneStyles.foldAll}
      onPress={() => useLayerPrefsStore.getState().setLayersCollapsed(layerIds, !allFolded)}
      hitSlop={8}
      accessibilityRole="button"
    >
      <Text style={laneStyles.foldAllText}>
        {allFolded ? t("player.expandLayers") : t("player.collapseLayers")}
      </Text>
    </Press>
  );
}

export function OverdubLayerLanes({
  lanes,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  onOpenLane,
  collapsed,
  onToggleCollapsed,
}: {
  lanes: OverdubLayerLane[];
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  /** A lane is the door to its layer on the bench. Omit for a read-only stack. */
  onOpenLane?: (id: string) => void;
  /** With a toggle, a quiet "Layers · n" header folds the lanes away. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t } = useTranslation();
  const visibleLanes = lanes.filter((lane) => lane.durationMs > 0);
  if (visibleLanes.length === 0) {
    return null;
  }
  const isCollapsed = !!onToggleCollapsed && !!collapsed;
  const rows = visibleLanes.map((lane) => (
    <LaneRow
      key={lane.id}
      lane={lane}
      pixelsPerMs={pixelsPerMs}
      timelineTranslateX={timelineTranslateX}
      timelineScale={timelineScale}
      onOpenLane={onOpenLane}
    />
  ));
  const scrolls = visibleLanes.length > MAX_VISIBLE_LANE_ROWS;
  const layerIds = visibleLanes.map((lane) => lane.id);

  return (
    <View style={laneStyles.block}>
      {onToggleCollapsed ? (
        <View style={laneStyles.headerRow}>
        <Pressable
          // Haptics vocabulary: `tap` — a control toggles.
          style={({ pressed }) => [laneStyles.header, pressed ? appStyles.pressDown : null]}
          onPress={onToggleCollapsed}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="button"
          accessibilityState={{ expanded: !isCollapsed }}
          accessibilityLabel={isCollapsed ? t("player.showLayers") : t("player.hideLayers")}
        >
          <Text style={laneStyles.headerText}>
            {t("player.layerCountHeader", { count: visibleLanes.length })}
          </Text>
          <Ionicons
            name={isCollapsed ? "chevron-down" : "chevron-up"}
            size={13}
            color={colors.textSecondary}
          />
        </Pressable>
        {isCollapsed ? null : <LayerFoldAllKey layerIds={layerIds} />}
        </View>
      ) : null}
      {isCollapsed ? null : scrolls ? (
        <ScrollView
          style={{ maxHeight: MAX_VISIBLE_LANE_ROWS * ROW_HEIGHT }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {rows}
        </ScrollView>
      ) : (
        rows
      )}
    </View>
  );
}

const laneStyles = StyleSheet.create({
  block: {
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginBottom: 2,
  },
  headerText: {
    ...textTokens.annotation,
    color: colors.textSecondary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  foldAll: {
    paddingVertical: 4,
  },
  foldAllText: {
    ...textTokens.annotation,
    color: colors.textSecondary,
  },
  // The fold key rides over the end of the name line, so the lane keeps the
  // reel's full width and its waveform stays on the reel's timeline.
  rowWrap: {
    position: "relative",
  },
  rowFill: {},
  row: {
    height: ROW_HEIGHT,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  rowFolded: {
    height: ROW_HEIGHT_FOLDED,
    justifyContent: "center",
  },
  nameText: {
    paddingEnd: 32,
  },
  foldKeyInline: {
    width: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  foldKey: {
    position: "absolute",
    top: 0,
    end: 0,
    width: 28,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  nameTyped: {
    fontFamily: "Lora_500Medium",
    fontSize: 12,
    lineHeight: 15,
    color: colors.textStrong,
  },
  nameMachine: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  nameMuted: {
    color: colors.textMuted,
  },
  track: {
    height: WAVE_HEIGHT + 2,
    justifyContent: "center",
  },
  baseline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: (WAVE_HEIGHT + 2) / 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderSubtle,
  },
  baselineMuted: {
    height: 0,
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderSubtle,
  },
  wave: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bar: {
    width: 1.6,
    borderRadius: 1,
    backgroundColor: colors.textStrong,
    opacity: 0.42,
  },
  barMuted: {
    opacity: 0.14,
  },
});
