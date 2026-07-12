import type { SongIdea, Workspace } from "../../types";

/**
 * Round-trips a library through the human-readable Songstead Archive: export → zip → read →
 * import → normalize. "full" fidelity must preserve every creative field; "standard" stays
 * lossy. Exercises the real exporter, reader and importer with an in-memory filesystem.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(["file:///doc/", "file:///doc/songseed"]);

function utf8(value: string) {
    return Uint8Array.from(Buffer.from(value, "utf8"));
}

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    EncodingType: { Base64: "base64" },
    getInfoAsync: jest.fn(async (uri: string) => {
        if (mockFiles.has(uri)) return { exists: true, size: mockFiles.get(uri)!.length };
        return { exists: mockDirectories.has(uri), isDirectory: mockDirectories.has(uri) };
    }),
    readAsStringAsync: jest.fn(async (uri: string) => {
        const value = mockFiles.get(uri);
        if (!value) throw new Error(`Missing mock file: ${uri}`);
        return Buffer.from(value).toString("base64");
    }),
    writeAsStringAsync: jest.fn(async (uri: string, value: string) => {
        mockFiles.set(uri, Uint8Array.from(Buffer.from(value, "base64")));
    }),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
        mockDirectories.add(uri);
    }),
}));

// Modern expo-file-system File API used by the streaming archive reader/writer.
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
            if (mockFiles.has(this.uri) && !options?.overwrite) {
                throw new Error(`File already exists: ${this.uri}`);
            }
            mockFiles.set(this.uri, new Uint8Array(0));
        }

        open() {
            if (!mockFiles.has(this.uri)) {
                throw new Error(`Missing mock file: ${this.uri}`);
            }
            const uri = this.uri;
            let currentOffset: number | null = 0;
            return {
                readBytes: (length: number) => {
                    if (currentOffset == null) throw new Error("Handle closed");
                    const source = mockFiles.get(uri)!;
                    const chunk = source.slice(currentOffset, currentOffset + length);
                    currentOffset += chunk.length;
                    return chunk;
                },
                writeBytes: (bytes: Uint8Array) => {
                    if (currentOffset == null) throw new Error("Handle closed");
                    const previous = mockFiles.get(uri)!;
                    const nextLength = Math.max(previous.length, currentOffset + bytes.length);
                    const next = new Uint8Array(nextLength);
                    next.set(previous);
                    next.set(bytes, currentOffset);
                    currentOffset += bytes.length;
                    mockFiles.set(uri, next);
                },
                close: () => {
                    currentOffset = null;
                },
                get offset() {
                    return currentOffset;
                },
                set offset(value: number | null) {
                    currentOffset = value;
                },
                get size() {
                    return currentOffset == null ? null : mockFiles.get(uri)!.length;
                },
            };
        }
    }

    return { File: MockFile };
});

// Real zip build/read so the round-trip exercises actual serialization; the other helpers are
// deterministic stand-ins. Factory is self-contained (jest hoists it above imports).
jest.mock("../audioStorage", () => ({
    MANAGED_WAVEFORM_PEAK_COUNT: 256,
    buildTimestampSlug: () => "20260101-0000",
    sanitizeArchiveSegment: (segment: string) => segment.replace(/[^a-zA-Z0-9 _.-]/g, "_"),
    getArchiveFileExtension: (uri: string) => uri.split(".").pop() || "m4a",
    ensureShareDirectory: async () => {},
    createZipArchive: async (
        archiveUri: string,
        entries: Array<{ archiveName: string; data?: string; fileUri?: string; directory?: boolean }>
    ) => {
        const { zipSync: zip } = require("fflate");
        const zipInput: Record<string, Uint8Array> = {};
        for (const entry of entries) {
            if (entry.directory) continue;
            if (typeof entry.data === "string") {
                zipInput[entry.archiveName] = Uint8Array.from(Buffer.from(entry.data, "utf8"));
            } else if (entry.fileUri) {
                const bytes = mockFiles.get(entry.fileUri);
                if (!bytes) throw new Error(`Missing file for zip entry: ${entry.fileUri}`);
                zipInput[entry.archiveName] = bytes;
            }
        }
        // Stored (uncompressed), matching the real createZipArchive — the streaming
        // import reader only accepts stored entries.
        mockFiles.set(archiveUri, zip(zipInput, { level: 0 }));
    },
}));

jest.mock("../../../modules/songseed-file-io", () => ({
    isSongseedFileIOAvailable: () => false,
    copyLocalFileToContentUri: jest.fn(),
    deleteContentUri: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { prepareLibraryExportArchive } from "../libraryExport";
import { materializeSongSeedArchiveMerge, readSongSeedArchive } from "../libraryImport";
import { normalizeWorkspaces } from "../../state/dataSlice";

const REAL_PEAKS = [0.11, 0.22, 0.33, 0.44, 0.55];
const ROOT_CLIP_AUDIO = "file:///doc/songseed/audio/root.m4a";
const CHILD_CLIP_AUDIO = "file:///doc/songseed/audio/child.m4a";
const STANDALONE_AUDIO = "file:///doc/songseed/audio/standalone.m4a";

function buildLibrary(): { workspaces: Workspace[]; idea: SongIdea } {
    const idea: SongIdea = {
        id: "idea-1",
        title: "My Song",
        notes: "song notes",
        status: "stem",
        completionPct: 42,
        kind: "project",
        collectionId: "col-1",
        isDraft: true,
        isBookmarked: true,
        customTags: [{ key: "mood", label: "Mood", color: "#abc" }],
        clipGroups: [
            { id: "group-1", name: "Takes", collapsed: false, createdAt: 1, updatedAt: 2 },
        ],
        clipGroupAssignments: { "clip-root": "group-1" },
        clips: [
            {
                id: "clip-root",
                title: "Root take",
                notes: "",
                createdAt: 100,
                isPrimary: true,
                isTitleAutoGenerated: true,
                isBookmarked: true,
                manualSortOrder: 3,
                audioUri: ROOT_CLIP_AUDIO,
                durationMs: 12345,
                waveformPeaks: REAL_PEAKS,
                tags: ["verse", "keeper"],
                sections: [
                    { id: "sec-1", startMs: 0, endMs: 4000, label: "Intro", kind: "intro" },
                ],
                practiceMarkers: [{ id: "mk-1", label: "Solo", atMs: 8000, note: "try minor IV" }],
                editRegions: [{ id: "er-1", startMs: 1000, endMs: 2000, type: "remove" }],
                analysis: {
                    schemaVersion: 1,
                    analyzedAt: 5,
                    key: "E♭",
                    mode: "minor",
                    keyConfidence: 0.8,
                    bpm: 120,
                    bpmSteadiness: 0.9,
                    confirmed: true,
                },
                recordingGrid: {
                    bpm: 92,
                    meterId: "4/4",
                    countInBars: 1,
                    clickThroughTake: true,
                    firstDownbeatMs: null,
                    source: "metronome",
                },
            },
            {
                id: "clip-child",
                title: "Edit",
                notes: "",
                createdAt: 200,
                isPrimary: false,
                parentClipId: "clip-root",
                audioUri: CHILD_CLIP_AUDIO,
                durationMs: 11000,
                waveformPeaks: [0.9, 0.8, 0.7],
            },
        ],
        lyrics: {
            versions: [
                {
                    id: "lv-1",
                    createdAt: 1,
                    updatedAt: 1,
                    document: { lines: [{ id: "l1", text: "first verse", chords: [] }] },
                },
                {
                    id: "lv-2",
                    createdAt: 2,
                    updatedAt: 2,
                    document: { lines: [{ id: "l2", text: "second verse", chords: [] }] },
                },
            ],
        },
        createdAt: 100,
        lastActivityAt: 300,
    };

    const standalone: SongIdea = {
        id: "idea-2",
        title: "Loose clip",
        notes: "",
        status: "clip",
        completionPct: 0,
        kind: "clip",
        collectionId: "col-1",
        clips: [
            {
                id: "clip-standalone",
                title: "Loose clip",
                notes: "",
                createdAt: 400,
                isPrimary: true,
                audioUri: STANDALONE_AUDIO,
                durationMs: 5000,
                waveformPeaks: [0.5, 0.6],
                tags: ["idea"],
                sections: [{ id: "sec-2", startMs: 0, endMs: 2000, label: "Hook", kind: "chorus" }],
            },
        ],
        createdAt: 400,
        lastActivityAt: 400,
    };

    const workspaces: Workspace[] = [
        {
            id: "ws-1",
            title: "Main",
            description: "primary workspace",
            color: "#824f3f",
            avatarKey: 7,
            collections: [
                {
                    id: "col-1",
                    title: "Songs",
                    description: "collection desc",
                    workspaceId: "ws-1",
                    parentCollectionId: null,
                    createdAt: 10,
                    updatedAt: 20,
                    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
                },
            ],
            ideas: [idea, standalone],
        },
    ];

    return { workspaces, idea };
}

beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockDirectories.add("file:///doc/");
    mockDirectories.add("file:///doc/songseed");
    mockFiles.set(ROOT_CLIP_AUDIO, utf8("root-audio-bytes"));
    mockFiles.set(CHILD_CLIP_AUDIO, utf8("child-audio-bytes"));
    mockFiles.set(STANDALONE_AUDIO, utf8("standalone-audio-bytes"));
});

async function exportThenImport(preserveAllMetadata: boolean) {
    const { workspaces } = buildLibrary();
    const prepared = await prepareLibraryExportArchive({
        workspaces,
        notes: [],
        format: "songstead-archive",
        scope: { workspaceIds: ["ws-1"], collectionIds: [] },
        options: {
            includeFullSongHistory: true,
            includeNotes: true,
            includeLyrics: true,
            includeHiddenItems: true,
            preserveAllMetadata,
        },
        libraryPreferences: {
            primaryWorkspaceId: "ws-1",
            primaryCollectionIdByWorkspace: { "ws-1": "col-1" },
        },
    });
    const parsed = await readSongSeedArchive(prepared.archiveUri, "archive.zip");
    const merge = await materializeSongSeedArchiveMerge(parsed, [], null);
    const [workspace] = normalizeWorkspaces(merge.importedWorkspaces);
    return { parsed, workspace };
}

describe("pre-rename (Song Seed era) archive acceptance", () => {
    it("imports an archive whose manifest carries the legacy song-seed-archive format id", async () => {
        const { workspaces } = buildLibrary();
        const prepared = await prepareLibraryExportArchive({
            workspaces,
            notes: [],
            format: "songstead-archive",
            scope: { workspaceIds: ["ws-1"], collectionIds: [] },
            options: {
                includeFullSongHistory: true,
                includeNotes: true,
                includeLyrics: true,
                includeHiddenItems: true,
                preserveAllMetadata: true,
            },
            libraryPreferences: {
                primaryWorkspaceId: "ws-1",
                primaryCollectionIdByWorkspace: { "ws-1": "col-1" },
            },
        });

        // Rewrite the manifest to the pre-rename format id — byte-identical to what a
        // build before the Songstead rename exported. It must import forever.
        const zipBytes = mockFiles.get(prepared.archiveUri)!;
        const entries = unzipSync(zipBytes);
        const manifest = JSON.parse(strFromU8(entries["manifest.json"]));
        manifest.format = "song-seed-archive";
        entries["manifest.json"] = strToU8(JSON.stringify(manifest));
        const legacyUri = "file:///doc/legacy-era-archive.zip";
        mockFiles.set(legacyUri, zipSync(entries, { level: 0 }));

        const parsed = await readSongSeedArchive(legacyUri, "legacy-era-archive.zip");
        const merge = await materializeSongSeedArchiveMerge(parsed, [], null);
        expect(merge.importedWorkspaces).toHaveLength(1);
        expect(merge.importedWorkspaces[0]?.title).toBe(workspaces[0]?.title);
    });
});

describe("Songstead Archive round-trip — full fidelity", () => {
    it("declares full fidelity in the manifest", async () => {
        const { parsed } = await exportThenImport(true);
        expect(parsed.manifest.fidelity).toBe("full");
        expect(parsed.manifest.schemaVersion).toBe(6);
    });

    it("preserves workspace, collection and project metadata", async () => {
        const { workspace } = await exportThenImport(true);
        expect(workspace.color).toBe("#824f3f");
        expect(workspace.avatarKey).toBe(7);
        expect(workspace.collections[0].description).toBe("collection desc");

        const song = workspace.ideas.find((idea) => idea.kind === "project")!;
        expect(song.status).toBe("stem");
        expect(song.isDraft).toBe(true);
        expect(song.customTags).toEqual([{ key: "mood", label: "Mood", color: "#abc" }]);
        expect(song.lyrics?.versions).toHaveLength(2);
        expect(song.lyrics?.versions[1].document.lines[0].text).toBe("second verse");
    });

    it("preserves clip creative metadata and the real waveform", async () => {
        const { workspace } = await exportThenImport(true);
        const song = workspace.ideas.find((idea) => idea.kind === "project")!;
        const root = song.clips.find((clip) => clip.isPrimary)!;

        expect(root.waveformPeaks).toEqual(REAL_PEAKS);
        expect(root.tags).toEqual(["verse", "keeper"]);
        expect(root.sections?.[0]).toMatchObject({ label: "Intro", kind: "intro", endMs: 4000 });
        expect(root.practiceMarkers?.[0]).toMatchObject({ label: "Solo", atMs: 8000 });
        expect(root.editRegions?.[0]).toMatchObject({ type: "remove", startMs: 1000 });
        expect(root.analysis?.key).toBe("E♭");
        expect(root.isTitleAutoGenerated).toBe(true);
        expect(root.manualSortOrder).toBe(3);
        expect(root.recordingGrid).toEqual({
            bpm: 92,
            meterId: "4/4",
            countInBars: 1,
            clickThroughTake: true,
            firstDownbeatMs: null,
            source: "metronome",
        });
    });

    it("re-ids clip groups and keeps their assignments through normalization", async () => {
        const { workspace } = await exportThenImport(true);
        const song = workspace.ideas.find((idea) => idea.kind === "project")!;
        const root = song.clips.find((clip) => clip.isPrimary)!;

        expect(song.clipGroups).toHaveLength(1);
        expect(song.clipGroups?.[0].name).toBe("Takes");
        // Source ids were remapped; the assignment must point the new root clip at the new group.
        const groupId = song.clipGroups?.[0].id;
        expect(song.clipGroupAssignments?.[root.id]).toBe(groupId);
        expect(groupId).not.toBe("group-1");
    });

    it("preserves standalone clip metadata", async () => {
        const { workspace } = await exportThenImport(true);
        const standalone = workspace.ideas.find((idea) => idea.kind === "clip")!;
        const clip = standalone.clips[0];
        expect(clip.waveformPeaks).toEqual([0.5, 0.6]);
        expect(clip.tags).toEqual(["idea"]);
        expect(clip.sections?.[0]).toMatchObject({ label: "Hook", kind: "chorus" });
    });

    it("round-trips songbooks and setlists, remapping refs and dropping unresolved ones", async () => {
        const { workspaces } = buildLibrary();
        const prepared = await prepareLibraryExportArchive({
            workspaces,
            notes: [],
            songbooks: [
                {
                    id: "sb-1",
                    title: "My Book",
                    createdAt: 1,
                    updatedAt: 1,
                    items: [
                        { id: "sbi-1", kind: "lyricChart", workspaceId: "ws-1", ideaId: "idea-1", versionId: "lv-1", addedAt: 1 },
                        { id: "sbi-bad", kind: "chordChart", workspaceId: "ws-1", ideaId: "missing", addedAt: 2 },
                    ],
                },
            ],
            setlists: [
                {
                    id: "sl-1",
                    title: "Gig",
                    createdAt: 1,
                    updatedAt: 1,
                    entries: [
                        {
                            id: "se-1",
                            workspaceId: "ws-1",
                            ideaId: "idea-1",
                            clipIds: ["clip-root", "missing-clip"],
                            lyricVersionIds: ["lv-1"],
                            includeChordSheet: false,
                            addedAt: 1,
                        },
                    ],
                },
            ],
            format: "songstead-archive",
            scope: { workspaceIds: ["ws-1"], collectionIds: [] },
            options: {
                includeFullSongHistory: true,
                includeNotes: true,
                includeLyrics: true,
                includeHiddenItems: true,
                preserveAllMetadata: true,
            },
            libraryPreferences: { primaryWorkspaceId: "ws-1", primaryCollectionIdByWorkspace: { "ws-1": "col-1" } },
        });
        const parsed = await readSongSeedArchive(prepared.archiveUri, "archive.zip");
        const merge = await materializeSongSeedArchiveMerge(parsed, [], null);

        const project = merge.importedWorkspaces.flatMap((w) => w.ideas).find((i) => i.kind === "project")!;
        const rootClipId = project.clips.find((c) => c.title === "Root take")!.id;

        // Songbook: the lyric chart remaps to the new idea id; the bad ref is dropped.
        expect(merge.importedSongbooks).toHaveLength(1);
        expect(merge.importedSongbooks[0].items).toHaveLength(1);
        expect(merge.importedSongbooks[0].items[0].ideaId).toBe(project.id);
        expect(merge.importedSongbooks[0].items[0].versionId).toBe("lv-1");
        expect(merge.importedSongbooks[0].id).not.toBe("sb-1");

        // Setlist: idea + clip ids remap, missing clip dropped, version id preserved.
        expect(merge.importedSetlists).toHaveLength(1);
        const entry = merge.importedSetlists[0].entries[0];
        expect(entry.ideaId).toBe(project.id);
        expect(entry.clipIds).toEqual([rootClipId]);
        expect(entry.lyricVersionIds).toEqual(["lv-1"]);
    });
});

describe("Songstead Archive round-trip — standard (lossy)", () => {
    it("drops creative metadata and regenerates the waveform", async () => {
        const { parsed, workspace } = await exportThenImport(false);
        expect(parsed.manifest.fidelity).toBe("standard");

        const song = workspace.ideas.find((idea) => idea.kind === "project")!;
        const root = song.clips.find((clip) => clip.isPrimary)!;

        expect(root.sections).toBeUndefined();
        expect(root.practiceMarkers).toBeUndefined();
        expect(root.tags).toBeUndefined();
        expect(root.analysis).toBeUndefined();
        expect(root.editRegions).toBeUndefined();
        // The recording grid is written in ALL fidelities — it's what lets a recipient
        // overdub in time with the shared take.
        expect(root.recordingGrid).toEqual({
            bpm: 92,
            meterId: "4/4",
            countInBars: 1,
            clickThroughTake: true,
            firstDownbeatMs: null,
            source: "metronome",
        });
        // Real peaks are not carried; a deterministic 256-point placeholder is regenerated.
        expect(root.waveformPeaks).toHaveLength(256);
        expect(root.waveformPeaks).not.toEqual(REAL_PEAKS);

        expect(song.clipGroups).toBeUndefined();
        expect(song.customTags).toBeUndefined();
        expect(song.status).toBe("song");
        // The latest lyric text still round-trips as a single rebuilt version.
        expect(song.lyrics?.versions.length).toBeGreaterThanOrEqual(1);
    });
});
