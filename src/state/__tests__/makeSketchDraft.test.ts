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
 * "Make sketch" on a clip is a draft like every other new sketch (2026-10-12):
 * Discard turns the idea back into the clip it was, in place; Save keeps the
 * sketch. "Keep takes" on a saved sketch releases its takes as clip ideas.
 */

const OLD = Date.now() - 7 * 24 * 60 * 60 * 1000;

const clipIdea = (id: string) => ({
    id,
    title: id,
    notes: "",
    status: "clip",
    completionPct: 0,
    kind: "clip",
    collectionId: "col",
    createdAt: OLD,
    lastActivityAt: OLD,
    clips: [
        {
            id: `${id}-take`,
            title: id,
            notes: "",
            createdAt: OLD,
            isPrimary: true,
            audioUri: `file:///${id}.m4a`,
            durationMs: 1000,
            tags: ["riff"],
        },
    ],
});

function seed() {
    useStore.setState({
        activeWorkspaceId: "ws",
        workspaces: [
            {
                id: "ws",
                title: "W",
                collections: [
                    {
                        id: "col",
                        title: "Ideas",
                        workspaceId: "ws",
                        parentCollectionId: null,
                        createdAt: OLD,
                        updatedAt: OLD,
                        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                    },
                ],
                ideas: [clipIdea("porch")],
            },
        ],
        selectedIdeaId: null,
        activityEvents: [],
        playlists: [],
    } as never);
}

const ideaOf = (id: string) => useStore.getState().workspaces[0]!.ideas.find((idea) => idea.id === id);

describe("Make sketch is a draft (2026-10-12)", () => {
    beforeEach(seed);

    it("converts in place as a draft that remembers it was a clip, without stamping activity", () => {
        expect(appActions.convertClipIdeaToProject("porch")).toBe(true);
        const draft = ideaOf("porch")!;
        expect(draft.kind).toBe("project");
        expect(draft.isDraft).toBe(true);
        expect(draft.draftFromClipIdea).toBe(true);
        expect(draft.lastActivityAt).toBe(OLD);
    });

    it("discarding the draft turns it back into the clip, same id, nothing lost", () => {
        appActions.convertClipIdeaToProject("porch");
        useStore.getState().setSelectedIdeaId("porch");

        appActions.deleteSelectedIdea(true);

        const clip = ideaOf("porch")!;
        expect(clip.kind).toBe("clip");
        expect(clip.isDraft).toBeUndefined();
        expect(clip.draftFromClipIdea).toBeUndefined();
        expect(clip.lyrics).toBeUndefined();
        expect(clip.lastActivityAt).toBe(OLD);
        expect(clip.clips[0]!.tags).toEqual(["riff"]);
        expect(useStore.getState().workspaces[0]!.ideas).toHaveLength(1);
    });
});

describe("Keep takes (dissolveSketch, 2026-10-12)", () => {
    beforeEach(seed);

    it("releases every take as its own clip idea and removes the sketch", () => {
        appActions.convertClipIdeaToProject("porch");
        useStore.getState().updateIdeas((ideas) =>
            ideas.map((idea) =>
                idea.id === "porch"
                    ? {
                          ...idea,
                          isDraft: false,
                          draftFromClipIdea: undefined,
                          clips: [
                              ...idea.clips,
                              { ...idea.clips[0]!, id: "porch-take-2", title: "second", isPrimary: false, createdAt: OLD + 1 },
                          ],
                      }
                    : idea
            )
        );
        useStore.setState({
            activityEvents: [
                { id: "e1", at: OLD, workspaceId: "ws", collectionId: "col", ideaId: "porch", ideaKind: "song", ideaTitle: "porch", clipId: "porch-take-2", metric: "created", source: "record" },
                { id: "e2", at: OLD, workspaceId: "ws", collectionId: "col", ideaId: "porch", ideaKind: "song", ideaTitle: "porch", clipId: null, metric: "created", source: "song-save" },
            ],
        } as never);

        const released = appActions.dissolveSketch("porch");

        expect(released.sort()).toEqual(["porch-take", "porch-take-2"]);
        const ideas = useStore.getState().workspaces[0]!.ideas;
        expect(ideas.map((idea) => idea.kind)).toEqual(["clip", "clip"]);
        expect(ideas.find((idea) => idea.id === "porch")).toBeUndefined();
        expect(ideas.every((idea) => idea.clips.length === 1 && idea.clips[0]!.isPrimary)).toBe(true);
        const events = useStore.getState().activityEvents;
        expect(events.map((event) => event.id)).toEqual(["e1"]);
        expect(events[0]!.ideaId).toBe("porch-take-2");
    });
});
