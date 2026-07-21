import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { SECTION_PRESETS } from "../../../domain/chordSheet";
import type { ChordSheet } from "../../../types";
import { ChordPickerSheet } from "../../LyricsVersionScreen/components/chords/ChordPickerSheet";
import { IconButton } from "../../common/IconButton";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import type { SelectionAction } from "../../common/SelectionDock";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { AppAlert } from "../../common/AppAlert";
import { ChordSheetSection } from "../ChordSheetSection";
import { BarEditorSheet } from "./BarEditorSheet";
import { useScrollIntoViewOnFocus } from "./chartScroll";
import type { useChordSheetModel } from "../useChordSheetModel";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";
import { UserText, UserTextInput } from "../../../i18n";

type MenuTarget = { id: string; label: string; index: number; count: number; kind: "section" | "text" };

/** The chord-sheet content shared by the standalone screen and the song "Chart"
 * tab: add-section + build controls, the section staves with bar selection, and
 * the chord picker. The host supplies the scroll container, header, and export. */
export function ChordSheetBody({
  model,
  displaySheet,
}: {
  model: ReturnType<typeof useChordSheetModel>;
  /** Read-mode display override (e.g. the transposed sheet). Editing always
   *  shows the written key — edits target real measures, not transposed copies. */
  displaySheet?: ChordSheet;
}) {
  const { t } = useTranslation();
  const { isEditing } = model;
  const sheet = !isEditing && displaySheet ? displaySheet : model.sheet;
  const isEmpty = sheet.sections.length === 0;

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; label: string } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const barSelection = model.barSelection;

  const addSection = (label: string) => {
    model.addSection(label);
    if (!isEditing) model.setIsEditing(true);
  };

  const addTextBlock = () => {
    model.addTextBlock();
    if (!isEditing) model.setIsEditing(true);
  };

  const menuActions: SelectionAction[] = menuTarget
    ? [
        ...(menuTarget.kind === "text"
          ? []
          : [
              {
                key: "rename",
                label: t("chordChart.rename"),
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
                label: t("chordChart.moveUp"),
                icon: "arrow-up-outline" as const,
                onPress: () => model.moveSection(menuTarget.id, -1),
              },
            ]
          : []),
        ...(menuTarget.index < menuTarget.count - 1
          ? [
              {
                key: "down",
                label: t("chordChart.moveDown"),
                icon: "arrow-down-outline" as const,
                onPress: () => model.moveSection(menuTarget.id, 1),
              },
            ]
          : []),
        {
          key: "delete",
          label: menuTarget.kind === "text" ? t("chordChart.deleteTextBlock") : t("chordChart.deleteSection"),
          icon: "trash-outline",
          tone: "danger",
          onPress: () => {
            const id = menuTarget.id;
            const isText = menuTarget.kind === "text";
            AppAlert.destructive(
              isText ? t("chordChart.deleteTextTitle") : t("chordChart.deleteSectionTitle"),
              isText ? t("chordChart.deleteTextBody") : t("chordChart.deleteSectionBody"),
              () => model.removeSection(id),
              { confirmLabel: t("chordChart.delete") }
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
            <Text style={styles.actionBtnText}>{t("chordChart.addSection")}</Text>
          </Pressable>
          {isEmpty ? (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => model.buildFromLyrics()}
            >
              <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
              <Text style={styles.actionBtnText}>{t("chordChart.buildFromLyrics")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={isEditing ? styles.editSurface : undefined}>
      {isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="grid-outline" size={26} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>{t("chordChart.blankTitle")}</Text>
          <Text style={styles.emptyBody}>{t("chordChart.blankBody")}</Text>
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
                  label: section.label || t("chordChart.text"),
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
              onTapMeasure={(measureId) =>
                barSelection
                  ? model.toggleBarSelection(section.id, measureId)
                  : model.openBarEditor(section.id, measureId)
              }
              onLongPressMeasure={(measureId) => model.toggleBarSelection(section.id, measureId)}
              onAddMeasure={() => model.addMeasure(section.id)}
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
      </View>

      <BarEditorSheet
        visible={!!model.barEditor}
        chords={model.barEditorMeasure?.chords ?? []}
        onAddChord={() =>
          model.barEditor && model.openChordPicker(model.barEditor.sectionId, model.barEditor.measureId, null)
        }
        onEditChord={(index) =>
          model.barEditor && model.openChordPicker(model.barEditor.sectionId, model.barEditor.measureId, index)
        }
        onClose={model.closeBarEditor}
      />

      <ChordPickerSheet
        visible={!!model.pickerTarget}
        mode={model.pickerMode}
        initial={model.pickerInitial}
        palette={model.palette}
        onClose={model.closePicker}
        onSave={model.saveChord}
        onDelete={model.removeEditingChord}
      />

      <SelectionActionSheet
        visible={addSheetOpen}
        title={t("chordChart.addSection")}
        actions={addSectionActions(addSection, addTextBlock, t)}
        onClose={() => setAddSheetOpen(false)}
      />

      <SelectionActionSheet
        visible={!!menuTarget}
        title={menuTarget?.label || t("chordChart.section")}
        actions={menuActions}
        onClose={() => setMenuTarget(null)}
      />

      <QuickNameModal
        visible={!!renameTarget}
        title={t("chordChart.renameSection")}
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
        saveLabel={t("chordChart.rename")}
      />
    </>
  );
}

/** Read-only "document" view of the whole chart — the in-app print preview. */
export function ChordSheetFullView({
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
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [pageWidth, setPageWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  // Each open starts at 100%.
  useEffect(() => {
    if (visible) setScale(1);
  }, [visible]);

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

        <ScrollView style={appStyles.flexFill} contentContainerStyle={fullView.page} showsVerticalScrollIndicator={false}>
          {/* The page is laid out at width/scale then scaled to fit, so the bars
           * always fill the width (no horizontal overflow) while text and row
           * height scale — zoom out to fit more, in to fit less. The outer box is
           * sized to the scaled height so vertical scrolling matches the zoom. */}
          <View style={fullView.measure} onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
            {pageWidth > 0 ? (
              <View style={{ height: contentHeight ? contentHeight * scale : undefined }}>
                <View
                  onLayout={(e) => setContentHeight(e.nativeEvent.layout.height)}
                  style={{ width: pageWidth / scale, transform: [{ scale }], transformOrigin: "top left" }}
                >
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
                        onNotes={() => {}}
                        onOpenMenu={() => {}}
                      />
                    )
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={fullView.zoomBar}>
          <Ionicons name="text" size={13} color={colors.textMuted} />
          <Slider
            onSlidingComplete={() => haptic.tap()}
            style={appStyles.flexFill}
            minimumValue={0.5}
            maximumValue={1.6}
            value={scale}
            onValueChange={setScale}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.borderMuted}
            thumbTintColor={colors.primary}
          />
          <Ionicons name="text" size={20} color={colors.textMuted} />
          <Pressable
            onPress={() => setScale(1)}
            disabled={Math.abs(scale - 1) < 0.001}
            hitSlop={8}
            accessibilityLabel={t("chordChart.resetZoom")}
            style={({ pressed }) => [fullView.reset, pressed ? appStyles.pressDown : null]}
          >
            <Ionicons
              name="refresh"
              size={16}
              color={Math.abs(scale - 1) < 0.001 ? colors.borderMuted : colors.primary}
            />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function addSectionActions(
  addSection: (label: string) => void,
  addText: () => void,
  t: (key: string, options?: Record<string, unknown>) => string
): SelectionAction[] {
  const presetKeys: Record<string, string> = { "Pre-Chorus": "PreChorus" };
  return [
    ...SECTION_PRESETS.map((preset) => ({
      key: preset,
      label: t(`chordChart.presets.${presetKeys[preset] ?? preset}`),
      icon: "add" as const,
      onPress: () => addSection(t(`chordChart.presets.${presetKeys[preset] ?? preset}`)),
    })),
    {
      key: "custom",
      label: t("chordChart.customSection"),
      icon: "create-outline" as const,
      onPress: () => addSection(t("chordChart.section")),
    },
    {
      key: "text",
      label: t("chordChart.textBlock"),
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
  const { t } = useTranslation();
  const field = useScrollIntoViewOnFocus();
  if (!editable) {
    if (!text.trim()) return null;
    return (
      <View style={styles.textBlock}>
        <View style={styles.textBlockHeader}>
          <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
        </View>
        <UserText value={text.trim()} style={styles.textBlockText}>{text.trim()}</UserText>
      </View>
    );
  }
  return (
    <View style={styles.textBlock}>
      <View style={styles.textBlockHeader}>
        <Ionicons name="document-text-outline" size={13} color={colors.textMuted} />
        <View style={appStyles.flexFill} />
        <IconButton
          icon="ellipsis-horizontal"
          tone="muted"
          size={16}
          onPress={onOpenMenu}
          accessibilityLabel={t("chordChart.textBlockOptions")}
        />
      </View>
      <UserTextInput
        ref={field.ref}
        onFocus={field.onFocus}
        style={styles.textBlockInput}
        value={text}
        onChangeText={onChangeText}
        placeholder={t("chordChart.textBlockPlaceholder")}
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
  editSurface: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  measure: { width: "100%" },
  zoomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderMuted,
  },
  reset: {
    width: 32,
    height: 32,
    borderRadius: radii.round,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
});
