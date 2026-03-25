import { useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../../../state/useStore";
import { getFloatingActionDockBottomOffset, getFloatingActionDockContentClearance } from "../../common/FloatingActionDock";
import type { IdeaStatus } from "../../../types";
import type { SongTimelineSortDirection, SongTimelineSortMetric } from "../../../clipGraph";
import type { SongClipTagFilter } from "../songClipControls";

export function useSongScreenModel() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const route = useRoute<any>();
  const routeIdeaId = route.params?.ideaId;
  const startInEdit = !!route.params?.startInEdit;
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
  const workspaces = useStore((s) => s.workspaces);
  const navigation = useNavigation();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);

  const selectedIdea = useMemo(() => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    return ws?.ideas.find((i) => i.id === selectedIdeaId);
  }, [workspaces, activeWorkspaceId, selectedIdeaId]);
  const songClips = useMemo(() => selectedIdea?.clips ?? [], [selectedIdea?.clips]);
  const songClipTitles = useMemo(() => songClips.map((clip) => clip.title), [songClips]);
  const isProject = selectedIdea?.kind === "project";

  const [isEditMode, setIsEditMode] = useState(false);
  const [clipViewMode, setClipViewMode] = useState<"timeline" | "evolution">("evolution");
  const [timelineSortMetric, setTimelineSortMetric] = useState<SongTimelineSortMetric>("created");
  const [timelineSortDirection, setTimelineSortDirection] = useState<SongTimelineSortDirection>("desc");
  const [timelineMainTakesOnly, setTimelineMainTakesOnly] = useState(false);
  const [clipTagFilter, setClipTagFilter] = useState<SongClipTagFilter>("all");
  const [songTab, setSongTab] = useState<"takes" | "lyrics" | "notes">("takes");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftStatus, setDraftStatus] = useState<IdeaStatus>("seed");
  const [draftCompletion, setDraftCompletion] = useState(0);
  const [isIdeasSticky, setIsIdeasSticky] = useState(false);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const floatingBaseBottom = getFloatingActionDockBottomOffset(insets.bottom);
  const songPageBaseBottomPadding = 24 + Math.max(insets.bottom, 16);
  const clipListFooterSpacerHeight = getFloatingActionDockContentClearance(insets.bottom);
  const clipSelectionFooterSpacerHeight = selectionDockHeight + 24 + Math.max(insets.bottom, 12);

  useEffect(() => {
    if (routeIdeaId && routeIdeaId !== selectedIdeaId) {
      setSelectedIdeaId(routeIdeaId);
    }
  }, [routeIdeaId, selectedIdeaId, setSelectedIdeaId]);

  useEffect(() => {
    if (selectedIdea?.isDraft || startInEdit) {
      setIsEditMode(true);
    } else {
      setIsEditMode(false);
    }
  }, [selectedIdea?.id, selectedIdea?.isDraft, startInEdit]);

  useEffect(() => {
    if (isEditMode && selectedIdea) {
      setDraftTitle(selectedIdea.title);
      setDraftStatus(selectedIdea.status);
      setDraftCompletion(selectedIdea.completionPct);
    }
  }, [isEditMode, selectedIdea]);

  useEffect(() => {
    setSongTab("takes");
    setClipTagFilter("all");
    setTimelineSortMetric("created");
    setTimelineSortDirection("desc");
    setTimelineMainTakesOnly(false);
  }, [selectedIdea?.id]);

  useEffect(() => {
    if (songTab !== "takes") {
      setIsIdeasSticky(false);
    }
  }, [songTab]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  return {
    isFocused,
    routeIdeaId,
    selectedIdeaId,
    activeWorkspaceId,
    workspaces,
    selectedIdea,
    songClips,
    songClipTitles,
    isProject,
    navigation,
    navigateRoot,
    isEditMode,
    setIsEditMode,
    clipViewMode,
    setClipViewMode,
    timelineSortMetric,
    setTimelineSortMetric,
    timelineSortDirection,
    setTimelineSortDirection,
    timelineMainTakesOnly,
    setTimelineMainTakesOnly,
    clipTagFilter,
    setClipTagFilter,
    songTab,
    setSongTab,
    draftTitle,
    setDraftTitle,
    draftStatus,
    setDraftStatus,
    draftCompletion,
    setDraftCompletion,
    isIdeasSticky,
    setIsIdeasSticky,
    selectionDockHeight,
    setSelectionDockHeight,
    floatingBaseBottom,
    songPageBaseBottomPadding,
    clipListFooterSpacerHeight,
    clipSelectionFooterSpacerHeight,
    undoTimerRef,
  };
}
