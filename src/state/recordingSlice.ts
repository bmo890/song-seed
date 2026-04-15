import { StateCreator } from "zustand";

export type RecordingSlice = {
    recordingIdeaId: string | null;
    setRecordingIdeaId: (id: string | null) => void;
    recordingParentClipId: string | null;
    setRecordingParentClipId: (id: string | null) => void;
    recordingOverdubClipId: string | null;
    setRecordingOverdubClipId: (id: string | null) => void;
    recordingGuideMixUri: string | null;
    setRecordingGuideMixUri: (uri: string | null) => void;
    recordingSaveRequestToken: number;
    requestRecordingSave: () => void;
    clearRecordingContext: () => void;

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
    recordingOverdubClipId: null,
    setRecordingOverdubClipId: (id) => set({ recordingOverdubClipId: id }),
    recordingGuideMixUri: null,
    setRecordingGuideMixUri: (uri) => set({ recordingGuideMixUri: uri }),
    recordingSaveRequestToken: 0,
    requestRecordingSave: () =>
        set((state) => ({
            recordingSaveRequestToken: state.recordingSaveRequestToken + 1,
        })),
    clearRecordingContext: () =>
        set({
            recordingIdeaId: null,
            recordingParentClipId: null,
            recordingOverdubClipId: null,
            recordingGuideMixUri: null,
        }),

    quickNameModalVisible: false,
    setQuickNameModalVisible: (v) => set({ quickNameModalVisible: v }),
    quickNameDraft: "",
    setQuickNameDraft: (v) => set({ quickNameDraft: v }),
    quickNamingIdeaId: null,
    setQuickNamingIdeaId: (v) => set({ quickNamingIdeaId: v }),
});
