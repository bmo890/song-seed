import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fmtDuration, formatDate } from "../../../utils";
import { styles } from "../../../styles";
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
  onBack: () => void;
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
  onBack,
  onMinimize,
  onOverflow,
}: PlayerHeaderSectionProps) {
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

  // Collapsed (practice / play-along): title tucks into the nav row, metadata
  // hidden, so the reel sits near the top and the lyrics / practice console get
  // the vertical room.
  if (mode !== "player") {
    return (
      <View style={playerScreenStyles.headerBlock}>
        <View style={playerScreenStyles.navRow}>
          {overflowButton("Back", "chevron-back", onBack, 22)}
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
    <View style={playerScreenStyles.headerBlock}>
      <View style={playerScreenStyles.navRow}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed ? styles.pressDown : null]} onPress={onBack}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>

        <View style={playerScreenStyles.navRowRight}>
          {overflowButton("Minimize player", "chevron-down", onMinimize, 22)}
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
