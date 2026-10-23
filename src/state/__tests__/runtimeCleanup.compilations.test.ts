import { buildRuntimeCleanupPatch } from "../runtimeCleanup";
import type { Setlist, Songbook, Workspace } from "../../types";

/**
 * Deleting an idea (or a whole workspace) used to prune playlists only; songbooks
 * and setlists kept dangling ids forever — a ghost "Unavailable song" row in every
 * book that held it, and an entry the setlist export skipped in silence
 * (final sweep 2026-10-22, #17). The cleanup patch now drops those entries too.
 */

const songbook = (id: string, refs: Array<[string, string]>): Songbook => ({
    id,
    title: id,
    createdAt: 1,
    updatedAt: 1,
    items: refs.map(([workspaceId, ideaId], index) => ({
        id: `${id}-item-${index}`,
        kind: "lyricChart",
        workspaceId,
        ideaId,
        addedAt: 1,
    })),
});

const setlist = (id: string, refs: Array<[string, string]>): Setlist => ({
    id,
    title: id,
    createdAt: 1,
    updatedAt: 1,
    entries: refs.map(([workspaceId, ideaId], index) => ({
        id: `${id}-entry-${index}`,
        workspaceId,
        ideaId,
        clipIds: [],
        lyricVersionIds: [],
        includeChordSheet: true,
        addedAt: 1,
    })),
});

function baseStore(): Parameters<typeof buildRuntimeCleanupPatch>[0] {
    return {
        workspaces: [] as Workspace[],
        activeWorkspaceId: "ws-a",
        primaryWorkspaceId: "ws-a",
        lastUsedWorkspaceId: "ws-a",
        selectedIdeaId: null,
        editingIdeaId: null,
        pendingPrimaryClipId: null,
        clipSelectionMode: false,
        selectedClipIds: [],
        listSelectionMode: false,
        selectedListIdeaIds: [],
        clipClipboard: null,
        movingClipId: null,
        playerTarget: null,
        playerQueue: [],
        playerQueueIndex: 0,
        playerShouldAutoplay: false,
        playerPositionMs: 0,
        playerDurationMs: 0,
        playerIsPlaying: false,
        playerCloseRequestToken: 0,
        inlineTarget: null,
        inlinePositionMs: 0,
        inlineDurationMs: 0,
        inlineIsPlaying: false,
        inlineStopRequestToken: 0,
        recordingIdeaId: null,
        recordingParentClipId: null,
        recordingOverdubClipId: null,
        recordingGuideMixUri: null,
        recordingPunchInMs: null,
        quickNamingIdeaId: null,
        quickNameModalVisible: false,
        quickNameDraft: "",
        activityEvents: [],
        playlists: [],
        songbooks: [songbook("book", [["ws-a", "idea-1"], ["ws-a", "idea-2"], ["ws-b", "idea-3"]])],
        setlists: [setlist("set", [["ws-a", "idea-1"], ["ws-b", "idea-3"]])],
    };
}

describe("buildRuntimeCleanupPatch · songbooks and setlists", () => {
    it("drops the entries whose idea was deleted and keeps the rest in order", () => {
        const patch = buildRuntimeCleanupPatch(baseStore(), {
            nextWorkspaces: [],
            removedIdeaIds: ["idea-1"],
        });
        expect(patch.songbooks[0].items.map((item) => item.ideaId)).toEqual(["idea-2", "idea-3"]);
        expect(patch.setlists[0].entries.map((entry) => entry.ideaId)).toEqual(["idea-3"]);
    });

    it("drops every entry that lived in a deleted workspace", () => {
        const patch = buildRuntimeCleanupPatch(baseStore(), {
            nextWorkspaces: [],
            removedWorkspaceIds: ["ws-b"],
        });
        expect(patch.songbooks[0].items.map((item) => item.ideaId)).toEqual(["idea-1", "idea-2"]);
        expect(patch.setlists[0].entries.map((entry) => entry.ideaId)).toEqual(["idea-1"]);
    });

    it("keeps the lists' identity when nothing of theirs was removed", () => {
        const store = baseStore();
        const patch = buildRuntimeCleanupPatch(store, {
            nextWorkspaces: [],
            removedIdeaIds: ["idea-elsewhere"],
            removedClipIds: ["clip-x"],
        });
        expect(patch.songbooks).toBe(store.songbooks);
        expect(patch.setlists).toBe(store.setlists);
    });
});
