import { useEffect, useState } from "react";
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

type Props = {
  visible: boolean;
  initialNotes: string;
  onSave: (notes: string) => void;
  onClose: () => void;
};

/** Full-screen, keyboard-safe notes editor. The textarea flexes to the space
 * above the keyboard (KeyboardAvoidingView) so the keyboard never covers what
 * you're writing, and the field scrolls internally for long notes. */
export function SongNotesEditor({ visible, initialNotes, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialNotes);

  useEffect(() => {
    if (visible) setDraft(initialNotes);
  }, [visible, initialNotes]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
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
                onPress={onClose}
                style={styles.headerBtn}
              />
              <Text style={styles.title}>{t("songDetail.notes")}</Text>
              <Button
                label={t("common.save")}
                variant="primary"
                onPress={() => onSave(draft)}
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
