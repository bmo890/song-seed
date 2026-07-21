import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { UserTextInput } from "../../../i18n";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { boardItemText } from "../../../domain/cutUp";
import type { CutUpBoardItem, CutUpChunk, CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";

type Model = ReturnType<typeof useCutUpScreenModel>;

export function CutUpBoard({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const active = useMemo(
    () => spark.boardItems.filter((item) => !item.removed).slice().sort((a, b) => a.order - b.order),
    [spark.boardItems]
  );
  const removed = useMemo(
    () => spark.boardItems.filter((item) => item.removed),
    [spark.boardItems]
  );

  return (
    <View style={styles.body}>
      <View style={styles.controls}>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed ? appStyles.pressDown : null]}
          onPress={model.shuffle}
          hitSlop={6}
        >
          <Ionicons name="shuffle-outline" size={15} color={colors.primary} />
          <Text style={styles.controlText}>Shuffle</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.controlBtn, pressed ? appStyles.pressDown : null]}
          onPress={model.resetOrder}
          hitSlop={6}
        >
          <Ionicons name="swap-vertical-outline" size={15} color={colors.textSecondary} />
          <Text style={[styles.controlText, styles.controlTextMuted]}>Source order</Text>
        </Pressable>
      </View>

      <DraggableFlatList
        data={active}
        keyExtractor={(item) => item.id}
        onDragBegin={haptic.grab}
      onDragEnd={({ data }) => model.reorder(data.map((item) => item.id))}
        containerStyle={styles.listFill}
        contentContainerStyle={active.length === 0 ? styles.listEmptyContent : styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.empty}>No strips on the board — keep some chunks back on the Cut step.</Text>
        }
        renderItem={({ item, drag, isActive }: RenderItemParams<CutUpBoardItem>) => (
          <StripRow
            item={item}
            chunks={spark.chunks}
            isDragging={isActive}
            onDrag={drag}
            onToggleLock={() => model.toggleStripLock(item.id)}
            onDuplicate={() => model.duplicateStrip(item.id)}
            onRemove={() => model.removeStrip(item.id)}
            onEdit={(text) => model.editStripText(item.id, text)}
          />
        )}
      />

      {removed.length > 0 ? (
        <View style={styles.removedSection}>
          <Text style={styles.removedLabel}>Set aside ({removed.length})</Text>
          <ScrollView style={styles.removedScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.removedWrap}>
              {removed.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.removedChip, pressed ? appStyles.pressDown : null]}
                  onPress={() => model.restoreStrip(item.id)}
                >
                  <Ionicons name="arrow-undo-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.removedChipText} numberOfLines={1}>
                    {boardItemText(item, spark.chunks)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function StripRow({
  item,
  chunks,
  isDragging,
  onDrag,
  onToggleLock,
  onDuplicate,
  onRemove,
  onEdit,
}: {
  item: CutUpBoardItem;
  chunks: CutUpChunk[];
  isDragging: boolean;
  onDrag: () => void;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onEdit: (text: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const text = boardItemText(item, chunks);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  return (
    <View
      style={[
        styles.strip,
        item.locked ? styles.stripLocked : null,
        isDragging ? styles.stripDragging : null,
      ]}
    >
      <Pressable onLongPress={onDrag} delayLongPress={120} hitSlop={6} style={styles.handle}>
        <Ionicons name="reorder-three" size={16} color={colors.textMuted} />
      </Pressable>

      {isEditing ? (
        <UserTextInput
          ref={inputRef}
          style={styles.stripInput}
          value={text}
          onChangeText={onEdit}
          onBlur={() => setIsEditing(false)}
          onSubmitEditing={() => setIsEditing(false)}
          returnKeyType="done"
          multiline
        />
      ) : (
        <Pressable style={styles.stripTextWrap} onPress={() => setIsEditing(true)}>
          <Text style={styles.stripText}>{text}</Text>
        </Pressable>
      )}

      <Pressable onPress={onToggleLock} hitSlop={6} style={styles.iconBtn}>
        <Ionicons
          name={item.locked ? "lock-closed" : "lock-open-outline"}
          size={15}
          color={item.locked ? colors.primary : colors.textMuted}
        />
      </Pressable>
      <Pressable onPress={onDuplicate} hitSlop={6} style={styles.iconBtn}>
        <Ionicons name="copy-outline" size={15} color={colors.textMuted} />
      </Pressable>
      <Pressable onPress={onRemove} hitSlop={6} style={styles.iconBtn}>
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  controls: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  controlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  controlText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.primary,
  },
  controlTextMuted: {
    color: colors.textSecondary,
  },
  listFill: { flex: 1 },
  listContent: { paddingBottom: spacing.sm },
  listEmptyContent: { paddingVertical: spacing.xl },
  empty: {
    ...textTokens.supporting,
    fontSize: 13,
    textAlign: "center",
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  stripLocked: {
    backgroundColor: colors.surfaceHigh,
  },
  stripDragging: {
    opacity: 0.9,
  },
  handle: {
    width: 24,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  stripTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  stripText: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    color: colors.textPrimary,
  },
  stripInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  iconBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  removedSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
  removedLabel: {
    ...textTokens.annotation,
    marginBottom: spacing.xs,
  },
  removedScroll: {
    maxHeight: 88,
  },
  removedWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  removedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  removedChipText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
