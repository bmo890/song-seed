import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { Button } from "../common/Button";
import { PageIntro } from "../common/PageIntro";
import { ScreenHeader } from "../common/ScreenHeader";
import { exportLibrary, type LibraryExportFormat } from "../../services/libraryExport";
import { getStorageDetailsReport, type StorageDetailsReport } from "../../services/storageDetails";
import { buildPersistedAppStoreSnapshot, useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import type { Collection, CustomTagDefinition, Workspace } from "../../types";
import { styles } from "../../styles";
import { formatBytes, getCollectionScopeIds } from "../../utils";
import { CUSTOM_TAG_COLOR_OPTIONS, getTagColor } from "../IdeaDetailScreen/songClipControls";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";

const DEFAULT_ARCHIVE_OPTIONS = {
  includeFullSongHistory: true,
  includeNotes: true,
  includeLyrics: true,
  includeHiddenItems: false,
};

const DEFAULT_STANDARD_OPTIONS = {
  includeNotesAsText: true,
  includeLyricsAsText: true,
  includeHiddenItems: false,
};

type CollectionSelectionState = "unselected" | "selected" | "inherited" | "excluded";
type ExportSectionKey = "format" | "scope" | "options" | "generate";
type SettingsView = "overview" | "export" | "storage";

export function SettingsScreen() {
  useBrowseRootBackHandler();
  const workspaces = useStore((state) => state.workspaces);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const workspaceStartupPreference = useStore((state) => state.workspaceStartupPreference);
  const setWorkspaceStartupPreference = useStore((state) => state.setWorkspaceStartupPreference);
  const [view, setView] = useState<SettingsView>("overview");
  const [format, setFormat] = useState<LibraryExportFormat | null>(null);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [excludedCollectionIds, setExcludedCollectionIds] = useState<string[]>([]);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<ExportSectionKey>("format");
  const [archiveOptions, setArchiveOptions] = useState(DEFAULT_ARCHIVE_OPTIONS);
  const [standardOptions, setStandardOptions] = useState(DEFAULT_STANDARD_OPTIONS);
  const [isExporting, setIsExporting] = useState(false);
  const [storageReport, setStorageReport] = useState<StorageDetailsReport | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(false);
  const [showAdvancedStorageDetails, setShowAdvancedStorageDetails] = useState(false);
  const globalCustomClipTags = useStore((s) => s.globalCustomClipTags);
  const [newGlobalTagLabel, setNewGlobalTagLabel] = useState("");
  const [newGlobalTagColor, setNewGlobalTagColor] = useState(CUSTOM_TAG_COLOR_OPTIONS[0].bg);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryProgress, setRecoveryProgress] = useState("");

  const runRecovery = async () => {
    if (isRecovering) return;
    setIsRecovering(true);
    setRecoveryProgress("Scanning for orphaned audio files...");
    try {
      const result = await appActions.recoverOrphanedAudio((done, total) => {
        setRecoveryProgress(`Analyzing file ${done + 1} of ${total}...`);
      });
      if (result.recoveredCount === 0) {
        Alert.alert("No orphaned files", "All audio files on disk are already linked to clips in your library.");
      } else {
        Alert.alert(
          "Recovery complete",
          `Recovered ${result.recoveredCount} clip${result.recoveredCount === 1 ? "" : "s"} into the "Recovered" collection.`
        );
      }
    } catch (error) {
      Alert.alert("Recovery failed", "An error occurred while scanning for orphaned audio files.");
      console.warn("Recovery error:", error);
    } finally {
      setIsRecovering(false);
      setRecoveryProgress("");
    }
  };

  const includeHiddenItems = format === "song-seed-archive"
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
  const primaryWorkspaceTitle = useMemo(
    () => workspaces.find((workspace) => workspace.id === primaryWorkspaceId)?.title ?? null,
    [primaryWorkspaceId, workspaces]
  );

  const beginExportFlow = () => {
    setView("export");
  };

  const closeExportFlow = () => {
    if (isExporting) return;
    setView("overview");
  };

  const openStorageDetails = () => {
    setShowAdvancedStorageDetails(false);
    setView("storage");
  };

  const closeStorageDetails = () => {
    if (isStorageLoading) return;
    setView("overview");
  };

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
    if (view !== "storage") {
      return;
    }

    void loadStorageDetails();
  }, [view]);

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

  const toggleArchiveOption = (key: keyof typeof DEFAULT_ARCHIVE_OPTIONS) => {
    setArchiveOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleStandardOption = (key: keyof typeof DEFAULT_STANDARD_OPTIONS) => {
    setStandardOptions((current) => ({ ...current, [key]: !current[key] }));
  };

  const toggleWorkspaceExpanded = (workspaceId: string) => {
    setExpandedWorkspaceIds((current) =>
      current.includes(workspaceId)
        ? current.filter((id) => id !== workspaceId)
        : [...current, workspaceId]
    );
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
        Alert.alert(
          "Export finished with warnings",
          buildWarningSummary(result.warningMessages)
        );
      } else {
        Alert.alert(
          "Export ready",
          `${result.exportedWorkspaces} workspace${result.exportedWorkspaces === 1 ? "" : "s"}, ${result.exportedCollections} collection${result.exportedCollections === 1 ? "" : "s"}, ${result.exportedSongs} song${result.exportedSongs === 1 ? "" : "s"}, and ${result.exportedStandaloneClips} standalone clip${result.exportedStandaloneClips === 1 ? "" : "s"} were packaged.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The library export could not be completed.";
      Alert.alert("Export failed", message);
    } finally {
      setIsExporting(false);
    }
  };

  const renderExportFlow = () => (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.settingsScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title="Export Library"
        subtitle="Package selected workspaces or collections, then hand the archive to the native save or share flow."
      />

      <AccordionSection
        step="1"
        title={`Format${format ? ` (${getFormatSummary(format)})` : ""}`}
        hint="Choose the export package."
        open={openSection === "format"}
        onPress={() => setOpenSection("format")}
      >
        <View style={styles.settingsOptionStack}>
          <FormatOptionRow
            title="Song Seed Archive"
            subtitle="Preserves hierarchy and Song Seed metadata for backup or handoff."
            selected={format === "song-seed-archive"}
            onPress={() => setFormat("song-seed-archive")}
          />
          <FormatOptionRow
            title="Standard ZIP"
            subtitle="Exports a normal folder tree with audio files and optional text files."
            selected={format === "standard-zip"}
            onPress={() => setFormat("standard-zip")}
          />
        </View>
      </AccordionSection>

      <AccordionSection
        step="2"
        title={`Scope${selectedSummary.selectedWorkspaceCount || selectedSummary.selectedCollectionCount ? ` (${selectedSummary.selectedWorkspaceCount} workspace${selectedSummary.selectedWorkspaceCount === 1 ? "" : "s"} ${selectedSummary.selectedCollectionCount} collection${selectedSummary.selectedCollectionCount === 1 ? "" : "s"})` : ""}`}
        hint="Choose which workspaces and collections to package."
        open={openSection === "scope"}
        onPress={() => setOpenSection("scope")}
      >
        <Text style={styles.settingsSectionHint}>
          Selecting a workspace includes everything inside it. Selecting a collection includes its subcollections.
        </Text>

        <View style={styles.settingsScopeStack}>
          {workspaces.map((workspace) => {
            const workspaceSelected = selectedWorkspaceIds.includes(workspace.id);
            const workspaceExpanded = workspaceSelected || expandedWorkspaceIds.includes(workspace.id);
            const workspaceItemCount = countWorkspaceIdeas(workspace, includeHiddenItems);
            const workspaceHasSelectedCollections = (selectedSummary.workspaceCollectionCounts[workspace.id] ?? 0) > 0;
            const workspaceHasExclusions = excludedCollectionIds.some((id) =>
              workspace.collections.some((collection) => collection.id === id)
            );

            return (
              <View key={workspace.id} style={styles.settingsScopeGroup}>
                <WorkspaceScopeRow
                  title={workspace.title}
                  subtitle={workspace.isArchived ? `Archived · ${workspaceItemCount} items` : `${workspaceItemCount} items`}
                  state={workspaceSelected ? (workspaceHasExclusions ? "inherited" : "selected") : workspaceHasSelectedCollections ? "inherited" : "unselected"}
                  expanded={workspaceExpanded}
                  onToggleSelected={() => toggleWorkspace(workspace.id)}
                  onToggleExpanded={() => toggleWorkspaceExpanded(workspace.id)}
                />

                {workspaceExpanded ? (
                  <View style={styles.settingsScopeChildren}>
                    {workspace.collections
                      .filter((collection) => !collection.parentCollectionId)
                      .map((collection) => (
                        <CollectionTreeRow
                          key={collection.id}
                          workspace={workspace}
                          collection={collection}
                          selectedWorkspaceIds={selectedWorkspaceIds}
                          selectedCollectionIds={selectedCollectionIds}
                          excludedCollectionIds={excludedCollectionIds}
                          includeHiddenItems={includeHiddenItems}
                          onToggleCollection={toggleCollection}
                        />
                      ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </AccordionSection>

      <AccordionSection
        step="3"
        title={`Options${getOptionsSummary(format, archiveOptions, standardOptions) ? ` (${getOptionsSummary(format, archiveOptions, standardOptions)})` : ""}`}
        hint="Choose what to include."
        open={openSection === "options"}
        onPress={() => setOpenSection("options")}
      >
        {!format ? (
          <Text style={styles.settingsSectionHint}>Choose a format to reveal export options.</Text>
        ) : null}

        {format === "song-seed-archive" ? (
          <View style={styles.settingsOptionStack}>
            <ToggleRow
              title="Include full song history"
              subtitle="Keep clip versions, the primary take, and derivation links."
              value={archiveOptions.includeFullSongHistory}
              onPress={() => toggleArchiveOption("includeFullSongHistory")}
            />
            <ToggleRow
              title="Include notes"
              subtitle="Adds song and clip notes to the archive package."
              value={archiveOptions.includeNotes}
              onPress={() => toggleArchiveOption("includeNotes")}
            />
            <ToggleRow
              title="Include lyrics"
              subtitle="Adds the latest lyric text for each exported song."
              value={archiveOptions.includeLyrics}
              onPress={() => toggleArchiveOption("includeLyrics")}
            />
            <ToggleRow
              title="Include hidden items"
              subtitle="Exports ideas hidden from list surfaces as well."
              value={archiveOptions.includeHiddenItems}
              onPress={() => toggleArchiveOption("includeHiddenItems")}
            />
          </View>
        ) : null}

        {format === "standard-zip" ? (
          <View style={styles.settingsOptionStack}>
            <ToggleRow
              title="Include notes as .txt"
              subtitle="Writes adjacent text files beside each exported item."
              value={standardOptions.includeNotesAsText}
              onPress={() => toggleStandardOption("includeNotesAsText")}
            />
            <ToggleRow
              title="Include lyrics as .txt"
              subtitle="Exports the latest lyric text beside each song audio file."
              value={standardOptions.includeLyricsAsText}
              onPress={() => toggleStandardOption("includeLyricsAsText")}
            />
            <ToggleRow
              title="Include hidden items"
              subtitle="Exports ideas hidden from list surfaces as well."
              value={standardOptions.includeHiddenItems}
              onPress={() => toggleStandardOption("includeHiddenItems")}
            />
          </View>
        ) : null}
      </AccordionSection>

      <AccordionSection
        step="4"
        title={`Generate${format ? ` (${getFormatSummary(format)})` : ""}`}
        hint={`${selectedSummary.exportableIdeaCount} visible item${selectedSummary.exportableIdeaCount === 1 ? "" : "s"} ready`}
        open={openSection === "generate"}
        onPress={() => setOpenSection("generate")}
      >
        <View style={styles.settingsSummaryPanel}>
          <Text style={styles.settingsSummaryTitle}>
            {format === "song-seed-archive" ? "Song Seed Archive" : format === "standard-zip" ? "Standard ZIP" : "Choose a format"}
          </Text>
          <Text style={styles.settingsSummaryMeta}>
            {selectedSummary.selectedWorkspaceCount} workspace{selectedSummary.selectedWorkspaceCount === 1 ? "" : "s"}, {selectedSummary.selectedCollectionCount} collection{selectedSummary.selectedCollectionCount === 1 ? "" : "s"}, and {selectedSummary.exportableIdeaCount} visible item{selectedSummary.exportableIdeaCount === 1 ? "" : "s"} in scope.
          </Text>

          <View style={styles.settingsActionRow}>
            <Button
              label={isExporting ? "Preparing..." : "Generate Export"}
              onPress={() => {
                void handleExport();
              }}
              disabled={isExporting || !format}
              style={styles.settingsPrimaryAction}
            />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={closeExportFlow}
              disabled={isExporting}
            />
          </View>

          {isExporting ? (
            <View style={styles.settingsBusyRow}>
              <ActivityIndicator size="small" color="#0f172a" />
              <Text style={styles.settingsBusyText}>Building archive and opening the native save/share flow.</Text>
            </View>
          ) : null}
        </View>
      </AccordionSection>
    </ScrollView>
  );

  const renderStorageDetails = () => (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.settingsScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title="Storage details"
        subtitle="Song Seed keeps your live library in app-managed storage on this device. Recorded and imported audio is copied into Song Seed storage, while archived workspaces keep compressed packages until you restore them."
      />

      {isStorageLoading && !storageReport ? (
        <View style={styles.settingsSummaryPanel}>
          <View style={styles.settingsBusyRow}>
            <ActivityIndicator size="small" color="#0f172a" />
            <Text style={styles.settingsBusyText}>Measuring app-managed storage.</Text>
          </View>
        </View>
      ) : null}

      {storageError ? (
        <View style={styles.settingsSummaryPanel}>
          <Text style={styles.settingsSummaryTitle}>Storage details unavailable</Text>
          <Text style={styles.settingsSummaryMeta}>{storageError}</Text>
        </View>
      ) : null}

      {storageReport ? (
        <>
          <View style={styles.settingsSummaryPanel}>
            <Text style={styles.settingsSummaryTitle}>Library storage</Text>
            <Text style={styles.settingsStoragePrimaryValue}>
              {formatBytes(storageReport.totalLibraryBytes)}
            </Text>
            <Text style={styles.settingsSummaryMeta}>{storageReport.storageLabel}</Text>
            <Text style={styles.settingsSummaryMeta}>
              {storageReport.activeWorkspaceCount} active workspace
              {storageReport.activeWorkspaceCount === 1 ? "" : "s"} and{" "}
              {storageReport.archivedWorkspaceCount} archived workspace
              {storageReport.archivedWorkspaceCount === 1 ? "" : "s"}.
            </Text>
            <View style={styles.settingsActionRow}>
              <Button
                label={isStorageLoading ? "Refreshing..." : "Refresh"}
                variant="secondary"
                onPress={() => void loadStorageDetails()}
                disabled={isStorageLoading}
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>Library storage</Text>
              <Text style={styles.settingsSectionMeta}>{formatBytes(storageReport.totalLibraryBytes)}</Text>
            </View>

            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label="Total library storage used"
                value={formatBytes(storageReport.totalLibraryBytes)}
                detail="Live library data plus archived workspace packages."
              />
              <StorageMetricRow
                label="Active workspaces"
                value={String(storageReport.activeWorkspaceCount)}
                detail={`${formatBytes(storageReport.activeLibraryBytes)} across managed audio and live workspace data.`}
              />
              <StorageMetricRow
                label="Audio files"
                value={formatBytes(storageReport.managedAudio.bytes)}
                detail={`${storageReport.managedAudio.fileCount} managed audio file${storageReport.managedAudio.fileCount === 1 ? "" : "s"} stored for the live library.`}
              />
              <StorageMetricRow
                label="Library data"
                value={formatBytes(storageReport.metadataBytes)}
                detail="Titles, notes, lyrics, playlists, history, and workspace metadata saved in app storage."
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>Archived workspaces</Text>
              <Text style={styles.settingsSectionMeta}>{storageReport.archivedWorkspaceCount}</Text>
            </View>

            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label="Archived workspaces"
                value={String(storageReport.archivedWorkspaceCount)}
                detail={`${formatBytes(storageReport.archivedLibraryBytes)} including package files and archived workspace data.`}
              />
              <StorageMetricRow
                label="Archive storage used"
                value={formatBytes(storageReport.archivePackages.bytes)}
                detail={`${storageReport.archivePackages.fileCount} archive package${storageReport.archivePackages.fileCount === 1 ? "" : "s"} stored in Song Seed app storage.`}
              />
              <StorageMetricRow
                label="Archived workspace data"
                value={formatBytes(storageReport.archivedWorkspaceMetadataBytes)}
                detail="Workspace names, collections, notes, and archive status that stay available while the audio is packed away."
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>Temporary files</Text>
              <Text style={styles.settingsSectionMeta}>{formatBytes(storageReport.temporaryExports.bytes)}</Text>
            </View>

            <View style={styles.settingsSummaryPanel}>
              <StorageMetricRow
                label="Export and share temp files"
                value={formatBytes(storageReport.temporaryExports.bytes)}
                detail={`${storageReport.temporaryExports.fileCount} file${storageReport.temporaryExports.fileCount === 1 ? "" : "s"} staged for exports or native sharing. This is shown separately from the library total.`}
              />
              <StorageMetricRow
                label="All Song Seed managed storage"
                value={formatBytes(storageReport.totalManagedBytes)}
                detail="Library storage plus temporary export/share files currently left on device."
              />
            </View>
          </View>

          <AccordionSection
            step="Advanced"
            title="Support details"
            hint="Secondary details for troubleshooting and storage audits."
            open={showAdvancedStorageDetails}
            onPress={() => setShowAdvancedStorageDetails((current) => !current)}
          >
            <View style={styles.settingsOptionStack}>
              {storageReport.unmanagedAudioReferences.totalReferences > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <StorageMetricRow
                    label="Outside managed live-library storage"
                    value={`${storageReport.unmanagedAudioReferences.totalReferences}`}
                    detail={`${formatBytes(storageReport.unmanagedAudioReferences.totalMeasuredBytes)} measured outside the managed audio folder.`}
                  />
                </View>
              ) : null}

              {storageReport.supportingDataBytes > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <StorageMetricRow
                    label="Shared library support data"
                    value={formatBytes(storageReport.supportingDataBytes)}
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
                  value={storageReport.advanced.appStorageRootUri}
                />
                <StoragePathRow
                  label="Managed audio"
                  value={storageReport.advanced.audioDirectoryUri}
                />
                <StoragePathRow
                  label="Workspace archives"
                  value={storageReport.advanced.archiveDirectoryUri}
                />
                <StoragePathRow
                  label="Share/export temp"
                  value={storageReport.advanced.shareDirectoryUri}
                />
              </View>

              {storageReport.limitations.length > 0 ? (
                <View style={styles.settingsSummaryPanel}>
                  <Text style={styles.settingsSummaryTitle}>Reporting notes</Text>
                  {storageReport.limitations.map((item) => (
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

  const title =
    view === "export" ? "Export Library" : view === "storage" ? "Storage details" : "Settings";
  const showSubscreen = view !== "overview";
  const handleBackPress = view === "export" ? closeExportFlow : view === "storage" ? closeStorageDetails : undefined;
  const breadcrumbItems =
    view === "storage"
      ? [
          { key: "home", label: "Home", level: "home" as const },
          { key: "settings", label: "Settings", level: "settings" as const },
          { key: "storage-details", label: "Storage details", level: "settings" as const, active: true },
        ]
      : [
          { key: "home", label: "Home", level: "home" as const },
          { key: "settings", label: "Settings", level: "settings" as const, active: true },
        ];

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={title}
        leftIcon={showSubscreen ? "back" : "hamburger"}
        onLeftPress={handleBackPress}
      />
      <AppBreadcrumbs items={breadcrumbItems} />

      {view === "export" ? (
        renderExportFlow()
      ) : view === "storage" ? (
        renderStorageDetails()
      ) : (
        <View style={styles.flexFill}>
          <PageIntro
            title="Settings"
            subtitle="Set where the app returns on launch, check how Song Seed stores your library on this device, or export a portable package when you need one."
          />

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>Startup</Text>
              <Text style={styles.settingsSectionMeta}>
                {workspaceStartupPreference === "primary" ? "Primary workspace" : "Last used workspace"}
              </Text>
            </View>

            <View style={styles.settingsOptionStack}>
              <FormatOptionRow
                title="Return to primary workspace"
                subtitle={
                  primaryWorkspaceTitle
                    ? `Returns to ${primaryWorkspaceTitle} when the app opens.`
                    : "Falls back to your last used workspace until a primary workspace is set."
                }
                selected={workspaceStartupPreference === "primary"}
                onPress={() => setWorkspaceStartupPreference("primary")}
              />
              <FormatOptionRow
                title="Return to last used workspace"
                subtitle="Returns to the workspace you most recently opened or worked in."
                selected={workspaceStartupPreference === "last-used"}
                onPress={() => setWorkspaceStartupPreference("last-used")}
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <View style={styles.settingsSectionHeaderRow}>
              <Text style={styles.settingsSectionLabel}>Custom clip tags</Text>
              <Text style={styles.settingsSectionMeta}>{globalCustomClipTags.length}</Text>
            </View>
            <Text style={styles.settingsSectionHint}>
              Global tags appear in the tag picker across all projects.
            </Text>

            {globalCustomClipTags.length > 0 ? (
              <View style={styles.tagPickerChipsWrap}>
                {globalCustomClipTags.map((tag) => {
                  const color = getTagColor(tag.key, [], globalCustomClipTags);
                  return (
                    <View key={tag.key} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View
                        style={[
                          styles.clipCardTagBadge,
                          { backgroundColor: color.bg, flexDirection: "row", alignItems: "center", gap: 4 },
                        ]}
                      >
                        <Text style={[styles.clipCardTagBadgeText, { color: color.text, fontSize: 12 }]}>
                          {tag.label}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => {
                          Alert.alert("Remove tag?", `Remove "${tag.label}" from global tags?`, [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () => useStore.getState().removeGlobalCustomClipTag(tag.key),
                            },
                          ]);
                        }}
                        hitSlop={6}
                      >
                        <Ionicons name="close-circle" size={16} color="#94a3b8" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.tagPickerAddRow}>
              <TextInput
                style={styles.tagPickerAddInput}
                placeholder="New tag name"
                placeholderTextColor="#94a3b8"
                value={newGlobalTagLabel}
                onChangeText={setNewGlobalTagLabel}
                onSubmitEditing={() => {
                  const label = newGlobalTagLabel.trim();
                  if (!label) return;
                  const key = label.toLowerCase().replace(/\s+/g, "-");
                  if (globalCustomClipTags.some((t) => t.key === key)) return;
                  useStore.getState().addGlobalCustomClipTag({ key, label, color: newGlobalTagColor });
                  setNewGlobalTagLabel("");
                }}
                returnKeyType="done"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.tagPickerAddBtn,
                  !newGlobalTagLabel.trim() ? styles.tagPickerAddBtnDisabled : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => {
                  const label = newGlobalTagLabel.trim();
                  if (!label) return;
                  const key = label.toLowerCase().replace(/\s+/g, "-");
                  if (globalCustomClipTags.some((t) => t.key === key)) return;
                  useStore.getState().addGlobalCustomClipTag({ key, label, color: newGlobalTagColor });
                  setNewGlobalTagLabel("");
                }}
                disabled={!newGlobalTagLabel.trim()}
              >
                <Ionicons name="add" size={16} color={newGlobalTagLabel.trim() ? "#0f172a" : "#94a3b8"} />
              </Pressable>
            </View>
            <View style={styles.tagPickerColorRow}>
              {CUSTOM_TAG_COLOR_OPTIONS.map((option) => (
                <Pressable
                  key={option.bg}
                  style={[
                    styles.tagPickerColorSwatch,
                    { backgroundColor: option.bg },
                    newGlobalTagColor === option.bg ? styles.tagPickerColorSwatchActive : null,
                  ]}
                  onPress={() => setNewGlobalTagColor(option.bg)}
                />
              ))}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.settingsActionCard,
              pressed ? styles.pressDown : null,
            ]}
            onPress={openStorageDetails}
          >
            <View style={styles.settingsActionCardCopy}>
              <Text style={styles.settingsActionCardTitle}>Storage details</Text>
              <Text style={styles.settingsActionCardMeta}>
                See how much Song Seed storage your library, archives, and temporary exports use on this device.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.settingsActionCard,
              pressed ? styles.pressDown : null,
            ]}
            onPress={beginExportFlow}
          >
            <View style={styles.settingsActionCardCopy}>
              <Text style={styles.settingsActionCardTitle}>Export Library</Text>
              <Text style={styles.settingsActionCardMeta}>
                Package workspaces or collections as a Song Seed Archive or a Standard ZIP.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.settingsActionCard,
              pressed ? styles.pressDown : null,
              isRecovering ? { opacity: 0.6 } : null,
            ]}
            onPress={runRecovery}
            disabled={isRecovering}
          >
            <View style={styles.settingsActionCardCopy}>
              <Text style={styles.settingsActionCardTitle}>Recover audio files</Text>
              <Text style={styles.settingsActionCardMeta}>
                {isRecovering
                  ? recoveryProgress
                  : "Scan for orphaned audio files on disk that are no longer linked to any clip, and restore them into a Recovered collection."}
              </Text>
            </View>
            {isRecovering ? (
              <ActivityIndicator size="small" color="#64748b" />
            ) : (
              <Ionicons name="refresh" size={18} color="#64748b" />
            )}
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function FormatOptionRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsChoiceRow,
        selected ? styles.settingsChoiceRowSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <SelectionMark state={selected ? "selected" : "unselected"} />
      <View style={styles.settingsChoiceCopy}>
        <Text style={styles.settingsChoiceTitle}>{title}</Text>
        <Text style={styles.settingsChoiceMeta}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function AccordionSection({
  step,
  title,
  hint,
  open,
  onPress,
  children,
}: {
  step: string;
  title: string;
  hint: string;
  open: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <View style={[styles.settingsSection, styles.settingsAccordionShell, open ? styles.settingsAccordionShellOpen : null]}>
      <Pressable
        style={({ pressed }) => [
          styles.settingsAccordionHeader,
          open ? styles.settingsAccordionHeaderOpen : null,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onPress}
      >
        <View style={styles.settingsAccordionCopy}>
          <Text style={styles.settingsSectionLabel}>{step}</Text>
          <Text style={styles.settingsAccordionTitle}>{title}</Text>
          <Text style={styles.settingsAccordionHint}>{hint}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color="#64748b" />
      </Pressable>

      {open ? <View style={styles.settingsAccordionBody}>{children}</View> : null}
    </View>
  );
}

function StorageMetricRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <View style={styles.settingsStorageMetricRow}>
      <View style={styles.settingsStorageMetricCopy}>
        <Text style={styles.settingsChoiceTitle}>{label}</Text>
        <Text style={styles.settingsChoiceMeta}>{detail}</Text>
      </View>
      <Text style={styles.settingsStorageMetricValue}>{value}</Text>
    </View>
  );
}

function StoragePathRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.settingsStoragePathRow}>
      <Text style={styles.settingsSectionLabel}>{label}</Text>
      <Text style={styles.settingsStoragePathValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onPress,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsToggleRow,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <View style={styles.settingsChoiceCopy}>
        <Text style={styles.settingsChoiceTitle}>{title}</Text>
        <Text style={styles.settingsChoiceMeta}>{subtitle}</Text>
      </View>
      <View style={[styles.settingsTogglePill, value ? styles.settingsTogglePillActive : null]}>
        <View style={[styles.settingsToggleThumb, value ? styles.settingsToggleThumbActive : null]} />
      </View>
    </Pressable>
  );
}

function ScopeRow({
  title,
  subtitle,
  state,
  level,
  onPress,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  state: CollectionSelectionState;
  level: number;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <SelectionMark state={state} />
      <View style={styles.settingsScopeCopy}>
        <Text style={styles.settingsScopeTitle}>{title}</Text>
        <Text style={styles.settingsScopeMeta}>{subtitle}</Text>
      </View>
    </>
  );

  const rowStyle = [
    styles.settingsScopeRow,
    level === 1 ? styles.settingsScopeRowNested : null,
    disabled ? styles.settingsScopeRowDisabled : null,
  ];

  if (!onPress || disabled) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable style={({ pressed }) => [rowStyle, pressed ? styles.pressDown : null]} onPress={onPress}>
      {content}
    </Pressable>
  );
}

function WorkspaceScopeRow({
  title,
  subtitle,
  state,
  expanded,
  onToggleSelected,
  onToggleExpanded,
}: {
  title: string;
  subtitle: string;
  state: CollectionSelectionState;
  expanded: boolean;
  onToggleSelected: () => void;
  onToggleExpanded: () => void;
}) {
  return (
    <View style={styles.settingsWorkspaceRow}>
      <Pressable
        style={({ pressed }) => [
          styles.settingsWorkspaceSelectZone,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onToggleSelected}
      >
        <SelectionMark state={state} />
        <View style={styles.settingsScopeCopy}>
          <Text style={styles.settingsScopeTitle}>{title}</Text>
          <Text style={styles.settingsScopeMeta}>{subtitle}</Text>
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.settingsWorkspaceExpandBtn,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onToggleExpanded}
      >
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color="#64748b"
        />
      </Pressable>
    </View>
  );
}

function CollectionTreeRow({
  workspace,
  collection,
  selectedWorkspaceIds,
  selectedCollectionIds,
  excludedCollectionIds,
  includeHiddenItems,
  onToggleCollection,
}: {
  workspace: Workspace;
  collection: Collection;
  selectedWorkspaceIds: string[];
  selectedCollectionIds: string[];
  excludedCollectionIds: string[];
  includeHiddenItems: boolean;
  onToggleCollection: (workspace: Workspace, collectionId: string) => void;
}) {
  const state = getCollectionSelectionState(
    workspace,
    collection,
    selectedWorkspaceIds,
    selectedCollectionIds,
    excludedCollectionIds
  );
  const itemCount = countCollectionIdeas(workspace, collection.id, includeHiddenItems);
  const inheritedSubtitle =
    state === "excluded"
      ? `Excluded · ${itemCount} items`
      : state === "inherited"
      ? selectedWorkspaceIds.includes(workspace.id)
        ? `Included via workspace · ${itemCount} items`
        : `Included via parent collection · ${itemCount} items`
      : `${itemCount} items`;

  return (
    <View>
      <ScopeRow
        title={collection.title}
        subtitle={inheritedSubtitle}
        state={state}
        level={collection.parentCollectionId ? 1 : 0}
        onPress={() => onToggleCollection(workspace, collection.id)}
      />

      {workspace.collections
        .filter((candidate) => candidate.parentCollectionId === collection.id)
        .map((child) => (
          <CollectionTreeRow
            key={child.id}
            workspace={workspace}
            collection={child}
            selectedWorkspaceIds={selectedWorkspaceIds}
            selectedCollectionIds={selectedCollectionIds}
            excludedCollectionIds={excludedCollectionIds}
            includeHiddenItems={includeHiddenItems}
            onToggleCollection={onToggleCollection}
          />
        ))}
    </View>
  );
}

function SelectionMark({ state }: { state: CollectionSelectionState }) {
  const iconName: ComponentProps<typeof Ionicons>["name"] =
    state === "selected"
      ? "checkmark-circle"
      : state === "excluded"
        ? "close-circle"
      : state === "inherited"
        ? "remove-circle"
        : "ellipse-outline";
  const color =
    state === "selected"
      ? "#0f172a"
      : state === "excluded"
        ? "#b91c1c"
      : state === "inherited"
        ? "#64748b"
        : "#94a3b8";

  return <Ionicons name={iconName} size={18} color={color} />;
}

function getCollectionSelectionState(
  workspace: Workspace,
  collection: Collection,
  selectedWorkspaceIds: string[],
  selectedCollectionIds: string[],
  excludedCollectionIds: string[]
): CollectionSelectionState {
  if (excludedCollectionIds.includes(collection.id)) {
    return "excluded";
  }

  let currentParentId = collection.parentCollectionId ?? null;
  while (currentParentId) {
    if (excludedCollectionIds.includes(currentParentId)) {
      return "excluded";
    }

    if (selectedCollectionIds.includes(currentParentId)) {
      return "inherited";
    }

    currentParentId =
      workspace.collections.find((candidate) => candidate.id === currentParentId)?.parentCollectionId ?? null;
  }

  if (selectedWorkspaceIds.includes(workspace.id)) {
    return "inherited";
  }

  if (selectedCollectionIds.includes(collection.id)) {
    return "selected";
  }

  return "unselected";
}

function countCollectionIdeas(workspace: Workspace, collectionId: string, includeHiddenItems: boolean) {
  const collectionIds = new Set<string>([collectionId]);
  workspace.collections.forEach((collection) => {
    if (collection.parentCollectionId === collectionId) {
      collectionIds.add(collection.id);
    }
  });

  return workspace.ideas.filter((idea) => {
    if (!collectionIds.has(idea.collectionId)) {
      return false;
    }

    if (includeHiddenItems) {
      return true;
    }

    const collection = workspace.collections.find((candidate) => candidate.id === idea.collectionId);
    return !collection?.ideasListState.hiddenIdeaIds.includes(idea.id);
  }).length;
}

function countWorkspaceIdeas(workspace: Workspace, includeHiddenItems: boolean) {
  if (includeHiddenItems) {
    return workspace.ideas.length;
  }

  return workspace.ideas.filter((idea) => {
    const collection = workspace.collections.find((candidate) => candidate.id === idea.collectionId);
    return !collection?.ideasListState.hiddenIdeaIds.includes(idea.id);
  }).length;
}

function getSelectionSummary({
  workspaces,
  selectedWorkspaceIds,
  selectedCollectionIds,
  excludedCollectionIds,
  includeHiddenItems,
}: {
  workspaces: Workspace[];
  selectedWorkspaceIds: string[];
  selectedCollectionIds: string[];
  excludedCollectionIds: string[];
  includeHiddenItems: boolean;
}) {
  const workspaceIdSet = new Set(selectedWorkspaceIds);
  const collectionIdSet = new Set(selectedCollectionIds);
  const excludedCollectionIdSet = new Set(excludedCollectionIds);
  let exportableIdeaCount = 0;
  let selectedCollectionCount = 0;
  const workspaceCollectionCounts: Record<string, number> = {};

  workspaces.forEach((workspace) => {
    const effectiveCollectionIds = new Set<string>();

    if (workspaceIdSet.has(workspace.id)) {
      workspace.collections.forEach((collection) => effectiveCollectionIds.add(collection.id));
    }

    workspace.collections.forEach((collection) => {
      if (!collectionIdSet.has(collection.id)) {
        return;
      }

      effectiveCollectionIds.add(collection.id);
      workspace.collections.forEach((candidate) => {
        if (candidate.parentCollectionId === collection.id) {
          effectiveCollectionIds.add(candidate.id);
        }
      });
    });

    workspace.collections.forEach((collection) => {
      if (!excludedCollectionIdSet.has(collection.id)) {
        return;
      }

      getCollectionScopeIds(workspace, collection.id).forEach((id) => effectiveCollectionIds.delete(id));
    });

    selectedCollectionCount += effectiveCollectionIds.size;
    workspaceCollectionCounts[workspace.id] = effectiveCollectionIds.size;

    workspace.ideas.forEach((idea) => {
      if (!effectiveCollectionIds.has(idea.collectionId)) {
        return;
      }

      if (includeHiddenItems) {
        exportableIdeaCount += 1;
        return;
      }

      const collection = workspace.collections.find((candidate) => candidate.id === idea.collectionId);
      if (!collection?.ideasListState.hiddenIdeaIds.includes(idea.id)) {
        exportableIdeaCount += 1;
      }
    });
  });

  return {
    selectedWorkspaceCount: workspaceIdSet.size,
    selectedCollectionCount,
    exportableIdeaCount,
    workspaceCollectionCounts,
  };
}

function buildWarningSummary(warnings: string[]) {
  const uniqueWarnings = Array.from(new Set(warnings));
  const preview = uniqueWarnings.slice(0, 3).join("\n");
  const remainder = uniqueWarnings.length > 3 ? `\n+ ${uniqueWarnings.length - 3} more warning${uniqueWarnings.length - 3 === 1 ? "" : "s"}.` : "";
  return `${preview}${remainder}`;
}

function getFormatSummary(format: LibraryExportFormat) {
  return format === "song-seed-archive" ? "Song Seed Archive" : "Standard ZIP";
}

function getOptionsSummary(
  format: LibraryExportFormat | null,
  archiveOptions: typeof DEFAULT_ARCHIVE_OPTIONS,
  standardOptions: typeof DEFAULT_STANDARD_OPTIONS
) {
  if (!format) {
    return "";
  }

  const options =
    format === "song-seed-archive"
      ? [
          archiveOptions.includeFullSongHistory ? "history" : null,
          archiveOptions.includeNotes ? "notes" : null,
          archiveOptions.includeLyrics ? "lyrics" : null,
          archiveOptions.includeHiddenItems ? "hidden" : null,
        ]
      : [
          standardOptions.includeNotesAsText ? "notes" : null,
          standardOptions.includeLyricsAsText ? "lyrics" : null,
          standardOptions.includeHiddenItems ? "hidden" : null,
        ];

  const enabled = options.filter((value): value is string => Boolean(value));
  if (enabled.length === 0) {
    return "basic export";
  }

  return enabled.join(", ");
}
