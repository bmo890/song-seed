import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { getStorageDetailsReport, type StorageDetailsReport } from "../../../services/storageDetails";
import { buildPersistedAppStoreSnapshot, useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";

export function useStorageDiagnostics({ active }: { active: boolean }) {
  const [storageReport, setStorageReport] = useState<StorageDetailsReport | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(false);
  const [showAdvancedStorageDetails, setShowAdvancedStorageDetails] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState("");

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
          : "Storage details could not be loaded right now."
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
    setRecoveryProgress("Scanning for orphaned audio files...");
    try {
      const result = await appActions.recoverOrphanedAudio((phase) => {
        setRecoveryProgress(phase);
      });
      if (result.restoredFromManifest) {
        Alert.alert("Recovery complete", `Restored ${result.recoveredCount} ideas from manifest backup.`);
      } else if (result.archivedWorkspacesRestored === 0 && result.orphanedClipsRecovered === 0) {
        Alert.alert(
          "No recoverable data",
          "All audio files on disk are already linked to clips in your library. No manifest backup or workspace archives were found."
        );
      } else {
        const parts: string[] = [];
        if (result.archivedWorkspacesRestored > 0) {
          parts.push(`${result.archivedWorkspacesRestored} workspace${result.archivedWorkspacesRestored === 1 ? "" : "s"} restored from archives`);
        }
        if (result.orphanedClipsRecovered > 0) {
          parts.push(`${result.orphanedClipsRecovered} orphaned clip${result.orphanedClipsRecovered === 1 ? "" : "s"} recovered`);
        }
        if (result.warnings.length > 0) {
          parts.push(`${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}`);
        }
        Alert.alert("Recovery complete", parts.join(". ") + ".");
      }
    } catch (error) {
      Alert.alert("Recovery failed", "An error occurred while scanning for orphaned audio files.");
      console.warn("Recovery error:", error);
    } finally {
      setIsRecovering(false);
      setRecoveryProgress("");
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
  };
}
