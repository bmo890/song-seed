import { useMemo } from "react";
import { buildCollectionPathLabel } from "../../../domain/libraryNavigation";
import { writableWorkspaces } from "../../../domain/workspaceVisibility";
import { getCollectionById } from "../../../utils";
import type { Workspace } from "../../../types";
import type { CollectionDestination } from "../types";

type Args = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  fallbackCollectionId: string | null;
};

/**
 * Where shared audio may land: collections in the person's OWN live workspaces.
 * A received parcel (read-only until Keep) and an archived workspace (its stub is
 * replaced on unarchive) are never offered, not even as "the current collection"
 * when the last page visited was inside one (data-safety audit 12f F-H1).
 */
export function resolveShareImportDestinations({ workspaces: allWorkspaces, activeWorkspaceId, fallbackCollectionId }: Args) {
  const workspaces = writableWorkspaces(allWorkspaces);
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

  const otherCollectionDestinations: CollectionDestination[] = workspaces
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
      const aCurrent = a.workspaceId === activeWorkspaceId ? 0 : 1;
      const bCurrent = b.workspaceId === activeWorkspaceId ? 0 : 1;
      return (
        aCurrent - bCurrent ||
        a.workspaceTitle.localeCompare(b.workspaceTitle) ||
        a.pathLabel.localeCompare(b.pathLabel)
      );
    });

  return {
    activeWorkspace,
    currentCollectionWorkspace,
    currentCollection,
    targetWorkspace,
    topLevelCollectionCount,
    otherCollectionDestinations,
  };
}

export function useShareImportDestinations({
  workspaces,
  activeWorkspaceId,
  fallbackCollectionId,
}: Args) {
  return useMemo(
    () => resolveShareImportDestinations({ workspaces, activeWorkspaceId, fallbackCollectionId }),
    [activeWorkspaceId, fallbackCollectionId, workspaces]
  );
}
