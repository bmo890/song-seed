import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { styles as appStyles } from "../../../styles";
import { Button } from "../../common/Button";
import { colors, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserTextInput } from "../../../i18n";
import { ModalDialogLayer } from "../../common/AppDialog";
import { AppAlert } from "../../common/AppAlert";
import { useEditorDraft } from "../../../hooks/useEditorDraft";
import { editorDraftKey } from "../../../domain/editorDrafts";

type Props = {
  visible: boolean;
  /** The idea these notes belong to: their unsaved words are kept under it. */
  ideaId: string | null;
  initialNotes: string;
  onSave: (notes: string) => void;
  onClose: () => void;
};

/** Full-screen, keyboard-safe notes editor. The textarea flexes to the space
 * above the keyboard (KeyboardAvoidingView) so the keyboard never covers what
 * you're writing, and the field scrolls internally for long notes.
 *
 * Typing is never lost quietly (audit 2026-11-02, 04-H4): Cancel and Android
 * back ask first, and a kill gives the words back the next time it opens. */
export function SongNotesEditor({ visible, ideaId, initialNotes, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialNotes);
  // Seeded once per opening, from the notes as they were then: a store change while
  // it is open never resets what is being typed (12b B-L11).
  const openedRef = useRef<string | null>(null);
  if (visible && openedRef.current === null) {
    openedRef.current = initialNotes;
    if (draft !== initialNotes) setDraft(initialNotes);
  }
  if (!visible && openedRef.current !== null) openedRef.current = null;
  const dirty = visible && openedRef.current !== null && draft !== openedRef.current;

  const kept = useEditorDraft({
    key: visible && ideaId ? editorDraftKey("ideaNotes", ideaId) : null,
    fields: { notes: draft },
    dirty,
    onRestore: (restored) => setDraft(restored.fields.notes ?? ""),
  });

  const requestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    AppAlert.discardChanges(() => {
      kept.clear();
      onClose();
    });
  };

  const save = () => {
    kept.clear();
    onSave(draft);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={requestClose}>
      {/* A nested provider is required: inside a react-native Modal the outer
          SafeAreaProvider's context doesn't reach, so insets read as 0 and the
          header lands under the status bar / Dynamic Island. */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.shell} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            style={appStyles.flexFill}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.header}>
              <Button
                label={t("common.cancel")}
                // Same pair as the edit sheet: neutral secondary vs terracotta
                // primary. `quiet` would put Cancel in the same terracotta ink as
                // Save and make the two read as equals.
                variant="secondary"
                onPress={requestClose}
                style={styles.headerBtn}
              />
              <Text style={styles.title}>{t("songDetail.notes")}</Text>
              <Button
                label={t("common.save")}
                variant="primary"
                onPress={save}
                style={styles.headerBtn}
              />
            </View>

            <ScrollView
              style={appStyles.flexFill}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
            >
              <UserTextInput
                style={styles.body}
                value={draft}
                onChangeText={setDraft}
                placeholder={t("songDetail.notesPlaceholder")}
                placeholderTextColor={colors.textMuted}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
                autoFocus
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
      <ModalDialogLayer active={visible} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.page,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  // Equal-width flanks keep the title optically centred whatever the words are.
  headerBtn: {
    minWidth: 76,
  },
  title: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  body: {
    flex: 1,
    minHeight: 240,
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    lineHeight: 23,
    color: colors.textPrimary,
  },
});
