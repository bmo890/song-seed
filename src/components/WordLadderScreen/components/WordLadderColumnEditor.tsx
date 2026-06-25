import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import DraggableFlatList, { type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { WordLadderWord } from "../../../types";

type Props = {
  label: string;
  placeholder: string;
  words: WordLadderWord[];
  targetCount?: number;
  tint: "a" | "b";
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
  tint,
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

  const chipBg = tint === "a" ? colors.surfaceHigh : colors.surface;

  return (
    <View style={editorStyles.column}>
      <View style={editorStyles.headerRow}>
        <Text style={editorStyles.label}>{label}</Text>
        <Text style={editorStyles.count}>
          {words.length} of ~{targetCount}
        </Text>
      </View>

      <View style={editorStyles.addRow}>
        <TextInput
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
          <Ionicons name="add" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>

      <DraggableFlatList
        data={words}
        keyExtractor={(word) => word.id}
        onDragEnd={({ data }) => onReorder(data)}
        style={editorStyles.list}
        ListEmptyComponent={<Text style={editorStyles.emptyHint}>Nothing here yet — add a word above.</Text>}
        renderItem={({ item: word, drag, isActive }: RenderItemParams<WordLadderWord>) => (
          <View
            style={[
              editorStyles.chipRow,
              { backgroundColor: chipBg },
              isActive ? editorStyles.chipRowActive : null,
            ]}
          >
            <TextInput
              style={editorStyles.chipInput}
              value={word.text}
              onChangeText={(text) => onEdit(word.id, text)}
            />
            <Pressable
              style={({ pressed }) => [editorStyles.dragHandle, pressed ? appStyles.pressDown : null]}
              onLongPress={drag}
              delayLongPress={120}
              hitSlop={6}
            >
              <Ionicons name="reorder-three" size={15} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [editorStyles.removeBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => onRemove(word.id)}
              hitSlop={6}
            >
              <Ionicons name="close" size={15} color={colors.textMuted} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const editorStyles = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
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
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textPrimary,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    maxHeight: 320,
  },
  emptyHint: {
    ...textTokens.supporting,
    fontSize: 12,
    paddingVertical: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    marginBottom: spacing.xs,
    gap: 4,
  },
  chipRowActive: {
    opacity: 0.85,
  },
  chipInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textStrong,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  dragHandle: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
