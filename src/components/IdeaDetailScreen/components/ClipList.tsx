import React, { useMemo, useState } from "react";
import { useStore } from "../../../state/useStore";
import { useMiniPlayerContext } from "../../../hooks/FullPlayerProvider";
import { type ClipCardContextProps } from "../ClipCard";
import { useSongClipEditing } from "../hooks/useSongClipEditing";
import { useSongClipHighlights } from "../hooks/useSongClipHighlights";
import { useSongClipListData } from "../hooks/useSongClipListData";
import { useSongClipListEffects } from "../hooks/useSongClipListEffects";
import { useSongScreen } from "../provider/SongScreenProvider";
import { SongClipListContent } from "./SongClipListContent";
import { SongClipListModals } from "./SongClipListModals";

export function ClipList() {
  const { screen, parentPicking, undo, store } = useSongScreen();
  const inlinePlayer = useMiniPlayerContext();
  const clipSelectionMode = useStore((s) => s.clipSelectionMode);
  const [expandedLineageIds, setExpandedLineageIds] = useState<Record<string, boolean>>({});
  const [tagPickerClipId, setTagPickerClipId] = useState<string | null>(null);
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  const pendingPrimaryClipId = useStore((s) => s.pendingPrimaryClipId);
  const selectedIdea = screen.selectedIdea ?? null;
  const editing = useSongClipEditing(selectedIdea);

  const parentPickSourceIdSet = useMemo(
    () => new Set(parentPicking.parentPickState?.sourceClipIds ?? []),
    [parentPicking.parentPickState?.sourceClipIds]
  );
  const parentPickInvalidTargetIdSet = useMemo(
    () => new Set(parentPicking.parentPickInvalidTargetIds),
    [parentPicking.parentPickInvalidTargetIds]
  );

  const {
    filteredIdeaClips,
    displayPrimaryId,
    primaryEntry,
    visibleClipEntries,
    visibleIdeaCount,
    footerSpacerHeight,
    isDraftProject,
  } = useSongClipListData({
    selectedIdea,
    clipTagFilter: screen.clipTagFilter,
    clipGroupFilter: screen.clipGroupFilter,
    clipBookmarkedOnly: screen.clipBookmarkedOnly,
    clipViewMode: screen.clipViewMode,
    timelineSortMetric: screen.timelineSortMetric,
    timelineSortDirection: screen.timelineSortDirection,
    timelineMainTakesOnly: screen.timelineMainTakesOnly,
    expandedLineageIds,
    pendingPrimaryClipId,
    isProject: screen.isProject,
    isEditMode: screen.isEditMode,
    clipSelectionMode: store.clipSelectionMode,
    isParentPicking: !!parentPicking.parentPickState,
    clipListFooterSpacerHeight: screen.clipListFooterSpacerHeight,
    clipSelectionFooterSpacerHeight: screen.clipSelectionFooterSpacerHeight,
    songPageBaseBottomPadding: screen.songPageBaseBottomPadding,
  });

  const { getHighlightValue } = useSongClipHighlights(visibleClipEntries);
  const inlineTarget = useStore((s) => s.inlineTarget);

  useSongClipListEffects({
    inlineTarget,
    resetInlinePlayer: inlinePlayer.resetInlinePlayer,
    isParentPicking: !!parentPicking.parentPickState,
    clipViewMode: screen.clipViewMode,
    setClipViewMode: screen.setClipViewMode,
    clearEditing: editing.cancelEditing,
  });

  if (!selectedIdea) return null;

  const tagPickerClip = tagPickerClipId
    ? selectedIdea.clips.find((clip) => clip.id === tagPickerClipId) ?? null
    : null;

  const clipCardContext: ClipCardContextProps = {
    mode: {
      idea: selectedIdea,
      displayPrimaryId,
      isEditMode: screen.isEditMode,
      isDraftProject,
      isParentPicking: !!parentPicking.parentPickState,
      parentPickSourceIdSet,
      parentPickInvalidTargetIdSet,
    },
    editing: {
      editingClipId: editing.editingClipId,
      editingClipDraft: editing.editingClipDraft,
      setEditingClipDraft: editing.setEditingClipDraft,
      editingClipNotesDraft: editing.editingClipNotesDraft,
      setEditingClipNotesDraft: editing.setEditingClipNotesDraft,
      onBeginEditing: editing.beginEditingClip,
      onSaveEditing: editing.saveEditingClip,
      onCancelEditing: editing.cancelEditing,
    },
    actions: {
      onOpenActions: () => {},
      longPressBehavior: "select",
      onOpenNotesSheet: editing.openNotesSheet,
      onPickParentTarget: (clipId) => {
        parentPicking.handlePickParentTarget(clipId, (nextUndo, message) => {
          undo.showUndo(message, nextUndo);
        });
      },
      onOpenTagPicker: (clip) => setTagPickerClipId(clip.id),
    },
    playback: {
      globalCustomTags,
      inlinePlayer,
      getHighlightValue,
    },
  };

  return (
    <>
      <SongClipListContent
        filteredIdeaClips={filteredIdeaClips}
        footerSpacerHeight={footerSpacerHeight}
        primaryEntry={primaryEntry}
        clipCardContext={clipCardContext}
        visibleIdeaCount={visibleIdeaCount}
        expandedLineageIds={expandedLineageIds}
        setExpandedLineageIds={setExpandedLineageIds}
      />

      <SongClipListModals
        selectedIdea={selectedIdea}
        globalCustomTags={globalCustomTags}
        notesSheetClip={editing.notesSheetClip}
        tagPickerClip={tagPickerClip}
        editingClipDraft={editing.editingClipDraft}
        editingClipNotesDraft={editing.editingClipNotesDraft}
        setEditingClipDraft={editing.setEditingClipDraft}
        setEditingClipNotesDraft={editing.setEditingClipNotesDraft}
        saveNotesSheet={editing.saveNotesSheet}
        closeNotesSheet={editing.closeNotesSheet}
        closeTagPicker={() => setTagPickerClipId(null)}
      />
    </>
  );
}
