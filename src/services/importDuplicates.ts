import type { ImportedAudioAsset } from "./audioStorage";
import type { ClipVersion } from "../types";
import { useStore } from "../state/useStore";

export type DuplicateCheckResult = {
    hasDuplicates: boolean;
    duplicateCount: number;
    duplicateAssets: ImportedAudioAsset[];
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
    const duplicateAssets: ImportedAudioAsset[] = [];

    for (const asset of assets) {
        if (
            typeof asset.sourceCreatedAt === "number" &&
            existingSourceDates.has(asset.sourceCreatedAt)
        ) {
            duplicateAssets.push(asset);
        } else {
            uniqueAssets.push(asset);
        }
    }

    return {
        hasDuplicates: duplicateAssets.length > 0,
        duplicateCount: duplicateAssets.length,
        duplicateAssets,
        uniqueAssets,
        allAssets: assets,
    };
}

/** Opens the DuplicateReviewSheet for the user to choose skip vs. import-all. */
export function showDuplicateReview(
    result: DuplicateCheckResult,
    onSkip: () => void,
    onImportAll: () => void
): void {
    // Lazy import to avoid circular dependency between services and state
    const { useDuplicateReviewStore } = require("../state/useDuplicateReviewStore") as typeof import("../state/useDuplicateReviewStore");
    useDuplicateReviewStore.getState().show({
        duplicateAssets: result.duplicateAssets,
        uniqueAssets: result.uniqueAssets,
        allAssets: result.allAssets,
        onSkip,
        onImportAll,
    });
}
