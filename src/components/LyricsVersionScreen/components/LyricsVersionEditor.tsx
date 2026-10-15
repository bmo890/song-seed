import { useRef, useState, type ReactNode } from "react";
import type {
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
  TextInputScrollEventData,
  TextInputSelectionChangeEventData,
} from "react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { styles } from "../styles";
import { WordFinderSheet } from "../../common/WordFinderSheet";
import { applyPickedWord, extractWordRange } from "../../../domain/wordTools";
import { UserTextInput, type ContentDirection } from "../../../i18n";
import { useTranslation } from "react-i18next";
import { AppAlert } from "../../common/AppAlert";
import { Button } from "../../common/Button";

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
            <Ionicons name={dirIcon("arrow-undo-outline")} size={18} color={canUndo ? colors.textStrong : colors.borderMuted} />
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
            <Ionicons name={dirIcon("arrow-redo-outline")} size={18} color={canRedo ? colors.textStrong : colors.borderMuted} />
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
              <Ionicons name="albums-outline" size={18} color={canSave ? colors.textStrong : colors.borderMuted} />
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [editorControls.iconBtn, pressed ? appStyles.pressDown : null]}
            onPress={openWordFinder}
            hitSlop={6}
            accessibilityLabel={t("lyrics.wordFinder")}
          >
            <Ionicons name="book-outline" size={18} color={colors.textStrong} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [editorControls.iconBtn, pressed ? appStyles.pressDown : null]}
            // One choice of three: the shared action sheet with radio marks,
            // not a boxed menu dropping into the page.
            onPress={() =>
              AppAlert.menu(
                t("lyrics.textDirection"),
                (["auto", "ltr", "rtl"] as ContentDirection[]).map((option) => ({
                  key: option,
                  label: t(
                    option === "auto" ? "lyrics.directionAuto" : option === "ltr" ? "lyrics.directionLtr" : "lyrics.directionRtl"
                  ),
                  icon: option === textDirection ? "radio-button-on" : "radio-button-off",
                  selected: option === textDirection,
                  noMirror: true,
                  onPress: () => onTextDirectionChange(option),
                }))
              )
            }
            hitSlop={6}
            accessibilityLabel={t("lyrics.textDirection")}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textStrong} />
          </Pressable>
        </View>
        {/* Save is the page's one primary: a soft key in the tonal wash. */}
        <Button label={t("lyrics.save")} variant="primary" onPress={onSave} disabled={!canSave} />
      </View>
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
  // Bare ink glyphs (2026-10-15): the grey discs behind them are retired.
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnDisabled: {
    opacity: 0.5,
  },
});
