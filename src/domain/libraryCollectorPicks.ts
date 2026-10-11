import type { SongIdea, Workspace } from "../types";

/** One pick in a compilation's picking session. The workspace rides along so
 *  a basket gathered across workspaces resolves every idea where it lives. */
export type LibraryCollectorPick = { workspaceId: string; ideaId: string };

export type ResolvedCollectorPick = { workspace: Workspace; idea: SongIdea };

/** Resolve picks to live ideas, in pick order. Picks whose idea has since been
 *  deleted (or moved out of its workspace) drop out silently — there is nothing
 *  to add. */
export function resolveCollectorPicks(
  workspaces: Workspace[],
  picks: LibraryCollectorPick[]
): ResolvedCollectorPick[] {
  const resolved: ResolvedCollectorPick[] = [];
  for (const pick of picks) {
    const workspace =
      workspaces.find((ws) => ws.id === pick.workspaceId && ws.ideas.some((idea) => idea.id === pick.ideaId)) ??
      workspaces.find((ws) => ws.ideas.some((idea) => idea.id === pick.ideaId));
    const idea = workspace?.ideas.find((candidate) => candidate.id === pick.ideaId);
    if (workspace && idea) resolved.push({ workspace, idea });
  }
  return resolved;
}
