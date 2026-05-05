import { useEffect, useMemo, useState } from "react";
import type { Workspace } from "../../../types";

type Args = {
  filteredWorkspaces: Workspace[];
  workspaces: Workspace[];
};

export function useWorkspaceSelection({ filteredWorkspaces, workspaces }: Args) {
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [selectionMoreVisible, setSelectionMoreVisible] = useState(false);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);

  const selectableWorkspaceIds = useMemo(
    () => filteredWorkspaces.map((workspace) => workspace.id),
    [filteredWorkspaces]
  );
  const selectableWorkspaceIdsKey = selectableWorkspaceIds.join("|");
  const selectedWorkspaces = useMemo(
    () => workspaces.filter((workspace) => selectedWorkspaceIds.includes(workspace.id)),
    [selectedWorkspaceIds, workspaces]
  );
  const singleSelectedWorkspace =
    selectedWorkspaces.length === 1 ? selectedWorkspaces[0] ?? null : null;
  const selectionMode = selectedWorkspaceIds.length > 0;
  const allSelectableSelected =
    selectableWorkspaceIds.length > 0 &&
    selectableWorkspaceIds.every((workspaceId) => selectedWorkspaceIds.includes(workspaceId));
  const canDeselectAll =
    allSelectableSelected ||
    (selectableWorkspaceIds.length === 0 && selectedWorkspaceIds.length > 0);

  useEffect(() => {
    if (selectedWorkspaceIds.length === 0) return;
    const visibleWorkspaceIdSet = new Set(
      selectableWorkspaceIdsKey ? selectableWorkspaceIdsKey.split("|") : []
    );
    const next = selectedWorkspaceIds.filter((workspaceId) => visibleWorkspaceIdSet.has(workspaceId));
    if (
      next.length === selectedWorkspaceIds.length &&
      next.every((workspaceId, index) => workspaceId === selectedWorkspaceIds[index])
    ) {
      return;
    }
    setSelectedWorkspaceIds(next);
  }, [selectableWorkspaceIdsKey, selectedWorkspaceIds]);

  function toggleWorkspaceSelection(workspaceId: string) {
    setSelectedWorkspaceIds((prev) =>
      prev.includes(workspaceId)
        ? prev.filter((candidateId) => candidateId !== workspaceId)
        : [...prev, workspaceId]
    );
  }

  return {
    selectedWorkspaceIds,
    setSelectedWorkspaceIds,
    selectionMoreVisible,
    setSelectionMoreVisible,
    selectionDockHeight,
    setSelectionDockHeight,
    selectableWorkspaceIds,
    selectedWorkspaces,
    singleSelectedWorkspace,
    selectionMode,
    canDeselectAll,
    toggleWorkspaceSelection,
  };
}
