import { useRef, useState, type ReactNode } from "react";
import type {
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  TextInputScrollEventData,
  TextInputSelectionChangeEventData,
} from "react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { styles } from "../styles";
import { HelpSheet, type HelpItem } from "../../common/HelpSheet";
import { WordFinderSheet } from "../../common/WordFinderSheet";
import { applyPickedWord, extractWordRange } from "../../../wordTools";

type LyricsVersionEditorProps = {
  draftText: string;
  canSave: boolean;
  showSaveAsNew: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onChangeText: (next: string) => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onLayout: (height: number) => void;
  onContentSizeChange: (event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => void;
  onScroll: (event: NativeSyntheticEvent<TextInputScrollEventData>) => void;
  scrollIndicator: ReactNode;
};

export function LyricsVersionEditor({
  draftText,
  canSave,
  showSaveAsNew,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onChangeText,
  onSave,
  onSaveAsNew,
  onLayout,
  onContentSizeChange,
  onScroll,
  scrollIndicator,
}: LyricsVersionEditorProps) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [wordFinderVisible, setWordFinderVisible] = useState(false);
  const [wordFinderSeed, setWordFinderSeed] = useState("");
  // Tracked in a ref: selection moves on every keystroke and shouldn't re-render.
  const selectionRef = useRef({ start: 0, end: 0 });

  const handleSelectionChange = (
    event: NativeSyntheticEvent<TextInputSelectionChangeEventData>
  ) => {
    selectionRef.current = event.nativeEvent.selection;
  };

  const openWordFinder = () => {
    const { start, end } = selectionRef.current;
    const range = extractWordRange(draftText, start, end);
    setWordFinderSeed(range?.word ?? "");
    setWordFinderVisible(true);
  };

  const handlePickWord = (word: string) => {
    const { start, end } = selectionRef.current;
    const next = applyPickedWord(draftText, start, end, word);
    onChangeText(next.text);
    selectionRef.current = { start: next.caret, end: next.caret };
    setWordFinderVisible(false);
  };

  const helpItems: HelpItem[] = [
    { icon: "checkmark", label: "Save", description: "Save your changes to this version." },
    {
      icon: "arrow-undo-outline",
      label: "Undo / redo",
      description: "Step back and forward through this editing session's changes.",
    },
    ...(showSaveAsNew
      ? [
          {
            icon: "git-branch-outline" as const,
            label: "Save as new",
            description: "Keep this version and save your edits as a new one.",
          },
        ]
      : []),
    {
      icon: "book-outline",
      label: "Word finder",
      description:
        "Rhymes, near rhymes, and similar words for the word at your cursor. Tap a word to drop it into the lyric.",
    },
    { icon: "arrow-back", label: "Back", description: "Return to the version — you'll be asked before discarding edits." },
  ];

  return (
    <View style={styles.flexFill}>
      <View style={editorControls.row}>
        <View style={editorControls.group}>
          <Pressable
            style={({ pressed }) => [
              editorControls.iconBtn,
              !canUndo ? editorControls.iconBtnDisabled : null,
              pressed && canUndo ? appStyles.pressDown : null,
            ]}
            onPress={onUndo}
            disabled={!canUndo}
            hitSlop={6}
            accessibilityLabel="Undo"
          >
            <Ionicons name="arrow-undo-outline" size={18} color={canUndo ? colors.textSecondary : colors.borderMuted} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              editorControls.iconBtn,
              !canRedo ? editorControls.iconBtnDisabled : null,
              pressed && canRedo ? appStyles.pressDown : null,
            ]}
            onPress={onRedo}
            disabled={!canRedo}
            hitSlop={6}
            accessibilityLabel="Redo"
          >
            <Ionicons name="arrow-redo-outline" size={18} color={canRedo ? colors.textSecondary : colors.borderMuted} />
          </Pressable>
          {showSaveAsNew ? (
            <Pressable
              style={({ pressed }) => [
                editorControls.iconBtn,
                !canSave ? editorControls.iconBtnDisabled : null,
                pressed && canSave ? appStyles.pressDown : null,
              ]}
              onPress={onSaveAsNew}
              disabled={!canSave}
              hitSlop={6}
              accessibilityLabel="Save as new"
            >
              <Ionicons name="git-branch-outline" size={18} color={canSave ? colors.textSecondary : colors.borderMuted} />
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [editorControls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={openWordFinder}
            hitSlop={6}
            accessibilityLabel="Word finder"
          >
            <Ionicons name="book-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [editorControls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => setHelpVisible(true)}
            hitSlop={6}
            accessibilityLabel="Help"
          >
            <Ionicons name="help-circle-outline" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Pressable
          style={({ pressed }) => [
            editorControls.saveBtn,
            !canSave ? editorControls.saveBtnDisabled : null,
            pressed && canSave ? appStyles.pressDown : null,
          ]}
          onPress={onSave}
          disabled={!canSave}
          hitSlop={6}
          accessibilityLabel="Save"
        >
          <Ionicons name="checkmark" size={20} color={canSave ? colors.onPrimary : colors.textMuted} />
        </Pressable>
      </View>
      <View style={[styles.lyricsVersionDocumentFill, styles.lyricsVersionDocumentFillEdit]}>
        <View style={[styles.lyricsVersionDocumentContent, styles.lyricsVersionDocumentContentEdit]}>
          <View
            style={styles.lyricsScrollableWrap}
            onLayout={(event) => onLayout(event.nativeEvent.layout.height)}
          >
            <TextInput
              style={[styles.lyricsInput, styles.lyricsInputFill, styles.lyricsEditFieldActive]}
              multiline
              placeholder="Write your lyrics here"
              value={draftText}
              onChangeText={onChangeText}
              onSelectionChange={handleSelectionChange}
              textAlignVertical="top"
              scrollEnabled
              onContentSizeChange={onContentSizeChange}
              onScroll={onScroll}
            />
            {scrollIndicator}
          </View>
        </View>
      </View>

      <HelpSheet
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        title="Editing lyrics"
        intro="Type your lyrics, then save — over this version, or as a new one."
        items={helpItems}
      />

      <WordFinderSheet
        visible={wordFinderVisible}
        initialWord={wordFinderSeed}
        onClose={() => setWordFinderVisible(false)}
        onPickWord={handlePickWord}
      />
    </View>
  );
}

const editorControls = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDisabled: {
    opacity: 0.5,
  },
  saveBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    backgroundColor: colors.surfaceHigh,
  },
});
