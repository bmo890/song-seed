import { create } from "zustand";
import { createRecordingSlice, type RecordingSlice } from "../recordingSlice";

const makeStore = () => create<RecordingSlice>()((...args) => createRecordingSlice(...args));

describe("arming a recording", () => {
  it("drops a layer set-up left behind when a plain take is armed", () => {
    const store = makeStore();
    // A layer was opened on a clip, punched in at 8 s, and then backed out of.
    store.getState().setRecordingIdeaId("idea-1");
    store.getState().setRecordingParentClipId(null);
    store.getState().setRecordingOverdubClipId("clip-4");
    store.getState().setRecordingGuideMixUri("file:///guide.m4a");
    store.getState().setRecordingPunchInMs(8000);

    // Now a new take is started in the sketch.
    store.getState().setRecordingParentClipId(null);
    store.getState().setRecordingIdeaId("idea-1");

    const state = store.getState();
    expect(state.recordingOverdubClipId).toBeNull();
    expect(state.recordingGuideMixUri).toBeNull();
    expect(state.recordingPunchInMs).toBeNull();
    expect(state.recordingIdeaId).toBe("idea-1");
  });

  it("still lets a layer set its own fields after arming", () => {
    const store = makeStore();
    store.getState().setRecordingIdeaId("idea-1");
    store.getState().setRecordingParentClipId(null);
    store.getState().setRecordingOverdubClipId("clip-4");
    store.getState().setRecordingGuideMixUri("file:///guide.m4a");
    store.getState().setRecordingPunchInMs(8000);
    const state = store.getState();
    expect(state.recordingOverdubClipId).toBe("clip-4");
    expect(state.recordingPunchInMs).toBe(8000);
  });

  it("a reply to a take is a plain take too", () => {
    const store = makeStore();
    store.getState().setRecordingOverdubClipId("clip-4");
    store.getState().setRecordingParentClipId("clip-2");
    expect(store.getState().recordingParentClipId).toBe("clip-2");
    expect(store.getState().recordingOverdubClipId).toBeNull();
  });
});
