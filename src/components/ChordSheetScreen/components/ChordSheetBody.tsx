import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { SECTION_PRESETS } from "../../../chordSheet";
import { ChordPickerSheet } from "../../LyricsVersionScreen/components/chords/ChordPickerSheet";
import { ChordSheetSection } from "../ChordSheetSection";
import type { useChordSheetModel } from "../useChordSheetModel";

/** The chord-sheet content shared by the standalone screen and the song "Chart"
 * tab: the empty state, the section blocks, the add-section presets, and the chord
 * picker. The host supplies the scroll container, header, and export controls. */
export function ChordSheetBody({ model }: { model: ReturnType<typeof useChordSheetModel> }) {
  const { sheet, isEditing } = model;
  const isEmpty = sheet.sections.length === 0;

  return (
    <>
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

      <ChordPickerSheet
        visible={!!model.pickerTarget}
        mode="add"
        initial={null}
        palette={model.palette}
        onClose={model.closePicker}
        onSave={model.addChord}
        onDelete={model.closePicker}
      />
    </>
  );
}

const styles = StyleSheet.create({
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
