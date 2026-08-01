import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
import { WarmModal } from "../../common/WarmModal";
import { styles } from "../../../styles";
import { colors, radii } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import {
  MAX_STEP_UP_STAGES,
  STEP_UP_BUILTIN_PRESETS,
  normalizeStepUpSequence,
  stepUpSequencesEqual,
  type RateBounds,
  type StepUpStage,
} from "../../../domain/stepUpLoop";
import { useStepUpPresetsStore } from "../../../state/useStepUpPresetsStore";
import { playerScreenStyles as ps } from "../styles";
import { pd } from "./practiceDrawerStyles";
import { UserTextInput } from "../../../i18n";
import { useTranslation } from "react-i18next";

const RATE_STEP = 0.05;
const MAX_STAGE_LOOPS = 20;

/**
 * The Step up customizer: preset chips (three boilerplate drills + the musician's
 * saved sequences), then one row per stage — passes at a speed — with steppers, a
 * remove control, and an add-step row. Edits commit immediately through
 * `onChangeSequence`; a running session restarts on the new plan (the hook's rule).
 * A plan matching no preset is custom — it can be saved by name for reuse anywhere.
 * No bpm anywhere: these are plain track rates, so the sheet works with or without
 * a recorded grid.
 */
export function StepUpSequenceSheet({
  visible,
  onClose,
  sequence,
  onChangeSequence,
  rateBounds,
}: {
  visible: boolean;
  onClose: () => void;
  sequence: StepUpStage[];
  onChangeSequence: (stages: StepUpStage[]) => void;
  rateBounds: RateBounds;
}) {
  const { t } = useTranslation();
  const userPresets = useStepUpPresetsStore((state) => state.userPresets);
  const saveUserPreset = useStepUpPresetsStore((state) => state.saveUserPreset);
  const removeUserPreset = useStepUpPresetsStore((state) => state.removeUserPreset);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  // A preset is "active" when the plan on screen IS that preset (compared after the
  // same normalization the hook applies on write).
  const matchesStages = (stages: StepUpStage[]) =>
    stepUpSequencesEqual(sequence, normalizeStepUpSequence(stages, rateBounds));
  const activeUserPreset = userPresets.find((preset) => matchesStages(preset.stages)) ?? null;
  const matchesBuiltin = STEP_UP_BUILTIN_PRESETS.some((preset) => matchesStages(preset.stages));
  const isCustomPlan = !matchesBuiltin && !activeUserPreset;

  const applyPreset = (stages: StepUpStage[]) => {
    // Haptics: `tap` — any acknowledged press: buttons, rows, toggles.
    haptic.tap();
    onChangeSequence(stages);
  };

  const updateStage = (index: number, patch: Partial<StepUpStage>) => {
    haptic.tap();
    onChangeSequence(
      sequence.map((stage, stageIndex) =>
        stageIndex === index ? { ...stage, ...patch } : stage
      )
    );
  };

  const removeStage = (index: number) => {
    haptic.tap();
    onChangeSequence(sequence.filter((_, stageIndex) => stageIndex !== index));
  };

  const addStage = () => {
    haptic.tap();
    const last = sequence[sequence.length - 1];
    // A new step keeps drilling upward: same passes, one increment faster (capped).
    const nextRate = Math.min(rateBounds.maxRate, Math.round((last.rate + RATE_STEP) * 100) / 100);
    onChangeSequence([...sequence, { loops: last.loops, rate: nextRate }]);
  };

  const commitSavePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    haptic.tap();
    saveUserPreset(trimmed, sequence);
    setSaveModalOpen(false);
    setPresetName("");
  };

  const canAdd = sequence.length < MAX_STEP_UP_STAGES;
  const canRemove = sequence.length > 1;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.selectionSheetTitle}>{t("player.stepUp")}</Text>
      <Text style={sheetStyles.intro}>{t("player.stepUpSheetHint")}</Text>
      {/* Editorial ink, not chips — the practice drawers retired the chip idiom
          (word + leading dot, hollow → terracotta). */}
      <View style={sheetStyles.presetRow}>
        {[
          ...STEP_UP_BUILTIN_PRESETS.map((preset) => ({
            key: preset.id,
            label: t(`player.stepUpPreset_${preset.id}`),
            stages: preset.stages,
            active: matchesStages(preset.stages),
          })),
          ...userPresets.map((preset) => ({
            key: preset.id,
            label: preset.name,
            stages: preset.stages,
            active: activeUserPreset?.id === preset.id,
          })),
        ].map((preset) => (
          <Pressable
            key={preset.key}
            style={({ pressed }) => [pd.inkOption, pressed ? styles.pressDown : null]}
            onPress={() => applyPreset(preset.stages)}
            accessibilityRole="button"
            accessibilityState={{ selected: preset.active }}
            accessibilityLabel={preset.label}
          >
            {preset.active ? <View style={pd.inkOptionDot} /> : null}
            <Text style={[pd.inkOptionText, preset.active ? pd.inkOptionTextOn : null]}>
              {preset.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={sheetStyles.list} bounces={false}>
        {sequence.map((stage, index) => {
          const canSlower = stage.rate > rateBounds.minRate + 1e-9;
          const canFaster = stage.rate < rateBounds.maxRate - 1e-9;
          const canFewer = stage.loops > 1;
          const canMore = stage.loops < MAX_STAGE_LOOPS;
          return (
            <View key={index} style={[sheetStyles.row, index > 0 ? sheetStyles.rowDivider : null]}>
              <Text style={sheetStyles.rowIndex}>{index + 1}</Text>
              <View style={sheetStyles.stepperGroup}>
                <Pressable
                  style={({ pressed }) => [
                    sheetStyles.stepperButton,
                    !canFewer ? sheetStyles.stepperButtonDisabled : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => canFewer && updateStage(index, { loops: stage.loops - 1 })}
                  disabled={!canFewer}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={t("player.stepUpFewerPasses")}
                >
                  <Ionicons name="remove" size={15} color={canFewer ? colors.textStrong : colors.textMuted} />
                </Pressable>
                <Text style={sheetStyles.stepperValue}>
                  {t("player.stepUpPassCount", { count: stage.loops })}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    sheetStyles.stepperButton,
                    !canMore ? sheetStyles.stepperButtonDisabled : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => canMore && updateStage(index, { loops: stage.loops + 1 })}
                  disabled={!canMore}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={t("player.stepUpMorePasses")}
                >
                  <Ionicons name="add" size={15} color={canMore ? colors.textStrong : colors.textMuted} />
                </Pressable>
              </View>
              <View style={sheetStyles.stepperGroup}>
                <Pressable
                  style={({ pressed }) => [
                    sheetStyles.stepperButton,
                    !canSlower ? sheetStyles.stepperButtonDisabled : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() =>
                    canSlower &&
                    updateStage(index, {
                      rate: Math.max(rateBounds.minRate, Math.round((stage.rate - RATE_STEP) * 100) / 100),
                    })
                  }
                  disabled={!canSlower}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={t("player.stepUpSlower")}
                >
                  <Ionicons name="remove" size={15} color={canSlower ? colors.textStrong : colors.textMuted} />
                </Pressable>
                <Text style={[sheetStyles.stepperValue, sheetStyles.rateValue]}>{`${stage.rate}×`}</Text>
                <Pressable
                  style={({ pressed }) => [
                    sheetStyles.stepperButton,
                    !canFaster ? sheetStyles.stepperButtonDisabled : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() =>
                    canFaster &&
                    updateStage(index, {
                      rate: Math.min(rateBounds.maxRate, Math.round((stage.rate + RATE_STEP) * 100) / 100),
                    })
                  }
                  disabled={!canFaster}
                  hitSlop={4}
                  accessibilityRole="button"
                  accessibilityLabel={t("player.stepUpFaster")}
                >
                  <Ionicons name="add" size={15} color={canFaster ? colors.textStrong : colors.textMuted} />
                </Pressable>
              </View>
              <Pressable
                style={({ pressed }) => [
                  sheetStyles.removeButton,
                  !canRemove ? sheetStyles.stepperButtonDisabled : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => canRemove && removeStage(index)}
                disabled={!canRemove}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t("player.stepUpRemoveStep")}
              >
                <Ionicons name="close" size={15} color={canRemove ? colors.textMuted : colors.borderSubtle} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        style={({ pressed }) => [
          sheetStyles.addRow,
          !canAdd ? sheetStyles.stepperButtonDisabled : null,
          pressed ? styles.pressDown : null,
        ]}
        onPress={() => canAdd && addStage()}
        disabled={!canAdd}
        accessibilityRole="button"
        accessibilityLabel={t("player.stepUpAddStep")}
      >
        <Ionicons name="add" size={16} color={colors.textStrong} />
        <Text style={sheetStyles.addRowText}>{t("player.stepUpAddStep")}</Text>
      </Pressable>
      {isCustomPlan ? (
        <Pressable
          style={({ pressed }) => [sheetStyles.footerLink, pressed ? styles.pressDown : null]}
          onPress={() => {
            setPresetName("");
            setSaveModalOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("player.stepUpSavePreset")}
        >
          <Ionicons name="bookmark-outline" size={14} color={colors.textSecondary} />
          <Text style={sheetStyles.footerLinkText}>{t("player.stepUpSavePreset")}</Text>
        </Pressable>
      ) : activeUserPreset ? (
        <Pressable
          style={({ pressed }) => [sheetStyles.footerLink, pressed ? styles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            removeUserPreset(activeUserPreset.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={t("player.stepUpRemovePreset")}
        >
          <Ionicons name="trash-outline" size={14} color={colors.danger} />
          <Text style={[sheetStyles.footerLinkText, sheetStyles.footerLinkDanger]}>
            {t("player.stepUpRemovePreset")}
          </Text>
        </Pressable>
      ) : null}
      <WarmModal
        visible={saveModalOpen}
        onRequestClose={() => setSaveModalOpen(false)}
        title={t("player.stepUpSaveTitle")}
      >
        <UserTextInput
          style={ps.sectionEditInput}
          value={presetName}
          onChangeText={setPresetName}
          placeholder={t("player.stepUpNamePlaceholder")}
          placeholderTextColor={colors.textMuted}
          returnKeyType="done"
          autoFocus
          onSubmitEditing={commitSavePreset}
        />
        <View style={ps.sectionModalActions}>
          <View style={{ flex: 1 }} />
          <Pressable
            style={ps.sectionModalCancel}
            onPress={() => setSaveModalOpen(false)}
            accessibilityRole="button"
          >
            <Text style={ps.sectionModalCancelText}>{t("common.cancel")}</Text>
          </Pressable>
          <Pressable
            style={[ps.sectionModalConfirm, !presetName.trim() ? ps.sectionModalConfirmDisabled : null]}
            onPress={commitSavePreset}
            disabled={!presetName.trim()}
            accessibilityRole="button"
          >
            <Text style={ps.sectionModalConfirmText}>{t("common.save")}</Text>
          </Pressable>
        </View>
      </WarmModal>
    </BottomSheet>
  );
}

const sheetStyles = StyleSheet.create({
  intro: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 18,
    rowGap: 8,
    marginBottom: 12,
  },
  list: {
    maxHeight: 300,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  rowDivider: {
    borderTopWidth: 0.5,
    borderTopColor: colors.borderSubtle,
  },
  rowIndex: {
    width: 16,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  stepperGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainer,
  },
  stepperButtonDisabled: {
    opacity: 0.45,
  },
  stepperValue: {
    flex: 1,
    textAlign: "center",
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textStrong,
    fontVariant: ["tabular-nums"],
  },
  rateValue: {
    fontFamily: "PlusJakartaSans_600SemiBold",
  },
  removeButton: {
    width: 30,
    height: 30,
    borderRadius: radii.round,
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceHigh,
  },
  addRowText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
  footerLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 8,
    paddingVertical: 7,
  },
  footerLinkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  footerLinkDanger: {
    color: colors.danger,
  },
});
