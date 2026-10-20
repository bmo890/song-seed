import { afterOverlayCloses } from "./afterOverlayCloses";
import { i18n } from "../../i18n/instance";
import { actionMenuStore } from "./actionMenuStore";
import { canPickVideos, pickAudioFiles, pickVideoFiles, type ImportedAudioAsset } from "../../services/audioStorage";

export type ImportSource = "files" | "videos";

/**
 * Where an import comes from (2026-10-19). One "Import" row stays in each overflow
 * menu — they are at their six-row budget — and the source is chosen here: Files
 * (audio, or a video's sound) or Videos from the photo library, where camera videos
 * and screen recordings live and the iOS Files picker can't reach.
 */
export function chooseImportSource(): Promise<ImportSource | null> {
  return new Promise((resolve) => {
    // A choice of where to go is a menu, not a question (menus law 2026-10-15).
    actionMenuStore.show({
      title: i18n.t("collectionImport.sourceTitle"),
      actions: [
        {
          key: "files",
          label: i18n.t("collectionImport.sourceFiles"),
          hint: i18n.t("collectionImport.sourceFilesHint"),
          icon: "folder-outline",
          opens: true,
          onPress: () => resolve("files"),
        },
        {
          key: "videos",
          label: i18n.t("collectionImport.sourceVideos"),
          hint: i18n.t("collectionImport.sourceVideosHint"),
          icon: "film-outline",
          opens: true,
          onPress: () => resolve("videos"),
        },
      ],
      onDismiss: () => resolve(null),
    });
  });
}

/**
 * Ask where from, then open that picker. Resolves to the picked assets — empty
 * when the musician cancels at either step. A build without the photo picker
 * falls back to Files, which also takes videos.
 */
export async function pickImportAssets(options: { multiple: boolean }): Promise<ImportedAudioAsset[]> {
  // A build without the video extractor and photo picker never asks: Files, as before.
  if (!canPickVideos()) return pickAudioFiles(options);
  const source = await chooseImportSource();
  if (!source) return [];
  await afterOverlayCloses();
  if (source === "videos") {
    const videos = await pickVideoFiles(options);
    if (videos) return videos;
  }
  return pickAudioFiles(options);
}
