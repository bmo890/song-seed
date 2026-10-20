import type { SongIdea, Workspace } from "../../types";

/**
 * Round-trips a PLACE share — a collection (with a nested collection) and a whole
 * workspace — through the real exporter, zip, reader and importer, exactly as a
 * SongNook Send link or a shared .songnook file would. Nested collections keep
 * their parents, every creative field survives, compilations inside the scope
 * travel and the manifest declares what the archive is. Mock harness mirrors
 * libraryArchiveRoundTrip.test.ts (jest.mock factories must live in each file).
 */

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(["file:///doc/", "file:///doc/songnook"]);

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
    // Ample free space so the export's ensureBackupDiskSpace pre-check passes.
    getFreeDiskStorageAsync: jest.fn(async () => 8 * 1024 * 1024 * 1024),
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

jest.mock("../audioStorage", () => ({
    MANAGED_WAVEFORM_PEAK_COUNT: 256,
    buildTimestampSlug: () => "20260101-0000",
    sanitizeArchiveSegment: (segment: string) => segment.replace(/[^a-zA-Z0-9 _.-]/g, "_"),
    getArchiveFileExtension: (uri: string) => uri.split(".").pop() || "m4a",
    ensureShareDirectory: async () => {},
}));

// Real zip build/read so the round-trip exercises actual serialization; the other helpers are
// deterministic stand-ins. Factory is self-contained (jest hoists it above imports).
jest.mock("../zipArchive", () => ({
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

jest.mock("../../../modules/songnook-file-io", () => ({
    isSongNookFileIOAvailable: () => false,
    isNativeZipAvailable: () => false,
    copyLocalFileToContentUri: jest.fn(),
    deleteContentUri: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

import { prepareLibraryExportArchive } from "../libraryExport";
import { materializeSongNookArchiveMerge, readSongNookArchive } from "../libraryImport";
import { buildCollectionExportArgs, buildWorkspaceExportArgs } from "../placeShare";
import { normalizeWorkspaces } from "../../state/dataSlice";
import { resolveImportedEntityRoute } from "../../domain/receiveRouting";
import type { Collection, Playlist, Setlist, Songbook } from "../../types";

const AUDIO = {
    s1: "file:///doc/songnook/audio/s1.m4a",
    d1: "file:///doc/songnook/audio/d1.m4a",
    l1: "file:///doc/songnook/audio/l1.m4a",
};

function song(id: keyof typeof AUDIO, collectionId: string): SongIdea {
    return {
        id,
        title: `Song ${id}`,
        notes: `notes for ${id}`,
        status: "stem",
        completionPct: 30,
        kind: "project",
        collectionId,
        clips: [
            {
                id: `clip-${id}`,
                title: "Take 1",
                notes: "",
                createdAt: 100,
                isPrimary: true,
                audioUri: AUDIO[id],
                durationMs: 4000,
                waveformPeaks: [0.2, 0.4],
                practiceMarkers: [{ id: `mk-${id}`, label: "Bridge", atMs: 2000, note: "lift" }],
                sections: [{ id: `sec-${id}`, startMs: 0, endMs: 1000, label: "Verse", kind: "verse" }],
                tags: ["keeper"],
            },
        ],
        lyrics: {
            versions: [
                {
                    id: `lv-${id}`,
                    createdAt: 1,
                    updatedAt: 1,
                    document: {
                        lines: [
                            {
                                id: `line-${id}`,
                                text: "hold the line",
                                chords: [{ id: `ch-${id}`, root: "A", accidental: "natural", quality: "m", atChar: 0 }],
                            },
                        ],
                    },
                },
            ],
        },
        chordSheet: { sections: [{ id: `cs-${id}`, name: "Verse", measures: [{ id: `m-${id}`, chords: ["Am", "F"] }] }] },
        createdAt: 100,
        lastActivityAt: 200,
    } as unknown as SongIdea;
}

const collection = (id: string, title: string, parentCollectionId: string | null = null): Collection => ({
    id,
    title,
    workspaceId: "ws",
    parentCollectionId,
    createdAt: 1,
    updatedAt: 1,
    ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
});

const setlistOf = (id: string, ideaIds: string[]): Setlist => ({
    id,
    title: id,
    createdAt: 1,
    updatedAt: 1,
    entries: ideaIds.map((ideaId, i) => ({
        id: `${id}-${i}`,
        workspaceId: "ws",
        ideaId,
        clipIds: [`clip-${ideaId}`],
        lyricVersionIds: [`lv-${ideaId}`],
        includeChordSheet: true,
        addedAt: 1,
    })),
});

/** Songs ⟶ Songs/Demos (nested), plus a sibling Loose collection. */
function buildBand(): { workspace: Workspace; library: { setlists: Setlist[]; songbooks: Songbook[]; playlists: Playlist[] } } {
    const workspace: Workspace = {
        id: "ws",
        title: "Band",
        description: "the band's room",
        color: "#824f3f",
        avatarKey: 3,
        collections: [collection("songs", "Songs"), collection("demos", "Demos", "songs"), collection("loose", "Loose")],
        ideas: [song("s1", "songs"), song("d1", "demos"), song("l1", "loose")],
    };
    const library = {
        setlists: [setlistOf("Songs set", ["s1", "d1"]), setlistOf("Whole band", ["s1", "l1"])],
        songbooks: [],
        playlists: [],
    };
    return { workspace, library };
}

beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockDirectories.add("file:///doc/");
    mockDirectories.add("file:///doc/songnook");
    for (const [id, uri] of Object.entries(AUDIO)) mockFiles.set(uri, utf8(`${id}-audio-bytes`));
});

async function roundTrip(args: NonNullable<ReturnType<typeof buildCollectionExportArgs>>) {
    const prepared = await prepareLibraryExportArchive(args);
    expect(prepared.archiveExtension).toBe("songnook");
    const parsed = await readSongNookArchive(prepared.archiveUri, `${prepared.archiveTitle}.songnook`);
    // The receiver has its own, unrelated library; nothing collides.
    const merge = await materializeSongNookArchiveMerge(parsed, [], null);
    const [workspace] = normalizeWorkspaces(merge.importedWorkspaces);
    return { parsed, merge, workspace: workspace! };
}

describe("sharing a collection", () => {
    it("arrives as that collection with its nested collection, every field, and the setlist inside it", async () => {
        const { workspace: band, library } = buildBand();
        const args = buildCollectionExportArgs(band.collections[0]!, band, library, {
            transferId: "t_collection",
            senderName: "Ben",
        })!;
        const { parsed, merge, workspace } = await roundTrip(args);

        // The manifest declares what this is — the receiver trusts it over inference.
        expect(parsed.manifest.share).toMatchObject({ kind: "collection", title: "Songs", transferId: "t_collection" });
        expect(parsed.manifest.share?.sender.name).toBe("Ben");
        expect(parsed.manifest.fidelity).toBe("full");

        // Songs + Demos (nested under Songs), never Loose.
        expect(workspace.collections.map((c) => c.title).sort()).toEqual(["Demos", "Songs"]);
        const songs = workspace.collections.find((c) => c.title === "Songs")!;
        const demos = workspace.collections.find((c) => c.title === "Demos")!;
        expect(songs.parentCollectionId ?? null).toBeNull();
        expect(demos.parentCollectionId).toBe(songs.id);
        expect(workspace.ideas.map((i) => i.title).sort()).toEqual(["Song d1", "Song s1"]);
        const d1 = workspace.ideas.find((i) => i.title === "Song d1")!;
        expect(d1.collectionId).toBe(demos.id);

        // Marks, sections, tags, lyrics with chords, chord sheet and notes all travelled.
        const s1 = workspace.ideas.find((i) => i.title === "Song s1")!;
        expect(s1.notes).toBe("notes for s1");
        expect(s1.clips[0]?.practiceMarkers?.[0]?.label).toBe("Bridge");
        expect(s1.clips[0]?.sections?.[0]?.label).toBe("Verse");
        expect(s1.clips[0]?.tags).toEqual(["keeper"]);
        expect(s1.lyrics?.versions[0]?.document.lines[0]?.chords?.[0]?.root).toBe("A");
        expect(s1.chordSheet?.sections[0]?.measures[0]?.chords).toEqual(["Am", "F"]);
        expect(mockFiles.has(s1.clips[0]!.audioUri ?? "")).toBe(true);

        // The setlist entirely inside Songs arrives, remapped; the one reaching
        // into Loose never left.
        expect(merge.importedSetlists.map((s) => s.title)).toEqual(["Songs set"]);
        const set = merge.importedSetlists[0]!;
        expect(set.entries.map((e) => e.ideaId).sort()).toEqual([d1.id, s1.id].sort());
        expect(set.entries.every((e) => e.workspaceId === workspace.id)).toBe(true);
        expect(set.entries.find((e) => e.ideaId === s1.id)?.clipIds).toEqual([s1.clips[0]!.id]);

        // A collection lands as a package, never as a Library jump.
        expect(
            resolveImportedEntityRoute({
                shareKind: parsed.manifest.share?.kind,
                importedSongbookIds: [],
                importedSetlistIds: merge.importedSetlists.map((s) => s.id),
            })
        ).toBeNull();
    });
});

describe("sharing a workspace", () => {
    it("arrives whole — every collection, both setlists, identity intact", async () => {
        const { workspace: band, library } = buildBand();
        const args = buildWorkspaceExportArgs(band, library, { transferId: "t_workspace" })!;
        const { parsed, merge, workspace } = await roundTrip(args);

        expect(parsed.manifest.share).toMatchObject({ kind: "workspace", title: "Band", transferId: "t_workspace" });
        expect(workspace.title).toBe("Band");
        expect(workspace.description).toBe("the band's room");
        expect(workspace.color).toBe("#824f3f");
        expect(workspace.collections.map((c) => c.title).sort()).toEqual(["Demos", "Loose", "Songs"]);
        const songs = workspace.collections.find((c) => c.title === "Songs")!;
        expect(workspace.collections.find((c) => c.title === "Demos")?.parentCollectionId).toBe(songs.id);
        expect(workspace.ideas).toHaveLength(3);
        expect(merge.importedSetlists.map((s) => s.title).sort()).toEqual(["Songs set", "Whole band"]);
        // Ids were remapped: the receiver's copy never collides with the sender's.
        expect(workspace.id).not.toBe("ws");
        expect(workspace.ideas.some((i) => i.id === "s1")).toBe(false);
    });
});
