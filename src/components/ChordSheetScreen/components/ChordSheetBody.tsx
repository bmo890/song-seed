import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { SECTION_PRESETS } from "../../../chordSheet";
import { ChordPickerSheet } from "../../LyricsVersionScreen/components/chords/ChordPickerSheet";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import type { SelectionAction } from "../../common/SelectionDock";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { AppAlert } from "../../common/AppAlert";
import { ChordSheetSection } from "../ChordSheetSection";
import type { useChordSheetModel } from "../useChordSheetModel";

type MenuTarget = { id: string; label: string; index: number; count: number };

/** The chord-sheet content shared by the standalone screen and the song "Chart"
 * tab: a collapsible add-section header, the section staves, and the chord picker.
 * The host supplies the scroll container, header, and export controls. */
export function ChordSheetBody({ model }: { model: ReturnType<typeof useChordSheetModel> }) {
  const { sheet, isEditing } = model;
  const isEmpty = sheet.sections.length === 0;

  const [addOpen, setAddOpen] = useState(isEmpty);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const addSection = (label: string) => {
    model.addSection(label);
    if (!isEditing) model.setIsEditing(true);
  };

  const menuActions: SelectionAction[] = menuTarget
    ? [
        {
          key: "rename",
          label: "Rename",
          icon: "create-outline",
          onPress: () => {
            setRenameTarget({ id: menuTarget.id, label: menuTarget.label });
            setRenameDraft(menuTarget.label);
          },
        },
        ...(menuTarget.index > 0
          ? [
              {
                key: "up",
                label: "Move up",
                icon: "arrow-up-outline" as const,
                onPress: () => model.moveSection(menuTarget.id, -1),
              },
            ]
          : []),
        ...(menuTarget.index < menuTarget.count - 1
          ? [
              {
                key: "down",
                label: "Move down",
                icon: "arrow-down-outline" as const,
                onPress: () => model.moveSection(menuTarget.id, 1),
              },
            ]
          : []),
        {
          key: "delete",
          label: "Delete section",
          icon: "trash-outline",
          tone: "danger",
          onPress: () => {
            const id = menuTarget.id;
            AppAlert.destructive(
              "Delete section?",
              "Its bars and chords will be removed.",
              () => model.removeSection(id),
              { confirmLabel: "Delete" }
            );
          },
        },
      ]
    : [];

  return (
    <>
      {isEditing || isEmpty ? (
        <View style={styles.addBlock}>
          <Pressable
            style={({ pressed }) => [styles.addHeader, pressed ? appStyles.pressDown : null]}
            onPress={() => setAddOpen((open) => !open)}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.addHeaderText}>Add a section</Text>
            <View style={appStyles.flexFill} />
            <Ionicons name={addOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
          </Pressable>

          {addOpen ? (
            <View style={styles.presetRow}>
              {SECTION_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  style={({ pressed }) => [styles.presetChip, pressed ? appStyles.pressDown : null]}
                  onPress={() => addSection(preset)}
                >
                  <Ionicons name="add" size={13} color={colors.primary} />
                  <Text style={styles.presetChipText}>{preset}</Text>
                </Pressable>
              ))}
              <Pressable
                style={({ pressed }) => [styles.presetChipCustom, pressed ? appStyles.pressDown : null]}
                onPress={() => addSection("Section")}
                accessibilityLabel="Add a custom section"
              >
                <Ionicons name="add" size={17} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="grid-outline" size={26} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>A blank chart</Text>
          <Text style={styles.emptyBody}>
            Pick a section above, then tap a bar to drop in a chord and + to add more bars. Sketch it out
            like a page of staff paper.
          </Text>
        </View>
      ) : (
        sheet.sections.map((section, index) => (
          <ChordSheetSection
            key={section.id}
            section={section}
            editable={isEditing}
            onTapMeasure={(measureId) => model.openPicker(section.id, measureId)}
            onAddMeasure={() => model.addMeasure(section.id)}
            onRemoveChord={(measureId, i) => model.removeChordAt(section.id, measureId, i)}
            onRemoveMeasure={(measureId) => model.removeMeasure(section.id, measureId)}
            onNotes={(notes) => model.setSectionNotes(section.id, notes)}
            onOpenMenu={() =>
              setMenuTarget({ id: section.id, label: section.label, index, count: sheet.sections.length })
            }
          />
        ))
      )}

      <ChordPickerSheet
        visible={!!model.pickerTarget}
        mode="add"
        initial={null}
        palette={model.palette}
        onClose={model.closePicker}
        onSave={model.addChord}
        onDelete={model.closePicker}
      />

      <SelectionActionSheet
        visible={!!menuTarget}
        title={menuTarget?.label || "Section"}
        actions={menuActions}
        onClose={() => setMenuTarget(null)}
      />

      <QuickNameModal
        visible={!!renameTarget}
        title="Rename section"
        draftValue={renameDraft}
        placeholderValue={renameTarget?.label}
        onChangeDraft={setRenameDraft}
        onCancel={() => setRenameTarget(null)}
        onSave={() => {
          const next = renameDraft.trim();
          if (renameTarget && next) model.renameSection(renameTarget.id, next);
          setRenameTarget(null);
        }}
        saveLabel="Rename"
      />
    </>
  );
}

const styles = StyleSheet.create({
  addBlock: { marginBottom: spacing.lg },
  addHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  addHeaderText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.primary,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
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
  presetChipCustom: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
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
});
