import { useStore } from "../state/useStore";
import { AppAlert } from "../components/common/AppAlert";
import { i18n } from "../i18n/instance";
import type { LineageRenameTarget } from "./clipLineageTitles";

export type LineageRenamePromptInfo = {
  ideaId: string;
  renames: LineageRenameTarget[];
};

export function showLineageRenamePrompt(info: LineageRenamePromptInfo) {
  const { ideaId, renames } = info;
  const n = renames.length;
  const example = renames[0];

  AppAlert.confirm(
    i18n.t("clipLineage.updateThreadTitle"),
    i18n.t("clipLineage.updateThreadBody", {
      count: n,
      from: example.clip.title,
      to: example.nextTitle,
      more: n - 1,
    }),
    () => {
      useStore.getState().updateIdeas((ideas) =>
        ideas.map((idea) =>
          idea.id !== ideaId
            ? idea
            : {
                ...idea,
                clips: idea.clips.map((clip) => {
                  const rename = renames.find((item) => item.clip.id === clip.id);
                  if (!rename) return clip;
                  return { ...clip, title: rename.nextTitle };
                }),
              }
        )
      );
    },
    { confirmLabel: i18n.t("clipLineage.updateCount", { count: n }), cancelLabel: i18n.t("clipLineage.keepExisting") }
  );
}
