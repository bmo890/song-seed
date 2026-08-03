import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SettingsGroup } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { useTranslation } from "react-i18next";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;

export function SettingsOverviewView({
  backupFlow,
  onOpenAccount,
  onOpenGeneral,
  onOpenLibrary,
  onOpenRecording,
  onOpenSharing,
  onOpenAbout,
}: {
  backupFlow: LibraryBackupFlow;
  onOpenAccount: () => void;
  onOpenGeneral: () => void;
  onOpenLibrary: () => void;
  onOpenRecording: () => void;
  onOpenSharing: () => void;
  onOpenAbout: () => void;
}) {
  const { t } = useTranslation();
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
      contentContainerStyle={settingsScreenStyles.overviewContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <View style={settingsScreenStyles.overviewSection}>
        <Text style={styles.settingsSectionLabel}>{t("settings.yourSongNook")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="person-outline"
            title={t("settings.account")}
            meta={t("settings.accountMeta")}
            onPress={onOpenAccount}
          />
        </SettingsGroup>
      </View>

      <View style={settingsScreenStyles.overviewSection}>
        <Text style={styles.settingsSectionLabel}>{t("settings.preferences")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="options-outline"
            title={t("settings.general")}
            meta={t("settings.generalMeta")}
            onPress={onOpenGeneral}
          />
          <LibraryActionCard
            flat
            icon="mic-outline"
            title={t("settings.recordingAudio")}
            meta={t("settings.recordingAudioMeta")}
            onPress={onOpenRecording}
          />
        </SettingsGroup>
      </View>

      <View style={settingsScreenStyles.overviewSection}>
        <Text style={styles.settingsSectionLabel}>{t("settings.yourData")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="archive-outline"
            title={t("settings.dataStorage")}
            busy={backupFlow.isBackingUp || backupFlow.isRestoring}
            meta={libraryMeta}
            onPress={onOpenLibrary}
          />
          <LibraryActionCard
            flat
            icon="link-outline"
            title={t("settings.sharedLinks")}
            meta={t("settings.sharedLinksMeta")}
            onPress={onOpenSharing}
          />
        </SettingsGroup>
      </View>

      <View style={settingsScreenStyles.overviewSection}>
        <Text style={styles.settingsSectionLabel}>{t("settings.support")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="help-circle-outline"
            title={t("settings.helpAbout")}
            meta={t("settings.helpAboutMeta")}
            onPress={onOpenAbout}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
