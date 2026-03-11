import { Collection, Workspace } from "./types";
import { getCollectionDescendantIds } from "./utils";

export type CollectionMoveDestination = {
  workspaceId: string;
  workspaceTitle: string;
  parentCollectionId: string | null;
  label: string;
  subtitle?: string;
};

export function findWorkspaceWithCollection(workspaces: Workspace[], collectionId: string) {
  return (
    workspaces.find((workspace) =>
      workspace.collections.some((collection) => collection.id === collectionId)
    ) ?? null
  );
}

export function buildCollectionMoveDestinations(
  workspaces: Workspace[],
  collection: Collection | null,
  activeWorkspaceId: string | null
): CollectionMoveDestination[] {
  if (!collection) return [];
  const sourceWorkspace = findWorkspaceWithCollection(workspaces, collection.id);
  if (!sourceWorkspace) return [];

  const descendantIds = getCollectionDescendantIds(sourceWorkspace, collection.id);
  const hasChildCollections = descendantIds.size > 0;

  return workspaces.flatMap((workspace) => {
    const workspaceDestinations: CollectionMoveDestination[] = [];
    const currentIsSameWorkspace = workspace.id === activeWorkspaceId;

    if (!(currentIsSameWorkspace && !collection.parentCollectionId)) {
      workspaceDestinations.push({
        workspaceId: workspace.id,
        workspaceTitle: workspace.title,
        parentCollectionId: null,
        label: "Top level",
        subtitle: "Place this collection directly in the workspace.",
      });
    }

    if (hasChildCollections) {
      return workspaceDestinations;
    }

    const availableParents = workspace.collections.filter(
      (candidate) => !candidate.parentCollectionId && candidate.id !== collection.id
    );

    for (const candidate of availableParents) {
      if (
        currentIsSameWorkspace &&
        (collection.parentCollectionId ?? null) === candidate.id
      ) {
        continue;
      }

      workspaceDestinations.push({
        workspaceId: workspace.id,
        workspaceTitle: workspace.title,
        parentCollectionId: candidate.id,
        label: candidate.title,
        subtitle: "Move into this collection as a subcollection.",
      });
    }

    return workspaceDestinations;
  });
}

export function getCollectionDeleteScope(workspace: Workspace, collectionId: string) {
  const descendantIds = getCollectionDescendantIds(workspace, collectionId);
  const deleteScopeIds = new Set<string>([collectionId, ...descendantIds]);
  const childCollectionCount = workspace.collections.filter((collection) =>
    descendantIds.has(collection.id)
  ).length;
  const itemCount = workspace.ideas.filter((idea) =>
    deleteScopeIds.has(idea.collectionId)
  ).length;

  return {
    descendantIds,
    deleteScopeIds,
    childCollectionCount,
    itemCount,
  };
}
