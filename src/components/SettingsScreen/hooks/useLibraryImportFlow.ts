import { useMemo, useState } from "react";
import { AppAlert } from "../../common/AppAlert";
import {
    buildLibraryImportPreview,
    pickSongSeedArchiveFile,
    readSongSeedArchive,
    type LibraryImportPreview,
    type ParsedSongSeedArchive,
} from "../../../services/libraryImport";
import { detectPickedArchiveKind } from "../../../services/archiveKind";
import { appActions } from "../../../state/actions";
import { haptic } from "../../../design/haptics";

export function useLibraryImportFlow() {
    const [parsedArchive, setParsedArchive] = useState<ParsedSongSeedArchive | null>(null);
    const [preview, setPreview] = useState<LibraryImportPreview | null>(null);
    const [isPicking, setIsPicking] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    const hasArchiveLoaded = !!parsedArchive && !!preview;
    const warningSummary = useMemo(
        () => (preview?.warningMessages ?? []).slice(0, 5),
        [preview?.warningMessages]
    );

    const chooseArchive = async () => {
        if (isPicking || isImporting) {
            return false;
        }

        setIsPicking(true);
        try {
            const picked = await pickSongSeedArchiveFile();
            if (!picked) {
                return false;
            }

            // A full disaster-recovery backup is a different format and belongs in the Restore
            // flow. Detect it here and point the user to the right place instead of failing with
            // a confusing "not a valid Songstead Archive" error.
            if ((await detectPickedArchiveKind(picked.uri)) === "songstead-backup") {
                AppAlert.info(
                    "That's a full backup",
                    "This file is a full Songstead backup, not a shareable archive. Restore it from Library & Backups → Restore."
                );
                return false;
            }

            const parsed = await readSongSeedArchive(picked.uri, picked.name);
            const nextPreview = buildLibraryImportPreview(parsed);
            setParsedArchive(parsed);
            setPreview(nextPreview);
            return true;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Could not read this Songstead Archive.";
            AppAlert.info("Import failed", message);
            return false;
        } finally {
            setIsPicking(false);
        }
    };

    const importArchive = async () => {
        if (!parsedArchive || isImporting) {
            return false;
        }

        setIsImporting(true);
        try {
            const result = await appActions.importLibraryArchiveIntoLibrary(parsedArchive);
            if (result.warnings.length === 0) haptic.success();
            AppAlert.info(
                result.warnings.length > 0 ? "Import finished with warnings" : "Import complete",
                result.warnings.length > 0
                    ? result.warnings.slice(0, 6).join("\n")
                    : `${result.importedWorkspaces} workspace${result.importedWorkspaces === 1 ? "" : "s"}, ${result.importedIdeas} item${result.importedIdeas === 1 ? "" : "s"}, and ${result.importedNotes} notepad note${result.importedNotes === 1 ? "" : "s"} were imported into your library.`
            );
            setParsedArchive(null);
            setPreview(null);
            return true;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "The archive could not be imported.";
            AppAlert.info("Import failed", message);
            return false;
        } finally {
            setIsImporting(false);
        }
    };

    return {
        preview,
        warningSummary,
        hasArchiveLoaded,
        isPicking,
        isImporting,
        chooseArchive,
        importArchive,
        clearArchive: () => {
            setParsedArchive(null);
            setPreview(null);
        },
    };
}
