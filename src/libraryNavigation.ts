import { getIdeaUpdatedAt } from "./ideaSort";
import {
  Collection,
  Playlist,
  SongIdea,
  Workspace,
  WorkspaceListOrder,
  WorkspaceStartupPreference,
} from "./types";
import { getCollectionAncestors, getCollectionById, getCollectionScopeIds } from "./utils";

export type CollectionSearchMatchKind = "collection" | "subcollection" | "song" | "clip";

export type CollectionSearchMatch = {
  kind: CollectionSearchMatchKind;
  label: string;
  context: string | null;
};

export type WorkspaceCollectionBrowseEntry = {
  collection: Collection;
  childCollectionCount: number;
  itemCount: number;
  lastWorkedAt: number;
  matchScore: number;
  matches: CollectionSearchMatch[];
};

export type RecentWorkspaceCollection = {
  collection: Collection;
  level: "collection";
  pathLabel: string | null;
  recentAt: number;
};

export const DEFAULT_WORKSPACE_STARTUP_PREFERENCE: WorkspaceStartupPreference = "last-used";
export const DEFAULT_WORKSPACE_LIST_ORDER: WorkspaceListOrder = "last-worked";

const VALID_WORKSPACE_STARTUP_PREFERENCES: readonly WorkspaceStartupPreference[] = [
  "primary",
  "last-used",
];

const VALID_WORKSPACE_LIST_ORDERS: readonly WorkspaceListOrder[] = [
  "last-worked",
  "least-recent",
  "title-az",
  "title-za",
];

type SearchCandidate = CollectionSearchMatch & {
  score: number;
};

function compareStringsAsc(a: string, b: string) {
  return a.localeCompare(b);
}

function getTopLevelCollectionCount(workspace: Workspace) {
  return workspace.collections.filter((collection) => !collection.parentCollectionId).length;
}

function getRelativeCollectionPathLabel(workspace: Workspace, rootCollectionId: string, collectionId: string) {
  const collection = getCollectionById(workspace, collectionId);
  if (!collection || collection.id === rootCollectionId) return null;

  const ancestors = getCollectionAncestors(workspace, collectionId);
  const rootIndex = ancestors.findIndex((item) => item.id === rootCollectionId);
  const pathItems =
    rootIndex >= 0 ? [...ancestors.slice(rootIndex + 1), collection] : [collection];
  const label = pathItems.map((item) => item.title).join(" / ");
  return label.length > 0 ? label : null;
}

function getRelativeParentCollectionPathLabel(
  workspace: Workspace,
  rootCollectionId: string,
  collectionId: string
) {
  const collection = getCollectionById(workspace, collectionId);
  if (!collection || collection.id === rootCollectionId) return null;

  const ancestors = getCollectionAncestors(workspace, collectionId);
  const rootIndex = ancestors.findIndex((item) => item.id === rootCollectionId);
  const pathItems = rootIndex >= 0 ? ancestors.slice(rootIndex + 1) : ancestors;
  const label = pathItems.map((item) => item.title).join(" / ");
  return label.length > 0 ? label : null;
}

function getCollectionScopedIdeas(workspace: Workspace, collectionId: string) {
  const scopeIds = getCollectionScopeIds(workspace, collectionId);
  return workspace.ideas.filter((idea) => scopeIds.has(idea.collectionId));
}

function pushSearchCandidate(
  candidates: SearchCandidate[],
  seen: Set<string>,
  candidate: SearchCandidate
) {
  const key = `${candidate.kind}:${candidate.label.toLowerCase()}:${candidate.context ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push(candidate);
}

function getCollectionSearchCandidates(
  workspace: Workspace,
  rootCollection: Collection,
  needle: string
) {
  if (!needle) return { matches: [] as CollectionSearchMatch[], matchScore: 0 };

  const scopeIds = getCollectionScopeIds(workspace, rootCollection.id);
  const candidates: SearchCandidate[] = [];
  const seen = new Set<string>();

  if (rootCollection.title.toLowerCase().includes(needle)) {
    pushSearchCandidate(candidates, seen, {
      kind: "collection",
      label: rootCollection.title,
      context: null,
      score: 400,
    });
  }

  workspace.collections
    .filter((collection) => scopeIds.has(collection.id) && collection.id !== rootCollection.id)
    .forEach((collection) => {
      if (!collection.title.toLowerCase().includes(needle)) return;
      pushSearchCandidate(candidates, seen, {
        kind: "subcollection",
        label: collection.title,
        context: getRelativeParentCollectionPathLabel(workspace, rootCollection.id, collection.id),
        score: 300,
      });
    });

  workspace.ideas
    .filter((idea) => scopeIds.has(idea.collectionId))
    .forEach((idea) => {
      const context = getRelativeCollectionPathLabel(workspace, rootCollection.id, idea.collectionId);

      if (idea.kind === "project" && idea.title.toLowerCase().includes(needle)) {
        pushSearchCandidate(candidates, seen, {
          kind: "song",
          label: idea.title,
          context,
          score: 220,
        });
      }

      if (idea.kind === "clip" && idea.title.toLowerCase().includes(needle)) {
        pushSearchCandidate(candidates, seen, {
          kind: "clip",
          label: idea.title,
          context,
          score: 200,
        });
      }

      idea.clips.forEach((clip) => {
        if (!clip.title.toLowerCase().includes(needle)) return;
        pushSearchCandidate(candidates, seen, {
          kind: "clip",
          label: clip.title,
          context,
          score: 180,
        });
      });
    });

  candidates.sort((a, b) => b.score - a.score || compareStringsAsc(a.label, b.label));

  return {
    matches: candidates.slice(0, 3).map(({ score: _score, ...match }) => match),
    matchScore: candidates[0]?.score ?? 0,
  };
}

export function isWorkspaceStartupPreference(value: unknown): value is WorkspaceStartupPreference {
  return (
    typeof value === "string" &&
    VALID_WORKSPACE_STARTUP_PREFERENCES.includes(value as WorkspaceStartupPreference)
  );
}

export function isWorkspaceListOrder(value: unknown): value is WorkspaceListOrder {
  return typeof value === "string" && VALID_WORKSPACE_LIST_ORDERS.includes(value as WorkspaceListOrder);
}

export function getWorkspaceListOrderState(order: WorkspaceListOrder) {
  switch (order) {
    case "title-az":
      return { direction: "asc" as const, icon: "text-outline", label: "Title A-Z" };
    case "title-za":
      return { direction: "desc" as const, icon: "text-outline", label: "Title Z-A" };
    case "least-recent":
      return { direction: "asc" as const, icon: "time-outline", label: "Least recent" };
    case "last-worked":
    default:
      return { direction: "desc" as const, icon: "time-outline", label: "Last worked" };
  }
}

export function getCollectionLastWorkedAt(workspace: Workspace, collectionId: string) {
  const scopeIds = getCollectionScopeIds(workspace, collectionId);
  let lastWorkedAt = 0;

  workspace.collections.forEach((collection) => {
    if (!scopeIds.has(collection.id)) return;
    lastWorkedAt = Math.max(lastWorkedAt, collection.createdAt, collection.updatedAt);
  });

  workspace.ideas.forEach((idea) => {
    if (!scopeIds.has(idea.collectionId)) return;
    lastWorkedAt = Math.max(lastWorkedAt, idea.createdAt, getIdeaUpdatedAt(idea));
  });

  return lastWorkedAt;
}

export function getWorkspaceLastWorkedAt(
  workspace: Workspace,
  workspaceLastOpenedAt: number | undefined
) {
  let lastWorkedAt = workspaceLastOpenedAt ?? 0;

  workspace.collections.forEach((collection) => {
    lastWorkedAt = Math.max(lastWorkedAt, collection.createdAt, collection.updatedAt);
  });

  workspace.ideas.forEach((idea) => {
    lastWorkedAt = Math.max(lastWorkedAt, idea.createdAt, getIdeaUpdatedAt(idea));
  });

  return lastWorkedAt;
}

function compareWorkspaces(
  a: Workspace,
  b: Workspace,
  order: WorkspaceListOrder,
  workspaceLastOpenedAt: Record<string, number>
) {
  if (order === "title-az" || order === "title-za") {
    const direction = order === "title-az" ? 1 : -1;
    return (
      direction * compareStringsAsc(a.title, b.title) ||
      getWorkspaceLastWorkedAt(b, workspaceLastOpenedAt[b.id]) -
        getWorkspaceLastWorkedAt(a, workspaceLastOpenedAt[a.id])
    );
  }

  const direction = order === "least-recent" ? 1 : -1;
  return (
    direction *
      (getWorkspaceLastWorkedAt(a, workspaceLastOpenedAt[a.id]) -
        getWorkspaceLastWorkedAt(b, workspaceLastOpenedAt[b.id])) ||
    compareStringsAsc(a.title, b.title)
  );
}

export function sortWorkspacesWithPrimary(
  workspaces: Workspace[],
  primaryWorkspaceId: string | null,
  order: WorkspaceListOrder,
  workspaceLastOpenedAt: Record<string, number>
) {
  const primaryWorkspace = primaryWorkspaceId
    ? workspaces.find((workspace) => workspace.id === primaryWorkspaceId) ?? null
    : null;
  const remaining = workspaces
    .filter((workspace) => workspace.id !== primaryWorkspaceId)
    .slice()
    .sort((a, b) => compareWorkspaces(a, b, order, workspaceLastOpenedAt));

  return primaryWorkspace ? [primaryWorkspace, ...remaining] : remaining;
}

export function resolveStartupWorkspaceId(args: {
  workspaces: Workspace[];
  primaryWorkspaceId: string | null;
  lastUsedWorkspaceId: string | null;
  preference: WorkspaceStartupPreference;
}) {
  const activeWorkspaces = args.workspaces.filter((workspace) => !workspace.isArchived);
  const pool = activeWorkspaces.length > 0 ? activeWorkspaces : args.workspaces;

  const findById = (id: string | null) =>
    id ? pool.find((workspace) => workspace.id === id) ?? null : null;

  const primaryWorkspace = findById(args.primaryWorkspaceId);
  const lastUsedWorkspace = findById(args.lastUsedWorkspaceId);

  if (args.preference === "primary") {
    return primaryWorkspace?.id ?? lastUsedWorkspace?.id ?? pool[0]?.id ?? null;
  }

  return lastUsedWorkspace?.id ?? primaryWorkspace?.id ?? pool[0]?.id ?? null;
}

export function buildCollectionPathLabel(workspace: Workspace, collectionId: string) {
  const collection = getCollectionById(workspace, collectionId);
  if (!collection) return "";
  return [...getCollectionAncestors(workspace, collectionId), collection]
    .map((item) => item.title)
    .join(" / ");
}

export function getRecentCollectionsForWorkspace(
  workspace: Workspace,
  collectionLastOpenedAt: Record<string, number>,
  limit = 2
) {
  return workspace.collections
    .filter((collection) => !collection.parentCollectionId)
    .map((collection) => {
      const scopeIds = getCollectionScopeIds(workspace, collection.id);
      const scopedCollections = workspace.collections.filter((candidate) => scopeIds.has(candidate.id));
      const scopedRecent = scopedCollections
        .map((candidate) => ({
          collection: candidate,
          recentAt: collectionLastOpenedAt[candidate.id] ?? 0,
        }))
        .sort(
          (a, b) =>
            b.recentAt - a.recentAt ||
            compareStringsAsc(a.collection.title, b.collection.title)
        );
      const topRecent = scopedRecent[0];

      return {
        collection,
        level: "collection" as const,
        pathLabel:
          topRecent && topRecent.collection.id !== collection.id
            ? buildCollectionPathLabel(workspace, topRecent.collection.id)
            : null,
        recentAt: Math.max(collectionLastOpenedAt[collection.id] ?? 0, topRecent?.recentAt ?? 0),
      };
    })
    .filter((item) => item.recentAt > 0)
    .sort((a, b) => b.recentAt - a.recentAt || compareStringsAsc(a.collection.title, b.collection.title))
    .slice(0, limit);
}

export function buildWorkspaceBrowseEntries(
  workspace: Workspace,
  searchQuery: string,
  primaryCollectionId: string | null = null
): WorkspaceCollectionBrowseEntry[] {
  const needle = searchQuery.trim().toLowerCase();

  const entries = workspace.collections
    .filter((collection) => !collection.parentCollectionId)
    .map((collection) => {
      const scopedIdeas = getCollectionScopedIdeas(workspace, collection.id);
      const { matches, matchScore } = getCollectionSearchCandidates(workspace, collection, needle);

      return {
        collection,
        childCollectionCount: workspace.collections.filter(
          (candidate) => candidate.parentCollectionId === collection.id
        ).length,
        itemCount: scopedIdeas.length,
        lastWorkedAt: getCollectionLastWorkedAt(workspace, collection.id),
        matchScore,
        matches,
      };
    });

  const filteredEntries = needle.length > 0
    ? entries.filter((entry) => entry.matchScore > 0)
    : entries;

  return filteredEntries.sort((a, b) => {
    if (primaryCollectionId) {
      if (a.collection.id === primaryCollectionId && b.collection.id !== primaryCollectionId) return -1;
      if (b.collection.id === primaryCollectionId && a.collection.id !== primaryCollectionId) return 1;
    }

    if (needle.length > 0) {
      return (
        b.matchScore - a.matchScore ||
        b.lastWorkedAt - a.lastWorkedAt ||
        compareStringsAsc(a.collection.title, b.collection.title)
      );
    }

    return (
      b.lastWorkedAt - a.lastWorkedAt ||
      compareStringsAsc(a.collection.title, b.collection.title)
    );
  });
}

export function getWorkspaceSummaryMeta(workspace: Workspace, workspaceLastOpenedAt: Record<string, number>) {
  return {
    topLevelCollectionCount: getTopLevelCollectionCount(workspace),
    lastWorkedAt: getWorkspaceLastWorkedAt(workspace, workspaceLastOpenedAt[workspace.id]),
  };
}

export function findPlaylist(playlists: Playlist[], playlistId: string | null) {
  return playlistId ? playlists.find((playlist) => playlist.id === playlistId) ?? null : null;
}

export function resolvePlaylistIdea(workspaces: Workspace[], item: Playlist["items"][number]) {
  const workspace = workspaces.find((candidate) => candidate.id === item.workspaceId) ?? null;
  if (!workspace) return null;
  const idea = workspace.ideas.find((candidate) => candidate.id === item.ideaId) ?? null;
  if (!idea) return null;
  return { workspace, idea };
}

export function resolvePlaylistClip(
  workspaces: Workspace[],
  item: Playlist["items"][number]
) {
  const resolvedIdea = resolvePlaylistIdea(workspaces, item);
  if (!resolvedIdea || !item.clipId) return null;
  const clip = resolvedIdea.idea.clips.find((candidate) => candidate.id === item.clipId) ?? null;
  if (!clip) return null;
  return { ...resolvedIdea, clip };
}

export function getIdeaPrimaryClip(idea: SongIdea) {
  return idea.clips.find((clip) => clip.isPrimary) ?? idea.clips[0] ?? null;
}
