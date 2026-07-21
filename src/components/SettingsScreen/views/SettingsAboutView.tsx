import { Linking, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { AboutLinkRow } from "../components/SettingsShared";
import { AppAlert } from "../../common/AppAlert";
import { getCrashLogUri } from "../../../services/crashLog";
import { shareFileUri } from "../../../services/audioStorage";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

const FEEDBACK_EMAIL = "bmostudio.dev@gmail.com";

/**
 * Quiet closing page: the version to quote in a bug report, a way to reach out, and a
 * plain statement of where a SongNook library actually lives.
 */
export function SettingsAboutView() {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? "—";

  const sendFeedback = () => {
    const subject = encodeURIComponent(`SongNook feedback (v${version})`);
    void Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}`).catch(() => {
      // No mail client configured — nothing to open; leave the user where they are.
    });
  };

  const shareDiagnosticLog = async () => {
    const uri = await getCrashLogUri();
    if (!uri) {
      AppAlert.info(
        t("settingsAbout.noDiagnostics"),
        t("settingsAbout.noDiagnosticsBody")
      );
      return;
    }
    try {
      await shareFileUri(uri, "SongNook diagnostic log", "application/json");
    } catch {
      AppAlert.info(t("settingsAbout.couldNotShare"), t("settingsAbout.couldNotShareBody"));
    }
  };

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settings.about")} subtitle={t("settingsAbout.subtitle")} />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.app")}</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <AboutLinkRow label={t("settingsAbout.version")} value={version} />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.feedback")}</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <AboutLinkRow label={t("settingsAbout.sendFeedback")} icon="mail-outline" onPress={sendFeedback} />
          <AboutLinkRow
            label={t("settingsAbout.shareDiagnostics")}
            icon="pulse-outline"
            onPress={() => {
              void shareDiagnosticLog();
            }}
          />
          <AboutLinkRow
            label={t("settingsAbout.replayIntro")}
            icon="sparkles-outline"
            onPress={() => {
              haptic.tap();
              // Flipping the flag surfaces the full-screen WelcomeGate immediately.
              useStore.getState().setHasSeenWelcome(false);
            }}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsAbout.privacy")}</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          {t("settingsAbout.privacyBody")}
        </Text>
      </View>
    </ScrollView>
  );
}
