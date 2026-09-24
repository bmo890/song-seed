import type { ClipVersion, SongIdea, Workspace } from "../types";

/**
 * Narrow library selectors for always-mounted surfaces (dock, player, side nav,
 * queue). Subscribing to the whole `workspaces` array re-rendered each of them
 * on every library write — 125–370 ms of app-wide fan-out per edit (2026-09-24).
 * These return the one object (or one primitive key) a surface depends on, so
 * zustand's equality check skips the re-render when that object is untouched.
 * Ideas keep their identity across unrelated writes (see updateIdeas), which is
 * what makes returning the idea object itself a stable subscription.
 */

/** The idea, looked up in the preferred workspace first, then everywhere. */
export function findIdeaInLibrary(
  workspaces: Workspace[],
  ideaId: string | null | undefined,
  preferWorkspaceId?: string | null
): SongIdea | null {
  if (!ideaId) return null;
  if (preferWorkspaceId) {
    const preferred = workspaces.find((workspace) => workspace.id === preferWorkspaceId);
    const inPreferred = preferred?.ideas.find((idea) => idea.id === ideaId);
    if (inPreferred) return inPreferred;
  }
  for (const workspace of workspaces) {
    if (workspace.id === preferWorkspaceId) continue;
    const idea = workspace.ideas.find((candidate) => candidate.id === ideaId);
    if (idea) return idea;
  }
  return null;
}

// One index per library write, shared by every row on screen: a WeakMap keyed by
// the workspaces array itself, so a new library (any write) builds a new index once
// and an unchanged library never rebuilds it. This is what lets each list row read
// its own idea from the store in O(1) instead of the list handing every row its idea.
const ideaIndexByWorkspaces = new WeakMap<Workspace[], Map<string, SongIdea>>();

export function getIdeaIndex(workspaces: Workspace[]): Map<string, SongIdea> {
  let index = ideaIndexByWorkspaces.get(workspaces);
  if (!index) {
    index = new Map();
    for (const workspace of workspaces) {
      for (const idea of workspace.ideas) {
        if (!index.has(idea.id)) index.set(idea.id, idea);
      }
    }
    ideaIndexByWorkspaces.set(workspaces, index);
  }
  return index;
}

/** The idea by id — the same object while the idea is untouched, so a row subscribed
 *  through this re-renders only when ITS idea changes. */
export function selectIdeaById(workspaces: Workspace[], ideaId: string): SongIdea | null {
  return getIdeaIndex(workspaces).get(ideaId) ?? null;
}

export function findWorkspaceOfIdea(workspaces: Workspace[], ideaId: string | null | undefined): Workspace | null {
  if (!ideaId) return null;
  return workspaces.find((workspace) => workspace.ideas.some((idea) => idea.id === ideaId)) ?? null;
}

export function findClipInIdea(idea: SongIdea | null, clipId: string | null | undefined): ClipVersion | null {
  if (!idea || !clipId) return null;
  return idea.clips.find((clip) => clip.id === clipId) ?? null;
}

/** A primitive fingerprint of what a queue listing shows — titles and lengths — so a
 *  component can re-render only when one of them changes, not on every library write. */
export function queueListingKey(
  workspaces: Workspace[],
  queue: ReadonlyArray<{ ideaId: string; clipId: string }>
): string {
  if (queue.length === 0) return "";
  const parts: string[] = [];
  for (const item of queue) {
    const idea = findIdeaInLibrary(workspaces, item.ideaId);
    const clip = findClipInIdea(idea, item.clipId);
    parts.push(`${item.ideaId}:${item.clipId}:${idea?.title ?? ""}:${clip?.title ?? ""}:${clip?.durationMs ?? ""}`);
  }
  return parts.join("\n");
}
