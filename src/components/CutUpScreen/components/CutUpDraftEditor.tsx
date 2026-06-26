import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppAlert } from "../../common/AppAlert";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";

type Model = ReturnType<typeof useCutUpScreenModel>;

export function CutUpDraftEditor({
  model,
  spark,
  keyboardVisible,
}: {
  model: Model;
  spark: CutUpSpark;
  keyboardVisible: boolean;
}) {
  function confirmRebuild() {
    if (!spark.assembledDraftText.trim()) {
      model.rebuildDraftFromBoard();
      return;
    }
    AppAlert.destructive(
      "Rebuild from the board?",
      "This replaces your draft with the current strip order. Your edits here will be lost.",
      model.rebuildDraftFromBoard,
      { confirmLabel: "Rebuild" }
    );
  }

  return (
    <View style={styles.body}>
      {keyboardVisible ? null : (
        <View style={styles.headerRow}>
          <Text style={styles.label}>Your draft</Text>
          <Pressable
            style={({ pressed }) => [styles.rebuildBtn, pressed ? appStyles.pressDown : null]}
            onPress={confirmRebuild}
            hitSlop={6}
          >
            <Ionicons name="sync-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.rebuildText}>Rebuild from board</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          value={spark.assembledDraftText}
          onChangeText={model.setDraft}
          multiline
          textAlignVertical="top"
          placeholder="Your strips land here. Add words between them, fix the seams, cut what doesn't sing — make it yours."
          placeholderTextColor={colors.textMuted}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  label: { ...textTokens.annotation },
  rebuildBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  rebuildText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 18,
    lineHeight: 28,
    color: colors.textPrimary,
  },
});
