import { Linking, ScrollView, Text, View } from "react-native";
import Constants from "expo-constants";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { AboutLinkRow } from "../components/SettingsShared";

const FEEDBACK_EMAIL = "bmogerman@gmail.com";

/**
 * Quiet closing page: the version to quote in a bug report, a way to reach out, and a
 * plain statement of where a Song Seed library actually lives.
 */
export function SettingsAboutView() {
  const version = Constants.expoConfig?.version ?? "—";

  const sendFeedback = () => {
    const subject = encodeURIComponent(`Song Seed feedback (v${version})`);
    void Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}`).catch(() => {
      // No mail client configured — nothing to open; leave the user where they are.
    });
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
