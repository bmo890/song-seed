import { useMemo, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import { AppAlert } from "../../common/AppAlert";
import { actionIcons } from "../../common/actionIcons";
import { ensurePro } from "../../common/proUpsell";
import { appActions } from "../../../state/actions";
import { BACKUP_SAVE_CANCELLED_MESSAGE } from "../../../services/archiveSave";
import { formatBytes } from "../../../utils";
import { haptic } from "../../../design/haptics";
import type { Workspace } from "../../../types";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"archive" | "restore" | "offload" | null>(null);

  const busyLabel = useMemo(
    () =>
      busyAction === "archive"
        ? t("workspaceArchive.archiving")
        : busyAction === "restore"
          ? t("workspaceArchive.restoring")
          : busyAction === "offload"
            ? t("workspaceArchive.moving")
            : null,
    [busyAction, t]
  );

  async function runArchiveWorkspace(workspaceId: string) {
    setBusyWorkspaceId(workspaceId);
    setBusyAction("archive");
    closeModal();

    try {
      const result = await appActions.archiveWorkspace(workspaceId);
      const summary = [
        t("workspaceArchive.packed", { count: result.archiveState.audioFileCount, size: formatBytes(result.archiveState.packageSizeBytes) }),
        // Only brag about the metadata trim when it's a number worth saying out loud.
        result.archiveState.savingsBytes >= 64 * 1024
          ? t("workspaceArchive.lighter", { size: formatBytes(result.archiveState.savingsBytes) })
          : t("workspaceArchive.restoreAnytime"),
      ];
      if (result.warnings.length > 0) {
        summary.push(result.warnings.join(" "));
      }
      AppAlert.info(t("workspaceArchive.archivedTitle"), summary.join(" "));
    } catch (error) {
      AppAlert.info(
        t("workspaceArchive.archiveFailed"),
        t("workspaceArchive.archiveFailedBody")
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
      const summary = [t("workspaceArchive.restoredBody")];
      if (result.warnings.length > 0) {
        summary.push(result.warnings.join(" "));
      }
      AppAlert.info(t("workspaceArchive.restoredTitle"), summary.join(" "));
    } catch (error) {
      AppAlert.info(
        t("workspaceArchive.restoreFailed"),
        t("workspaceArchive.restoreFailedBody")
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
      AppAlert.info(t("workspaceArchive.restoreFailed"), t("workspaceArchive.pickerFailed"));
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
            t("workspaceArchive.packageMoved"),
            t("workspaceArchive.packageMovedBody", { size: formatBytes(result.freedBytes), workspace: workspace.title, file: saved.fileName })
          );
        } catch (error) {
          AppAlert.info(
            t("workspaceArchive.moveFinishFailed"),
            t("workspaceArchive.localKept")
          );
        }
      };

      if (saved.saveConfirmed) {
        await finalize();
      } else {
        // iOS share sheet can't report whether the save completed. The local package is
        // the ONLY copy until the user explicitly confirms it landed.
        AppAlert.custom(
          t("workspaceArchive.confirmSaved"),
          t("workspaceArchive.confirmSavedBody", { file: saved.fileName }),
          [
            { label: t("workspaceArchive.notSaved"), style: "cancel" },
            { label: t("workspaceArchive.savedFree"), style: "default", icon: "checkmark", onPress: () => void finalize() },
          ]
        );
      }
    } catch (error) {
      if (!(error instanceof Error && error.message === BACKUP_SAVE_CANCELLED_MESSAGE)) {
        AppAlert.info(
          t("workspaceArchive.moveFailed"),
          t("workspaceArchive.moveFailedBody")
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
    if (!ensurePro("archive-offload")) return;

    AppAlert.confirm(
      t("workspaceArchive.moveTitle", { workspace: workspace.title }),
      t("workspaceArchive.moveBody", { size: formatBytes(workspace.archiveState.packageSizeBytes) }),
      () => {
        void runOffloadWorkspace(workspace);
      },
      { confirmLabel: t("workspaceArchive.chooseLocation"), icon: actionIcons.archive }
    );
  }

  async function runSelectionWorkspaceArchive(action: "archive" | "restore") {
    if (selectedWorkspaces.length === 0) return;

    if (action === "archive" && activeWorkspaceCount - selectedWorkspaces.length < 1) {
      AppAlert.info(t("workspaceArchive.cannotArchive"), t("workspaceArchive.keepActive"));
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
              t("workspaceArchive.offloadedFailure", { workspace: workspace.title })
            );
            continue;
          } else {
            await appActions.unarchiveWorkspace(workspace.id);
          }
          successes.push(workspace.title);
        } catch (error) {
          failures.push(
            t("workspaceArchive.workspaceActionFailed", { workspace: workspace.title, action: t(action === "archive" ? "workspaceArchive.archive" : "workspaceArchive.unarchive") })
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
        t(action === "archive" ? "workspaceArchive.archiveIncomplete" : "workspaceArchive.restoreIncomplete"),
        [
          successes.length > 0
            ? t("workspaceArchive.actionSuccess", { count: successes.length, action: t(action === "archive" ? "workspaceArchiveVerbs.archived" : "workspaceArchiveVerbs.restored") })
            : null,
          failures.join("\n"),
        ]
          .filter(Boolean)
          .join("\n\n")
      );
      return;
    }

    AppAlert.info(
      t(action === "archive" ? "workspaceArchive.workspacesArchived" : "workspaceArchive.workspacesRestored"),
      t("workspaceArchive.actionSuccess", { count: successes.length, action: t(action === "archive" ? "workspaceArchiveVerbs.archived" : "workspaceArchiveVerbs.restored") })
    );
  }

  function confirmArchiveSelection(action: "archive" | "restore") {
    if (selectedWorkspaces.length === 0 || busyWorkspaceId) return;

    AppAlert.confirm(
      t(action === "archive" ? "workspaceArchive.archiveSelectedTitle" : "workspaceArchive.restoreSelectedTitle"),
      action === "archive"
        ? t("workspaceArchive.archiveSelectedBody", { count: selectedWorkspaces.length })
        : t("workspaceArchive.restoreSelectedBody", { count: selectedWorkspaces.length }),
      () => {
        void runSelectionWorkspaceArchive(action);
      },
      {
        confirmLabel: t(action === "archive" ? "workspaceArchive.archive" : "workspaceArchive.unarchive"),
        icon: action === "archive" ? actionIcons.archive : actionIcons.restore,
      }
    );
  }

  function confirmDeleteSelection() {
    if (selectedWorkspaces.length === 0 || busyWorkspaceId) return;
    const deletingAllActiveSelection =
      !viewingArchived && activeWorkspaceCount <= selectedWorkspaces.length;

    AppAlert.destructive(
      t("workspaceArchive.deleteWorkspaces"),
      deletingAllActiveSelection
        ? t("workspaceArchive.deleteAllBody", { count: selectedWorkspaces.length })
        : t("workspaceArchive.deleteBody", { count: selectedWorkspaces.length }),
      () => {
        selectedWorkspaces.forEach((workspace) => deleteWorkspace(workspace.id));
        onClearSelection();
        onCloseSelectionMore();
      },
      { confirmLabel: t("workspaceArchive.deletePermanently") }
    );
  }

  function confirmArchiveWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;

    if (!workspace.isArchived && activeWorkspaceCount <= 1) {
      AppAlert.info(t("workspaceArchive.cannotArchive"), t("workspaceArchive.keepActive"));
      return;
    }

    if (workspace.isArchived) {
      if (workspace.archiveState?.offloadedAt) {
        AppAlert.confirm(
          t("workspaceArchive.unarchiveTitle", { workspace: workspace.title }),
          t("workspaceArchive.offloadedBody", { file: workspace.archiveState.offloadedFileName ? t("workspaceArchive.offloadedFile", { file: workspace.archiveState.offloadedFileName }) : "" }),
          () => {
            void pickAndRestoreOffloadedWorkspace(workspace);
          },
          { confirmLabel: t("workspaceArchive.pickPackage"), icon: actionIcons.restore }
        );
        return;
      }
      AppAlert.confirm(
        t("workspaceArchive.unarchiveTitle", { workspace: workspace.title }),
        t("workspaceArchive.unarchiveBody"),
        () => {
          void runUnarchiveWorkspace(workspace.id);
        },
        { confirmLabel: t("workspaceArchive.unarchive"), icon: actionIcons.restore }
      );
      return;
    }

    AppAlert.confirm(
      t("workspaceArchive.archiveTitle", { workspace: workspace.title }),
      t("workspaceArchive.archiveBody"),
      () => {
        void runArchiveWorkspace(workspace.id);
      },
      { confirmLabel: t("workspaceArchive.archive"), icon: actionIcons.archive }
    );
  }

  function confirmDeleteWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;
    const deletingFinalActiveWorkspace = !workspace.isArchived && activeWorkspaceCount <= 1;

    AppAlert.destructive(
      t("workspaceArchive.deleteTitle", { workspace: workspace.title }),
      deletingFinalActiveWorkspace
        ? t("workspaceArchive.deleteFinalBody", { count: workspace.ideas.length })
        : t("workspaceArchive.deleteWorkspaceBody", { count: workspace.ideas.length }),
      () => {
        deleteWorkspace(workspace.id);
        closeModal();
      },
      { confirmLabel: t("workspaceArchive.deletePermanently") }
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
