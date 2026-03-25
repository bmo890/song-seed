import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { exportLibrary, type LibraryExportFormat } from "../../../services/libraryExport";
import { useStore } from "../../../state/useStore";
import type { Workspace } from "../../../types";
import { getCollectionScopeIds } from "../../../utils";
import {
  buildWarningSummary,
  getSelectionSummary,
} from "../helpers";
import type { ArchiveExportOptions, ExportSectionKey, StandardExportOptions } from "../types";

const DEFAULT_ARCHIVE_OPTIONS: ArchiveExportOptions = {
  includeFullSongHistory: true,
  includeNotes: true,
  includeLyrics: true,
  includeHiddenItems: false,
};

const DEFAULT_STANDARD_OPTIONS: StandardExportOptions = {
  includeNotesAsText: true,
  includeLyricsAsText: true,
  includeHiddenItems: false,
};

export function useLibraryExportFlow() {
  const workspaces = useStore((state) => state.workspaces);
  const [format, setFormat] = useState<LibraryExportFormat | null>(null);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [excludedCollectionIds, setExcludedCollectionIds] = useState<string[]>([]);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<ExportSectionKey>("format");
  const [archiveOptions, setArchiveOptions] = useState(DEFAULT_ARCHIVE_OPTIONS);
  const [standardOptions, setStandardOptions] = useState(DEFAULT_STANDARD_OPTIONS);
  const [isExporting, setIsExporting] = useState(false);

  const includeHiddenItems =
    format === "song-seed-archive"
      ? archiveOptions.includeHiddenItems
      : standardOptions.includeHiddenItems;

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
      Alert.alert("Choose a format", "Select Song Seed Archive or Standard ZIP before exporting.");
      return;
    }

    if (selectedSummary.selectedWorkspaceCount === 0 && selectedSummary.selectedCollectionCount === 0) {
      Alert.alert("Choose a scope", "Select at least one workspace or collection to export.");
      return;
    }

    setIsExporting(true);
    try {
      const scope = {
        workspaceIds: selectedWorkspaceIds,
        collectionIds: selectedCollectionIds,
        excludedCollectionIds,
      };
      const result =
        format === "song-seed-archive"
          ? await exportLibrary({
              workspaces,
              format,
              scope,
              options: archiveOptions,
            })
          : await exportLibrary({
              workspaces,
              format,
              scope,
              options: standardOptions,
            });

      if (result.warningMessages.length > 0) {
        Alert.alert("Export finished with warnings", buildWarningSummary(result.warningMessages));
      } else {
        Alert.alert(
          "Export ready",
          `${result.exportedWorkspaces} workspace${result.exportedWorkspaces === 1 ? "" : "s"}, ${result.exportedCollections} collection${result.exportedCollections === 1 ? "" : "s"}, ${result.exportedSongs} song${result.exportedSongs === 1 ? "" : "s"}, and ${result.exportedStandaloneClips} standalone clip${result.exportedStandaloneClips === 1 ? "" : "s"} were packaged.`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The library export could not be completed.";
      Alert.alert("Export failed", message);
    } finally {
      setIsExporting(false);
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
    includeHiddenItems,
    selectedSummary,
    toggleWorkspace,
    toggleCollection,
    toggleArchiveOption,
    toggleStandardOption,
    toggleWorkspaceExpanded,
    handleExport,
  };
}
