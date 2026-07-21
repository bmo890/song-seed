import { useRef, useState, type ReactNode } from "react";
import type {
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  TextInputScrollEventData,
  TextInputSelectionChangeEventData,
} from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { styles } from "../styles";
import { HelpSheet, type HelpItem } from "../../common/HelpSheet";
import { WordFinderSheet } from "../../common/WordFinderSheet";
import { applyPickedWord, extractWordRange } from "../../../domain/wordTools";
import { UserTextInput, type ContentDirection } from "../../../i18n";
import { useTranslation } from "react-i18next";

type LyricsVersionEditorProps = {
  draftText: string;
  textDirection: ContentDirection;
  onTextDirectionChange: (next: ContentDirection) => void;
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
  textDirection,
  onTextDirectionChange,
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
  const { t } = useTranslation();
  const [helpVisible, setHelpVisible] = useState(false);
  const [directionMenuVisible, setDirectionMenuVisible] = useState(false);
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
    { icon: "checkmark", label: t("lyrics.save"), description: t("lyrics.saveHelp") },
    {
      icon: "arrow-undo-outline",
      label: t("lyrics.undoRedo"),
      description: t("lyrics.undoRedoHelp"),
    },
    ...(showSaveAsNew
      ? [
          {
            icon: "git-branch-outline" as const,
            label: t("lyrics.saveAsNew"),
            description: t("lyrics.saveAsNewHelp"),
          },
        ]
      : []),
    {
      icon: "book-outline",
      label: t("lyrics.wordFinder"),
      description: t("lyrics.wordFinderHelp"),
    },
    { icon: "arrow-back", label: t("lyrics.back"), description: t("lyrics.backHelp") },
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
            accessibilityLabel={t("lyrics.undo")}
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
            accessibilityLabel={t("lyrics.redo")}
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
              accessibilityLabel={t("lyrics.saveAsNew")}
            >
              <Ionicons name="git-branch-outline" size={18} color={canSave ? colors.textSecondary : colors.borderMuted} />
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [editorControls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={openWordFinder}
            hitSlop={6}
            accessibilityLabel={t("lyrics.wordFinder")}
          >
            <Ionicons name="book-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [editorControls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => setDirectionMenuVisible((visible) => !visible)}
            hitSlop={6}
            accessibilityLabel={t("lyrics.textDirection")}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [editorControls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => setHelpVisible(true)}
            hitSlop={6}
            accessibilityLabel={t("lyrics.help")}
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
          accessibilityLabel={t("lyrics.save")}
        >
          <Ionicons name="checkmark" size={20} color={canSave ? colors.onPrimary : colors.textMuted} />
        </Pressable>
      </View>
      {directionMenuVisible ? (
        <View style={editorControls.directionMenu}>
          <Text style={editorControls.directionLabel}>{t("lyrics.textDirection")}</Text>
          {(["auto", "ltr", "rtl"] as ContentDirection[]).map((option) => (
            <Pressable
              key={option}
              style={[editorControls.directionOption, option === textDirection ? editorControls.directionOptionActive : null]}
              onPress={() => {
                onTextDirectionChange(option);
                setDirectionMenuVisible(false);
              }}
            >
              <Text style={editorControls.directionOptionText}>
                {t(option === "auto" ? "lyrics.directionAuto" : option === "ltr" ? "lyrics.directionLtr" : "lyrics.directionRtl")}
              </Text>
              {option === textDirection ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={[styles.lyricsVersionDocumentFill, styles.lyricsVersionDocumentFillEdit]}>
        <View style={[styles.lyricsVersionDocumentContent, styles.lyricsVersionDocumentContentEdit]}>
          <View
            style={styles.lyricsScrollableWrap}
            onLayout={(event) => onLayout(event.nativeEvent.layout.height)}
          >
            <UserTextInput
              style={[styles.lyricsInput, styles.lyricsInputFill, styles.lyricsEditFieldActive]}
              direction={textDirection}
              multiline
              placeholder={t("lyrics.writeHere")}
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
        title={t("lyrics.editingTitle")}
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
  directionMenu: {
    alignSelf: "flex-start",
    minWidth: 220,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceHigh,
  },
  directionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  directionOption: {
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  directionOptionActive: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
  },
  directionOptionText: {
    color: colors.textStrong,
    fontSize: 14,
  },
});
