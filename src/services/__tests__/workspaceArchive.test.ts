import type { ClipVersion, SongIdea, Workspace } from "../../types";

/**
 * Workspace archive round-trip with an in-memory filesystem: archive → strip →
 * restore. v2 must pack EVERY file-backed clip URI (master, source, overdub layer
 * recordings, rendered mix) and strip them all from the archived stub; v1 packages
 * (masters only, overdub never packed or stripped) must keep restoring unchanged.
 */

jest.mock("@react-native-async-storage/async-storage", () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(["file:///doc/", "file:///doc/songseed"]);

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
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
    }),
}));

// Modern expo-file-system File API used by the streaming archive reader.
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

// Real zip serialization via fflate so verify/restore exercise actual packages.
jest.mock("../audioStorage", () => ({
    sanitizeArchiveSegment: (segment: string) => segment.replace(/[^a-zA-Z0-9 _.-]/g, "_"),
    getArchiveFileExtension: (uri: string) => uri.split(".").pop() || "m4a",
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
        // restore reader only accepts stored entries.
        mockFiles.set(archiveUri, zip(zipInput, { level: 0 }));
    },
}));

import { strToU8, unzipSync, zipSync } from "fflate";
import { archiveWorkspaceToDevice, restoreWorkspaceFromDevice } from "../workspaceArchive";

const AUDIO_DIR = "file:///doc/songseed/audio";
const MASTER_URI = `${AUDIO_DIR}/master.m4a`;
const SOURCE_URI = `${AUDIO_DIR}/master-source.m4a`;
const STEM_A_URI = `${AUDIO_DIR}/stem-a.m4a`;
const STEM_B_URI = `${AUDIO_DIR}/stem-b.m4a`;
const MIX_URI = `${AUDIO_DIR}/rendered-mix.m4a`;
const ALL_MEDIA_URIS = [MASTER_URI, SOURCE_URI, STEM_A_URI, STEM_B_URI, MIX_URI];

/** Each file gets distinct bytes so restore verification proves content
 *  round-tripped, not just existence. */
function seedAudioFile(uri: string, fill: number, sizeBytes = 16 * 1024) {
    const bytes = new Uint8Array(sizeBytes).fill(fill);
    mockFiles.set(uri, bytes);
    return bytes;
}

function buildClip(): ClipVersion {
    return {
        id: "clip-1",
        title: "Take 1",
        notes: "",
        createdAt: 1,
        isPrimary: true,
        audioUri: MASTER_URI,
        sourceAudioUri: SOURCE_URI,
        durationMs: 12_000,
        waveformPeaks: [0.1, 0.5, 0.9],
        overdub: {
            root: { gainDb: 0, tonePreset: "neutral" },
            stems: [
                {
                    id: "stem-a",
                    title: "Harmony",
                    audioUri: STEM_A_URI,
                    gainDb: -2,
                    offsetMs: 40,
                    tonePreset: "warm",
                    isMuted: false,
                    waveformPeaks: [0.2, 0.4],
                    createdAt: 2,
                    color: "#7A9E8E",
                },
                {
                    id: "stem-b",
                    title: "Bass",
                    audioUri: STEM_B_URI,
                    gainDb: 1,
                    offsetMs: 0,
                    tonePreset: "low-cut",
                    isMuted: true,
                    waveformPeaks: [0.6],
                    createdAt: 3,
                    color: "#7B8FAD",
                },
            ],
            renderedMixUri: MIX_URI,
            renderedMixDurationMs: 12_000,
            renderedMixWaveformPeaks: [0.3, 0.7],
            lastRenderedAt: 4,
        },
    };
}

function buildWorkspace(): Workspace {
    const idea: SongIdea = {
        id: "idea-1",
        title: "Layered Song",
        notes: "",
        status: "song",
        completionPct: 0,
        kind: "project",
        collectionId: "col-1",
        clips: [buildClip()],
        createdAt: 1,
        lastActivityAt: 1,
    } as SongIdea;

    return {
        id: "ws-1",
        title: "Archive Me",
        collections: [
            {
                id: "col-1",
                title: "Songs",
                workspaceId: "ws-1",
                parentCollectionId: null,
                createdAt: 1,
                updatedAt: 1,
                ideasListState: { hiddenIdeaIds: [], hiddenDays: [] },
            },
        ],
        ideas: [idea],
    } as unknown as Workspace;
}

beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockDirectories.add("file:///doc/");
    mockDirectories.add("file:///doc/songseed");
    ALL_MEDIA_URIS.forEach((uri, index) => seedAudioFile(uri, index + 1));
});

describe("archiveWorkspaceToDevice (v2)", () => {
    it("packs master, source, overdub stems, and rendered mix into the package", async () => {
        const result = await archiveWorkspaceToDevice(buildWorkspace());

        expect(result.originalAudioUris.sort()).toEqual([...ALL_MEDIA_URIS].sort());
        expect(result.archiveState.audioFileCount).toBe(5);
        expect(result.warnings).toEqual([]);

        const zipEntries = unzipSync(mockFiles.get(result.archiveState.archiveUri)!);
        const manifest = JSON.parse(Buffer.from(zipEntries["manifest.json"]).toString("utf8"));
        expect(manifest.schemaVersion).toBe(2);
        expect(manifest.audioFiles).toHaveLength(5);
        expect(manifest.audioFiles.map((file: { liveUri: string }) => file.liveUri).sort()).toEqual(
            [...ALL_MEDIA_URIS].sort()
        );

        // The snapshot inside the zip keeps the full un-stripped overdub state.
        const snapshot = JSON.parse(Buffer.from(zipEntries["workspace.json"]).toString("utf8")) as Workspace;
        const snapshotClip = snapshot.ideas[0].clips[0];
        expect(snapshotClip.audioUri).toBe(MASTER_URI);
        expect(snapshotClip.overdub?.renderedMixUri).toBe(MIX_URI);
        expect(snapshotClip.overdub?.stems.map((stem) => stem.audioUri)).toEqual([STEM_A_URI, STEM_B_URI]);
    });

    it("strips every file-backed URI and derived peaks from the archived stub, keeping overdub metadata", async () => {
        const result = await archiveWorkspaceToDevice(buildWorkspace());
        const strippedClip = result.archivedWorkspace.ideas[0].clips[0];

        expect(strippedClip.audioUri).toBeUndefined();
        expect(strippedClip.sourceAudioUri).toBeUndefined();
        expect(strippedClip.waveformPeaks).toBeUndefined();
        expect(strippedClip.overdub?.renderedMixUri).toBeUndefined();
        expect(strippedClip.overdub?.renderedMixWaveformPeaks).toBeUndefined();
        strippedClip.overdub?.stems.forEach((stem) => {
            expect(stem.audioUri).toBeUndefined();
            expect(stem.waveformPeaks).toBeUndefined();
        });

        // Non-file overdub metadata survives in the stub.
        expect(strippedClip.overdub?.stems.map((stem) => stem.title)).toEqual(["Harmony", "Bass"]);
        expect(strippedClip.overdub?.stems[0].gainDb).toBe(-2);
        expect(strippedClip.overdub?.stems[0].color).toBe("#7A9E8E");
        expect(strippedClip.overdub?.root?.tonePreset).toBe("neutral");
        expect(result.archivedWorkspace.isArchived).toBe(true);
    });

    it("archives despite the stored package being at least as large as the audio (no disk-savings gate)", async () => {
        const result = await archiveWorkspaceToDevice(buildWorkspace());

        // Stored package ≥ raw audio — the old "must reduce storage" gate made archiving
        // impossible in production. savingsBytes now reports the live-library metadata trim.
        expect(result.archiveState.packageSizeBytes).toBeGreaterThanOrEqual(
            result.archiveState.originalAudioBytes
        );
        expect(result.archiveState.savingsBytes).toBeGreaterThanOrEqual(0);
        expect(result.archiveState.savingsBytes).toBe(
            result.archiveState.originalMetadataBytes - result.archiveState.archivedMetadataBytes
        );
    });

    it("round-trips: restore rewrites all five files byte-for-byte and revives overdub URIs", async () => {
        const originalBytes = new Map(ALL_MEDIA_URIS.map((uri) => [uri, mockFiles.get(uri)!]));
        const result = await archiveWorkspaceToDevice(buildWorkspace());

        // Simulate the post-archive cleanup that trashes the live originals.
        ALL_MEDIA_URIS.forEach((uri) => mockFiles.delete(uri));

        const restore = await restoreWorkspaceFromDevice(result.archivedWorkspace);
        expect(restore.restoredAudioUris.sort()).toEqual([...ALL_MEDIA_URIS].sort());
        for (const uri of ALL_MEDIA_URIS) {
            expect(Buffer.from(mockFiles.get(uri)!)).toEqual(Buffer.from(originalBytes.get(uri)!));
        }

        const restoredClip = restore.restoredWorkspace.ideas[0].clips[0];
        expect(restore.restoredWorkspace.isArchived).toBe(false);
        expect(restore.restoredWorkspace.archiveState).toBeUndefined();
        expect(restoredClip.audioUri).toBe(MASTER_URI);
        expect(restoredClip.sourceAudioUri).toBe(SOURCE_URI);
        expect(restoredClip.overdub?.renderedMixUri).toBe(MIX_URI);
        expect(restoredClip.overdub?.stems.map((stem) => stem.audioUri)).toEqual([STEM_A_URI, STEM_B_URI]);
    });
});

describe("offloaded package restore (user-picked file)", () => {
    it("restores from a picked package copy at a different uri", async () => {
        const originalBytes = new Map(ALL_MEDIA_URIS.map((uri) => [uri, mockFiles.get(uri)!]));
        const result = await archiveWorkspaceToDevice(buildWorkspace());

        // Simulate offload: the package now lives only at a picked/cache location.
        const pickedUri = "file:///cache/picked-package.zip";
        mockFiles.set(pickedUri, mockFiles.get(result.archiveState.archiveUri)!);
        mockFiles.delete(result.archiveState.archiveUri);
        ALL_MEDIA_URIS.forEach((uri) => mockFiles.delete(uri));
        const offloadedWorkspace = {
            ...result.archivedWorkspace,
            archiveState: {
                ...result.archiveState,
                offloadedAt: 123,
                offloadedFileName: "picked-package.zip",
            },
        };

        const restore = await restoreWorkspaceFromDevice(offloadedWorkspace, pickedUri);

        expect(restore.restoredWorkspace.isArchived).toBe(false);
        for (const uri of ALL_MEDIA_URIS) {
            expect(Buffer.from(mockFiles.get(uri)!)).toEqual(Buffer.from(originalBytes.get(uri)!));
        }
    });

    it("rejects a picked package belonging to a different workspace", async () => {
        const result = await archiveWorkspaceToDevice(buildWorkspace());
        const pickedUri = "file:///cache/picked-package.zip";
        mockFiles.set(pickedUri, mockFiles.get(result.archiveState.archiveUri)!);

        const otherWorkspace = {
            ...result.archivedWorkspace,
            id: "ws-other",
            archiveState: { ...result.archiveState, offloadedAt: 123 },
        };

        await expect(restoreWorkspaceFromDevice(otherWorkspace, pickedUri)).rejects.toThrow(
            "does not match this workspace"
        );
    });
});

describe("v1 package compatibility", () => {
    it("restores a v1 archive (masters only; overdub media never packed or stripped)", async () => {
        const workspace = buildWorkspace();
        const masterBytes = mockFiles.get(MASTER_URI)!;

        // Hand-build a v1 package: manifest lists only the master + source takes,
        // and the snapshot is the full workspace (v1 never stripped overdub).
        const v1Manifest = {
            schemaVersion: 1,
            workspaceId: workspace.id,
            workspaceTitle: workspace.title,
            archivedAt: new Date(1000).toISOString(),
            audioFiles: [
                { archivePath: "audio/0001-master.m4a", liveUri: MASTER_URI, originalSizeBytes: masterBytes.length },
                {
                    archivePath: "audio/0002-master-source.m4a",
                    liveUri: SOURCE_URI,
                    originalSizeBytes: mockFiles.get(SOURCE_URI)!.length,
                },
            ],
            missingFileUris: [],
        };
        const archiveUri = "file:///doc/songseed/workspace-archives/Archive Me-ws-1.songstead-workspace.zip";
        mockFiles.set(
            archiveUri,
            // Stored, matching the real writer — the streaming reader rejects compression.
            zipSync(
                {
                    "manifest.json": strToU8(JSON.stringify(v1Manifest)),
                    "workspace.json": strToU8(JSON.stringify(workspace)),
                    "audio/0001-master.m4a": masterBytes,
                    "audio/0002-master-source.m4a": mockFiles.get(SOURCE_URI)!,
                },
                { level: 0 }
            )
        );

        // v1 stubs stripped only the master/source URIs; overdub stayed referenced
        // and its files stayed live on disk.
        const v1ArchivedWorkspace: Workspace = {
            ...workspace,
            isArchived: true,
            archiveState: {
                schemaVersion: 1,
                archivedAt: 1000,
                archiveUri,
                packageSizeBytes: mockFiles.get(archiveUri)!.length,
                originalAudioBytes: masterBytes.length,
                originalMetadataBytes: 1,
                archivedMetadataBytes: 1,
                savingsBytes: 1,
                audioFileCount: 2,
                missingFileCount: 0,
            },
            ideas: workspace.ideas.map((idea) => ({
                ...idea,
                clips: idea.clips.map((clip) => ({
                    ...clip,
                    audioUri: undefined,
                    sourceAudioUri: undefined,
                    waveformPeaks: undefined,
                })),
            })),
        };
        mockFiles.delete(MASTER_URI);
        mockFiles.delete(SOURCE_URI);

        const restore = await restoreWorkspaceFromDevice(v1ArchivedWorkspace);
        expect(restore.restoredAudioUris.sort()).toEqual([MASTER_URI, SOURCE_URI].sort());
        expect(mockFiles.has(MASTER_URI)).toBe(true);

        const restoredClip = restore.restoredWorkspace.ideas[0].clips[0];
        expect(restoredClip.audioUri).toBe(MASTER_URI);
        // Overdub files were never touched by v1 archiving — still referenced, still on disk.
        expect(restoredClip.overdub?.stems.map((stem) => stem.audioUri)).toEqual([STEM_A_URI, STEM_B_URI]);
        expect(mockFiles.has(STEM_A_URI)).toBe(true);
        expect(mockFiles.has(STEM_B_URI)).toBe(true);
    });
});
