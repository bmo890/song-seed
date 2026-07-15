import { useStore } from "../state/useStore";
import { AppAlert } from "../components/common/AppAlert";
import type { LineageRenameTarget } from "./clipLineageTitles";

export type LineageRenamePromptInfo = {
  ideaId: string;
  renames: LineageRenameTarget[];
};

export function showLineageRenamePrompt(info: LineageRenamePromptInfo) {
  const { ideaId, renames } = info;
  const n = renames.length;
  const clipWord = n === 1 ? "clip" : "clips";
  const example = renames[0];
  const moreLine = n > 1 ? `, and ${n - 1} more` : "";

  AppAlert.confirm(
    "Update thread names?",
    `Rename ${n} other ${clipWord} in this thread to match?\n\n"${example.clip.title}" -> "${example.nextTitle}"${moreLine}`,
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
    { confirmLabel: `Update ${n} ${clipWord}`, cancelLabel: "Keep existing" }
  );
}
