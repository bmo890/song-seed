import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type QueueEntry = {
  ideaId: string;
  clipId: string;
  title: string;
  subtitle: string;
};

type PlayerQueueProps = {
  entries: QueueEntry[];
  currentClipId: string | null;
  onSelect: (index: number) => void;
  compact?: boolean;
};

export function PlayerQueue({ entries, currentClipId, onSelect, compact = false }: PlayerQueueProps) {
  if (entries.length <= 1) return null;

  return (
    <ScrollView style={{ maxHeight: compact ? 138 : 180 }} showsVerticalScrollIndicator={false}>
      <View style={styles.list}>
        {entries.map((entry, index) => {
          const isActive = entry.clipId === currentClipId;
          return (
            <Pressable
              key={`${entry.ideaId}-${entry.clipId}`}
              style={({ pressed }) => [
                styles.item,
                isActive ? styles.itemActive : null,
                pressed ? styles.itemPressed : null,
              ]}
              onPress={() => onSelect(index)}
            >
              <Text style={styles.index}>{index + 1}</Text>
              <View style={styles.itemText}>
                <Text style={[styles.title, compact ? styles.titleCompact : null]} numberOfLines={1}>
                  {entry.title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {entry.subtitle}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e6ec",
  },
  itemActive: {
    backgroundColor: "#e8f1fb",
    borderColor: "#b5cde7",
  },
  itemPressed: {
    opacity: 0.86,
  },
  index: {
    width: 20,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: "#6b7280",
    textAlign: "center",
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
    color: "#111827",
  },
  titleCompact: {
    fontSize: 14,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    color: "#64748b",
  },
});
