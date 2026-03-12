import { useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { Button } from "../common/Button";
import { PageIntro } from "../common/PageIntro";
import { ScreenHeader } from "../common/ScreenHeader";
import { exportLibrary, type LibraryExportFormat } from "../../services/libraryExport";
import { useStore } from "../../state/useStore";
import type { Collection, Workspace } from "../../types";
import { styles } from "../../styles";
import { getCollectionScopeIds } from "../../utils";

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

export function SettingsScreen() {
  const workspaces = useStore((state) => state.workspaces);
  const [showExportFlow, setShowExportFlow] = useState(false);
  const [format, setFormat] = useState<LibraryExportFormat | null>(null);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [excludedCollectionIds, setExcludedCollectionIds] = useState<string[]>([]);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<string[]>([]);
  const [openSection, setOpenSection] = useState<ExportSectionKey>("format");
  const [archiveOptions, setArchiveOptions] = useState(DEFAULT_ARCHIVE_OPTIONS);
  const [standardOptions, setStandardOptions] = useState(DEFAULT_STANDARD_OPTIONS);
  const [isExporting, setIsExporting] = useState(false);

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

  const beginExportFlow = () => {
    setShowExportFlow(true);
  };

  const closeExportFlow = () => {
    if (isExporting) return;
    setShowExportFlow(false);
  };

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

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={showExportFlow ? "Export Library" : "Settings"}
        leftIcon={showExportFlow ? "back" : "hamburger"}
        onLeftPress={showExportFlow ? closeExportFlow : undefined}
      />
      <AppBreadcrumbs
        items={[
          { key: "home", label: "Home", level: "home" },
          { key: "settings", label: "Settings", level: "settings", active: true },
        ]}
      />

      {showExportFlow ? (
        renderExportFlow()
      ) : (
        <View style={styles.flexFill}>
          <PageIntro
            title="Settings"
            subtitle="Export stays lightweight here: choose a package, choose a scope, and hand it to the native save flow."
          />

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
