import { useEffect, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import { getStorageDetailsReport, type StorageDetailsReport } from "../../../services/storageDetails";
import { buildPersistedAppStoreSnapshot, useStore } from "../../../state/useStore";
import {
  scanLibraryIntegrity,
  summarizeIntegrityReport,
  type IntegrityReport,
} from "../../../services/integrityScanner";
import { appActions } from "../../../state/actions";
import { useTranslation } from "react-i18next";

export function useStorageDiagnostics({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const [storageReport, setStorageReport] = useState<StorageDetailsReport | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(false);
  const [showAdvancedStorageDetails, setShowAdvancedStorageDetails] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);

  const loadStorageDetails = async () => {
    setIsStorageLoading(true);
    setStorageError(null);

    try {
      const snapshot = buildPersistedAppStoreSnapshot(useStore.getState());
      const report = await getStorageDetailsReport(snapshot);
      setStorageReport(report);
    } catch (error) {
      setStorageError(
        error instanceof Error
          ? error.message
          : t("settingsStorage.loadFailed")
      );
    } finally {
      setIsStorageLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    void loadStorageDetails();
  }, [active]);

  const runRecovery = async () => {
    if (isRecovering) return;
    setIsRecovering(true);
    setRecoveryProgress(t("settingsStorage.scanningOrphans"));
    try {
      const result = await appActions.recoverOrphanedAudio((phase) => {
        setRecoveryProgress(phase);
      });
      if (result.restoredFromManifest) {
        AppAlert.info(t("settingsStorage.recoveryComplete"), t("settingsStorage.manifestRestored", { count: result.recoveredCount }));
      } else if (result.archivedWorkspacesRestored === 0 && result.orphanedClipsRecovered === 0) {
        AppAlert.info(
          t("settingsStorage.noRecoverable"),
          t("settingsStorage.noRecoverableBody")
        );
      } else {
        const parts: string[] = [];
        if (result.archivedWorkspacesRestored > 0) {
          parts.push(t("settingsStorage.recoveredWorkspaces", { count: result.archivedWorkspacesRestored }));
        }
        if (result.orphanedClipsRecovered > 0) {
          parts.push(t("settingsStorage.recoveredClips", { count: result.orphanedClipsRecovered }));
        }
        if (result.warnings.length > 0) {
          parts.push(t("settingsStorage.warningsCount", { count: result.warnings.length }));
        }
        AppAlert.info(t("settingsStorage.recoveryComplete"), parts.join(". ") + ".");
      }
    } catch (error) {
      AppAlert.info(t("settingsStorage.recoveryFailed"), t("settingsStorage.recoveryFailedBody"));
      console.warn("Recovery error:", error);
    } finally {
      setIsRecovering(false);
      setRecoveryProgress("");
    }
  };

  const runIntegrityScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const state = useStore.getState();
      const report = await scanLibraryIntegrity(state.workspaces, state.playlists);
      setIntegrityReport(report);
      AppAlert.info(
        report.ok ? t("settingsStorage.integrityPassed") : t("settingsStorage.integrityIssues"),
        summarizeIntegrityReport(report)
      );
    } catch (error) {
      AppAlert.info(t("settingsStorage.integrityFailed"), t("settingsStorage.integrityFailedBody"));
      console.warn("Integrity scan error:", error);
    } finally {
      setIsScanning(false);
    }
  };

  return {
    storageReport,
    storageError,
    isStorageLoading,
    showAdvancedStorageDetails,
    setShowAdvancedStorageDetails,
    loadStorageDetails,
    isRecovering,
    recoveryProgress,
    runRecovery,
    isScanning,
    integrityReport,
    runIntegrityScan,
  };
}
