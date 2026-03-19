import { create } from "zustand";
import type { ImportedAudioAsset } from "../services/audioStorage";

interface DuplicateReviewState {
    visible: boolean;
    duplicateAssets: ImportedAudioAsset[];
    uniqueAssets: ImportedAudioAsset[];
    allAssets: ImportedAudioAsset[];
    onSkip: () => void;
    onImportAll: () => void;
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
    onSkip: () => {},
    onImportAll: () => {},
};

export const useDuplicateReviewStore = create<DuplicateReviewStore>((set) => ({
    ...EMPTY,
    show: (args) => set({ ...args, visible: true }),
    dismiss: () => set(EMPTY),
}));
