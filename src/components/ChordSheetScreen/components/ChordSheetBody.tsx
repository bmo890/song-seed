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

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const addSection = (label: string) => {
    model.addSection(label);
    if (!isEditing) model.setIsEditing(true);
  };

  const addSectionActions: SelectionAction[] = [
    ...SECTION_PRESETS.map((preset) => ({
      key: preset,
      label: preset,
      icon: "add" as const,
      onPress: () => addSection(preset),
    })),
    {
      key: "custom",
      label: "Custom section",
      icon: "create-outline" as const,
      onPress: () => addSection("Section"),
    },
  ];

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
            style={({ pressed }) => [styles.actionBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => setAddSheetOpen(true)}
          >
            <Ionicons name="add" size={15} color={colors.primary} />
            <Text style={styles.actionBtnText}>Add a section</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed ? appStyles.pressDown : null]}
            onPress={() => model.buildFromLyrics()}
          >
            <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={styles.actionBtnText}>Build from lyrics</Text>
          </Pressable>
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
            onInsertMeasure={(atIndex) => model.insertMeasure(section.id, atIndex)}
            onSplitMeasure={(measureId) => model.splitMeasure(section.id, measureId)}
            onRemoveChord={(measureId, i) => model.removeChordAt(section.id, measureId, i)}
            onRemoveMeasure={(measureId) => model.removeMeasure(section.id, measureId)}
            onClearMeasure={(measureId) => model.clearMeasure(section.id, measureId)}
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
        visible={addSheetOpen}
        title="Add a section"
        actions={addSectionActions}
        onClose={() => setAddSheetOpen(false)}
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
  addBlock: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  actionBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.primary,
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
