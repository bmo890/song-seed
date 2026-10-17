import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { SPARK_PAPER, SparkHeader, SparkMissing, SparkSteps } from "../../common/SparkFrame";
import { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";
import { MagpiePageStep } from "./MagpiePageStep";
import { MagpieBuildStep } from "./MagpieBuildStep";
import { MagpieHelpSheet } from "./MagpieHelpSheet";
import { useTranslation } from "react-i18next";

export function MagpieScreenContent() {
  const { t } = useTranslation();
  const model = useMagpieScreenModel();
  const { spark } = model;
  const [helpVisible, setHelpVisible] = useState(false);

  const openHelp = () => {
    if (spark) model.markHelpSeen(model.step);
    setHelpVisible(true);
  };

  if (!spark) {
    return (
      <SafeAreaView style={[styles.shell, { backgroundColor: SPARK_PAPER }]} edges={["top", "bottom"]}>
        <SparkMissing
          icon={<Ionicons name="book-outline" size={28} color={colors.textMuted} />}
          title={t("wordSparks.gone")}
          body={t("wordSparks.goneBody")}
          onBack={model.goBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: SPARK_PAPER }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SparkHeader
          title={t("wordSparks.magpie")}
          onBack={model.goBack}
          onHelp={openHelp}
          onDelete={model.deleteSpark}
        />
        <SparkSteps
          steps={[t("wordSparks.page"), t("wordSparks.build")]}
          current={model.step === "page" ? 0 : 1}
        />
        {model.step === "page" ? (
          <MagpiePageStep model={model} spark={spark} />
        ) : (
          <MagpieBuildStep model={model} spark={spark} />
        )}
      </KeyboardAvoidingView>

      <MagpieHelpSheet visible={helpVisible} step={model.step} onClose={() => setHelpVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 16 },
  keyboardView: { flex: 1 },
});
