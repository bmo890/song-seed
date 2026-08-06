import React, { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { colors, spacing } from "../../../design/tokens";
import { appActions } from "../../../state/actions";
import type { ContentDirection } from "../../../types";
import { UserTextInput } from "../../../i18n";
import { useTranslation } from "react-i18next";

const AUTOSAVE_DEBOUNCE_MS = 700;

/**
 * Write-against-the-tape (phase 4a): the free-writing surface under the slim
 * reel. Words flow into the sketch's CURRENT lyric version through the same
 * save path as the lyric sheet's editor (chord anchors survive text edits the
 * same way there), autosaving on every pause in typing — flow writing never
 * meets a save button. One-way binding: the editor seeds from the store once
 * per version (key on the version id) and pushes; it never pulls mid-session,
 * so a background hydration can't clobber words being typed.
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
  const latestRef = useRef({ ideaId, text: initialText, textDirection });
  latestRef.current = { ideaId, text, textDirection };

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const latest = latestRef.current;
    appActions.saveProjectLyrics(latest.ideaId, latest.text, latest.textDirection);
  }, []);

  const handleChangeText = useCallback(
    (next: string) => {
      setText(next);
      dirtyRef.current = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
    },
    [flush]
  );

  // Leaving the writer (close, switch clip, unmount) commits whatever's pending.
  useEffect(() => flush, [flush]);

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
    </KeyboardAvoidingView>
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
