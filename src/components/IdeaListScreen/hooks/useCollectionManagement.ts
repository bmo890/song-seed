import { useEffect, useMemo, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import { appActions } from "../../../state/actions";
import type { Collection, Workspace } from "../../../types";
import { buildCollectionMoveDestinations, getCollectionDeleteScope } from "../../../domain/collectionManagement";
import { personalWorkspaces } from "../../../domain/workspaceVisibility";
import { useStore } from "../../../state/useStore";
import { createCollectionShareLink, shareCollectionFile } from "../../../services/placeShare";
import { openSendSheet } from "../../../state/useSendSheetStore";
import { haptic } from "../../../design/haptics";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [managedCollectionId, setManagedCollectionId] = useState<string | null>(null);
  const [collectionActionsOpen, setCollectionActionsOpen] = useState(false);
  const [collectionRenameModalOpen, setCollectionRenameModalOpen] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionDestinationMode, setCollectionDestinationMode] = useState<"move" | "copy" | null>(null);
  const [selectedMoveWorkspaceId, setSelectedMoveWorkspaceId] = useState<string | null>(null);
  const [selectedMoveParentCollectionId, setSelectedMoveParentCollectionId] = useState<string | null>(null);
  // "Share…" on the page's ⋯: one sheet, two exits (a file, a link).
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [isSharingCollection, setIsSharingCollection] = useState(false);

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
    // Exclude received packages — they're never a move target.
    () =>
      buildCollectionMoveDestinations(
        personalWorkspaces(workspaces),
        managedCollection,
        activeWorkspaceId
      ),
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
      AppAlert.info(
        t("collection.noMoveTargets"),
        managedCollectionHasChildren
          ? t("collection.childrenStayTop")
          : t("collection.noDestinations")
      );
      return;
    }
    setCollectionDestinationMode("move");
  };

  const openCopyCollection = () => {
    if (!managedCollection) return;
    setCollectionActionsOpen(false);
    if (moveDestinations.length === 0) {
      AppAlert.info(
        t("collection.noCopyTargets"),
        managedCollectionHasChildren
          ? t("collection.childrenCopyTop")
          : t("collection.noDestinations")
      );
      return;
    }
    setCollectionDestinationMode("copy");
  };

  const confirmDeleteCollection = () => {
    if (!activeWorkspace || !managedCollection) return;
    const { childCollectionCount, itemCount } = getCollectionDeleteScope(activeWorkspace, managedCollection.id);
    setCollectionActionsOpen(false);
    AppAlert.destructive(
      t("collection.deleteTitle"),
      t("collection.deleteScope", {
        title: managedCollection.title,
        children: childCollectionCount > 0 ? t("collection.childScope", { count: childCollectionCount }) : "",
        items: t("collection.itemScope", { count: itemCount }),
      }),
      () => {
        deleteCollection(managedCollection.id);
        setManagedCollectionId(null);
      },
      { confirmLabel: t("common.delete") }
    );
  };

  const submitCollectionDestination = () => {
    if (!managedCollection || !selectedMoveWorkspaceId) return;
    const result =
      collectionDestinationMode === "copy"
        ? appActions.copyCollection(managedCollection.id, selectedMoveWorkspaceId, selectedMoveParentCollectionId)
        : moveCollection(managedCollection.id, selectedMoveWorkspaceId, selectedMoveParentCollectionId);

    if (!result.ok) {
      AppAlert.info(
        t(collectionDestinationMode === "copy" ? "collection.copyFailed" : "collection.moveFailed"),
        result.error ??
          t("collection.operationFailed", { action: t(collectionDestinationMode === "copy" ? "collection.copy" : "collection.move") })
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

  /** The compilations at the moment of sharing — only those entirely inside
   *  the collection travel (placeShare → scopedCompilations). */
  const libraryNow = () => {
    const state = useStore.getState();
    return { setlists: state.setlists, songbooks: state.songbooks, playlists: state.playlists };
  };

  const shareCurrentCollectionFile = async () => {
    if (!currentCollection || !activeWorkspace || isSharingCollection) return;
    setShareSheetOpen(false);
    setIsSharingCollection(true);
    try {
      const ok = await shareCollectionFile(currentCollection, activeWorkspace, libraryNow());
      if (!ok) AppAlert.info(t("collection.nothingShare"), t("collection.nothingShareBody"));
    } catch {
      // haptics vocabulary: `error` — a failure the user must hear about.
      haptic.error();
      AppAlert.info(t("collection.shareFailed"), t("collection.shareFailedBody"));
    } finally {
      setIsSharingCollection(false);
    }
  };

  const getLinkForCurrentCollection = () => {
    if (!currentCollection || !activeWorkspace || isSharingCollection) return;
    setShareSheetOpen(false);
    const collection = currentCollection;
    const workspace = activeWorkspace;
    // The SongNook Send sheet takes it from here: title, from, note, seal.
    openSendSheet({
      title: collection.title,
      kind: "collection",
      emptyMessage: t("collection.nothingShareBody"),
      create: (parcel) => createCollectionShareLink(collection, workspace, libraryNow(), parcel),
    });
  };

  return {
    managedCollection,
    managedCollectionHasChildren,
    shareSheetOpen,
    setShareSheetOpen,
    isSharingCollection,
    shareCurrentCollectionFile,
    getLinkForCurrentCollection,
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
