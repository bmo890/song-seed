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
import { userFacingMessage } from "../../../i18n/userFacingError";
import { readSafetyCopy } from "../../../services/manifestSync";
import { tellIfLibraryBusy } from "../../../services/libraryOperationGate";
import { currentFormatLocale } from "../../../i18n/formatLocale";

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
      // A raw native message is English and internal; the sentence is ours.
      setStorageError(userFacingMessage(error, t("settingsStorage.loadFailed")));
    } finally {
      setIsStorageLoading(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    void loadStorageDetails();
  }, [active]);

  /** An empty library and a copy on this phone: ask before bringing it back, with its
   *  date and size (audit 2026-11-02, 12e E-M1). Resolves whether to go on. */
  const askToRestoreCopyFirst = async (): Promise<{ proceed: boolean; restoredCount: number }> => {
    const ideaCount = useStore.getState().workspaces.reduce((sum, ws) => sum + ws.ideas.length, 0);
    if (ideaCount > 0) return { proceed: true, restoredCount: 0 };
    const copy = await readSafetyCopy().catch(() => null);
    if (!copy) return { proceed: true, restoredCount: 0 };
    const date = new Date(copy.savedAt).toLocaleDateString(currentFormatLocale(), {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const restore = await new Promise<boolean>((resolve) => {
      AppAlert.custom(
        t("recovery.restoreLibraryTitle"),
        t("safetyCopy.body", { count: copy.ideaCount, date }),
        [
          { label: t("common.cancel"), style: "cancel", onPress: () => resolve(false) },
          { label: t("recovery.restoreLibraryRestore"), style: "default", icon: "refresh-outline", onPress: () => resolve(true) },
        ],
        { onDismiss: () => resolve(false) }
      );
    });
    if (!restore) return { proceed: false, restoredCount: 0 };
    return { proceed: true, restoredCount: await appActions.restoreLibraryFromSafetyCopy() };
  };

  const runRecovery = async () => {
    if (isRecovering) return;
    setIsRecovering(true);
    setRecoveryProgress(t("settingsStorage.scanningOrphans"));
    try {
      const first = await askToRestoreCopyFirst();
      if (!first.proceed) return;
      const result = await appActions.recoverOrphanedAudio((phase) => {
        setRecoveryProgress(phase);
      });
      if (first.restoredCount > 0) {
        AppAlert.info(t("settingsStorage.recoveryComplete"), t("settingsStorage.manifestRestored", { count: first.restoredCount }));
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
      if (tellIfLibraryBusy(error)) return;
      AppAlert.error(t("settingsStorage.recoveryFailed"), t("settingsStorage.recoveryFailedBody"));
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
      AppAlert.error(t("settingsStorage.integrityFailed"), t("settingsStorage.integrityFailedBody"));
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
