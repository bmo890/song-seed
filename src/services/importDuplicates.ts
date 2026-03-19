import type { ImportedAudioAsset } from "./audioStorage";
import type { ClipVersion } from "../types";
import { useStore } from "../state/useStore";

export type DuplicateCheckResult = {
    hasDuplicates: boolean;
    duplicateCount: number;
    uniqueAssets: ImportedAudioAsset[];
    allAssets: ImportedAudioAsset[];
};

/** Returns all ClipVersions across the entire store. */
export function getAllClips(): ClipVersion[] {
    return useStore
        .getState()
        .workspaces.flatMap((ws) => ws.ideas.flatMap((idea) => idea.clips));
}

/**
 * Checks a batch of assets-to-import against existing clips.
 * A file is considered a duplicate only when BOTH it and an existing clip
 * carry a matching `sourceCreatedAt` timestamp — precise, no false positives.
 */
export function checkImportDuplicates(
    assets: ImportedAudioAsset[],
    allClips: ClipVersion[]
): DuplicateCheckResult {
    const existingSourceDates = new Set(
        allClips
            .map((c) => c.sourceCreatedAt)
            .filter((ts): ts is number => typeof ts === "number")
    );

    const uniqueAssets: ImportedAudioAsset[] = [];
    let duplicateCount = 0;

    for (const asset of assets) {
        if (
            typeof asset.sourceCreatedAt === "number" &&
            existingSourceDates.has(asset.sourceCreatedAt)
        ) {
            duplicateCount++;
        } else {
            uniqueAssets.push(asset);
        }
    }

    return {
        hasDuplicates: duplicateCount > 0,
        duplicateCount,
        uniqueAssets,
        allAssets: assets,
    };
}

/** Builds the Alert title + message for a duplicate detection result. */
export function buildDuplicateAlertMessage(
    duplicateCount: number,
    totalCount: number
): { title: string; message: string } {
    if (totalCount === 1) {
        return {
            title: "Already Imported",
            message: "This file was already imported. Import it again as a copy, or skip it?",
        };
    }
    if (duplicateCount === totalCount) {
        return {
            title: "Already Imported",
            message: `All ${totalCount} files were already imported. Import them again as copies, or skip?`,
        };
    }
    return {
        title: "Some Files Already Imported",
        message: `${duplicateCount} of ${totalCount} files were already imported. Import all (duplicates get a version number), or skip the already-imported ones?`,
    };
}
