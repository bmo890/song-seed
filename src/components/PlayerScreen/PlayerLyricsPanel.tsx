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
};

function getAutoscrollLabel(state?: LyricsAutoscrollState) {
  if (!state) return null;
  if (state.mode === "follow") return "Autoscroll ready";
  if (state.mode === "manual") return "Manual lyrics";
  return "Autoscroll off";
}

export function PlayerLyricsPanel({ text, versionLabel, updatedAtLabel, autoscrollState }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);
  const autoscrollLabel = getAutoscrollLabel(autoscrollState);

  if (!text.trim()) return null;

  return (
    <View style={styles.card}>
      <View style={styles.playerLyricsHeader}>
        <View style={styles.playerLyricsHeaderText}>
          <Text style={styles.playerLyricsTitle}>Lyrics</Text>
          <Text style={styles.playerLyricsMeta}>
            {versionLabel} • {updatedAtLabel}
          </Text>
          {autoscrollLabel ? <Text style={styles.playerLyricsSyncMeta}>{autoscrollLabel}</Text> : null}
        </View>
        <Pressable
          style={styles.playerLyricsToggleBtn}
          onPress={() => setIsExpanded((prev) => !prev)}
          hitSlop={6}
        >
          <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#4b5563" />
        </Pressable>
      </View>

      {isExpanded ? (
        <View style={styles.playerLyricsBody}>
          <ScrollView
            style={styles.playerLyricsScroll}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            persistentScrollbar
            scrollEventThrottle={16}
          >
            <Text style={styles.playerLyricsText}>{text}</Text>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
