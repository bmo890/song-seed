import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppAlert } from "../../common/AppAlert";
import type { Collection, Workspace } from "../../../types";
import { appActions } from "../../../state/actions";
import { buildCollectionMoveDestinations, getCollectionDeleteScope } from "../../../domain/collectionManagement";
import { personalWorkspaces } from "../../../domain/workspaceVisibility";
import type { SelectionAction } from "../../common/SelectionDock";
import { useStore } from "../../../state/useStore";
import { openSendSheet } from "../../../state/useSendSheetStore";
import { createCollectionShareLink, shareCollectionFile } from "../../../services/placeShare";
import { isSendServiceConfigured } from "../../../config/sendService";
import { haptic } from "../../../design/haptics";

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

// "SongNook Send" needs a real transfer endpoint — same gate as the Library views.
const SHOW_SEND = __DEV__ || isSendServiceConfigured();

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
  const { t } = useTranslation();
  const [managedCollectionId, setManagedCollectionId] = useState<string | null>(null);
  const [sharingCollection, setSharingCollection] = useState(false);
  const [collectionRenameModalOpen, setCollectionRenameModalOpen] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionDescriptionDraft, setCollectionDescriptionDraft] = useState("");
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
    // Received packages are never a move target — you can't file your own
    // collection into someone else's shared bundle.
    () =>
      buildCollectionMoveDestinations(
        personalWorkspaces(workspaces),
        destinationAnchorCollection,
        activeWorkspaceId
      ),
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
      AppAlert.info(
        mode === "copy" ? t("workspaceBrowse.noCopyTargets") : t("workspaceBrowse.noMoveTargets"),
        t("workspaceBrowse.noDestinationsBody")
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
        AppAlert.info(
          collectionDestinationMode === "move"
            ? t("workspaceBrowse.moveFailed")
            : t("workspaceBrowse.copyFailed"),
          result.error ??
            (collectionDestinationMode === "move"
              ? t("workspaceBrowse.couldNotMove")
              : t("workspaceBrowse.couldNotCopy"))
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

    AppAlert.destructive(
      t("workspaceBrowse.deleteCollectionsTitle"),
      t("workspaceBrowse.deleteCollectionsBody", { count: collapsedSelectedCollectionIds.length }) +
        (scope.childCollectionCount > 0
          ? t("workspaceBrowse.deleteCollectionsSub", { count: scope.childCollectionCount })
          : "") +
        t("workspaceBrowse.deleteCollectionsItems", { count: scope.itemCount }),
      () => {
        for (const collectionId of collapsedSelectedCollectionIds) {
          deleteCollection(collectionId);
        }
        setSelectedCollectionIds([]);
        setSelectionMoreVisible(false);
      },
      { confirmLabel: t("common.delete") }
    );
  };

  const selectionDockActions: SelectionAction[] = [
    {
      key: "edit",
      label: t("common.edit"),
      icon: "create-outline",
      disabled: !singleSelectedCollection,
      onPress: () => {
        if (singleSelectedCollection) openRenameFor(singleSelectedCollection.id);
      },
    },
    {
      key: "set-primary",
      label: t("common.primary"),
      icon: "star-outline",
      disabled: !singleSelectedCollection || singleSelectedCollection.id === primaryCollectionId,
      onPress: () => {
        if (!activeWorkspaceId || !singleSelectedCollection) return;
        setPrimaryCollectionId(activeWorkspaceId, singleSelectedCollection.id);
        setSelectedCollectionIds([]);
      },
    },
    {
      key: "delete",
      label: t("common.delete"),
      icon: "trash-outline",
      tone: "danger",
      onPress: confirmDeleteSelectedCollections,
    },
    {
      key: "more",
      label: t("common.more"),
      icon: "ellipsis-horizontal",
      onPress: () => setSelectionMoreVisible(true),
    },
  ];

  // Export / SongNook Send for ONE selected collection — the same two exits the
  // collection's own page offers, reachable from the hub without opening it.
  const libraryNow = () => {
    const state = useStore.getState();
    return { setlists: state.setlists, songbooks: state.songbooks, playlists: state.playlists };
  };
  const exportSelectedCollection = async () => {
    if (!singleSelectedCollection || !activeWorkspace || sharingCollection) return;
    setSelectionMoreVisible(false);
    setSharingCollection(true);
    try {
      const ok = await shareCollectionFile(singleSelectedCollection, activeWorkspace, libraryNow());
      if (!ok) AppAlert.info(t("collection.nothingShare"), t("collection.nothingShareBody"));
      else setSelectedCollectionIds([]);
    } catch {
      // haptics vocabulary: `error` — a failure the user must hear about.
      haptic.error();
      AppAlert.info(t("collection.shareFailed"), t("collection.shareFailedBody"));
    } finally {
      setSharingCollection(false);
    }
  };
  const sendSelectedCollection = () => {
    if (!singleSelectedCollection || !activeWorkspace || sharingCollection) return;
    const collection = singleSelectedCollection;
    const workspace = activeWorkspace;
    setSelectionMoreVisible(false);
    setSelectedCollectionIds([]);
    openSendSheet({
      title: collection.title,
      kind: "collection",
      emptyMessage: t("collection.nothingShareBody"),
      create: (parcel) => createCollectionShareLink(collection, workspace, libraryNow(), parcel),
    });
  };

  const selectionSheetActions: SelectionAction[] = [
    {
      key: "copy",
      label: t("common.copy"),
      icon: "copy-outline",
      onPress: () => {
        setSelectionMoreVisible(false);
        openCollectionDestination("copy", collapsedSelectedCollectionIds);
      },
    },
    {
      key: "move",
      label: t("common.move"),
      icon: "swap-horizontal-outline",
      onPress: () => {
        setSelectionMoreVisible(false);
        openCollectionDestination("move", collapsedSelectedCollectionIds);
      },
    },
    {
      key: "export",
      label: t("collection.shareFile"),
      icon: "folder-open-outline",
      disabled: !singleSelectedCollection || sharingCollection,
      onPress: () => void exportSelectedCollection(),
    },
    ...(SHOW_SEND
      ? [
          {
            key: "songnook-send",
            label: t("collection.getLink"),
            icon: "paper-plane-outline" as const,
            disabled: !singleSelectedCollection || sharingCollection,
            onPress: sendSelectedCollection,
          },
        ]
      : []),
  ];

  /** Open the rename modal pre-filled for a specific collection (used by per-card ellipsis). */
  function openRenameFor(collectionId: string) {
    const collection = activeWorkspace?.collections.find((c) => c.id === collectionId) ?? null;
    if (!collection) return;
    setManagedCollectionId(collectionId);
    setCollectionDraft(collection.title);
    setCollectionDescriptionDraft(collection.description ?? "");
    setCollectionRenameModalOpen(true);
  }

  return {
    selectionMode,
    selectedCollectionIds,
    selectableCollectionIds,
    canDeselectAll,
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
    collectionDescriptionDraft,
    setCollectionDescriptionDraft,
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
    openRenameFor,
    renameCollection: () => {
      if (!activeWorkspaceId || !managedCollection) return;
      const nextTitle = collectionDraft.trim();
      if (!nextTitle) return;
      const nextDescription = collectionDescriptionDraft.trim() || undefined;
      updateCollection(activeWorkspaceId, managedCollection.id, { title: nextTitle, description: nextDescription });
      setCollectionRenameModalOpen(false);
      setCollectionDraft("");
      setCollectionDescriptionDraft("");
      setManagedCollectionId(null);
    },
    singleSelectedCollection,
  };
}
