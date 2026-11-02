import { i18n } from "../../i18n/instance";
import { haptic } from "../../design/haptics";
import { AppAlert } from "./AppAlert";
import { NO_AUDIO_FORMAT, VIDEO_FORMAT, unsupportedFormatsIn } from "../../services/audioImportFormat";

/**
 * After an import: if any file was refused for its format (AIFF on Android, CAF
 * on Android or Ogg/Opus on iPhone that couldn't be converted, a video with no
 * sound, a video the device couldn't read), say so ONCE, plainly, with the fix —
 * instead of the batch quietly ending a file short. Other failures keep their
 * existing handling.
 *
 * haptics vocabulary: `error` — "A failure — required on failed imports".
 */
export function reportUnsupportedImports(failed: ReadonlyArray<{ error: unknown }>): boolean {
  const refused = unsupportedFormatsIn(failed);
  if (refused.length === 0) return false;
  haptic.error();
  // One dialog, naming the most specific problem in the batch.
  if (refused.includes(NO_AUDIO_FORMAT)) {
    AppAlert.info(i18n.t("collectionImport.noAudioTitle"), i18n.t("collectionImport.noAudioBody"));
  } else if (refused.includes(VIDEO_FORMAT)) {
    AppAlert.info(i18n.t("collectionImport.videoUnreadableTitle"), i18n.t("collectionImport.videoUnreadableBody"));
  } else if (refused.includes("aiff")) {
    AppAlert.info(i18n.t("collectionImport.unsupportedFormatTitle"), i18n.t("collectionImport.unsupportedFormatBody"));
  } else {
    // A one-phone format this phone can't play or convert (CAF on Android, Ogg/Opus on iPhone).
    AppAlert.info(
      i18n.t("collectionImport.formatWontPlayTitle", { format: refused[0]!.toUpperCase() }),
      i18n.t("collectionImport.formatWontPlayBody")
    );
  }
  return true;
}
