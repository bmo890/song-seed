import { useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { CutUpSourceStep } from "./CutUpSourceStep";
import { CutUpChunkEditor } from "./CutUpChunkEditor";
import { CutUpBoard } from "./CutUpBoard";
import { CutUpDraftEditor } from "./CutUpDraftEditor";
import { CutUpHelpSheet } from "./CutUpHelpSheet";
import type { CutUpStep } from "../../../types";

const KRAFT_BG = "#F2E9DC";

const STEPS: Array<{ key: CutUpStep; label: string }> = [
  { key: "source", label: "Source" },
  { key: "chunk", label: "Cut" },
  { key: "board", label: "Arrange" },
  { key: "draft", label: "Draft" },
];

export function CutUpScreenContent() {
  const model = useCutUpScreenModel();
  const { spark } = model;
  const [helpVisible, setHelpVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!spark) {
    return (
      <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
        <ScreenHeader title="Cut-Up" leftIcon="back" onLeftPress={model.goBack} />
        <View style={styles.missingState}>
          <Ionicons name="cut-outline" size={28} color={colors.textMuted} />
          <Text style={styles.missingTitle}>This exercise is gone</Text>
          <Text style={styles.missingBody}>
            It may have been deleted. Head back to the Lyrics Notebook to start a new one.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeCount = spark.boardItems.filter((item) => !item.removed).length;
  const canLeaveSource = spark.sourceText.trim().length > 0;
  const canLeaveChunk = spark.sourceText.trim().length > 0;
  const canLeaveBoard = activeCount > 0;
  const hasDraft = spark.assembledDraftText.trim().length > 0;

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScreenHeader
          title="Cut-Up"
          leftIcon="back"
          onLeftPress={model.goBack}
          rightElement={
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed ? appStyles.pressDown : null]}
              onPress={model.deleteSpark}
              hitSlop={6}
            >
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          }
        />

        <StepProgress step={model.step} />

        <HelpButton
          label={STEPS.find((s) => s.key === model.step)?.label ?? "Help"}
          seen={spark.seenHelpSteps.includes(model.step)}
          onPress={() => {
            model.markHelpSeen(model.step);
            setHelpVisible(true);
          }}
        />

        <View style={styles.stepBody}>
          {model.step === "source" ? <CutUpSourceStep model={model} spark={spark} /> : null}
          {model.step === "chunk" ? <CutUpChunkEditor model={model} spark={spark} /> : null}
          {model.step === "board" ? <CutUpBoard model={model} spark={spark} /> : null}
          {model.step === "draft" ? (
            <CutUpDraftEditor model={model} spark={spark} keyboardVisible={keyboardVisible} />
          ) : null}
        </View>

        {keyboardVisible ? null : (
          <View style={styles.wizardFooter}>
            {model.step === "source" ? (
              <Pressable
                style={({ pressed }) => [
                  styles.nextBtn,
                  !canLeaveSource ? styles.nextBtnDisabled : null,
                  pressed && canLeaveSource ? appStyles.pressDown : null,
                ]}
                onPress={() => model.goToStep("chunk")}
                disabled={!canLeaveSource}
              >
                <Text style={[styles.nextBtnText, !canLeaveSource ? styles.nextBtnTextDisabled : null]}>
                  Next: cut it up
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={canLeaveSource ? colors.onPrimary : colors.textSecondary}
                />
              </Pressable>
            ) : null}

            {model.step === "chunk" ? (
              <FooterRow
                backLabel="Source"
                onBack={() => model.goToStep("source")}
                nextLabel="Next: to the board"
                onNext={() => model.goToStep("board")}
                canNext={canLeaveChunk}
                disabledHint={canLeaveChunk ? null : "Add some source text to cut."}
              />
            ) : null}

            {model.step === "board" ? (
              <FooterRow
                backLabel="Cut"
                onBack={() => model.goToStep("chunk")}
                nextLabel="Next: rebuild draft"
                onNext={() => model.goToStep("draft")}
                canNext={canLeaveBoard}
                disabledHint={canLeaveBoard ? null : "Keep at least one strip on the board."}
              />
            ) : null}

            {model.step === "draft" ? (
              <FooterRow
                backLabel="Arrange"
                onBack={() => model.goToStep("board")}
                nextLabel="Save as lyrics"
                nextIcon="bookmark-outline"
                onNext={model.saveAsLyrics}
                canNext={hasDraft}
                disabledHint={hasDraft ? null : "Rebuild or write a draft to save."}
              />
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>

      <CutUpHelpSheet visible={helpVisible} step={model.step} onClose={() => setHelpVisible(false)} />
    </SafeAreaView>
  );
}

function FooterRow({
  backLabel,
  onBack,
  nextLabel,
  nextIcon,
  onNext,
  canNext,
  disabledHint,
}: {
  backLabel: string;
  onBack: () => void;
  nextLabel: string;
  nextIcon?: keyof typeof Ionicons.glyphMap;
  onNext: () => void;
  canNext: boolean;
  disabledHint: string | null;
}) {
  return (
    <>
      {disabledHint ? (
        <View style={styles.warnRow}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.footerHint}>{disabledHint}</Text>
        </View>
      ) : null}
      <View style={styles.footerRow}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed ? appStyles.pressDown : null]}
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
          <Text style={styles.backBtnText}>{backLabel}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            styles.nextBtnGrow,
            !canNext ? styles.nextBtnDisabled : null,
            pressed && canNext ? appStyles.pressDown : null,
          ]}
          onPress={onNext}
          disabled={!canNext}
        >
          {nextIcon ? (
            <Ionicons name={nextIcon} size={15} color={canNext ? colors.onPrimary : colors.textSecondary} />
          ) : null}
          <Text style={[styles.nextBtnText, !canNext ? styles.nextBtnTextDisabled : null]}>{nextLabel}</Text>
          {!nextIcon ? (
            <Ionicons
              name="arrow-forward"
              size={16}
              color={canNext ? colors.onPrimary : colors.textSecondary}
            />
          ) : null}
        </Pressable>
      </View>
    </>
  );
}

function StepProgress({ step }: { step: CutUpStep }) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <View style={styles.progressRow}>
      {STEPS.map((s, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        const isCurrent = state === "current";
        return (
          <View key={s.key} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                isCurrent ? styles.progressDotCurrent : null,
                state === "done" ? styles.progressDotDone : null,
              ]}
            >
              {state === "done" ? (
                <Ionicons name="checkmark" size={11} color={colors.onPrimary} />
              ) : (
                <Text style={[styles.progressNum, isCurrent ? styles.progressNumCurrent : null]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text style={[styles.progressLabel, isCurrent ? styles.progressLabelCurrent : null]}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function HelpButton({ label, seen, onPress }: { label: string; seen: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.helpBtn,
        seen ? styles.helpBtnSeen : styles.helpBtnNew,
        pressed ? appStyles.pressDown : null,
      ]}
      onPress={onPress}
      hitSlop={6}
    >
      <Ionicons name="help-circle" size={15} color={seen ? colors.textMuted : colors.onPrimary} />
      <Text style={[styles.helpBtnText, seen ? styles.helpBtnTextSeen : styles.helpBtnTextNew]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 16 },
  keyboardView: { flex: 1 },
  deleteBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  missingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  missingTitle: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 18,
    color: colors.textPrimary,
  },
  missingBody: { ...textTokens.supporting, textAlign: "center" },
  stepBody: { flex: 1 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: radii.round,
    backgroundColor: colors.borderMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotCurrent: { backgroundColor: colors.primary },
  progressDotDone: { backgroundColor: colors.primary },
  progressNum: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    includeFontPadding: false,
    color: colors.textSecondary,
  },
  progressNumCurrent: { color: colors.onPrimary },
  progressLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: colors.textMuted,
  },
  progressLabelCurrent: { color: colors.textPrimary },
  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
    borderRadius: radii.round,
  },
  helpBtnNew: { backgroundColor: colors.primary, ...shadows.control },
  helpBtnSeen: { backgroundColor: "transparent" },
  helpBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 12 },
  helpBtnTextNew: { color: colors.onPrimary },
  helpBtnTextSeen: { color: colors.textMuted, fontFamily: "PlusJakartaSans_600SemiBold" },
  wizardFooter: { paddingVertical: spacing.md, gap: spacing.sm },
  footerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  warnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  footerHint: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 14,
  },
  nextBtnGrow: { flex: 1 },
  nextBtnDisabled: { backgroundColor: colors.borderMuted },
  nextBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },
  nextBtnTextDisabled: { color: colors.textSecondary },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: 12,
  },
  backBtnText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: colors.textSecondary },
});
