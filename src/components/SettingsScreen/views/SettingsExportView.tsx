import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { CollectionTreeRow, ToggleRow, WorkspaceScopeRow } from "../components/SettingsShared";
import { SegmentedControl } from "../../common/SegmentedControl";
import { countWorkspaceIdeas } from "../helpers";
import { formatBytes } from "../../../utils";
import type { useLibraryExportFlow } from "../hooks/useLibraryExportFlow";
import { useTranslation } from "react-i18next";

type ExportFlow = ReturnType<typeof useLibraryExportFlow>;

export function SettingsExportView({ flow, onCancel }: { flow: ExportFlow; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.settingsScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settingsExport.title")} />

      {/* One calm page (2026-10-20): what format, what to take, what to include,
          then one Export key. Was four numbered accordion cards. */}
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsExport.format")}</Text>
        <SegmentedControl
          options={[
            { key: "songnook-archive", label: t("settingsExport.archive") },
            { key: "standard-zip", label: t("settingsExport.zip") },
          ]}
          value={flow.format ?? "songnook-archive"}
          onChange={(value) => flow.setFormat(value)}
        />
        <Text style={styles.settingsSectionHint}>
          {flow.format === "standard-zip" ? t("settingsExport.zipHint") : t("settingsExport.archiveHint")}
        </Text>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsExport.scope")}</Text>
        <Text style={styles.settingsSectionHint}>{t("settingsExport.selectionHint")}</Text>
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
                  subtitle={workspace.isArchived ? t("settingsExport.archivedItems", { count: workspaceItemCount }) : t("settingsExport.items", { count: workspaceItemCount })}
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
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsExport.options")}</Text>
        {flow.format === "songnook-archive" ? (
          <View style={styles.settingsOptionStack}>
            <ToggleRow
              title={t("settingsExport.history")}
              subtitle={t("settingsExport.historyHint")}
              value={flow.archiveOptions.includeFullSongHistory}
              onPress={() => flow.toggleArchiveOption("includeFullSongHistory")}
            />
            <ToggleRow
              title={t("settingsExport.notes")}
              subtitle={t("settingsExport.notesHint")}
              value={flow.archiveOptions.includeNotes}
              onPress={() => flow.toggleArchiveOption("includeNotes")}
            />
            <ToggleRow
              title={t("settingsExport.lyrics")}
              subtitle={t("settingsExport.lyricsHint")}
              value={flow.archiveOptions.includeLyrics}
              onPress={() => flow.toggleArchiveOption("includeLyrics")}
            />
            <ToggleRow
              title={t("settingsExport.hidden")}
              subtitle={t("settingsExport.hiddenHint")}
              value={flow.archiveOptions.includeHiddenItems}
              onPress={() => flow.toggleArchiveOption("includeHiddenItems")}
            />
            <ToggleRow
              title={t("settingsExport.metadata")}
              subtitle={t("settingsExport.metadataHint")}
              value={flow.archiveOptions.preserveAllMetadata}
              onPress={() => flow.toggleArchiveOption("preserveAllMetadata")}
            />
          </View>
        ) : null}

        {flow.format === "standard-zip" ? (
          <View style={styles.settingsOptionStack}>
            <ToggleRow
              title={t("settingsExport.notesTxt")}
              subtitle={t("settingsExport.notesTxtHint")}
              value={flow.standardOptions.includeNotesAsText}
              onPress={() => flow.toggleStandardOption("includeNotesAsText")}
            />
            <ToggleRow
              title={t("settingsExport.lyricsTxt")}
              subtitle={t("settingsExport.lyricsTxtHint")}
              value={flow.standardOptions.includeLyricsAsText}
              onPress={() => flow.toggleStandardOption("includeLyricsAsText")}
            />
            <ToggleRow
              title={t("settingsExport.hidden")}
              subtitle={t("settingsExport.hiddenHint")}
              value={flow.standardOptions.includeHiddenItems}
              onPress={() => flow.toggleStandardOption("includeHiddenItems")}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSummaryMeta}>
          {t("settingsExport.inScope", {
            items: t("settingsExport.items", { count: flow.selectedSummary.exportableIdeaCount }),
          })}
        </Text>
        {flow.generateEstimateLabel ? (
          <Text style={styles.settingsSummaryMeta}>{flow.generateEstimateLabel}</Text>
        ) : null}
        <View style={styles.settingsActionRow}>
          <Button
            label={
              flow.isExporting
                ? flow.exportProgressLabel ?? t("settingsExport.preparing")
                : t("settingsExport.export")
            }
            onPress={() => {
              void flow.handleExport();
            }}
            disabled={flow.isExporting || !flow.format || flow.selectedSummary.exportableIdeaCount === 0}
            style={styles.settingsPrimaryAction}
          />
          <Button label={t("common.cancel")} variant="quiet" onPress={onCancel} disabled={flow.isExporting} />
        </View>
      </View>
    </ScrollView>
  );
}
