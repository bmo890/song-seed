import { Linking, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useTunerScreenModel } from "../hooks/useTunerScreenModel";
import { styles } from "../styles";
import { TunerDial } from "./TunerDial";
import { useTranslation } from "react-i18next";

export function TunerScreenContent() {
  const { t } = useTranslation();
  useBrowseRootBackHandler();
  const model = useTunerScreenModel();

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title={t("screens.tuner")} leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.pageContent}
      >
        <TunerDial model={model} />

        <Text style={styles.helperText}>
          {t("screens.tunerHint")}
        </Text>

        {model.errorMessage ? (
          <Text
            style={styles.errorText}
            onPress={() => {
              if (model.permissionBlocked) {
                void Linking.openSettings();
              } else {
                void model.retry();
              }
            }}
          >
            {model.errorMessage}
            {model.permissionBlocked ? t("tuner.openSettings") : t("tuner.tryAgain")}
          </Text>
        ) : null}
      </ScrollView>

    </SafeAreaView>
  );
}
