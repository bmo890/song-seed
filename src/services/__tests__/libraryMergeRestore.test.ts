import { mergeRestoredLibrary } from "../libraryMergeRestore";
import type { PersistedAppStore } from "../../state/storeTypes";

function clip(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id,
        title: `Clip ${id}`,
        notes: "",
        createdAt: 0,
        isPrimary: false,
        audioUri: `songseed/audio/${id}.m4a`,
        ...overrides,
    };
}

function idea(id: string, clips: unknown[], overrides: Record<string, unknown> = {}) {
    return {
        id,
        title: `Idea ${id}`,
        notes: "",
        status: "seed",
        completionPct: 0,
        kind: "project",
        collectionId: "col-1",
        createdAt: 0,
        lastActivityAt: 0,
        clips,
        ...overrides,
    };
}

function workspace(id: string, ideas: unknown[], overrides: Record<string, unknown> = {}) {
    return {
        id,
        title: `Workspace ${id}`,
        collections: [
            {
                id: "col-1",
                title: "Ideas",
                workspaceId: id,
                createdAt: 0,
                updatedAt: 0,
            },
        ],
        ideas,
        ...overrides,
    };
}

function snapshot(overrides: Partial<Record<keyof PersistedAppStore, unknown>>): PersistedAppStore {
    return {
        workspaces: [],
        activityEvents: [],
        activeWorkspaceId: null,
        primaryWorkspaceId: null,
        primaryCollectionIdByWorkspace: {},
        lastUsedWorkspaceId: null,
        workspaceStartupPreference: "last-used",
        workspaceListOrder: "last-worked",
        workspaceLastOpenedAt: {},
        collectionLastOpenedAt: {},
        playlists: [],
        songbooks: [],
        setlists: [],
        preferredRecordingInputId: null,
        bluetoothMonitoringCalibrations: {},
        metronomeBpm: 120,
        metronomeMeterId: "4-4",
        metronomeOutputs: {},
        metronomeBeepLevel: 0.5,
        metronomeHapticLevel: 0.5,
        metronomeCountInBars: 0,
        globalCustomClipTags: [],
        backupReminderFrequency: "off",
        hapticsEnabled: true,
        lastSuccessfulBackupAt: null,
        lastSuccessfulBackupFileName: null,
        notes: [],
        wordLadders: [],
        cutUpSparks: [],
        ideasFilter: "all",
        ideasSort: "recent",
        primaryFilter: "all",
        primarySort: "recent",
        ...overrides,
    } as unknown as PersistedAppStore;
}

describe("mergeRestoredLibrary", () => {
    it("keeps current-only items and brings back backup-only items at every level", () => {
        const restored = snapshot({
            workspaces: [
                workspace("ws-1", [
                    idea("idea-1", [clip("clip-a"), clip("clip-lost")]),
                    idea("idea-lost", [clip("clip-x")]),
                ]),
                workspace("ws-lost", [idea("idea-z", [clip("clip-z")])]),
            ],
        });
        const current = snapshot({
            workspaces: [
                workspace("ws-1", [
                    idea("idea-1", [clip("clip-a", { title: "Edited after backup" }), clip("clip-new")]),
                    idea("idea-new", [clip("clip-n")]),
                ]),
                workspace("ws-new", [idea("idea-w", [clip("clip-w")])]),
            ],
        });

        const merged = mergeRestoredLibrary(restored, current);

        const ws1 = merged.workspaces.find((ws) => ws.id === "ws-1")!;
        const idea1 = ws1.ideas.find((item) => item.id === "idea-1")!;
        // Collision → current (newer) wins.
        expect(idea1.clips.find((c) => c.id === "clip-a")!.title).toBe("Edited after backup");
        // Current-only survives; backup-only comes back.
        expect(idea1.clips.map((c) => c.id).sort()).toEqual(["clip-a", "clip-lost", "clip-new"]);
        expect(ws1.ideas.map((item) => item.id).sort()).toEqual([
            "idea-1",
            "idea-lost",
            "idea-new",
        ]);
        expect(merged.workspaces.map((ws) => ws.id).sort()).toEqual(["ws-1", "ws-lost", "ws-new"]);
    });

    it("never lets a returning backup clip steal the primary flag", () => {
        const restored = snapshot({
            workspaces: [
                workspace("ws-1", [
                    idea("idea-1", [clip("clip-old-primary", { isPrimary: true })]),
                ]),
            ],
        });
        const current = snapshot({
            workspaces: [
                workspace("ws-1", [idea("idea-1", [clip("clip-current", { isPrimary: true })])]),
            ],
        });

        const merged = mergeRestoredLibrary(restored, current);
        const clips = merged.workspaces[0].ideas[0].clips;
        expect(clips.filter((c) => c.isPrimary).map((c) => c.id)).toEqual(["clip-current"]);
        expect(clips.map((c) => c.id).sort()).toEqual(["clip-current", "clip-old-primary"]);
    });

    it("unions top-level collections by id with current winning collisions", () => {
        const restored = snapshot({
            notes: [
                { id: "note-1", title: "Old title", body: "", createdAt: 0, updatedAt: 0 },
                { id: "note-lost", title: "Lost", body: "", createdAt: 0, updatedAt: 0 },
            ],
            playlists: [{ id: "pl-lost", title: "Lost playlist", items: [] }],
        });
        const current = snapshot({
            notes: [{ id: "note-1", title: "New title", body: "", createdAt: 0, updatedAt: 5 }],
            playlists: [{ id: "pl-new", title: "New playlist", items: [] }],
        });

        const merged = mergeRestoredLibrary(restored, current);
        expect(merged.notes.map((n) => n.id).sort()).toEqual(["note-1", "note-lost"]);
        expect(merged.notes.find((n) => n.id === "note-1")!.title).toBe("New title");
        expect(merged.playlists.map((p) => p.id).sort()).toEqual(["pl-lost", "pl-new"]);
    });

    it("keeps current scalar settings and merges keyed records per key", () => {
        const restored = snapshot({
            metronomeBpm: 90,
            backupReminderFrequency: "weekly",
            workspaceLastOpenedAt: { "ws-1": 100, "ws-lost": 50 },
        });
        const current = snapshot({
            metronomeBpm: 128,
            backupReminderFrequency: "monthly",
            workspaceLastOpenedAt: { "ws-1": 900 },
        });

        const merged = mergeRestoredLibrary(restored, current);
        expect(merged.metronomeBpm).toBe(128);
        expect(merged.backupReminderFrequency).toBe("monthly");
        expect(merged.workspaceLastOpenedAt).toEqual({ "ws-1": 900, "ws-lost": 50 });
    });

    it("is a no-op when the backup contains nothing the library lacks", () => {
        const shared = [workspace("ws-1", [idea("idea-1", [clip("clip-a")])])];
        const merged = mergeRestoredLibrary(
            snapshot({ workspaces: shared }),
            snapshot({ workspaces: shared })
        );
        expect(merged.workspaces).toEqual(shared);
    });
});
