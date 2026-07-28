import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, SharedValue } from "react-native-reanimated";
import type { GridRulerModel } from "../../domain/gridRuler";
import { text } from "../../design/tokens";

/**
 * Bar numbers and tempo/meter change labels riding the reel's top edge, scrolling and
 * scaling with the tape (same live-transform pattern as SectionLabelBadges — section
 * badges own the bottom edge, the grid annotation owns the top). Display-only:
 * pointer-events stay off so the reel underneath remains fully scrubbable. The model
 * caps label counts, so the per-label animated styles stay cheap.
 */

type Props = {
  model: GridRulerModel;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  /** Ink for the annotation — palette-aware, supplied by the reel. */
  color: string;
};

function RidingLabel({
  ms,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  children,
}: {
  ms: number;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
  children: React.ReactNode;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const x = ms * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    return { transform: [{ translateX: x + 3 }] };
  });
  return (
    <Animated.View style={[labelStyles.wrap, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

export function GridRulerLabels({
  model,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
  color,
}: Props) {
  return (
    <View style={labelStyles.layer} pointerEvents="none">
      {model.barLabels.map((label) => (
        <RidingLabel
          key={`bar-${label.bar}`}
          ms={label.ms}
          pixelsPerMs={pixelsPerMs}
          timelineTranslateX={timelineTranslateX}
          timelineScale={timelineScale}
        >
          <Text style={[labelStyles.barNumber, { color }]}>{label.bar}</Text>
        </RidingLabel>
      ))}
      {model.changeMarkers.map((marker) => (
        <RidingLabel
          key={`change-${marker.bar}`}
          ms={marker.ms}
          pixelsPerMs={pixelsPerMs}
          timelineTranslateX={timelineTranslateX}
          timelineScale={timelineScale}
        >
          <Text style={[labelStyles.changeLabel, { color }]}>{marker.label}</Text>
        </RidingLabel>
      ))}
    </View>
  );
}

const labelStyles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  wrap: {
    position: "absolute",
    top: 2,
    alignSelf: "flex-start",
  },
  barNumber: {
    fontFamily: text.annotation.fontFamily,
    fontSize: 8.5,
    letterSpacing: 0.4,
    opacity: 0.55,
    fontVariant: ["tabular-nums"],
  },
  changeLabel: {
    fontFamily: text.annotation.fontFamily,
    fontSize: 8.5,
    letterSpacing: 0.4,
    opacity: 0.85,
    fontVariant: ["tabular-nums"],
  },
});
