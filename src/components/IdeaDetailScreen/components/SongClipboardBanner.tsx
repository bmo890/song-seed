import { ClipboardBanner } from "../../ClipboardBanner";
import { AppAlert } from "../../common/AppAlert";
import { appActions } from "../../../state/actions";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongClipboardBanner() {
  const { screen, store } = useSongScreen();
  const { clipClipboard, cancelClipboard } = store;
  const selectedIdea = screen.selectedIdea;

  if (!clipClipboard || screen.isEditMode || selectedIdea?.kind !== "project") {
    return null;
  }

  const duplicateWarningText = (() => {
    if (clipClipboard.sourceIdeaId !== selectedIdea.id) return "";
    let itemNames: string[] = [];
    const sourceWorkspace = screen.workspaces.find((workspace) => workspace.id === clipClipboard.sourceWorkspaceId);
    if (!sourceWorkspace) return "";

    if (clipClipboard.from === "list") {
      itemNames = sourceWorkspace.ideas
        .filter((idea) => clipClipboard.clipIds.includes(idea.id))
        .map((idea) => idea.title);
    } else if (clipClipboard.from === "project" && clipClipboard.sourceIdeaId) {
      const sourceIdea = sourceWorkspace.ideas.find((idea) => idea.id === clipClipboard.sourceIdeaId);
      itemNames = sourceIdea?.clips
        .filter((clip) => clipClipboard.clipIds.includes(clip.id))
        .map((clip) => clip.title) ?? [];
    }

    const displayNames = itemNames.slice(0, 5).map((name) => `"${name}"`).join(", ");
    const remainder =
      itemNames.length > 5
        ? ` and ${itemNames.length - 5} other${itemNames.length - 5 > 1 ? "s" : ""}`
        : "";
    return `You are copying ${itemNames.length} clip${itemNames.length !== 1 ? "s" : ""} (${displayNames}${remainder}) into the same song they already belong to. This will create duplicates. Continue?`;
  })();

  return (
    <ClipboardBanner
      count={clipClipboard.clipIds.length}
      mode={clipClipboard.mode}
      actionLabel="Paste clips here"
      onAction={() => {
        const includesProjectsFromList =
          clipClipboard.from === "list" &&
          (clipClipboard.itemType === "project" || clipClipboard.itemType === "mixed");

        if (clipClipboard.sourceIdeaId === selectedIdea.id) {
          if (clipClipboard.mode === "move") {
            AppAlert.info(
              "Cannot move here",
              "You cannot move clips into the same song they are already in. To duplicate them, cancel and use Copy instead."
            );
            return;
          }

          AppAlert.confirm("Duplicate clips?", duplicateWarningText, () => appActions.pasteClipboardToProject(selectedIdea.id), { confirmLabel: "Duplicate" });
          return;
        }

        if (includesProjectsFromList) {
          AppAlert.confirm(
            `${clipClipboard.mode === "move" ? "Move primary clips here?" : "Copy primary clips here?"}`,
            `Songs can't be placed inside another song. For now, SongSeed will ${clipClipboard.mode} only the primary clip from each selected song into this song.`,
            () => appActions.pasteClipboardToProject(selectedIdea.id),
            { confirmLabel: "Continue" }
          );
          return;
        }

        AppAlert.confirm(
          `${clipClipboard.mode === "move" ? "Move" : "Copy"} clips here?`,
          `Are you sure you want to ${clipClipboard.mode} these clips into this song?`,
          () => appActions.pasteClipboardToProject(selectedIdea.id),
          { confirmLabel: "Yes" }
        );
      }}
      onCancel={cancelClipboard}
    />
  );
}
