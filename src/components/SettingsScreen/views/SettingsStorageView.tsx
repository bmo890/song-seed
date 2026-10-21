import { ScrollView, Text, View } from "react-native";
import { Spinner } from "../../common/Spinner";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { PageIntro } from "../../common/PageIntro";
import { styles } from "../styles";
import {
  LibraryActionCard,
  SettingsGroup,
  StorageMetricRow,
  StoragePathRow,
} from "../components/SettingsShared";
import { useEraseAllData } from "../hooks/useEraseAllData";
import type { useStorageDiagnostics } from "../hooks/useStorageDiagnostics";
import { summarizeIntegrityReport } from "../../../services/integrityScanner";
import { formatBytes } from "../../../utils";
import { useTranslation } from "react-i18next";

type StorageDiagnostics = ReturnType<typeof useStorageDiagnostics>;

export function SettingsStorageView({ diagnostics }: { diagnostics: StorageDiagnostics }) {
  const { t } = useTranslation();
  const eraseAll = useEraseAllData();
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.settingsScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settingsLibrary.storageRepair")} />

      {/* Space first: one line each, the breakdown lives in Support details
          (2026-10-21: the page carried sixteen rows of storage arithmetic). */}
      {diagnostics.isStorageLoading && !diagnostics.storageReport ? (
        <View style={styles.settingsBusyRow}>
          <Spinner size="small" color={colors.textPrimary} />
          <Text style={styles.settingsBusyText}>{t("settingsStorage.measuring")}</Text>
        </View>
      ) : null}
      {diagnostics.storageError ? (
        <Text style={styles.settingsSectionHint}>{t("settingsStorage.unavailable")}</Text>
      ) : null}
      {diagnostics.storageReport ? (
        <View style={styles.settingsSection}>
          <StorageMetricRow
            label={t("settingsStorage.libraryStorage")}
            value={formatBytes(diagnostics.storageReport.totalLibraryBytes)}
          />
          {diagnostics.storageReport.archivedWorkspaceCount > 0 || diagnostics.storageReport.archivePackages.bytes > 0 ? (
            <StorageMetricRow
              label={t("settingsStorage.archivedWorkspaces")}
              value={formatBytes(diagnostics.storageReport.archivedLibraryBytes)}
            />
          ) : null}
          {diagnostics.storageReport.temporaryExports.bytes > 0 ? (
            <StorageMetricRow
              label={t("settingsStorage.tempFiles")}
              value={formatBytes(diagnostics.storageReport.temporaryExports.bytes)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsStorage.repair")}</Text>
        <SettingsGroup>
          <LibraryActionCard
            flat
            icon="pulse-outline"
            title={t("settingsStorage.checkLibrary")}
            busy={diagnostics.isScanning}
            disabled={diagnostics.isScanning}
            meta={
              diagnostics.isScanning
                ? t("settingsStorage.checking")
                : diagnostics.integrityReport
                  ? diagnostics.integrityReport.ok
                    ? t("settingsStorage.noProblems")
                    : t("settingsStorage.lastCheck", { summary: summarizeIntegrityReport(diagnostics.integrityReport) })
                  : undefined
            }
            onPress={() => void diagnostics.runIntegrityScan()}
          />
          <LibraryActionCard
            flat
            icon="medkit-outline"
            title={t("settingsLibrary.recoverAudio")}
            busy={diagnostics.isRecovering}
            disabled={diagnostics.isRecovering}
            meta={diagnostics.isRecovering ? diagnostics.recoveryProgress || t("settingsLibrary.scanning") : undefined}
            onPress={diagnostics.runRecovery}
          />
        </SettingsGroup>
      </View>

      {diagnostics.storageReport ? (
        <>
          {/* Support details fold under one quiet row (2026-10-20; was an
              accordion card). Only support ever needs them. */}
          <Press
            // Haptics vocabulary: `light` — a section folds open or closed.
            haptic="light"
            style={styles.settingsFoldRow}
            onPress={() => diagnostics.setShowAdvancedStorageDetails((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded: diagnostics.showAdvancedStorageDetails }}
          >
            <Text style={styles.settingsSectionLabel}>{t("settingsStorage.supportDetails")}</Text>
            <Ionicons
              name={diagnostics.showAdvancedStorageDetails ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.textMuted}
            />
          </Press>
          {diagnostics.showAdvancedStorageDetails ? (
            <View style={styles.settingsOptionStack}>
              <View style={styles.settingsSummaryPanel}>
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
                {diagnostics.storageReport.archivedWorkspaceCount > 0 ? (
                  <>
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
                  </>
                ) : null}
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
          ) : null}
        </>
      ) : null}

      {/* Fresh slate. Last thing on the last page — rare and destructive, so it lives at
          the bottom of the storage details rather than anywhere it could be tapped in
          passing. Two confirmations + the device lock stand between the tap and the wipe. */}
      <View style={styles.settingsSection}>
        <SettingsGroup>
          <LibraryActionCard
            flat
            tone="danger"
            icon="trash-outline"
            title={t("eraseAll.row")}
            meta={t("eraseAll.rowHint")}
            busy={eraseAll.isErasing}
            disabled={eraseAll.isErasing}
            onPress={eraseAll.confirmErase}
          />
        </SettingsGroup>
      </View>
    </ScrollView>
  );
}
