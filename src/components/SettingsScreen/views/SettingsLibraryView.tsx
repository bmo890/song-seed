import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { PageIntro } from "../../common/PageIntro";
import { ensurePro } from "../../common/proUpsell";
import { settingsScreenStyles, styles } from "../styles";
import { LibraryActionCard, SettingsGroup } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import type { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { useTranslation } from "react-i18next";
import { SegmentedControl } from "../../common/SegmentedControl";

type LibraryBackupFlow = ReturnType<typeof useLibraryBackupFlow>;
type StorageDiagnostics = ReturnType<typeof useStorageDiagnostics>;

/**
 * Everything that moves library data lives here, grouped by intent so "backup"
 * and "archive" stop competing: a safety copy of the WHOLE library (backup /
 * restore), sharing PARTS of it (export / import), and maintenance.
 */
export function SettingsLibraryView({
  backupFlow,
  diagnostics,
  onBeginExportFlow,
  onBeginImportFlow,
  onOpenStorageDetails,
}: {
  backupFlow: LibraryBackupFlow;
  diagnostics: StorageDiagnostics;
  onBeginExportFlow: () => void;
  onBeginImportFlow: () => void;
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

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.safetyCopy")}</Text>
          <Text style={styles.settingsSectionMeta}>{t("settingsLibrary.wholeLibrary")}</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          {t("settingsLibrary.safetyHint")}
        </Text>

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
                  ? t("settingsLibrary.lastBackup", { when: backupFlow.lastSuccessfulBackupLabel })
                  : t("settingsLibrary.noBackup")
            }
            rightAccessory={
              backupFlow.lastSuccessfulBackupFileName && !backupFlow.isBackingUp ? (
                <View style={settingsScreenStyles.verifiedChip}>
                  <Ionicons name="checkmark" size={14} color={colors.textSecondary} />
                  <Text style={settingsScreenStyles.verifiedChipText}>{t("settingsLibrary.verified")}</Text>
                </View>
              ) : undefined
            }
            onPress={backupFlow.handleBackupNow}
          />
          <LibraryActionCard
            flat
            icon="cloud-download-outline"
            title={t("settingsLibrary.restore")}
            busy={backupFlow.isRestoring}
            disabled={backupFlow.isBackingUp || backupFlow.isRestoring}
            meta={
              backupFlow.isRestoring
                ? backupFlow.restoreProgressLabel ?? t("settings.restoring")
                : t("settingsLibrary.restoreHint")
            }
            onPress={backupFlow.handleRestore}
          />
        </SettingsGroup>

        {backupFlow.lastSuccessfulBackupFileName ? (
          <View style={settingsScreenStyles.backupFileNameRow}>
            <Text
              style={settingsScreenStyles.backupFileName}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {backupFlow.lastSuccessfulBackupFileName}
            </Text>
            <Pressable onPress={() => void backupFlow.copyLastBackupFileName()} hitSlop={8}>
              <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.backupReminder")}</Text>
        </View>
        {/* One choice of four: ink tabs, with the chosen one said once beneath
            (2026-10-20; was four radio rows, the chosen one filled). */}
        <SegmentedControl
          options={backupFlow.reminderOptions.map((option) => ({
            key: option.value,
            label: option.short,
          }))}
          value={backupFlow.backupReminderFrequency}
          onChange={(value) => {
            // Manual backup stays free; scheduling an automatic reminder is Pro.
            // Turning the reminder OFF is always free.
            if (value !== "off" && !ensurePro("auto-backup")) return;
            backupFlow.setBackupReminderFrequency(value);
          }}
        />
        <Text style={styles.settingsSectionHint}>
          {backupFlow.reminderOptions.find((option) => option.value === backupFlow.backupReminderFrequency)?.subtitle}
        </Text>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.shareMove")}</Text>
          <Text style={styles.settingsSectionMeta}>{t("settingsLibrary.partsOfWork")}</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          {t("settingsLibrary.archivesHint")}
        </Text>

        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="share-outline"
            title={t("settingsLibrary.exportArchive")}
            meta={t("settingsLibrary.exportArchiveHint")}
            onPress={onBeginExportFlow}
          />
          <LibraryActionCard
            flat
            icon="download-outline"
            title={t("settingsLibrary.importArchive")}
            meta={t("settingsLibrary.importArchiveHint")}
            onPress={onBeginImportFlow}
          />
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.maintenance")}</Text>
        </View>

        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="medkit-outline"
            title={t("settingsLibrary.recoverAudio")}
            busy={diagnostics.isRecovering}
            meta={
              diagnostics.isRecovering
                ? diagnostics.recoveryProgress ?? t("settingsLibrary.scanning")
                : t("settingsLibrary.recoverAudioHint")
            }
            onPress={diagnostics.runRecovery}
            disabled={diagnostics.isRecovering}
          />
          <LibraryActionCard
            flat
            icon="server-outline"
            title={t("settingsLibrary.storageDetails")}
            meta={t("settingsLibrary.storageDetailsHint")}
            onPress={onOpenStorageDetails}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
