import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { UserText, UserTextInput } from "../../../i18n";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "../../common/Press";
import { useSparkTextScale } from "../../common/sparkTextScale";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { WordLadderWord } from "../../../types";
import { useTranslation } from "react-i18next";

type Props = {
  label: string;
  placeholder: string;
  words: WordLadderWord[];
  targetCount?: number;
  /** The column's seed (job or place), sat above its list. */
  seedSlot?: ReactNode;
  /** What the step asks for, shown only while the list is empty. */
  emptyHint?: ReactNode;
  onAdd: (text: string) => void;
  /** Sprinkles a few dataset words matched to the seed into the column. */
  onSuggest?: () => void;
  onEdit: (wordId: string, text: string) => void;
  onReorder: (words: WordLadderWord[]) => void;
  onRemove: (wordId: string) => void;
};

/**
 * One Word Ladder list, a step of its own (2026-10-17): the seed, then the
 * words as rows on paper under a small-caps label, an add row in ink, and
 * Suggest as a quiet link. No panel, no chips. Holding a row's grip lifts it:
 * grab as it lifts, tick per row crossed, light as it lands (the drag sentence
 * in haptics.ts).
 */
export function WordLadderColumnEditor({
  label,
  placeholder,
  words,
  targetCount = 10,
  seedSlot,
  emptyHint,
  onAdd,
  onSuggest,
  onEdit,
  onReorder,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const { size } = useSparkTextScale();
  const wordFont = { fontSize: size - 1 };

  // The add field is uncontrolled: the native field owns its text and we read
  // it from a ref. A controlled field raced fast typing: a Return could land
  // before the last keystroke's render (dropping a letter, "trowe") and a
  // stale render could put the old word back after the field was cleared.
  const latest = useRef("");
  const addInput = useRef<TextInput>(null);
  function addDraft(text = latest.current) {
    if (!text.trim()) return false;
    onAdd(text);
    latest.current = "";
    addInput.current?.clear();
    return true;
  }
  // Return adds too. Haptics vocabulary: light, a small state flip (a word
  // joins the list); the ink + fires the same verb through Press.
  function submitFromKeyboard(text: string) {
    if (addDraft(text)) haptic.light();
  }

  const footer = (
    <>
      <View style={s.addRow}>
        <Press
          feel="glyph"
          haptic="light"
          style={s.addGlyph}
          onPress={() => addDraft()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={placeholder}
        >
          <Ionicons name="add" size={17} color={colors.primaryDeep} />
        </Press>
        <UserTextInput
          ref={addInput}
          style={[s.addInput, wordFont]}
          onChangeText={(text) => {
            latest.current = text;
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={(event) => submitFromKeyboard(event.nativeEvent.text)}
          returnKeyType="done"
          blurOnSubmit={false}
          autoCapitalize="none"
        />
      </View>
      {onSuggest ? (
        <Press
          // Haptics vocabulary: light, words arrive.
          feel="glyph"
          haptic="light"
          style={s.suggest}
          onPress={onSuggest}
          hitSlop={6}
          accessibilityRole="button"
        >
          <Ionicons name="sparkles-outline" size={14} color={colors.primaryDeep} />
          <Text style={s.suggestText}>{t("wordLadder.suggestWords")}</Text>
        </Press>
      ) : null}
    </>
  );

  return (
    <View style={s.column}>
      {seedSlot}
      <View style={s.headerRow}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.count}>{t("wordLadder.count", { count: words.length, target: targetCount })}</Text>
      </View>

      <DraggableFlatList
        data={words}
        keyExtractor={(word) => word.id}
        onDragBegin={() => haptic.grab()}
        onPlaceholderIndexChange={() => haptic.tick()}
        onDragEnd={({ data, from, to }) => {
          haptic.light();
          if (from !== to) onReorder(data);
        }}
        style={s.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={emptyHint ? <>{emptyHint}</> : null}
        ListFooterComponent={footer}
        renderItem={({ item: word, drag, isActive }: RenderItemParams<WordLadderWord>) => (
          <ScaleDecorator activeScale={1.02}>
            <WordRow
              word={word}
              isActive={isActive}
              fontStyle={wordFont}
              onDrag={drag}
              onEdit={(text) => onEdit(word.id, text)}
              onRemove={() => onRemove(word.id)}
            />
          </ScaleDecorator>
        )}
      />
    </View>
  );
}

/** A word on its row: tap the word to edit it in place, ✕ removes it (the
 *  screen offers Undo), hold the grip to lift it. */
function WordRow({
  word,
  isActive,
  fontStyle,
  onDrag,
  onEdit,
  onRemove,
}: {
  word: WordLadderWord;
  isActive: boolean;
  fontStyle: { fontSize: number };
  onDrag: () => void;
  onEdit: (text: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  return (
    <View style={[s.row, isActive ? s.rowLifted : null]}>
      {isEditing ? (
        <UserTextInput
          ref={inputRef}
          style={[s.word, s.wordInput, fontStyle]}
          value={word.text}
          onChangeText={onEdit}
          onSubmitEditing={() => setIsEditing(false)}
          onBlur={() => setIsEditing(false)}
          returnKeyType="done"
          autoCapitalize="none"
        />
      ) : (
        <Press
          feel="still"
          style={s.wordWrap}
          onPress={() => setIsEditing(true)}
          accessibilityRole="button"
          accessibilityLabel={word.text}
        >
          <UserText style={[s.word, fontStyle]} numberOfLines={1}>
            {word.text}
          </UserText>
        </Press>
      )}
      {isActive ? null : (
        <Press
          feel="glyph"
          style={s.rowKey}
          onPress={onRemove}
          hitSlop={{ top: 6, bottom: 6 }}
          accessibilityRole="button"
          accessibilityLabel={t("wordLadder.removeWord", { word: word.text })}
        >
          <Ionicons name="close" size={15} color={colors.textMuted} />
        </Press>
      )}
      <Press
        // The drag owns its sentence (grab, tick, light), so the grip says nothing itself.
        feel="glyph"
        haptic="none"
        style={s.rowKey}
        onLongPress={onDrag}
        delayLongPress={150}
        hitSlop={{ top: 6, bottom: 6 }}
        accessibilityRole="button"
        accessibilityLabel={t("wordLadder.moveWord", { word: word.text })}
      >
        <Ionicons name="reorder-three" size={18} color={isActive ? colors.textStrong : colors.textMuted} />
      </Press>
    </View>
  );
}

const s = StyleSheet.create({
  column: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingTop: spacing.lg,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  label: {
    ...textTokens.annotation,
  },
  count: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 11,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
    backgroundColor: colors.page,
  },
  rowLifted: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderBottomWidth: 0,
    paddingLeft: spacing.sm,
    ...shadows.cardActive,
  },
  wordWrap: {
    flex: 1,
    minWidth: 0,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  word: {
    fontFamily: "Lora_500Medium",
    fontSize: 16,
    color: colors.textPrimary,
  },
  wordInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  rowKey: {
    width: 30,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderMuted,
  },
  addGlyph: {
    width: 22,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  addInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 0,
  },
  suggest: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    minHeight: 40,
  },
  suggestText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primaryDeep,
  },
});
