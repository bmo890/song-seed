import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../common/ScreenHeader";
import { styles } from "../../styles";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";
import { useRevisitScreenModel } from "./hooks/useRevisitScreenModel";
import { revisitStyles } from "./styles";
import { RevisitAroundSnapshotView } from "./components/RevisitAroundSnapshotView";
import { RevisitTuningPanel } from "./components/RevisitTuningPanel";
import { RevisitWorkspaceFilterRow } from "./components/RevisitWorkspaceFilterRow";
import { RevisitSectionBlock } from "./components/RevisitSectionBlock";

export function RevisitScreen() {
  const screen = useRevisitScreenModel();
  useBrowseRootBackHandler({
    onBack: screen.isAroundSnapshotOpen ? screen.closeAroundSnapshot : undefined,
  });

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={screen.isAroundSnapshotOpen ? "Around This Time" : "Revisit"}
        leftIcon={screen.isAroundSnapshotOpen ? "back" : "hamburger"}
        onLeftPress={screen.isAroundSnapshotOpen ? screen.closeAroundSnapshot : undefined}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={revisitStyles.scrollContent}
      >
        {screen.isAroundSnapshotOpen ? (
          <RevisitAroundSnapshotView
            snapshot={screen.revisitModel.aroundSnapshot}
            getCandidateStatus={screen.getCandidateStatus}
            isCandidateActive={screen.isCandidateActive}
            isCandidatePlaying={screen.isCandidatePlaying}
            inlinePositionMs={screen.inlinePositionMs}
            inlineDurationMs={screen.inlineDurationMs}
            onTogglePlay={screen.onTogglePlayCandidate}
            onStopPlay={screen.onStopPlayCandidate}
            onSeekStart={screen.onSeekInlineStart}
            onSeek={screen.onSeekInline}
            onSeekCancel={screen.onSeekInlineCancel}
            onOpen={screen.onOpenCandidate}
            onOpenMenu={screen.onOpenCandidateMenu}
            onOpenInActivity={screen.openAroundSnapshotInActivity}
          />
        ) : (
          <>
            <View style={[styles.card, revisitStyles.summaryCard]}>
              <View style={revisitStyles.summaryRow}>
                <View style={revisitStyles.summaryStat}>
                  <Text style={revisitStyles.summaryValue}>{screen.revisitModel.totalEligibleCount}</Text>
                  <Text style={revisitStyles.summaryLabel}>ready now</Text>
                </View>
                <View style={revisitStyles.summaryStat}>
                  <Text style={revisitStyles.summaryValue}>
                    {screen.revisitModel.workspaceOptions.filter((item) => item.included).length}
                  </Text>
                  <Text style={revisitStyles.summaryLabel}>workspaces</Text>
                </View>
                <View style={revisitStyles.summaryStat}>
                  <Text style={revisitStyles.summaryValue}>
                    {screen.revisitModel.sections.find((section) => section.key === "vault")?.totalCount ??
                      screen.revisitModel.sections.find((section) => section.key === "vault")?.items.length ??
                      0}
                  </Text>
                  <Text style={revisitStyles.summaryLabel}>vault</Text>
                </View>
              </View>
            </View>

            <RevisitTuningPanel
              ageBias={screen.ageBias}
              density={screen.density}
              onSetAgeBias={screen.setAgeBias}
              onSetDensity={screen.setDensity}
            />

            <View style={[styles.card, revisitStyles.filterPanel]}>
              <View style={revisitStyles.filterPanelHeader}>
                <Text style={revisitStyles.filterPanelTitle}>Sources</Text>
                {screen.hasSourceOverrides ? (
                  <Pressable
                    style={({ pressed }) => [
                      revisitStyles.utilityButton,
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={screen.resetSourceFilters}
                  >
                    <Text style={revisitStyles.utilityButtonText}>Reset</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={revisitStyles.workspaceFilterList}>
                {screen.workspaceFilterGroups.map(({ workspace, collections }) => (
                  <RevisitWorkspaceFilterRow
                    key={workspace.id}
                    option={workspace}
                    collections={collections}
                    expanded={screen.expandedWorkspaceId === workspace.id}
                    onToggleWorkspace={() =>
                      screen.setWorkspaceIncluded(workspace.id, !workspace.included)
                    }
                    onToggleExpand={() =>
                      screen.setExpandedWorkspaceId((prev) =>
                        prev === workspace.id ? null : workspace.id
                      )
                    }
                    onToggleCollection={(collectionId, included) =>
                      screen.setCollectionIncluded(collectionId, included)
                    }
                  />
                ))}
              </View>

              {screen.hasHiddenItems ? (
                <Pressable
                  style={({ pressed }) => [
                    revisitStyles.hiddenResetRow,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={screen.restoreHiddenCandidates}
                >
                  <Ionicons name="refresh-outline" size={16} color="#9a3412" />
                  <Text style={revisitStyles.hiddenResetText}>
                    Restore hidden ({screen.hiddenCandidateIds.length})
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {screen.revisitModel.totalEligibleCount === 0 ? (
              <View style={[styles.card, revisitStyles.emptyStateCard]}>
                <Text style={styles.cardTitle}>Nothing ready right now</Text>
              </View>
            ) : (
              screen.revisitModel.sections.map((section) => (
                <RevisitSectionBlock
                  key={section.key}
                  section={section}
                  getCandidateStatus={screen.getCandidateStatus}
                  isCandidateActive={screen.isCandidateActive}
                  isCandidatePlaying={screen.isCandidatePlaying}
                  inlinePositionMs={screen.inlinePositionMs}
                  inlineDurationMs={screen.inlineDurationMs}
                  onTogglePlay={screen.onTogglePlayCandidate}
                  onStopPlay={screen.onStopPlayCandidate}
                  onSeekStart={screen.onSeekInlineStart}
                  onSeek={screen.onSeekInline}
                  onSeekCancel={screen.onSeekInlineCancel}
                  onOpen={screen.onOpenCandidate}
                  onOpenMenu={screen.onOpenCandidateMenu}
                  onOpenSection={section.key === "around" ? screen.openAroundSnapshot : undefined}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
