import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { useRevisitStore } from "../../../state/useRevisitStore";
import { useInlinePlayer } from "../../../hooks/useInlinePlayer";
import {
  buildRevisitModel,
  type RevisitCandidate,
} from "../../../revisit";
import { openCollectionFromContext } from "../../../navigation";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function useRevisitScreenModel() {
  const navigation = useNavigation<any>();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);

  const now = useMemo(() => Date.now(), []);
  const workspaces = useStore((state) => state.workspaces);
  const activityEvents = useStore((state) => state.activityEvents);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const setSelectedIdeaId = useStore((state) => state.setSelectedIdeaId);
  const inlinePlayer = useInlinePlayer();

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
  const [isAroundSnapshotOpen, setIsAroundSnapshotOpen] = useState(false);

  useEffect(() => {
    clearExpiredSnoozes();
  }, [clearExpiredSnoozes]);

  const revisitModel = useMemo(() => {
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
  }, [
    activityEvents,
    excludedCollectionIds,
    excludedWorkspaceIds,
    hiddenCandidateIds,
    now,
    snoozedUntilById,
    workspaces,
  ]);

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
    if (activeWorkspaceId !== candidate.workspaceId) {
      setActiveWorkspaceId(candidate.workspaceId);
    }
    setSelectedIdeaId(candidate.ideaId);
  }

  function openCandidate(candidate: RevisitCandidate) {
    void inlinePlayer.resetInlinePlayer();
    syncWorkspaceContext(candidate);
    navigateRoot("IdeaDetail", { ideaId: candidate.ideaId });
  }

  function continueCandidate(candidate: RevisitCandidate) {
    void inlinePlayer.resetInlinePlayer();
    syncWorkspaceContext(candidate);
    useStore.getState().setRecordingParentClipId(candidate.primaryClip.id);
    useStore.getState().setRecordingIdeaId(candidate.ideaId);
    navigateRoot("Recording");
  }

  function viewCandidateInCollection(candidate: RevisitCandidate) {
    void inlinePlayer.resetInlinePlayer();
    if (activeWorkspaceId !== candidate.workspaceId) {
      setActiveWorkspaceId(candidate.workspaceId);
    }
    openCollectionFromContext(navigation, {
      collectionId: candidate.collectionId,
      workspaceId: candidate.workspaceId,
      focusIdeaId: candidate.ideaId,
      focusToken: Date.now(),
      source: "detail",
    });
  }

  function toggleCandidatePlay(candidate: RevisitCandidate) {
    void inlinePlayer.toggleInlinePlayback(candidate.ideaId, candidate.primaryClip);
  }

  function stopCandidatePlay() {
    void inlinePlayer.resetInlinePlayer();
  }

  function openAroundSnapshotInActivity() {
    navigateRoot("Activity", {
      year: revisitModel.aroundSnapshot.year,
      rangeStartTs: revisitModel.aroundSnapshot.startTs,
      rangeEndTs: revisitModel.aroundSnapshot.endTs,
    });
  }

  function openCandidateMenu(candidate: RevisitCandidate) {
    Alert.alert(candidate.title, undefined, [
      {
        text: "Open",
        onPress: () => openCandidate(candidate),
      },
      {
        text: "Continue Recording",
        onPress: () => continueCandidate(candidate),
      },
      {
        text: "View in Collection",
        onPress: () => viewCandidateInCollection(candidate),
      },
      {
        text: "Snooze 2 Weeks",
        onPress: () => snoozeCandidate(candidate.key, TWO_WEEKS_MS),
      },
      {
        text: "Snooze 1 Month",
        onPress: () => snoozeCandidate(candidate.key, ONE_MONTH_MS),
      },
      {
        text: "Hide",
        style: "destructive",
        onPress: () => hideCandidate(candidate.key),
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]);
  }

  function getCandidateIdea(candidate: RevisitCandidate) {
    const workspace = workspaces.find((item) => item.id === candidate.workspaceId);
    return workspace?.ideas.find((idea) => idea.id === candidate.ideaId) ?? null;
  }

  function getCandidateStatus(candidate: RevisitCandidate) {
    const idea = getCandidateIdea(candidate);
    return idea?.kind === "project" ? idea.status : null;
  }

  function isCandidateActive(candidate: RevisitCandidate) {
    const target = inlinePlayer.inlineTarget;
    return target?.ideaId === candidate.ideaId && target.clipId === candidate.primaryClip.id;
  }

  function isCandidatePlaying(candidate: RevisitCandidate) {
    return isCandidateActive(candidate) && inlinePlayer.isInlinePlaying;
  }

  return {
    now,
    isAroundSnapshotOpen,
    revisitModel,
    hasSourceOverrides,
    hasHiddenItems,
    workspaceFilterGroups,
    expandedWorkspaceId,
    setExpandedWorkspaceId,
    setWorkspaceIncluded,
    setCollectionIncluded,
    resetSourceFilters,
    restoreHiddenCandidates,
    hiddenCandidateIds,
    inlinePositionMs: inlinePlayer.inlinePosition,
    inlineDurationMs: inlinePlayer.inlineDuration,
    getCandidateStatus,
    isCandidateActive,
    isCandidatePlaying,
    onTogglePlayCandidate: toggleCandidatePlay,
    onStopPlayCandidate: stopCandidatePlay,
    onSeekInlineStart: () => {
      void inlinePlayer.beginInlineScrub();
    },
    onSeekInline: (ms: number) => {
      void inlinePlayer.endInlineScrub(ms);
    },
    onSeekInlineCancel: () => {
      void inlinePlayer.cancelInlineScrub();
    },
    onOpenCandidate: openCandidate,
    onOpenCandidateMenu: openCandidateMenu,
    openAroundSnapshot: () => setIsAroundSnapshotOpen(true),
    closeAroundSnapshot: () => setIsAroundSnapshotOpen(false),
    openAroundSnapshotInActivity,
  };
}
