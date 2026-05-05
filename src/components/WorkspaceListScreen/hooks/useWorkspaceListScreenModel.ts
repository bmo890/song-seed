import { useMemo, useState } from "react";
import { useStore } from "../../../state/useStore";
import { getWorkspaceListOrderState, sortWorkspacesWithPrimary } from "../../../libraryNavigation";
import type { WorkspaceListOrder } from "../../../types";
import { useWorkspaceArchiveActions } from "./useWorkspaceArchiveActions";
import type { SelectionAction } from "../../common/SelectionDock";

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

  // Action sheet for ellipsis button on each card
  const [actionSheetWorkspaceId, setActionSheetWorkspaceId] = useState<string | null>(null);

  const editingWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === editId) ?? null,
    [workspaces, editId]
  );
  const isEditing = !!editId && !!editingWorkspace;

  const actionSheetWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === actionSheetWorkspaceId) ?? null,
    [workspaces, actionSheetWorkspaceId]
  );

  const activeWorkspaces = useMemo(
    () =>
      sortWorkspacesWithPrimary(
        workspaces.filter((workspace) => !workspace.isArchived),
        primaryWorkspaceId,
        workspaceListOrder,
        workspaceLastOpenedAt
      ),
    [primaryWorkspaceId, workspaceLastOpenedAt, workspaceListOrder, workspaces]
  );

  const archivedWorkspaces = useMemo(
    () =>
      sortWorkspacesWithPrimary(
        workspaces.filter((workspace) => workspace.isArchived),
        primaryWorkspaceId,
        workspaceListOrder,
        workspaceLastOpenedAt
      ),
    [primaryWorkspaceId, workspaceLastOpenedAt, workspaceListOrder, workspaces]
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

  function cancelClipboard() {
    setClipClipboard(null);
  }

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
  }

  function openEditModal(workspaceId: string) {
    if (archiveActions.busyWorkspaceId) return;
    setEditId(workspaceId);
    setModalOpen(true);
    setActionSheetWorkspaceId(null);
  }

  function openWorkspaceActions(workspaceId: string) {
    if (archiveActions.busyWorkspaceId) return;
    setActionSheetWorkspaceId(workspaceId);
  }

  function closeActionSheet() {
    setActionSheetWorkspaceId(null);
  }

  const archiveActions = useWorkspaceArchiveActions({
    activeWorkspaceCount,
    closeModal,
    deleteWorkspace,
    onClearSelection: () => {},
    onCloseSelectionMore: () => {},
    selectedWorkspaces: [],
    viewingArchived: false,
  });

  // Actions shown in the ellipsis action sheet — computed for the target workspace
  const workspaceActionSheetActions: SelectionAction[] = useMemo(() => {
    if (!actionSheetWorkspace) return [];

    const actions: SelectionAction[] = [
      {
        key: "edit",
        label: "Edit workspace",
        icon: "create-outline",
        onPress: () => openEditModal(actionSheetWorkspace.id),
      },
    ];

    if (!actionSheetWorkspace.isArchived) {
      actions.push({
        key: "primary",
        label: primaryWorkspaceId === actionSheetWorkspace.id ? "Primary workspace" : "Set as primary",
        icon: primaryWorkspaceId === actionSheetWorkspace.id ? "star" : "star-outline",
        disabled: primaryWorkspaceId === actionSheetWorkspace.id,
        onPress: () => {
          setPrimaryWorkspaceId(actionSheetWorkspace.id);
          closeActionSheet();
        },
      });
    }

    actions.push({
      key: "archive",
      label: actionSheetWorkspace.isArchived ? "Unarchive" : "Archive",
      icon: actionSheetWorkspace.isArchived ? "arrow-up-circle-outline" : "archive-outline",
      onPress: () => {
        closeActionSheet();
        archiveActions.confirmArchiveWorkspace(actionSheetWorkspace);
      },
    });

    actions.push({
      key: "delete",
      label: "Delete permanently",
      icon: "trash-outline",
      tone: "danger",
      onPress: () => {
        closeActionSheet();
        archiveActions.confirmDeleteWorkspace(actionSheetWorkspace);
      },
    });

    return actions;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionSheetWorkspace, primaryWorkspaceId]);

  function saveWorkspace(name: string, description: string, color: string, avatarKey: number) {
    if (archiveActions.busyWorkspaceId) return;
    const finalName = name || defaultWorkspaceTitle();
    if (isEditing && editingWorkspace) {
      updateWorkspace(editingWorkspace.id, { title: finalName, description, color, avatarKey });
    } else {
      addWorkspace(finalName, description, avatarKey);
    }
    closeModal();
  }

  return {
    clipClipboard,
    cancelClipboard,
    data: {
      activeWorkspaces,
      archivedWorkspaces,
      primaryWorkspaceId,
      workspaceListOrder,
      workspaceOrderState,
      workspaceOrderOptions,
      activeWorkspaceCount,
      busyWorkspaceId: archiveActions.busyWorkspaceId,
      busyLabel: archiveActions.busyLabel,
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
    actionSheet: {
      visible: !!actionSheetWorkspaceId,
      workspace: actionSheetWorkspace,
      actions: workspaceActionSheetActions,
      close: closeActionSheet,
    },
    actions: {
      setWorkspaceListOrder,
      setPrimaryWorkspaceId,
      confirmArchiveWorkspace: archiveActions.confirmArchiveWorkspace,
      confirmDeleteWorkspace: archiveActions.confirmDeleteWorkspace,
    },
  };
}
