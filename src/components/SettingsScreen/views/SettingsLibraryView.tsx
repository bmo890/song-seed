import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { PageIntro } from "../../common/PageIntro";
import { settingsScreenStyles, styles } from "../styles";
import { FormatOptionRow, LibraryActionCard } from "../components/SettingsShared";
import type { useLibraryBackupFlow } from "../hooks/useLibraryBackupFlow";
import type { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";

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
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={settingsScreenStyles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title="Library & Backups"
        subtitle="A backup is a complete safety copy of this library. An archive shares chosen workspaces or collections with another library."
      />

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Safety copy</Text>
          <Text style={styles.settingsSectionMeta}>Whole library</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          Every recording, take, and detail — verified, and restorable on any device. Runs in a
          progress view you can minimize while you keep working.
        </Text>

        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="cloud-upload-outline"
            title="Back up"
            busy={backupFlow.isBackingUp}
            meta={
              backupFlow.isBackingUp
                ? backupFlow.backupProgressLabel ?? "Backing up…"
                : backupFlow.lastSuccessfulBackupFileName
                  ? `Last backup · ${backupFlow.lastSuccessfulBackupLabel}`
                  : "No backup saved yet — save a complete copy"
            }
            rightAccessory={
              backupFlow.lastSuccessfulBackupFileName && !backupFlow.isBackingUp ? (
                <View style={settingsScreenStyles.verifiedChip}>
                  <Ionicons name="checkmark" size={13} color="#fff" />
                  <Text style={settingsScreenStyles.verifiedChipText}>Verified</Text>
                </View>
              ) : undefined
            }
            onPress={backupFlow.handleBackupNow}
          />
          <LibraryActionCard
            icon="cloud-download-outline"
            title="Restore"
            busy={backupFlow.isRestoring}
            disabled={backupFlow.isBackingUp}
            meta={
              backupFlow.isRestoring
                ? backupFlow.restoreProgressLabel ?? "Restoring…"
                : "Bring this library back from a backup file"
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
          <Text style={styles.settingsSectionLabel}>Backup reminder</Text>
        </View>
        <View style={styles.settingsOptionStack}>
          {backupFlow.reminderOptions.map((option) => (
            <FormatOptionRow
              key={option.value}
              title={option.title}
              subtitle={option.subtitle}
              selected={backupFlow.backupReminderFrequency === option.value}
              onPress={() => backupFlow.setBackupReminderFrequency(option.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Share & move</Text>
          <Text style={styles.settingsSectionMeta}>Parts of your work</Text>
        </View>
        <Text style={styles.settingsSectionHint}>
          Archives carry chosen workspaces or collections between libraries — share them, or
          merge one into this library.
        </Text>

        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="share-outline"
            title="Export an archive"
            meta="Package workspaces or collections to share"
            onPress={onBeginExportFlow}
          />
          <LibraryActionCard
            icon="download-outline"
            title="Import an archive"
            meta="Merge a Song Seed Archive into this library"
            onPress={onBeginImportFlow}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <View style={styles.settingsSectionHeaderRow}>
          <Text style={styles.settingsSectionLabel}>Maintenance</Text>
        </View>

        <View style={settingsScreenStyles.libraryCardStack}>
          <LibraryActionCard
            icon="medkit-outline"
            title="Recover audio files"
            busy={diagnostics.isRecovering}
            meta={
              diagnostics.isRecovering
                ? diagnostics.recoveryProgress ?? "Scanning…"
                : "Restore orphaned recordings into a Recovered collection"
            }
            onPress={diagnostics.runRecovery}
            disabled={diagnostics.isRecovering}
          />
          <LibraryActionCard
            icon="server-outline"
            title="Storage details"
            meta="Space used on this device, integrity check"
            onPress={onOpenStorageDetails}
          />
        </View>
      </View>
    </ScrollView>
  );
}

