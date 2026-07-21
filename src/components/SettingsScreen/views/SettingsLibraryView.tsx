import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { PageIntro } from "../../common/PageIntro";
import { ensurePro } from "../../common/proUpsell";
import { settingsScreenStyles, styles } from "../styles";
import { FormatOptionRow, LibraryActionCard } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import type { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { useTranslation } from "react-i18next";

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
      <PageIntro
        title={t("settingsLibrary.title")}
        subtitle={t("settingsLibrary.subtitle")}
      />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.safetyCopy")}</Text>
          <Text style={styles.settingsSectionMeta}>{t("settingsLibrary.wholeLibrary")}</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          {t("settingsLibrary.safetyHint")}
        </Text>

        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="cloud-upload-outline"
            title={t("settingsLibrary.backUp")}
            busy={backupFlow.isBackingUp}
            disabled={backupFlow.isRestoring}
            meta={
              backupFlow.isBackingUp
                ? backupFlow.backupProgressLabel ?? t("settings.backingUp")
                : backupFlow.lastSuccessfulBackupFileName
                  ? `Last backup · ${backupFlow.lastSuccessfulBackupLabel}`
                  : t("settingsLibrary.noBackup")
            }
            rightAccessory={
              backupFlow.lastSuccessfulBackupFileName && !backupFlow.isBackingUp ? (
                <View style={settingsScreenStyles.verifiedChip}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text style={settingsScreenStyles.verifiedChipText}>{t("settingsLibrary.verified")}</Text>
                </View>
              ) : undefined
            }
            onPress={backupFlow.handleBackupNow}
          />
          <LibraryActionCard
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
        </View>

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
        <View style={styles.settingsOptionStack}>
          {backupFlow.reminderOptions.map((option) => (
            <FormatOptionRow
              key={option.value}
              title={option.title}
              subtitle={option.subtitle}
              selected={backupFlow.backupReminderFrequency === option.value}
              onPress={() => {
                // Manual backup stays free; scheduling an automatic reminder is Pro.
                // Turning the reminder OFF is always free.
                if (option.value !== "off" && !ensurePro("auto-backup")) return;
                backupFlow.setBackupReminderFrequency(option.value);
              }}
            />
          ))}
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.shareMove")}</Text>
          <Text style={styles.settingsSectionMeta}>{t("settingsLibrary.partsOfWork")}</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          {t("settingsLibrary.archivesHint")}
        </Text>

        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="share-outline"
            title={t("settingsLibrary.exportArchive")}
            meta={t("settingsLibrary.exportArchiveHint")}
            onPress={onBeginExportFlow}
          />
          <LibraryActionCard
            icon="download-outline"
            title={t("settingsLibrary.importArchive")}
            meta={t("settingsLibrary.importArchiveHint")}
            onPress={onBeginImportFlow}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>{t("settingsLibrary.maintenance")}</Text>
        </View>

        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
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
            icon="server-outline"
            title={t("settingsLibrary.storageDetails")}
            meta={t("settingsLibrary.storageDetailsHint")}
            onPress={onOpenStorageDetails}
          />
        </View>
      </View>
    </ScrollView>
  );
}
