import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { UserTextInput } from "../../../i18n";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { AppAlert } from "../../common/AppAlert";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { MagpieFragment, MagpieSpark } from "../../../types";
import type { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";

type Model = ReturnType<typeof useMagpieScreenModel>;

export function MagpieBuildStep({ model, spark }: { model: Model; spark: MagpieSpark }) {
  const fragments = [...spark.fragments].sort((a, b) => a.order - b.order);

  function confirmRebuild() {
    if (!spark.draft.trim()) {
      model.rebuildDraft();
      return;
    }
    AppAlert.destructive(
      "Rebuild from your words?",
      "This replaces the draft with the current fragment order. Your edits here will be lost.",
      model.rebuildDraft,
      { confirmLabel: "Rebuild" }
    );
  }

  return (
    <View style={styles.body}>
      <Text style={styles.hint}>Reorder, split a phrase, or tap a word to edit it.</Text>
      <View style={styles.listWrap}>
        <DraggableFlatList
          data={fragments}
          keyExtractor={(item) => item.id}
          onDragBegin={haptic.grab}
          onDragEnd={({ data }) => model.reorder(data.map((item) => item.id))}
          containerStyle={styles.listFill}
          contentContainerStyle={fragments.length === 0 ? styles.listEmptyContent : styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>No words yet — head back and pocket a few first.</Text>
          }
          renderItem={({ item, drag, isActive }: RenderItemParams<MagpieFragment>) => (
            <FragmentRow
              fragment={item}
              isDragging={isActive}
              onDrag={drag}
              onSplit={() => model.splitFragment(item.id)}
              onRemove={() => model.removeFragment(item.id)}
              onEdit={(text) => model.editFragment(item.id, text)}
            />
          )}
        />
      </View>

      <View style={styles.draftHeader}>
        <Text style={styles.draftLabel}>Your draft</Text>
        <Pressable
          style={({ pressed }) => [styles.rebuildBtn, pressed ? appStyles.pressDown : null]}
          onPress={confirmRebuild}
          hitSlop={6}
        >
          <Ionicons name="sync-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.rebuildText}>Rebuild from words</Text>
        </Pressable>
      </View>

      <View style={styles.draftCard}>
        <UserTextInput
          style={styles.draftInput}
          value={spark.draft}
          onChangeText={model.setDraft}
          multiline
          textAlignVertical="top"
          placeholder="Your pocketed words land here, one per line. Rearrange them into lines, add words between, cut what doesn't sing."
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );
}

function FragmentRow({
  fragment,
  isDragging,
  onDrag,
  onSplit,
  onRemove,
  onEdit,
}: {
  fragment: MagpieFragment;
  isDragging: boolean;
  onDrag: () => void;
  onSplit: () => void;
  onRemove: () => void;
  onEdit: (text: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const isMultiWord = fragment.text.trim().split(/\s+/).length > 1;
  const wasEdited = fragment.text.trim() !== fragment.originalText.trim();

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  return (
    <View style={[styles.row, isDragging ? styles.rowDragging : null]}>
      <Pressable onLongPress={onDrag} delayLongPress={120} hitSlop={6} style={styles.handle}>
        <Ionicons name="reorder-three" size={16} color={colors.textMuted} />
      </Pressable>

      <View style={styles.rowTextWrap}>
        {isEditing ? (
          <UserTextInput
            ref={inputRef}
            style={styles.rowInput}
            value={fragment.text}
            onChangeText={onEdit}
            onBlur={() => setIsEditing(false)}
            onSubmitEditing={() => setIsEditing(false)}
            returnKeyType="done"
            multiline
          />
        ) : (
          <Pressable onPress={() => setIsEditing(true)}>
            <Text style={styles.rowText}>{fragment.text}</Text>
            {wasEdited ? (
              <Text style={styles.editedNote} numberOfLines={1}>
                edited from “{fragment.originalText}”
              </Text>
            ) : null}
          </Pressable>
        )}
      </View>

      {isMultiWord ? (
        <Pressable onPress={onSplit} hitSlop={6} style={styles.iconBtn} accessibilityLabel="Split into words">
          <Ionicons name="cut-outline" size={15} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <Pressable onPress={onRemove} hitSlop={6} style={styles.iconBtn} accessibilityLabel="Remove">
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  hint: { ...textTokens.supporting, fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  listWrap: { flex: 1 },
  listFill: { flex: 1 },
  listContent: { paddingBottom: spacing.sm },
  listEmptyContent: { paddingVertical: spacing.xl },
  empty: { ...textTokens.supporting, fontSize: 13, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: spacing.xs,
  },
  rowDragging: { opacity: 0.9 },
  handle: { width: 24, height: 34, alignItems: "center", justifyContent: "center" },
  rowTextWrap: { flex: 1, minWidth: 0, paddingVertical: 8, paddingHorizontal: 2 },
  rowText: { fontFamily: "PlayfairDisplay_400Regular", fontSize: 16, color: colors.textPrimary },
  editedNote: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 1,
  },
  rowInput: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  iconBtn: { width: 26, height: 26, alignItems: "center", justifyContent: "center" },
  draftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  draftLabel: { ...textTokens.annotation },
  rebuildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  rebuildText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, color: colors.textSecondary },
  draftCard: {
    height: 150,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  draftInput: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
  },
});
