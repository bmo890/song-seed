import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { Button } from "../../common/Button";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { SECTION_PRESETS } from "../../../chordSheet";
import { ChordPickerSheet } from "../../LyricsVersionScreen/components/chords/ChordPickerSheet";
import { ChordExportSheet } from "../../LyricsVersionScreen/components/chords/ChordExportSheet";
import { useChordSheetModel } from "../useChordSheetModel";
import { ChordSheetSection } from "../ChordSheetSection";

const KRAFT_BG = "#F2E9DC";

export function ChordSheetScreenContent() {
  const model = useChordSheetModel();
  const [exportVisible, setExportVisible] = useState(false);

  if (!model.projectIdea) {
    return (
      <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
        <ScreenHeader title="Chord Chart" leftIcon="back" onLeftPress={model.goBack} />
        <View style={styles.missing}>
          <Ionicons name="grid-outline" size={28} color={colors.textMuted} />
          <Text style={styles.missingText}>This song is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { sheet, isEditing } = model;
  const isEmpty = sheet.sections.length === 0;

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <ScreenHeader
        title="Chord Chart"
        leftIcon="back"
        onLeftPress={model.goBack}
        rightElement={
          <View style={styles.headerActions}>
            {!isEmpty ? (
              <Pressable
                style={({ pressed }) => [styles.headerBtn, pressed ? appStyles.pressDown : null]}
                onPress={() => setExportVisible(true)}
                hitSlop={6}
              >
                <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
              </Pressable>
            ) : null}
            {!isEmpty ? (
              <Pressable
                style={({ pressed }) => [styles.editPill, pressed ? appStyles.pressDown : null]}
                onPress={() => model.setIsEditing(!isEditing)}
                hitSlop={6}
              >
                <Text style={styles.editPillText}>{isEditing ? "Done" : "Edit"}</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <Text style={styles.subtitle}>{model.projectIdea.title}</Text>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.fill} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {isEmpty ? (
            <View style={styles.empty}>
              <Ionicons name="grid-outline" size={26} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Start a chord chart</Text>
              <Text style={styles.emptyBody}>
                Add a block of bars for each part of the song — an intro, a verse, a chorus — and drop chords
                into the bars. Blocks stand on their own; they don't have to fill the page.
              </Text>
            </View>
          ) : (
            sheet.sections.map((section) => (
              <ChordSheetSection
                key={section.id}
                section={section}
                editable={isEditing}
                onTapMeasure={(measureId) => model.openPicker(section.id, measureId)}
                onClearMeasure={(measureId) => model.clearMeasure(section.id, measureId)}
                onAddMeasure={() => model.addMeasure(section.id)}
                onRemoveLastMeasure={() =>
                  section.measures.length > 0 &&
                  model.removeMeasure(section.id, section.measures[section.measures.length - 1].id)
                }
                onRename={(label) => model.renameSection(section.id, label)}
                onNotes={(notes) => model.setSectionNotes(section.id, notes)}
                onMove={(dir) => model.moveSection(section.id, dir)}
                onRemoveSection={() => model.removeSection(section.id)}
              />
            ))
          )}

          {isEditing || isEmpty ? (
            <View style={styles.addSection}>
              <Text style={styles.addLabel}>Add a section</Text>
              <View style={styles.presetRow}>
                {SECTION_PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    style={({ pressed }) => [styles.presetChip, pressed ? appStyles.pressDown : null]}
                    onPress={() => {
                      model.addSection(preset);
                      if (!isEditing) model.setIsEditing(true);
                    }}
                  >
                    <Ionicons name="add" size={13} color={colors.primary} />
                    <Text style={styles.presetChipText}>{preset}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ChordPickerSheet
        visible={!!model.pickerTarget}
        mode="add"
        initial={null}
        palette={model.palette}
        onClose={model.closePicker}
        onSave={model.addChord}
        onDelete={model.closePicker}
      />

      <ChordExportSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        onExportPdf={() => {
          setExportVisible(false);
          void model.exportPdf();
        }}
        onExportText={() => {
          setExportVisible(false);
          model.exportText();
        }}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 16 },
  fill: { flex: 1, minHeight: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  editPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
  },
  editPillText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 13, color: colors.primary },
  subtitle: { ...textTokens.supporting, marginBottom: spacing.md },
  scrollContent: { paddingBottom: 48 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  missingText: { ...textTokens.supporting },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  emptyBody: { ...textTokens.supporting, textAlign: "center" },
  addSection: { marginTop: spacing.sm, gap: spacing.sm },
  addLabel: { ...textTokens.annotation },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  presetChipText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 13, color: colors.primary },
});
