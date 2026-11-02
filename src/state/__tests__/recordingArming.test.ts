import { create } from "zustand";
import { createRecordingSlice, type RecordingSlice } from "../recordingSlice";
import { getActiveRecordingTakeSession } from "../../services/recordingTakeSession";

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

// Audit 2026-11-02, 12d D-H2: any record button pressed while a take was minimised
// re-aimed the running take (a sketch take saved as a clip in another collection, a
// layer as a plain clip).
describe("a record button while a take holds the recorder", () => {
  const facts = () => getActiveRecordingTakeSession().facts;

  afterEach(() => {
    facts().recordingStartedAt = null;
    facts().fileUri = null;
    facts().destination = null;
  });

  it("does not re-aim the running take", () => {
    const store = makeStore();
    expect(store.getState().armRecording({ ideaId: "sketch-a" })).toBe(true);
    // The sketch take starts and is minimised.
    facts().recordingStartedAt = 1;
    facts().fileUri = "file:///doc/take.wav";
    facts().destination = {
      ideaId: "sketch-a",
      parentClipId: null,
      overdubClipId: null,
      guideMixUri: null,
      punchInMs: null,
    };

    // A collection's Record button, then a player's Layer key.
    expect(store.getState().armRecording({ ideaId: "clip-shell-b" })).toBe(false);
    expect(
      store.getState().armRecording({
        ideaId: "song-c",
        overdubClipId: "take-9",
        guideMixUri: "file:///g.m4a",
        punchInMs: 4000,
      })
    ).toBe(false);

    const state = store.getState();
    expect(state.recordingIdeaId).toBe("sketch-a");
    expect(state.recordingOverdubClipId).toBeNull();
    expect(state.recordingPunchInMs).toBeNull();
  });

  it("puts the context back on the held take when something else moved it", () => {
    const store = makeStore();
    facts().recordingStartedAt = 1;
    facts().destination = {
      ideaId: "song-c",
      parentClipId: null,
      overdubClipId: "take-9",
      guideMixUri: "file:///g.m4a",
      punchInMs: 4000,
    };
    store.getState().clearRecordingContext();

    store.getState().adoptHeldTakeContext();

    const state = store.getState();
    expect(state.recordingIdeaId).toBe("song-c");
    expect(state.recordingOverdubClipId).toBe("take-9");
    expect(state.recordingGuideMixUri).toBe("file:///g.m4a");
    expect(state.recordingPunchInMs).toBe(4000);
  });

  it("arms freely once the take is settled", () => {
    const store = makeStore();
    expect(store.getState().armRecording({ ideaId: "idea-2", parentClipId: "clip-1" })).toBe(true);
    expect(store.getState().recordingParentClipId).toBe("clip-1");
  });
});
