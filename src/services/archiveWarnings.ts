import { i18n } from "../i18n/instance";

/**
 * Export/import warnings carry a CODE and the item they name, so the alert that lists
 * them is translated at display time (final sweep 2026-10-22, #8). The archive itself
 * keeps the English sentence too (`manifest.warnings`, `export-report.json`) for older
 * apps and for logs; `manifest.warningEntries` is the structured twin.
 */
export type ArchiveWarningCode =
    | "missingClipAudio"
    | "missingSourceAudio"
    | "missingPrimaryTake"
    | "missingOverdubMix"
    | "missingOverdubStem"
    | "missingFile"
    | "missingArchivedAudio"
    | "missingArchivedSourceAudio"
    | "missingArchivedOverdubMix"
    | "missingArchivedOverdubStem"
    /** A sentence baked into an older archive — shown as it was written. */
    | "text";

export type ArchiveWarning = {
    code: ArchiveWarningCode;
    params?: Record<string, string>;
};

/** The warning in the user's language. */
export function describeArchiveWarning(warning: ArchiveWarning): string {
    return i18n.t(`archiveWarning.${warning.code}`, { ...warning.params });
}

/** The English sentence written into the archive (a file format, not a screen). */
export function archiveWarningEnglish(warning: ArchiveWarning): string {
    return i18n.t(`archiveWarning.${warning.code}`, { ...warning.params, lng: "en" });
}

/** An archive's warnings: the structured list when it has one, else its sentences. */
export function readArchiveWarnings(manifest: {
    warnings?: string[];
    warningEntries?: ArchiveWarning[];
}): ArchiveWarning[] {
    if (manifest.warningEntries?.length) return [...manifest.warningEntries];
    return (manifest.warnings ?? []).map((message) => ({ code: "text", params: { message } }));
}
