import { useMemo, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { buildWorkspaceBrowseEntries } from "../../../domain/libraryNavigation";
import { openCollectionInBrowse } from "../../../navigation";

export function useWorkspaceCollectionsModel() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const primaryCollectionIdByWorkspace = useStore((state) => state.primaryCollectionIdByWorkspace);
  const addCollection = useStore((state) => state.addCollection);
  const updateCollection = useStore((state) => state.updateCollection);
  const moveCollection = useStore((state) => state.moveCollection);
  const deleteCollection = useStore((state) => state.deleteCollection);
  const markCollectionOpened = useStore((state) => state.markCollectionOpened);
  const setPrimaryCollectionId = useStore((state) => state.setPrimaryCollectionId);

  const [searchQuery, setSearchQuery] = useState("");

  const routeWorkspaceId = route.params?.workspaceId as string | undefined;
  const routeWorkspace = routeWorkspaceId
    ? workspaces.find((workspace) => workspace.id === routeWorkspaceId) ?? null
    : null;
  const resolvedWorkspaceId = routeWorkspace?.id ?? activeWorkspaceId;
  const activeWorkspace = routeWorkspace ?? workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const topLevelCollections = useMemo(
    () =>
      (activeWorkspace?.collections ?? []).filter(
        (collection) => !collection.parentCollectionId
      ),
    [activeWorkspace?.collections]
  );
  const collectionEntries = useMemo(
    () =>
      activeWorkspace
        ? buildWorkspaceBrowseEntries(
            activeWorkspace,
            searchQuery,
            primaryCollectionIdByWorkspace[activeWorkspace.id] ?? null
          )
        : [],
    [activeWorkspace, primaryCollectionIdByWorkspace, searchQuery]
  );


  return {
    navigation,
    workspaces,
    activeWorkspaceId: resolvedWorkspaceId,
    activeWorkspace,
    topLevelCollections,
    collectionEntries,
    searchQuery,
    setSearchQuery,
    addCollection,
    updateCollection,
    moveCollection,
    deleteCollection,
    primaryCollectionId: activeWorkspace ? primaryCollectionIdByWorkspace[activeWorkspace.id] ?? null : null,
    setPrimaryCollectionId,
    openCollection: (collectionId: string) => {
      markCollectionOpened(collectionId);
      openCollectionInBrowse(navigation, {
        collectionId,
        workspaceId: activeWorkspace?.id,
      });
    },
  };
}
