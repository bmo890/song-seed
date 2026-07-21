import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { UserText, UserTextInput } from "../../../i18n";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { AppAlert } from "../../common/AppAlert";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { MagpieFragment, MagpieSpark } from "../../../types";
import type { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useMagpieScreenModel>;

export function MagpieBuildStep({ model, spark }: { model: Model; spark: MagpieSpark }) {
  const { t } = useTranslation();
  const fragments = [...spark.fragments].sort((a, b) => a.order - b.order);

  function confirmRebuild() {
    if (!spark.draft.trim()) {
      model.rebuildDraft();
      return;
    }
    AppAlert.destructive(
      t("magpie.rebuildTitle"),
      t("magpie.rebuildBody"),
      model.rebuildDraft,
      { confirmLabel: t("magpie.rebuild") }
    );
  }

  return (
    <View style={styles.body}>
      <Text style={styles.hint}>{t("magpie.buildHint")}</Text>
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
            <Text style={styles.empty}>{t("magpie.noWords")}</Text>
          }
          renderItem={({ item, drag, isActive }: RenderItemParams<MagpieFragment>) => (
            <FragmentRow
              fragment={item}
              isDragging={isActive}
              onDrag={drag}
              onSplit={() => model.splitFragment(item.id)}
              onRemove={() => model.removeFragment(item.id)}
              onEdit={(text) => model.editFragment(item.id, text)}
              editedFromLabel={(text) => t("magpie.editedFrom", { text })}
              splitLabel={t("magpie.splitWords")}
              removeLabel={t("magpie.remove")}
            />
          )}
        />
      </View>

      <View style={styles.draftHeader}>
        <Text style={styles.draftLabel}>{t("magpie.yourDraft")}</Text>
        <Pressable
          style={({ pressed }) => [styles.rebuildBtn, pressed ? appStyles.pressDown : null]}
          onPress={confirmRebuild}
          hitSlop={6}
        >
          <Ionicons name="sync-outline" size={13} color={colors.textSecondary} />
          <Text style={styles.rebuildText}>{t("magpie.rebuildFromWords")}</Text>
        </Pressable>
      </View>

      <View style={styles.draftCard}>
        <UserTextInput
          style={styles.draftInput}
          value={spark.draft}
          onChangeText={model.setDraft}
          multiline
          textAlignVertical="top"
          placeholder={t("magpie.draftPlaceholder")}
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
  editedFromLabel,
  splitLabel,
  removeLabel,
}: {
  fragment: MagpieFragment;
  isDragging: boolean;
  onDrag: () => void;
  onSplit: () => void;
  onRemove: () => void;
  onEdit: (text: string) => void;
  editedFromLabel: (text: string) => string;
  splitLabel: string;
  removeLabel: string;
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
            <UserText style={styles.rowText}>{fragment.text}</UserText>
            {wasEdited ? (
              <UserText style={styles.editedNote} value={fragment.originalText} numberOfLines={1}>
                {editedFromLabel(fragment.originalText)}
              </UserText>
            ) : null}
          </Pressable>
        )}
      </View>

      {isMultiWord ? (
        <Pressable onPress={onSplit} hitSlop={6} style={styles.iconBtn} accessibilityLabel={splitLabel}>
          <Ionicons name="cut-outline" size={15} color={colors.textMuted} />
        </Pressable>
      ) : null}
      <Pressable onPress={onRemove} hitSlop={6} style={styles.iconBtn} accessibilityLabel={removeLabel}>
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
