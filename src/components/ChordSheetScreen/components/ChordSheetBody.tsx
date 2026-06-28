import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { SECTION_PRESETS } from "../../../chordSheet";
import type { ChordSheet } from "../../../types";
import { ChordPickerSheet } from "../../LyricsVersionScreen/components/chords/ChordPickerSheet";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import type { SelectionAction } from "../../common/SelectionDock";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { AppAlert } from "../../common/AppAlert";
import { ChordSheetSection } from "../ChordSheetSection";
import type { useChordSheetModel } from "../useChordSheetModel";

type MenuTarget = { id: string; label: string; index: number; count: number; kind: "section" | "text" };
type BarSelection = { sectionId: string; measureIds: string[] };

/** The chord-sheet content shared by the standalone screen and the song "Chart"
 * tab: add-section + build controls, the section staves with bar selection, and
 * the chord picker. The host supplies the scroll container, header, and export. */
export function ChordSheetBody({ model }: { model: ReturnType<typeof useChordSheetModel> }) {
  const { sheet, isEditing } = model;
  const isEmpty = sheet.sections.length === 0;

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [barSelection, setBarSelection] = useState<BarSelection | null>(null);
  const [barClipboard, setBarClipboard] = useState<string[][] | null>(null);
  const [barMenuOpen, setBarMenuOpen] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);

  const addSection = (label: string) => {
    model.addSection(label);
    if (!isEditing) model.setIsEditing(true);
  };

  const addTextBlock = () => {
    model.addTextBlock();
    if (!isEditing) model.setIsEditing(true);
  };

  // ── Bar selection (multi-select + a control sheet) ──────────────────────────
  // Selection is scoped to one section so insert/paste/delete stay unambiguous.
  const toggleBar = (sectionId: string, measureId: string) =>
    setBarSelection((prev) => {
      if (!prev || prev.sectionId !== sectionId) return { sectionId, measureIds: [measureId] };
      const measureIds = prev.measureIds.includes(measureId)
        ? prev.measureIds.filter((id) => id !== measureId)
        : [...prev.measureIds, measureId];
      return measureIds.length ? { sectionId, measureIds } : null;
    });

  const handleBarTap = (sectionId: string, measureId: string) => {
    if (barSelection) {
      toggleBar(sectionId, measureId);
      return;
    }
    model.openPicker(sectionId, measureId);
  };

  const barSection = barSelection
    ? sheet.sections.find((s) => s.id === barSelection.sectionId) ?? null
    : null;
  const selectedCount = barSelection?.measureIds.length ?? 0;

  const barActions: SelectionAction[] = (() => {
    if (!barSelection || !barSection) return [];
    const sel = barSelection;
    const sec = barSection;
    const indices = sel.measureIds
      .map((id) => sec.measures.findIndex((m) => m.id === id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b);
    const minIndex = indices[0] ?? 0;
    const maxIndex = indices[indices.length - 1] ?? -1;
    const selectedChords = () =>
      sec.measures.filter((m) => sel.measureIds.includes(m.id)).map((m) => [...m.chords]);
    const onlyMeasure = selectedCount === 1 ? sec.measures[minIndex] : null;
    const noun = selectedCount === 1 ? "bar" : "bars";

    return [
      {
        key: "add-before",
        label: "Add bar before",
        icon: "arrow-back-outline",
        onPress: () => model.insertMeasure(sel.sectionId, minIndex),
      },
      {
        key: "add-after",
        label: "Add bar after",
        icon: "arrow-forward-outline",
        onPress: () => model.insertMeasure(sel.sectionId, maxIndex + 1),
      },
      {
        key: "copy",
        label: `Copy ${noun}`,
        icon: "copy-outline",
        onPress: () => setBarClipboard(selectedChords()),
      },
      {
        key: "cut",
        label: `Cut ${noun}`,
        icon: "cut-outline",
        onPress: () => {
          setBarClipboard(selectedChords());
          model.removeMeasures(sel.sectionId, sel.measureIds);
          setBarSelection(null);
        },
      },
      ...(barClipboard && barClipboard.length
        ? [
            {
              key: "paste",
              label: `Paste ${barClipboard.length} ${barClipboard.length === 1 ? "bar" : "bars"}`,
              icon: "clipboard-outline" as const,
              onPress: () => {
                model.insertMeasuresAt(sel.sectionId, maxIndex + 1, barClipboard);
                setBarSelection(null);
              },
            },
          ]
        : []),
      ...(onlyMeasure && onlyMeasure.chords.length > 1
        ? [
            {
              key: "split",
              label: "Split into separate bars",
              icon: "git-branch-outline" as const,
              onPress: () => {
                model.splitMeasure(sel.sectionId, sel.measureIds[0]);
                setBarSelection(null);
              },
            },
          ]
        : []),
      {
        key: "clear",
        label: `Clear ${noun}`,
        icon: "backspace-outline",
        onPress: () => model.clearMeasures(sel.sectionId, sel.measureIds),
      },
      {
        key: "delete",
        label: `Delete ${noun}`,
        icon: "trash-outline",
        tone: "danger",
        onPress: () => {
          model.removeMeasures(sel.sectionId, sel.measureIds);
          setBarSelection(null);
        },
      },
    ];
  })();

  const menuActions: SelectionAction[] = menuTarget
    ? [
        ...(menuTarget.kind === "text"
          ? []
          : [
              {
                key: "rename",
                label: "Rename",
                icon: "create-outline" as const,
                onPress: () => {
                  setRenameTarget({ id: menuTarget.id, label: menuTarget.label });
                  setRenameDraft(menuTarget.label);
                },
              },
            ]),
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
          label: menuTarget.kind === "text" ? "Delete text block" : "Delete section",
          icon: "trash-outline",
          tone: "danger",
          onPress: () => {
            const id = menuTarget.id;
            const isText = menuTarget.kind === "text";
            AppAlert.destructive(
              isText ? "Delete text block?" : "Delete section?",
              isText ? "This text block will be removed." : "Its bars and chords will be removed.",
              () => model.removeSection(id),
              { confirmLabel: "Delete" }
            );
          },
        },
      ]
    : [];

  return (
    <>
      {barSelection ? (
        <View style={[appStyles.selectionBar, styles.selectionBar]}>
          <Text style={appStyles.selectionText}>
            {selectedCount} {selectedCount === 1 ? "bar" : "bars"} selected
          </Text>
          <View style={styles.selectionActions}>
            <Pressable
              style={({ pressed }) => [styles.selIconBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => setBarMenuOpen(true)}
              hitSlop={6}
              accessibilityLabel="Bar actions"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textStrong} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.selDoneBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => setBarSelection(null)}
              hitSlop={6}
            >
              <Text style={styles.selDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.addBlock}>
          {isEditing || isEmpty ? (
            <>
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
            </>
          ) : null}
          {!isEmpty ? (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => setFullViewOpen(true)}
            >
              <Ionicons name="newspaper-outline" size={14} color={colors.primary} />
              <Text style={styles.actionBtnText}>Full view</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="grid-outline" size={26} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>A blank chart</Text>
          <Text style={styles.emptyBody}>
            Add a section or build from your lyrics, then tap a bar to drop in a chord and + to add more
            bars. Long-press a bar to select and edit several at once.
          </Text>
        </View>
      ) : (
        sheet.sections.map((section, index) =>
          section.kind === "text" ? (
            <ChordTextBlock
              key={section.id}
              text={section.text ?? ""}
              editable={isEditing}
              onChangeText={(t) => model.setBlockText(section.id, t)}
              onOpenMenu={() =>
                setMenuTarget({
                  id: section.id,
                  label: section.label || "Text",
                  index,
                  count: sheet.sections.length,
                  kind: "text",
                })
              }
            />
          ) : (
            <ChordSheetSection
              key={section.id}
              section={section}
              editable={isEditing}
              selectionActive={!!barSelection}
              selectedMeasureIds={barSelection?.sectionId === section.id ? barSelection.measureIds : []}
              onTapMeasure={(measureId) => handleBarTap(section.id, measureId)}
              onLongPressMeasure={(measureId) => toggleBar(section.id, measureId)}
              onAddMeasure={() => model.addMeasure(section.id)}
              onRemoveChord={(measureId, i) => model.removeChordAt(section.id, measureId, i)}
              onNotes={(notes) => model.setSectionNotes(section.id, notes)}
              onOpenMenu={() =>
                setMenuTarget({
                  id: section.id,
                  label: section.label,
                  index,
                  count: sheet.sections.length,
                  kind: "section",
                })
              }
            />
          )
        )
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
        actions={addSectionActions(addSection, addTextBlock)}
        onClose={() => setAddSheetOpen(false)}
      />

      <SelectionActionSheet
        visible={barMenuOpen}
        title={`${selectedCount} ${selectedCount === 1 ? "bar" : "bars"}`}
        actions={barActions}
        onClose={() => setBarMenuOpen(false)}
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
        suggestions={model.labelSuggestions}
        onSelectSuggestion={(value) => {
          if (renameTarget) model.renameSection(renameTarget.id, value);
          setRenameTarget(null);
        }}
        onCancel={() => setRenameTarget(null)}
        onSave={() => {
          const next = renameDraft.trim();
          if (renameTarget && next) model.renameSection(renameTarget.id, next);
          setRenameTarget(null);
        }}
        saveLabel="Rename"
      />

      <ChordSheetFullView
        visible={fullViewOpen}
        title={model.projectIdea?.title ?? "Chord chart"}
        sheet={sheet}
        onClose={() => setFullViewOpen(false)}
      />
    </>
  );
}

/** Read-only "document" view of the whole chart — the in-app print preview. */
function ChordSheetFullView({
  visible,
  title,
  sheet,
  onClose,
}: {
  visible: boolean;
  title: string;
  sheet: ChordSheet;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={fullView.screen}>
        <View style={fullView.bar}>
          <Text style={fullView.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => [fullView.close, pressed ? appStyles.pressDown : null]}>
            <Ionicons name="close" size={20} color={colors.textStrong} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={fullView.page} showsVerticalScrollIndicator={false}>
          {sheet.sections.map((section) =>
            section.kind === "text" ? (
              <ChordTextBlock
                key={section.id}
                text={section.text ?? ""}
                editable={false}
                onChangeText={() => {}}
                onOpenMenu={() => {}}
              />
            ) : (
              <ChordSheetSection
                key={section.id}
                section={section}
                editable={false}
                selectionActive={false}
                selectedMeasureIds={[]}
                onTapMeasure={() => {}}
                onLongPressMeasure={() => {}}
                onAddMeasure={() => {}}
                onRemoveChord={() => {}}
                onNotes={() => {}}
                onOpenMenu={() => {}}
              />
            )
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function addSectionActions(
  addSection: (label: string) => void,
  addText: () => void
): SelectionAction[] {
  return [
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
    {
      key: "text",
      label: "Text block",
      icon: "document-text-outline" as const,
      onPress: addText,
    },
  ];
}

/** A free-form prose block between sections (not a section's note). */
function ChordTextBlock({
  text,
  editable,
  onChangeText,
  onOpenMenu,
}: {
  text: string;
  editable: boolean;
  onChangeText: (text: string) => void;
  onOpenMenu: () => void;
}) {
  if (!editable) {
    if (!text.trim()) return null;
    return (
      <View style={styles.textBlock}>
        <Text style={styles.textBlockText}>{text.trim()}</Text>
      </View>
    );
  }
  return (
    <View style={styles.textBlock}>
      <View style={styles.textBlockHeader}>
        <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
        <View style={appStyles.flexFill} />
        <Pressable onPress={onOpenMenu} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
      <TextInput
        style={styles.textBlockInput}
        value={text}
        onChangeText={onChangeText}
        placeholder="Write a free-form block — a spoken part, an arrangement note…"
        placeholderTextColor={colors.textMuted}
        multiline
      />
    </View>
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
  selectionBar: {
    marginBottom: spacing.md,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selIconBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.round,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  selDoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.round,
    backgroundColor: colors.primary,
  },
  selDoneText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.onPrimary,
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
  textBlock: {
    marginBottom: spacing.lg,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderMuted,
  },
  textBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  textBlockText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
  },
  textBlockInput: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
    paddingVertical: 2,
    minHeight: 30,
  },
});

const fullView = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMuted,
  },
  title: {
    flex: 1,
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 20,
    color: colors.textPrimary,
    marginRight: spacing.md,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  page: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
