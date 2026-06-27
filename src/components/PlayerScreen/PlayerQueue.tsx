import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../../design/tokens";

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

function PlayerQueueInner({ entries, currentClipId, onSelect, compact = false }: PlayerQueueProps) {
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
              <Text style={[styles.index, isActive ? styles.indexActive : null]}>{index + 1}</Text>
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

export const PlayerQueue = React.memo(PlayerQueueInner);

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
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceContainer,
  },
  itemActive: {
    backgroundColor: colors.surfaceHigh,
  },
  itemPressed: {
    opacity: 0.86,
  },
  index: {
    width: 20,
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textMuted,
    textAlign: "center",
  },
  indexActive: {
    color: colors.primary,
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  titleCompact: {
    fontSize: 14,
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
});
