/**
 * Backup → restore must be the identity on the persisted library: every field, every file.
 * Builds a real backup with the production builder, restores it with the production restorer
 * over an in-memory filesystem, and deep-compares the committed snapshot against the
 * original (with media paths rewritten to the restore's token-scoped folder).
 */

const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(["file:///doc/", "file:///doc/songnook"]);
const mockPersistRawSnapshot = jest.fn<Promise<void>, [string, string]>();
const mockWriteSatelliteSnapshot = jest.fn(async (_snapshot: unknown, _mode: unknown) => ({ written: [], skipped: [] }));

function mockUtf8(value: string) {
    return Uint8Array.from(Buffer.from(value, "utf8"));
}

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    EncodingType: { Base64: "base64" },
    getFreeDiskStorageAsync: jest.fn(async () => 10 * 1024 * 1024 * 1024),
    getInfoAsync: jest.fn(async (uri: string) => {
        if (mockFiles.has(uri)) return { exists: true, size: mockFiles.get(uri)!.length };
        return { exists: mockDirectories.has(uri), isDirectory: mockDirectories.has(uri) };
    }),
    readAsStringAsync: jest.fn(async (uri: string, options?: { encoding?: string }) => {
        const value = mockFiles.get(uri);
        if (value == null) throw new Error(`Missing mock file: ${uri}`);
        if (options?.encoding === "base64") return Buffer.from(value).toString("base64");
        return Buffer.from(value).toString("utf8");
    }),
    writeAsStringAsync: jest.fn(async (uri: string, value: string) => {
        mockFiles.set(uri, mockUtf8(value));
    }),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
        mockDirectories.add(uri);
    }),
    readDirectoryAsync: jest.fn(async () => []),
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
    }),
    moveAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => {
    class MockFile {
        uri: string;
        constructor(uri: string) {
            this.uri = uri;
        }
        get exists() {
            return mockFiles.has(this.uri);
        }
        get size() {
            return mockFiles.get(this.uri)?.length ?? 0;
        }
        create(options?: { overwrite?: boolean }) {
            if (mockFiles.has(this.uri) && !options?.overwrite) throw new Error(`File already exists: ${this.uri}`);
            mockFiles.set(this.uri, new Uint8Array(0));
        }
        open() {
            if (!mockFiles.has(this.uri)) throw new Error(`Missing mock file: ${this.uri}`);
            const uri = this.uri;
            let offset: number | null = 0;
            return {
                readBytes: (length: number) => {
                    if (offset == null) throw new Error("Handle closed");
                    const source = mockFiles.get(uri)!;
                    const chunk = source.slice(offset, offset + length);
                    offset += chunk.length;
                    return chunk;
                },
                writeBytes: (bytes: Uint8Array) => {
                    if (offset == null) throw new Error("Handle closed");
                    const previous = mockFiles.get(uri)!;
                    const next = new Uint8Array(Math.max(previous.length, offset + bytes.length));
                    next.set(previous);
                    next.set(bytes, offset);
                    offset += bytes.length;
                    mockFiles.set(uri, next);
                },
                close: () => {
                    offset = null;
                },
                get offset() {
                    return offset;
                },
                set offset(value: number | null) {
                    offset = value;
                },
                get size() {
                    return offset == null ? null : mockFiles.get(uri)!.length;
                },
            };
        }
    }
    return { File: MockFile };
});

jest.mock("expo-crypto", () => ({
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
        require("crypto").createHash("sha256").update(value).digest("hex")
    ),
}));

// Stored (uncompressed) zip, matching the real writer's format so the streaming reader accepts it.
jest.mock("../zipArchive", () => ({
    createZipArchive: async (
        archiveUri: string,
        entries: Array<{ archiveName: string; data?: string | Uint8Array; fileUri?: string; directory?: boolean }>
    ) => {
        const input: Record<string, Uint8Array> = {};
        for (const entry of entries) {
            if (entry.directory) continue;
            if (typeof entry.data === "string") input[entry.archiveName] = mockUtf8(entry.data);
            else if (entry.data) input[entry.archiveName] = entry.data;
            else if (entry.fileUri) {
                const bytes = mockFiles.get(entry.fileUri);
                if (!bytes) throw new Error(`Missing file for zip entry: ${entry.fileUri}`);
                input[entry.archiveName] = bytes;
            }
        }
        const { zipSync } = require("fflate") as typeof import("fflate");
        mockFiles.set(archiveUri, Uint8Array.from(zipSync(input, { level: 0 })));
    },
}));

jest.mock("../audioStorage", () => ({ buildTimestampSlug: () => "2026-09-16-1200" }));
jest.mock("../../state/db/storage", () => ({
    persistRawSnapshot: (...args: [string, string]) => mockPersistRawSnapshot(...args),
}));
jest.mock("../../state/useStore", () => ({
    STORE_NAME: "songnook-store",
    STORE_VERSION: 12,
    buildPersistedAppStoreSnapshot: (state: unknown) => state,
}));
jest.mock("../../state/persistRuntime", () => ({ setPersistBlocked: jest.fn() }));
jest.mock("../../state/restoreRuntime", () => ({ requireRestoreRestart: jest.fn() }));
jest.mock("../satelliteSnapshot", () => ({
    sanitizeSatelliteSnapshot: (value: unknown) => value,
    writeSatelliteSnapshot: (snapshot: unknown, mode: unknown) => mockWriteSatelliteSnapshot(snapshot, mode),
}));

import { buildDisasterRecoveryBackup } from "../disasterRecoveryBackup";
import { restoreFromDisasterRecoveryBackup } from "../disasterRecoveryRestore";
import { toRelativeWorkspacesManagedMedia } from "../../state/rebaseManagedMedia";

const AUDIO = "file:///doc/songnook/audio";
const PREVIEW = "file:///doc/songnook/preview-audio";
const FILES: Record<string, string> = {
    [`${AUDIO}/clip-1.m4a`]: "clip one bytes",
    [`${AUDIO}/clip-1.m4a.waveform`]: '{"v":1,"bins":[1,2,3]}',
    [`${AUDIO}/clip-1-source.wav`]: "clip one original",
    [`${AUDIO}/clip-2.m4a`]: "clip two bytes",
    [`${AUDIO}/stem-1.m4a`]: "stem bytes",
    [`${AUDIO}/stem-1.m4a.waveform`]: '{"v":1,"bins":[9]}',
    [`${PREVIEW}/clip-1-mix.m4a`]: "rendered mix bytes",
};
const SATELLITES = { schemaVersion: 1, stores: { shelf: { name: "songnook-shelf-store", version: 1, state: { entries: [] } } } };

function libraryState() {
    return {
        workspaces: [
            {
                id: "ws-1",
                title: "Main",
                color: "#824f3f",
                collections: [
                    { id: "col-1", title: "Songs", workspaceId: "ws-1", createdAt: 1, updatedAt: 2, ideasListState: { hiddenIdeaIds: ["idea-2"], hiddenDays: [] } },
                ],
                ideas: [
                    {
                        id: "idea-1",
                        title: "Song",
                        notes: "n",
                        status: "stem",
                        completionPct: 40,
                        kind: "project",
                        collectionId: "col-1",
                        createdAt: 1,
                        lastActivityAt: 9,
                        isTitleAutoGenerated: false,
                        lyrics: { versions: [{ id: "lv-1", createdAt: 1, updatedAt: 1, textDirection: "rtl", document: { lines: [{ id: "l1", text: "שורה", chords: [{ id: "c1", chord: "Am", at: 0, graphemeAt: 0, root: "A", quality: "m" }] }] } }] },
                        chordSheet: { updatedAt: 3, sections: [{ id: "s1", label: "A", notes: "", measures: [{ id: "m1", chords: ["Am", "G"] }] }] },
                        songGrid: { schemaVersion: 1, segments: [{ atBar: 1, bpm: 100, meterId: "6/8" }] },
                        clipGroups: [{ id: "g1", name: "Takes", collapsed: false, createdAt: 1, updatedAt: 1 }],
                        clipGroupAssignments: { "clip-1": "g1" },
                        clips: [
                            {
                                id: "clip-1",
                                title: "Take",
                                notes: "",
                                createdAt: 2,
                                isPrimary: true,
                                audioUri: `${AUDIO}/clip-1.m4a`,
                                sourceAudioUri: `${AUDIO}/clip-1-source.wav`,
                                durationMs: 1000,
                                waveformPeaks: [0.1, 0.2],
                                tags: ["verse"],
                                sections: [{ id: "sec", startMs: 0, endMs: 500, label: "Intro", kind: "intro" }],
                                practiceMarkers: [{ id: "pm", label: "x", atMs: 10 }],
                                editRegions: [{ id: "er", startMs: 0, endMs: 5, type: "remove" }],
                                lyricsVersionId: "lv-1",
                                recordingGrid: { bpm: 100, meterId: "6/8", grouping: [3, 3], accentPattern: [1, 0, 0, 0.78, 0, 0], countInBars: 1, clickThroughTake: true, firstDownbeatMs: 0, source: "metronome" },
                                overdub: {
                                    root: { gainDb: 0, tonePreset: "neutral" },
                                    stems: [{ id: "stem-1", title: "Harm", audioUri: `${AUDIO}/stem-1.m4a`, gainDb: -2, offsetMs: 5, tonePreset: "neutral", isMuted: false, createdAt: 4, color: "#abc" }],
                                    renderedMixUri: `${PREVIEW}/clip-1-mix.m4a`,
                                    renderedMixDurationMs: 1000,
                                    lastRenderedAt: 5,
                                },
                            },
                            { id: "clip-2", title: "Other", notes: "", createdAt: 3, isPrimary: false, parentClipId: "clip-1", audioUri: `${AUDIO}/clip-2.m4a` },
                        ],
                    },
                    { id: "idea-2", title: "Loose", notes: "", status: "clip", completionPct: 0, kind: "clip", collectionId: "col-1", createdAt: 1, lastActivityAt: 1, clips: [] },
                ],
            },
        ],
        activityEvents: [{ id: "ev", at: 1, workspaceId: "ws-1", collectionId: "col-1", ideaId: "idea-1", ideaKind: "song", ideaTitle: "Song", metric: "created", source: "recording" }],
        activeWorkspaceId: "ws-1",
        primaryWorkspaceId: "ws-1",
        primaryCollectionIdByWorkspace: { "ws-1": "col-1" },
        lastUsedWorkspaceId: "ws-1",
        workspaceStartupPreference: "last-used",
        workspaceListOrder: "last-worked",
        workspaceLastOpenedAt: { "ws-1": 7 },
        collectionLastOpenedAt: {},
        playlists: [{ id: "pl", title: "P", createdAt: 1, updatedAt: 1, items: [] }],
        songbooks: [{ id: "sb", title: "B", createdAt: 1, updatedAt: 1, items: [{ id: "i", kind: "lyricChart", workspaceId: "ws-1", ideaId: "idea-1", versionId: "lv-1", addedAt: 1 }] }],
        setlists: [],
        preferredRecordingInputId: null,
        bluetoothMonitoringCalibrations: [{ routeKey: "bt", routeLabel: "Buds", offsetMs: 120, clickOffsetMs: 40, updatedAt: 1 }],
        metronomeBpm: 112,
        metronomeMeterId: "6/8",
        metronomeGroupingByMeterId: { "6/8": [3, 3] },
        metronomeOutputs: { beep: true, visual: true, haptic: false },
        metronomeBeepLevel: 0.7,
        playbackClickLevel: 0.5,
        metronomeHapticLevel: 0.3,
        metronomeCountInBars: 1,
        metronomeSubdivision: 2,
        metronomeFeelByMeterId: { "6/8": "custom" },
        metronomeCustomPatternByMeterId: { "6/8": [1, 0, 0.44, 0.78, 0, 0] },
        metronomeClickVoice: "wood",
        playbackClickHaptic: false,
        globalCustomClipTags: [],
        backupReminderFrequency: "monthly",
        hapticsEnabled: true,
        promptForClipName: false,
        nameLanguage: "he",
        hasSeenWelcome: true,
        seenHints: ["a"],
        firstLaunchAt: 1,
        reviewPromptShownAt: null,
        lastSuccessfulBackupAt: null,
        lastSuccessfulBackupFileName: null,
        backupReminderLastPromptedAt: null,
        notes: [{ id: "n", title: "T", body: "B", createdAt: 1, updatedAt: 1, isPinned: false, textDirection: "auto" }],
        wordLadders: [{ id: "wl", title: "L", createdAt: 1, updatedAt: 1, step: "setup", roleSeed: "", placeSeed: "", columnA: [], columnB: [], pairings: [], seenHelpSteps: [], usedSparkIds: [], draft: "", revision: "" }],
        cutUpSparks: [],
        magpieSparks: [{ id: "mg", type: "magpie", title: "M", createdAt: 1, updatedAt: 1, step: "page", book: null, pageText: "", fragments: [], draft: "", language: "en", wholeLibrary: false, seenHelpSteps: [], usedFragmentIds: [] }],
        ideasFilter: "all",
        ideasSort: "newest",
        primaryFilter: "all",
        primarySort: "newest",
    };
}

/** Rewrite every managed path in `value` to the restore's token-scoped folder. */
function rewriteRestoredPaths<T>(value: T, token: string): T {
    return JSON.parse(
        JSON.stringify(value).replace(
            /songnook\/(audio|preview-audio|workspace-archives)\//g,
            (_match, dir: string) => `songnook/${dir}/restored-${token}/`
        )
    ) as T;
}

beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockDirectories.add("file:///doc/");
    mockDirectories.add("file:///doc/songnook");
    for (const [uri, text] of Object.entries(FILES)) mockFiles.set(uri, mockUtf8(text));
    mockPersistRawSnapshot.mockReset();
    mockPersistRawSnapshot.mockResolvedValue();
    mockWriteSatelliteSnapshot.mockClear();
});

describe("exact backup → restore round trip", () => {
    it("commits a snapshot deep-equal to the original library and restores every file byte-for-byte", async () => {
        const state = libraryState();

        const built = await buildDisasterRecoveryBackup(state as never, { satellites: SATELLITES as never });
        expect(built.manifest.status).toBe("complete");
        expect(built.manifest.missing).toEqual([]);
        // Every clip file, the pre-edit source, the overdub stem, the rendered mix, and the
        // two waveform sidecars — nothing referenced is left behind.
        expect(built.manifest.files.map((file) => file.path).sort()).toEqual(
            Object.keys(FILES).map((uri) => uri.replace("file:///doc/", "")).sort()
        );

        const result = await restoreFromDisasterRecoveryBackup(built.archiveUri);
        expect(result.status).toBe("complete");

        const persisted = JSON.parse(mockPersistRawSnapshot.mock.calls[0][1]);
        expect(persisted.version).toBe(12);
        const restoredClipUri: string = persisted.state.workspaces[0].ideas[0].clips[0].audioUri;
        const token = restoredClipUri.match(/restored-([^/]+)\//)![1];

        const expected = rewriteRestoredPaths(
            { ...state, workspaces: toRelativeWorkspacesManagedMedia(state.workspaces as never) },
            token
        );
        expect(persisted.state).toEqual(expected);
        expect(persisted.state.satellites).toBeUndefined();

        for (const [uri, text] of Object.entries(FILES)) {
            const restoredUri = uri.replace(/songnook\/(audio|preview-audio)\//, `songnook/$1/restored-${token}/`);
            expect(mockFiles.get(restoredUri)).toEqual(mockUtf8(text));
        }
        // The sidecar sits next to its restored audio, where waveformSidecarUri() will look.
        expect(mockFiles.has(`file:///doc/${restoredClipUri}.waveform`)).toBe(true);

        expect(mockWriteSatelliteSnapshot).toHaveBeenCalledWith(SATELLITES, "replace");
    });

    it("stays complete when sidecars are absent, and never lists them as missing", async () => {
        const state = libraryState();
        mockFiles.delete(`${AUDIO}/clip-1.m4a.waveform`);
        mockFiles.delete(`${AUDIO}/stem-1.m4a.waveform`);

        const built = await buildDisasterRecoveryBackup(state as never);
        expect(built.manifest.status).toBe("complete");
        expect(built.manifest.missing).toEqual([]);
        expect(built.manifest.files.some((file) => file.path.endsWith(".waveform"))).toBe(false);
    });
});
