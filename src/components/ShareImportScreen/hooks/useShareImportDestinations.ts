import { useMemo } from "react";
import { buildCollectionPathLabel } from "../../../libraryNavigation";
import { getCollectionById } from "../../../utils";
import type { Workspace } from "../../../types";
import type { CollectionDestination } from "../types";

type Args = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  fallbackCollectionId: string | null;
};

export function useShareImportDestinations({
  workspaces,
  activeWorkspaceId,
  fallbackCollectionId,
}: Args) {
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const currentCollectionWorkspace = fallbackCollectionId
    ? workspaces.find((workspace) => !!getCollectionById(workspace, fallbackCollectionId)) ??
      null
    : null;
  const currentCollection =
    fallbackCollectionId && currentCollectionWorkspace
      ? getCollectionById(currentCollectionWorkspace, fallbackCollectionId)
      : null;

  const targetWorkspace =
    (currentCollection &&
      workspaces.find((workspace) => workspace.id === currentCollection.workspaceId)) ??
    activeWorkspace ??
    workspaces[0] ??
    null;
  const topLevelCollectionCount = targetWorkspace
    ? targetWorkspace.collections.filter((collection) => !collection.parentCollectionId).length
    : 0;

  const otherCollectionDestinations = useMemo<CollectionDestination[]>(() => {
    const currentWorkspace = activeWorkspaceId;

    return workspaces
      .flatMap((workspace) =>
        workspace.collections.map((collection) => ({
          workspaceId: workspace.id,
          collectionId: collection.id,
          workspaceTitle: workspace.title,
          collectionTitle: collection.title,
          pathLabel: buildCollectionPathLabel(workspace, collection.id),
        }))
      )
      .filter((destination) => destination.collectionId !== currentCollection?.id)
      .sort((a, b) => {
        const aCurrent = a.workspaceId === currentWorkspace ? 0 : 1;
        const bCurrent = b.workspaceId === currentWorkspace ? 0 : 1;
        return (
          aCurrent - bCurrent ||
          a.workspaceTitle.localeCompare(b.workspaceTitle) ||
          a.pathLabel.localeCompare(b.pathLabel)
        );
      });
  }, [activeWorkspaceId, currentCollection?.id, workspaces]);

  return {
    activeWorkspace,
    currentCollectionWorkspace,
    currentCollection,
    targetWorkspace,
    topLevelCollectionCount,
    otherCollectionDestinations,
  };
}
