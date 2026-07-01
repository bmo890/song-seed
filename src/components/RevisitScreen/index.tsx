import React, { useState } from "react";
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
import { RevisitSectionBlock } from "./components/RevisitSectionBlock";
import { RevisitCustomizeSheet } from "./components/RevisitCustomizeSheet";

// Maps a section to its "What to surface" tag so the Customize toggles hide it.
const SECTION_TAG: Record<string, string> = {
  pickup: "unfinished",
  forgotten: "seed",
  vault: "vault",
  around: "anniversary",
};

export function RevisitScreen() {
  const screen = useRevisitScreenModel();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useBrowseRootBackHandler({
    onBack: screen.isAroundSnapshotOpen ? screen.closeAroundSnapshot : undefined,
  });

  const dateLabel = new Date(screen.now).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const populatedSections = screen.revisitModel.sections.filter(
    (section) => section.items.length > 0 && screen.tagPrefs[SECTION_TAG[section.key]] !== false
  );
  const shownCount = populatedSections.reduce(
    (sum, section) => sum + Math.min(section.items.length, 2),
    0
  );

  return (
    <SafeAreaView style={revisitStyles.screen}>
      <ScreenHeader
        title={screen.isAroundSnapshotOpen ? "Around This Time" : "Revisit"}
        leftIcon={screen.isAroundSnapshotOpen ? "back" : "hamburger"}
        onLeftPress={screen.isAroundSnapshotOpen ? screen.closeAroundSnapshot : undefined}
        rightElement={
          screen.isAroundSnapshotOpen ? undefined : (
            <Pressable
              style={({ pressed }) => [revisitStyles.headerHelpBtn, pressed ? styles.pressDown : null]}
              onPress={() => setCustomizeOpen(true)}
              hitSlop={6}
              accessibilityLabel="Customize Revisit"
            >
              <Ionicons name="options-outline" size={18} color="#84736f" />
            </Pressable>
          )
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={revisitStyles.scrollContent}>
        {screen.isAroundSnapshotOpen ? (
          <RevisitAroundSnapshotView
            snapshot={screen.revisitModel.aroundSnapshot}
            getCandidateStatus={screen.getCandidateStatus}
            isCandidateActive={screen.isCandidateActive}
            isCandidatePlaying={screen.isCandidatePlaying}
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
            <View style={revisitStyles.pageHeader}>
              <View style={revisitStyles.todayRow}>
                <Text style={revisitStyles.todayEyebrow}>
                  {screen.dailyRefresh ? `Today · ${dateLabel}` : "To revisit"}
                </Text>
                {shownCount > 0 ? (
                  <Text style={revisitStyles.todayCount}>
                    {shownCount} {shownCount === 1 ? "idea" : "ideas"}
                  </Text>
                ) : null}
              </View>
              <Text style={revisitStyles.pageDescription}>
                A daily set of older ideas that newer work has buried: things you left unfinished,
                loose seeds, deep cuts, and work from past years.
              </Text>
            </View>

            {populatedSections.length === 0 ? (
              <Text style={[revisitStyles.sectionEmptyLine, { paddingTop: 16 }]}>
                Nothing to revisit yet — as newer work stacks up, older ideas will resurface here.
              </Text>
            ) : (
              populatedSections.map((section, index) => (
                <React.Fragment key={section.key}>
                  {index > 0 ? <View style={revisitStyles.sectionDivider} /> : null}
                  <RevisitSectionBlock
                    section={section}
                    getCandidateStatus={screen.getCandidateStatus}
                    isCandidateActive={screen.isCandidateActive}
                    isCandidatePlaying={screen.isCandidatePlaying}
                    onTogglePlay={screen.onTogglePlayCandidate}
                    onStopPlay={screen.onStopPlayCandidate}
                    onSeekStart={screen.onSeekInlineStart}
                    onSeek={screen.onSeekInline}
                    onSeekCancel={screen.onSeekInlineCancel}
                    onOpen={screen.onOpenCandidate}
                    onOpenMenu={screen.onOpenCandidateMenu}
                    onOpenSection={section.key === "around" ? screen.openAroundSnapshot : undefined}
                  />
                </React.Fragment>
              ))
            )}
          </>
        )}
      </ScrollView>

      <RevisitCustomizeSheet
        visible={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        groups={screen.workspaceFilterGroups}
        expandedWorkspaceId={screen.expandedWorkspaceId}
        setExpandedWorkspaceId={screen.setExpandedWorkspaceId}
        setWorkspaceIncluded={screen.setWorkspaceIncluded}
        setCollectionIncluded={screen.setCollectionIncluded}
        hasSourceOverrides={screen.hasSourceOverrides}
        resetSourceFilters={screen.resetSourceFilters}
        hasHiddenItems={screen.hasHiddenItems}
        hiddenCount={screen.hiddenCandidateIds.length}
        restoreHiddenCandidates={screen.restoreHiddenCandidates}
        tagPrefs={screen.tagPrefs}
        setTagEnabled={screen.setTagEnabled}
        dailyRefresh={screen.dailyRefresh}
        setDailyRefresh={screen.setDailyRefresh}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
