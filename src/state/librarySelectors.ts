import type { ClipVersion, SongIdea, Workspace } from "../types";
import { getClipPlaybackDurationMs } from "../domain/clipPresentation";

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
type IdeaIndex = { all: Map<string, SongIdea>; byWorkspace: Map<string, Map<string, SongIdea>> };
const ideaIndexByWorkspaces = new WeakMap<Workspace[], IdeaIndex>();

export function getIdeaIndex(workspaces: Workspace[]): IdeaIndex {
  let index = ideaIndexByWorkspaces.get(workspaces);
  if (!index) {
    const all = new Map<string, SongIdea>();
    const byWorkspace = new Map<string, Map<string, SongIdea>>();
    for (const workspace of workspaces) {
      const own = new Map<string, SongIdea>();
      for (const idea of workspace.ideas) {
        own.set(idea.id, idea);
        if (!all.has(idea.id)) all.set(idea.id, idea);
      }
      byWorkspace.set(workspace.id, own);
    }
    index = { all, byWorkspace };
    ideaIndexByWorkspaces.set(workspaces, index);
  }
  return index;
}

/** The idea by id — the same object while the idea is untouched, so a row subscribed
 *  through this re-renders only when ITS idea changes. With `preferWorkspaceId` the
 *  workspace's own copy wins should the same id exist in two workspaces. */
export function selectIdeaById(
  workspaces: Workspace[],
  ideaId: string,
  preferWorkspaceId?: string | null
): SongIdea | null {
  const index = getIdeaIndex(workspaces);
  if (preferWorkspaceId) {
    const own = index.byWorkspace.get(preferWorkspaceId)?.get(ideaId);
    if (own) return own;
  }
  return index.all.get(ideaId) ?? null;
}

export function findWorkspaceOfIdea(workspaces: Workspace[], ideaId: string | null | undefined): Workspace | null {
  if (!ideaId) return null;
  return workspaces.find((workspace) => workspace.ideas.some((idea) => idea.id === ideaId)) ?? null;
}

export function findClipInIdea(idea: SongIdea | null, clipId: string | null | undefined): ClipVersion | null {
  if (!idea || !clipId) return null;
  return idea.clips.find((clip) => clip.id === clipId) ?? null;
}

/** A primitive fingerprint of what a queue listing shows — titles, lengths and the
 *  workspace each item lives in ("view in collection" needs it) — so a component
 *  re-renders only when one of them changes, not on every library write. */
export function queueListingKey(
  workspaces: Workspace[],
  queue: ReadonlyArray<{ ideaId: string; clipId: string }>
): string {
  if (queue.length === 0) return "";
  const parts: string[] = [];
  for (const item of queue) {
    const idea = findIdeaInLibrary(workspaces, item.ideaId);
    const clip = findClipInIdea(idea, item.clipId);
    const workspaceId = findWorkspaceOfIdea(workspaces, item.ideaId)?.id ?? "";
    // The playable length (a rendered overdub mix outranks the raw take) is what the row shows.
    const lengthMs = clip ? getClipPlaybackDurationMs(clip) ?? clip.durationMs ?? "" : "";
    parts.push(`${item.ideaId}:${item.clipId}:${workspaceId}:${idea?.title ?? ""}:${clip?.title ?? ""}:${lengthMs}`);
  }
  return parts.join("\n");
}
