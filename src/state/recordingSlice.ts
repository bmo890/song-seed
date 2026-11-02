import { StateCreator } from "zustand";
import { heldTakeDestination, takeHoldsRecorder } from "../services/recordingTakeSession";

/** What a record button aims a new take at. */
export type RecordingTarget = {
    ideaId: string;
    /** A new version of this take (a reply). */
    parentClipId?: string | null;
    /** A layer on this take, with the guide it plays and where it punches in. */
    overdubClipId?: string | null;
    guideMixUri?: string | null;
    punchInMs?: number | null;
};

export type RecordingSlice = {
    /**
     * Aim the recorder at a new take. Every record button goes through here. While a take
     * holds the recorder (minimised, paused or rolling) this changes nothing and returns
     * false: the button then just opens the recorder, which shows that take (audit
     * 2026-11-02, 12d D-H2).
     */
    armRecording: (target: RecordingTarget) => boolean;
    /** Put the store's recording context back on the take that holds the recorder. */
    adoptHeldTakeContext: () => void;
    recordingIdeaId: string | null;
    setRecordingIdeaId: (id: string | null) => void;
    recordingParentClipId: string | null;
    setRecordingParentClipId: (id: string | null) => void;
    recordingOverdubClipId: string | null;
    setRecordingOverdubClipId: (id: string | null) => void;
    recordingGuideMixUri: string | null;
    setRecordingGuideMixUri: (uri: string | null) => void;
    /** Punch-in point for an overdub layer, ms on the MASTER's timeline (bar-snapped at
     *  arm time). Null = classic full-length layer from the top. Becomes the saved
     *  stem's offsetMs. */
    recordingPunchInMs: number | null;
    setRecordingPunchInMs: (ms: number | null) => void;
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

export const createRecordingSlice: StateCreator<RecordingSlice> = (set, get) => ({
    armRecording: (target) => {
        if (takeHoldsRecorder()) return false;
        // Arming clears any layer set-up left behind: a layer that was opened and backed
        // out of must never ride along into the next plain recording.
        set({
            recordingIdeaId: target.ideaId,
            recordingParentClipId: target.parentClipId ?? null,
            recordingOverdubClipId: target.overdubClipId ?? null,
            recordingGuideMixUri: target.guideMixUri ?? null,
            recordingPunchInMs: target.punchInMs ?? null,
        });
        return true;
    },
    adoptHeldTakeContext: () => {
        const destination = heldTakeDestination();
        if (!destination) return;
        const state = get();
        if (
            state.recordingIdeaId === destination.ideaId &&
            state.recordingParentClipId === destination.parentClipId &&
            state.recordingOverdubClipId === destination.overdubClipId &&
            state.recordingGuideMixUri === destination.guideMixUri &&
            state.recordingPunchInMs === destination.punchInMs
        ) {
            return;
        }
        set({
            recordingIdeaId: destination.ideaId,
            recordingParentClipId: destination.parentClipId,
            recordingOverdubClipId: destination.overdubClipId,
            recordingGuideMixUri: destination.guideMixUri,
            recordingPunchInMs: destination.punchInMs,
        });
    },
    recordingIdeaId: null,
    setRecordingIdeaId: (id) => set({ recordingIdeaId: id }),
    recordingParentClipId: null,
    // Every take is armed through here (a new take, a reply, a variation), and so
    // is a layer, which sets its own fields straight after. Arming therefore
    // clears any layer set-up left behind: a layer that was opened and backed out
    // of must never ride along into the next plain recording.
    setRecordingParentClipId: (id) =>
        set({
            recordingParentClipId: id,
            recordingOverdubClipId: null,
            recordingGuideMixUri: null,
            recordingPunchInMs: null,
        }),
    recordingOverdubClipId: null,
    setRecordingOverdubClipId: (id) => set({ recordingOverdubClipId: id }),
    recordingGuideMixUri: null,
    setRecordingGuideMixUri: (uri) => set({ recordingGuideMixUri: uri }),
    recordingPunchInMs: null,
    setRecordingPunchInMs: (ms) => set({ recordingPunchInMs: ms }),
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
            recordingPunchInMs: null,
        }),

    quickNameModalVisible: false,
    setQuickNameModalVisible: (v) => set({ quickNameModalVisible: v }),
    quickNameDraft: "",
    setQuickNameDraft: (v) => set({ quickNameDraft: v }),
    quickNamingIdeaId: null,
    setQuickNamingIdeaId: (v) => set({ quickNamingIdeaId: v }),
});
