import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { UserTextInput } from "../../../i18n";
import { Ionicons } from "@expo/vector-icons";
import { NotePickerSheet } from "../../modals/NotePickerSheet";
import { CutUpLineSelectSheet } from "./CutUpLineSelectSheet";
import { useSparkTextScale } from "../../common/sparkTextScale";
import type { Note } from "../../../types";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

const PAGE_BG = "#FBF6EC";

export function CutUpSourceStep({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const { t } = useTranslation();
  const { size, lineHeight } = useSparkTextScale();
  const [pickerVisible, setPickerVisible] = useState(false);
  // The page whose lines are being chosen — picking from the pad is two beats:
  // choose a page, then choose the verse/lines to actually work.
  const [selectingNote, setSelectingNote] = useState<Note | null>(null);

  return (
    <View style={styles.body}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{t("cutUp.startingLyric")}</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={({ pressed }) => [styles.pickBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => {
              haptic.tap();
              setPickerVisible(true);
            }}
            hitSlop={6}
          >
            <Ionicons name="document-text-outline" size={14} color={colors.primaryDeep} />
            <Text style={styles.pickBtnText}>{t("cutUp.fromPad")}</Text>
          </Pressable>
        </View>
      </View>

      {spark.sourceLyricId ? (
        <View style={styles.linkedChip}>
          <Ionicons name="link-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.linkedText}>{t("cutUp.pulledPad")}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <UserTextInput
          style={[styles.input, { fontSize: size, lineHeight }]}
          value={spark.sourceText}
          onChangeText={model.setSourceText}
          multiline
          textAlignVertical="top"
          placeholder={t("cutUp.sourcePlaceholder")}
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <NotePickerSheet
        visible={pickerVisible}
        notes={model.notes}
        title={t("cutUp.pickerTitle")}
        subtitle={t("cutUp.pickerSubtitle")}
        onClose={() => setPickerVisible(false)}
        onSelect={(note) => {
          setPickerVisible(false);
          setSelectingNote(note);
        }}
      />

      <CutUpLineSelectSheet
        note={selectingNote}
        onClose={() => setSelectingNote(null)}
        onConfirm={(note, text) => {
          model.pickSourceNote(note, text);
          setSelectingNote(null);
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
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
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
    color: colors.primaryDeep,
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
    backgroundColor: PAGE_BG,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  input: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    lineHeight: 26,
    color: colors.textStrong,
  },
});
