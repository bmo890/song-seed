import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { colors } from "../../../design/tokens";
import { PageIntro } from "../../common/PageIntro";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { AccordionSection, StorageMetricRow, StoragePathRow } from "../components/SettingsShared";
import type { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { summarizeIntegrityReport } from "../../../services/integrityScanner";
import { formatBytes } from "../../../utils";
import { useTranslation } from "react-i18next";

type StorageDiagnostics = ReturnType<typeof useStorageDiagnostics>;

export function SettingsStorageView({ diagnostics }: { diagnostics: StorageDiagnostics }) {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.settingsScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("settingsStorage.title")}
        subtitle={t("settingsStorage.subtitle")}
      />

      <View style={styles.settingsSummaryPanel}>
        <Text style={styles.settingsSummaryTitle}>{t("settingsStorage.health")}</Text>
        <Text style={styles.settingsSummaryMeta}>
          {t("settingsStorage.healthHint")}
        </Text>
        {diagnostics.integrityReport ? (
          <Text style={styles.settingsSummaryMeta}>
            {diagnostics.integrityReport.ok
              ? t("settingsStorage.noProblems")
              : t("settingsStorage.lastCheck", { summary: summarizeIntegrityReport(diagnostics.integrityReport) })}
          </Text>
        ) : null}
        <View style={styles.settingsActionRow}>
          <Button
            label={diagnostics.isScanning ? t("settingsStorage.checking") : t("settingsStorage.check")}
            variant="secondary"
            onPress={() => void diagnostics.runIntegrityScan()}
            disabled={diagnostics.isScanning}
          />
        </View>
      </View>

      {diagnostics.isStorageLoading && !diagnostics.storageReport ? (
        <View style={styles.settingsSummaryPanel}>
          <View style={styles.settingsBusyRow}>
            <ActivityIndicator size="small" color={colors.textPrimary} />
            <Text style={styles.settingsBusyText}>{t("settingsStorage.measuring")}</Text>
          </View>
        </View>
      ) : null}

      {diagnostics.storageError ? (
        <View style={styles.settingsSummaryPanel}>
          <Text style={styles.settingsSummaryTitle}>{t("settingsStorage.unavailable")}</Text>
          <Text style={styles.settingsSummaryMeta}>{diagnostics.storageError}</Text>
        </View>
      ) : null}

      {diagnostics.storageReport ? (
        <>
          <View style={styles.settingsSummaryPanel}>
            <Text style={styles.settingsSummaryTitle}>{t("settingsStorage.libraryStorage")}</Text>
            <Text style={styles.settingsStoragePrimaryValue}>
              {formatBytes(diagnostics.storageReport.totalLibraryBytes)}
            </Text>
            <Text style={styles.settingsSummaryMeta}>{diagnostics.storageReport.storageLabel}</Text>
            <Text style={styles.settingsSummaryMeta}>
              {t("settingsStorage.workspaceSummary", { active: diagnostics.storageReport.activeWorkspaceCount, archived: diagnostics.storageReport.archivedWorkspaceCount })}
            </Text>
            <View style={styles.settingsActionRow}>
              <Button
                label={diagnostics.isStorageLoading ? t("settingsStorage.refreshing") : t("settingsStorage.refresh")}
                variant="secondary"
                onPress={() => void diagnostics.loadStorageDetails()}
                disabled={diagnostics.isStorageLoading}
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>{t("settingsStorage.libraryStorage")}</Text>
              <Text style={styles.settingsSectionMeta}>{formatBytes(diagnostics.storageReport.totalLibraryBytes)}</Text>
            </View>
            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label={t("settingsStorage.totalUsed")}
                value={formatBytes(diagnostics.storageReport.totalLibraryBytes)}
                detail={t("settingsStorage.totalUsedDetail")}
              />
              <StorageMetricRow
                label={t("settingsStorage.activeWorkspaces")}
                value={String(diagnostics.storageReport.activeWorkspaceCount)}
                detail={t("settingsStorage.activeDetail", { size: formatBytes(diagnostics.storageReport.activeLibraryBytes) })}
              />
              <StorageMetricRow
                label={t("settingsStorage.audioFiles")}
                value={formatBytes(diagnostics.storageReport.managedAudio.bytes)}
                detail={t("settingsStorage.audioDetail", { count: diagnostics.storageReport.managedAudio.fileCount })}
              />
              <StorageMetricRow
                label={t("settingsStorage.libraryData")}
                value={formatBytes(diagnostics.storageReport.metadataBytes)}
                detail={t("settingsStorage.libraryDataDetail")}
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>{t("settingsStorage.archivedWorkspaces")}</Text>
              <Text style={styles.settingsSectionMeta}>{diagnostics.storageReport.archivedWorkspaceCount}</Text>
            </View>
            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label={t("settingsStorage.archivedWorkspaces")}
                value={String(diagnostics.storageReport.archivedWorkspaceCount)}
                detail={t("settingsStorage.archivedDetail", { size: formatBytes(diagnostics.storageReport.archivedLibraryBytes) })}
              />
              <StorageMetricRow
                label={t("settingsStorage.archiveUsed")}
                value={formatBytes(diagnostics.storageReport.archivePackages.bytes)}
                detail={t("settingsStorage.archiveDetail", { count: diagnostics.storageReport.archivePackages.fileCount })}
              />
              <StorageMetricRow
                label={t("settingsStorage.archivedData")}
                value={formatBytes(diagnostics.storageReport.archivedWorkspaceMetadataBytes)}
                detail={t("settingsStorage.archivedDataDetail")}
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>{t("settingsStorage.tempFiles")}</Text>
              <Text style={styles.settingsSectionMeta}>{formatBytes(diagnostics.storageReport.temporaryExports.bytes)}</Text>
            </View>
            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label={t("settingsStorage.exportTemp")}
                value={formatBytes(diagnostics.storageReport.temporaryExports.bytes)}
                detail={t("settingsStorage.exportTempDetail", { count: diagnostics.storageReport.temporaryExports.fileCount })}
              />
              <StorageMetricRow
                label={t("settingsStorage.allManaged")}
                value={formatBytes(diagnostics.storageReport.totalManagedBytes)}
                detail={t("settingsStorage.allManagedDetail")}
              />
            </View>
          </View>

          <AccordionSection
            step={t("settingsStorage.advanced")}
            title={t("settingsStorage.supportDetails")}
            hint={t("settingsStorage.supportHint")}
            open={diagnostics.showAdvancedStorageDetails}
            onPress={() =>
              diagnostics.setShowAdvancedStorageDetails((current) => !current)
            }
          >
            <View style={styles.settingsOptionStack}>
              {diagnostics.storageReport.unmanagedAudioReferences.totalReferences > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <StorageMetricRow
                    label={t("settingsStorage.outsideManaged")}
                    value={`${diagnostics.storageReport.unmanagedAudioReferences.totalReferences}`}
                    detail={t("settingsStorage.outsideDetail", { size: formatBytes(diagnostics.storageReport.unmanagedAudioReferences.totalMeasuredBytes) })}
                  />
                </View>
              ) : null}

              {diagnostics.storageReport.supportingDataBytes > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <StorageMetricRow
                    label={t("settingsStorage.sharedSupport")}
                    value={formatBytes(diagnostics.storageReport.supportingDataBytes)}
                    detail={t("settingsStorage.sharedSupportDetail")}
                  />
                </View>
              ) : null}

              <View style={styles.settingsSummaryPanel}>
                <Text style={styles.settingsSummaryTitle}>{t("settingsStorage.internalLocations")}</Text>
                <Text style={styles.settingsSummaryMeta}>
                  {t("settingsStorage.pathsHint")}
                </Text>
                <StoragePathRow
                  label={t("settingsStorage.appRoot")}
                  value={diagnostics.storageReport.advanced.appStorageRootUri}
                />
                <StoragePathRow
                  label={t("settingsStorage.managedAudio")}
                  value={diagnostics.storageReport.advanced.audioDirectoryUri}
                />
                <StoragePathRow
                  label={t("settingsStorage.workspaceArchives")}
                  value={diagnostics.storageReport.advanced.archiveDirectoryUri}
                />
                <StoragePathRow
                  label={t("settingsStorage.shareTemp")}
                  value={diagnostics.storageReport.advanced.shareDirectoryUri}
                />
              </View>

              {diagnostics.storageReport.limitations.length > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <Text style={styles.settingsSummaryTitle}>{t("settingsStorage.reportingNotes")}</Text>
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
