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
  /** Numeric tape scale (AudioReel's overscale) — lets every band be laid out once in
   *  content space instead of being re-measured on the UI thread each frame. */
  scale: number;
};

const BADGE_HEIGHT = 16;
const PAD = 2;

/**
 * Display-only labels pinned to the bottom-left of each section band, scrolling with the
 * reel. Pointer-events are disabled so the reel underneath stays fully scrubbable.
 *
 * Every band is laid out ONCE in content space inside a single translating layer. Only the
 * left-edge pinning — the label sliding along its band so it stays readable while the band
 * scrolls off — is animated, and it is a transform, not a size. The badge used to animate
 * `maxWidth`, which ran a layout pass on the UI thread every frame for every badge; a badge
 * that has to be measured each frame cannot stay glued to the tape it names. Clipping is
 * now the band box's job, which costs nothing per frame.
 */
function SectionLabel({
  section,
  pixelsPerMs,
  timelineTranslateX,
  scale,
}: {
  section: ClipSection;
  pixelsPerMs: number;
  timelineTranslateX: SharedValue<number>;
  scale: number;
}) {
  const color = getSectionColor(section);
  const startX = section.startMs * pixelsPerMs * scale;
  const bandWidth = Math.max(0, (section.endMs - section.startMs) * pixelsPerMs * scale);

  const slideStyle = useAnimatedStyle(() => {
    // How far the label must slide along its own band to stay at the reel's left edge.
    // Zero while the band start is still on-screen; grows as the band scrolls out.
    const offscreen = PAD - (startX + timelineTranslateX.value);
    const slide = Math.max(0, offscreen);
    const available = bandWidth - slide - PAD;
    return {
      transform: [{ translateX: slide }],
      opacity: available > 6 ? 1 : 0,
    };
  });

  if (bandWidth <= 0) return null;

  return (
    <View style={[badgeStyles.band, { left: startX, width: bandWidth }]}>
      <Animated.View style={[badgeStyles.wrap, { backgroundColor: color }, slideStyle]}>
        <Text style={[badgeStyles.text, { maxWidth: bandWidth - PAD * 2 }]} numberOfLines={1}>
          {section.label}
        </Text>
      </Animated.View>
    </View>
  );
}

export function SectionLabelBadges({
  sections,
  pixelsPerMs,
  timelineTranslateX,
  scale,
}: Props) {
  const layerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: timelineTranslateX.value }],
  }));

  return (
    <View style={badgeStyles.layer} pointerEvents="none">
      <Animated.View style={[badgeStyles.layer, layerStyle]}>
        {sections.map((section) => (
          <SectionLabel
            key={section.id}
            section={section}
            pixelsPerMs={pixelsPerMs}
            timelineTranslateX={timelineTranslateX}
            scale={scale}
          />
        ))}
      </Animated.View>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
  band: {
    position: "absolute",
    bottom: 3,
    height: BADGE_HEIGHT,
    overflow: "hidden",
  },
  wrap: {
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
