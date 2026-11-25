import { Linking, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { AboutLinkRow, SettingsGroup } from "../components/SettingsShared";
import { haptic } from "../../../design/haptics";
import { toast } from "../../common/toastStore";
import { OPEN_DATA_SOURCES } from "../../../config/openData";

/**
 * The open projects the word tools and books come from. Owed credit, rarely read,
 * so it sits one row deep under Help & about (founder, 2026-11-25).
 */
export function SettingsOpenDataView() {
  const { t } = useTranslation();
  const open = (url: string) => {
    haptic.tap();
    void Linking.openURL(url).catch(() => toast(t("settingsAbout.linkFailed"), "alert-circle-outline"));
  };
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settingsAbout.openData")} />
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionHint}>{t("settingsAbout.openDataLine")}</Text>
        <SettingsGroup>
          {OPEN_DATA_SOURCES.map((source) => (
            <AboutLinkRow
              key={source.name}
              label={source.name}
              value={t(`settingsAbout.openDataUse.${source.use}`)}
              icon="open-outline"
              onPress={() => open(source.url)}
            />
          ))}
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
