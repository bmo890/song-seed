import type { ShareIntentFile } from "expo-share-intent";
import { enrichImportedAudioAsset, type ImportedAudioAsset } from "./audioStorage";

const AUDIO_FILE_EXTENSIONS = new Set([
  "aac",
  "aif",
  "aiff",
  "flac",
  "m4a",
  "mid",
  "midi",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "wma",
]);

function normalizeSharedFileUri(path: string) {
  if (path.startsWith("file://") || path.startsWith("content://")) {
    return path;
  }

  if (path.startsWith("/")) {
    return `file://${path}`;
  }

  return path;
}

function getFileExtension(fileName?: string | null) {
  if (!fileName) return null;
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

function isSharedAudioFile(file: ShareIntentFile) {
  const mimeType = file.mimeType?.toLowerCase() ?? "";
  if (mimeType.startsWith("audio/")) return true;

  const extension = getFileExtension(file.fileName);
  return extension ? AUDIO_FILE_EXTENSIONS.has(extension) : false;
}

export async function extractSharedAudioAssets(files: ShareIntentFile[] | null | undefined) {
  const importedAssets: ImportedAudioAsset[] = [];
  let rejectedCount = 0;

  for (const file of files ?? []) {
    if (!file.path || !isSharedAudioFile(file)) {
      rejectedCount += 1;
      continue;
    }

    importedAssets.push(
      await enrichImportedAudioAsset({
        uri: normalizeSharedFileUri(file.path),
        name: file.fileName ?? undefined,
        mimeType: file.mimeType ?? undefined,
      })
    );
  }

  return {
    assets: importedAssets,
    rejectedCount,
  };
}
