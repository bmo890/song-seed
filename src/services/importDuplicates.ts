import type { ImportedAudioAsset } from "./audioStorage";
import type { ClipVersion } from "../types";
import { useStore } from "../state/useStore";

/** Where an already-imported copy of a duplicated file currently lives. */
export type DuplicateLocation = {
    workspaceTitle: string;
    workspaceColor?: string;
    collectionTitle: string | null;
};

export type DuplicateCheckResult = {
    hasDuplicates: boolean;
    duplicateCount: number;
    duplicateAssets: ImportedAudioAsset[];
    uniqueAssets: ImportedAudioAsset[];
    allAssets: ImportedAudioAsset[];
    /** For each duplicate, keyed by its sourceCreatedAt, where the existing copy lives. */
    locationsBySourceDate: Record<number, DuplicateLocation>;
};

/** Returns all ClipVersions across the entire store. */
export function getAllClips(): ClipVersion[] {
    return useStore
        .getState()
        .workspaces.flatMap((ws) => ws.ideas.flatMap((idea) => idea.clips));
}

/** Map every existing clip's sourceCreatedAt to the workspace+collection it lives in
 *  (first occurrence wins), so a duplicate can show the user where the original is. */
function buildLocationBySourceDate(): Map<number, DuplicateLocation> {
    const map = new Map<number, DuplicateLocation>();
    for (const workspace of useStore.getState().workspaces) {
        const collectionTitleById = new Map(workspace.collections.map((c) => [c.id, c.title]));
        for (const idea of workspace.ideas) {
            const collectionTitle = idea.collectionId
                ? collectionTitleById.get(idea.collectionId) ?? null
                : null;
            for (const clip of idea.clips) {
                if (typeof clip.sourceCreatedAt === "number" && !map.has(clip.sourceCreatedAt)) {
                    map.set(clip.sourceCreatedAt, {
                        workspaceTitle: workspace.title,
                        workspaceColor: workspace.color,
                        collectionTitle,
                    });
                }
            }
        }
    }
    return map;
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

    // Resolve locations only for the actual duplicates.
    const locationMap = duplicateAssets.length > 0 ? buildLocationBySourceDate() : null;
    const locationsBySourceDate: Record<number, DuplicateLocation> = {};
    if (locationMap) {
        for (const asset of duplicateAssets) {
            if (typeof asset.sourceCreatedAt === "number") {
                const location = locationMap.get(asset.sourceCreatedAt);
                if (location) locationsBySourceDate[asset.sourceCreatedAt] = location;
            }
        }
    }

    return {
        hasDuplicates: duplicateAssets.length > 0,
        duplicateCount: duplicateAssets.length,
        duplicateAssets,
        uniqueAssets,
        allAssets: assets,
        locationsBySourceDate,
    };
}

/**
 * Opens the DuplicateReviewSheet. `onImportSubset` is optional — when a caller supplies
 * it (the collection/workspace import flows whose `doImport` takes an explicit asset
 * list), the sheet enables per-row exclusion and imports only the kept assets. Flows
 * without it (e.g. single-song import) keep the plain skip / import-all buttons.
 */
export function showDuplicateReview(
    result: DuplicateCheckResult,
    onSkip: () => void,
    onImportAll: () => void,
    onImportSubset?: (assets: ImportedAudioAsset[]) => void
): void {
    // Lazy import to avoid circular dependency between services and state
    const { useDuplicateReviewStore } = require("../state/useDuplicateReviewStore") as typeof import("../state/useDuplicateReviewStore");
    useDuplicateReviewStore.getState().show({
        duplicateAssets: result.duplicateAssets,
        uniqueAssets: result.uniqueAssets,
        allAssets: result.allAssets,
        locationsBySourceDate: result.locationsBySourceDate,
        onSkip,
        onImportAll,
        onImportSubset,
    });
}
