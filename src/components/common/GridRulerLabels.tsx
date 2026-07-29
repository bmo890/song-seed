import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, SharedValue } from "react-native-reanimated";
import type { GridRulerModel } from "../../domain/gridRuler";
import { text } from "../../design/tokens";

/**
 * Bar numbers and tempo/meter change labels riding the reel's top edge, scrolling with the
 * tape (section badges own the bottom edge, the grid annotation owns the top). Display-only:
 * pointer-events stay off so the reel underneath remains fully scrubbable.
 *
 * ONE animated view carries the whole layer. Each label used to own its own
 * `useAnimatedStyle`, which meant N separate view-prop commits per frame — and nothing
 * guarantees N independent commits land in the same frame as each other or as the Skia
 * canvas underneath, so the labels visibly swam against the bar lines they name. A single
 * transform can't tear against itself: the labels are laid out once in content space and
 * the layer moves as one rigid sheet.
 */

type Props = {
  model: GridRulerModel;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  /** Numeric tape scale (AudioReel's overscale). Labels are positioned with it at layout
   *  time rather than reading the animated twin per frame — scaling the layer would scale
   *  the glyphs, and the value only moves during a brief overscale tween. */
  scale: number;
  /** Ink for the annotation — palette-aware, supplied by the reel. */
  color: string;
};

export function GridRulerLabels({
  model,
  pixelsPerMs,
  timelineTranslateX,
  scale,
  color,
}: Props) {
  const layerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: timelineTranslateX.value }],
  }));

  return (
    <View style={labelStyles.layer} pointerEvents="none">
      <Animated.View style={[labelStyles.layer, layerStyle]}>
        {model.barLabels.map((label) => (
          <View
            key={`bar-${label.bar}`}
            style={[labelStyles.wrap, { left: label.ms * pixelsPerMs * scale + 3 }]}
          >
            <Text style={[labelStyles.barNumber, { color }]}>{label.bar}</Text>
          </View>
        ))}
        {model.changeMarkers.map((marker) => (
          <View
            key={`change-${marker.bar}`}
            style={[labelStyles.wrap, { left: marker.ms * pixelsPerMs * scale + 3 }]}
          >
            <Text style={[labelStyles.changeLabel, { color }]}>{marker.label}</Text>
          </View>
        ))}
      </Animated.View>
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
