import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";

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
  const [draft, setDraft] = useState(initialNotes);

  useEffect(() => {
    if (visible) setDraft(initialNotes);
  }, [visible, initialNotes]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.shell} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={appStyles.flexFill}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [styles.cancelBtn, pressed ? appStyles.pressDown : null]}
              onPress={onClose}
              hitSlop={6}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Notes</Text>
            <Pressable
              style={({ pressed }) => [styles.saveBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => onSave(draft)}
              hitSlop={6}
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>

          <ScrollView
            style={appStyles.flexFill}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              style={styles.body}
              value={draft}
              onChangeText={setDraft}
              placeholder="Write your notes here…"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              scrollEnabled={false}
              autoFocus
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: spacing.md,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingRight: spacing.sm,
    minWidth: 64,
  },
  cancelText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: colors.textSecondary,
  },
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  saveBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    minWidth: 64,
    alignItems: "center",
  },
  saveText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 14,
    color: colors.onPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
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
