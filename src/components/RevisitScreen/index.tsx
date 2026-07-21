import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../common/ScreenHeader";
import { styles } from "../../styles";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";
import { useRevisitScreenModel } from "./hooks/useRevisitScreenModel";
import { revisitStyles } from "./styles";
import { RevisitAroundSnapshotView } from "./components/RevisitAroundSnapshotView";
import { RevisitSectionBlock } from "./components/RevisitSectionBlock";
import { RevisitCustomizeSheet } from "./components/RevisitCustomizeSheet";
import { colors } from "../../design/tokens";
import { useTranslation } from "react-i18next";
import { useLocale } from "../../i18n";

// Maps a section to its "What to surface" tag so the Customize toggles hide it.
const SECTION_TAG: Record<string, string> = {
  pickup: "unfinished",
  forgotten: "seed",
  vault: "vault",
  around: "anniversary",
};

export function RevisitScreen() {
  const { t } = useTranslation();
  const { formatLocale } = useLocale();
  const screen = useRevisitScreenModel();
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useBrowseRootBackHandler({
    onBack: screen.isAroundSnapshotOpen ? screen.closeAroundSnapshot : undefined,
  });

  const dateLabel = new Date(screen.now).toLocaleDateString(formatLocale, {
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
        title={t(screen.isAroundSnapshotOpen ? "revisit.aroundTitle" : "revisit.title")}
        leftIcon={screen.isAroundSnapshotOpen ? "back" : "hamburger"}
        onLeftPress={screen.isAroundSnapshotOpen ? screen.closeAroundSnapshot : undefined}
        rightElement={
          screen.isAroundSnapshotOpen ? undefined : (
            <Pressable
              style={({ pressed }) => [revisitStyles.headerHelpBtn, pressed ? styles.pressDown : null]}
              onPress={() => setCustomizeOpen(true)}
              hitSlop={6}
              accessibilityLabel={t("revisit.customize")}
            >
              <Ionicons name="options-outline" size={18} color={colors.textSecondary} />
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
            onViewInCollection={screen.onViewCandidateInCollection}
            onOpenInActivity={screen.openAroundSnapshotInActivity}
          />
        ) : (
          <>
            <View style={revisitStyles.pageHeader}>
              <View style={revisitStyles.todayRow}>
                <Text style={revisitStyles.todayEyebrow}>
                  {screen.dailyRefresh ? t("revisit.today", { date: dateLabel }) : t("revisit.toRevisit")}
                </Text>
                {shownCount > 0 ? (
                  <Text style={revisitStyles.todayCount}>
                    {t("revisit.ideaCount", { count: shownCount })}
                  </Text>
                ) : null}
              </View>
              <Text style={revisitStyles.pageDescription}>
                {t("revisit.description")}
              </Text>
            </View>

            {populatedSections.length === 0 ? (
              <Text style={[revisitStyles.sectionEmptyLine, { paddingTop: 16 }]}>
                {t("revisit.empty")}
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
                    onViewInCollection={screen.onViewCandidateInCollection}
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

    </SafeAreaView>
  );
}
