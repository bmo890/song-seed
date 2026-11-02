import React, { useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import { UserText, UserTextInput } from "../../i18n/direction";
import { styles } from "../../styles";
import { TitleInput } from "../common/TitleInput";
import { Button } from "../common/Button";
import { AppAlert } from "../common/AppAlert";
import { BottomSheet, type BottomSheetRef } from "../common/BottomSheet";
import { colors } from "../../design/tokens";
import { fmtCardDuration, formatClipDate } from "../../utils";
import { useEditorDraft } from "../../hooks/useEditorDraft";
import { useTranslation } from "react-i18next";

type ClipNotesSheetProps = {
  visible: boolean;
  /** The clip's length and birth, shown in the cards' own voice ("0:38 · Yesterday"). */
  durationMs?: number;
  createdAt?: number;
  titleDraft: string;
  notesDraft: string;
  /** Leave out to edit the note alone (the player's Notes page): `heading` names
   *  the sheet instead of the title field. */
  onChangeTitle?: (text: string) => void;
  heading?: string;
  onChangeNotes: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  /** The clip's key in the unsaved-words store (domain/editorDrafts): typing here
   *  survives a kill and is offered back the next time this clip's sheet opens. */
  draftKey?: string | null;
  /** A received parcel's take (until Keep) or an archived one: the note is read in
   *  full, never edited (decision B). */
  readOnly?: boolean;
};

/**
 * A clip's name and notes. Words typed here are never lost by a gesture
 * (audit 2026-10-18): swiping the sheet away keeps them, as Save does. Cancel
 * with typing in it asks first (audit 2026-11-02, root cause 4).
 */
export function ClipNotesSheet({
  visible,
  durationMs,
  createdAt,
  titleDraft,
  notesDraft,
  onChangeTitle,
  heading,
  onChangeNotes,
  onSave,
  onCancel,
  draftKey,
  readOnly = false,
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
  const opened = openedWith.current;
  const edited = !readOnly && !!opened && (opened.title !== titleDraft || opened.notes !== notesDraft);

  const draft = useEditorDraft({
    key: visible && !readOnly ? draftKey ?? null : null,
    fields: onChangeTitle ? { title: titleDraft, notes: notesDraft } : { notes: notesDraft },
    dirty: edited,
    onRestore: (kept) => {
      if (onChangeTitle && kept.fields.title !== undefined) onChangeTitle(kept.fields.title);
      if (kept.fields.notes !== undefined) onChangeNotes(kept.fields.notes);
    },
  });

  const save = () => {
    draft.clear();
    onSave();
  };

  const cancel = () => {
    const close = () => {
      discardingRef.current = true;
      draft.clear();
      sheetRef.current?.close();
    };
    if (edited) AppAlert.discardChanges(close);
    else close();
  };

  const meta =
    createdAt !== undefined ? `${fmtCardDuration(durationMs ?? 0)} · ${formatClipDate(createdAt)}` : "";

  if (readOnly) {
    const note = notesDraft.trim();
    return (
      <BottomSheet ref={sheetRef} visible={visible} onClose={onCancel} dismissDistance={420}>
        <ScrollView
          style={styles.clipNotesSheetScroll}
          contentContainerStyle={styles.clipNotesSheetContent}
          showsVerticalScrollIndicator={false}
        >
          {onChangeTitle && titleDraft ? (
            <UserText value={titleDraft} style={styles.clipNotesSheetHeading}>
              {titleDraft}
            </UserText>
          ) : (
            <Text style={styles.clipNotesSheetHeading}>{heading ?? t("modals.clipNotes")}</Text>
          )}
          {meta ? <Text style={styles.clipNotesSheetSubtitle}>{meta}</Text> : null}
          {note ? (
            <UserText value={note} align="content" style={styles.clipNotesSheetReadBody} selectable>
              {note}
            </UserText>
          ) : null}
          <View style={styles.clipNotesSheetButtons}>
            <Button variant="quiet" label={t("common.done")} onPress={() => sheetRef.current?.close()} />
          </View>
        </ScrollView>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={() => {
        const discard = discardingRef.current;
        discardingRef.current = false;
        const openedNow = openedWith.current;
        const editedNow = !openedNow || openedNow.title !== titleDraft || openedNow.notes !== notesDraft;
        if (!discard && editedNow) save();
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
        {onChangeTitle ? (
          <TitleInput
            testID="clip-title-input"
            value={titleDraft}
            onChangeText={onChangeTitle}
            placeholder={t("modals.clipTitle")}
            containerStyle={{ marginHorizontal: 0 }}
          />
        ) : (
          <Text style={styles.clipNotesSheetHeading}>{heading}</Text>
        )}
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
          <Button variant="quiet" label={t("common.cancel")} onPress={cancel} />
          <Button label={t("common.save")} onPress={save} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
