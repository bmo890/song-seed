import React, { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler } from "react-native";
import { AppAlert } from "../common/AppAlert";
import { useNavigation } from "@react-navigation/native";
import { ClipActionsSheet } from "../modals/ClipActionsSheet";
import { ClipNotesSheet } from "../modals/ClipNotesSheet";
import { useStore } from "../../state/useStore";
import { type ClipVersion, type CustomTagDefinition } from "../../types";
import {
  buildClipLineages,
  buildEvolutionListRows,
  buildTimelineEntries,
  getLineageRootId,
  type ClipLineage,
  type EvolutionListClipEntry,
  type SongTimelineSortDirection,
  type SongTimelineSortMetric,
  type TimelineClipEntry,
} from "../../clipGraph";
import { AssignLineageSheet } from "../modals/AssignLineageSheet";
import { fmtDuration, formatDate } from "../../utils";
import { useInlinePlayer } from "../../hooks/useInlinePlayer";
import type { SongClipTagFilter } from "./songClipControls";
import { type ClipCardSharedProps } from "./ClipCard";
import { EvolutionList } from "./EvolutionList";
import { TimelineList } from "./TimelineList";
import { ClipTagPicker } from "./ClipTagPicker";

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
  onViewLineageHistory?: (lineageRootId: string) => void;
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
  onViewLineageHistory,
}: ClipListProps) {
  const navigation = useNavigation();
  const inlinePlayer = useInlinePlayer();
  const [expandedLineageIds, setExpandedLineageIds] = useState<Record<string, boolean>>({});
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [editingClipDraft, setEditingClipDraft] = useState("");
  const [editingClipNotesDraft, setEditingClipNotesDraft] = useState("");
  const [actionsClipId, setActionsClipId] = useState<string | null>(null);
  const [notesSheetClipId, setNotesSheetClipId] = useState<string | null>(null);
  const [tagPickerClipId, setTagPickerClipId] = useState<string | null>(null);
  const [assignLineageClipId, setAssignLineageClipId] = useState<string | null>(null);
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const highlightMapRef = useRef<Record<string, Animated.Value>>({});
  const animatingHighlightIdsRef = useRef<Set<string>>(new Set());

  const pendingPrimaryClipId = useStore((s) => s.pendingPrimaryClipId);
  const recentlyAddedItemIds = useStore((s) => s.recentlyAddedItemIds);
  const clearRecentlyAdded = useStore((s) => s.clearRecentlyAdded);
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const selectedIdeaId = useStore((s) => s.selectedIdeaId);
  // Derive project objects after the selector so this list cannot generate unstable object
  // references during hydration and participate in overwriting persisted data with defaults.
  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );
  const selectedIdea = useMemo(
    () => activeWorkspace?.ideas.find((idea) => idea.id === selectedIdeaId) ?? null,
    [activeWorkspace, selectedIdeaId]
  );

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
    () => selectedIdea?.clips ?? [],
    [selectedIdea]
  );

  const filteredIdeaClips = useMemo(() => {
    if (clipTagFilter === "all") return ideaClips;

    return ideaClips.filter((clip) => {
      const tags = (clip.tags ?? [])
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean);

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
    if (!inlinePlayer.inlineTarget) return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      void inlinePlayer.resetInlinePlayer();
      return true;
    });
    return () => handler.remove();
  }, [inlinePlayer, inlinePlayer.inlineTarget]);

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
  const currentIdeaId = selectedIdea.id;
  const isDraftProject = !!selectedIdea.isDraft;
  const actionsClip = actionsClipId
    ? selectedIdea.clips.find((clip) => clip.id === actionsClipId) ?? null
    : null;
  const notesSheetClip = notesSheetClipId
    ? selectedIdea.clips.find((clip) => clip.id === notesSheetClipId) ?? null
    : null;

  function openNotesSheet(clip: ClipVersion) {
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
    setNotesSheetClipId(clip.id);
  }

  function saveNotesSheet() {
    if (!notesSheetClipId) return;
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== currentIdeaId
          ? idea
          : {
              ...idea,
              clips: idea.clips.map((clip) =>
                clip.id === notesSheetClipId
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
    setNotesSheetClipId(null);
  }

  function beginEditingClip(clip: ClipVersion) {
    setEditingClipId(clip.id);
    setEditingClipDraft(clip.title);
    setEditingClipNotesDraft(clip.notes || "");
  }

  function saveEditingClip(clipId: string) {
    useStore.getState().updateIdeas((ideas) =>
      ideas.map((idea) =>
        idea.id !== currentIdeaId
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
        if (idea.id !== currentIdeaId) return idea;
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
    onOpenNotesSheet: (clip) => openNotesSheet(clip),
    onPickParentTarget,
    onOpenTagPicker: (clip) => setTagPickerClipId(clip.id),
    globalCustomTags,
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
          onViewLineageHistory={onViewLineageHistory}
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
                ...(!actionsClip.parentClipId && !actionsClip.isPrimary
                  ? (() => {
                      const lineages = buildClipLineages(selectedIdea.clips);
                      const otherLineages = lineages.filter((l) => l.root.id !== actionsClip.id);
                      if (otherLineages.length === 0) return [];
                      return [
                        {
                          key: "assign-lineage",
                          label: "Assign to lineage",
                          icon: "git-merge-outline" as const,
                          onPress: () => {
                            setActionsClipId(null);
                            setAssignLineageClipId(actionsClip.id);
                          },
                        },
                      ];
                    })()
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
                  label: actionsClip.notes?.trim() ? "Edit notes" : "Add notes",
                  icon: "document-text-outline" as const,
                  onPress: () => {
                    setActionsClipId(null);
                    openNotesSheet(actionsClip);
                  },
                },
                ...(onViewLineageHistory
                  ? [
                      {
                        key: "view-lineage",
                        label: "View history",
                        icon: "git-branch-outline" as const,
                        onPress: () => {
                          setActionsClipId(null);
                          const rootId = getLineageRootId(selectedIdea.clips, actionsClip.id);
                          if (rootId) onViewLineageHistory(rootId);
                        },
                      },
                    ]
                  : []),
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
                    AppAlert.destructive("Delete clip?", "This cannot be undone.", () => {
                      deleteClip(actionsClip.id);
                    });
                  },
                },
              ]
            : []
        }
      />

      <ClipTagPicker
        visible={!!tagPickerClipId}
        clip={tagPickerClipId ? selectedIdea.clips.find((c) => c.id === tagPickerClipId) ?? null : null}
        idea={selectedIdea}
        globalCustomTags={globalCustomTags}
        onClose={() => setTagPickerClipId(null)}
      />

      <ClipNotesSheet
        visible={!!notesSheetClip}
        clipSubtitle={
          notesSheetClip
            ? `${notesSheetClip.durationMs ? fmtDuration(notesSheetClip.durationMs) : "0:00"} • ${formatDate(notesSheetClip.createdAt)}`
            : ""
        }
        titleDraft={editingClipDraft}
        notesDraft={editingClipNotesDraft}
        onChangeTitle={setEditingClipDraft}
        onChangeNotes={setEditingClipNotesDraft}
        onSave={saveNotesSheet}
        onCancel={() => setNotesSheetClipId(null)}
      />

      <AssignLineageSheet
        visible={!!assignLineageClipId}
        orphanTitle={
          assignLineageClipId
            ? selectedIdea.clips.find((c) => c.id === assignLineageClipId)?.title ?? "Clip"
            : ""
        }
        lineages={
          assignLineageClipId
            ? buildClipLineages(selectedIdea.clips).filter((l) => l.root.id !== assignLineageClipId)
            : []
        }
        onAssign={(targetLatestClipId) => {
          if (!assignLineageClipId) return;
          useStore.getState().updateIdeas((ideas) =>
            ideas.map((idea) =>
              idea.id !== currentIdeaId
                ? idea
                : {
                    ...idea,
                    clips: idea.clips.map((clip) =>
                      clip.id === assignLineageClipId
                        ? { ...clip, parentClipId: targetLatestClipId }
                        : clip
                    ),
                  }
            )
          );
          setAssignLineageClipId(null);
        }}
        onCancel={() => setAssignLineageClipId(null)}
      />
    </>
  );
}
