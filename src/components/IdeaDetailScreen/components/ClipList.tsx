import React, { useMemo, useRef, useState } from "react";
import { useStore } from "../../../state/useStore";
import { useMiniPlayerContext } from "../../../hooks/FullPlayerProvider";
import type { ClipVersion } from "../../../types";
import { type ClipCardContextProps } from "./ClipCard";
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
    filteredLineages,
    rootIdByClipId,
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
    timelineSortMetric: screen.timelineSortMetric,
    timelineSortDirection: screen.timelineSortDirection,
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

  // ── Referentially stable card context ─────────────────────────────────────
  // ClipCard is React.memo'd; for that to bite, the context must only change identity
  // when its DATA changes. Handler functions are pinned via the stable-handle pattern
  // (stable wrappers that call the latest implementation through a ref), so the memo
  // never goes stale and never busts on unrelated renders.
  const latestHandlersRef = useRef({ editing, parentPicking, undo });
  latestHandlersRef.current = { editing, parentPicking, undo };

  const stableEditingHandlers = useMemo(
    () => ({
      onBeginEditing: (clip: ClipVersion) => latestHandlersRef.current.editing.beginEditingClip(clip),
      onSaveEditing: (clipId: string) => latestHandlersRef.current.editing.saveEditingClip(clipId),
      onCancelEditing: () => latestHandlersRef.current.editing.cancelEditing(),
    }),
    []
  );

  const stableActions = useMemo<ClipCardContextProps["actions"]>(
    () => ({
      onOpenActions: () => {},
      longPressBehavior: "select",
      onOpenNotesSheet: (clip: ClipVersion) => latestHandlersRef.current.editing.openNotesSheet(clip),
      onPickParentTarget: (clipId: string) => {
        const latest = latestHandlersRef.current;
        latest.parentPicking.handlePickParentTarget(clipId, (nextUndo, message) => {
          latest.undo.showUndo(message, nextUndo);
        });
      },
      onOpenTagPicker: (clip: ClipVersion) => setTagPickerClipId(clip.id),
    }),
    []
  );

  const isParentPickingActive = !!parentPicking.parentPickState;
  const effectiveEditMode = screen.isEditMode && !screen.isProject;
  const clipCardContext = useMemo<ClipCardContextProps | null>(() => {
    if (!selectedIdea) return null;
    return {
      mode: {
        idea: selectedIdea,
        displayPrimaryId,
        // Songs edit via the sheet, so their clip cards never enter edit mode (no
        // "set primary" buttons / tap-to-edit). Clips keep their in-place edit.
        isEditMode: effectiveEditMode,
        isDraftProject,
        isParentPicking: isParentPickingActive,
        parentPickSourceIdSet,
        parentPickInvalidTargetIdSet,
      },
      editing: {
        editingClipId: editing.editingClipId,
        editingClipDraft: editing.editingClipDraft,
        setEditingClipDraft: editing.setEditingClipDraft,
        editingClipNotesDraft: editing.editingClipNotesDraft,
        setEditingClipNotesDraft: editing.setEditingClipNotesDraft,
        onBeginEditing: stableEditingHandlers.onBeginEditing,
        onSaveEditing: stableEditingHandlers.onSaveEditing,
        onCancelEditing: stableEditingHandlers.onCancelEditing,
      },
      actions: stableActions,
      playback: {
        globalCustomTags,
        inlinePlayer,
        getHighlightValue,
      },
    };
  }, [
    displayPrimaryId,
    editing.editingClipDraft,
    editing.editingClipId,
    editing.editingClipNotesDraft,
    editing.setEditingClipDraft,
    editing.setEditingClipNotesDraft,
    effectiveEditMode,
    getHighlightValue,
    globalCustomTags,
    inlinePlayer,
    isDraftProject,
    isParentPickingActive,
    parentPickInvalidTargetIdSet,
    parentPickSourceIdSet,
    selectedIdea,
    stableActions,
    stableEditingHandlers,
  ]);

  if (!selectedIdea || !clipCardContext) return null;

  const tagPickerClip = tagPickerClipId
    ? selectedIdea.clips.find((clip) => clip.id === tagPickerClipId) ?? null
    : null;

  return (
    <>
      <SongClipListContent
        filteredLineages={filteredLineages}
        rootIdByClipId={rootIdByClipId}
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
