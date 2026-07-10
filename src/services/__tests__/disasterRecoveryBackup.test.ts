import { createHash } from "crypto";

const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(["file:///doc/", "file:///doc/songseed"]);
const mockCreateZipArchive = jest.fn<Promise<void>, [string, unknown[], unknown?]>(async () => {});
const mockGetFreeDiskStorageAsync = jest.fn(async () => 10 * 1024 * 1024 * 1024);

const mockSnapshot = {
    workspaces: [
        {
            id: "ws-1",
            title: "Workspace",
            collections: [],
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
                            audioUri: "file:///doc/songseed/audio/clip-1.m4a",
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

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    getFreeDiskStorageAsync: () => mockGetFreeDiskStorageAsync(),
    getInfoAsync: jest.fn(async (uri: string) => {
        const file = mockFiles.get(uri);
        if (file) return { exists: true, size: file.length, modificationTime: Date.now() / 1000 };
        return { exists: mockDirectories.has(uri), isDirectory: mockDirectories.has(uri) };
    }),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
        mockDirectories.add(uri);
    }),
    readDirectoryAsync: jest.fn(async () => []),
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
    }),
    EncodingType: { Base64: "base64", UTF8: "utf8" },
    readAsStringAsync: jest.fn(async (uri: string, options?: { encoding?: string }) => {
        const file = mockFiles.get(uri);
        if (!file) throw new Error(`Missing mock file: ${uri}`);
        // Memory-safety invariant: whole-file string reads are only allowed for files
        // under the native-hash cap; larger files must use the streaming hash path.
        const { NATIVE_BASE64_SHA256_MAX_BYTES } = require("../fileHashing");
        if (file.length > NATIVE_BASE64_SHA256_MAX_BYTES) {
            throw new Error("Backup hashing must not read an oversized file as a string.");
        }
        if (options?.encoding !== "base64") {
            throw new Error("Backup hashing must read files as base64.");
        }
        return Buffer.from(file).toString("base64");
    }),
}));

jest.mock("expo-file-system", () => {
    class MockFile {
        uri: string;

        constructor(uri: string) {
            this.uri = uri;
        }

        get size() {
            return mockFiles.get(this.uri)?.length ?? 0;
        }

        open() {
            const uri = this.uri;
            let offset = 0;
            return {
                readBytes: (length: number) => {
                    const source = mockFiles.get(uri);
                    if (!source) throw new Error(`Missing mock file: ${uri}`);
                    const chunk = source.slice(offset, offset + length);
                    offset += chunk.length;
                    return chunk;
                },
                close: () => {},
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

jest.mock("../audioStorage", () => ({
    buildTimestampSlug: () => "20260623-1200",
    createZipArchive: (...args: [string, unknown[], unknown?]) => mockCreateZipArchive(...args),
}));

jest.mock("../../state/useStore", () => ({
    STORE_VERSION: 11,
    buildPersistedAppStoreSnapshot: () => mockSnapshot,
}));

import {
    buildDisasterRecoveryBackup,
    assertZip32ArchiveSize,
    estimateStoredZipArchiveBytes,
} from "../disasterRecoveryBackup";

const AUDIO_URI = "file:///doc/songseed/audio/clip-1.m4a";

beforeEach(() => {
    mockFiles.clear();
    mockCreateZipArchive.mockClear();
    mockGetFreeDiskStorageAsync.mockReset();
    mockGetFreeDiskStorageAsync.mockResolvedValue(10 * 1024 * 1024 * 1024);
});

describe("buildDisasterRecoveryBackup", () => {
    it("counts headers and metadata when enforcing the ZIP32 archive limit", () => {
        const archiveBytes = estimateStoredZipArchiveBytes([
            {
                archiveName: "media/songseed/audio/almost-four-gigabytes.m4a",
                fileUri: AUDIO_URI,
                sizeBytes: 0xffffffff - 32,
                crc32: 0,
            },
            { archiveName: "snapshot.json", data: "{}" },
            { archiveName: "manifest.json", data: "{}" },
        ]);

        expect(archiveBytes).toBeGreaterThan(0xffffffff);
        expect(() =>
            assertZip32ArchiveSize([
                {
                    archiveName: "media/songseed/audio/almost-four-gigabytes.m4a",
                    fileUri: AUDIO_URI,
                    sizeBytes: 0xffffffff - 32,
                    crc32: 0,
                },
                { archiveName: "snapshot.json", data: "{}" },
                { archiveName: "manifest.json", data: "{}" },
            ])
        ).toThrow("4 GB ZIP32 backup limit");
    });

    it("hashes exact audio incrementally and passes precomputed integrity to the ZIP writer", async () => {
        const bytes = Uint8Array.from({ length: 1024 * 1024 + 7 }, (_, index) => index & 0xff);
        mockFiles.set(AUDIO_URI, bytes);

        const result = await buildDisasterRecoveryBackup({} as never);

        expect(result.manifest.status).toBe("complete");
        expect(result.manifest.files).toEqual([
            expect.objectContaining({
                path: "songseed/audio/clip-1.m4a",
                sizeBytes: bytes.length,
                sha256: createHash("sha256")
                    .update(Buffer.from(bytes).toString("base64"))
                    .digest("hex"),
            }),
        ]);
        const entries = mockCreateZipArchive.mock.calls[0][1];
        expect(entries).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    archiveName: "media/songseed/audio/clip-1.m4a",
                    fileUri: AUDIO_URI,
                    sizeBytes: bytes.length,
                    crc32: expect.any(Number),
                }),
            ])
        );
    });

    it("keeps a backup complete when an archived workspace's package is offloaded", async () => {
        const bytes = Uint8Array.from({ length: 2048 }, (_, index) => index & 0xff);
        mockFiles.set(AUDIO_URI, bytes);
        // An offloaded workspace: its package lives in the user's own storage (not on
        // device, not in this backup) — that must NOT mark the backup incomplete.
        mockSnapshot.workspaces.push({
            id: "ws-offloaded",
            title: "Offloaded",
            collections: [],
            ideas: [],
            archiveState: {
                schemaVersion: 2,
                archivedAt: 1,
                archiveUri: "file:///doc/songseed/workspace-archives/gone.songseed-workspace.zip",
                packageSizeBytes: 10,
                originalAudioBytes: 10,
                originalMetadataBytes: 1,
                archivedMetadataBytes: 1,
                savingsBytes: 0,
                audioFileCount: 1,
                missingFileCount: 0,
                offloadedAt: 123,
                offloadedFileName: "gone.songseed-workspace.zip",
            },
        } as never);

        try {
            const result = await buildDisasterRecoveryBackup({} as never);
            expect(result.manifest.status).toBe("complete");
            expect(result.manifest.missing).toEqual([]);
            expect(
                result.manifest.files.some((file) => file.path.includes("workspace-archives"))
            ).toBe(false);
        } finally {
            mockSnapshot.workspaces.pop();
        }
    });

    it("rejects low storage before creating a ZIP", async () => {
        mockFiles.set(AUDIO_URI, Uint8Array.from([1, 2, 3]));
        mockGetFreeDiskStorageAsync.mockResolvedValueOnce(1);

        await expect(buildDisasterRecoveryBackup({} as never)).rejects.toThrow(
            "Not enough free device storage"
        );
        expect(mockCreateZipArchive).not.toHaveBeenCalled();
    });

    it("can be cancelled before file hashing begins", async () => {
        mockFiles.set(AUDIO_URI, Uint8Array.from([1, 2, 3]));
        const controller = new AbortController();

        await expect(
            buildDisasterRecoveryBackup({} as never, {
                signal: controller.signal,
                onProgress: (progress) => {
                    if (progress.phase === "hashing") controller.abort();
                },
            })
        ).rejects.toThrow("cancelled");
        expect(mockCreateZipArchive).not.toHaveBeenCalled();
    });
});
