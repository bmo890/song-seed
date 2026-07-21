import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { styles } from "../styles";
import { useTranslation } from "react-i18next";

export function LyricsUnavailableState() {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title={t("screens.lyrics")} leftIcon="back" />
      <Text style={styles.emptyText}>{t("lyrics.unavailable")}</Text>
    </SafeAreaView>
  );
}
