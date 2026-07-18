import { useEffect, useMemo, useRef, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { personalWorkspaces } from "../../../domain/workspaceVisibility";
import { useRevisitStore } from "../../../state/useRevisitStore";
import { useShelfStore } from "../../../state/useShelfStore";
import { toast } from "../../common/toastStore";
import { haptic } from "../../../design/haptics";
import { useMiniPlayerContext } from "../../../hooks/FullPlayerProvider";
import {
  buildRevisitModel,
  type RevisitCandidate,
} from "../../../domain/revisit";
import { openCollectionFromContext, openShelf } from "../../../navigation";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export function useRevisitScreenModel() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const rootNavigation = navigation.getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);

  const now = useMemo(() => Date.now(), []);
  const allWorkspaces = useStore((state) => state.workspaces);
  // Revisit resurfaces YOUR old work — a bandmate's demo must never appear as
  // "your forgotten idea", so received packages are excluded.
  const workspaces = useMemo(() => personalWorkspaces(allWorkspaces), [allWorkspaces]);
  const primaryWorkspaceId = useStore((state) => state.primaryWorkspaceId);
  const primaryCollectionIdByWorkspace = useStore((state) => state.primaryCollectionIdByWorkspace);
  const activityEvents = useStore((state) => state.activityEvents);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const setActiveWorkspaceId = useStore((state) => state.setActiveWorkspaceId);
  const setSelectedIdeaId = useStore((state) => state.setSelectedIdeaId);
  const inlinePlayer = useMiniPlayerContext();
  const resetInlineRef = useRef(inlinePlayer.resetInlinePlayer);
  const inlineTarget = useStore((state) => state.inlineTarget);
  const isInlinePlaying = useStore((state) => state.inlineIsPlaying);

  const excludedWorkspaceIds = useRevisitStore((state) => state.excludedWorkspaceIds);
  const excludedCollectionIds = useRevisitStore((state) => state.excludedCollectionIds);
  const hiddenCandidateIds = useRevisitStore((state) => state.hiddenCandidateIds);
  const snoozedUntilById = useRevisitStore((state) => state.snoozedUntilById);
  const tagPrefs = useRevisitStore((state) => state.tagPrefs);
  const dailyRefresh = useRevisitStore((state) => state.dailyRefresh);
  const setTagEnabled = useRevisitStore((state) => state.setTagEnabled);
  const setDailyRefresh = useRevisitStore((state) => state.setDailyRefresh);
  const setWorkspaceIncluded = useRevisitStore((state) => state.setWorkspaceIncluded);
  const setCollectionIncluded = useRevisitStore((state) => state.setCollectionIncluded);
  const resetSourceFilters = useRevisitStore((state) => state.resetSourceFilters);
  const restoreHiddenCandidates = useRevisitStore((state) => state.restoreHiddenCandidates);
  const hideCandidate = useRevisitStore((state) => state.hideCandidate);
  const clearExpiredSnoozes = useRevisitStore((state) => state.clearExpiredSnoozes);
  const markVaultExposure = useRevisitStore((state) => state.markVaultExposure);
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<string | null>(null);
  const [isAroundSnapshotOpen, setIsAroundSnapshotOpen] = useState(false);

  useEffect(() => {
    clearExpiredSnoozes();
  }, [clearExpiredSnoozes]);

  useEffect(() => {
    resetInlineRef.current = inlinePlayer.resetInlinePlayer;
  }, [inlinePlayer.resetInlinePlayer]);

  useEffect(() => {
    if (isFocused) return;
    void resetInlineRef.current();
  }, [isFocused]);

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
      enabledTags: tagPrefs,
      dailyRefresh,
      now,
    });
  }, [
    activityEvents,
    dailyRefresh,
    excludedCollectionIds,
    excludedWorkspaceIds,
    hiddenCandidateIds,
    now,
    snoozedUntilById,
    tagPrefs,
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
        workspace: {
          ...workspaceOption,
          isPrimary: workspaceOption.id === primaryWorkspaceId,
        },
        collections: revisitModel.collectionOptions
          .filter((collectionOption) => collectionOption.workspaceId === workspaceOption.id)
          .map((collectionOption) => ({
            ...collectionOption,
            isPrimary:
              primaryCollectionIdByWorkspace[workspaceOption.id] === collectionOption.id,
          })),
      })),
    [
      revisitModel.collectionOptions,
      revisitModel.workspaceOptions,
      primaryWorkspaceId,
      primaryCollectionIdByWorkspace,
    ]
  );

  function syncWorkspaceContext(candidate: RevisitCandidate) {
    if (activeWorkspaceId !== candidate.workspaceId) {
      setActiveWorkspaceId(candidate.workspaceId);
    }
    setSelectedIdeaId(candidate.ideaId);
  }

  // Mirrors the collection card's tap: a raw clip opens the full Player to
  // listen; a project opens its song page. Same destinations, same behavior.
  function openCandidate(candidate: RevisitCandidate) {
    void inlinePlayer.resetInlinePlayer();
    syncWorkspaceContext(candidate);
    if (candidate.itemKind === "clip") {
      useStore
        .getState()
        .setPlayerQueueForScreen([{ ideaId: candidate.ideaId, clipId: candidate.primaryClip.id }], 0);
      return;
    }
    navigateRoot("IdeaDetail", { ideaId: candidate.ideaId });
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
      backLabel: "Revisit",
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

  function confirmHideCandidate(candidate: RevisitCandidate) {
    AppAlert.destructive(
      "Hide from Revisit?",
      "This idea won't resurface in Revisit again. It stays right where it is in your collection — you can bring it back anytime from Customize → Restore hidden.",
      () => hideCandidate(candidate.key),
      { confirmLabel: "Okay", icon: "eye-off-outline" }
    );
  }

  function openCandidateMenu(candidate: RevisitCandidate) {
    AppAlert.custom(candidate.title, undefined, [
      {
        label: "Set aside",
        style: "default",
        icon: "file-tray-outline",
        description: "Keep it on the Shelf for 7 days.",
        onPress: () => {
          useShelfStore.getState().setAside([{ kind: "idea", id: candidate.ideaId }]);
          haptic.success();
          toast("On the shelf for 7 days", "file-tray-outline", {
            action: { label: "View shelf", onPress: () => openShelf(navigation) },
          });
        },
      },
      {
        label: "Hide",
        style: "destructive",
        icon: "eye-off-outline",
        onPress: () => confirmHideCandidate(candidate),
      },
      {
        label: "Cancel",
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
    const target = inlineTarget;
    return target?.ideaId === candidate.ideaId && target.clipId === candidate.primaryClip.id;
  }

  function isCandidatePlaying(candidate: RevisitCandidate) {
    return isCandidateActive(candidate) && isInlinePlaying;
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
    tagPrefs,
    dailyRefresh,
    setTagEnabled,
    setDailyRefresh,
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
    onViewCandidateInCollection: viewCandidateInCollection,
    openAroundSnapshot: () => setIsAroundSnapshotOpen(true),
    closeAroundSnapshot: () => setIsAroundSnapshotOpen(false),
    openAroundSnapshotInActivity,
  };
}
