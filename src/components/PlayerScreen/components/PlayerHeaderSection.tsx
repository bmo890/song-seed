import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, type PanGesture } from "react-native-gesture-handler";
import { IconButton } from "../../common/IconButton";
import { fmtDuration, formatClipDate } from "../../../utils";
import { colors } from "../../../design/tokens";
import { playerScreenStyles } from "../styles";
import { useTranslation } from "react-i18next";

type PlayerHeaderSectionProps = {
  clipTitle: string;
  projectTitle?: string | null;
  createdAt: number;
  overdubLayerCount?: number;
  playerPosition: number;
  displayDuration: number;
  /** Collapsed (practice / reading): title tucks into the nav row so the reel
   *  and the open surface get the vertical room. */
  collapsed: boolean;
  /** Finger-tracking drag-to-collapse — bound to the HEADER ONLY so it never
   *  contests the reel scrub, loop handles, sliders, or lyric scrolling below. */
  dragGesture: PanGesture;
  onOverflow: () => void;
};

export function PlayerHeaderSection({
  clipTitle,
  projectTitle,
  createdAt,
  overdubLayerCount = 0,
  playerPosition,
  displayDuration,
  collapsed,
  dragGesture,
  onOverflow,
}: PlayerHeaderSectionProps) {
  const { t } = useTranslation();
  // The player is a now-playing sheet, not a destination: the grabber (drag
  // down) and the footer ✕ are its exits — no chevron doubling them. The
  // overflow ⋯ shares the title row as a quiet warm-gray bare glyph.
  const overflowMenuButton = (
    <IconButton
      icon="ellipsis-horizontal"
      tone="muted"
      size={20}
      onPress={onOverflow}
      accessibilityLabel={t("common.moreOptions")}
    />
  );

  // Collapsed (practice / reading): title tucks into the nav row, metadata
  // hidden, so the reel sits near the top and the open surface / practice
  // console get the vertical room.
  if (collapsed) {
    return (
      <GestureDetector gesture={dragGesture}>
        <View style={playerScreenStyles.headerBlock}>
          <View style={grabberStyles.grabberRow}>
            <View style={grabberStyles.grabber} />
          </View>
          <View style={playerScreenStyles.navRow}>
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
      <View style={playerScreenStyles.titleBlock}>
        <View style={playerScreenStyles.titleRow}>
          <Text style={[playerScreenStyles.title, playerScreenStyles.titleFlex]}>
            {clipTitle}
          </Text>
          {overflowMenuButton}
        </View>
        <View style={playerScreenStyles.metaRow}>
          {projectTitle ? (
            <>
              <Text style={playerScreenStyles.metaText}>{projectTitle}</Text>
              <Text style={playerScreenStyles.metaDot}>•</Text>
            </>
          ) : null}
          <Text style={playerScreenStyles.metaText}>{formatClipDate(createdAt)}</Text>
          {overdubLayerCount > 0 ? (
            <>
              <Text style={playerScreenStyles.metaDot}>•</Text>
              <Text style={playerScreenStyles.metaText}>
                {t("navigation.layerCount", { count: overdubLayerCount })}
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
