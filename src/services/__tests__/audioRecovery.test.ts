/**
 * Archive-based recovery must stream packages (never whole-zip in memory) and
 * restore audio byte-for-byte to the original managed URIs.
 */

const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(["file:///doc/", "file:///doc/songseed"]);

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    EncodingType: { Base64: "base64" },
    getInfoAsync: jest.fn(async (uri: string) => {
        if (mockFiles.has(uri)) return { exists: true, size: mockFiles.get(uri)!.length };
        return { exists: mockDirectories.has(uri), isDirectory: mockDirectories.has(uri) };
    }),
    readDirectoryAsync: jest.fn(async (uri: string) => {
        const prefix = uri.endsWith("/") ? uri : `${uri}/`;
        return Array.from(mockFiles.keys())
            .filter((path) => path.startsWith(prefix))
            .map((path) => path.slice(prefix.length))
            .filter((path) => path.length > 0 && !path.includes("/"));
    }),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
        mockDirectories.add(uri);
    }),
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

jest.mock("../manifestSync", () => ({ readManifest: jest.fn(async () => null) }));
jest.mock("../audioStorage", () => ({ loadAudioDurationMs: jest.fn(async () => 1000) }));
jest.mock("../../state/dataSlice", () => ({
    normalizeWorkspaces: (workspaces: unknown[]) => workspaces,
}));
jest.mock("../../state/useStore", () => ({
    sanitizePersistedState: (state: unknown) => state,
}));

import { strToU8, zipSync } from "fflate";
import { findWorkspaceArchives, restoreWorkspaceFromArchive } from "../audioRecovery";

const ARCHIVE_DIR = "file:///doc/songseed/workspace-archives";
const MASTER_URI = "file:///doc/songseed/audio/master.m4a";

function installArchive(options?: { compressed?: boolean }) {
    const masterBytes = Uint8Array.from({ length: 48 * 1024 + 3 }, (_, index) => (index * 37) & 0xff);
    const manifest = {
        schemaVersion: 2,
        workspaceId: "ws-1",
        workspaceTitle: "Recovered WS",
        archivedAt: "2026-07-01T10:00:00.000Z",
        audioFiles: [
            {
                archivePath: "audio/0001-master.m4a",
                liveUri: MASTER_URI,
                originalSizeBytes: masterBytes.length,
            },
        ],
        missingFileUris: [],
    };
    const workspace = {
        id: "ws-1",
        title: "Recovered WS",
        collections: [],
        ideas: [
            {
                id: "idea-1",
                title: "Song",
                clips: [{ id: "clip-1", title: "Take", audioUri: MASTER_URI }],
            },
        ],
        isArchived: true,
    };
    const archiveUri = `${ARCHIVE_DIR}/Recovered WS-ws-1.songstead-workspace.zip`;
    mockFiles.set(
        archiveUri,
        zipSync(
            {
                "manifest.json": strToU8(JSON.stringify(manifest)),
                "workspace.json": strToU8(JSON.stringify(workspace)),
                "audio/0001-master.m4a": masterBytes,
            },
            { level: options?.compressed ? 6 : 0 }
        )
    );
    return { archiveUri, masterBytes };
}

beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockDirectories.add("file:///doc/");
    mockDirectories.add("file:///doc/songseed");
    mockDirectories.add(ARCHIVE_DIR);
});

describe("archive-based audio recovery", () => {
    it("lists archives by reading only their manifests", async () => {
        installArchive();

        const archives = await findWorkspaceArchives();
        expect(archives).toEqual([
            expect.objectContaining({ workspaceId: "ws-1", workspaceTitle: "Recovered WS" }),
        ]);
    });

    it("streams a workspace archive back to its original managed URIs", async () => {
        const { archiveUri, masterBytes } = installArchive();

        const result = await restoreWorkspaceFromArchive(archiveUri);

        expect(result.restoredAudioCount).toBe(1);
        expect(result.warnings).toEqual([]);
        expect(result.workspace.isArchived).toBe(false);
        expect(Buffer.from(mockFiles.get(MASTER_URI)!)).toEqual(Buffer.from(masterBytes));
    });

    it("skips a corrupt/unsupported package without crashing recovery", async () => {
        installArchive({ compressed: true });

        // The streaming reader rejects compressed entries; the scanner must skip, not throw.
        await expect(findWorkspaceArchives()).resolves.toEqual([]);
    });
});
