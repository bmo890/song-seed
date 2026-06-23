import {
    assertSafeBackupMediaPath,
    prepareDisasterRecoverySnapshot,
    validateDisasterRecoveryManifest,
} from "../disasterRecoveryValidation";
import type { DrBackupManifest } from "../disasterRecoveryBackup";

const CLIP_PATH = "songseed/audio/clip-1.m4a";
const STEM_PATH = "songseed/audio/stem-1.m4a";

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
                                sourceAudioUri: "songseed/audio/missing-source.wav",
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
                                    renderedMixUri: "songseed/audio/missing-mix.m4a",
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
        expect(() => assertSafeBackupMediaPath("songseed/audio/../state.json")).toThrow("unsafe");
        expect(() => assertSafeBackupMediaPath("other/audio.m4a")).toThrow("unsafe");
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
                            path: "songseed/audio/missing.m4a",
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

        expect(clip.audioUri).toBe("songseed/audio/restored-restore-123/clip-1.m4a");
        expect(clip.overdub!.stems[0].audioUri).toBe(
            "songseed/audio/restored-restore-123/stem-1.m4a"
        );
        expect(clip.sourceAudioUri).toBeUndefined();
        expect(clip.overdub!.renderedMixUri).toBeUndefined();
        expect(clip.overdub!.renderedMixDurationMs).toBeUndefined();
        expect(clip.overdub!.renderedMixWaveformPeaks).toBeUndefined();
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
