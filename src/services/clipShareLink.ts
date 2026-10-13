/**
 * "Get a link" for raw audio clips. Each selected clip is uploaded as its own
 * transfer item (opaque audio, no manifest). The receiver gets a package of
 * playable files. Names are de-duplicated the same way shareAudioClips does.
 */
import {
  getArchiveFileExtension,
  getAudioShareMimeType,
  sanitizeArchiveSegment,
  type ShareableAudioClip,
} from "./audioStorage";
import { createFilesShareLink, type ShareFileInput } from "./shareLink";
import type { SentLink } from "../domain/sentLinks";
import type { ShareLinkParcel } from "./setlistShare";

export function createClipsShareLink(
  clips: ShareableAudioClip[],
  bundleLabel: string,
  opts?: ShareLinkParcel
): Promise<SentLink> {
  const usedNames = new Set<string>();
  const files: ShareFileInput[] = clips.map((clip) => {
    const base = sanitizeArchiveSegment(clip.title) || "Clip";
    const ext = getArchiveFileExtension(clip.audioUri);
    let fileName = `${base}.${ext}`;
    let suffix = 2;
    while (usedNames.has(fileName)) {
      fileName = `${base} ${suffix}.${ext}`;
      suffix += 1;
    }
    usedNames.add(fileName);
    return { fileUri: clip.audioUri, fileName, mimeType: getAudioShareMimeType(clip.audioUri) };
  });

  return createFilesShareLink({
    title: opts?.title || bundleLabel,
    kind: "clips",
    senderName: opts?.senderName,
    message: opts?.message ?? undefined,
    files,
  });
}
