import { useMemo, useState } from "react";
import { Alert } from "react-native";
import {
    buildLibraryImportPreview,
    pickSongSeedArchiveFile,
    readSongSeedArchive,
    type LibraryImportPreview,
    type ParsedSongSeedArchive,
} from "../../../services/libraryImport";
import { appActions } from "../../../state/actions";

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

            const parsed = await readSongSeedArchive(picked.uri, picked.name);
            const nextPreview = buildLibraryImportPreview(parsed);
            setParsedArchive(parsed);
            setPreview(nextPreview);
            return true;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Could not read this Song Seed Archive.";
            Alert.alert("Import failed", message);
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
            Alert.alert(
                result.warnings.length > 0 ? "Import finished with warnings" : "Import complete",
                result.warnings.length > 0
                    ? result.warnings.slice(0, 6).join("\n")
                    : `${result.importedWorkspaces} workspace${result.importedWorkspaces === 1 ? "" : "s"} and ${result.importedIdeas} item${result.importedIdeas === 1 ? "" : "s"} were imported into your library.`
            );
            setParsedArchive(null);
            setPreview(null);
            return true;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "The archive could not be imported.";
            Alert.alert("Import failed", message);
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
