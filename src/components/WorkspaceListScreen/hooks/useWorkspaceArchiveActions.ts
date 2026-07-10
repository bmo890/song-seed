import { useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { appActions } from "../../../state/actions";
import { BACKUP_SAVE_CANCELLED_MESSAGE } from "../../../services/archiveSave";
import { formatBytes } from "../../../utils";
import { haptic } from "../../../design/haptics";
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
  const [busyAction, setBusyAction] = useState<"archive" | "restore" | "offload" | null>(null);

  const busyLabel = useMemo(
    () =>
      busyAction === "archive"
        ? "ARCHIVING"
        : busyAction === "restore"
          ? "RESTORING"
          : busyAction === "offload"
            ? "MOVING"
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
        `Packed ${result.archiveState.audioFileCount} recording${
          result.archiveState.audioFileCount === 1 ? "" : "s"
        } into a single ${formatBytes(result.archiveState.packageSizeBytes)} package on this device.`,
        // Only brag about the metadata trim when it's a number worth saying out loud.
        result.archiveState.savingsBytes >= 64 * 1024
          ? `Your working library got ${formatBytes(result.archiveState.savingsBytes)} lighter. Restore it anytime.`
          : "Restore it anytime.",
      ];
      if (result.warnings.length > 0) {
        summary.push(result.warnings.join(" "));
      }
      AppAlert.info("Workspace archived", summary.join(" "));
    } catch (error) {
      AppAlert.info(
        "Archive failed",
        error instanceof Error ? error.message : "Could not archive this workspace."
      );
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
    }
  }

  async function runUnarchiveWorkspace(workspaceId: string, pickedArchiveUri?: string) {
    setBusyWorkspaceId(workspaceId);
    setBusyAction("restore");
    closeModal();

    try {
      const result = await appActions.unarchiveWorkspace(workspaceId, pickedArchiveUri);
      const summary = ["Workspace audio was restored and the workspace is active again."];
      if (result.warnings.length > 0) {
        summary.push(result.warnings.join(" "));
      }
      AppAlert.info("Workspace restored", summary.join(" "));
    } catch (error) {
      AppAlert.info(
        "Restore failed",
        error instanceof Error ? error.message : "Could not restore this workspace."
      );
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
    }
  }

  /** Offloaded package: ask for the file back, then restore from it. */
  async function pickAndRestoreOffloadedWorkspace(workspace: Workspace) {
    let picked: DocumentPicker.DocumentPickerResult;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: ["application/zip", "application/x-zip-compressed", "*/*"],
        multiple: false,
        copyToCacheDirectory: true,
      });
    } catch {
      AppAlert.info("Restore failed", "Could not open the file picker.");
      return;
    }
    if (picked.canceled || picked.assets.length === 0) return;
    await runUnarchiveWorkspace(workspace.id, picked.assets[0]!.uri);
  }

  async function runOffloadWorkspace(workspace: Workspace) {
    setBusyWorkspaceId(workspace.id);
    setBusyAction("offload");
    closeModal();

    try {
      const saved = await appActions.offloadArchivedWorkspace(workspace.id);
      const finalize = async () => {
        try {
          const result = await appActions.finalizeWorkspaceOffload(workspace.id, saved.fileName);
          haptic.success();
          AppAlert.info(
            "Package moved",
            `Freed ${formatBytes(result.freedBytes)} on this device. "${workspace.title}" stays in your archived list — restoring it will ask for "${saved.fileName}".`
          );
        } catch (error) {
          AppAlert.info(
            "Could not finish the move",
            error instanceof Error ? error.message : "The local package was kept."
          );
        }
      };

      if (saved.saveConfirmed) {
        await finalize();
      } else {
        // iOS share sheet can't report whether the save completed. The local package is
        // the ONLY copy until the user explicitly confirms it landed.
        AppAlert.custom(
          "Confirm the package saved",
          `Only confirm if "${saved.fileName}" now appears in Files, iCloud Drive, or the location you chose. The copy on this device is deleted after you confirm.`,
          [
            { label: "Not Saved", style: "cancel" },
            { label: "It Saved — Free Up Space", style: "default", icon: "checkmark", onPress: () => void finalize() },
          ]
        );
      }
    } catch (error) {
      if (!(error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE)) {
        AppAlert.info(
          "Move failed",
          error instanceof Error ? error.message : "Could not move this workspace's package."
        );
      }
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
    }
  }

  function confirmOffloadWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;
    if (!workspace.isArchived || !workspace.archiveState || workspace.archiveState.offloadedAt) {
      return;
    }

    AppAlert.confirm(
      `Move "${workspace.title}" package off this device?`,
      `Saves the ${formatBytes(workspace.archiveState.packageSizeBytes)} package to Files, iCloud Drive, or another location you choose, then deletes the copy on this device — that's the real space saver. Keep the file safe: restoring this workspace will ask for it.`,
      () => {
        void runOffloadWorkspace(workspace);
      },
      { confirmLabel: "Choose Location", icon: actionIcons.archive }
    );
  }

  async function runSelectionWorkspaceArchive(action: "archive" | "restore") {
    if (selectedWorkspaces.length === 0) return;

    if (action === "archive" && activeWorkspaceCount - selectedWorkspaces.length < 1) {
      AppAlert.info("Cannot archive", "You must keep at least one active workspace.");
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
          } else if (workspace.archiveState?.offloadedAt) {
            // Restoring an offloaded workspace needs its package file picked — a per-
            // workspace interaction that doesn't fit a bulk pass.
            failures.push(
              `${workspace.title}: its package is in your storage — unarchive it on its own to pick the file.`
            );
            continue;
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
      AppAlert.info(
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

    AppAlert.info(
      action === "archive" ? "Workspaces archived" : "Workspaces restored",
      `${successes.length} workspace${
        successes.length === 1 ? "" : "s"
      } ${action === "archive" ? "archived" : "restored"}.`
    );
  }

  function confirmArchiveSelection(action: "archive" | "restore") {
    if (selectedWorkspaces.length === 0 || busyWorkspaceId) return;

    AppAlert.confirm(
      action === "archive" ? "Archive workspaces?" : "Unarchive workspaces?",
      action === "archive"
        ? `Archive ${selectedWorkspaces.length} selected workspace${
            selectedWorkspaces.length === 1 ? "" : "s"
          }?`
        : `Restore ${selectedWorkspaces.length} selected workspace${
            selectedWorkspaces.length === 1 ? "" : "s"
          }?`,
      () => {
        void runSelectionWorkspaceArchive(action);
      },
      {
        confirmLabel: action === "archive" ? "Archive" : "Unarchive",
        icon: action === "archive" ? actionIcons.archive : actionIcons.restore,
      }
    );
  }

  function confirmDeleteSelection() {
    if (selectedWorkspaces.length === 0 || busyWorkspaceId) return;
    const deletingAllActiveSelection =
      !viewingArchived && activeWorkspaceCount <= selectedWorkspaces.length;

    AppAlert.destructive(
      "Delete workspaces?",
      deletingAllActiveSelection
        ? `This will permanently delete ${selectedWorkspaces.length} workspace${
            selectedWorkspaces.length === 1 ? "" : "s"
          }. Song Seed will create a fresh empty workspace so the app still has an active home context. This cannot be undone.`
        : `This will permanently delete ${selectedWorkspaces.length} workspace${
            selectedWorkspaces.length === 1 ? "" : "s"
          }. This cannot be undone.`,
      () => {
        selectedWorkspaces.forEach((workspace) => deleteWorkspace(workspace.id));
        onClearSelection();
        onCloseSelectionMore();
      },
      { confirmLabel: "Delete permanently" }
    );
  }

  function confirmArchiveWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;

    if (!workspace.isArchived && activeWorkspaceCount <= 1) {
      AppAlert.info("Cannot archive", "You must keep at least one active workspace.");
      return;
    }

    if (workspace.isArchived) {
      if (workspace.archiveState?.offloadedAt) {
        AppAlert.confirm(
          `Unarchive ${workspace.title}?`,
          `This workspace's package was moved to your storage${
            workspace.archiveState.offloadedFileName
              ? ` as "${workspace.archiveState.offloadedFileName}"`
              : ""
          }. Pick that file to unpack it and return the workspace to your active list.`,
          () => {
            void pickAndRestoreOffloadedWorkspace(workspace);
          },
          { confirmLabel: "Pick Package File", icon: actionIcons.restore }
        );
        return;
      }
      AppAlert.confirm(
        `Unarchive ${workspace.title}?`,
        "This unpacks the workspace's audio and returns it to your active list, exactly as it was.",
        () => {
          void runUnarchiveWorkspace(workspace.id);
        },
        { confirmLabel: "Unarchive", icon: actionIcons.restore }
      );
      return;
    }

    AppAlert.confirm(
      `Archive ${workspace.title}?`,
      "Tucks this workspace away without deleting anything: its recordings move into a single package on this device, it leaves your active list, and your working library gets lighter. Restore it anytime.",
      () => {
        void runArchiveWorkspace(workspace.id);
      },
      { confirmLabel: "Archive", icon: actionIcons.archive }
    );
  }

  function confirmDeleteWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;
    const deletingFinalActiveWorkspace = !workspace.isArchived && activeWorkspaceCount <= 1;

    AppAlert.destructive(
      `Delete ${workspace.title}?`,
      deletingFinalActiveWorkspace
        ? `This will permanently delete ${workspace.ideas.length} ideas. Song Seed will create a fresh empty workspace so the app still has an active home context. This cannot be undone.`
        : `This will permanently delete ${workspace.ideas.length} ideas. This cannot be undone.`,
      () => {
        deleteWorkspace(workspace.id);
        closeModal();
      },
      { confirmLabel: "Delete permanently" }
    );
  }

  return {
    busyWorkspaceId,
    busyLabel,
    confirmArchiveSelection,
    confirmDeleteSelection,
    confirmArchiveWorkspace,
    confirmOffloadWorkspace,
    confirmDeleteWorkspace,
  };
}
