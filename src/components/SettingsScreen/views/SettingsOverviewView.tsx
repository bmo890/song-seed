import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SettingsGroup } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { useTranslation } from "react-i18next";
import { colors } from "../../../design/tokens";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;

/**
 * Four doors (founder, 2026-10-21: fewer pages, less text). The plan is a
 * line, not a page: during the beta there is nothing to manage. It becomes a
 * door again when Pro can be bought.
 */
export function SettingsOverviewView({
  backupFlow,
  onOpenPreferences,
  onOpenLibrary,
  onOpenAbout,
}: {
  backupFlow: LibraryBackupFlow;
  onOpenPreferences: () => void;
  onOpenLibrary: () => void;
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
      <PageIntro title={t("settings.title")} />

      <View style={settingsScreenStyles.planLine}>
        <Ionicons name="sparkles-outline" size={18} color={colors.textStrong} />
        <Text style={settingsScreenStyles.planLineTitle}>{t("settingsAccount.betaPlan")}</Text>
        <Text style={settingsScreenStyles.planLineState}>{t("settings.proUnlocked")}</Text>
      </View>

      <View style={settingsScreenStyles.overviewSection}>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="options-outline"
            title={t("settings.preferences")}
            onPress={onOpenPreferences}
          />
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
            icon="help-circle-outline"
            title={t("settings.helpAbout")}
            onPress={onOpenAbout}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
