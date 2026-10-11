import { i18n } from "../../i18n/instance";
import { AppAlert } from "./AppAlert";
import { unsupportedFormatsIn } from "../../services/audioImportFormat";

/**
 * After a batch import: if any file was refused for its format (AIFF on
 * Android), say so ONCE, plainly, with the fix — instead of the batch quietly
 * ending a file short. Other failures keep their existing handling.
 */
export function reportUnsupportedImports(failed: ReadonlyArray<{ error: unknown }>): boolean {
  const refused = unsupportedFormatsIn(failed);
  if (refused.length === 0) return false;
  AppAlert.info(i18n.t("collectionImport.unsupportedFormatTitle"), i18n.t("collectionImport.unsupportedFormatBody"));
  return true;
}
