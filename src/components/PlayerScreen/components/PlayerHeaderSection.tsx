import React, { useRef } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fmtDuration, formatDate } from "../../../utils";
import { colors } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";

/** Swipe-down-to-collapse, bound to the HEADER ONLY so it never contests the
 *  reel scrub, loop handles, sliders, or lyric scrolling below. */
function useDismissGesture(onMinimize: () => void) {
  const onMinimizeRef = useRef(onMinimize);
  onMinimizeRef.current = onMinimize;

  return useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        gesture.dy > 14 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > 48 || gesture.vy > 0.8) {
          onMinimizeRef.current();
        }
      },
    })
  ).current;
}

type PlayerHeaderSectionProps = {
  clipTitle: string;
  projectTitle?: string | null;
  createdAt: number;
  overdubLayerCount?: number;
  playerPosition: number;
  displayDuration: number;
  mode: "player" | "practice" | "playalong";
  onMinimize: () => void;
  onOverflow: () => void;
};

export function PlayerHeaderSection({
  clipTitle,
  projectTitle,
  createdAt,
  overdubLayerCount = 0,
  playerPosition,
  displayDuration,
  mode,
  onMinimize,
  onOverflow,
}: PlayerHeaderSectionProps) {
  const dismissGesture = useDismissGesture(onMinimize);
  const overflowButton = (label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void, size = 18) => (
    <Pressable
      style={({ pressed }) => [
        playerScreenStyles.overflowButton,
        pressed ? playerScreenStyles.overflowButtonPressed : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={size} color={colors.textStrong} />
    </Pressable>
  );

  // The player is a now-playing sheet, not a destination: its single exit is
  // the collapse chevron (top-left, where the sheet "goes down"), which never
  // stops audio — playback continues in the mini dock.

  // Collapsed (practice / play-along): title tucks into the nav row, metadata
  // hidden, so the reel sits near the top and the lyrics / practice console get
  // the vertical room.
  if (mode !== "player") {
    return (
      <View style={playerScreenStyles.headerBlock} {...dismissGesture.panHandlers}>
        <View style={grabberStyles.grabberRow}>
          <View style={grabberStyles.grabber} />
        </View>
        <View style={playerScreenStyles.navRow}>
          {overflowButton("Minimize player", "chevron-down", onMinimize, 22)}
          <Text style={playerScreenStyles.navTitle} numberOfLines={1}>
            {clipTitle}
          </Text>
          <View style={playerScreenStyles.navRowRight}>{overflowButton("More options", "ellipsis-horizontal", onOverflow)}</View>
        </View>
      </View>
    );
  }

  // Expanded (player / listening): full title + metadata.
  return (
    <View style={playerScreenStyles.headerBlock} {...dismissGesture.panHandlers}>
      <View style={grabberStyles.grabberRow}>
        <View style={grabberStyles.grabber} />
      </View>
      <View style={playerScreenStyles.navRow}>
        {overflowButton("Minimize player", "chevron-down", onMinimize, 22)}

        <View style={playerScreenStyles.navRowRight}>
          {overflowButton("More options", "ellipsis-horizontal", onOverflow)}
        </View>
      </View>

      <View style={playerScreenStyles.titleBlock}>
        <Text style={playerScreenStyles.title}>{clipTitle}</Text>
        <View style={playerScreenStyles.metaRow}>
          {projectTitle ? (
            <>
              <Text style={playerScreenStyles.metaText}>{projectTitle}</Text>
              <Text style={playerScreenStyles.metaDot}>•</Text>
            </>
          ) : null}
          <Text style={playerScreenStyles.metaText}>{formatDate(createdAt)}</Text>
          {overdubLayerCount > 0 ? (
            <>
              <Text style={playerScreenStyles.metaDot}>•</Text>
              <Text style={playerScreenStyles.metaText}>
                {overdubLayerCount} {overdubLayerCount === 1 ? "layer" : "layers"}
              </Text>
            </>
          ) : null}
          <View style={playerScreenStyles.metaSpacer} />
          <Text style={playerScreenStyles.timingText}>
            {fmtDuration(playerPosition)} / {fmtDuration(displayDuration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const grabberStyles = StyleSheet.create({
  grabberRow: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 2,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMuted,
  },
});
