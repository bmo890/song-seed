import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SegmentedControl } from "../../common/SegmentedControl";
import { fmtDuration, formatDate } from "../../../utils";
import { styles } from "../../../styles";
import { playerScreenStyles } from "../styles";

type PlayerHeaderSectionProps = {
  clipTitle: string;
  projectTitle?: string | null;
  createdAt: number;
  overdubLayerCount?: number;
  playerPosition: number;
  displayDuration: number;
  mode: "player" | "practice";
  onBack: () => void;
  onOverflow: () => void;
  onChangeMode: (mode: "player" | "practice") => void;
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
  onOverflow,
  onChangeMode,
}: PlayerHeaderSectionProps) {
  return (
    <View style={playerScreenStyles.headerBlock}>
      <View style={playerScreenStyles.navRow}>
        <Pressable style={({ pressed }) => [styles.backBtn, pressed ? styles.pressDown : null]} onPress={onBack}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            playerScreenStyles.overflowButton,
            pressed ? playerScreenStyles.overflowButtonPressed : null,
          ]}
          onPress={onOverflow}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color="#111827" />
        </Pressable>
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

      <SegmentedControl
        options={[
          { key: "player", label: "Player" },
          { key: "practice", label: "Practice" },
        ]}
        value={mode}
        onChange={onChangeMode}
      />
    </View>
  );
}
