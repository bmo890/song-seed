import { useMemo, useState } from "react";
import { useStore } from "../../../state/useStore";
import { getWorkspaceListOrderState, sortWorkspacesWithPrimary } from "../../../libraryNavigation";
import type { WorkspaceListOrder } from "../../../types";
import type { SelectionAction } from "../../common/SelectionDock";
import { useWorkspaceSelection } from "./useWorkspaceSelection";
import { useWorkspaceArchiveActions } from "./useWorkspaceArchiveActions";

function defaultWorkspaceTitle() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `New Workspace ${dd}/${mm}/${yyyy}`;
}

export function useWorkspaceListScreenModel() {
  const workspaces = useStore((s) => s.workspaces);
  const primaryWorkspaceId = useStore((s) => s.primaryWorkspaceId);
  const setPrimaryWorkspaceId = useStore((s) => s.setPrimaryWorkspaceId);
  const workspaceListOrder = useStore((s) => s.workspaceListOrder);
  const setWorkspaceListOrder = useStore((s) => s.setWorkspaceListOrder);
  const workspaceLastOpenedAt = useStore((s) => s.workspaceLastOpenedAt);
  const addWorkspace = useStore((s) => s.addWorkspace);
  const updateWorkspace = useStore((s) => s.updateWorkspace);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);
  const clipClipboard = useStore((s) => s.clipClipboard);
  const setClipClipboard = useStore((s) => s.setClipClipboard);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewingArchived, setViewingArchived] = useState(false);

  const editingWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === editId) ?? null,
    [workspaces, editId]
  );
  const isEditing = !!editId && !!editingWorkspace;
  const filteredWorkspaces = useMemo(
    () =>
      sortWorkspacesWithPrimary(
        workspaces.filter((workspace) =>
          viewingArchived ? workspace.isArchived : !workspace.isArchived
        ),
        primaryWorkspaceId,
        workspaceListOrder,
        workspaceLastOpenedAt
      ),
    [primaryWorkspaceId, viewingArchived, workspaceLastOpenedAt, workspaceListOrder, workspaces]
  );
  const workspaceOrderState = getWorkspaceListOrderState(workspaceListOrder);
  const workspaceOrderOptions: Array<{
    key: WorkspaceListOrder;
    label: string;
    icon: string;
  }> = [
    { key: "last-worked", label: "Last worked", icon: "time-outline" },
    { key: "least-recent", label: "Least recent", icon: "time-outline" },
    { key: "title-az", label: "Title A-Z", icon: "text-outline" },
    { key: "title-za", label: "Title Z-A", icon: "text-outline" },
  ];
  const activeWorkspaceCount = workspaces.filter((workspace) => !workspace.isArchived).length;

  const subtitle = viewingArchived
    ? "Archived workspaces stay out of the active list while their audio is stored in a compressed package."
    : primaryWorkspaceId
      ? "Your primary workspace stays first. The rest follow your chosen order."
      : "Choose a workspace to continue. Archived workspaces are kept separately.";

  const selection = useWorkspaceSelection({ filteredWorkspaces, workspaces });

  function cancelClipboard() {
    setClipClipboard(null);
  }

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
  }

  function openWorkspaceActions(workspaceId: string) {
    if (archiveActions.busyWorkspaceId) return;
    setEditId(workspaceId);
    setModalOpen(true);
  }

  const archiveActions = useWorkspaceArchiveActions({
    activeWorkspaceCount,
    closeModal,
    deleteWorkspace,
    onClearSelection: () => selection.setSelectedWorkspaceIds([]),
    onCloseSelectionMore: () => selection.setSelectionMoreVisible(false),
    selectedWorkspaces: selection.selectedWorkspaces,
    viewingArchived,
  });
  const singleSelectedWorkspace = selection.singleSelectedWorkspace;

  const selectionDockActions: SelectionAction[] = singleSelectedWorkspace
    ? viewingArchived
      ? [
          {
            key: "rename",
            label: "Rename",
            icon: "create-outline",
            onPress: () => {
              openWorkspaceActions(singleSelectedWorkspace.id);
              selection.setSelectedWorkspaceIds([]);
            },
          },
          {
            key: "restore",
            label: "Unarchive",
            icon: "arrow-up-circle-outline",
            onPress: () => archiveActions.confirmArchiveSelection("restore"),
          },
          {
            key: "more",
            label: "More",
            icon: "ellipsis-horizontal",
            onPress: () => selection.setSelectionMoreVisible(true),
          },
        ]
      : [
          {
            key: "rename",
            label: "Rename",
            icon: "create-outline",
            onPress: () => {
              openWorkspaceActions(singleSelectedWorkspace.id);
              selection.setSelectedWorkspaceIds([]);
            },
          },
          {
            key: "primary",
            label:
              primaryWorkspaceId === singleSelectedWorkspace.id
                ? "Main workspace"
                : "Set main",
            icon:
              primaryWorkspaceId === singleSelectedWorkspace.id
                ? "star"
                : "star-outline",
            onPress: () => {
              if (primaryWorkspaceId === singleSelectedWorkspace.id) return;
              setPrimaryWorkspaceId(singleSelectedWorkspace.id);
              selection.setSelectedWorkspaceIds([]);
            },
            disabled: primaryWorkspaceId === singleSelectedWorkspace.id,
          },
          {
            key: "archive",
            label: "Archive",
            icon: "archive-outline",
            onPress: () => archiveActions.confirmArchiveSelection("archive"),
          },
          {
            key: "more",
            label: "More",
            icon: "ellipsis-horizontal",
            onPress: () => selection.setSelectionMoreVisible(true),
          },
        ]
    : [
        {
          key: viewingArchived ? "restore" : "archive",
          label: viewingArchived ? "Unarchive" : "Archive",
          icon: viewingArchived ? "arrow-up-circle-outline" : "archive-outline",
          onPress: () =>
            archiveActions.confirmArchiveSelection(viewingArchived ? "restore" : "archive"),
        },
        {
          key: "more",
          label: "More",
          icon: "ellipsis-horizontal",
          onPress: () => selection.setSelectionMoreVisible(true),
        },
      ];

  const selectionSheetActions: SelectionAction[] = [
    {
      key: "toggle-all",
      label: selection.canDeselectAll ? "Deselect all" : "Select all",
      icon: selection.canDeselectAll
        ? "remove-circle-outline"
        : "checkmark-circle-outline",
      onPress: () =>
        selection.setSelectedWorkspaceIds(
          selection.canDeselectAll ? [] : selection.selectableWorkspaceIds
        ),
      disabled:
        !selection.canDeselectAll && selection.selectableWorkspaceIds.length === 0,
    },
    {
      key: "delete",
      label: "Delete",
      icon: "trash-outline",
      tone: "danger",
      onPress: archiveActions.confirmDeleteSelection,
    },
  ];

  function saveWorkspace(name: string, description?: string) {
    if (archiveActions.busyWorkspaceId) return;
    const finalName = name || defaultWorkspaceTitle();
    if (isEditing && editingWorkspace) {
      updateWorkspace(editingWorkspace.id, { title: finalName, description });
    } else {
      addWorkspace(finalName, description);
    }
    closeModal();
  }

  return {
    clipClipboard,
    cancelClipboard,
    data: {
      filteredWorkspaces,
      primaryWorkspaceId,
      workspaceListOrder,
      workspaceOrderState,
      workspaceOrderOptions,
      viewingArchived,
      subtitle,
      activeWorkspaceCount,
      busyWorkspaceId: archiveActions.busyWorkspaceId,
      busyLabel: archiveActions.busyLabel,
      selectionMode: selection.selectionMode,
    },
    modal: {
      modalOpen,
      setModalOpen,
      editId,
      setEditId,
      editingWorkspace,
      isEditing,
      closeModal,
      openWorkspaceActions,
      saveWorkspace,
    },
    selection: {
      selectedWorkspaceIds: selection.selectedWorkspaceIds,
      setSelectedWorkspaceIds: selection.setSelectedWorkspaceIds,
      selectionMoreVisible: selection.selectionMoreVisible,
      setSelectionMoreVisible: selection.setSelectionMoreVisible,
      selectionDockHeight: selection.selectionDockHeight,
      setSelectionDockHeight: selection.setSelectionDockHeight,
      selectionDockActions,
      selectionSheetActions,
      toggleWorkspaceSelection: selection.toggleWorkspaceSelection,
    },
    actions: {
      setViewingArchived,
      setWorkspaceListOrder,
      setPrimaryWorkspaceId,
      confirmArchiveWorkspace: archiveActions.confirmArchiveWorkspace,
      confirmDeleteWorkspace: archiveActions.confirmDeleteWorkspace,
    },
  };
}
