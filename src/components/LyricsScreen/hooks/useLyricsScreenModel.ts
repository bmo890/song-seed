import { useMemo } from "react";
import { useStore } from "../../../state/useStore";

export function useLyricsScreenModel() {
  const selectedIdeaId = useStore((state) => state.selectedIdeaId);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const workspaces = useStore((state) => state.workspaces);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );
  const projectIdea = useMemo(() => {
    const idea = activeWorkspace?.ideas.find((candidate) => candidate.id === selectedIdeaId) ?? null;
    return idea?.kind === "project" ? idea : null;
  }, [activeWorkspace, selectedIdeaId]);
  const versionCount = projectIdea?.lyrics?.versions.length ?? 0;

  return {
    projectIdea,
    versionCount,
  };
}
