import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { ScreenHeader } from "../common/ScreenHeader";
import { WaveformMiniPreview } from "../common/WaveformMiniPreview";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { useRevisitStore } from "../../state/useRevisitStore";
import {
  buildRevisitModel,
  formatLastTouchedLabel,
  type RevisitCandidate,
  type RevisitSection,
  type RevisitSourceOption,
} from "../../revisit";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

type SourceChipProps = {
  option: RevisitSourceOption;
  onPress: () => void;
};

function SourceChip({ option, onPress }: SourceChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        localStyles.filterChip,
        option.included ? localStyles.filterChipIncluded : localStyles.filterChipExcluded,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={option.included ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={option.included ? "#9a3412" : "#94a3b8"}
      />
      <Text
        style={[
          localStyles.filterChipText,
          option.included ? localStyles.filterChipTextIncluded : null,
        ]}
        numberOfLines={2}
      >
        {option.label}
      </Text>
      <View style={localStyles.filterChipCount}>
        <Text style={localStyles.filterChipCountText}>{option.count}</Text>
      </View>
    </Pressable>
  );
}

type WorkspaceFilterRowProps = {
  option: RevisitSourceOption;
  collections: RevisitSourceOption[];
  expanded: boolean;
  onToggleWorkspace: () => void;
  onToggleExpand: () => void;
  onToggleCollection: (collectionId: string, included: boolean) => void;
};

function getCollectionLabel(option: RevisitSourceOption) {
  const dividerIndex = option.label.indexOf(" • ");
  if (dividerIndex === -1) return option.label;
  return option.label.slice(dividerIndex + 3);
}

function WorkspaceFilterRow({
  option,
  collections,
  expanded,
  onToggleWorkspace,
  onToggleExpand,
  onToggleCollection,
}: WorkspaceFilterRowProps) {
  const excludedCollectionsCount = collections.filter((item) => !item.included).length;

  return (
    <View
      style={[
        localStyles.workspaceFilterRow,
        option.included ? localStyles.workspaceFilterRowIncluded : null,
      ]}
    >
      <View style={localStyles.workspaceFilterTopRow}>
        <Pressable
          style={({ pressed }) => [
            localStyles.workspaceIncludeToggle,
            option.included ? localStyles.workspaceIncludeToggleIncluded : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onToggleWorkspace}
        >
          <Ionicons
            name={option.included ? "checkmark-circle" : "ellipse-outline"}
            size={18}
            color={option.included ? "#9a3412" : "#94a3b8"}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            localStyles.workspaceFilterMain,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onToggleExpand}
        >
          <View style={localStyles.workspaceFilterCopy}>
            <Text style={localStyles.workspaceFilterTitle}>{option.label}</Text>
            <Text style={styles.cardMeta}>
              {option.count} ideas
              {collections.length > 0 ? ` • ${collections.length} collections` : ""}
              {excludedCollectionsCount > 0 ? ` • ${excludedCollectionsCount} filtered out` : ""}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#94a3b8"
          />
        </Pressable>
      </View>

      {expanded ? (
        <View style={localStyles.workspaceDropdown}>
          {option.included ? (
            collections.length > 0 ? (
              <>
                <Text style={localStyles.dropdownLabel}>Collections</Text>
                <View style={localStyles.filterWrap}>
                  {collections.map((collection) => (
                    <SourceChip
                      key={collection.id}
                      option={{ ...collection, label: getCollectionLabel(collection) }}
                      onPress={() =>
                        onToggleCollection(collection.id, !collection.included)
                      }
                    />
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.cardMeta}>
                This workspace does not have any collections yet.
              </Text>
            )
          ) : (
            <Text style={styles.cardMeta}>
              Include this workspace to filter individual collections.
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

type SectionCardProps = {
  section: RevisitSection;
  now: number;
  onPlay: (candidate: RevisitCandidate) => void;
  onOpen: (candidate: RevisitCandidate) => void;
  onContinue: (candidate: RevisitCandidate) => void;
  onSnooze: (candidate: RevisitCandidate) => void;
  onHide: (candidate: RevisitCandidate) => void;
};

function SectionCard({
  section,
  now,
  onPlay,
  onOpen,
  onContinue,
  onSnooze,
  onHide,
}: SectionCardProps) {
  return (
    <View style={localStyles.sectionWrap}>
      <View style={localStyles.sectionHeader}>
        <View style={localStyles.sectionHeaderCopy}>
          <Text style={localStyles.sectionTitle}>{section.title}</Text>
          <Text style={styles.cardMeta}>{section.subtitle}</Text>
        </View>
        <View style={localStyles.sectionCountPill}>
          <Text style={localStyles.sectionCountPillText}>{section.items.length}</Text>
        </View>
      </View>

      {section.items.length === 0 ? (
        <View style={[styles.card, localStyles.emptyCard]}>
          <Text style={styles.cardTitle}>{section.emptyTitle}</Text>
          <Text style={styles.cardMeta}>{section.emptySubtitle}</Text>
        </View>
      ) : (
        <View style={styles.listContent}>
          {section.items.map(({ candidate, reason }) => (
            <Pressable
              key={`${section.key}:${candidate.key}`}
              style={({ pressed }) => [
                styles.card,
                localStyles.revisitCard,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => onOpen(candidate)}
            >
              <View style={localStyles.revisitCardTopRow}>
                <View style={localStyles.revisitCardTitleBlock}>
                  <View style={localStyles.revisitCardBadgeRow}>
                    <View style={localStyles.kindPill}>
                      <Text style={localStyles.kindPillText}>
                        {candidate.itemKind === "project" ? "Song" : "Clip"}
                      </Text>
                    </View>
                    <Text style={localStyles.reasonText}>{reason}</Text>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {candidate.title}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={2}>
                    {candidate.workspaceTitle} • {candidate.collectionPathLabel}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
              </View>

              <WaveformMiniPreview peaks={candidate.primaryClip.waveformPeaks} bars={36} />

              <View style={localStyles.metaRow}>
                <Text style={localStyles.metaPill}>{formatLastTouchedLabel(candidate.updatedAt, now)}</Text>
                <Text style={localStyles.metaPill}>
                  {candidate.primaryClip.title || "Primary clip"}
                </Text>
              </View>

              <View style={localStyles.actionRow}>
                <ActionChip
                  icon="play"
                  label="Play"
                  onPress={() => onPlay(candidate)}
                />
                <ActionChip
                  icon="open-outline"
                  label="Open"
                  onPress={() => onOpen(candidate)}
                />
                <ActionChip
                  icon="radio-outline"
                  label="Continue"
                  onPress={() => onContinue(candidate)}
                />
                <ActionChip
                  icon="time-outline"
                  label="Snooze"
                  onPress={() => onSnooze(candidate)}
                />
                <ActionChip
                  icon="eye-off-outline"
                  label="Hide"
                  onPress={() => onHide(candidate)}
                />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

type ActionChipProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function ActionChip({ icon, label, onPress }: ActionChipProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        localStyles.actionChip,
        pressed ? styles.pressDown : null,
      ]}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
    >
      <Ionicons name={icon} size={14} color="#7c2d12" />
      <Text style={localStyles.actionChipText}>{label}</Text>
    </Pressable>
  );
}

export function RevisitScreen() {
  useBrowseRootBackHandler();
  const navigation = useNavigation();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);

  const now = useMemo(() => Date.now(), []);
  const workspaces = useStore((state) => state.workspaces);
  const activityEvents = useStore((state) => state.activityEvents);

  const excludedWorkspaceIds = useRevisitStore((state) => state.excludedWorkspaceIds);
  const excludedCollectionIds = useRevisitStore((state) => state.excludedCollectionIds);
  const hiddenCandidateIds = useRevisitStore((state) => state.hiddenCandidateIds);
  const snoozedUntilById = useRevisitStore((state) => state.snoozedUntilById);

  const setWorkspaceIncluded = useRevisitStore((state) => state.setWorkspaceIncluded);
  const setCollectionIncluded = useRevisitStore((state) => state.setCollectionIncluded);
  const resetSourceFilters = useRevisitStore((state) => state.resetSourceFilters);
  const restoreHiddenCandidates = useRevisitStore((state) => state.restoreHiddenCandidates);
  const hideCandidate = useRevisitStore((state) => state.hideCandidate);
  const snoozeCandidate = useRevisitStore((state) => state.snoozeCandidate);
  const clearExpiredSnoozes = useRevisitStore((state) => state.clearExpiredSnoozes);
  const markVaultExposure = useRevisitStore((state) => state.markVaultExposure);

  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    clearExpiredSnoozes();
  }, [clearExpiredSnoozes]);

  const revisitModel = useMemo(
    () => {
      const revisitState = useRevisitStore.getState();
      return buildRevisitModel({
        workspaces,
        activityEvents,
        excludedWorkspaceIds,
        excludedCollectionIds,
        hiddenCandidateIds,
        snoozedUntilById,
        vaultExposureCountById: revisitState.vaultExposureCountById,
        vaultLastSeenAtById: revisitState.vaultLastSeenAtById,
        now,
      });
    },
    [
      activityEvents,
      excludedCollectionIds,
      excludedWorkspaceIds,
      hiddenCandidateIds,
      now,
      snoozedUntilById,
      workspaces,
    ]
  );

  useEffect(() => {
    const vaultSection = revisitModel.sections.find((section) => section.key === "vault");
    const candidateKeys = vaultSection?.items.map((item) => item.candidate.key) ?? [];
    const sessionKey = `vault:${new Date(now).toISOString().slice(0, 10)}`;
    markVaultExposure(candidateKeys, sessionKey, now);
  }, [markVaultExposure, now, revisitModel.sections]);

  const hasSourceOverrides =
    excludedWorkspaceIds.length > 0 || excludedCollectionIds.length > 0;
  const hasHiddenItems = hiddenCandidateIds.length > 0;
  const workspaceFilterGroups = useMemo(
    () =>
      revisitModel.workspaceOptions.map((workspaceOption) => ({
        workspace: workspaceOption,
        collections: revisitModel.collectionOptions.filter(
          (collectionOption) => collectionOption.workspaceId === workspaceOption.id
        ),
      })),
    [revisitModel.collectionOptions, revisitModel.workspaceOptions]
  );

  function syncWorkspaceContext(candidate: RevisitCandidate) {
    const store = useStore.getState();
    if (store.activeWorkspaceId !== candidate.workspaceId) {
      store.setActiveWorkspaceId(candidate.workspaceId);
    }
    store.setSelectedIdeaId(candidate.ideaId);
  }

  function handlePlay(candidate: RevisitCandidate) {
    syncWorkspaceContext(candidate);
    useStore.getState().requestInlineStop();
    useStore
      .getState()
      .setPlayerQueue(
        [{ ideaId: candidate.ideaId, clipId: candidate.primaryClip.id }],
        0,
        true
      );
    navigateRoot("Player");
  }

  function handleOpen(candidate: RevisitCandidate) {
    syncWorkspaceContext(candidate);
    navigateRoot("IdeaDetail", { ideaId: candidate.ideaId });
  }

  function handleContinue(candidate: RevisitCandidate) {
    syncWorkspaceContext(candidate);
    useStore.getState().setRecordingParentClipId(candidate.primaryClip.id);
    useStore.getState().setRecordingIdeaId(candidate.ideaId);
    navigateRoot("Recording");
  }

  function handleSnooze(candidate: RevisitCandidate) {
    Alert.alert("Snooze revisit", "How long should this stay out of the mix?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "2 weeks",
        onPress: () => snoozeCandidate(candidate.key, TWO_WEEKS_MS),
      },
      {
        text: "1 month",
        onPress: () => snoozeCandidate(candidate.key, ONE_MONTH_MS),
      },
    ]);
  }

  function handleHide(candidate: RevisitCandidate) {
    Alert.alert(
      "Hide from revisit?",
      "This item will stay out of revisit suggestions until you restore hidden items.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Hide",
          style: "destructive",
          onPress: () => hideCandidate(candidate.key),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Revisit" leftIcon="hamburger" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={localStyles.scrollContent}
      >
        <View style={[styles.card, localStyles.heroCard]}>
          <Text style={localStyles.heroEyebrow}>Worth another listen</Text>
          <Text style={localStyles.heroTitle}>Creative Revisit System</Text>
          <Text style={styles.cardMeta}>
            Revisit leans mostly intentional, with a small vault section for
            serendipitous old finds. Nothing here is overdue. It is just ready again.
          </Text>
          <View style={localStyles.heroStatsRow}>
            <View style={localStyles.heroStat}>
              <Text style={localStyles.heroStatValue}>{revisitModel.totalEligibleCount}</Text>
              <Text style={localStyles.heroStatLabel}>eligible ideas</Text>
            </View>
            <View style={localStyles.heroStatDivider} />
            <View style={localStyles.heroStat}>
              <Text style={localStyles.heroStatValue}>
                {revisitModel.workspaceOptions.filter((item) => item.included).length}
              </Text>
              <Text style={localStyles.heroStatLabel}>active workspaces</Text>
            </View>
            <View style={localStyles.heroStatDivider} />
            <View style={localStyles.heroStat}>
              <Text style={localStyles.heroStatValue}>
                {revisitModel.sections.find((section) => section.key === "vault")?.items.length ?? 0}
              </Text>
              <Text style={localStyles.heroStatLabel}>vault picks today</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, localStyles.filterPanel]}>
          <View style={localStyles.filterPanelHeader}>
            <View style={localStyles.filterPanelCopy}>
              <Text style={styles.cardTitle}>Choose what can surface here</Text>
              <Text style={styles.cardMeta}>
                All sources are included by default. Open a workspace row if you
                want to narrow it down to specific collections.
              </Text>
            </View>
            {hasSourceOverrides ? (
              <Pressable
                style={({ pressed }) => [
                  localStyles.utilityButton,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={resetSourceFilters}
              >
                <Text style={localStyles.utilityButtonText}>Reset filters</Text>
              </Pressable>
            ) : null}
          </View>

          <Text style={localStyles.filterGroupLabel}>Workspaces</Text>
          <View style={localStyles.workspaceFilterList}>
            {workspaceFilterGroups.map(({ workspace, collections }) => (
              <WorkspaceFilterRow
                key={workspace.id}
                option={workspace}
                collections={collections}
                expanded={expandedWorkspaceId === workspace.id}
                onToggleWorkspace={() =>
                  setWorkspaceIncluded(workspace.id, !workspace.included)
                }
                onToggleExpand={() =>
                  setExpandedWorkspaceId((prev) =>
                    prev === workspace.id ? null : workspace.id
                  )
                }
                onToggleCollection={(collectionId, included) =>
                  setCollectionIncluded(collectionId, included)
                }
              />
            ))}
          </View>

          {hasHiddenItems ? (
            <Pressable
              style={({ pressed }) => [
                localStyles.hiddenResetRow,
                pressed ? styles.pressDown : null,
              ]}
              onPress={restoreHiddenCandidates}
            >
              <Ionicons name="refresh-outline" size={16} color="#9a3412" />
              <Text style={localStyles.hiddenResetText}>
                Restore hidden revisit items ({hiddenCandidateIds.length})
              </Text>
            </Pressable>
          ) : null}
        </View>

        {revisitModel.totalEligibleCount === 0 ? (
          <View style={[styles.card, localStyles.emptyStateCard]}>
            <Text style={styles.cardTitle}>Revisit is quiet right now</Text>
            <Text style={styles.cardMeta}>
              There is not enough eligible audio after your current filters,
              hidden items, and snoozes. Try restoring sources or giving a few
              more ideas some time to age.
            </Text>
          </View>
        ) : (
          revisitModel.sections.map((section) => (
            <SectionCard
              key={section.key}
              section={section}
              now={now}
              onPlay={handlePlay}
              onOpen={handleOpen}
              onContinue={handleContinue}
              onSnooze={handleSnooze}
              onHide={handleHide}
            />
          ))
        )}
      </ScrollView>

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 120,
    gap: 14,
  },
  heroCard: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#c2410c",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: "#7c2d12",
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heroStat: {
    flex: 1,
    gap: 2,
  },
  heroStatDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: "#fed7aa",
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#7c2d12",
  },
  heroStatLabel: {
    fontSize: 12,
    color: "#9a3412",
    fontWeight: "600",
  },
  filterPanel: {
    gap: 12,
  },
  filterPanelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  filterPanelCopy: {
    flex: 1,
    gap: 4,
  },
  utilityButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fdba74",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  utilityButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9a3412",
  },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7c2d12",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  filterWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  filterChipIncluded: {
    backgroundColor: "#fff7ed",
    borderColor: "#fdba74",
  },
  filterChipExcluded: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
  },
  filterChipText: {
    maxWidth: 220,
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  filterChipTextIncluded: {
    color: "#7c2d12",
  },
  filterChipCount: {
    minWidth: 22,
    borderRadius: 11,
    backgroundColor: "#ffffff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  workspaceFilterList: {
    gap: 8,
  },
  workspaceFilterRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    padding: 10,
    gap: 10,
  },
  workspaceFilterRowIncluded: {
    borderColor: "#fdba74",
    backgroundColor: "#fffaf4",
  },
  workspaceFilterTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  workspaceIncludeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  workspaceIncludeToggleIncluded: {
    borderColor: "#fdba74",
    backgroundColor: "#fff7ed",
  },
  workspaceFilterMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  workspaceFilterCopy: {
    flex: 1,
    gap: 2,
  },
  workspaceFilterTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  workspaceDropdown: {
    marginLeft: 44,
    gap: 8,
  },
  dropdownLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9a3412",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  hiddenResetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingTop: 2,
  },
  hiddenResetText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9a3412",
  },
  emptyStateCard: {
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionCountPill: {
    minWidth: 32,
    borderRadius: 16,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCountPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9a3412",
  },
  emptyCard: {
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
  },
  revisitCard: {
    gap: 10,
  },
  revisitCardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  revisitCardTitleBlock: {
    flex: 1,
    gap: 4,
  },
  revisitCardBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  kindPill: {
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  reasonText: {
    fontSize: 12,
    color: "#9a3412",
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#9a3412",
  },
});
