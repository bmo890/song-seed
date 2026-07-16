import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, type PanGesture } from "react-native-gesture-handler";
import { IconButton } from "../../common/IconButton";
import { fmtDuration, formatDate } from "../../../utils";
import { colors } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";

type PlayerHeaderSectionProps = {
  clipTitle: string;
  projectTitle?: string | null;
  createdAt: number;
  overdubLayerCount?: number;
  playerPosition: number;
  displayDuration: number;
  mode: "player" | "practice" | "playalong";
  /** Finger-tracking drag-to-collapse — bound to the HEADER ONLY so it never
   *  contests the reel scrub, loop handles, sliders, or lyric scrolling below. */
  dragGesture: PanGesture;
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
  dragGesture,
  onMinimize,
  onOverflow,
}: PlayerHeaderSectionProps) {
  // The player is a now-playing sheet, not a destination: its single exit is
  // the collapse chevron (top-left, where the sheet "goes down"), which never
  // stops audio — playback continues in the mini dock. It leads in deep
  // terracotta; the overflow ⋯ opposite stays a quiet warm-gray. Both are bare
  // glyphs on the surface — no matching circles to confuse them.
  const collapseButton = (
    <IconButton
      icon="chevron-down"
      tone="accent"
      onPress={onMinimize}
      accessibilityLabel="Minimize player"
    />
  );
  const overflowMenuButton = (
    <IconButton
      icon="ellipsis-horizontal"
      tone="muted"
      size={20}
      onPress={onOverflow}
      accessibilityLabel="More options"
    />
  );

  // Collapsed (practice / play-along): title tucks into the nav row, metadata
  // hidden, so the reel sits near the top and the lyrics / practice console get
  // the vertical room.
  if (mode !== "player") {
    return (
      <GestureDetector gesture={dragGesture}>
        <View style={playerScreenStyles.headerBlock}>
          <View style={grabberStyles.grabberRow}>
            <View style={grabberStyles.grabber} />
          </View>
          <View style={playerScreenStyles.navRow}>
            {collapseButton}
            <Text style={playerScreenStyles.navTitle} numberOfLines={1}>
              {clipTitle}
            </Text>
            <View style={playerScreenStyles.navRowRight}>{overflowMenuButton}</View>
          </View>
        </View>
      </GestureDetector>
    );
  }

  // Expanded (player / listening): full title + metadata.
  return (
    <GestureDetector gesture={dragGesture}>
      <View style={playerScreenStyles.headerBlock}>
        <View style={grabberStyles.grabberRow}>
          <View style={grabberStyles.grabber} />
        </View>
      <View style={playerScreenStyles.navRow}>
        {collapseButton}

        <View style={playerScreenStyles.navRowRight}>
          {overflowMenuButton}
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
    </GestureDetector>
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
