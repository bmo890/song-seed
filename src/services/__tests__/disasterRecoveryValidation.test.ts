import {
    assertSafeBackupMediaPath,
    prepareDisasterRecoverySnapshot,
    validateDisasterRecoveryManifest,
} from "../disasterRecoveryValidation";
import type { DrBackupManifest } from "../disasterRecoveryBackup";

const CLIP_PATH = "songnook/audio/clip-1.m4a";
const STEM_PATH = "songnook/audio/stem-1.m4a";

function manifest(overrides: Partial<DrBackupManifest> = {}): DrBackupManifest {
    return {
        formatVersion: 1,
        storeVersion: 11,
        createdAt: "2026-06-23T10:00:00.000Z",
        status: "complete",
        counts: { workspaces: 1, collections: 1, ideas: 1, clips: 1 },
        snapshotSha256: "a".repeat(64),
        files: [
            { path: CLIP_PATH, sha256: "b".repeat(64), sizeBytes: 12 },
            { path: STEM_PATH, sha256: "c".repeat(64), sizeBytes: 8 },
        ],
        missing: [],
        ...overrides,
    };
}

function snapshot() {
    return {
        workspaces: [
            {
                id: "ws-1",
                title: "Workspace",
                collections: [
                    {
                        id: "collection-1",
                        title: "Ideas",
                        workspaceId: "ws-1",
                        createdAt: 0,
                        updatedAt: 0,
                        ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                    },
                ],
                ideas: [
                    {
                        id: "idea-1",
                        title: "Song",
                        notes: "",
                        status: "seedling",
                        completionPct: 0,
                        kind: "project",
                        collectionId: "collection-1",
                        createdAt: 0,
                        lastActivityAt: 0,
                        clips: [
                            {
                                id: "clip-1",
                                title: "Clip",
                                notes: "",
                                createdAt: 0,
                                isPrimary: true,
                                audioUri: CLIP_PATH,
                                sourceAudioUri: "songnook/audio/missing-source.wav",
                                overdub: {
                                    stems: [
                                        {
                                            id: "stem-1",
                                            title: "Stem",
                                            gainDb: 0,
                                            offsetMs: 0,
                                            tonePreset: "neutral",
                                            isMuted: false,
                                            createdAt: 0,
                                            audioUri: STEM_PATH,
                                        },
                                    ],
                                    renderedMixUri: "songnook/audio/missing-mix.m4a",
                                    renderedMixDurationMs: 1000,
                                    renderedMixWaveformPeaks: [0.5],
                                },
                            },
                        ],
                    },
                ],
            },
        ],
        activityEvents: [],
        playlists: [],
        notes: [],
    };
}

describe("disaster recovery manifest validation", () => {
    it("rejects traversal and paths outside managed backup storage", () => {
        expect(() => assertSafeBackupMediaPath("songnook/audio/../state.json")).toThrow("unsafe");
        expect(() => assertSafeBackupMediaPath("other/audio.m4a")).toThrow("unsafe");
        expect(() => assertSafeBackupMediaPath("songnook/trash/audio.m4a")).toThrow("unsafe");
    });

    it("accepts every prefix the backup writer packs (audio, archives, preview mixes)", () => {
        // Regression: a backup containing an overdub preview mix (songnook/preview-audio/)
        // hard-failed the ENTIRE restore because the validator only knew audio + archives.
        expect(assertSafeBackupMediaPath("songnook/audio/clip.m4a")).toBe("songnook/audio/clip.m4a");
        expect(assertSafeBackupMediaPath("songnook/workspace-archives/ws.zip")).toBe(
            "songnook/workspace-archives/ws.zip"
        );
        expect(assertSafeBackupMediaPath("songnook/preview-audio/clip-1-preview.m4a")).toBe(
            "songnook/preview-audio/clip-1-preview.m4a"
        );
    });

    it("rejects backups from a newer store version", () => {
        expect(() =>
            validateDisasterRecoveryManifest(manifest({ storeVersion: 12 }), 1, 11)
        ).toThrow("newer app data version");
    });

    it("rejects a completion status that hides critical missing recordings", () => {
        expect(() =>
            validateDisasterRecoveryManifest(
                manifest({
                    missing: [
                        {
                            path: "songnook/audio/missing.m4a",
                            kind: "clip-audio",
                            critical: true,
                            ref: "idea:i/clip:c",
                        },
                    ],
                }),
                1,
                11
            )
        ).toThrow("completion status");
    });
});

describe("prepareDisasterRecoverySnapshot", () => {
    it("rewrites critical media to unique destinations and removes missing derived media", () => {
        const prepared = prepareDisasterRecoverySnapshot(snapshot(), manifest(), "restore-123");
        const clip = prepared.snapshot.workspaces[0].ideas[0].clips[0];

        expect(clip.audioUri).toBe("songnook/audio/restored-restore-123/clip-1.m4a");
        expect(clip.overdub!.stems[0].audioUri).toBe(
            "songnook/audio/restored-restore-123/stem-1.m4a"
        );
        expect(clip.sourceAudioUri).toBeUndefined();
        expect(clip.overdub!.renderedMixUri).toBeUndefined();
        expect(clip.overdub!.renderedMixDurationMs).toBeUndefined();
        expect(clip.overdub!.renderedMixWaveformPeaks).toBeUndefined();
    });

    it("restores an overdub preview mix to a preview-audio destination", () => {
        const previewPath = "songnook/preview-audio/clip-1-preview-123.m4a";
        const withPreview = snapshot();
        withPreview.workspaces[0].ideas[0].clips[0].overdub.renderedMixUri = previewPath;

        const prepared = prepareDisasterRecoverySnapshot(
            withPreview,
            manifest({
                files: [
                    { path: CLIP_PATH, sha256: "b".repeat(64), sizeBytes: 12 },
                    { path: STEM_PATH, sha256: "c".repeat(64), sizeBytes: 8 },
                    { path: previewPath, sha256: "d".repeat(64), sizeBytes: 6 },
                ],
            }),
            "restore-123"
        );

        expect(prepared.destinationPathBySourcePath.get(previewPath)).toBe(
            `songnook/preview-audio/restored-restore-123/clip-1-preview-123.m4a`
        );
        expect(
            prepared.snapshot.workspaces[0].ideas[0].clips[0].overdub?.renderedMixUri
        ).toBe("songnook/preview-audio/restored-restore-123/clip-1-preview-123.m4a");
    });

    it("salvage drops missing clips/stems, promotes a surviving primary, and reports skips", () => {
        const missingAudio = "songnook/audio/gone.m4a";
        const missingStem = "songnook/audio/gone-stem.m4a";
        const value = snapshot();
        const idea = value.workspaces[0].ideas[0];
        // clip-1 (primary) keeps its audio but loses one of two stems; a second primary-less
        // clip whose audio is gone gets dropped entirely.
        idea.clips[0].overdub.stems.push({
            id: "stem-2",
            title: "Gone layer",
            gainDb: 0,
            offsetMs: 0,
            tonePreset: "neutral",
            isMuted: false,
            createdAt: 0,
            audioUri: missingStem,
        });
        idea.clips.push({
            id: "clip-2",
            title: "Lost take",
            notes: "",
            createdAt: 5,
            isPrimary: false,
            audioUri: missingAudio,
        } as unknown as (typeof idea.clips)[number]);
        // Make the LOST clip the primary to exercise promotion.
        idea.clips[0].isPrimary = false;
        idea.clips[1].isPrimary = true;

        const prepared = prepareDisasterRecoverySnapshot(
            value,
            manifest({ counts: { workspaces: 1, collections: 1, ideas: 1, clips: 2 } }),
            "restore-123",
            { salvage: true }
        );

        const clips = prepared.snapshot.workspaces[0].ideas[0].clips;
        expect(clips.map((c) => c.id)).toEqual(["clip-1"]);
        // The dropped clip was primary → the survivor is promoted.
        expect(clips[0].isPrimary).toBe(true);
        // The missing stem is gone; the surviving stem remains.
        expect(clips[0].overdub?.stems.map((s) => s.id)).toEqual(["stem-1"]);
        expect(prepared.skipped).toEqual([
            expect.objectContaining({ kind: "overdub-stem", ref: "idea:idea-1/clip:clip-1/stem:stem-2" }),
            expect.objectContaining({ kind: "clip", ref: "idea:idea-1/clip:clip-2" }),
        ]);
    });

    it("keeps an offloaded workspace stub even though its package is absent from the backup", () => {
        const offloadedWorkspace = {
            id: "ws-offloaded",
            title: "Offloaded",
            collections: [],
            ideas: [],
            isArchived: true,
            archiveState: {
                schemaVersion: 2,
                archivedAt: 1,
                archiveUri: "songnook/workspace-archives/gone.songnook-workspace.zip",
                packageSizeBytes: 10,
                originalAudioBytes: 10,
                originalMetadataBytes: 1,
                archivedMetadataBytes: 1,
                savingsBytes: 0,
                audioFileCount: 1,
                missingFileCount: 0,
                offloadedAt: 123,
                offloadedFileName: "gone.songnook-workspace.zip",
            },
        };
        const value = snapshot();
        (value.workspaces as unknown[]).push(offloadedWorkspace);

        for (const salvage of [false, true]) {
            const prepared = prepareDisasterRecoverySnapshot(
                value,
                manifest({ counts: { workspaces: 2, collections: 1, ideas: 1, clips: 1 } }),
                "restore-123",
                { salvage }
            );
            const stub = prepared.snapshot.workspaces.find((ws) => ws.id === "ws-offloaded");
            expect(stub).toBeDefined();
            // The stub survives untouched — unarchiving asks the user for the file.
            expect(stub!.archiveState?.archiveUri).toBe(
                "songnook/workspace-archives/gone.songnook-workspace.zip"
            );
            expect(stub!.archiveState?.offloadedAt).toBe(123);
            expect(prepared.skipped).toEqual([]);
        }
    });

    it("without salvage, missing critical audio still fails preparation", () => {
        const value = snapshot();
        value.workspaces[0].ideas[0].clips[0].audioUri = "songnook/audio/gone.m4a";
        expect(() =>
            prepareDisasterRecoverySnapshot(value, manifest(), "restore-123")
        ).toThrow("missing critical audio");
    });

    it("rejects a snapshot whose critical clip audio is absent from the manifest", () => {
        expect(() =>
            prepareDisasterRecoverySnapshot(
                snapshot(),
                manifest({ files: manifest().files.filter((record) => record.path !== CLIP_PATH) }),
                "restore-123"
            )
        ).toThrow("missing critical audio");
    });

    it("preserves every persisted field through restore preparation (full-schema round trip)", () => {
        // Everything the app persists must come back from a restore. The backup side is
        // enforced by the PersistedAppStore return type of buildPersistedAppStoreSnapshot;
        // this locks the restore side: preparation may rewrite media URIs but must never
        // drop a field, known or newly added.
        const fullSnapshot = {
            ...snapshot(),
            activityEvents: [{ id: "evt-1", kind: "clip-recorded", at: 123 }],
            activeWorkspaceId: "ws-1",
            primaryWorkspaceId: "ws-1",
            primaryCollectionIdByWorkspace: { "ws-1": "collection-1" },
            lastUsedWorkspaceId: "ws-1",
            workspaceStartupPreference: "last-used",
            workspaceListOrder: ["ws-1"],
            workspaceLastOpenedAt: { "ws-1": 456 },
            collectionLastOpenedAt: { "collection-1": 789 },
            playlists: [{ id: "pl-1", title: "Playlist", clipRefs: [] }],
            songbooks: [{ id: "sb-1", title: "Songbook", songIds: [] }],
            setlists: [{ id: "sl-1", title: "Setlist", items: [] }],
            preferredRecordingInputId: "mic-1",
            bluetoothMonitoringCalibrations: { "device-1": { latencyMs: 120 } },
            metronomeBpm: 96,
            metronomeMeterId: "4-4",
            metronomeOutputs: { beep: true, haptic: false },
            metronomeBeepLevel: 0.8,
            metronomeHapticLevel: 0.5,
            metronomeCountInBars: 1,
            globalCustomClipTags: ["voice-memo"],
            backupReminderFrequency: "weekly",
            hapticsEnabled: true,
            lastSuccessfulBackupAt: 1720000000000,
            lastSuccessfulBackupFileName: "SongNook Backup.zip",
            notes: [{ id: "note-1", text: "Lyric idea", createdAt: 0, updatedAt: 0 }],
            wordLadders: [{ id: "wl-1", words: ["seed"] }],
            cutUpSparks: [{ id: "cs-1", fragments: ["chorus"] }],
            ideasFilter: "all",
            ideasSort: "recent",
            primaryFilter: "all",
            primarySort: "recent",
        };

        const prepared = prepareDisasterRecoverySnapshot(fullSnapshot, manifest(), "restore-123");

        for (const key of Object.keys(fullSnapshot)) {
            expect(prepared.snapshot).toHaveProperty(key);
            if (key !== "workspaces") {
                expect((prepared.snapshot as Record<string, unknown>)[key]).toEqual(
                    (fullSnapshot as Record<string, unknown>)[key]
                );
            }
        }
        // Workspaces survive too — only media URIs are rewritten to restore destinations.
        const clip = prepared.snapshot.workspaces[0].ideas[0].clips[0];
        expect(clip.id).toBe("clip-1");
        expect(clip.audioUri).toMatch(/^songnook\/audio\/restored-/);
    });

    it("rejects snapshot counts that do not match the manifest", () => {
        expect(() =>
            prepareDisasterRecoverySnapshot(
                snapshot(),
                manifest({ counts: { workspaces: 1, collections: 1, ideas: 2, clips: 1 } }),
                "restore-123"
            )
        ).toThrow("counts");
    });
});
