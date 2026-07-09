import { create } from "zustand";
import type { ImportedAudioAsset } from "../services/audioStorage";
import type { DuplicateLocation } from "../services/importDuplicates";

interface DuplicateReviewState {
    visible: boolean;
    duplicateAssets: ImportedAudioAsset[];
    uniqueAssets: ImportedAudioAsset[];
    allAssets: ImportedAudioAsset[];
    locationsBySourceDate: Record<number, DuplicateLocation>;
    onSkip: () => void;
    onImportAll: () => void;
    /** When present, the sheet enables per-row exclusion and imports the kept subset. */
    onImportSubset?: (assets: ImportedAudioAsset[]) => void;
}

interface DuplicateReviewStore extends DuplicateReviewState {
    show: (args: Omit<DuplicateReviewState, "visible">) => void;
    dismiss: () => void;
}

const EMPTY: DuplicateReviewState = {
    visible: false,
    duplicateAssets: [],
    uniqueAssets: [],
    allAssets: [],
    locationsBySourceDate: {},
    onSkip: () => {},
    onImportAll: () => {},
    onImportSubset: undefined,
};

export const useDuplicateReviewStore = create<DuplicateReviewStore>((set) => ({
    ...EMPTY,
    show: (args) => set({ ...args, visible: true }),
    dismiss: () => set(EMPTY),
}));
