import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { UserTextInput } from "../../../i18n";
import { Ionicons } from "@expo/vector-icons";
import { NotePickerSheet } from "../../modals/NotePickerSheet";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";

type Model = ReturnType<typeof useCutUpScreenModel>;

export function CutUpSourceStep({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const [pickerVisible, setPickerVisible] = useState(false);

  return (
    <View style={styles.body}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>Your starting lyric</Text>
        <Pressable
          style={({ pressed }) => [styles.pickBtn, pressed ? appStyles.pressDown : null]}
          onPress={() => setPickerVisible(true)}
          hitSlop={6}
        >
          <Ionicons name="document-text-outline" size={14} color={colors.primary} />
          <Text style={styles.pickBtnText}>From Lyrics Pad</Text>
        </Pressable>
      </View>

      {spark.sourceLyricId ? (
        <View style={styles.linkedChip}>
          <Ionicons name="link-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.linkedText}>Pulled from a Lyrics Pad page</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <UserTextInput
          style={styles.input}
          value={spark.sourceText}
          onChangeText={model.setSourceText}
          multiline
          textAlignVertical="top"
          placeholder="Paste a stuck verse, an old draft, a few lines you can't crack — anything already written. You'll cut it apart next."
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <NotePickerSheet
        visible={pickerVisible}
        notes={model.notes}
        title="Cut up a Lyrics Pad page"
        subtitle="Choose a page to slice into chunks. The original stays untouched."
        onClose={() => setPickerVisible(false)}
        onSelect={(note) => {
          model.pickSourceNote(note);
          setPickerVisible(false);
        }}
      />
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
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  pickBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 12,
    color: colors.primary,
  },
  linkedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginBottom: spacing.sm,
  },
  linkedText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 11,
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
    fontSize: 17,
    lineHeight: 26,
    color: colors.textPrimary,
  },
});
