import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import type { Collection, Workspace } from "../../../types";
import { appActions } from "../../../state/actions";
import { buildCollectionMoveDestinations, getCollectionDeleteScope } from "../../../collectionManagement";
import type { SelectionAction } from "../../common/SelectionDock";

function collapseSelectedCollectionIds(
  collections: Array<{ id: string; parentCollectionId?: string | null }>,
  selectedIds: string[]
) {
  const selectedIdSet = new Set(selectedIds);
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]));

  return selectedIds.filter((id) => {
    let cursor = collectionMap.get(id)?.parentCollectionId ?? null;
    while (cursor) {
      if (selectedIdSet.has(cursor)) {
        return false;
      }
      cursor = collectionMap.get(cursor)?.parentCollectionId ?? null;
    }
    return true;
  });
}

export function useWorkspaceCollectionSelection({
  navigation,
  workspaces,
  activeWorkspace,
  activeWorkspaceId,
  primaryCollectionId,
  setPrimaryCollectionId,
  collectionEntries,
  updateCollection,
  moveCollection,
  deleteCollection,
}: {
  navigation: any;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  primaryCollectionId: string | null;
  setPrimaryCollectionId: (workspaceId: string, collectionId: string | null) => void;
  collectionEntries: Array<{ collection: Collection }>;
  updateCollection: (workspaceId: string, collectionId: string, patch: Partial<Collection>) => void;
  moveCollection: (
    collectionId: string,
    destinationWorkspaceId: string,
    destinationParentCollectionId: string | null
  ) => { ok: boolean; error?: string };
  deleteCollection: (collectionId: string) => void;
}) {
  const [managedCollectionId, setManagedCollectionId] = useState<string | null>(null);
  const [collectionRenameModalOpen, setCollectionRenameModalOpen] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionDestinationMode, setCollectionDestinationMode] = useState<"move" | "copy" | null>(
    null
  );
  const [destinationCollectionIds, setDestinationCollectionIds] = useState<string[]>([]);
  const [selectedMoveWorkspaceId, setSelectedMoveWorkspaceId] = useState<string | null>(null);
  const [selectedMoveParentCollectionId, setSelectedMoveParentCollectionId] = useState<string | null>(
    null
  );
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [selectionMoreVisible, setSelectionMoreVisible] = useState(false);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener?.("blur", () => {
      setSelectedCollectionIds([]);
      setSelectionMoreVisible(false);
    });
    return unsubscribe;
  }, [navigation]);

  const selectionMode = selectedCollectionIds.length > 0;
  const selectableCollectionIds = useMemo(
    () => collectionEntries.map((entry) => entry.collection.id),
    [collectionEntries]
  );
  const collapsedSelectedCollectionIds = useMemo(
    () => collapseSelectedCollectionIds(activeWorkspace?.collections ?? [], selectedCollectionIds),
    [activeWorkspace?.collections, selectedCollectionIds]
  );
  const selectedCollections = useMemo(
    () =>
      (activeWorkspace?.collections ?? []).filter((collection) =>
        collapsedSelectedCollectionIds.includes(collection.id)
      ),
    [activeWorkspace?.collections, collapsedSelectedCollectionIds]
  );
  const managedCollection =
    activeWorkspace?.collections.find((collection) => collection.id === managedCollectionId) ?? null;
  const destinationAnchorCollection = managedCollection ?? selectedCollections[0] ?? null;
  const moveDestinations = useMemo(
    () => buildCollectionMoveDestinations(workspaces, destinationAnchorCollection, activeWorkspaceId),
    [activeWorkspaceId, destinationAnchorCollection, workspaces]
  );
  const allSelectableSelected =
    selectableCollectionIds.length > 0 &&
    selectableCollectionIds.every((id) => selectedCollectionIds.includes(id));
  const canDeselectAll =
    allSelectableSelected || (selectableCollectionIds.length === 0 && selectedCollectionIds.length > 0);
  const singleSelectedCollection =
    selectedCollections.length === 1 ? selectedCollections[0] ?? null : null;

  useEffect(() => {
    if (!collectionDestinationMode) return;
    const firstDestination = moveDestinations[0] ?? null;
    setSelectedMoveWorkspaceId(firstDestination?.workspaceId ?? null);
    setSelectedMoveParentCollectionId(firstDestination?.parentCollectionId ?? null);
  }, [collectionDestinationMode, moveDestinations]);

  const openCollectionDestination = (mode: "move" | "copy", collectionIds: string[]) => {
    if (collectionIds.length === 0) return;
    if (moveDestinations.length === 0) {
      Alert.alert(
        mode === "copy" ? "No copy targets" : "No move targets",
        "There are no valid collection destinations available right now."
      );
      return;
    }
    setDestinationCollectionIds(collectionIds);
    setCollectionDestinationMode(mode);
  };

  const submitCollectionDestination = () => {
    if (!selectedMoveWorkspaceId || !collectionDestinationMode || !activeWorkspace) return;

    const collectionIds =
      destinationCollectionIds.length > 0
        ? collapseSelectedCollectionIds(activeWorkspace.collections, destinationCollectionIds)
        : managedCollection
          ? [managedCollection.id]
          : [];

    for (const collectionId of collectionIds) {
      const result =
        collectionDestinationMode === "move"
          ? moveCollection(collectionId, selectedMoveWorkspaceId, selectedMoveParentCollectionId)
          : appActions.copyCollection(collectionId, selectedMoveWorkspaceId, selectedMoveParentCollectionId);

      if (!result.ok) {
        Alert.alert(
          collectionDestinationMode === "move" ? "Move failed" : "Copy failed",
          result.error ?? `Could not ${collectionDestinationMode} this collection.`
        );
        return;
      }
    }

    setCollectionDestinationMode(null);
    setDestinationCollectionIds([]);
    setManagedCollectionId(null);
    setSelectedCollectionIds([]);
  };

  const confirmDeleteSelectedCollections = () => {
    if (!activeWorkspace || collapsedSelectedCollectionIds.length === 0) return;

    const scope = collapsedSelectedCollectionIds.reduce(
      (summary, collectionId) => {
        const next = getCollectionDeleteScope(activeWorkspace, collectionId);
        return {
          childCollectionCount: summary.childCollectionCount + next.childCollectionCount,
          itemCount: summary.itemCount + next.itemCount,
        };
      },
      { childCollectionCount: 0, itemCount: 0 }
    );

    Alert.alert(
      "Delete collections?",
      `${collapsedSelectedCollectionIds.length} collection${collapsedSelectedCollectionIds.length === 1 ? "" : "s"} will be removed${scope.childCollectionCount > 0 ? ` along with ${scope.childCollectionCount} subcollection${scope.childCollectionCount === 1 ? "" : "s"}` : ""} and ${scope.itemCount} item${scope.itemCount === 1 ? "" : "s"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            for (const collectionId of collapsedSelectedCollectionIds) {
              deleteCollection(collectionId);
            }
            setSelectedCollectionIds([]);
            setSelectionMoreVisible(false);
          },
        },
      ]
    );
  };

  const selectionDockActions: SelectionAction[] =
    singleSelectedCollection
      ? [
          {
            key: "rename",
            label: "Rename",
            icon: "create-outline",
            onPress: () => {
              setManagedCollectionId(singleSelectedCollection.id);
              setCollectionDraft(singleSelectedCollection.title);
              setCollectionRenameModalOpen(true);
            },
          },
          {
            key: "primary",
            label:
              primaryCollectionId === singleSelectedCollection.id
                ? "Main collection"
                : "Set main",
            icon:
              primaryCollectionId === singleSelectedCollection.id
                ? "star"
                : "star-outline",
            onPress: () => {
              if (!activeWorkspaceId) return;
              if (primaryCollectionId === singleSelectedCollection.id) return;
              setPrimaryCollectionId(activeWorkspaceId, singleSelectedCollection.id);
              setSelectedCollectionIds([]);
            },
            disabled: primaryCollectionId === singleSelectedCollection.id,
          },
          {
            key: "copy",
            label: "Copy",
            icon: "copy-outline",
            onPress: () => openCollectionDestination("copy", collapsedSelectedCollectionIds),
          },
          {
            key: "move",
            label: "Move",
            icon: "swap-horizontal-outline",
            onPress: () => openCollectionDestination("move", collapsedSelectedCollectionIds),
          },
          {
            key: "more",
            label: "More",
            icon: "ellipsis-horizontal",
            onPress: () => setSelectionMoreVisible(true),
          },
        ]
      : [
          {
            key: "copy",
            label: "Copy",
            icon: "copy-outline",
            onPress: () => openCollectionDestination("copy", collapsedSelectedCollectionIds),
          },
          {
            key: "move",
            label: "Move",
            icon: "swap-horizontal-outline",
            onPress: () => openCollectionDestination("move", collapsedSelectedCollectionIds),
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
      key: "select-all",
      label: canDeselectAll ? "Deselect all" : "Select all",
      icon: canDeselectAll ? "remove-circle-outline" : "checkmark-circle-outline",
      onPress: () => setSelectedCollectionIds(canDeselectAll ? [] : selectableCollectionIds),
      disabled: !canDeselectAll && selectableCollectionIds.length === 0,
    },
    {
      key: "delete",
      label: "Delete",
      icon: "trash-outline",
      tone: "danger",
      onPress: confirmDeleteSelectedCollections,
    },
  ];

  return {
    selectionMode,
    selectedCollectionIds,
    setSelectedCollectionIds,
    selectionMoreVisible,
    setSelectionMoreVisible,
    selectionDockHeight,
    setSelectionDockHeight,
    selectionDockActions,
    selectionSheetActions,
    collectionRenameModalOpen,
    setCollectionRenameModalOpen,
    collectionDraft,
    setCollectionDraft,
    managedCollection,
    collectionDestinationMode,
    moveDestinations,
    selectedMoveWorkspaceId,
    selectedMoveParentCollectionId,
    setSelectedMoveWorkspaceId,
    setSelectedMoveParentCollectionId,
    setCollectionDestinationMode,
    setDestinationCollectionIds,
    submitCollectionDestination,
    renameCollection: () => {
      if (!activeWorkspaceId || !managedCollection) return;
      const nextTitle = collectionDraft.trim();
      if (!nextTitle) return;
      updateCollection(activeWorkspaceId, managedCollection.id, { title: nextTitle });
      setCollectionRenameModalOpen(false);
      setCollectionDraft("");
      setManagedCollectionId(null);
    },
    singleSelectedCollection,
  };
}
