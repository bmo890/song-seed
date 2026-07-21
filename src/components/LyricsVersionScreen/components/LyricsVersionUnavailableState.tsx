import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";
import { useTranslation } from "react-i18next";

export function LyricsVersionUnavailableState() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScreenHeader title={t("lyrics.versionTitle")} leftIcon="back" />
      <Text style={styles.emptyText}>{t("lyrics.versionUnavailable")}</Text>
    </SafeAreaView>
  );
}
