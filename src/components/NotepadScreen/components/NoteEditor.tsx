import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { UserTextInput, resolveContentDirection, contentDirectionStyle } from "../../../i18n";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { styles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { ContentDirection, Note } from "../../../types";
import { AppAlert } from "../../common/AppAlert";
import { WordFinderSheet } from "../../common/WordFinderSheet";
import { applyPickedWord, extractWordRange } from "../../../domain/wordTools";
import { useEditHistory } from "../../../hooks/useEditHistory";
import { useDraftText } from "../../../hooks/useDraftText";
import { useTranslation } from "react-i18next";

type Props = {
  note: Note;
  onBack: () => void;
  onUpdate: (updates: { title?: string; body?: string; textDirection?: ContentDirection }) => void;
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

  // Both fields commit on a pause, not per keystroke: a character used to
  // write the whole notes array into the store, notify every mounted selector
  // (the spark tools and Search included) and re-arm the manifest. The history
  // push moves to the commit, so undo steps are per pause and read a store
  // that already holds the text. Drafts are flushed before back and before a
  // word-tool apply, which both read the committed body.
  const commitTitle = useCallback(
    (title: string) => {
      onUpdate({ title });
      scheduleHistoryPush();
    },
    [onUpdate, scheduleHistoryPush]
  );
  const commitBody = useCallback(
    (body: string) => {
      onUpdate({ body });
      scheduleHistoryPush();
    },
    [onUpdate, scheduleHistoryPush]
  );
  const titleDraft = useDraftText(note.title, commitTitle);
  const bodyDraft = useDraftText(note.body, commitBody);
  const flushDrafts = useCallback(() => {
    titleDraft.flush();
    bodyDraft.flush();
  }, [titleDraft, bodyDraft]);
  const handleBack = useCallback(() => {
    flushDrafts();
    onBack();
  }, [flushDrafts, onBack]);

  // ── Delete confirmation ───────────────────────────────────────────────────
  const handleDeletePress = useCallback(() => {
    AppAlert.destructive(
      t("notepad.deletePageTitle"),
      t("notepad.deletePageBody"),
      () => onDelete(note.id),
      { confirmLabel: t("common.delete") }
    );
  }, [note.id, onDelete, t]);

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
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [isFocused, handleBack]);

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

  // ── Text direction ────────────────────────────────────────────────────────
  // "auto" resolves the whole field by its first strong character, which guesses
  // wrong on mixed-script notes (e.g. a Hebrew note that opens with an English
  // label). An explicit override — mirroring the song lyrics editor — is the fix.
  const noteDirection = note.textDirection ?? "auto";
  const bodyDirection = resolveContentDirection(bodyDraft.draft, noteDirection);
  const [directionMenuVisible, setDirectionMenuVisible] = useState(false);

  // ── Word Finder (rhymes / thesaurus) ──────────────────────────────────────
  const [wordFinderVisible, setWordFinderVisible] = useState(false);
  const [wordFinderSeed, setWordFinderSeed] = useState("");

  // ── Inserted-word flash ───────────────────────────────────────────────────
  // A sub-range background can't be styled inside a TextInput, so a soft wash
  // over the just-inserted word is drawn by a transparent-text ghost overlay
  // that mirrors the body's layout (viable because the body doesn't scroll
  // internally — it grows inside the outer ScrollView).
  const [flash, setFlash] = useState<{ start: number; end: number; nonce: number } | null>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!flash) return;
    flashOpacity.setValue(1);
    const anim = Animated.timing(flashOpacity, {
      toValue: 0,
      duration: 850,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setFlash(null);
    });
    return () => anim.stop();
  }, [flash?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const openWordFinder = useCallback(() => {
    const { start, end } = selectionRef.current;
    // The selection was made in the draft, which may run ahead of the store.
    const range = extractWordRange(bodyDraft.draft, start, end);
    setWordFinderSeed(range?.word ?? "");
    setWordFinderVisible(true);
  }, [bodyDraft.draft]);

  const handlePickWord = useCallback(
    (word: string) => {
      const { start, end } = selectionRef.current;
      // The draft is the text the selection was made in.
      const next = applyPickedWord(bodyDraft.draft, start, end, word);
      bodyDraft.onChangeText(next.text);
      bodyDraft.flush();
      selectionRef.current = { start: next.caret, end: next.caret };
      setFlash({ start: next.wordStart, end: next.wordEnd, nonce: Date.now() });
      setWordFinderVisible(false);
    },
    [bodyDraft]
  );

  const handleSetDirection = useCallback(
    (textDirection: ContentDirection) => {
      onUpdate({ textDirection });
      setDirectionMenuVisible(false);
    },
    [onUpdate]
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
            onPress={handleBack}
          >
            <Ionicons name={dirIcon("chevron-back")} size={20} color={colors.textStrong} />
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
                name={dirIcon("arrow-undo-outline")}
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
                name={dirIcon("arrow-redo-outline")}
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

            {/* Text direction (auto / ltr / rtl) */}
            <Pressable
              style={({ pressed }) => [editorStyles.iconBtn, pressed ? styles.pressDown : null]}
              onPress={() => setDirectionMenuVisible((visible) => !visible)}
              accessibilityLabel={t("lyrics.textDirection")}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
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

        {directionMenuVisible ? (
          <View style={editorStyles.directionMenu}>
            <Text style={editorStyles.directionLabel}>{t("lyrics.textDirection")}</Text>
            {(["auto", "ltr", "rtl"] as ContentDirection[]).map((option) => (
              <Pressable
                key={option}
                style={[editorStyles.directionOption, option === noteDirection ? editorStyles.directionOptionActive : null]}
                onPress={() => handleSetDirection(option)}
              >
                <Text style={editorStyles.directionOptionText}>
                  {t(option === "auto" ? "lyrics.directionAuto" : option === "ltr" ? "lyrics.directionLtr" : "lyrics.directionRtl")}
                </Text>
                {option === noteDirection ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        <ScrollView
          style={editorStyles.scroll}
          contentContainerStyle={editorStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <UserTextInput
            style={editorStyles.title}
            value={titleDraft.draft}
            direction={noteDirection}
            onChangeText={titleDraft.onChangeText}
            onBlur={titleDraft.flush}
            placeholder={t("notepad.titlePlaceholder")}
            placeholderTextColor={colors.textMuted}
            multiline={false}
            returnKeyType="next"
            blurOnSubmit
            onSubmitEditing={() => bodyRef.current?.focus()}
          />

          <Text style={editorStyles.metaText}>{formatTimestamp(note.updatedAt)}</Text>
          <View style={editorStyles.divider} />

          <View style={editorStyles.bodyWrap}>
            <UserTextInput
              ref={bodyRef}
              style={editorStyles.body}
              value={bodyDraft.draft}
              direction={noteDirection}
              onChangeText={(text) => {
                bodyDraft.onChangeText(text);
                // The word moved; drop the highlight if it's still up.
                setFlash((current) => (current ? null : current));
              }}
              onBlur={bodyDraft.flush}
              onSelectionChange={handleSelectionChange}
              placeholder={t("notepad.writePlaceholder")}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
            />
            {flash ? (
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: flashOpacity }]}>
                {/* Ghost mirror of the body: transparent text so only the wash
                    behind the inserted word shows. Reuses editorStyles.body so
                    font/size/line-height/width match the input exactly. */}
                <Text style={[editorStyles.body, contentDirectionStyle(bodyDirection, "content")]}>
                  <Text style={editorStyles.flashHidden}>{bodyDraft.draft.slice(0, flash.start)}</Text>
                  <Text style={editorStyles.flashWord}>{bodyDraft.draft.slice(flash.start, flash.end)}</Text>
                  <Text style={editorStyles.flashHidden}>{bodyDraft.draft.slice(flash.end)}</Text>
                </Text>
              </Animated.View>
            ) : null}
          </View>
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
    fontFamily: "Lora_600SemiBold",
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
  bodyWrap: {
    position: "relative",
  },
  body: {
    ...textTokens.body,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 300,
    paddingVertical: 0,
  },
  // Ghost overlay spans: transparent glyphs; only the word carries the wash.
  flashHidden: {
    color: "transparent",
  },
  flashWord: {
    color: "transparent",
    backgroundColor: "rgba(184,125,107,0.28)", // colors.primary (terracotta) @ 28%
  },
  directionMenu: {
    alignSelf: "flex-start",
    minWidth: 220,
    marginHorizontal: spacing.lg,
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
