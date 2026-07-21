import { ClipboardBanner } from "../../ClipboardBanner";
import { AppAlert } from "../../common/AppAlert";
import { appActions } from "../../../state/actions";
import { useSongScreen } from "../provider/SongScreenProvider";
import { useTranslation } from "react-i18next";

export function SongClipboardBanner() {
  const { t } = useTranslation();
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
        ? t("songClipboard.otherCount", { count: itemNames.length - 5 })
        : "";
    return t("songClipboard.duplicateBody", { count: itemNames.length, names: displayNames, remainder });
  })();

  return (
    <ClipboardBanner
      count={clipClipboard.clipIds.length}
      mode={clipClipboard.mode}
      actionLabel={t("songClipboard.pasteHere")}
      onAction={() => {
        const includesProjectsFromList =
          clipClipboard.from === "list" &&
          (clipClipboard.itemType === "project" || clipClipboard.itemType === "mixed");

        if (clipClipboard.sourceIdeaId === selectedIdea.id) {
          if (clipClipboard.mode === "move") {
            AppAlert.info(
              t("songClipboard.cannotMove"),
              t("songClipboard.cannotMoveBody")
            );
            return;
          }

          AppAlert.confirm(t("songClipboard.duplicateTitle"), duplicateWarningText, () => appActions.pasteClipboardToProject(selectedIdea.id), { confirmLabel: t("songClipboard.duplicate") });
          return;
        }

        if (includesProjectsFromList) {
          AppAlert.confirm(
            clipClipboard.mode === "move" ? t("songClipboard.movePrimaryTitle") : t("songClipboard.copyPrimaryTitle"),
            t("songClipboard.primaryBody", { mode: clipClipboard.mode === "move" ? t("songClipboard.moveVerb") : t("songClipboard.copyVerb") }),
            () => appActions.pasteClipboardToProject(selectedIdea.id),
            { confirmLabel: t("common.continue") }
          );
          return;
        }

        AppAlert.confirm(
          clipClipboard.mode === "move" ? t("songClipboard.moveTitle") : t("songClipboard.copyTitle"),
          t("songClipboard.confirmBody", { mode: clipClipboard.mode === "move" ? t("songClipboard.moveVerb") : t("songClipboard.copyVerb") }),
          () => appActions.pasteClipboardToProject(selectedIdea.id),
          { confirmLabel: t("songClipboard.yes") }
        );
      }}
      onCancel={cancelClipboard}
    />
  );
}
