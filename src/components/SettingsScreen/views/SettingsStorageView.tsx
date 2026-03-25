import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { AccordionSection, StorageMetricRow, StoragePathRow } from "../components/SettingsShared";
import type { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { formatBytes } from "../../../utils";

type StorageDiagnostics = ReturnType<typeof useStorageDiagnostics>;

export function SettingsStorageView({ diagnostics }: { diagnostics: StorageDiagnostics }) {
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.settingsScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title="Storage details"
        subtitle="Song Seed keeps your live library in app-managed storage on this device. Recorded and imported audio is copied into Song Seed storage, while archived workspaces keep compressed packages until you restore them."
      />

      {diagnostics.isStorageLoading && !diagnostics.storageReport ? (
        <View style={styles.settingsSummaryPanel}>
          <View style={styles.settingsBusyRow}>
            <ActivityIndicator size="small" color="#0f172a" />
            <Text style={styles.settingsBusyText}>Measuring app-managed storage.</Text>
          </View>
        </View>
      ) : null}

      {diagnostics.storageError ? (
        <View style={styles.settingsSummaryPanel}>
          <Text style={styles.settingsSummaryTitle}>Storage details unavailable</Text>
          <Text style={styles.settingsSummaryMeta}>{diagnostics.storageError}</Text>
        </View>
      ) : null}

      {diagnostics.storageReport ? (
        <>
          <View style={styles.settingsSummaryPanel}>
            <Text style={styles.settingsSummaryTitle}>Library storage</Text>
            <Text style={styles.settingsStoragePrimaryValue}>
              {formatBytes(diagnostics.storageReport.totalLibraryBytes)}
            </Text>
            <Text style={styles.settingsSummaryMeta}>{diagnostics.storageReport.storageLabel}</Text>
            <Text style={styles.settingsSummaryMeta}>
              {diagnostics.storageReport.activeWorkspaceCount} active workspace
              {diagnostics.storageReport.activeWorkspaceCount === 1 ? "" : "s"} and{" "}
              {diagnostics.storageReport.archivedWorkspaceCount} archived workspace
              {diagnostics.storageReport.archivedWorkspaceCount === 1 ? "" : "s"}.
            </Text>
            <View style={styles.settingsActionRow}>
              <Button
                label={diagnostics.isStorageLoading ? "Refreshing..." : "Refresh"}
                variant="secondary"
                onPress={() => void diagnostics.loadStorageDetails()}
                disabled={diagnostics.isStorageLoading}
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>Library storage</Text>
              <Text style={styles.settingsSectionMeta}>{formatBytes(diagnostics.storageReport.totalLibraryBytes)}</Text>
            </View>
            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label="Total library storage used"
                value={formatBytes(diagnostics.storageReport.totalLibraryBytes)}
                detail="Live library data plus archived workspace packages."
              />
              <StorageMetricRow
                label="Active workspaces"
                value={String(diagnostics.storageReport.activeWorkspaceCount)}
                detail={`${formatBytes(diagnostics.storageReport.activeLibraryBytes)} across managed audio and live workspace data.`}
              />
              <StorageMetricRow
                label="Audio files"
                value={formatBytes(diagnostics.storageReport.managedAudio.bytes)}
                detail={`${diagnostics.storageReport.managedAudio.fileCount} managed audio file${diagnostics.storageReport.managedAudio.fileCount === 1 ? "" : "s"} stored for the live library.`}
              />
              <StorageMetricRow
                label="Library data"
                value={formatBytes(diagnostics.storageReport.metadataBytes)}
                detail="Titles, notes, lyrics, playlists, history, and workspace metadata saved in app storage."
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>Archived workspaces</Text>
              <Text style={styles.settingsSectionMeta}>{diagnostics.storageReport.archivedWorkspaceCount}</Text>
            </View>
            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label="Archived workspaces"
                value={String(diagnostics.storageReport.archivedWorkspaceCount)}
                detail={`${formatBytes(diagnostics.storageReport.archivedLibraryBytes)} including package files and archived workspace data.`}
              />
              <StorageMetricRow
                label="Archive storage used"
                value={formatBytes(diagnostics.storageReport.archivePackages.bytes)}
                detail={`${diagnostics.storageReport.archivePackages.fileCount} archive package${diagnostics.storageReport.archivePackages.fileCount === 1 ? "" : "s"} stored in Song Seed app storage.`}
              />
              <StorageMetricRow
                label="Archived workspace data"
                value={formatBytes(diagnostics.storageReport.archivedWorkspaceMetadataBytes)}
                detail="Workspace names, collections, notes, and archive status that stay available while the audio is packed away."
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>Temporary files</Text>
              <Text style={styles.settingsSectionMeta}>{formatBytes(diagnostics.storageReport.temporaryExports.bytes)}</Text>
            </View>
            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label="Export and share temp files"
                value={formatBytes(diagnostics.storageReport.temporaryExports.bytes)}
                detail={`${diagnostics.storageReport.temporaryExports.fileCount} file${diagnostics.storageReport.temporaryExports.fileCount === 1 ? "" : "s"} staged for exports or native sharing. This is shown separately from the library total.`}
              />
              <StorageMetricRow
                label="All Song Seed managed storage"
                value={formatBytes(diagnostics.storageReport.totalManagedBytes)}
                detail="Library storage plus temporary export/share files currently left on device."
              />
            </View>
          </View>

          <AccordionSection
            step="Advanced"
            title="Support details"
            hint="Secondary details for troubleshooting and storage audits."
            open={diagnostics.showAdvancedStorageDetails}
            onPress={() =>
              diagnostics.setShowAdvancedStorageDetails((current) => !current)
            }
          >
            <View style={styles.settingsOptionStack}>
              {diagnostics.storageReport.unmanagedAudioReferences.totalReferences > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <StorageMetricRow
                    label="Outside managed live-library storage"
                    value={`${diagnostics.storageReport.unmanagedAudioReferences.totalReferences}`}
                    detail={`${formatBytes(diagnostics.storageReport.unmanagedAudioReferences.totalMeasuredBytes)} measured outside the managed audio folder.`}
                  />
                </View>
              ) : null}

              {diagnostics.storageReport.supportingDataBytes > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <StorageMetricRow
                    label="Shared library support data"
                    value={formatBytes(diagnostics.storageReport.supportingDataBytes)}
                    detail="Shared state such as activity history and preferences that is counted in the library total."
                  />
                </View>
              ) : null}

              <View style={styles.settingsSummaryPanel}>
                <Text style={styles.settingsSummaryTitle}>Internal locations</Text>
                <Text style={styles.settingsSummaryMeta}>
                  Paths are shown here for support use only. Song Seed manages the live storage location automatically.
                </Text>
                <StoragePathRow
                  label="App storage root"
                  value={diagnostics.storageReport.advanced.appStorageRootUri}
                />
                <StoragePathRow
                  label="Managed audio"
                  value={diagnostics.storageReport.advanced.audioDirectoryUri}
                />
                <StoragePathRow
                  label="Workspace archives"
                  value={diagnostics.storageReport.advanced.archiveDirectoryUri}
                />
                <StoragePathRow
                  label="Share/export temp"
                  value={diagnostics.storageReport.advanced.shareDirectoryUri}
                />
              </View>

              {diagnostics.storageReport.limitations.length > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <Text style={styles.settingsSummaryTitle}>Reporting notes</Text>
                  {diagnostics.storageReport.limitations.map((item) => (
                    <Text key={item} style={styles.settingsStorageNote}>
                      • {item}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </AccordionSection>
        </>
      ) : null}
    </ScrollView>
  );
}
