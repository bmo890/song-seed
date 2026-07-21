import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { UserTextInput } from "../../../i18n";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { WordLadderWord } from "../../../types";

type Props = {
  label: string;
  placeholder: string;
  words: WordLadderWord[];
  targetCount?: number;
  /** Optional content rendered above the column header — used in the wizard's
   * setup step to sit the job/role (or room/place) seed input atop its list. */
  seedSlot?: ReactNode;
  onAdd: (text: string) => void;
  onEdit: (wordId: string, text: string) => void;
  onReorder: (words: WordLadderWord[]) => void;
  onRemove: (wordId: string) => void;
};

export function WordLadderColumnEditor({
  label,
  placeholder,
  words,
  targetCount = 10,
  seedSlot,
  onAdd,
  onEdit,
  onReorder,
  onRemove,
}: Props) {
  const [draft, setDraft] = useState("");

  function submitDraft() {
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  }

  // Both columns sit on a tonal panel, so chips are plain white to read
  // clearly against it (columns are distinguished by position, not tint).
  const chipBg = colors.surface;

  return (
    <View style={editorStyles.column}>
      {seedSlot ? <View style={editorStyles.seedSlot}>{seedSlot}</View> : null}
      <View style={editorStyles.headerRow}>
        <Text style={editorStyles.label}>{label}</Text>
        <Text style={editorStyles.count}>
          {words.length} of {targetCount}
        </Text>
      </View>

      <View style={editorStyles.addRow}>
        <UserTextInput
          style={editorStyles.addInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={submitDraft}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <Pressable
          style={({ pressed }) => [editorStyles.addBtn, pressed ? appStyles.pressDown : null]}
          onPress={submitDraft}
          hitSlop={6}
        >
          <Ionicons name="add" size={16} color={colors.onPrimary} />
        </Pressable>
      </View>

      <DraggableFlatList
        data={words}
        keyExtractor={(word) => word.id}
        onDragBegin={haptic.grab}
      onDragEnd={({ data }) => onReorder(data)}
        style={editorStyles.list}
        contentContainerStyle={words.length === 0 ? editorStyles.listEmptyContent : undefined}
        ListEmptyComponent={<Text style={editorStyles.emptyHint}>Nothing here yet</Text>}
        renderItem={({ item: word, drag, isActive }: RenderItemParams<WordLadderWord>) => (
          <WordChip
            word={word}
            chipBg={chipBg}
            isActive={isActive}
            onDrag={drag}
            onEdit={(text) => onEdit(word.id, text)}
            onRemove={() => onRemove(word.id)}
          />
        )}
      />
    </View>
  );
}

/** A single word in a column. Displays as plain text — tap to edit in place,
 * matching the rest of the list rather than always looking like an input. */
function WordChip({
  word,
  chipBg,
  isActive,
  onDrag,
  onEdit,
  onRemove,
}: {
  word: WordLadderWord;
  chipBg: string;
  isActive: boolean;
  onDrag: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function finishEditing() {
    setIsEditing(false);
  }

  return (
    <View
      style={[editorStyles.chipRow, { backgroundColor: chipBg }, isActive ? editorStyles.chipRowActive : null]}
    >
      {isEditing ? (
        <UserTextInput
          ref={inputRef}
          style={editorStyles.chipInput}
          value={word.text}
          onChangeText={onEdit}
          onSubmitEditing={finishEditing}
          onBlur={finishEditing}
          returnKeyType="done"
          autoFocus
        />
      ) : (
        <Pressable style={editorStyles.chipTextWrap} onPress={() => setIsEditing(true)} hitSlop={4}>
          <Text style={editorStyles.chipText} numberOfLines={1}>
            {word.text}
          </Text>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [editorStyles.dragHandle, pressed ? appStyles.pressDown : null]}
        onLongPress={onDrag}
        delayLongPress={120}
        hitSlop={6}
      >
        <Ionicons name="reorder-three" size={15} color={colors.textMuted} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [editorStyles.removeBtn, pressed ? appStyles.pressDown : null]}
        onPress={onRemove}
        hitSlop={6}
      >
        <Ionicons name="close" size={15} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const editorStyles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.lg,
    padding: spacing.sm,
  },
  seedSlot: {
    gap: 2,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  label: {
    ...textTokens.annotation,
  },
  count: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 10,
    color: colors.textMuted,
  },
  addRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  addInput: {
    flex: 1,
    minWidth: 0,
    height: 38,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textPrimary,
  },
  addBtn: {
    width: 30,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    // Content-sized up to a cap, then scrolls. A flex height collapses
    // DraggableFlatList to zero inside the column, hiding added words.
    maxHeight: 320,
  },
  listEmptyContent: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  emptyHint: {
    ...textTokens.supporting,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: spacing.xs,
    gap: 2,
  },
  chipRowActive: {
    opacity: 0.85,
  },
  chipTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  chipText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  chipInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  dragHandle: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
