import type { Collection, SongIdea, Workspace } from "../types";
import { isReadOnlyWorkspace } from "./workspaceVisibility";

/**
 * "Which workspace owns this?" — the one answer every item-level write uses
 * (data-safety audit 2026-11-02, root cause 2). Screens show ideas from any
 * workspace (the player's queue, Search, Activity, a visited collection, a
 * received parcel), so an edit keyed by an idea or collection id must land where
 * that item lives, never in "the active workspace".
 */

export function locateIdea(
  workspaces: Workspace[],
  ideaId: string | null | undefined
): { workspace: Workspace; idea: SongIdea } | null {
  if (!ideaId) return null;
  for (const workspace of workspaces) {
    const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
    if (idea) return { workspace, idea };
  }
  return null;
}

/** The id of the workspace that holds an idea, or null. */
export function ideaOwnerWorkspaceId(workspaces: Workspace[], ideaId: string | null | undefined): string | null {
  return locateIdea(workspaces, ideaId)?.workspace.id ?? null;
}

export function locateCollection(
  workspaces: Workspace[],
  collectionId: string | null | undefined
): { workspace: Workspace; collection: Collection } | null {
  if (!collectionId) return null;
  for (const workspace of workspaces) {
    const collection = workspace.collections.find((candidate) => candidate.id === collectionId);
    if (collection) return { workspace, collection };
  }
  return null;
}

/** The id of the workspace that holds a collection, or null. */
export function collectionOwnerWorkspaceId(
  workspaces: Workspace[],
  collectionId: string | null | undefined
): string | null {
  return locateCollection(workspaces, collectionId)?.workspace.id ?? null;
}

/** True when the idea lives in a read-only workspace (a received parcel before
 *  Keep, or an archived workspace). A missing idea is not read-only: callers that
 *  need the idea check for it themselves. */
export function isIdeaReadOnly(workspaces: Workspace[], ideaId: string | null | undefined): boolean {
  return isReadOnlyWorkspace(locateIdea(workspaces, ideaId)?.workspace);
}

/** True when the collection lives in a read-only workspace. */
export function isCollectionReadOnly(workspaces: Workspace[], collectionId: string | null | undefined): boolean {
  return isReadOnlyWorkspace(locateCollection(workspaces, collectionId)?.workspace);
}
