import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { AccordionSection, CollectionTreeRow, FormatOptionRow, ToggleRow, WorkspaceScopeRow } from "../components/SettingsShared";
import { countWorkspaceIdeas, getFormatSummary } from "../helpers";
import { getOptionsSummary } from "../helpers";
import type { useLibraryExportFlow } from "../hooks/useLibraryExportFlow";

type ExportFlow = ReturnType<typeof useLibraryExportFlow>;

export function SettingsExportView({ flow, onCancel }: { flow: ExportFlow; onCancel: () => void }) {
  return (
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
        title={`Format${flow.format ? ` (${getFormatSummary(flow.format)})` : ""}`}
        hint="Choose the export package."
        open={flow.openSection === "format"}
        onPress={() => flow.setOpenSection("format")}
      >
        <View style={styles.settingsOptionStack}>
          <FormatOptionRow
            title="Song Seed Archive"
            subtitle="Preserves hierarchy and Song Seed metadata for backup or handoff."
            selected={flow.format === "song-seed-archive"}
            onPress={() => flow.setFormat("song-seed-archive")}
          />
          <FormatOptionRow
            title="Standard ZIP"
            subtitle="Exports a normal folder tree with audio files and optional text files."
            selected={flow.format === "standard-zip"}
            onPress={() => flow.setFormat("standard-zip")}
          />
        </View>
      </AccordionSection>

      <AccordionSection
        step="2"
        title={`Scope${flow.selectedSummary.selectedWorkspaceCount || flow.selectedSummary.selectedCollectionCount ? ` (${flow.selectedSummary.selectedWorkspaceCount} workspace${flow.selectedSummary.selectedWorkspaceCount === 1 ? "" : "s"} ${flow.selectedSummary.selectedCollectionCount} collection${flow.selectedSummary.selectedCollectionCount === 1 ? "" : "s"})` : ""}`}
        hint="Choose which workspaces and collections to package."
        open={flow.openSection === "scope"}
        onPress={() => flow.setOpenSection("scope")}
      >
        <Text style={styles.settingsSectionHint}>
          Selecting a workspace includes everything inside it. Selecting a collection includes its subcollections.
        </Text>

        <View style={styles.settingsScopeStack}>
          {flow.workspaces.map((workspace) => {
            const workspaceSelected = flow.selectedWorkspaceIds.includes(workspace.id);
            const workspaceExpanded =
              workspaceSelected || flow.expandedWorkspaceIds.includes(workspace.id);
            const workspaceItemCount = countWorkspaceIdeas(workspace, flow.includeHiddenItems);
            const workspaceHasSelectedCollections =
              (flow.selectedSummary.workspaceCollectionCounts[workspace.id] ?? 0) > 0;
            const workspaceHasExclusions = flow.excludedCollectionIds.some((id) =>
              workspace.collections.some((collection) => collection.id === id)
            );

            return (
              <View key={workspace.id} style={styles.settingsScopeGroup}>
                <WorkspaceScopeRow
                  title={workspace.title}
                  subtitle={workspace.isArchived ? `Archived · ${workspaceItemCount} items` : `${workspaceItemCount} items`}
                  state={
                    workspaceSelected
                      ? workspaceHasExclusions
                        ? "inherited"
                        : "selected"
                      : workspaceHasSelectedCollections
                        ? "inherited"
                        : "unselected"
                  }
                  expanded={workspaceExpanded}
                  onToggleSelected={() => flow.toggleWorkspace(workspace.id)}
                  onToggleExpanded={() => flow.toggleWorkspaceExpanded(workspace.id)}
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
                          selectedWorkspaceIds={flow.selectedWorkspaceIds}
                          selectedCollectionIds={flow.selectedCollectionIds}
                          excludedCollectionIds={flow.excludedCollectionIds}
                          includeHiddenItems={flow.includeHiddenItems}
                          onToggleCollection={flow.toggleCollection}
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
        title={`Options${getOptionsSummary(flow.format, flow.archiveOptions, flow.standardOptions) ? ` (${getOptionsSummary(flow.format, flow.archiveOptions, flow.standardOptions)})` : ""}`}
        hint="Choose what to include."
        open={flow.openSection === "options"}
        onPress={() => flow.setOpenSection("options")}
      >
        {!flow.format ? (
          <Text style={styles.settingsSectionHint}>Choose a format to reveal export options.</Text>
        ) : null}

        {flow.format === "song-seed-archive" ? (
          <View style={styles.settingsOptionStack}>
            <ToggleRow
              title="Include full song history"
              subtitle="Keep clip versions, the primary take, and derivation links."
              value={flow.archiveOptions.includeFullSongHistory}
              onPress={() => flow.toggleArchiveOption("includeFullSongHistory")}
            />
            <ToggleRow
              title="Include notes"
              subtitle="Adds song and clip notes to the archive package."
              value={flow.archiveOptions.includeNotes}
              onPress={() => flow.toggleArchiveOption("includeNotes")}
            />
            <ToggleRow
              title="Include lyrics"
              subtitle="Adds the latest lyric text for each exported song."
              value={flow.archiveOptions.includeLyrics}
              onPress={() => flow.toggleArchiveOption("includeLyrics")}
            />
            <ToggleRow
              title="Include hidden items"
              subtitle="Exports ideas hidden from list surfaces as well."
              value={flow.archiveOptions.includeHiddenItems}
              onPress={() => flow.toggleArchiveOption("includeHiddenItems")}
            />
          </View>
        ) : null}

        {flow.format === "standard-zip" ? (
          <View style={styles.settingsOptionStack}>
            <ToggleRow
              title="Include notes as .txt"
              subtitle="Writes adjacent text files beside each exported item."
              value={flow.standardOptions.includeNotesAsText}
              onPress={() => flow.toggleStandardOption("includeNotesAsText")}
            />
            <ToggleRow
              title="Include lyrics as .txt"
              subtitle="Exports the latest lyric text beside each song audio file."
              value={flow.standardOptions.includeLyricsAsText}
              onPress={() => flow.toggleStandardOption("includeLyricsAsText")}
            />
            <ToggleRow
              title="Include hidden items"
              subtitle="Exports ideas hidden from list surfaces as well."
              value={flow.standardOptions.includeHiddenItems}
              onPress={() => flow.toggleStandardOption("includeHiddenItems")}
            />
          </View>
        ) : null}
      </AccordionSection>

      <AccordionSection
        step="4"
        title={`Generate${flow.format ? ` (${getFormatSummary(flow.format)})` : ""}`}
        hint={`${flow.selectedSummary.exportableIdeaCount} visible item${flow.selectedSummary.exportableIdeaCount === 1 ? "" : "s"} ready`}
        open={flow.openSection === "generate"}
        onPress={() => flow.setOpenSection("generate")}
      >
        <View style={styles.settingsSummaryPanel}>
          <Text style={styles.settingsSummaryTitle}>
            {flow.format === "song-seed-archive"
              ? "Song Seed Archive"
              : flow.format === "standard-zip"
                ? "Standard ZIP"
                : "Choose a format"}
          </Text>
          <Text style={styles.settingsSummaryMeta}>
            {flow.selectedSummary.selectedWorkspaceCount} workspace
            {flow.selectedSummary.selectedWorkspaceCount === 1 ? "" : "s"}, {flow.selectedSummary.selectedCollectionCount} collection
            {flow.selectedSummary.selectedCollectionCount === 1 ? "" : "s"}, and{" "}
            {flow.selectedSummary.exportableIdeaCount} visible item
            {flow.selectedSummary.exportableIdeaCount === 1 ? "" : "s"} in scope.
          </Text>

          <View style={styles.settingsActionRow}>
            <Button
              label={flow.isExporting ? "Preparing..." : "Generate Export"}
              onPress={() => {
                void flow.handleExport();
              }}
              disabled={flow.isExporting || !flow.format}
              style={styles.settingsPrimaryAction}
            />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={flow.isExporting}
            />
          </View>
        </View>
      </AccordionSection>
    </ScrollView>
  );
}
