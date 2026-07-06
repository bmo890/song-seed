import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

/**
 * Slim lanes under an audio reel marking where each (un-flattened) overdub layer sits on
 * the master's timeline. Bars ride the reel's own pan/zoom transform (same shared values),
 * so they stay glued to the waveform above — a layer punched in at the chorus draws as a
 * short bar starting under the chorus. Purely indicative: no gestures, mixing lives in
 * the Layers sheet.
 */

export type OverdubLayerLane = {
  id: string;
  offsetMs: number;
  durationMs: number;
};

const LANE_HEIGHT = 5;
const LANE_GAP = 3;
const MAX_LANES = 4;

function LaneBar({
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
  const barStyle = useAnimatedStyle(() => {
    const leftPx = lane.offsetMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    const widthPx = Math.max(3, lane.durationMs * pixelsPerMs * timelineScale.value);
    return {
      transform: [{ translateX: leftPx }],
      width: widthPx,
    };
  });

  return <Animated.View style={[laneStyles.bar, barStyle]} />;
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
  const visibleLanes = lanes.filter((lane) => lane.durationMs > 0).slice(0, MAX_LANES);
  if (visibleLanes.length === 0) {
    return null;
  }
  return (
    <View
      style={[laneStyles.strip, { height: visibleLanes.length * (LANE_HEIGHT + LANE_GAP) }]}
      pointerEvents="none"
    >
      {visibleLanes.map((lane, index) => (
        <View key={lane.id} style={[laneStyles.laneRow, { top: index * (LANE_HEIGHT + LANE_GAP) }]}>
          <LaneBar
            lane={lane}
            pixelsPerMs={pixelsPerMs}
            timelineTranslateX={timelineTranslateX}
            timelineScale={timelineScale}
          />
        </View>
      ))}
    </View>
  );
}

const laneStyles = StyleSheet.create({
  strip: {
    marginTop: 3,
    overflow: "hidden",
  },
  laneRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: LANE_HEIGHT,
  },
  bar: {
    position: "absolute",
    height: LANE_HEIGHT,
    borderRadius: LANE_HEIGHT / 2,
    backgroundColor: "rgba(180, 103, 90, 0.55)",
  },
});
