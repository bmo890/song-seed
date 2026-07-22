import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, text as textTokens } from "../../../design/tokens";
import { useMagpieScreenModel } from "../hooks/useMagpieScreenModel";
import { MagpiePageStep } from "./MagpiePageStep";
import { MagpieBuildStep } from "./MagpieBuildStep";
import { MagpieHelpSheet } from "./MagpieHelpSheet";
import { useTranslation } from "react-i18next";

const KRAFT_BG = "#F2E9DC";

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
      <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
        <View style={styles.missingState}>
          <Ionicons name="book-outline" size={28} color={colors.textMuted} />
          <Text style={styles.missingTitle}>{t("wordSparks.gone")}</Text>
          <Text style={styles.missingBody}>{t("wordSparks.goneBody")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.shell, { backgroundColor: KRAFT_BG }]} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {model.step === "page" ? (
          <MagpiePageStep model={model} spark={spark} onHelp={openHelp} />
        ) : (
          <MagpieBuildStep model={model} spark={spark} onHelp={openHelp} />
        )}
      </KeyboardAvoidingView>

      <MagpieHelpSheet visible={helpVisible} step={model.step} onClose={() => setHelpVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 16 },
  keyboardView: { flex: 1 },
  missingState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
  },
  missingTitle: { fontFamily: "PlayfairDisplay_600SemiBold", fontSize: 18, color: colors.textPrimary },
  missingBody: { ...textTokens.supporting, textAlign: "center" },
});
