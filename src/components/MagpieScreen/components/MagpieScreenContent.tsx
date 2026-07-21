import { useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles as appStyles } from "../../../styles";
import { colors, radii, shadows, spacing, text as textTokens } from "../../../design/tokens";
import { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";
import { MagpiePageStep } from "./MagpiePageStep";
import { MagpieBuildStep } from "./MagpieBuildStep";
import { MagpieHelpSheet } from "./MagpieHelpSheet";
import type { MagpieStep } from "../../../types";
import { EnglishOnlyNotice } from "../../common/EnglishOnlyNotice";
import { useTranslation } from "react-i18next";

const KRAFT_BG = "#F2E9DC";

const STEPS: Array<{ key: MagpieStep; label: string }> = [
  { key: "page", label: "The page" },
  { key: "build", label: "Build" },
];

export function MagpieScreenContent() {
  const { t } = useTranslation();
  const model = useMagpieScreenModel();
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
        <ScreenHeader title={t("wordSparks.magpie")} leftIcon="back" onLeftPress={model.goBack} />
        <View style={styles.missingState}>
          <Ionicons name="book-outline" size={28} color={colors.textMuted} />
          <Text style={styles.missingTitle}>{t("wordSparks.gone")}</Text>
          <Text style={styles.missingBody}>{t("wordSparks.goneBody")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasDraft = spark.draft.trim().length > 0 || spark.fragments.length > 0;

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScreenHeader
          title={t("wordSparks.magpie")}
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
        <EnglishOnlyNotice magpie />

        <HelpButton
          label={t(model.step === "page" ? "wordSparks.page" : "wordSparks.build")}
          seen={spark.seenHelpSteps.includes(model.step)}
          onPress={() => {
            model.markHelpSeen(model.step);
            setHelpVisible(true);
          }}
        />

        <View style={styles.stepBody}>
          {model.step === "page" ? (
            <MagpiePageStep model={model} spark={spark} />
          ) : (
            <MagpieBuildStep model={model} spark={spark} />
          )}
        </View>

        {model.step === "build" && !keyboardVisible ? (
          <View style={styles.footerRow}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed ? appStyles.pressDown : null]}
              onPress={() => model.goToStep("page")}
            >
              <Ionicons name="arrow-back" size={16} color={colors.textSecondary} />
              <Text style={styles.backBtnText}>{t("wordSparks.page")}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                !hasDraft ? styles.saveBtnDisabled : null,
                pressed && hasDraft ? appStyles.pressDown : null,
              ]}
              onPress={model.saveAsLyrics}
              disabled={!hasDraft}
            >
              <Ionicons
                name="bookmark-outline"
                size={15}
                color={hasDraft ? colors.onPrimary : colors.textSecondary}
              />
              <Text style={[styles.saveBtnText, !hasDraft ? styles.saveBtnTextDisabled : null]}>
                {t("wordSparks.saveLyrics")}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <MagpieHelpSheet visible={helpVisible} step={model.step} onClose={() => setHelpVisible(false)} />
    </SafeAreaView>
  );
}

function StepProgress({ step }: { step: MagpieStep }) {
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
      <Text style={[styles.helpBtnText, seen ? styles.helpBtnTextSeen : styles.helpBtnTextNew]}>{label}</Text>
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
  missingTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 18, color: colors.textPrimary },
  missingBody: { ...textTokens.supporting, textAlign: "center" },
  stepBody: { flex: 1 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
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
  progressLabel: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 12, color: colors.textMuted },
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
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: 12 },
  backBtnText: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 14, color: colors.textSecondary },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 14,
  },
  saveBtnDisabled: { backgroundColor: colors.borderMuted },
  saveBtnText: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 14, color: colors.onPrimary },
  saveBtnTextDisabled: { color: colors.textSecondary },
});
