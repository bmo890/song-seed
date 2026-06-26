import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { CHUNK_MODE_OPTIONS } from "../../../cutUp";
import type { CutUpChunk, CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";

type Model = ReturnType<typeof useCutUpScreenModel>;

export function CutUpChunkEditor({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeMode = spark.chunkMode;
  const includedCount = spark.chunks.filter((chunk) => chunk.included).length;
  const selected = selectedId ? spark.chunks.find((chunk) => chunk.id === selectedId) ?? null : null;
  const selectedIndex = selected ? spark.chunks.findIndex((chunk) => chunk.id === selected.id) : -1;
  const canMerge = selectedIndex >= 0 && selectedIndex < spark.chunks.length - 1;

  return (
    <View style={styles.body}>
      <View style={styles.modeRow}>
        <View style={styles.segment}>
          {CHUNK_MODE_OPTIONS.map((option) => {
            const active = activeMode === option.key;
            return (
              <Pressable
                key={option.key}
                style={[styles.segmentBtn, active ? styles.segmentBtnActive : null]}
                onPress={() => model.setChunkMode(option.key)}
              >
                <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
          {activeMode === "custom" ? (
            <View style={[styles.segmentBtn, styles.segmentBtnActive]}>
              <Text style={[styles.segmentText, styles.segmentTextActive]}>Custom</Text>
            </View>
          ) : null}
        </View>
        <Pressable
          style={({ pressed }) => [styles.recutBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => {
            setSelectedId(null);
            model.recut();
          }}
          hitSlop={6}
        >
          <Ionicons name="refresh-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.recutText}>Re-cut</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Tap a chunk to keep or drop it · long-press to split or join · {includedCount} kept
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.flow}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {spark.chunks.length === 0 ? (
          <Text style={styles.empty}>No chunks yet — go back and add some source text.</Text>
        ) : (
          spark.chunks.map((chunk) => (
            <ChunkPill
              key={chunk.id}
              chunk={chunk}
              selected={chunk.id === selectedId}
              onPress={() => model.toggleChunk(chunk.id)}
              onLongPress={() => setSelectedId((cur) => (cur === chunk.id ? null : chunk.id))}
            />
          ))
        )}
      </ScrollView>

      {selected ? (
        <View style={styles.actionBar}>
          <Text style={styles.actionLabel} numberOfLines={1}>
            “{selected.text}”
          </Text>
          <View style={styles.actionBtns}>
            <ActionButton
              icon="cut-outline"
              label="Split"
              onPress={() => {
                model.split(selected.id);
                setSelectedId(null);
              }}
            />
            <ActionButton
              icon="git-merge-outline"
              label="Join next"
              disabled={!canMerge}
              onPress={() => {
                model.merge(selected.id);
                setSelectedId(null);
              }}
            />
            <ActionButton icon="close" label="Done" onPress={() => setSelectedId(null)} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ChunkPill({
  chunk,
  selected,
  onPress,
  onLongPress,
}: {
  chunk: CutUpChunk;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        !chunk.included ? styles.pillExcluded : null,
        selected ? styles.pillSelected : null,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
    >
      <Text
        style={[styles.pillText, !chunk.included ? styles.pillTextExcluded : null]}
        numberOfLines={2}
      >
        {chunk.text}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        disabled ? styles.actionBtnDisabled : null,
        pressed && !disabled ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={4}
    >
      <Ionicons name={icon} size={15} color={disabled ? colors.textMuted : colors.primary} />
      <Text style={[styles.actionBtnText, disabled ? styles.actionBtnTextDisabled : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    padding: 3,
    flexShrink: 1,
  },
  segmentBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
  },
  segmentBtnActive: {
    backgroundColor: colors.surface,
  },
  segmentText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.textPrimary,
  },
  recutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  recutText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  hint: {
    ...textTokens.supporting,
    fontSize: 11,
    marginBottom: spacing.sm,
  },
  scroll: { flex: 1 },
  flow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignContent: "flex-start",
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  empty: {
    ...textTokens.supporting,
    fontSize: 13,
    textAlign: "center",
    width: "100%",
    paddingVertical: spacing.xl,
  },
  pill: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    maxWidth: "100%",
  },
  pillExcluded: {
    backgroundColor: colors.surfaceContainer,
    opacity: 0.55,
  },
  pillSelected: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  pillTextExcluded: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  actionBar: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  actionLabel: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xs,
  },
  actionBtns: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 9,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  actionBtnDisabled: {
    opacity: 0.5,
  },
  actionBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.primary,
  },
  actionBtnTextDisabled: {
    color: colors.textMuted,
  },
});
