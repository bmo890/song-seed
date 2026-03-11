import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";

type Props = {
  text: string;
  versionLabel: string;
  updatedAtLabel: string;
};

export function PlayerLyricsPanel({ text, versionLabel, updatedAtLabel }: Props) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!text.trim()) return null;

  return (
    <View style={styles.card}>
      <View style={styles.playerLyricsHeader}>
        <View style={styles.playerLyricsHeaderText}>
          <Text style={styles.playerLyricsTitle}>Lyrics</Text>
          <Text style={styles.playerLyricsMeta}>
            {versionLabel} • {updatedAtLabel}
          </Text>
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
