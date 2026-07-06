import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { withAlpha } from "../../overdub";

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
};

const LANE_HEIGHT = 15;
const LANE_GAP = 3;
const LANE_ALPHA = 0.5;
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
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
}: {
  lane: OverdubLayerLane;
  rowIndex: number;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
}) {
  // withAlpha is plain JS, not a worklet — resolve the colour here (JS thread) and only
  // capture the resulting string inside the worklet below.
  const laneColor = withAlpha(lane.color, lane.isMuted ? LANE_ALPHA_MUTED : LANE_ALPHA);
  const barStyle = useAnimatedStyle(() => {
    const leftPx = lane.offsetMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    const widthPx = Math.max(3, lane.durationMs * pixelsPerMs * timelineScale.value);
    return {
      transform: [{ translateX: leftPx }],
      width: widthPx,
      backgroundColor: laneColor,
    };
  });

  return (
    <Animated.View
      style={[
        laneStyles.bar,
        { top: rowIndex * (LANE_HEIGHT + LANE_GAP) },
        lane.isMuted ? laneStyles.barMuted : null,
        barStyle,
      ]}
    >
      <Text style={[laneStyles.label, lane.isMuted ? laneStyles.labelMuted : null]} numberOfLines={1}>
        {lane.isMuted ? `${lane.title} · muted` : lane.title}
      </Text>
    </Animated.View>
  );
}

export function OverdubLayerLanes({
  lanes,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
}: {
  lanes: OverdubLayerLane[];
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
}) {
  const visibleLanes = lanes.filter((lane) => lane.durationMs > 0);
  const { rowByLaneId, rowCount } = React.useMemo(
    () => packOverdubLaneRows(visibleLanes),
    [visibleLanes]
  );
  if (visibleLanes.length === 0) {
    return null;
  }
  return (
    <View
      style={[laneStyles.strip, { height: rowCount * (LANE_HEIGHT + LANE_GAP) - LANE_GAP }]}
      pointerEvents="none"
    >
      {visibleLanes.map((lane) => (
        <LaneBar
          key={lane.id}
          lane={lane}
          rowIndex={rowByLaneId[lane.id] ?? 0}
          pixelsPerMs={pixelsPerMs}
          timelineTranslateX={timelineTranslateX}
          timelineScale={timelineScale}
        />
      ))}
    </View>
  );
}

const laneStyles = StyleSheet.create({
  strip: {
    marginTop: 3,
    overflow: "hidden",
    position: "relative",
  },
  bar: {
    position: "absolute",
    height: LANE_HEIGHT,
    borderRadius: 4,
    justifyContent: "center",
    overflow: "hidden",
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
