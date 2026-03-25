import { useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { appActions } from "../../../state/actions";
import type { Collection, Workspace } from "../../../types";
import { buildCollectionMoveDestinations, getCollectionDeleteScope } from "../../../collectionManagement";

type CollectionManagementParams = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  navigation: any;
  currentCollection: Collection | null;
  updateCollection: (workspaceId: string, collectionId: string, patch: Partial<Collection>) => void;
  moveCollection: (collectionId: string, workspaceId: string, parentCollectionId?: string | null) => { ok: boolean; error?: string };
  deleteCollection: (collectionId: string) => void;
};

export function useCollectionManagement({
  workspaces,
  activeWorkspace,
  activeWorkspaceId,
  navigation,
  currentCollection,
  updateCollection,
  moveCollection,
  deleteCollection,
}: CollectionManagementParams) {
  const [managedCollectionId, setManagedCollectionId] = useState<string | null>(null);
  const [collectionActionsOpen, setCollectionActionsOpen] = useState(false);
  const [collectionRenameModalOpen, setCollectionRenameModalOpen] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionDestinationMode, setCollectionDestinationMode] = useState<"move" | "copy" | null>(null);
  const [selectedMoveWorkspaceId, setSelectedMoveWorkspaceId] = useState<string | null>(null);
  const [selectedMoveParentCollectionId, setSelectedMoveParentCollectionId] = useState<string | null>(null);

  const managedCollection =
    activeWorkspace?.collections.find((collection) => collection.id === managedCollectionId) ?? null;
  const managedCollectionHasChildren = useMemo(
    () =>
      managedCollection
        ? activeWorkspace?.collections.some(
            (collection) => collection.parentCollectionId === managedCollection.id
          ) ?? false
        : false,
    [activeWorkspace?.collections, managedCollection]
  );
  const moveDestinations = useMemo(
    () => buildCollectionMoveDestinations(workspaces, managedCollection, activeWorkspaceId),
    [activeWorkspaceId, managedCollection, workspaces]
  );

  useEffect(() => {
    if (!collectionDestinationMode) return;
    const firstDestination = moveDestinations[0] ?? null;
    setSelectedMoveWorkspaceId(firstDestination?.workspaceId ?? null);
    setSelectedMoveParentCollectionId(firstDestination?.parentCollectionId ?? null);
  }, [collectionDestinationMode, moveDestinations]);

  const openCollectionActions = (targetCollectionId: string) => {
    setManagedCollectionId(targetCollectionId);
    setCollectionActionsOpen(true);
  };

  const openRenameCollection = () => {
    if (!managedCollection) return;
    setCollectionActionsOpen(false);
    setCollectionDraft(managedCollection.title);
    setCollectionRenameModalOpen(true);
  };

  const openMoveCollection = () => {
    if (!managedCollection) return;
    setCollectionActionsOpen(false);
    if (moveDestinations.length === 0) {
      Alert.alert(
        "No move targets",
        managedCollectionHasChildren
          ? "This collection already has subcollections, so it can only stay at the top level."
          : "There are no valid collection destinations available right now."
      );
      return;
    }
    setCollectionDestinationMode("move");
  };

  const openCopyCollection = () => {
    if (!managedCollection) return;
    setCollectionActionsOpen(false);
    if (moveDestinations.length === 0) {
      Alert.alert(
        "No copy targets",
        managedCollectionHasChildren
          ? "This collection already has subcollections, so it can only be copied to the top level."
          : "There are no valid collection destinations available right now."
      );
      return;
    }
    setCollectionDestinationMode("copy");
  };

  const confirmDeleteCollection = () => {
    if (!activeWorkspace || !managedCollection) return;
    const { childCollectionCount, itemCount } = getCollectionDeleteScope(activeWorkspace, managedCollection.id);
    setCollectionActionsOpen(false);
    Alert.alert(
      "Delete collection?",
      `${managedCollection.title} will be removed${childCollectionCount > 0 ? ` along with ${childCollectionCount} subcollection${childCollectionCount === 1 ? "" : "s"}` : ""} and ${itemCount} item${itemCount === 1 ? "" : "s"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCollection(managedCollection.id);
            setManagedCollectionId(null);
          },
        },
      ]
    );
  };

  const submitCollectionDestination = () => {
    if (!managedCollection || !selectedMoveWorkspaceId) return;
    const result =
      collectionDestinationMode === "copy"
        ? appActions.copyCollection(managedCollection.id, selectedMoveWorkspaceId, selectedMoveParentCollectionId)
        : moveCollection(managedCollection.id, selectedMoveWorkspaceId, selectedMoveParentCollectionId);

    if (!result.ok) {
      Alert.alert(
        collectionDestinationMode === "copy" ? "Copy failed" : "Move failed",
        result.error ??
          `Could not ${collectionDestinationMode === "copy" ? "copy" : "move"} this collection.`
      );
      return;
    }

    setCollectionDestinationMode(null);
    setManagedCollectionId(null);
  };

  const saveRename = () => {
    if (!activeWorkspaceId || !managedCollection) return;
    const nextTitle = collectionDraft.trim();
    if (!nextTitle) return;
    updateCollection(activeWorkspaceId, managedCollection.id, { title: nextTitle });
    setCollectionRenameModalOpen(false);
    setCollectionDraft("");
    setManagedCollectionId(null);
  };

  return {
    managedCollection,
    managedCollectionHasChildren,
    collectionActionsOpen,
    collectionRenameModalOpen,
    collectionDraft,
    collectionDestinationMode,
    selectedMoveWorkspaceId,
    selectedMoveParentCollectionId,
    moveDestinations,
    openCollectionActions,
    openRenameCollection,
    openMoveCollection,
    openCopyCollection,
    confirmDeleteCollection,
    submitCollectionDestination,
    setCollectionActionsOpen,
    setCollectionRenameModalOpen,
    setCollectionDraft,
    setCollectionDestinationMode,
    setSelectedMoveWorkspaceId,
    setSelectedMoveParentCollectionId,
    setManagedCollectionId,
    saveRename,
  };
}
