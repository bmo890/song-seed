import { useMemo, useState } from "react";
import type { PlaylistItemKind, SongIdea, Workspace } from "../../../types";
import { buildWorkspaceBrowseEntries, getCollectionLastWorkedAt, getIdeaPrimaryClip } from "../../../libraryNavigation";
import { compareIdeas } from "../../../ideaSort";
import { getCollectionById } from "../../../utils";
import type { PlaylistPickerSelection, PlaylistPickerState } from "../types";
import { SelectionAction, SelectionDock } from "../../common/SelectionDock";

function buildPickerSelectionKey(selection: PlaylistPickerSelection) {
  return [
    selection.kind,
    selection.workspaceId,
    selection.collectionId,
    selection.ideaId,
    selection.clipId ?? "",
  ].join(":");
}

export function usePlaylistPicker({
  workspaces,
  pickerState,
  onChangePickerState,
  onConfirm,
}: {
  workspaces: Workspace[];
  pickerState: PlaylistPickerState;
  onChangePickerState: (next: PlaylistPickerState | null) => void;
  onConfirm: () => void;
}) {
  const workspace =
    pickerState.workspaceId
      ? workspaces.find((candidate) => candidate.id === pickerState.workspaceId) ?? null
      : null;
  const collection =
    workspace && pickerState.collectionId
      ? getCollectionById(workspace, pickerState.collectionId)
      : null;
  const collectionEntries = useMemo(
    () => (workspace ? buildWorkspaceBrowseEntries(workspace, "") : []),
    [workspace]
  );
  const childCollections = useMemo(() => {
    if (!workspace || !collection) return [];
    return workspace.collections
      .filter((candidate) => candidate.parentCollectionId === collection.id)
      .slice()
      .sort(
        (a, b) =>
          getCollectionLastWorkedAt(workspace, b.id) - getCollectionLastWorkedAt(workspace, a.id) ||
          a.title.localeCompare(b.title)
      );
  }, [collection, workspace]);
  const collectionIdeas = useMemo(() => {
    if (!workspace || !collection) return [];
    return workspace.ideas
      .filter((idea) => idea.collectionId === collection.id)
      .slice()
      .sort((a, b) => compareIdeas(a, b, "updated-newest"));
  }, [collection, workspace]);
  const selectedSongIdea =
    workspace && pickerState.songIdeaId
      ? workspace.ideas.find((idea) => idea.id === pickerState.songIdeaId) ?? null
      : null;
  const [selectionMoreVisible, setSelectionMoreVisible] = useState(false);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);

  const isSelected = (selection: PlaylistPickerSelection) =>
    pickerState.selectedItems.some(
      (item) => buildPickerSelectionKey(item) === buildPickerSelectionKey(selection)
    );

  const toggleSelection = (selection: PlaylistPickerSelection) => {
    const key = buildPickerSelectionKey(selection);
    const hasSelection = pickerState.selectedItems.some(
      (item) => buildPickerSelectionKey(item) === key
    );

    onChangePickerState({
      ...pickerState,
      selectedItems: hasSelection
        ? pickerState.selectedItems.filter((item) => buildPickerSelectionKey(item) !== key)
        : [...pickerState.selectedItems, selection],
    });
  };

  const visibleSelections = useMemo<PlaylistPickerSelection[]>(() => {
    if (workspace && collection && selectedSongIdea) {
      return selectedSongIdea.clips.map((clip) => ({
        kind: "clip",
        workspaceId: workspace.id,
        collectionId: selectedSongIdea.collectionId,
        ideaId: selectedSongIdea.id,
        clipId: clip.id,
      }));
    }

    if (workspace && collection && !selectedSongIdea) {
      return collectionIdeas.map((idea) => {
        const primaryClip = getIdeaPrimaryClip(idea);
        return idea.kind === "project"
          ? {
              kind: "song" as const,
              workspaceId: workspace.id,
              collectionId: idea.collectionId,
              ideaId: idea.id,
            }
          : {
              kind: "clip" as const,
              workspaceId: workspace.id,
              collectionId: idea.collectionId,
              ideaId: idea.id,
              clipId: primaryClip?.id ?? null,
            };
      });
    }

    return [];
  }, [collection, collectionIdeas, selectedSongIdea, workspace]);
  const selectedKeySet = useMemo(
    () => new Set(pickerState.selectedItems.map((item) => buildPickerSelectionKey(item))),
    [pickerState.selectedItems]
  );
  const allVisibleSelected =
    visibleSelections.length > 0 &&
    visibleSelections.every((selection) => selectedKeySet.has(buildPickerSelectionKey(selection)));

  const selectionDockActions: SelectionAction[] = [
    {
      key: "add",
      label:
        pickerState.selectedItems.length === 1
          ? "Add item"
          : `Add ${pickerState.selectedItems.length}`,
      icon: "add-outline",
      onPress: onConfirm,
      disabled: pickerState.selectedItems.length === 0,
    },
    {
      key: "more",
      label: "More",
      icon: "ellipsis-horizontal",
      onPress: () => setSelectionMoreVisible(true),
    },
  ];
  const selectionSheetActions: SelectionAction[] = [
    {
      key: "toggle-visible",
      label: allVisibleSelected ? "Deselect view" : "Select all in view",
      icon: allVisibleSelected ? "remove-circle-outline" : "checkmark-circle-outline",
      onPress: () => {
        const visibleKeySet = new Set(visibleSelections.map((item) => buildPickerSelectionKey(item)));
        if (allVisibleSelected) {
          onChangePickerState({
            ...pickerState,
            selectedItems: pickerState.selectedItems.filter(
              (item) => !visibleKeySet.has(buildPickerSelectionKey(item))
            ),
          });
          return;
        }

        const nextItems = [...pickerState.selectedItems];
        visibleSelections.forEach((selection) => {
          const key = buildPickerSelectionKey(selection);
          if (!selectedKeySet.has(key)) {
            nextItems.push(selection);
          }
        });
        onChangePickerState({
          ...pickerState,
          selectedItems: nextItems,
        });
      },
      disabled: visibleSelections.length === 0,
    },
    {
      key: "clear",
      label: "Clear selection",
      icon: "close-circle-outline",
      onPress: () =>
        onChangePickerState({
          ...pickerState,
          selectedItems: [],
        }),
      disabled: pickerState.selectedItems.length === 0,
    },
  ];

  const buildIdeaSelection = (idea: SongIdea | Exclude<Workspace["ideas"][number], SongIdea>) => {
    const primaryClip = getIdeaPrimaryClip(idea);
    return idea.kind === "project"
      ? {
          kind: "song" as const,
          workspaceId: workspace!.id,
          collectionId: idea.collectionId,
          ideaId: idea.id,
        }
      : {
          kind: "clip" as const,
          workspaceId: workspace!.id,
          collectionId: idea.collectionId,
          ideaId: idea.id,
          clipId: primaryClip?.id ?? null,
        };
  };

  return {
    workspace,
    collection,
    collectionEntries,
    childCollections,
    collectionIdeas,
    selectedSongIdea,
    isSelected,
    toggleSelection,
    buildIdeaSelection,
    selectionMoreVisible,
    setSelectionMoreVisible,
    selectionDockHeight,
    setSelectionDockHeight,
    selectionDockActions,
    selectionSheetActions,
  };
}
