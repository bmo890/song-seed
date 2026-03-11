import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { LyricsAutoscrollState } from "../../types";

type Props = {
  text: string;
  versionLabel: string;
  updatedAtLabel: string;
  autoscrollState?: LyricsAutoscrollState;
  variant?: "default" | "recording";
  expanded?: boolean;
  defaultExpanded?: boolean;
  onToggleExpanded?: (expanded: boolean) => void;
};

function getAutoscrollLabel(state?: LyricsAutoscrollState) {
  if (!state) return null;
  if (state.mode === "follow") return "Autoscroll ready";
  if (state.mode === "manual") return "Manual lyrics";
  return "Autoscroll off";
}

export function PlayerLyricsPanel({
  text,
  versionLabel,
  updatedAtLabel,
  autoscrollState,
  variant = "default",
  expanded,
  defaultExpanded = true,
  onToggleExpanded,
}: Props) {
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const autoscrollLabel = getAutoscrollLabel(autoscrollState);
  const isRecordingVariant = variant === "recording";
  const isExpanded = expanded ?? uncontrolledExpanded;

  if (!text.trim()) return null;

  function handleToggle() {
    const nextExpanded = !isExpanded;
    if (expanded === undefined) {
      setUncontrolledExpanded(nextExpanded);
    }
    onToggleExpanded?.(nextExpanded);
  }

  return (
    <View style={isRecordingVariant ? styles.recordingLyricsPanel : styles.card}>
      <View style={[styles.playerLyricsHeader, isRecordingVariant ? styles.recordingLyricsHeader : null]}>
        <View style={styles.playerLyricsHeaderText}>
          <Text style={[styles.playerLyricsTitle, isRecordingVariant ? styles.recordingLyricsTitle : null]}>Lyrics</Text>
          <Text style={[styles.playerLyricsMeta, isRecordingVariant ? styles.recordingLyricsMeta : null]}>
            {versionLabel} • {updatedAtLabel}
          </Text>
          {autoscrollLabel ? (
            <Text style={[styles.playerLyricsSyncMeta, isRecordingVariant ? styles.recordingLyricsSyncMeta : null]}>
              {autoscrollLabel}
            </Text>
          ) : null}
        </View>
        <Pressable
          style={[styles.playerLyricsToggleBtn, isRecordingVariant ? styles.recordingLyricsToggleBtn : null]}
          onPress={handleToggle}
          hitSlop={6}
        >
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#4b5563" />
        </Pressable>
      </View>

      {isExpanded ? (
        <View style={[styles.playerLyricsBody, isRecordingVariant ? styles.recordingLyricsBody : null]}>
          <ScrollView
            style={[styles.playerLyricsScroll, isRecordingVariant ? styles.recordingLyricsScroll : null]}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            persistentScrollbar
            scrollEventThrottle={16}
          >
            <Text style={[styles.playerLyricsText, isRecordingVariant ? styles.recordingLyricsText : null]}>{text}</Text>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
