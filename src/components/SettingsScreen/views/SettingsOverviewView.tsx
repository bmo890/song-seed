import { Linking, Platform, ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { FormatOptionRow, LibraryActionCard, SegmentedField, ToggleRow } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { haptic } from "../../../design/haptics";
import { useIsPro } from "../../../domain/entitlements";
import { openProUpsell } from "../../common/proUpsell";
import { restorePurchases } from "../../../services/billing";
import { AppAlert } from "../../common/AppAlert";
import { useTranslation } from "react-i18next";
import { useLocale } from "../../../i18n";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;

/**
 * Deliberately short: startup, feedback, and one doorway into the Library &
 * Backups page. Anything screen-specific (Bluetooth calibration, tag management)
 * lives on the screen it serves, not here.
 */
export function SettingsOverviewView({
  workspaceStartupPreference,
  setWorkspaceStartupPreference,
  hapticsEnabled,
  setHapticsEnabled,
  primaryWorkspaceTitle,
  backupFlow,
  onOpenLibrary,
  onOpenRecording,
  onOpenSharing,
  onOpenAbout,
}: {
  workspaceStartupPreference: "primary" | "last-used";
  setWorkspaceStartupPreference: (next: "primary" | "last-used") => void;
  hapticsEnabled: boolean;
  setHapticsEnabled: (next: boolean) => void;
  primaryWorkspaceTitle: string | null;
  backupFlow: LibraryBackupFlow;
  onOpenLibrary: () => void;
  onOpenRecording: () => void;
  onOpenSharing: () => void;
  onOpenAbout: () => void;
}) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLocale();
  const isPro = useIsPro();
  const libraryMeta = backupFlow.isBackingUp
    ? backupFlow.backupProgressLabel ?? t("settings.backingUp")
    : backupFlow.isRestoring
      ? backupFlow.restoreProgressLabel ?? t("settings.restoring")
      : backupFlow.lastSuccessfulBackupFileName
        ? t("settings.lastBackup", { date: backupFlow.lastSuccessfulBackupLabel })
        : t("settings.noBackup");

  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
      />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>SongNook Pro</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          {isPro ? (
            <FormatOptionRow
              title={t("settings.proActive")}
              subtitle={t("settings.proActiveHint")}
              selected={false}
              onPress={() => {
                haptic.tap();
                const url =
                  Platform.OS === "ios"
                    ? "https://apps.apple.com/account/subscriptions"
                    : "https://play.google.com/store/account/subscriptions";
                void Linking.openURL(url).catch(() => {});
              }}
            />
          ) : (
            <FormatOptionRow
              title={t("settings.upgradePro")}
              subtitle={t("settings.upgradeProHint")}
              selected={false}
              onPress={() => {
                haptic.tap();
                openProUpsell();
              }}
            />
          )}
          <FormatOptionRow
            title={t("settings.restorePurchases")}
            subtitle={t("settings.restorePurchasesHint")}
            selected={false}
            onPress={() => {
              haptic.tap();
              void restorePurchases().then((result) => {
                if (!result.ok) {
                  AppAlert.info(t("settings.restorePurchases"), t("settings.nothingToRestore"));
                }
              });
            }}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.startup")}</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <FormatOptionRow
            title={t("settings.primaryWorkspace")}
            subtitle={
              primaryWorkspaceTitle
                ? t("settings.primaryWorkspaceHint", { name: primaryWorkspaceTitle })
                : t("settings.primaryWorkspaceFallback")
            }
            selected={workspaceStartupPreference === "primary"}
            onPress={() => setWorkspaceStartupPreference("primary")}
          />
          <FormatOptionRow
            title={t("settings.lastWorkspace")}
            subtitle={t("settings.lastWorkspaceHint")}
            selected={workspaceStartupPreference === "last-used"}
            onPress={() => setWorkspaceStartupPreference("last-used")}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.feedback")}</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <ToggleRow
            title={t("settings.haptics")}
            subtitle={t("settings.hapticsHint")}
            value={hapticsEnabled}
            onPress={() => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              // Fires after enabling, so switching haptics on is itself felt.
              if (next) haptic.tap();
            }}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.recording")}</Text>
        </View>
        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="mic-outline"
            title={t("settings.recordingDefaults")}
            meta={t("settings.recordingDefaultsMeta")}
            onPress={onOpenRecording}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.library")}</Text>
        </View>
        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="archive-outline"
            title={t("settings.libraryBackups")}
            busy={backupFlow.isBackingUp || backupFlow.isRestoring}
            meta={libraryMeta}
            onPress={onOpenLibrary}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.sharing")}</Text>
        </View>
        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="link-outline"
            title={t("settings.sentLinks")}
            meta={t("settings.sentLinksMeta")}
            onPress={onOpenSharing}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settings.app")}</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          <SegmentedField
            title={t("settings.language")}
            subtitle={t("settings.languageHint")}
            value={language}
            options={[
              { value: "en", label: t("settings.english") },
              { value: "he", label: t("settings.hebrew") },
            ]}
            onChange={(next) => {
              void setLanguage(next).catch(() => {
                AppAlert.info(t("settings.restartFailedTitle"), t("settings.restartFailedBody"));
              });
            }}
          />
        </View>
        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="information-circle-outline"
            title={t("settings.about")}
            meta={t("settings.aboutMeta")}
            onPress={onOpenAbout}
          />
        </View>
      </View>
    </ScrollView>
  );
}
