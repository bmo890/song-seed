import { Collection, Workspace } from "../types";
import { i18n } from "../i18n/instance";
import { getCollectionAncestors, getCollectionDescendantIds } from "../utils";
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
  /** Workspace identity, so the picker can wear the same avatar as the side menu. */
  workspaceColor?: string;
  workspaceAvatarKey?: number;
  collectionId: string;
  label: string;
  /** Set when the collection is nested, e.g. "Band stuff / Rehearsals". */
  pathLabel?: string;
  /** Nesting depth (0 = top level). Destinations are emitted in tree order, so a
   *  child always follows its parent and the picker can indent instead of joining paths. */
  depth: number;
  /** Ideas filed directly in this collection (children count their own). */
  itemCount: number;
  lastWorkedAt: number;
};

/** Every collection across every workspace, grouped by workspace, in tree order: most
 * recently worked first among siblings, each child directly under its parent. Used to let
 * a fresh recording be saved somewhere other than the collection it was started from. */
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
    const collectionIds = new Set(workspace.collections.map((collection) => collection.id));
    const lastWorked = new Map(
      workspace.collections.map((collection) => [
        collection.id,
        getCollectionLastWorkedAt(workspace, collection.id),
      ])
    );
    const directCounts = new Map<string, number>();
    for (const idea of workspace.ideas) {
      directCounts.set(idea.collectionId, (directCounts.get(idea.collectionId) ?? 0) + 1);
    }
    const childrenOf = new Map<string | null, Collection[]>();
    for (const collection of workspace.collections) {
      // An orphan (parent missing) surfaces at the top level rather than vanishing.
      const parentId =
        collection.parentCollectionId && collectionIds.has(collection.parentCollectionId)
          ? collection.parentCollectionId
          : null;
      const siblings = childrenOf.get(parentId);
      if (siblings) siblings.push(collection);
      else childrenOf.set(parentId, [collection]);
    }

    const result: SaveDestination[] = [];
    const visited = new Set<string>();
    const visit = (parentId: string | null, depth: number) => {
      const siblings = [...(childrenOf.get(parentId) ?? [])].sort(
        (a, b) => (lastWorked.get(b.id) ?? 0) - (lastWorked.get(a.id) ?? 0)
      );
      for (const collection of siblings) {
        if (visited.has(collection.id)) continue; // guard against a corrupt parent cycle
        visited.add(collection.id);
        const ancestors = getCollectionAncestors(workspace, collection.id);
        result.push({
          workspaceId: workspace.id,
          workspaceTitle: workspace.title,
          workspaceColor: workspace.color,
          workspaceAvatarKey: workspace.avatarKey,
          collectionId: collection.id,
          label: collection.title,
          pathLabel:
            ancestors.length > 0
              ? [...ancestors.map((item) => item.title), collection.title].join(" / ")
              : undefined,
          depth,
          itemCount: directCounts.get(collection.id) ?? 0,
          lastWorkedAt: lastWorked.get(collection.id) ?? 0,
        });
        visit(collection.id, depth + 1);
      }
    };
    visit(null, 0);
    return result;
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
    workspaceColor: workspace.color,
    workspaceAvatarKey: workspace.avatarKey,
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
        label: i18n.t("workspaceBrowse.topLevel"),
        subtitle: i18n.t("workspaceBrowse.topLevelHint"),
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
        subtitle: i18n.t("workspaceBrowse.intoCollectionHint"),
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
