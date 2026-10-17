import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { UserText, UserTextInput } from "../../../i18n";
import { Ionicons } from "@expo/vector-icons";
import { NotePickerSheet } from "../../modals/NotePickerSheet";
import { CutUpLineSelectSheet } from "./CutUpLineSelectSheet";
import { useSparkTextScale } from "../../common/sparkTextScale";
import { InkKey, inkKeyColor } from "../../common/InkKey";
import { InkLink } from "../../common/InkLink";
import { AppAlert } from "../../common/AppAlert";
import type { Note } from "../../../types";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import type { CutUpSpark } from "../../../types";
import type { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { useTranslation } from "react-i18next";

type Model = ReturnType<typeof useCutUpScreenModel>;

/**
 * The Source step. Before the first cut it is a page to paste or pick onto.
 * Once the lyric has been cut it becomes a reading page (2026-10-17): the
 * source is what you're cutting from, and one stray keystroke here used to
 * re-cut it and reset the table without a word. "Edit source" and picking
 * another page both ask first.
 */
export function CutUpSourceStep({ model, spark }: { model: Model; spark: CutUpSpark }) {
  const { t } = useTranslation();
  const { size, lineHeight } = useSparkTextScale();
  const [pickerVisible, setPickerVisible] = useState(false);
  // The page whose lines are being chosen — picking from the pad is two beats:
  // choose a page, then choose the verse/lines to actually work.
  const [selectingNote, setSelectingNote] = useState<Note | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const hasCut = spark.cutSeams !== undefined || spark.chunks.length > 0;
  const locked = hasCut && !unlocked;

  const openPicker = () => {
    if (!hasCut) {
      setPickerVisible(true);
      return;
    }
    AppAlert.confirm(t("cutUp.replaceSourceTitle"), t("cutUp.editSourceBody"), () => setPickerVisible(true), {
      confirmLabel: t("cutUp.replace"),
      icon: "document-text-outline",
    });
  };

  const unlock = () => {
    AppAlert.confirm(t("cutUp.editSourceTitle"), t("cutUp.editSourceBody"), () => setUnlocked(true), {
      confirmLabel: t("cutUp.edit"),
      icon: "create-outline",
    });
  };

  return (
    <View style={styles.body}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{t("cutUp.startingLyric")}</Text>
        <InkKey
          glyph={<Ionicons name="document-text-outline" size={16} color={inkKeyColor("idle")} />}
          label={t("cutUp.fromPad")}
          onPress={openPicker}
          style={styles.headerKey}
        />
      </View>

      {spark.sourceLyricId ? (
        <View style={styles.linkedChip}>
          <Ionicons name="link-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.linkedText}>{t("cutUp.pulledPad")}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        {locked ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <UserText style={[styles.input, { fontSize: size, lineHeight }]}>{model.sourceField.draft}</UserText>
          </ScrollView>
        ) : (
          <UserTextInput
            style={[styles.input, { fontSize: size, lineHeight }]}
            value={model.sourceField.draft}
            onChangeText={model.sourceField.onChangeText}
            onBlur={model.sourceField.flush}
            multiline
            autoFocus={unlocked}
            textAlignVertical="top"
            placeholder={t("cutUp.sourcePlaceholder")}
            placeholderTextColor={colors.textMuted}
          />
        )}
      </View>

      {locked ? (
        <View style={styles.editRow}>
          <InkLink label={t("cutUp.editSource")} icon="create-outline" onPress={unlock} />
        </View>
      ) : null}

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
          setUnlocked(false);
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
    marginBottom: spacing.xs,
  },
  label: { ...textTokens.annotation },
  headerKey: { minHeight: 36 },
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
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.card,
  },
  input: {
    flex: 1,
    fontFamily: "Lora_500Medium",
    color: colors.textStrong,
  },
  editRow: {
    paddingTop: spacing.xs,
  },
});
