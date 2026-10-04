import type { Workspace } from "../types";

/**
 * A draft sketch is hidden from the collection until its edit sheet is saved
 * or discarded. Killed mid-edit, it stayed a draft forever — and the clips
 * gathered into it were "gone" (2026-10-04). On launch nothing is being
 * edited, so a leftover draft with clips becomes a real sketch under its
 * placeholder name, and an empty one is removed. Untouched workspaces keep
 * their identity.
 */
export function recoverStrandedDraftIdeas(workspaces: Workspace[]) {
  let recovered = 0;
  let removed = 0;
  const next = workspaces.map((workspace) => {
    if (!workspace.ideas.some((idea) => idea.isDraft)) return workspace;
    return {
      ...workspace,
      ideas: workspace.ideas
        .filter((idea) => {
          if (idea.isDraft && idea.clips.length === 0) {
            removed += 1;
            return false;
          }
          return true;
        })
        .map((idea) => {
          if (!idea.isDraft) return idea;
          recovered += 1;
          return { ...idea, isDraft: false };
        }),
    };
  });
  return { workspaces: recovered === 0 && removed === 0 ? workspaces : next, recovered, removed };
}
