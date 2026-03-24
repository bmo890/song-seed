import { StateCreator } from "zustand";
import { ClipClipboard, SongIdea, ClipVersion, IdeaStatus } from "../types";
import { DataSlice } from "./dataSlice";

export type SelectionSlice = {
    selectedIdeaId: string | null;
    setSelectedIdeaId: (id: string | null) => void;
    recentlyAddedItemIds: string[];
    markRecentlyAdded: (ids: string[]) => void;
    clearRecentlyAdded: (ids: string[]) => void;

    editingIdeaId: string | null;
    setEditingIdeaId: (v: string | null) => void;
    pendingPrimaryClipId: string | null;
    setPendingPrimaryClipId: (v: string | null) => void;

    clipSelectionMode: boolean;
    selectedClipIds: string[];
    listSelectionMode: boolean;
    selectedListIdeaIds: string[];

    clipClipboard: ClipClipboard | null;
    startClipboardFromList: (mode: "copy" | "move") => void;
    startClipboardFromProject: (mode: "copy" | "move") => void;
    pasteClipboardToProject: (projectId: string) => Promise<string[]>;
    pasteClipboardToCollection: (collectionId: string) => Promise<string[]>;
    pasteClipboardToWorkspace: (workspaceId: string) => Promise<string[]>;
    setClipClipboard: (v: ClipClipboard | null) => void;
    cancelClipboard: () => void;

    movingClipId: string | null;
    setMovingClipId: (v: string | null) => void;

    startListSelection: (ideaId: string) => void;
    toggleListSelection: (ideaId: string) => void;
    replaceListSelection: (ideaIds: string[]) => void;
    cancelListSelection: () => void;

    startClipSelection: (clipId: string) => void;
    toggleClipSelection: (clipId: string) => void;
    replaceClipSelection: (clipIds: string[]) => void;
    cancelClipSelection: () => void;
};

export const createSelectionSlice: StateCreator<
    DataSlice & SelectionSlice,
    [],
    [],
    SelectionSlice
> = (set, get) => ({
    selectedIdeaId: null,
    setSelectedIdeaId: (id) => set({ selectedIdeaId: id }),
    recentlyAddedItemIds: [],
    markRecentlyAdded: (ids) =>
        set((state) => ({
            recentlyAddedItemIds: Array.from(new Set([...state.recentlyAddedItemIds, ...ids])),
        })),
    clearRecentlyAdded: (ids) =>
        set((state) => ({
            recentlyAddedItemIds: state.recentlyAddedItemIds.filter((id) => !ids.includes(id)),
        })),

    editingIdeaId: null,
    setEditingIdeaId: (v) => set({ editingIdeaId: v }),
    pendingPrimaryClipId: null,
    setPendingPrimaryClipId: (v) => set({ pendingPrimaryClipId: v }),

    clipSelectionMode: false,
    selectedClipIds: [],
    listSelectionMode: false,
    selectedListIdeaIds: [],

    clipClipboard: null,
    startClipboardFromList: (mode) => {
        // Stub to be implemented
    },
    startClipboardFromProject: (mode) => {
        // Stub to be implemented
    },
    cancelClipboard: () => set({ clipClipboard: null }),
    pasteClipboardToProject: async (projectId) => {
        return [];
    },
    pasteClipboardToCollection: async (collectionId) => {
        return [];
    },
    pasteClipboardToWorkspace: async (workspaceId) => {
        return [];
    },
    setClipClipboard: (v) => set({ clipClipboard: v }),

    movingClipId: null,
    setMovingClipId: (v) => set({ movingClipId: v }),

    startListSelection: (ideaId) =>
        set((state) => {
            if (state.listSelectionMode && state.selectedListIdeaIds.length === 1 && state.selectedListIdeaIds[0] === ideaId) {
                return state;
            }
            return { listSelectionMode: true, selectedListIdeaIds: [ideaId] };
        }),
    toggleListSelection: (ideaId) => {
        const prev = get().selectedListIdeaIds;
        const next = prev.includes(ideaId) ? prev.filter((id) => id !== ideaId) : [...prev, ideaId];
        set({ listSelectionMode: next.length > 0, selectedListIdeaIds: next });
    },
    replaceListSelection: (ideaIds) =>
        set((state) => {
            const sameLength = state.selectedListIdeaIds.length === ideaIds.length;
            const sameIds = sameLength && state.selectedListIdeaIds.every((id, index) => id === ideaIds[index]);
            const nextMode = ideaIds.length > 0;
            if (state.listSelectionMode === nextMode && sameIds) {
                return state;
            }
            return { listSelectionMode: nextMode, selectedListIdeaIds: ideaIds };
        }),
    // Blur handlers can call this repeatedly. Keep it idempotent so clearing an
    // already-empty selection does not trigger another store update.
    cancelListSelection: () =>
        set((state) => {
            if (!state.listSelectionMode && state.selectedListIdeaIds.length === 0) {
                return state;
            }
            return { listSelectionMode: false, selectedListIdeaIds: [] };
        }),

    startClipSelection: (clipId) =>
        set((state) => {
            if (state.clipSelectionMode && state.selectedClipIds.length === 1 && state.selectedClipIds[0] === clipId) {
                return state;
            }
            return { clipSelectionMode: true, selectedClipIds: [clipId] };
        }),
    toggleClipSelection: (clipId) => {
        const prev = get().selectedClipIds;
        const next = prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId];
        set({ clipSelectionMode: next.length > 0, selectedClipIds: next });
    },
    replaceClipSelection: (clipIds) =>
        set((state) => {
            const sameLength = state.selectedClipIds.length === clipIds.length;
            const sameIds = sameLength && state.selectedClipIds.every((id, index) => id === clipIds[index]);
            const nextMode = clipIds.length > 0;
            if (state.clipSelectionMode === nextMode && sameIds) {
                return state;
            }
            return { clipSelectionMode: nextMode, selectedClipIds: clipIds };
        }),
    cancelClipSelection: () =>
        set((state) => {
            if (!state.clipSelectionMode && state.selectedClipIds.length === 0 && state.movingClipId === null) {
                return state;
            }
            return { clipSelectionMode: false, selectedClipIds: [], movingClipId: null };
        }),
});
