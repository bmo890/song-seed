import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { ClipActionsSheet } from "../modals/ClipActionsSheet";
import { useStore } from "../../state/useStore";
import { type ClipVersion } from "../../types";
import {
  buildEvolutionListRows,
  buildTimelineEntries,
  type EvolutionListClipEntry,
  type SongTimelineSortDirection,
  type SongTimelineSortMetric,
  type TimelineClipEntry,
} from "../../clipGraph";
import { fmtDuration, formatDate } from "../../utils";
import { useInlinePlayer } from "../../hooks/useInlinePlayer";
import type { SongClipTagFilter } from "./songClipControls";
import { type ClipCardSharedProps } from "./ClipCard";
import { EvolutionList } from "./EvolutionList";
import { TimelineList } from "./TimelineList";

type ClipListProps = {
  isEditMode: boolean;
  footerSpacerHeight?: number;
  viewMode: "timeline" | "evolution";
  setViewMode: (mode: "timeline" | "evolution") => void;
  timelineSortMetric: SongTimelineSortMetric;
  setTimelineSortMetric: (metric: SongTimelineSortMetric) => void;
  timelineSortDirection: SongTimelineSortDirection;
  setTimelineSortDirection: (direction: SongTimelineSortDirection) => void;
  timelineMainTakesOnly: boolean;
  setTimelineMainTakesOnly: (value: boolean) => void;
  clipTagFilter: SongClipTagFilter;
  setClipTagFilter: (filter: SongClipTagFilter) => void;
  summaryContent?: ReactNode;
  onIdeasStickyChange?: (isSticky: boolean) => void;
  isParentPicking: boolean;
  parentPickSourceClipIds: string[];
  parentPickInvalidTargetIds: string[];
  onStartSetParent: (clipIds: string[]) => void;
  onMakeRoot: (clipIds: string[]) => void;
  onPickParentTarget: (clipId: string) => void;
};

export function ClipList({
  isEditMode,
  footerSpacerHeight = 28,
  viewMode,
  setViewMode,
  timelineSortMetric,
  setTimelineSortMetric,
  timelineSortDirection,
  setTimelineSortDirection,
  timelineMainTakesOnly,
  setTimelineMainTakesOnly,
  clipTagFilter,
  setClipTagFilter,
  summaryContent,
  onIdeasStickyChange,
  isParentPicking,
  parentPickSourceClipIds,
  parentPickInvalidTargetIds,
  onStartSetParent,
  onMakeRoot,
  onPickParentTarget,
}: ClipListProps) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const inlinePlayer = useInlinePlayer();
  const [expandedLineageIds, setExpandedLineageIds] = useState<Record<string, boolean>>({});
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingClipDraft, setEditingClipDraft] = useState("");
  const [editingClipNotesDraft, setEditingClipNotesDraft] = useState("");
  const [actionsClipId, setActionsClipId] = useState<string | null>(null);
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});
  const animatingHighlightIdsRef = useRef<Set<string>>(new Set());
  const didBlurCleanupRef = useRef(false);

  const pendingPrimaryClipId = useStore((s) => s.pendingPrimaryClipId);
  const recentlyAddedItemIds = useStore((s) => s.recentlyAddedItemIds);
  const clearRecentlyAdded = useStore((s) => s.clearRecentlyAdded);
  const selectedIdea = useStore((s) => {
    const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId);
    return ws?.ideas.find((i) => i.id === s.selectedIdeaId);
  });

  const parentPickSourceIdSet = useMemo(
    () => new Set(parentPickSourceClipIds),
    [parentPickSourceClipIds]
  );
  const parentPickInvalidTargetIdSet = useMemo(
    () => new Set(parentPickInvalidTargetIds),
    [parentPickInvalidTargetIds]
  );

  const displayPrimaryId = useMemo(
    () =>
      pendingPrimaryClipId ?? selectedIdea?.clips.find((item) => item.isPrimary)?.id ?? null,
    [pendingPrimaryClipId, selectedIdea?.clips]
  );

  const primaryClip = useMemo(
    () =>
      selectedIdea?.kind === "project" && displayPrimaryId
        ? selectedIdea.clips.find((clip) => clip.id === displayPrimaryId) ?? null
        : null,
    [displayPrimaryId, selectedIdea]
  );

  const ideaClips = useMemo(
    () => (selectedIdea ? selectedIdea.clips.filter((clip) => clip.id !== primaryClip?.id) : []),
    [primaryClip?.id, selectedIdea]
  );

  const filteredIdeaClips = useMemo(() => {
    if (clipTagFilter === "all") return ideaClips;

    return ideaClips.filter((clip) => {
      const tags = Array.isArray((clip as ClipVersion & { tags?: string[] }).tags)
        ? ((clip as ClipVersion & { tags?: string[] }).tags ?? [])
            .map((tag) => tag.trim().toLowerCase())
            .filter(Boolean)
        : [];

      if (clipTagFilter === "untagged") return tags.length === 0;
      return tags.includes(clipTagFilter);
    });
  }, [clipTagFilter, ideaClips]);

  const visibleClipEntries = useMemo(
    () =>
      viewMode === "evolution"
        ? buildEvolutionListRows(filteredIdeaClips, expandedLineageIds)
            .filter(
              (row): row is { kind: "clip"; entry: EvolutionListClipEntry } => row.kind === "clip"
            )
            .map((row) => row.entry)
        : buildTimelineEntries(filteredIdeaClips, {
            metric: timelineSortMetric,
            direction: timelineSortDirection,
            mainTakesOnly: timelineMainTakesOnly,
          }),
    [
      expandedLineageIds,
      filteredIdeaClips,
      timelineMainTakesOnly,
      timelineSortDirection,
      timelineSortMetric,
      viewMode,
    ]
  );

  const visibleClipIdsKey = visibleClipEntries.map((entry) => entry.clip.id).join("|");

  useEffect(() => {
    const visibleIds = new Set(visibleClipEntries.map((entry) => entry.clip.id));
    const idsToAnimate = recentlyAddedItemIds.filter(
      (id) => visibleIds.has(id) && !animatingHighlightIdsRef.current.has(id)
    );

    idsToAnimate.forEach((id) => {
      animatingHighlightIdsRef.current.add(id);
      const animatedValue = new Animated.Value(0);
      highlightMapRef.current[id] = animatedValue;

      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 0.9,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]).start(() => {
        delete highlightMapRef.current[id];
        animatingHighlightIdsRef.current.delete(id);
        clearRecentlyAdded([id]);
      });
    });
  }, [clearRecentlyAdded, recentlyAddedItemIds, visibleClipEntries, visibleClipIdsKey]);

  useEffect(() => {
    if (isFocused) {
      didBlurCleanupRef.current = false;
      return;
    }
    if (didBlurCleanupRef.current) return;
    didBlurCleanupRef.current = true;
    void inlinePlayer.resetInlinePlayer();
  }, [inlinePlayer, isFocused]);

  useEffect(() => {
    if (isParentPicking && viewMode !== "evolution") {
      setViewMode("evolution");
    }
  }, [isParentPicking, setViewMode, viewMode]);

  useEffect(() => {
    if (!isParentPicking) return;
    setActionsClipId(null);
    setEditingClipId(null);
  }, [isParentPicking]);

  if (!selectedIdea) return null;
  const selectedIdeaId = selectedIdea.id;
  const isDraftProject = !!selectedIdea.isDraft;
  const actionsClip = actionsClipId
    ? selectedIdea.clips.find((clip) => clip.id === actionsClipId) ?? null
    : null;

  function beginEditingClip(clip: ClipVersion) {
    setEditingClipId(clip.id);
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
  }

  function saveEditingClip(clipId: string) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== selectedIdeaId
          ? idea
          : {
              ...idea,
              clips: idea.clips.map((clip) =>
                clip.id === clipId
                  ? {
                      ...clip,
                      title: editingClipDraft.trim() || "Untitled Clip",
                      notes: editingClipNotesDraft.trim(),
                    }
                  : clip
              ),
            }
      )
    );
    setEditingClipId(null);
  }

  function deleteClip(clipId: string) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) => {
        if (idea.id !== selectedIdeaId) return idea;
        const remaining = idea.clips.filter((clip) => clip.id !== clipId);
        if (remaining.length > 0 && !remaining.some((clip) => clip.isPrimary)) {
          remaining[0] = { ...remaining[0], isPrimary: true };
        }
        return {
          ...idea,
          clips: remaining,
        };
      })
    );
  }

  const primaryEntry: TimelineClipEntry | null = primaryClip
    ? {
        kind: "timeline",
        clip: primaryClip,
        depth: 0,
        childCount: 0,
        hasChildren: false,
      }
    : null;

  const clipCardProps: ClipCardSharedProps = {
    idea: selectedIdea,
    displayPrimaryId,
    isEditMode,
    isDraftProject,
    isParentPicking,
    parentPickSourceIdSet,
    parentPickInvalidTargetIdSet,
    editingClipId,
    editingClipDraft,
    setEditingClipDraft,
    editingClipNotesDraft,
    setEditingClipNotesDraft,
    onBeginEditing: beginEditingClip,
    onSaveEditing: saveEditingClip,
    onCancelEditing: () => setEditingClipId(null),
    onOpenActions: (clip) => {
      if (isEditMode || isDraftProject || isParentPicking || useStore.getState().clipSelectionMode) {
        return;
      }
      setActionsClipId(clip.id);
    },
    onPickParentTarget,
    inlinePlayer,
    getHighlightValue: (clipId) => highlightMapRef.current[clipId],
  };

  return (
    <>
      {viewMode === "timeline" ? (
        <TimelineList
          clips={filteredIdeaClips}
          summaryContent={summaryContent}
          footerSpacerHeight={footerSpacerHeight}
          primaryEntry={primaryEntry}
          clipCardProps={clipCardProps}
          timelineSortMetric={timelineSortMetric}
          timelineSortDirection={timelineSortDirection}
          timelineMainTakesOnly={timelineMainTakesOnly}
          isEditMode={isEditMode}
          viewMode={viewMode}
          setViewMode={setViewMode}
          setTimelineSortMetric={setTimelineSortMetric}
          setTimelineSortDirection={setTimelineSortDirection}
          setTimelineMainTakesOnly={setTimelineMainTakesOnly}
          clipTagFilter={clipTagFilter}
          setClipTagFilter={setClipTagFilter}
          isParentPicking={isParentPicking}
          visibleIdeaCount={visibleClipEntries.length}
          onIdeasStickyChange={onIdeasStickyChange}
        />
      ) : (
        <EvolutionList
          clips={filteredIdeaClips}
          expandedLineageIds={expandedLineageIds}
          setExpandedLineageIds={setExpandedLineageIds}
          summaryContent={summaryContent}
          footerSpacerHeight={footerSpacerHeight}
          primaryEntry={primaryEntry}
          clipCardProps={clipCardProps}
          isEditMode={isEditMode}
          viewMode={viewMode}
          setViewMode={setViewMode}
          timelineSortMetric={timelineSortMetric}
          setTimelineSortMetric={setTimelineSortMetric}
          timelineSortDirection={timelineSortDirection}
          setTimelineSortDirection={setTimelineSortDirection}
          timelineMainTakesOnly={timelineMainTakesOnly}
          setTimelineMainTakesOnly={setTimelineMainTakesOnly}
          clipTagFilter={clipTagFilter}
          setClipTagFilter={setClipTagFilter}
          isParentPicking={isParentPicking}
          visibleIdeaCount={visibleClipEntries.length}
          onIdeasStickyChange={onIdeasStickyChange}
        />
      )}

      <ClipActionsSheet
        visible={!!actionsClip}
        title={actionsClip?.title ?? "Clip actions"}
        subtitle={
          actionsClip
            ? `${actionsClip.durationMs ? fmtDuration(actionsClip.durationMs) : "0:00"} • ${formatDate(actionsClip.createdAt)}`
            : undefined
        }
        onCancel={() => setActionsClipId(null)}
        actions={
          actionsClip
            ? [
                ...(!actionsClip.isPrimary
                  ? [
                      {
                        key: "set-parent",
                        label: actionsClip.parentClipId ? "Change parent..." : "Set parent...",
                        icon: "return-up-forward-outline" as const,
                        onPress: () => {
                          setActionsClipId(null);
                          onStartSetParent([actionsClip.id]);
                        },
                      },
                    ]
                  : []),
                ...(actionsClip.parentClipId
                  ? [
                      {
                        key: "make-root",
                        label: "Make root",
                        icon: "arrow-up-outline" as const,
                        onPress: () => {
                          setActionsClipId(null);
                          onMakeRoot([actionsClip.id]);
                        },
                      },
                    ]
                  : []),
                {
                  key: "record-variation",
                  label: "Record variation",
                  icon: "mic-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    void (async () => {
                      await inlinePlayer.resetInlinePlayer();
                      useStore.getState().setRecordingParentClipId(actionsClip.id);
                      useStore.getState().setRecordingIdeaId(selectedIdea.id);
                      navigation.navigate("Recording" as never);
                    })();
                  },
                },
                {
                  key: "rename",
                  label: "Rename",
                  icon: "pencil-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    beginEditingClip(actionsClip);
                  },
                },
                {
                  key: "add-notes",
                  label: "Add notes",
                  icon: "document-text-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    beginEditingClip(actionsClip);
                  },
                },
                {
                  key: "select",
                  label: "Select",
                  icon: "checkmark-circle-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    useStore.getState().startClipSelection(actionsClip.id);
                  },
                },
                {
                  key: "delete",
                  label: "Delete",
                  icon: "trash-outline" as const,
                  destructive: true,
                  onPress: () => {
                    setActionsClipId(null);
                    Alert.alert("Delete clip?", "This cannot be undone.", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          deleteClip(actionsClip.id);
                        },
                      },
                    ]);
                  },
                },
              ]
            : []
        }
      />
    </>
  );
}
