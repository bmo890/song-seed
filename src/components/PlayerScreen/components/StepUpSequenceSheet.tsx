import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet } from "../../common/BottomSheet";
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
import { pd } from "./practiceDrawerStyles";
import { UserTextInput } from "../../../i18n";
import { useTranslation } from "react-i18next";

const RATE_STEP = 0.05;
const MAX_STAGE_LOOPS = 20;

/**
 * PARKED (founder call, 2026-08-01): saving drills under a name is built end to end
 * — store, naming row, the lot — but not surfaced. One remembered Custom slot covers
 * the need, and a library of named drills is a bigger idea than the panel can carry
 * today. Flip this to bring the UI back; nothing else needs changing.
 */
const SAVED_SEQUENCES_ENABLED = false;

/**
 * The Step up customizer: a row of plans in editorial ink (three boilerplate drills,
 * the musician's saved sequences, and Custom), then one row per stage — passes at a
 * speed — with steppers, a remove control, and an add-step row. Edits commit
 * immediately through `onChangeSequence`; a running session restarts on the new plan
 * (the hook's rule). Custom is a plan you can choose, not just a state you fall into
 * by editing, and once chosen it can be named and saved for reuse anywhere.
 *
 * Naming is inline rather than a dialog: this sheet is a modal, and iOS silently
 * refuses to present a modal from inside a presented one.
 *
 * No bpm anywhere: these are plain track rates, so the sheet works with or without a
 * recorded grid.
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
  const customPlan = useStepUpPresetsStore((state) => state.customPlan);
  const saveUserPreset = useStepUpPresetsStore((state) => state.saveUserPreset);
  const removeUserPreset = useStepUpPresetsStore((state) => state.removeUserPreset);
  const [naming, setNaming] = useState(false);
  const [presetName, setPresetName] = useState("");

  // A preset is "active" when the plan on screen IS that preset (compared after the
  // same normalization the hook applies on write).
  const matchesStages = (stages: StepUpStage[]) =>
    stepUpSequencesEqual(sequence, normalizeStepUpSequence(stages, rateBounds));
  const activeUserPreset = SAVED_SEQUENCES_ENABLED
    ? (userPresets.find((preset) => matchesStages(preset.stages)) ?? null)
    : null;
  const matchesBuiltin = STEP_UP_BUILTIN_PRESETS.some((preset) => matchesStages(preset.stages));
  const isCustomPlan = !matchesBuiltin && !activeUserPreset;

  // Choosing Custom starts from a short two-rung ladder rather than a blank sheet —
  // it begins where the plan on screen begins, so the first edit is a nudge, not a
  // build from nothing.
  const starterCustomStages: StepUpStage[] = (() => {
    const firstRate = sequence[0]?.rate ?? rateBounds.minRate;
    const secondRate = Math.min(rateBounds.maxRate, Math.round((firstRate + RATE_STEP) * 100) / 100);
    return [
      { loops: 4, rate: firstRate },
      { loops: 4, rate: secondRate },
    ];
  })();

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
    setNaming(false);
    setPresetName("");
  };

  const canAdd = sequence.length < MAX_STEP_UP_STAGES;
  const canRemove = sequence.length > 1;

  return (
    <BottomSheet visible={visible} onClose={onClose} keyboardAvoiding>
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
          ...(SAVED_SEQUENCES_ENABLED
            ? userPresets.map((preset) => ({
                key: preset.id,
                label: preset.name,
                stages: preset.stages,
                active: activeUserPreset?.id === preset.id,
              }))
            : []),
          // Custom sits with the ready-made plans so building your own is a choice you
          // can make, not something you discover by editing a preset until it stops
          // matching. It is one remembered slot: whatever you last built is what it
          // returns to, on any clip, until you change it.
          {
            key: "custom",
            label: t("player.stepUpCustom"),
            stages: customPlan ?? starterCustomStages,
            active: isCustomPlan,
          },
        ].map((preset) => (
          <Pressable
            key={preset.key}
            style={({ pressed }) => [
              pd.inkOption,
              sheetStyles.presetInk,
              pressed ? styles.pressDown : null,
            ]}
            onPress={() => {
              // Tapping Custom while the plan already IS custom must not wipe the
              // work it is describing.
              if (preset.key === "custom" && isCustomPlan) return;
              applyPreset(preset.stages);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityState={{ selected: preset.active }}
            accessibilityLabel={preset.label}
          >
            {/* The dot's space is reserved, not conditional — otherwise every label
                jumps sideways as the selection moves. */}
            <View style={[pd.inkOptionDot, preset.active ? null : sheetStyles.presetDotIdle]} />
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
      {/* Naming happens inline, not in a dialog: this sheet is itself a modal, and a
          modal presented from inside a presented modal never appears on iOS — which
          is exactly how the save flow was silently doing nothing. */}
      {SAVED_SEQUENCES_ENABLED && naming ? (
        <View style={sheetStyles.namingRow}>
          <UserTextInput
            style={sheetStyles.nameInput}
            value={presetName}
            onChangeText={setPresetName}
            placeholder={t("player.stepUpNamePlaceholder")}
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            autoFocus
            onSubmitEditing={commitSavePreset}
          />
          <Pressable
            style={({ pressed }) => [sheetStyles.footerLink, pressed ? styles.pressDown : null]}
            onPress={() => setNaming(false)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          >
            <Text style={sheetStyles.footerLinkText}>{t("common.cancel")}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              sheetStyles.footerLink,
              !presetName.trim() ? sheetStyles.stepperButtonDisabled : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={commitSavePreset}
            disabled={!presetName.trim()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.save")}
          >
            <Text style={[sheetStyles.footerLinkText, sheetStyles.footerLinkSave]}>
              {t("common.save")}
            </Text>
          </Pressable>
        </View>
      ) : null}
      {SAVED_SEQUENCES_ENABLED && isCustomPlan && !naming ? (
        <Pressable
          style={({ pressed }) => [sheetStyles.footerLink, pressed ? styles.pressDown : null]}
          onPress={() => {
            haptic.tap();
            setPresetName("");
            setNaming(true);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("player.stepUpSavePreset")}
        >
          <Ionicons name="bookmark-outline" size={14} color={colors.textSecondary} />
          <Text style={sheetStyles.footerLinkText}>{t("player.stepUpSavePreset")}</Text>
        </Pressable>
      ) : SAVED_SEQUENCES_ENABLED && activeUserPreset ? (
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
    columnGap: 16,
    rowGap: 2,
    marginBottom: 10,
  },
  // Bare ink is a ~17pt tap target; pad it out to a comfortable one.
  presetInk: {
    paddingVertical: 9,
  },
  presetDotIdle: {
    backgroundColor: "transparent",
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
    paddingVertical: 10,
    // The sheet card's bottom padding is not part of its touchable content box, so a
    // last child that reaches into it renders but cannot be pressed. This keeps the
    // footer clear of it.
    marginBottom: 10,
  },
  footerLinkText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textSecondary,
  },
  footerLinkDanger: {
    color: colors.danger,
  },
  footerLinkSave: {
    color: colors.primaryDeep,
  },
  namingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  nameInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceContainer,
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: colors.textStrong,
  },
});
