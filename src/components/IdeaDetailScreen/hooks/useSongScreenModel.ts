import { useEffect, useMemo, useRef, useState } from "react";
import { useIsFocused, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue } from "react-native-reanimated";
import { useStore } from "../../../state/useStore";
import { selectIdeaById } from "../../../state/librarySelectors";
import { getFloatingActionDockBottomOffset, getFloatingActionDockContentClearance } from "../../common/FloatingActionDock";
import type { IdeaStatus } from "../../../types";
import type { SongTimelineSortDirection, SongTimelineSortMetric } from "../../../domain/clipGraph";
import type { SongClipGroupFilter, SongClipTagFilter } from "../songClipControls";

export function useSongScreenModel() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const route = useRoute<any>();
  const routeIdeaId = route.params?.ideaId;
  const startInEdit = !!route.params?.startInEdit;
  const initialSongTab = route.params?.initialSongTab as
    | "takes"
    | "lyrics"
    | "chart"
    | "notes"
    | undefined;
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setSelectedIdeaId = useStore((s) => s.setSelectedIdeaId);
  // The page subscribes to ITS idea, not the library: `selectIdeaById` hands back
  // the same object while the idea is untouched (index cached per library array),
  // so a write elsewhere no longer re-renders the 22 context consumers here.
  // Active workspace first, then any workspace — ideas opened from a Received
  // package live outside the active one.
  const selectedIdea = useStore((s) =>
    selectedIdeaId ? selectIdeaById(s.workspaces, selectedIdeaId, activeWorkspaceId) ?? undefined : undefined
  );
  const navigation = useNavigation();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (routeName: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(routeName as never, params as never);

  const songClips = useMemo(() => selectedIdea?.clips ?? [], [selectedIdea?.clips]);
  const songClipTitles = useMemo(() => songClips.map((clip) => clip.title), [songClips]);
  const isProject = selectedIdea?.kind === "project";

  const [isEditMode, setIsEditMode] = useState(false);
  const [clipViewMode, setClipViewMode] = useState<"timeline" | "evolution">("evolution");
  const [timelineSortMetric, setTimelineSortMetric] = useState<SongTimelineSortMetric>("created");
  const [timelineSortDirection, setTimelineSortDirection] = useState<SongTimelineSortDirection>("desc");
  const [timelineMainTakesOnly, setTimelineMainTakesOnly] = useState(false);
  const [clipTagFilter, setClipTagFilter] = useState<SongClipTagFilter>([]);
  const [clipGroupFilter, setClipGroupFilter] = useState<SongClipGroupFilter>([]);
  const [clipBookmarkedOnly, setClipBookmarkedOnly] = useState(false);
  const [songTab, setSongTab] = useState<"takes" | "lyrics" | "chart" | "notes">(
    initialSongTab ?? "takes"
  );
  // A later navigate to this (already-mounted) screen can request a tab — the
  // player's door CTAs land on Lyrics/Chart this way.
  useEffect(() => {
    if (initialSongTab) setSongTab(initialSongTab);
  }, [initialSongTab, routeIdeaId]);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftStatus, setDraftStatus] = useState<IdeaStatus>("seed");
  const [draftCompletion, setDraftCompletion] = useState(0);
  // Continuous scroll offset of the active tab's scroll view, shared with the
  // collapsing header overlay. Driven on the UI thread by the animated scroll
  // handler. `collapsibleHeaderHeight` is the measured height of the part of the
  // header that scrolls away (title + tabs + primary strip) — the translate clamp
  // and the nav compact-title fade both key off it.
  const scrollY = useSharedValue(0);
  const collapsibleHeaderHeight = useSharedValue(0);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const importBannerHeight = useStore((s) => s.importBannerHeight);
  const dockLayout = { playerDockHeight, importBannerHeight };
  const floatingBaseBottom = getFloatingActionDockBottomOffset(insets.bottom, dockLayout);
  const songPageBaseBottomPadding = 24 + Math.max(insets.bottom, 16);
  // Just enough to scroll the last clip clear of the record button. The clearance already
  // accounts for the media dock and import bar (the dock rides above them), so adding
  // playerDockHeight again here double-counted it.
  const clipListFooterSpacerHeight = getFloatingActionDockContentClearance(insets.bottom, dockLayout);
  const clipSelectionFooterSpacerHeight = selectionDockHeight + 24 + Math.max(insets.bottom, 12) + playerDockHeight;

  useEffect(() => {
    if (routeIdeaId && routeIdeaId !== selectedIdeaId) {
      // Only re-select an idea that still exists: after a draft is discarded
      // the route param outlives the idea, and writing it back would point the
      // store at a deleted id (2026-09-10).
      const s = useStore.getState();
      const exists = s.workspaces.some((ws) => ws.ideas.some((idea) => idea.id === routeIdeaId));
      if (exists) setSelectedIdeaId(routeIdeaId);
    }
  }, [routeIdeaId, selectedIdeaId, setSelectedIdeaId]);

  useEffect(() => {
    if (selectedIdea?.isDraft || startInEdit) {
      setIsEditMode(true);
    } else {
      setIsEditMode(false);
    }
  }, [selectedIdea?.id, selectedIdea?.isDraft, startInEdit]);

  // Seed the edit sheet when it OPENS (or the idea changes underneath it), not on
  // every write to the idea: a background write while typing used to overwrite
  // the draft title and stage.
  const selectedIdeaRef = useRef(selectedIdea);
  selectedIdeaRef.current = selectedIdea;
  useEffect(() => {
    const idea = selectedIdeaRef.current;
    if (isEditMode && idea) {
      setDraftTitle(idea.title);
      setDraftStatus(idea.status);
      setDraftCompletion(idea.completionPct);
    }
  }, [isEditMode, selectedIdea?.id]);

  // Per-idea view state resets when the screen moves to ANOTHER idea. On first
  // mount the initial state already holds it (including `initialSongTab`, which
  // this reset used to override); functional setters keep an already-empty
  // filter's identity so the reset doesn't cost a second render.
  const resetForIdeaRef = useRef(selectedIdea?.id);
  useEffect(() => {
    if (resetForIdeaRef.current === selectedIdea?.id) return;
    resetForIdeaRef.current = selectedIdea?.id;
    setSongTab("takes");
    setClipTagFilter((prev) => (prev.length === 0 ? prev : []));
    setClipGroupFilter((prev) => (prev.length === 0 ? prev : []));
    setClipBookmarkedOnly(false);
    setTimelineSortMetric("created");
    setTimelineSortDirection("desc");
    setTimelineMainTakesOnly(false);
    scrollY.value = 0;
  }, [selectedIdea?.id, scrollY]);

  useEffect(() => {
    // Leaving the Takes tab re-expands the header (no list to scroll there).
    if (songTab !== "takes") {
      scrollY.value = 0;
    }
  }, [songTab, scrollY]);

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
    clipGroupFilter,
    setClipGroupFilter,
    clipBookmarkedOnly,
    setClipBookmarkedOnly,
    songTab,
    setSongTab,
    draftTitle,
    setDraftTitle,
    draftStatus,
    setDraftStatus,
    draftCompletion,
    setDraftCompletion,
    scrollY,
    collapsibleHeaderHeight,
    selectionDockHeight,
    setSelectionDockHeight,
    floatingBaseBottom,
    songPageBaseBottomPadding,
    clipListFooterSpacerHeight,
    clipSelectionFooterSpacerHeight,
    undoTimerRef,
  };
}
