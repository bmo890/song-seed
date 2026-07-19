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

const FEEDBACK_EMAIL = "bmostudio.dev@gmail.com";

/**
 * Quiet closing page: the version to quote in a bug report, a way to reach out, and a
 * plain statement of where a SongNook library actually lives.
 */
export function SettingsAboutView() {
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
        "No diagnostics recorded",
        "SongNook has not logged any crashes on this device. If you hit a problem, come back here afterward — the log will be waiting."
      );
      return;
    }
    try {
      await shareFileUri(uri, "SongNook diagnostic log", "application/json");
    } catch {
      AppAlert.info("Could not share", "The diagnostic log could not be shared on this device.");
    }
  };

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title="About" subtitle="Version, a way to reach us, and where your work lives." />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>App</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <AboutLinkRow label="Version" value={version} />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Feedback</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <AboutLinkRow label="Send feedback" icon="mail-outline" onPress={sendFeedback} />
          <AboutLinkRow
            label="Share diagnostic log"
            icon="pulse-outline"
            onPress={() => {
              void shareDiagnosticLog();
            }}
          />
          <AboutLinkRow
            label="Replay intro"
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
          <Text style={styles.settingsSectionLabel}>Privacy</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          Your library stays on this device. Backups and archives are saved only where you send
          them — Files, iCloud, or Drive. Nothing is uploaded automatically.
        </Text>
      </View>
    </ScrollView>
  );
}
