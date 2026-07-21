import { useEffect, useMemo, useRef, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import {
  estimateLibraryArchiveSizes,
  estimateLibraryExportArchive,
  exportLibrary,
  type LibraryExportEstimate,
  type LibraryExportFormat,
} from "../../../services/libraryExport";
import {
  estimateLibraryOperationSeconds,
  formatDurationEstimate,
} from "../../../services/operationPacing";
import { formatBytes } from "../../../utils";
import { BACKUP_SAVE_CANCELLED_MESSAGE } from "../../../services/archiveSave";
import { isBackupOperationCancelled } from "../../../services/backupOperation";
import { useStore } from "../../../state/useStore";
import { formatProcessProgress, useProcessStore } from "../../../state/useProcessStore";
import type { Workspace } from "../../../types";
import { getCollectionScopeIds } from "../../../utils";
import {
  buildWarningSummary,
  getSelectionSummary,
} from "../helpers";
import type { ArchiveExportOptions, ExportSectionKey, StandardExportOptions } from "../types";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

const DEFAULT_ARCHIVE_OPTIONS: ArchiveExportOptions = {
  includeFullSongHistory: true,
  includeNotes: true,
  includeLyrics: true,
  includeHiddenItems: false,
  preserveAllMetadata: true,
};

const DEFAULT_STANDARD_OPTIONS: StandardExportOptions = {
  includeNotesAsText: true,
  includeLyricsAsText: true,
  includeHiddenItems: false,
};

export function useLibraryExportFlow() {
  const { t } = useTranslation();
  const workspaces = useStore((state) => state.workspaces);
  const notes = useStore((state) => state.notes);
  const songbooks = useStore((state) => state.songbooks);
  const setlists = useStore((state) => state.setlists);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const primaryCollectionIdByWorkspace = useStore((state) => state.primaryCollectionIdByWorkspace);
  const bluetoothMonitoringCalibrations = useStore((state) => state.bluetoothMonitoringCalibrations);
  const [format, setFormat] = useState<LibraryExportFormat | null>(null);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [excludedCollectionIds, setExcludedCollectionIds] = useState<string[]>([]);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<ExportSectionKey>("format");
  const [archiveOptions, setArchiveOptions] = useState(DEFAULT_ARCHIVE_OPTIONS);
  const [standardOptions, setStandardOptions] = useState(DEFAULT_STANDARD_OPTIONS);
  const activeProcess = useProcessStore((s) => s.process);
  const isExporting = activeProcess?.kind === "export" && activeProcess.status === "running";
  const [archiveSizeEstimate, setArchiveSizeEstimate] = useState<
    { standardBytes: number; fullBytes: number } | null
  >(null);
  const [isEstimatingArchiveSize, setIsEstimatingArchiveSize] = useState(false);
  const estimateTokenRef = useRef(0);

  const includeHiddenItems =
    format === "songnook-archive"
      ? archiveOptions.includeHiddenItems
      : standardOptions.includeHiddenItems;

  const hasArchiveScope =
    selectedWorkspaceIds.length > 0 || selectedCollectionIds.length > 0;

  // Estimate standard vs full archive size so the metadata toggle can show the cost. Debounced
  // and race-guarded because it stats every included audio file. preserveAllMetadata is excluded
  // from the deps on purpose — both sizes are computed together and the toggle shouldn't refetch.
  useEffect(() => {
    if (format !== "songnook-archive" || !hasArchiveScope) {
      setArchiveSizeEstimate(null);
      setIsEstimatingArchiveSize(false);
      return;
    }
    const token = ++estimateTokenRef.current;
    setIsEstimatingArchiveSize(true);
    const timer = setTimeout(() => {
      // Library content read via getState() at run time: `workspaces`/`notes` references
      // churn on every store write (background hydration commits for minutes), and each
      // re-fire re-stats every included audio file. Selection/options drive re-estimates.
      void estimateLibraryArchiveSizes({
        workspaces: useStore.getState().workspaces,
        notes: useStore.getState().notes,
        format: "songnook-archive",
        scope: {
          workspaceIds: selectedWorkspaceIds,
          collectionIds: selectedCollectionIds,
          excludedCollectionIds,
        },
        options: archiveOptions,
      })
        .then((sizes) => {
          if (estimateTokenRef.current === token) {
            setArchiveSizeEstimate(sizes);
          }
        })
        .catch(() => {
          if (estimateTokenRef.current === token) {
            setArchiveSizeEstimate(null);
          }
        })
        .finally(() => {
          if (estimateTokenRef.current === token) {
            setIsEstimatingArchiveSize(false);
          }
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [
    format,
    hasArchiveScope,
    selectedWorkspaceIds,
    selectedCollectionIds,
    excludedCollectionIds,
    archiveOptions.includeFullSongHistory,
    archiveOptions.includeNotes,
    archiveOptions.includeLyrics,
    archiveOptions.includeHiddenItems,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  // Pre-run size + duration estimate for the Generate step (both formats). Debounced and
  // race-guarded like the archive-size estimate above; feeds "≈ 512 MB · about a minute".
  const [generateEstimate, setGenerateEstimate] = useState<LibraryExportEstimate | null>(null);
  const generateEstimateTokenRef = useRef(0);
  useEffect(() => {
    if (!format || !hasArchiveScope) {
      setGenerateEstimate(null);
      return;
    }
    const token = ++generateEstimateTokenRef.current;
    const scope = {
      workspaceIds: selectedWorkspaceIds,
      collectionIds: selectedCollectionIds,
      excludedCollectionIds,
    };
    const timer = setTimeout(() => {
      // getState() at run time for the same reason as the archive-size effect above.
      const { workspaces: liveWorkspaces, notes: liveNotes } = useStore.getState();
      const args =
        format === "songnook-archive"
          ? ({ workspaces: liveWorkspaces, notes: liveNotes, format, scope, options: archiveOptions } as const)
          : ({ workspaces: liveWorkspaces, notes: liveNotes, format, scope, options: standardOptions } as const);
      void estimateLibraryExportArchive(args)
        .then((estimate) => {
          if (generateEstimateTokenRef.current === token) setGenerateEstimate(estimate);
        })
        .catch(() => {
          if (generateEstimateTokenRef.current === token) setGenerateEstimate(null);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [
    format,
    hasArchiveScope,
    selectedWorkspaceIds,
    selectedCollectionIds,
    excludedCollectionIds,
    archiveOptions,
    standardOptions,
  ]);

  const generateEstimateLabel =
    generateEstimate && generateEstimate.totalBytes > 0
      ? `≈ ${formatBytes(generateEstimate.totalBytes)} · ${formatDurationEstimate(
          estimateLibraryOperationSeconds("export", generateEstimate.totalBytes)
        )}`
      : null;

  const selectedSummary = useMemo(
    () =>
      getSelectionSummary({
        workspaces,
        selectedWorkspaceIds,
        selectedCollectionIds,
        excludedCollectionIds,
        includeHiddenItems,
      }),
    [excludedCollectionIds, includeHiddenItems, selectedCollectionIds, selectedWorkspaceIds, workspaces]
  );

  const toggleWorkspace = (workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
    const shouldSelect = !selectedWorkspaceIds.includes(workspaceId);

    // An archived workspace's clips have their audio URIs stripped (the audio
    // lives compressed inside its archive package), so exporting one would
    // silently produce songs with no audio — and no missing-file warning,
    // because an undefined URI never reaches the missing-file check.
    if (shouldSelect && workspace?.isArchived) {
      AppAlert.info(
        t("settingsExport.unarchiveTitle"),
        t("settingsExport.unarchiveBody", { title: workspace.title })
      );
      return;
    }

    setSelectedWorkspaceIds((current) =>
      shouldSelect ? [...current, workspaceId] : current.filter((id) => id !== workspaceId)
    );

    if (workspace) {
      const workspaceCollectionIds = new Set(workspace.collections.map((collection) => collection.id));
      setSelectedCollectionIds((current) => current.filter((id) => !workspaceCollectionIds.has(id)));
      if (!shouldSelect) {
        setExcludedCollectionIds((current) => current.filter((id) => !workspaceCollectionIds.has(id)));
      }
    }

    setExpandedWorkspaceIds((current) =>
      current.includes(workspaceId) ? current : [...current, workspaceId]
    );
  };

  const toggleCollection = (workspace: Workspace, collectionId: string) => {
    // Same guard as toggleWorkspace: collections inside an archived workspace
    // have no live audio to export.
    if (workspace.isArchived && !selectedWorkspaceIds.includes(workspace.id)) {
      AppAlert.info(
        t("settingsExport.unarchiveTitle"),
        t("settingsExport.unarchiveBody", { title: workspace.title })
      );
      return;
    }

    const scopeIds = Array.from(getCollectionScopeIds(workspace, collectionId));

    if (selectedWorkspaceIds.includes(workspace.id)) {
      const isExcluded = excludedCollectionIds.includes(collectionId);
      setExcludedCollectionIds((current) =>
        isExcluded
          ? current.filter((id) => !scopeIds.includes(id))
          : [...current.filter((id) => !scopeIds.includes(id)), collectionId]
      );
      return;
    }

    const isSelected = selectedCollectionIds.includes(collectionId);
    setSelectedCollectionIds((current) =>
      isSelected
        ? current.filter((id) => !scopeIds.includes(id))
        : [...current.filter((id) => !scopeIds.includes(id)), collectionId]
    );
  };

  const toggleWorkspaceExpanded = (workspaceId: string) => {
    setExpandedWorkspaceIds((current) =>
      current.includes(workspaceId)
        ? current.filter((id) => id !== workspaceId)
        : [...current, workspaceId]
    );
  };

  const toggleArchiveOption = (key: keyof ArchiveExportOptions) => {
    setArchiveOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleStandardOption = (key: keyof StandardExportOptions) => {
    setStandardOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleExport = async () => {
    if (!format) {
      AppAlert.info(t("settingsExport.chooseFormat"), t("settingsExport.chooseFormatBody"));
      return;
    }

    if (selectedSummary.selectedWorkspaceCount === 0 && selectedSummary.selectedCollectionCount === 0) {
      AppAlert.info(t("settingsExport.chooseScope"), t("settingsExport.chooseScopeBody"));
      return;
    }

    if (useProcessStore.getState().process?.status === "running") {
      AppAlert.info(t("settingsExport.oneAtTime"), t("settingsExport.oneAtTimeBody"));
      return;
    }
    const processId = `export-${Date.now()}`;
    const controller = new AbortController();
    const store = useProcessStore.getState();
    store.start({
      id: processId,
      kind: "export",
      title: format === "songnook-archive" ? t("settingsExport.archive") : t("settingsExport.zip"),
      onCancel: () => controller.abort(),
    });
    const onProgress = (progress: Parameters<typeof store.update>[0]) =>
      useProcessStore.getState().update(progress);
    try {
      const scope = {
        workspaceIds: selectedWorkspaceIds,
        collectionIds: selectedCollectionIds,
        excludedCollectionIds,
      };
      const result =
        format === "songnook-archive"
          ? await exportLibrary({
              workspaces,
              notes,
              songbooks,
              setlists,
              format,
              scope,
              options: archiveOptions,
              onProgress,
              signal: controller.signal,
              libraryPreferences: {
                primaryWorkspaceId,
                primaryCollectionIdByWorkspace: Object.fromEntries(
                  Object.entries(primaryCollectionIdByWorkspace).flatMap(([workspaceId, collectionId]) =>
                    typeof collectionId === "string" ? [[workspaceId, collectionId] as const] : []
                  )
                ),
                bluetoothMonitoringCalibrations,
              },
            })
          : await exportLibrary({
              workspaces,
              notes,
              format,
              scope,
              options: standardOptions,
              onProgress,
              signal: controller.signal,
            });
      // The alert is the single success surface — clear the process instead of stacking
      // a terminal takeover behind the dialog.
      useProcessStore.getState().dismiss(processId);

      const summary = t("settingsExport.resultSummary", { workspaces: result.exportedWorkspaces, collections: result.exportedCollections, songs: result.exportedSongs, clips: result.exportedStandaloneClips, notes: result.exportedNotepadNotes });

      if (result.warningMessages.length > 0) {
        AppAlert.info(t("settingsExport.warningsTitle"), buildWarningSummary(result.warningMessages));
      } else if (result.saveConfirmed) {
        // Android: copied into the folder the user chose.
        haptic.success();
        AppAlert.info(t("settingsExport.saved"), t("settingsExport.savedBody", { summary }));
      } else {
        // iOS share sheet: we can't confirm the destination, only that it was handed off.
        AppAlert.info(t("settingsExport.readyTitle"), t("settingsExport.readyBody", { summary }));
      }
    } catch (error) {
      // User cancellation (takeover Cancel or a backed-out Android folder picker) is a
      // silent no-op, not a failure.
      if (
        isBackupOperationCancelled(error) ||
        (error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE)
      ) {
        useProcessStore.getState().dismiss(processId);
        return;
      }
      const message =
        error instanceof Error ? error.message : t("settingsExport.failedBody");
      useProcessStore.getState().setStatus("error", message);
      AppAlert.info(t("settingsExport.failed"), message);
    }
  };

  return {
    workspaces,
    format,
    setFormat,
    selectedWorkspaceIds,
    selectedCollectionIds,
    excludedCollectionIds,
    expandedWorkspaceIds,
    openSection,
    setOpenSection,
    archiveOptions,
    standardOptions,
    isExporting,
    exportProgressLabel: isExporting && activeProcess ? formatProcessProgress(activeProcess.progress) : null,
    includeHiddenItems,
    selectedSummary,
    archiveSizeEstimate,
    isEstimatingArchiveSize,
    generateEstimateLabel,
    toggleWorkspace,
    toggleCollection,
    toggleArchiveOption,
    toggleStandardOption,
    toggleWorkspaceExpanded,
    handleExport,
  };
}
