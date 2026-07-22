import { useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { haptic } from "../../../design/haptics";
import { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { CutUpSourceStep } from "./CutUpSourceStep";
import { CutUpChunkEditor } from "./CutUpChunkEditor";
import { CutUpBoard } from "./CutUpBoard";
import { CutUpDraftEditor } from "./CutUpDraftEditor";
import { CutUpHelpSheet } from "./CutUpHelpSheet";
import type { CutUpStep } from "../../../types";
import { useTranslation } from "react-i18next";

const KRAFT_BG = "#F2E9DC";

const STEP_KEYS: CutUpStep[] = ["source", "chunk", "board", "draft"];

export function CutUpScreenContent() {
  const { t } = useTranslation();
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

  const openHelp = () => {
    if (spark) model.markHelpSeen(model.step);
    setHelpVisible(true);
  };

  if (!spark) {
    return (
      <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
        <View style={styles.missingState}>
          <Ionicons name="cut-outline" size={28} color={colors.textMuted} />
          <Text style={styles.missingTitle}>{t("wordSparks.gone")}</Text>
          <Text style={styles.missingBody}>{t("wordSparks.goneBody")}</Text>
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
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.header}>
          <IconBtn icon="chevron-back" label="Back" onPress={model.goBack} />
          <Text style={styles.headerTitle}>{t("wordSparks.cutUp")}</Text>
          <IconBtn icon="help-circle-outline" label="How this works" onPress={openHelp} />
          <IconBtn icon="trash-outline" label="Delete" onPress={model.deleteSpark} muted />
        </View>

        <StepRail step={model.step} />

        <View style={styles.stepBody}>
          {model.step === "source" ? <CutUpSourceStep model={model} spark={spark} /> : null}
          {model.step === "chunk" ? <CutUpChunkEditor model={model} spark={spark} /> : null}
          {model.step === "board" ? <CutUpBoard model={model} spark={spark} /> : null}
          {model.step === "draft" ? <CutUpDraftEditor model={model} spark={spark} keyboardVisible={keyboardVisible} /> : null}
        </View>

        {keyboardVisible ? null : (
          <View style={styles.wizardFooter}>
            {model.step === "source" ? (
              <NextBtn label={t("wordSparks.nextCut")} onPress={() => model.goToStep("chunk")} canNext={canLeaveSource} grow />
            ) : null}
            {model.step === "chunk" ? (
              <FooterRow backLabel={t("wordSparks.source")} onBack={() => model.goToStep("source")} nextLabel={t("wordSparks.nextBoard")} onNext={() => model.goToStep("board")} canNext={canLeaveChunk} disabledHint={canLeaveChunk ? null : t("wordSparks.sourceNeeded")} />
            ) : null}
            {model.step === "board" ? (
              <FooterRow backLabel={t("wordSparks.cut")} onBack={() => model.goToStep("chunk")} nextLabel={t("wordSparks.nextRebuild")} onNext={() => model.goToStep("draft")} canNext={canLeaveBoard} disabledHint={canLeaveBoard ? null : t("wordSparks.boardNeeded")} />
            ) : null}
            {model.step === "draft" ? (
              <FooterRow backLabel={t("wordSparks.arrange")} onBack={() => model.goToStep("board")} nextLabel={t("wordSparks.saveLyrics")} nextIcon="bookmark-outline" onNext={model.saveAsLyrics} canNext={hasDraft} disabledHint={hasDraft ? null : t("wordSparks.draftNeeded")} />
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>

      <CutUpHelpSheet visible={helpVisible} step={model.step} onClose={() => setHelpVisible(false)} />
    </SafeAreaView>
  );
}

function IconBtn({
  icon,
  label,
  onPress,
  muted,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  muted?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.iconBtn, pressed ? appStyles.pressDown : null]} onPress={onPress} hitSlop={6} accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={muted ? colors.textSecondary : colors.textStrong} />
    </Pressable>
  );
}

function StepRail({ step }: { step: CutUpStep }) {
  const { t } = useTranslation();
  const labels: Record<CutUpStep, string> = {
    source: t("wordSparks.source"),
    chunk: t("wordSparks.cut"),
    board: t("wordSparks.arrange"),
    draft: t("wordSparks.draft"),
  };
  const currentIndex = STEP_KEYS.indexOf(step);
  const progress = (currentIndex + 1) / STEP_KEYS.length;
  return (
    <View style={styles.rail}>
      <View style={styles.railLabels}>
        {STEP_KEYS.map((key, i) => (
          <Text
            key={key}
            style={[
              styles.railLabel,
              i === currentIndex ? styles.railLabelCurrent : i < currentIndex ? styles.railLabelDone : null,
            ]}
          >
            {labels[key]}
          </Text>
        ))}
      </View>
      <View style={styles.railTrack}>
        <View style={[styles.railFill, { width: `${progress * 100}%` }]} />
      </View>
    </View>
  );
}

function NextBtn({ label, onPress, canNext, grow, icon }: { label: string; onPress: () => void; canNext: boolean; grow?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.nextBtn, grow ? styles.nextBtnGrow : null, !canNext ? styles.nextBtnDisabled : null, pressed && canNext ? appStyles.pressDown : null]}
      onPress={() => {
        if (canNext) haptic.tap();
        onPress();
      }}
      disabled={!canNext}
    >
      {icon ? <Ionicons name={icon} size={15} color={canNext ? colors.onPrimary : colors.textSecondary} /> : null}
      <Text style={[styles.nextBtnText, !canNext ? styles.nextBtnTextDisabled : null]}>{label}</Text>
      {!icon ? <Ionicons name="arrow-forward" size={16} color={canNext ? colors.onPrimary : colors.textSecondary} /> : null}
    </Pressable>
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
        <Pressable style={({ pressed }) => [styles.backBtn, pressed ? appStyles.pressDown : null]} onPress={onBack}>
          <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
          <Text style={styles.backBtnText}>{backLabel}</Text>
        </Pressable>
        <NextBtn label={nextLabel} onPress={onNext} canNext={canNext} grow icon={nextIcon} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 16 },
  keyboardView: { flex: 1 },
  missingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xxl },
  missingTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 18, color: colors.textPrimary },
  missingBody: { ...textTokens.supporting, textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  headerTitle: { flex: 1, fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 20, color: colors.textPrimary },
  iconBtn: { width: 34, height: 34, borderRadius: radii.round, alignItems: "center", justifyContent: "center" },

  rail: { marginBottom: spacing.lg, gap: spacing.xs },
  railLabels: { flexDirection: "row", justifyContent: "space-between" },
  railLabel: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 11.5, color: colors.textMuted },
  railLabelDone: { color: colors.textSecondary },
  railLabelCurrent: { fontFamily: "PlusJakartaSans_700Bold", color: colors.primaryDeep },
  railTrack: { height: 3, borderRadius: 3, backgroundColor: colors.borderMuted, overflow: "hidden" },
  railFill: { height: 3, borderRadius: 3, backgroundColor: colors.primaryDeep },

  stepBody: { flex: 1 },

  wizardFooter: { paddingVertical: spacing.md, gap: spacing.sm },
  footerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  warnRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  footerHint: { fontFamily: "PlusJakartaSans_500Medium", fontSize: 12, color: colors.textMuted, textAlign: "center" },
  nextBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: colors.primaryDeep, borderRadius: radii.round, paddingVertical: 14, paddingHorizontal: spacing.lg },
  nextBtnGrow: { flex: 1 },
  nextBtnDisabled: { backgroundColor: colors.borderMuted },
  nextBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },
  nextBtnTextDisabled: { color: colors.textSecondary },
  backBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, paddingVertical: 12 },
  backBtnText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: colors.textSecondary },
});
