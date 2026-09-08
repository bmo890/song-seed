import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  /** Tapping the grabber closes the sheet — the card's handle is also its exit. */
  onDismiss: () => void;
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
  onDismiss,
  onOverflow,
}: PlayerHeaderSectionProps) {
  const { t } = useTranslation();
  const grabber = (
    <Pressable
      style={grabberStyles.grabberRow}
      onPress={onDismiss}
      hitSlop={{ top: 8, bottom: 10, left: 40, right: 40 }}
      accessibilityRole="button"
      accessibilityLabel={t("common.closePlayer")}
    >
      <View style={grabberStyles.grabber} />
    </Pressable>
  );
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
          {grabber}
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
        {grabber}
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
  // Visible on paper: the old borderMuted sliver all but vanished, which is how a
  // draggable sheet got mistaken for a page (2026-09-07).
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
});
