import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, SharedValue } from "react-native-reanimated";
import type { ClipSection } from "../../types";
import { getSectionColor } from "../../domain/playerSections";
import { colors } from "../../design/tokens";

type Props = {
  sections: ClipSection[];
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
};

const BADGE_HEIGHT = 16;
const MIN_BADGE_WIDTH = 18;

/** Display-only labels pinned to the bottom-left of each section band, scrolling/scaling with
 *  the reel. Pointer-events are disabled so the reel underneath stays fully scrubbable. */
function SectionLabel({
  section,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
}: {
  section: ClipSection;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  timelineScale: SharedValue<number>;
}) {
  const color = getSectionColor(section);
  const animatedStyle = useAnimatedStyle(() => {
    const startX = section.startMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    const endX = section.endMs * pixelsPerMs * timelineScale.value + timelineTranslateX.value;
    // When zoomed, the band scrolls left under a fixed playhead. Pin the label to the reel's
    // left edge while any part of the band is still on-screen, then let it ride out with the
    // band's right edge so it disappears exactly when the section leaves the reel.
    const PAD = 2;
    const left = Math.max(PAD, startX + PAD);
    const available = endX - left - PAD;
    return {
      transform: [{ translateX: left }],
      maxWidth: Math.max(0, available),
      opacity: available > 6 ? 1 : 0,
    };
  });

  return (
    <Animated.View style={[badgeStyles.wrap, { backgroundColor: color }, animatedStyle]}>
      <Text style={badgeStyles.text} numberOfLines={1}>
        {section.label}
      </Text>
    </Animated.View>
  );
}

export function SectionLabelBadges({
  sections,
  pixelsPerMs,
  timelineTranslateX,
  timelineScale,
}: Props) {
  return (
    <View style={badgeStyles.layer} pointerEvents="none">
      {sections.map((section) => (
        <SectionLabel
          key={section.id}
          section={section}
          pixelsPerMs={pixelsPerMs}
          timelineTranslateX={timelineTranslateX}
          timelineScale={timelineScale}
        />
      ))}
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  wrap: {
    position: "absolute",
    bottom: 3,
    height: BADGE_HEIGHT,
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: 3,
    alignSelf: "flex-start",
  },
  text: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 9.5,
    color: colors.surface,
  },
});
