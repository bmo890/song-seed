import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { AccordionSection, CollectionTreeRow, FormatOptionRow, ToggleRow, WorkspaceScopeRow } from "../components/SettingsShared";
import { countWorkspaceIdeas, getFormatSummary } from "../helpers";
import { getOptionsSummary } from "../helpers";
import { formatBytes } from "../../../utils";
import type { useLibraryExportFlow } from "../hooks/useLibraryExportFlow";
import { useTranslation } from "react-i18next";

type ExportFlow = ReturnType<typeof useLibraryExportFlow>;

export function SettingsExportView({ flow, onCancel }: { flow: ExportFlow; onCancel: () => void }) {
  const { t } = useTranslation();
  const optionsSummary = getOptionsSummary(flow.format, flow.archiveOptions, flow.standardOptions, t);
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.settingsScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro
        title={t("settingsExport.title")}
        subtitle={t("settingsExport.subtitle")}
      />

      <AccordionSection
        step="1"
        title={`${t("settingsExport.format")}${flow.format ? ` (${getFormatSummary(flow.format, t)})` : ""}`}
        hint={t("settingsExport.formatHint")}
        open={flow.openSection === "format"}
        onPress={() => flow.setOpenSection("format")}
      >
        <View style={styles.settingsOptionStack}>
          <FormatOptionRow
            title={t("settingsExport.archive")}
            subtitle={t("settingsExport.archiveHint")}
            selected={flow.format === "songnook-archive"}
            onPress={() => flow.setFormat("songnook-archive")}
          />
          <FormatOptionRow
            title={t("settingsExport.zip")}
            subtitle={t("settingsExport.zipHint")}
            selected={flow.format === "standard-zip"}
            onPress={() => flow.setFormat("standard-zip")}
          />
        </View>
      </AccordionSection>

      <AccordionSection
        step="2"
        title={`${t("settingsExport.scope")}${flow.selectedSummary.selectedWorkspaceCount || flow.selectedSummary.selectedCollectionCount ? ` (${t("settingsExport.scopeSummary", { workspaces: flow.selectedSummary.selectedWorkspaceCount, collections: flow.selectedSummary.selectedCollectionCount })})` : ""}`}
        hint={t("settingsExport.scopeHint")}
        open={flow.openSection === "scope"}
        onPress={() => flow.setOpenSection("scope")}
      >
        <Text style={styles.settingsSectionHint}>
          {t("settingsExport.selectionHint")}
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
      </AccordionSection>

      <AccordionSection
        step="3"
        title={`${t("settingsExport.options")}${optionsSummary ? ` (${optionsSummary})` : ""}`}
        hint={t("settingsExport.optionsHint")}
        open={flow.openSection === "options"}
        onPress={() => flow.setOpenSection("options")}
      >
        {!flow.format ? (
          <Text style={styles.settingsSectionHint}>{t("settingsExport.chooseFormatOptions")}</Text>
        ) : null}

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
            {flow.archiveSizeEstimate ? (
              <Text style={styles.settingsSectionHint}>
                {t("settingsExport.estimate", { full: formatBytes(flow.archiveSizeEstimate.fullBytes), standard: formatBytes(flow.archiveSizeEstimate.standardBytes) })}
              </Text>
            ) : flow.isEstimatingArchiveSize ? (
              <Text style={styles.settingsSectionHint}>{t("settingsExport.estimating")}</Text>
            ) : (
              <Text style={styles.settingsSectionHint}>{t("settingsExport.estimateScope")}</Text>
            )}
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
      </AccordionSection>

      <AccordionSection
        step="4"
        title={`${t("settingsExport.generate")}${flow.format ? ` (${getFormatSummary(flow.format, t)})` : ""}`}
        hint={t("settingsExport.ready", { count: flow.selectedSummary.exportableIdeaCount })}
        open={flow.openSection === "generate"}
        onPress={() => flow.setOpenSection("generate")}
      >
        <View style={styles.settingsSummaryPanel}>
          <Text style={styles.settingsSummaryTitle}>
            {flow.format === "songnook-archive"
              ? t("settingsExport.archive")
              : flow.format === "standard-zip"
                ? t("settingsExport.zip")
                : t("settingsExport.chooseFormat")}
          </Text>
          <Text style={styles.settingsSummaryMeta}>
            {t("settingsExport.generateSummary", { workspaces: flow.selectedSummary.selectedWorkspaceCount, collections: flow.selectedSummary.selectedCollectionCount, items: flow.selectedSummary.exportableIdeaCount })}
          </Text>
          {flow.generateEstimateLabel ? (
            <Text style={styles.settingsSummaryMeta}>{flow.generateEstimateLabel}</Text>
          ) : null}
          <Text style={styles.settingsSectionHint}>
            {t("settingsExport.progressHint")}
          </Text>

          <View style={styles.settingsActionRow}>
            <Button
              label={
                flow.isExporting
                  ? flow.exportProgressLabel ?? t("settingsExport.preparing")
                  : t("settingsExport.generateExport")
              }
              onPress={() => {
                void flow.handleExport();
              }}
              disabled={flow.isExporting || !flow.format}
              style={styles.settingsPrimaryAction}
            />
            <Button
              label={t("common.cancel")}
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
