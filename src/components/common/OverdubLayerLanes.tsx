import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { withAlpha } from "../../domain/overdub";
import { colors } from "../../design/tokens";
import { haptic } from "../../design/haptics";
import { dirIcon } from "../../design/directionalIcons";

/**
 * Slim lanes under an audio reel marking where each (un-flattened) overdub layer sits on
 * the master's timeline, each tinted in its layer colour and carrying its name. Rows are
 * packed automatically (interval partitioning): layers that don't meaningfully overlap in
 * time share a row; a layer that overlaps others is pushed to its own row. So a stack of
 * spot layers stays one compact row, while a full-length layer over a spot one splits —
 * no collisions, no more rows than the actual overlap depth. Bars ride the reel's own
 * pan/zoom transform, so they stay glued to the waveform above. Purely indicative: no
 * gestures, mixing lives in the Layers sheet.
 */

export type OverdubLayerLane = {
  id: string;
  title: string;
  offsetMs: number;
  durationMs: number;
  color: string;
  isMuted: boolean;
  /** The base take's lane in the bench selector: selectable, but it never slides —
   *  it IS the timeline. */
  fixed?: boolean;
};

const LANE_HEIGHT = 15;
/** Bench selector: the same lanes, fattened into per-layer touch targets. */
const LANE_HEIGHT_SELECTABLE = 24;
const LANE_GAP = 3;
const LANE_ALPHA = 0.5;
const LANE_ALPHA_SELECTED = 0.85;
/** Muted layers drop to a faint wash so they read as "off" without vanishing. */
const LANE_ALPHA_MUTED = 0.16;
/** A later layer may still share a row if it overlaps the row's occupant by at most this
 *  fraction of the shorter bar — a small edge overlap reads fine (labels sit at each
 *  bar's start), a real overlap forces a new row. */
const SHARE_ROW_OVERLAP_FRACTION = 0.2;

/** Greedy interval partitioning → row index per lane (temporal, so zoom-independent). */
export function packOverdubLaneRows(lanes: OverdubLayerLane[]): {
  rowByLaneId: Record<string, number>;
  rowCount: number;
} {
  const sorted = [...lanes].sort(
    (a, b) => a.offsetMs - b.offsetMs || b.durationMs - a.durationMs
  );
  const rows: { maxEnd: number; maxEndDur: number }[] = [];
  const rowByLaneId: Record<string, number> = {};

  for (const lane of sorted) {
    const start = lane.offsetMs;
    const end = lane.offsetMs + lane.durationMs;
    let placed = -1;
    for (let r = 0; r < rows.length; r += 1) {
      const overlap = Math.max(0, rows[r].maxEnd - start);
      const allowed = SHARE_ROW_OVERLAP_FRACTION * Math.min(lane.durationMs, rows[r].maxEndDur);
      if (overlap <= allowed) {
        placed = r;
        break;
      }
    }
    if (placed === -1) {
      placed = rows.length;
      rows.push({ maxEnd: end, maxEndDur: lane.durationMs });
    } else if (end > rows[placed].maxEnd) {
      rows[placed] = { maxEnd: end, maxEndDur: lane.durationMs };
    }
    rowByLaneId[lane.id] = placed;
  }

  return { rowByLaneId, rowCount: rows.length };
}

function LaneBar({
  lane,
  rowIndex,
  laneHeight,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  isSelected = false,
  onPressLane,
  onDragEnd,
  dragResetToken = 0,
}: {
  lane: OverdubLayerLane;
  rowIndex: number;
  laneHeight: number;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  isSelected?: boolean;
  onPressLane?: (id: string) => void;
  onDragEnd?: (id: string, deltaMs: number, msPerPx: number) => void;
  dragResetToken?: number;
}) {
  // withAlpha is plain JS, not a worklet — resolve the colour here (JS thread) and only
  // capture the resulting string inside the worklet below.
  const laneColor = withAlpha(
    lane.color,
    lane.isMuted ? LANE_ALPHA_MUTED : isSelected ? LANE_ALPHA_SELECTED : LANE_ALPHA
  );

  // Coarse placement (2026-08-07): the SELECTED lane slides along the tape — same
  // long-press-then-pan family as the loop's move pill. The preview delta lives on the
  // UI thread; the owner commits (and may beat-snap) on release, and the bar holds its
  // dragged position until the committed offset (or the reset token) lands back.
  const dragDeltaMs = useSharedValue(0);
  const draggable = isSelected && !!onDragEnd && !lane.fixed;
  React.useEffect(() => {
    dragDeltaMs.value = 0;
  }, [lane.offsetMs, dragResetToken, dragDeltaMs]);
  const dragGesture = React.useMemo(() => {
    if (!draggable || !onDragEnd) {
      return null;
    }
    return Gesture.Pan()
      .activateAfterLongPress(220)
      .onStart(() => {
        // Drag lift (haptics vocabulary: grab).
        runOnJS(haptic.grab)();
      })
      .onChange((event) => {
        const pxPerMs = pixelsPerMs * timelineScale.value;
        if (pxPerMs <= 0) {
          return;
        }
        dragDeltaMs.value = event.translationX / pxPerMs;
      })
      .onEnd((event) => {
        const pxPerMs = pixelsPerMs * timelineScale.value;
        if (pxPerMs <= 0) {
          dragDeltaMs.value = 0;
          return;
        }
        runOnJS(onDragEnd)(lane.id, event.translationX / pxPerMs, 1 / pxPerMs);
      })
      .onFinalize((_event, success) => {
        if (!success) {
          dragDeltaMs.value = 0;
        }
      });
  }, [draggable, onDragEnd, lane.id, pixelsPerMs, timelineScale, dragDeltaMs]);

  const barStyle = useAnimatedStyle(() => {
    const leftPx =
      (lane.offsetMs + dragDeltaMs.value) * pixelsPerMs * timelineScale.value +
      timelineTranslateX.value;
    const widthPx = Math.max(3, lane.durationMs * pixelsPerMs * timelineScale.value);
    return {
      transform: [{ translateX: leftPx }],
      width: widthPx,
      backgroundColor: laneColor,
    };
  });

  const content = (
    <Text style={[laneStyles.label, lane.isMuted ? laneStyles.labelMuted : null]} numberOfLines={1}>
      {lane.isMuted ? `${lane.title} · muted` : lane.title}
    </Text>
  );

  const bar = (
    <Animated.View
      style={[
        laneStyles.bar,
        { top: rowIndex * (laneHeight + LANE_GAP), height: laneHeight },
        lane.isMuted ? laneStyles.barMuted : null,
        isSelected ? { borderWidth: 1.5, borderColor: lane.color, borderStyle: "solid" } : null,
        barStyle,
      ]}
    >
      {onPressLane ? (
        <Pressable
          style={laneStyles.laneTouch}
          onPress={() => onPressLane(lane.id)}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={lane.title}
        >
          {content}
        </Pressable>
      ) : (
        content
      )}
    </Animated.View>
  );

  if (!dragGesture) {
    return bar;
  }
  return <GestureDetector gesture={dragGesture}>{bar}</GestureDetector>;
}

export function OverdubLayerLanes({
  lanes,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  onPress,
  accessibilityLabel,
  selectedLaneId,
  onPressLane,
  onLaneDragEnd,
  laneDragResetToken,
}: {
  lanes: OverdubLayerLane[];
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  /** Lane-as-portal (2026-08-06): the lane is where layers live on the tape, so
   *  the lane is the door to the mixer. Omit to keep it purely indicative. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Bench selector mode (2026-08-07): lanes fatten into per-layer touch
   *  targets; the selected lane deepens and takes a border in its own colour. */
  selectedLaneId?: string | null;
  onPressLane?: (id: string) => void;
  /** Selected-lane slide: release hands the owner the delta (and the ms-per-px of the
   *  current zoom, for a snap tolerance that means the same distance on any zoom). */
  onLaneDragEnd?: (id: string, deltaMs: number, msPerPx: number) => void;
  /** Bumped by the owner after every drag commit — even a no-op one — so the preview
   *  delta always resets, including when a snap lands back on the original offset. */
  laneDragResetToken?: number;
}) {
  const selectable = !!onPressLane;
  const laneHeight = selectable ? LANE_HEIGHT_SELECTABLE : LANE_HEIGHT;
  const visibleLanes = lanes.filter((lane) => lane.durationMs > 0);
  const { rowByLaneId, rowCount } = React.useMemo(
    () => packOverdubLaneRows(visibleLanes),
    [visibleLanes]
  );
  if (visibleLanes.length === 0) {
    return null;
  }
  const stripHeight = rowCount * (laneHeight + LANE_GAP) - LANE_GAP;
  const bars = visibleLanes.map((lane) => (
    <LaneBar
      key={lane.id}
      lane={lane}
      rowIndex={rowByLaneId[lane.id] ?? 0}
      laneHeight={laneHeight}
      pixelsPerMs={pixelsPerMs}
      timelineTranslateX={timelineTranslateX}
      timelineScale={timelineScale}
      isSelected={selectable && lane.id === selectedLaneId}
      onPressLane={onPressLane}
      onDragEnd={onLaneDragEnd}
      dragResetToken={laneDragResetToken}
    />
  ));
  if (selectable) {
    // Selector mode: the strip is not a door — each lane answers for itself.
    return <View style={[laneStyles.strip, { height: stripHeight }]}>{bars}</View>;
  }
  if (!onPress) {
    return (
      <View style={[laneStyles.strip, { height: stripHeight }]} pointerEvents="none">
        {bars}
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [
        laneStyles.strip,
        { height: stripHeight },
        pressed ? laneStyles.stripPressed : null,
      ]}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 6 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {bars}
      {/* Trailing chevron pinned off the timeline: the strip is a door, not just paint. */}
      <View style={laneStyles.chevron} pointerEvents="none">
        <Ionicons name={dirIcon("chevron-forward")} size={12} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

const laneStyles = StyleSheet.create({
  strip: {
    marginTop: 3,
    overflow: "hidden",
    position: "relative",
  },
  stripPressed: {
    opacity: 0.7,
  },
  chevron: {
    position: "absolute",
    top: 0,
    bottom: 0,
    end: 2,
    justifyContent: "center",
  },
  bar: {
    position: "absolute",
    height: LANE_HEIGHT,
    borderRadius: 4,
    justifyContent: "center",
    overflow: "hidden",
  },
  laneTouch: {
    flex: 1,
    justifyContent: "center",
  },
  barMuted: {
    borderWidth: 1,
    borderColor: "rgba(122, 106, 100, 0.4)",
    borderStyle: "dashed",
  },
  label: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 9,
    lineHeight: 11,
    color: "#4a3f3b",
    paddingHorizontal: 5,
  },
  labelMuted: {
    color: "#9a8b83",
    fontStyle: "italic",
  },
});
