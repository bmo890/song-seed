import { Image, Linking, Platform, ScrollView, Text, View } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { AboutLinkRow, SettingsGroup } from "../components/SettingsShared";
import { AppAlert } from "../../common/AppAlert";
import { buildDiagnosticsBundle } from "../../../services/diagnosticsBundle";
import { shareFileUri } from "../../../services/audioStorage";
import { useStore } from "../../../state/useStore";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";
import { toast } from "../../common/toastStore";
import { PRIVACY_POLICY_URL, TERMS_OF_USE_URL } from "../../../config/legalLinks";

const FEEDBACK_EMAIL = "bmostudio.dev@gmail.com";

/**
 * Quiet closing page: the version to quote in a bug report, a way to reach out, and a
 * plain statement of where a SongNook library actually lives.
 */
export function SettingsAboutView() {
  const { t } = useTranslation();
  const version = Constants.expoConfig?.version ?? "—";
  // Real pages now — hosted on songnook.app, generated from the same docs the
  // stores link to. A failed open is the only thing left to toast.
  const openLegal = (url: string) => {
    haptic.tap();
    void Linking.openURL(url).catch(() => toast(t("settingsAbout.linkFailed"), "alert-circle-outline"));
  };

  const sendFeedback = () => {
    const subject = encodeURIComponent(`SongNook feedback (v${version})`);
    void Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${subject}`).catch(() => {
      // No mail client configured — nothing to open; leave the user where they are.
    });
  };

  const sendDiagnosticLog = async () => {
    // Crash log + persistence journal in one file — the journal always has entries
    // (every boot and library write), so there is always something to share.
    try {
      const uri = await buildDiagnosticsBundle();
      await shareFileUri(uri, "SongNook diagnostic log", "application/json");
    } catch {
      AppAlert.info(t("settingsAbout.couldNotShare"), t("settingsAbout.couldNotShareBody"));
    }
  };

  // Android's share sheet has no "save a copy" of its own, so a tester with no mail
  // app set up had no way to get the file off the phone (2026-09-21).
  const saveDiagnosticLogToPhone = async () => {
    try {
      const uri = await buildDiagnosticsBundle();
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) return;
      const contents = await FileSystem.readAsStringAsync(uri);
      const targetUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        `songnook-diagnostics-${new Date().toISOString().slice(0, 10)}`,
        "application/json"
      );
      await FileSystem.StorageAccessFramework.writeAsStringAsync(targetUri, contents);
      haptic.success(); // vocabulary: success — a save the user asked for landed
      toast(t("settingsAbout.diagnosticsSaved"), "checkmark-circle-outline");
    } catch {
      haptic.error(); // vocabulary: error — failures must fire it
      AppAlert.info(t("settingsAbout.couldNotSaveLog"));
    }
  };

  const shareDiagnosticLog = async () => {
    if (Platform.OS !== "android") {
      await sendDiagnosticLog();
      return;
    }
    AppAlert.custom(t("settingsAbout.shareDiagnostics"), undefined, [
      { label: t("settingsAbout.saveToPhone"), style: "default", onPress: () => void saveDiagnosticLogToPhone() },
      { label: t("settingsAbout.shareFile"), style: "default", onPress: () => void sendDiagnosticLog() },
      { label: t("common.cancel"), style: "cancel" },
    ]);
  };

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settings.about")} />

      {/* Colophon: the one place the mark lives in the app (the drawer carries the
          wordmark alone). Mark, name, version — the line to quote in a bug report. */}
      <View style={settingsScreenStyles.colophon}>
        <Image
          source={require("../../../../assets/brand-mark.png")}
          style={settingsScreenStyles.colophonMark}
          resizeMode="contain"
          accessible={false}
        />
        <Text style={settingsScreenStyles.colophonName}>SongNook</Text>
        <Text style={settingsScreenStyles.colophonVersion}>{`${t("settingsAbout.version")} ${version}`}</Text>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.feedback")}</Text>
        </View>
        <SettingsGroup>
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
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsAbout.privacy")}</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          {t("settingsAbout.privacyBody")}
        </Text>
        <SettingsGroup>
          <AboutLinkRow label={t("settingsAbout.privacyPolicy")} icon="shield-checkmark-outline" onPress={() => openLegal(PRIVACY_POLICY_URL)} />
          <AboutLinkRow label={t("settingsAbout.terms")} icon="document-text-outline" onPress={() => openLegal(TERMS_OF_USE_URL)} />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
