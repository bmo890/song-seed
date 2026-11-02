jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn(), setAudioModeAsync: jest.fn() }));
jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-file-system", () => ({ documentDirectory: "file:///docs/", cacheDirectory: "file:///cache/" }));
jest.mock("expo-sharing", () => ({}));
jest.mock("expo-haptics", () => ({}));
jest.mock("../../services/waveformAnalysis", () => ({}));
jest.mock("../../services/audioStorage", () => ({}));

import { useStore } from "../useStore";
import { appActions } from "../actions";

/**
 * Data-safety audit 2026-11-02, root cause 2: item-level actions wrote only to the
 * ACTIVE workspace. A sketch opened from a visited collection, the player queue,
 * Search or Activity lives elsewhere, so renames, notes, stage, hides, takes and
 * new sketches were dropped or landed in the wrong workspace (04-H2, 08-R1, 12c).
 * Every family below edits an item in a workspace that is NOT active.
 */

const OLD = Date.now() - 7 * 24 * 60 * 60 * 1000;

const clip = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    title: id,
    notes: "",
    createdAt: OLD,
    isPrimary: true,
    audioUri: `file:///${id}.m4a`,
    durationMs: 1000,
    ...extra,
});

const clipIdea = (id: string, collectionId: string, clips = [clip(`${id}-take`)]) => ({
    id,
    title: id,
    notes: "",
    status: "clip",
    completionPct: 0,
    kind: "clip",
    collectionId,
    createdAt: OLD,
    lastActivityAt: OLD,
    clips,
});

const sketch = (id: string, collectionId: string) => ({
    ...clipIdea(id, collectionId, [clip(`${id}-a`), clip(`${id}-b`, { isPrimary: false })]),
    kind: "project",
    status: "seed",
    lyrics: { versions: [] },
});

const workspace = (id: string, ideas: unknown[]) => ({
    id,
    title: id,
    collections: [
        {
            id: `${id}-col`,
            title: "Ideas",
            workspaceId: id,
            parentCollectionId: null,
            createdAt: OLD,
            updatedAt: OLD,
            ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
        },
    ],
    ideas,
});

function seed() {
    useStore.setState({
        activeWorkspaceId: "here",
        workspaces: [
            workspace("here", []),
            workspace("band", [clipIdea("riff", "band-col"), sketch("song", "band-col")]),
        ],
        selectedIdeaId: null,
        selectedClipIds: [],
        movingClipId: null,
        activityEvents: [],
        playlists: [],
        setlists: [],
        songbooks: [],
    } as never);
}

const band = () => useStore.getState().workspaces.find((ws) => ws.id === "band")!;
const here = () => useStore.getState().workspaces.find((ws) => ws.id === "here")!;
const inBand = (id: string) => band().ideas.find((idea) => idea.id === id);

describe("edits outside the active workspace land where the item lives", () => {
    beforeEach(seed);

    it("rename", () => {
        expect(useStore.getState().renameIdea("song", "Porch song")).toBe(true);
        expect(inBand("song")!.title).toBe("Porch song");
    });

    it("notes, stage and completion from the sketch page", () => {
        useStore.getState().setSelectedIdeaId("song");
        appActions.setIdeaNotes("second verse goes up");
        appActions.setIdeaStatus("song");
        expect(inBand("song")!.notes).toBe("second verse goes up");
        expect(inBand("song")!.status).toBe("song");
        appActions.setIdeaCompletion(50);
        expect(inBand("song")!.completionPct).toBe(50);
    });

    it("hide, hide days and show all in a visited collection", () => {
        useStore.getState().setIdeasHidden("band-col", ["riff"], true);
        expect(band().collections[0]!.ideasListState!.hiddenIdeaIds).toEqual(["riff"]);
        useStore.getState().setTimelineDaysHidden("band-col", [{ metric: "created", fromDay: "2026-01-05", toDay: "2026-01-05" }], true);
        expect(band().collections[0]!.ideasListState!.hiddenDays).toHaveLength(1);
        useStore.getState().showAllHidden("band-col");
        expect(band().collections[0]!.ideasListState!.hiddenIdeaIds).toEqual([]);
    });

    it("take order", () => {
        useStore.getState().setClipManualSortOrder("song", ["song-b", "song-a"]);
        expect(inBand("song")!.clips.find((c) => c.id === "song-b")!.manualSortOrder).toBe(0);
    });

    it("a new sketch and a record take from a visited collection land in that collection's workspace", () => {
        const sketchId = appActions.addIdea("band-col");
        expect(sketchId).toBeTruthy();
        expect(inBand(sketchId!)).toBeDefined();
        expect(here().ideas).toHaveLength(0);

        appActions.quickRecordIdea("band-col");
        const recordingId = useStore.getState().recordingIdeaId;
        expect(recordingId).toBeTruthy();
        expect(inBand(recordingId!)).toBeDefined();
        expect(here().ideas).toHaveLength(0);
    });

    it("discarding an empty take placeholder clears it where it was made", () => {
        appActions.quickRecordIdea("band-col");
        const recordingId = useStore.getState().recordingIdeaId!;
        expect(appActions.discardEmptyRecordingIdea()).toBe(true);
        expect(inBand(recordingId)).toBeUndefined();
    });

    it("a new version on a sketch", () => {
        useStore.getState().addClipVersion("song", { audioUri: "file:///new.m4a", durationMs: 10 });
        expect(inBand("song")!.clips).toHaveLength(3);
    });

    it("activity is logged against the idea's own workspace", () => {
        useStore.getState().logIdeaActivity("song", "updated", "song-save");
        expect(useStore.getState().activityEvents[0]).toMatchObject({ workspaceId: "band", ideaId: "song" });
    });

    it("deleting selected takes from a sketch", () => {
        useStore.setState({ selectedIdeaId: "song", selectedClipIds: ["song-b"] } as never);
        appActions.deleteSelectedClips();
        expect(inBand("song")!.clips.map((c) => c.id)).toEqual(["song-a"]);
    });

    it("moving a take into another sketch", () => {
        useStore.setState({
            workspaces: [
                workspace("here", []),
                workspace("band", [sketch("song", "band-col"), sketch("other", "band-col")]),
            ],
            selectedIdeaId: "song",
            movingClipId: "song-b",
        } as never);
        appActions.moveClipToProject("other");
        expect(inBand("song")!.clips.map((c) => c.id)).toEqual(["song-a"]);
        expect(inBand("other")!.clips.map((c) => c.id)).toContain("song-b");
    });

    it("copying takes names the sketch's own workspace as the source", () => {
        useStore.setState({ selectedIdeaId: "song", selectedClipIds: ["song-a"] } as never);
        appActions.startClipboardFromProject("copy");
        expect(useStore.getState().clipClipboard).toMatchObject({ sourceWorkspaceId: "band", sourceIdeaId: "song" });
    });
});

describe("Make sketch outside the active workspace (12a A-H1, 12b B-H1)", () => {
    beforeEach(seed);

    it("Discard puts the clip back instead of deleting it", () => {
        expect(appActions.convertClipIdeaToProject("riff")).toBe(true);
        useStore.getState().setSelectedIdeaId("riff");

        appActions.deleteSelectedIdea(true);

        const riff = inBand("riff");
        expect(riff).toBeDefined();
        expect(riff!.kind).toBe("clip");
        expect(riff!.clips.map((c) => c.id)).toEqual(["riff-take"]);
    });

    it("a gathered draft in another workspace releases its clips on Discard", () => {
        useStore.setState({
            workspaces: [
                workspace("here", []),
                workspace("band", [{ ...sketch("draft", "band-col"), isDraft: true }]),
            ],
            selectedIdeaId: "draft",
        } as never);

        appActions.deleteSelectedIdea(true);

        const kinds = band().ideas.map((idea) => idea.kind);
        expect(kinds).toEqual(["clip", "clip"]);
    });
});
