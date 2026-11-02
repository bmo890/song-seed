import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SettingsGroup, ValueRow } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import { useTranslation } from "react-i18next";
import type { BackupReminderFrequency } from "../../../types";
import type { AutomaticBackupFrequency } from "../../../domain/automaticBackupPrefs";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;

/**
 * Everything that moves library data, in three short groups (2026-10-21):
 * the whole library (back up, restore, reminder), parts of it (export,
 * import, the links you sent), and one door to storage and repair.
 */
export function SettingsLibraryView({
  backupFlow,
  onBeginExportFlow,
  onBeginImportFlow,
  onOpenSentLinks,
  onOpenSendFromComputer,
  onOpenStorageDetails,
}: {
  backupFlow: LibraryBackupFlow;
  onBeginExportFlow: () => void;
  onBeginImportFlow: () => void;
  onOpenSentLinks: () => void;
  onOpenSendFromComputer: () => void;
  onOpenStorageDetails: () => void;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settingsLibrary.title")} />

      <View style={[styles.settingsSection, settingsScreenStyles.pickerSection]}>
        <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.backupLabel")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="cloud-upload-outline"
            title={t("settingsLibrary.backUp")}
            busy={backupFlow.isBackingUp}
            disabled={backupFlow.isRestoring}
            meta={
              backupFlow.isBackingUp
                ? backupFlow.backupProgressLabel ?? t("settings.backingUp")
                : backupFlow.lastSuccessfulBackupFileName
                  ? t("settingsLibrary.lastBackupVerified", { when: backupFlow.lastSuccessfulBackupLabel })
                  : t("settingsLibrary.noBackupShort")
            }
            onPress={backupFlow.handleBackupNow}
          />
          <LibraryActionCard
            flat
            icon="cloud-download-outline"
            title={t("settingsLibrary.restore")}
            busy={backupFlow.isRestoring}
            disabled={backupFlow.isBackingUp || backupFlow.isRestoring}
            meta={backupFlow.isRestoring ? backupFlow.restoreProgressLabel ?? t("settings.restoring") : undefined}
            onPress={backupFlow.handleRestore}
          />
          {/* Automatic backup (decision C, 2026-11-02): one folder kept current in
              place. Free, like every backup (the "auto-backup" key in proCatalog). */}
          {backupFlow.automaticBackupAvailable ? (
            <ValueRow<AutomaticBackupFrequency>
              title={t("settingsLibrary.autoBackup")}
              value={backupFlow.automaticBackup.frequency}
              options={backupFlow.automaticBackupOptions}
              onChange={(value) => void backupFlow.setAutomaticBackupFrequency(value)}
            />
          ) : null}
          {backupFlow.automaticBackupAvailable && backupFlow.automaticBackup.frequency !== "off" ? (
            <LibraryActionCard
              flat
              icon="folder-outline"
              title={t("settingsLibrary.backupFolder")}
              meta={backupFlow.automaticBackup.folder?.name ?? t("settingsLibrary.chooseFolder")}
              onPress={() => void backupFlow.changeBackupFolder()}
            />
          ) : null}
          {/* The reminder is for people who back up by hand; automatic backup
              quiets it (backupStatus.ts). */}
          {backupFlow.automaticBackupAvailable && backupFlow.automaticBackup.frequency !== "off" ? null : (
            <ValueRow<BackupReminderFrequency>
              title={t("settingsLibrary.reminder")}
              value={backupFlow.backupReminderFrequency}
              options={backupFlow.reminderOptions.map((option) => ({ value: option.value, label: option.title }))}
              // Backup is never locked (founder): the reminder is free.
              onChange={(value) => backupFlow.setBackupReminderFrequency(value)}
            />
          )}
        </SettingsGroup>

        {backupFlow.automaticBackupStatus ? (
          <View style={settingsScreenStyles.backupFileNameRow}>
            <Text style={settingsScreenStyles.backupFileName} numberOfLines={2}>
              {backupFlow.automaticBackupHint
                ? `${backupFlow.automaticBackupStatus} · ${backupFlow.automaticBackupHint}`
                : backupFlow.automaticBackupStatus}
            </Text>
          </View>
        ) : null}

        {backupFlow.lastSuccessfulBackupFileName ? (
          <View style={settingsScreenStyles.backupFileNameRow}>
            <Text style={settingsScreenStyles.backupFileName} numberOfLines={1} ellipsizeMode="middle">
              {backupFlow.lastSuccessfulBackupFileName}
            </Text>
            <Pressable
              onPress={() => void backupFlow.copyLastBackupFileName()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t("settingsBackup.copyName")}
            >
              <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.shareLabel")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="share-outline"
            title={t("settingsLibrary.exportArchive")}
            onPress={onBeginExportFlow}
          />
          <LibraryActionCard
            flat
            icon="download-outline"
            title={t("settingsLibrary.importArchive")}
            onPress={onBeginImportFlow}
          />
          <LibraryActionCard
            flat
            icon="link-outline"
            title={t("settings.sentLinks")}
            onPress={onOpenSentLinks}
          />
          <LibraryActionCard
            flat
            icon="desktop-outline"
            title={t("sendComputer.title")}
            onPress={onOpenSendFromComputer}
          />
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.storageLabel")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="server-outline"
            title={t("settingsLibrary.storageRepair")}
            onPress={onOpenStorageDetails}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
