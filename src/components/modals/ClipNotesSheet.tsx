import React, { useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { UserTextInput } from "../../i18n/direction";
import { styles } from "../../styles";
import { TitleInput } from "../common/TitleInput";
import { Button } from "../common/Button";
import { BottomSheet, type BottomSheetRef } from "../common/BottomSheet";
import { colors } from "../../design/tokens";
import { fmtCardDuration, formatClipDate } from "../../utils";
import { useTranslation } from "react-i18next";

type ClipNotesSheetProps = {
  visible: boolean;
  /** The clip's length and birth, shown in the cards' own voice ("0:38 · Yesterday"). */
  durationMs?: number;
  createdAt?: number;
  titleDraft: string;
  notesDraft: string;
  onChangeTitle: (text: string) => void;
  onChangeNotes: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

/**
 * A clip's name and notes. Words typed here are never lost by a gesture
 * (audit 2026-10-18): swiping the sheet away keeps them, as Save does; only
 * Cancel throws them away.
 */
export function ClipNotesSheet({
  visible,
  durationMs,
  createdAt,
  titleDraft,
  notesDraft,
  onChangeTitle,
  onChangeNotes,
  onSave,
  onCancel,
}: ClipNotesSheetProps) {
  const { t } = useTranslation();
  const sheetRef = useRef<BottomSheetRef>(null);
  // Cancel slides the sheet out like a swipe does; this marks that close as a discard.
  const discardingRef = useRef(false);
  // What the fields held as the sheet opened: a swipe over untouched fields saves
  // nothing (a save also stamps the title as typed). Caught in render, so the
  // first frame of an opening already knows it.
  const openedWith = useRef<{ title: string; notes: string } | null>(null);
  if (visible && !openedWith.current) openedWith.current = { title: titleDraft, notes: notesDraft };
  if (!visible) openedWith.current = null;

  const meta =
    createdAt !== undefined ? `${fmtCardDuration(durationMs ?? 0)} · ${formatClipDate(createdAt)}` : "";

  return (
    <BottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={() => {
        const discard = discardingRef.current;
        discardingRef.current = false;
        const opened = openedWith.current;
        const edited = !opened || opened.title !== titleDraft || opened.notes !== notesDraft;
        if (!discard && edited) onSave();
        // Always close too: a save that bails early must never strand the sheet.
        onCancel();
      }}
      dismissDistance={420}
      keyboardAvoiding
    >
      <ScrollView
        style={styles.clipNotesSheetScroll}
        contentContainerStyle={styles.clipNotesSheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TitleInput
          testID="clip-title-input"
          value={titleDraft}
          onChangeText={onChangeTitle}
          placeholder={t("modals.clipTitle")}
          containerStyle={{ marginHorizontal: 0 }}
        />
        {meta ? <Text style={styles.clipNotesSheetSubtitle}>{meta}</Text> : null}

        <UserTextInput
          testID="clip-notes-input"
          style={styles.clipNotesSheetTextInput}
          multiline
          placeholder={t("modals.clipNotes")}
          placeholderTextColor={colors.textMuted}
          value={notesDraft}
          onChangeText={onChangeNotes}
          autoFocus={!notesDraft}
        />

        <View style={styles.clipNotesSheetButtons}>
          <Button
            variant="quiet"
            label={t("common.cancel")}
            onPress={() => {
              discardingRef.current = true;
              sheetRef.current?.close();
            }}
          />
          <Button label={t("common.save")} onPress={onSave} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
