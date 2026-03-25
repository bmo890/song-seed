import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { buildWorkspaceBrowseEntries } from "../../../libraryNavigation";
import { getCollectionSizeBytes } from "../../../utils";
import { openCollectionInBrowse } from "../../../navigation";

export function useWorkspaceCollectionsModel() {
  const navigation = useNavigation<any>();
  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const addCollection = useStore((state) => state.addCollection);
  const updateCollection = useStore((state) => state.updateCollection);
  const moveCollection = useStore((state) => state.moveCollection);
  const deleteCollection = useStore((state) => state.deleteCollection);
  const markCollectionOpened = useStore((state) => state.markCollectionOpened);

  const [searchQuery, setSearchQuery] = useState("");
  const [sizeMap, setSizeMap] = useState<Record<string, number>>({});

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const topLevelCollections = useMemo(
    () =>
      (activeWorkspace?.collections ?? []).filter(
        (collection) => !collection.parentCollectionId
      ),
    [activeWorkspace?.collections]
  );
  const collectionEntries = useMemo(
    () => (activeWorkspace ? buildWorkspaceBrowseEntries(activeWorkspace, searchQuery) : []),
    [activeWorkspace, searchQuery]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeWorkspace) return;
      const entries = await Promise.all(
        topLevelCollections.map(async (collection) => [
          collection.id,
          await getCollectionSizeBytes(activeWorkspace, collection.id),
        ] as const)
      );

      if (cancelled) return;
      setSizeMap((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [collectionId, bytes] of entries) {
          if (next[collectionId] !== bytes) {
            next[collectionId] = bytes;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace, topLevelCollections]);

  return {
    navigation,
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    topLevelCollections,
    collectionEntries,
    searchQuery,
    setSearchQuery,
    sizeMap,
    addCollection,
    updateCollection,
    moveCollection,
    deleteCollection,
    openCollection: (collectionId: string) => {
      markCollectionOpened(collectionId);
      openCollectionInBrowse(navigation, { collectionId });
    },
  };
}
