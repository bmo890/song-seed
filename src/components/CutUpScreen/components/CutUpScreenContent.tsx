import { useEffect, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { useCutUpScreenModel } from "../hooks/useCutUpScreenModel";
import { CutUpSourceStep } from "./CutUpSourceStep";
import { CutUpChunkEditor } from "./CutUpChunkEditor";
import { CutUpBoard } from "./CutUpBoard";
import { CutUpDraftEditor } from "./CutUpDraftEditor";
import { CutUpHelpSheet } from "./CutUpHelpSheet";
import { SPARK_PAPER, SparkFooter, SparkHeader, SparkMissing, SparkSteps } from "../../common/SparkFrame";
import type { CutUpStep } from "../../../types";
import { useTranslation } from "react-i18next";

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
      <SafeAreaView style={[styles.shell, { backgroundColor: SPARK_PAPER }]} edges={["top", "bottom"]}>
        <SparkMissing
          icon={<Ionicons name="cut-outline" size={28} color={colors.textMuted} />}
          title={t("wordSparks.gone")}
          body={t("wordSparks.goneBody")}
          onBack={model.goBack}
        />
      </SafeAreaView>
    );
  }

  const activeCount = spark.boardItems.filter((item) => !item.removed).length;
  const canLeaveSource = model.sourceField.draft.trim().length > 0;
  const canLeaveChunk = model.sourceField.draft.trim().length > 0;
  const canLeaveBoard = activeCount > 0;
  const hasDraft = model.draftField.draft.trim().length > 0;
  const stepLabels: Record<CutUpStep, string> = {
    source: t("wordSparks.source"),
    chunk: t("wordSparks.cut"),
    board: t("wordSparks.arrange"),
    draft: t("wordSparks.draft"),
  };

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: SPARK_PAPER }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <SparkHeader
          title={t("wordSparks.cutUp")}
          onBack={model.goBack}
          onHelp={openHelp}
          onDelete={model.deleteSpark}
        />

        <SparkSteps steps={STEP_KEYS.map((key) => stepLabels[key])} current={STEP_KEYS.indexOf(model.step)} />

        <View style={styles.stepBody}>
          {model.step === "source" ? <CutUpSourceStep model={model} spark={spark} /> : null}
          {model.step === "chunk" ? <CutUpChunkEditor model={model} spark={spark} /> : null}
          {model.step === "board" ? <CutUpBoard model={model} spark={spark} /> : null}
          {model.step === "draft" ? <CutUpDraftEditor model={model} spark={spark} keyboardVisible={keyboardVisible} /> : null}
        </View>

        {/* The two text-entry steps (source paste, draft compose) hand the whole
            screen to the keyboard, so their footer steps aside while typing. The
            cut and board steps keep their nav in view. */}
        {(model.step === "source" || model.step === "draft") && keyboardVisible ? null : (
          <>
            {model.step === "source" ? (
              <SparkFooter
                hint={canLeaveSource ? null : t("wordSparks.sourceNeeded")}
                next={{ label: stepLabels.chunk, onPress: () => model.goToStep("chunk"), disabled: !canLeaveSource }}
              />
            ) : null}
            {model.step === "chunk" ? (
              <SparkFooter
                hint={canLeaveChunk ? null : t("wordSparks.sourceNeeded")}
                back={{ label: stepLabels.source, onPress: () => model.goToStep("source") }}
                next={{ label: stepLabels.board, onPress: () => model.goToStep("board"), disabled: !canLeaveChunk }}
              />
            ) : null}
            {model.step === "board" ? (
              <SparkFooter
                hint={canLeaveBoard ? null : t("wordSparks.boardNeeded")}
                back={{ label: stepLabels.chunk, onPress: () => model.goToStep("chunk") }}
                next={{ label: stepLabels.draft, onPress: () => model.goToStep("draft"), disabled: !canLeaveBoard }}
              />
            ) : null}
            {model.step === "draft" ? (
              <SparkFooter
                hint={hasDraft ? null : t("wordSparks.draftNeeded")}
                back={{ label: stepLabels.board, onPress: () => model.goToStep("board") }}
                next={{ label: t("common.save"), onPress: model.saveAsLyrics, disabled: !hasDraft, final: true }}
              />
            ) : null}
          </>
        )}
      </KeyboardAvoidingView>

      <CutUpHelpSheet visible={helpVisible} step={model.step} onClose={() => setHelpVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 16 },
  keyboardView: { flex: 1 },
  stepBody: { flex: 1 },
});
