import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { UserTextInput } from "../../../i18n";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { Note } from "../../../types";
import { AppAlert } from "../../common/AppAlert";
import { WordFinderSheet } from "../../common/WordFinderSheet";
import { applyPickedWord, extractWordRange } from "../../../domain/wordTools";
import { useEditHistory } from "../../../hooks/useEditHistory";
import { useTranslation } from "react-i18next";

type Props = {
  note: Note;
  onBack: () => void;
  onUpdate: (updates: { title?: string; body?: string }) => void;
  onTogglePin: (noteId: string) => void;
  onDelete: (noteId: string) => void;
};

type Snapshot = { title: string; body: string };

function formatTimestamp(ts: number) {
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function NoteEditor({ note, onBack, onUpdate, onTogglePin, onDelete }: Props) {
  const { t } = useTranslation();
  const bodyRef = useRef<TextInput>(null);

  // ── Undo / redo ───────────────────────────────────────────────────────────
  // Shared history engine (src/hooks/useEditHistory) — also used by the song
  // lyrics editor so undo behaves identically in both.
  const {
    canUndo,
    canRedo,
    schedulePush: scheduleHistoryPush,
    undo: handleUndo,
    redo: handleRedo,
    reset: resetHistory,
  } = useEditHistory<Snapshot>(
    { title: note.title, body: note.body },
    (snap) => onUpdate({ title: snap.title, body: snap.body })
  );

  // Reset history whenever the user opens a different note.
  useEffect(() => {
    resetHistory({ title: note.title, body: note.body });
  }, [note.id, resetHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Delete confirmation ───────────────────────────────────────────────────
  const handleDeletePress = useCallback(() => {
    AppAlert.destructive(
      "Delete page?",
      "This can't be undone.",
      () => onDelete(note.id),
      { confirmLabel: "Delete" }
    );
  }, [note.id, onDelete]);

  // ── Auto-focus new blank notes ────────────────────────────────────────────
  useEffect(() => {
    if (!note.title && !note.body) {
      setTimeout(() => bodyRef.current?.focus(), 100);
    }
  }, [note.id]);

  // ── Android hardware back ─────────────────────────────────────────────────
  // Focus-scoped: drawer screens stay MOUNTED when the user switches pages, so
  // without the isFocused gate this editor kept swallowing hardware back presses
  // from the Metronome/Tuner/etc. while sitting invisible on the Notepad — every
  // back "worked" here off-screen instead of navigating, reading as an endless
  // loop back into the lyrics pad.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [isFocused, onBack]);

  // ── Keyboard-on-selection ─────────────────────────────────────────────────
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, []);

  const selectionRef = useRef({ start: 0, end: 0 });

  const handleSelectionChange = useCallback(
    (e: { nativeEvent: { selection: { start: number; end: number } } }) => {
      const { start, end } = e.nativeEvent.selection;
      selectionRef.current = { start, end };
      if (end > start) {
        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => bodyRef.current?.focus(), 50);
      }
    },
    []
  );

  // ── Word Finder (rhymes / thesaurus) ──────────────────────────────────────
  const [wordFinderVisible, setWordFinderVisible] = useState(false);
  const [wordFinderSeed, setWordFinderSeed] = useState("");

  const openWordFinder = useCallback(() => {
    const { start, end } = selectionRef.current;
    const range = extractWordRange(note.body, start, end);
    setWordFinderSeed(range?.word ?? "");
    setWordFinderVisible(true);
  }, [note.body]);

  const handlePickWord = useCallback(
    (word: string) => {
      const { start, end } = selectionRef.current;
      const next = applyPickedWord(note.body, start, end, word);
      onUpdate({ body: next.text });
      scheduleHistoryPush();
      selectionRef.current = { start: next.caret, end: next.caret };
      setWordFinderVisible(false);
    },
    [note.body, onUpdate, scheduleHistoryPush]
  );

  return (
    <SafeAreaView style={editorStyles.shell} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={editorStyles.header}>
          {/* Back */}
          <Pressable
            style={({ pressed }) => [editorStyles.backBtn, pressed ? styles.pressDown : null]}
            onPress={onBack}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textStrong} />
            <Text style={editorStyles.backLabel}>{t("screens.lyricsPad")}</Text>
          </Pressable>

          {/* Right-side actions */}
          <View style={editorStyles.headerActions}>
            {/* Undo — always visible; dimmed when nothing to step back to */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed && canUndo ? styles.pressDown : null]}
              onPress={handleUndo}
              disabled={!canUndo}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={20}
                color={canUndo ? colors.textStrong : colors.textMuted}
              />
            </Pressable>

            {/* Redo — always visible; dimmed when nothing to step forward to */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed && canRedo ? styles.pressDown : null]}
              onPress={handleRedo}
              disabled={!canRedo}
            >
              <Ionicons
                name="arrow-redo-outline"
                size={20}
                color={canRedo ? colors.textStrong : colors.textMuted}
              />
            </Pressable>

            <View style={editorStyles.headerDivider} />

            {/* Word finder — rhymes and similar words for the word at the cursor */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed ? styles.pressDown : null]}
              onPress={openWordFinder}
              accessibilityLabel={t("lyrics.wordFinder")}
            >
              <Ionicons name="book-outline" size={20} color={colors.textSecondary} />
            </Pressable>

            {/* Pin */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed ? styles.pressDown : null]}
              onPress={() => onTogglePin(note.id)}
            >
              <Ionicons
                name={note.isPinned ? "bookmark" : "bookmark-outline"}
                size={20}
                color={note.isPinned ? colors.primary : colors.textSecondary}
              />
            </Pressable>

            {/* Delete (with confirmation) */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed ? styles.pressDown : null]}
              onPress={handleDeletePress}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={editorStyles.scroll}
          contentContainerStyle={editorStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <UserTextInput
            style={editorStyles.title}
            value={note.title}
            onChangeText={(text) => {
              onUpdate({ title: text });
              scheduleHistoryPush();
            }}
            placeholder={t("notepad.titlePlaceholder")}
            placeholderTextColor={colors.textMuted}
            multiline={false}
            returnKeyType="next"
            blurOnSubmit
            onSubmitEditing={() => bodyRef.current?.focus()}
          />

          <Text style={editorStyles.metaText}>{formatTimestamp(note.updatedAt)}</Text>
          <View style={editorStyles.divider} />

          <UserTextInput
            ref={bodyRef}
            style={editorStyles.body}
            value={note.body}
            onChangeText={(text) => {
              onUpdate({ body: text });
              scheduleHistoryPush();
            }}
            onSelectionChange={handleSelectionChange}
            placeholder={t("notepad.writePlaceholder")}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <WordFinderSheet
        visible={wordFinderVisible}
        initialWord={wordFinderSeed}
        onClose={() => setWordFinderVisible(false)}
        onPickWord={handlePickWord}
      />
    </SafeAreaView>
  );
}

const editorStyles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.page,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backLabel: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.textStrong,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  headerDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.borderMuted,
    marginHorizontal: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.round,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 32,
    paddingVertical: 0,
    marginBottom: spacing.sm,
  },
  metaText: {
    ...textTokens.annotation,
    marginBottom: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginBottom: spacing.lg,
  },
  body: {
    ...textTokens.body,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 300,
    paddingVertical: 0,
  },
});
