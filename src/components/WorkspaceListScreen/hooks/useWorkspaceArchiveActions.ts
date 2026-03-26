import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { appActions } from "../../../state/actions";
import { formatBytes } from "../../../utils";
import type { Workspace } from "../../../types";

type Args = {
  activeWorkspaceCount: number;
  closeModal: () => void;
  deleteWorkspace: (workspaceId: string) => void;
  onClearSelection: () => void;
  onCloseSelectionMore: () => void;
  selectedWorkspaces: Workspace[];
  viewingArchived: boolean;
};

export function useWorkspaceArchiveActions({
  activeWorkspaceCount,
  closeModal,
  deleteWorkspace,
  onClearSelection,
  onCloseSelectionMore,
  selectedWorkspaces,
  viewingArchived,
}: Args) {
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"archive" | "restore" | null>(null);

  const busyLabel = useMemo(
    () =>
      busyAction === "archive"
        ? "ARCHIVING"
        : busyAction === "restore"
          ? "RESTORING"
          : null,
    [busyAction]
  );

  async function runArchiveWorkspace(workspaceId: string) {
    setBusyWorkspaceId(workspaceId);
    setBusyAction("archive");
    closeModal();

    try {
      const result = await appActions.archiveWorkspace(workspaceId);
      const summary = [
        `Packed ${result.archiveState.audioFileCount} audio file${
          result.archiveState.audioFileCount === 1 ? "" : "s"
        } into ${formatBytes(result.archiveState.packageSizeBytes)}.`,
        `Saved ${formatBytes(
          result.archiveState.savingsBytes
        )} on device while keeping the workspace structure and metadata live.`,
      ];
      if (result.warnings.length > 0) {
        summary.push(result.warnings.join(" "));
      }
      Alert.alert("Workspace archived", summary.join(" "));
    } catch (error) {
      Alert.alert(
        "Archive failed",
        error instanceof Error ? error.message : "Could not archive this workspace."
      );
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
    }
  }

  async function runUnarchiveWorkspace(workspaceId: string) {
    setBusyWorkspaceId(workspaceId);
    setBusyAction("restore");
    closeModal();

    try {
      const result = await appActions.unarchiveWorkspace(workspaceId);
      const summary = ["Workspace audio was restored and the workspace is active again."];
      if (result.warnings.length > 0) {
        summary.push(result.warnings.join(" "));
      }
      Alert.alert("Workspace restored", summary.join(" "));
    } catch (error) {
      Alert.alert(
        "Restore failed",
        error instanceof Error ? error.message : "Could not restore this workspace."
      );
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
    }
  }

  async function runSelectionWorkspaceArchive(action: "archive" | "restore") {
    if (selectedWorkspaces.length === 0) return;

    if (action === "archive" && activeWorkspaceCount - selectedWorkspaces.length < 1) {
      Alert.alert("Cannot archive", "You must keep at least one active workspace.");
      return;
    }

    setBusyWorkspaceId("__selection__");
    setBusyAction(action);
    onCloseSelectionMore();

    const successes: string[] = [];
    const failures: string[] = [];

    try {
      for (const workspace of selectedWorkspaces) {
        try {
          if (action === "archive") {
            await appActions.archiveWorkspace(workspace.id);
          } else {
            await appActions.unarchiveWorkspace(workspace.id);
          }
          successes.push(workspace.title);
        } catch (error) {
          failures.push(
            `${workspace.title}: ${
              error instanceof Error ? error.message : `Could not ${action} this workspace.`
            }`
          );
        }
      }
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
      onClearSelection();
    }

    if (failures.length > 0) {
      Alert.alert(
        action === "archive" ? "Archive incomplete" : "Restore incomplete",
        [
          successes.length > 0
            ? `${successes.length} workspace${
                successes.length === 1 ? "" : "s"
              } ${action === "archive" ? "archived" : "restored"}.`
            : null,
          failures.join("\n"),
        ]
          .filter(Boolean)
          .join("\n\n")
      );
      return;
    }

    Alert.alert(
      action === "archive" ? "Workspaces archived" : "Workspaces restored",
      `${successes.length} workspace${
        successes.length === 1 ? "" : "s"
      } ${action === "archive" ? "archived" : "restored"}.`
    );
  }

  function confirmArchiveSelection(action: "archive" | "restore") {
    if (selectedWorkspaces.length === 0 || busyWorkspaceId) return;

    Alert.alert(
      action === "archive" ? "Archive workspaces?" : "Unarchive workspaces?",
      action === "archive"
        ? `Archive ${selectedWorkspaces.length} selected workspace${
            selectedWorkspaces.length === 1 ? "" : "s"
          }?`
        : `Restore ${selectedWorkspaces.length} selected workspace${
            selectedWorkspaces.length === 1 ? "" : "s"
          }?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action === "archive" ? "Archive" : "Unarchive",
          onPress: () => {
            void runSelectionWorkspaceArchive(action);
          },
        },
      ]
    );
  }

  function confirmDeleteSelection() {
    if (selectedWorkspaces.length === 0 || busyWorkspaceId) return;
    const deletingAllActiveSelection =
      !viewingArchived && activeWorkspaceCount <= selectedWorkspaces.length;

    Alert.alert(
      "Delete workspaces?",
      deletingAllActiveSelection
        ? `This will permanently delete ${selectedWorkspaces.length} workspace${
            selectedWorkspaces.length === 1 ? "" : "s"
          }. Song Seed will create a fresh empty workspace so the app still has an active home context. This cannot be undone.`
        : `This will permanently delete ${selectedWorkspaces.length} workspace${
            selectedWorkspaces.length === 1 ? "" : "s"
          }. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            selectedWorkspaces.forEach((workspace) => deleteWorkspace(workspace.id));
            onClearSelection();
            onCloseSelectionMore();
          },
        },
      ]
    );
  }

  function confirmArchiveWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;

    if (!workspace.isArchived && activeWorkspaceCount <= 1) {
      Alert.alert("Cannot archive", "You must keep at least one active workspace.");
      return;
    }

    if (workspace.isArchived) {
      Alert.alert(
        `Unarchive ${workspace.title}?`,
        "This restores the compressed audio and returns the workspace to the active list.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unarchive",
            onPress: () => {
              void runUnarchiveWorkspace(workspace.id);
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      `Archive ${workspace.title}?`,
      "This compresses the workspace audio, removes the workspace from the active list, and keeps it available to restore later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => {
            void runArchiveWorkspace(workspace.id);
          },
        },
      ]
    );
  }

  function confirmDeleteWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;
    const deletingFinalActiveWorkspace = !workspace.isArchived && activeWorkspaceCount <= 1;

    Alert.alert(
      `Delete ${workspace.title}?`,
      deletingFinalActiveWorkspace
        ? `This will permanently delete ${workspace.ideas.length} ideas. Song Seed will create a fresh empty workspace so the app still has an active home context. This cannot be undone.`
        : `This will permanently delete ${workspace.ideas.length} ideas. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            deleteWorkspace(workspace.id);
            closeModal();
          },
        },
      ]
    );
  }

  return {
    busyWorkspaceId,
    busyLabel,
    confirmArchiveSelection,
    confirmDeleteSelection,
    confirmArchiveWorkspace,
    confirmDeleteWorkspace,
  };
}
