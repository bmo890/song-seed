import { StateCreator } from "zustand";

export type RecordingSlice = {
    recordingIdeaId: string | null;
    setRecordingIdeaId: (id: string | null) => void;
    recordingParentClipId: string | null;
    setRecordingParentClipId: (id: string | null) => void;
    recordingSaveRequestToken: number;
    requestRecordingSave: () => void;

    quickNameModalVisible: boolean;
    setQuickNameModalVisible: (v: boolean) => void;
    quickNameDraft: string;
    setQuickNameDraft: (v: string) => void;
    quickNamingIdeaId: string | null;
    setQuickNamingIdeaId: (v: string | null) => void;
};

export const createRecordingSlice: StateCreator<RecordingSlice> = (set) => ({
    recordingIdeaId: null,
    setRecordingIdeaId: (id) => set({ recordingIdeaId: id }),
    recordingParentClipId: null,
    setRecordingParentClipId: (id) => set({ recordingParentClipId: id }),
    recordingSaveRequestToken: 0,
    requestRecordingSave: () =>
        set((state) => ({
            recordingSaveRequestToken: state.recordingSaveRequestToken + 1,
        })),

    quickNameModalVisible: false,
    setQuickNameModalVisible: (v) => set({ quickNameModalVisible: v }),
    quickNameDraft: "",
    setQuickNameDraft: (v) => set({ quickNameDraft: v }),
    quickNamingIdeaId: null,
    setQuickNamingIdeaId: (v) => set({ quickNamingIdeaId: v }),
});
