import { Collection, Workspace } from "./types";
import { getCollectionAncestors, getCollectionDescendantIds } from "./utils";
import { getCollectionLastWorkedAt } from "./libraryNavigation";

export type CollectionMoveDestination = {
  workspaceId: string;
  workspaceTitle: string;
  parentCollectionId: string | null;
  label: string;
  subtitle?: string;
};

export type SaveDestination = {
  workspaceId: string;
  workspaceTitle: string;
  collectionId: string;
  label: string;
  /** Set when the collection is nested, e.g. "Band stuff / Rehearsals". */
  pathLabel?: string;
};

/** Every collection across every workspace, grouped by workspace, most recently worked first
 * within each workspace. Used to let a fresh recording be saved somewhere other than the
 * collection it was started from. */
export function buildSaveDestinations(
  workspaces: Workspace[],
  activeWorkspaceId: string | null
): SaveDestination[] {
  const orderedWorkspaces = [...workspaces].sort((a, b) => {
    if (a.id === activeWorkspaceId) return -1;
    if (b.id === activeWorkspaceId) return 1;
    return a.title.localeCompare(b.title);
  });

  return orderedWorkspaces.flatMap((workspace) => {
    const collections = [...workspace.collections].sort(
      (a, b) => getCollectionLastWorkedAt(workspace, b.id) - getCollectionLastWorkedAt(workspace, a.id)
    );

    return collections.map((collection) => {
      const ancestors = getCollectionAncestors(workspace, collection.id);
      return {
        workspaceId: workspace.id,
        workspaceTitle: workspace.title,
        collectionId: collection.id,
        label: collection.title,
        pathLabel:
          ancestors.length > 0
            ? [...ancestors.map((item) => item.title), collection.title].join(" / ")
            : undefined,
      } satisfies SaveDestination;
    });
  });
}

export function resolveSaveDestinationLabel(
  workspaces: Workspace[],
  workspaceId: string | null,
  collectionId: string | null
) {
  if (!workspaceId || !collectionId) return null;
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId);
  const collection = workspace?.collections.find((candidate) => candidate.id === collectionId);
  if (!workspace || !collection) return null;
  return {
    workspaceTitle: workspace.title,
    collectionLabel: collection.title,
  };
}

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
