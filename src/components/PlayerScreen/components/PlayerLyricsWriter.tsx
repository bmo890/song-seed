import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { colors, spacing } from "../../../design/tokens";
import type { ContentDirection } from "../../../types";
import { UserTextInput } from "../../../i18n";
import { useKeyboardOverlap } from "../../../hooks/useKeyboardOverlap";
import { useTranslation } from "react-i18next";
import { toast } from "../../common/toastStore";
import { readWriterBase, sameBase, saveWriterLyrics, type WriterBase } from "../writerLyricsSave";

const AUTOSAVE_DEBOUNCE_MS = 700;

/**
 * Write-against-the-tape (phase 4a): the free-writing surface under the slim
 * reel. Words flow into the sketch's CURRENT lyric version through the same
 * save path as the lyric sheet's editor (chord anchors survive text edits the
 * same way there), autosaving on every pause in typing — flow writing never
 * meets a save button.
 *
 * It is tied to the sketch it opened on (the queue moving on never carries its
 * words to the next sketch, 04-M2) and to the version it started from: words
 * changed elsewhere while it sat docked show up here when nothing is pending,
 * and a pending save never goes in place over them — it becomes a new version
 * (12a A-H3). It also saves as the app leaves the foreground (A-L5).
 */
export function PlayerLyricsWriter({
  ideaId,
  initialText,
  textDirection,
}: {
  ideaId: string;
  initialText: string;
  textDirection: ContentDirection;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  // The sketch this writer belongs to, fixed for its life.
  const ideaIdRef = useRef(ideaId);
  // The version (and its last edit) the words on screen stand on.
  const baseRef = useRef<WriterBase | null>(null);
  if (baseRef.current === null) {
    const now = readWriterBase(ideaIdRef.current);
    baseRef.current = { versionId: now.versionId, updatedAt: now.updatedAt };
  }
  const latestRef = useRef({ text: initialText, textDirection });
  latestRef.current = { text, textDirection };

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const latest = latestRef.current;
    const result = saveWriterLyrics(ideaIdRef.current, latest.text, latest.textDirection, baseRef.current!);
    baseRef.current = result.base;
    if (result.forked) toast(t("lyrics.savedAsNewVersion"), "git-branch-outline");
  }, [t]);

  const handleChangeText = useCallback(
    (next: string) => {
      setText(next);
      dirtyRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Words changed somewhere else (the lyric editor while this sat docked): with
  // nothing pending here, show them, so the next key builds on them. Its own saves
  // leave the base matching, so they never re-seed under the cursor.
  useEffect(() => {
    if (dirtyRef.current) return;
    const now = readWriterBase(ideaIdRef.current);
    if (baseRef.current && sameBase(now, baseRef.current)) return;
    baseRef.current = { versionId: now.versionId, updatedAt: now.updatedAt };
    setText(now.text);
  }, [initialText]);

  // Leaving the writer (close, switch clip, unmount) or the app commits whatever's pending.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  // The page ends at the keys: the line being typed stays in sight on both platforms.
  const frameRef = useRef<View>(null);
  const keyboardOverlap = useKeyboardOverlap(frameRef);

  return (
    <View ref={frameRef} style={[styles.fill, { paddingBottom: keyboardOverlap }]}>
      <UserTextInput
        style={styles.input}
        value={text}
        onChangeText={handleChangeText}
        onBlur={flush}
        placeholder={t("player.writePlaceholder")}
        placeholderTextColor={colors.textMuted}
        multiline
        autoFocus
        scrollEnabled
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    lineHeight: 28,
    color: colors.textPrimary,
  },
});
