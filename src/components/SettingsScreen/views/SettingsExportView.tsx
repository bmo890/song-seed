import { ScrollView, Text, View } from "react-native";
import { PageIntro } from "../../common/PageIntro";
import { Button } from "../../common/Button";
import { styles } from "../styles";
import { CollectionTreeRow, MultiValueRow, SettingsGroup, ValueRow, WorkspaceScopeRow } from "../components/SettingsShared";
import { settingsScreenStyles } from "../styles";
import { countWorkspaceIdeas } from "../helpers";
import { formatBytes } from "../../../utils";
import type { useLibraryExportFlow } from "../hooks/useLibraryExportFlow";
import { useTranslation } from "react-i18next";

type ExportFlow = ReturnType<typeof useLibraryExportFlow>;

/** The header's back chevron leaves; the old Cancel key said it twice. */
export function SettingsExportView({ flow }: { flow: ExportFlow; onCancel?: () => void }) {
  const { t } = useTranslation();
  return (
    <ScrollView
      style={styles.flexFill}
      contentContainerStyle={styles.settingsScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <PageIntro title={t("settingsExport.title")} />

      {/* Two rows and a tree (2026-10-21): the format and what to include are
          value rows with pickers, the hints are gone, then what to take, then
          one Export key. Was tabs plus up to five switches with a line each. */}
      <View style={[styles.settingsSection, settingsScreenStyles.pickerSection]}>
        <SettingsGroup>
          <ValueRow
            title={t("settingsExport.format")}
            value={flow.format ?? "songnook-archive"}
            options={[
              { value: "songnook-archive", label: t("settingsExport.archive") },
              { value: "standard-zip", label: t("settingsExport.zip") },
            ]}
            onChange={(value) => flow.setFormat(value)}
          />
          {flow.format === "standard-zip" ? (
            <MultiValueRow
              title={t("settingsExport.include")}
              noneLabel={t("settingsExport.audioOnly")}
              allLabel={t("settingsExport.includeAll")}
              countLabel={(count) => t("settingsExport.includeCount", { count })}
              options={[
                { key: "includeNotesAsText", label: t("settingsExport.incNotesTxt"), on: flow.standardOptions.includeNotesAsText },
                { key: "includeLyricsAsText", label: t("settingsExport.incLyricsTxt"), on: flow.standardOptions.includeLyricsAsText },
                { key: "includeHiddenItems", label: t("settingsExport.incHidden"), on: flow.standardOptions.includeHiddenItems },
              ]}
              onToggle={(key) => flow.toggleStandardOption(key)}
            />
          ) : (
            <MultiValueRow
              title={t("settingsExport.include")}
              noneLabel={t("settingsExport.audioOnly")}
              allLabel={t("settingsExport.includeAll")}
              countLabel={(count) => t("settingsExport.includeCount", { count })}
              options={[
                { key: "includeNotes", label: t("settingsExport.incNotes"), on: flow.archiveOptions.includeNotes },
                { key: "includeLyrics", label: t("settingsExport.incLyrics"), on: flow.archiveOptions.includeLyrics },
                { key: "includeFullSongHistory", label: t("settingsExport.incHistory"), on: flow.archiveOptions.includeFullSongHistory },
                { key: "preserveAllMetadata", label: t("settingsExport.incDetail"), on: flow.archiveOptions.preserveAllMetadata },
                { key: "includeHiddenItems", label: t("settingsExport.incHidden"), on: flow.archiveOptions.includeHiddenItems },
              ]}
              onToggle={(key) => flow.toggleArchiveOption(key)}
            />
          )}
        </SettingsGroup>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionLabel}>{t("settingsExport.scope")}</Text>
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
        </View>
      </View>
    </ScrollView>
  );
}
