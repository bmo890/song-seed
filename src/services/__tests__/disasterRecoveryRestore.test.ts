import { createHash } from "crypto";
import { strToU8, zipSync } from "fflate";

const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(["file:///doc/"]);
const mockPersistRawSnapshot = jest.fn<Promise<void>, [string, string]>();
const mockSetPersistBlocked = jest.fn();
const mockRequireRestoreRestart = jest.fn();
const mockGetFreeDiskStorageAsync = jest.fn(async () => 10 * 1024 * 1024 * 1024);
let mockFailRestoreDeletes = false;
let mockFailTrashMoves = false;

function mockTextBytes(value: string) {
    return Uint8Array.from(Buffer.from(value, "utf8"));
}

function mockBytesText(value: Uint8Array) {
    return Buffer.from(value).toString("utf8");
}

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    EncodingType: { Base64: "base64" },
    getFreeDiskStorageAsync: () => mockGetFreeDiskStorageAsync(),
    getInfoAsync: jest.fn(async (uri: string) => {
        if (mockFiles.has(uri)) {
            return { exists: true, size: mockFiles.get(uri)!.length };
        }
        return { exists: mockDirectories.has(uri), isDirectory: mockDirectories.has(uri) };
    }),
    readAsStringAsync: jest.fn(async (uri: string) => {
        const value = mockFiles.get(uri);
        if (value == null) throw new Error(`Missing mock file: ${uri}`);
        return mockBytesText(value);
    }),
    writeAsStringAsync: jest.fn(async (uri: string, value: string) => {
        mockFiles.set(uri, mockTextBytes(value));
    }),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
        mockDirectories.add(uri);
    }),
    readDirectoryAsync: jest.fn(async (uri: string) => {
        const prefix = uri.endsWith("/") ? uri : `${uri}/`;
        return Array.from(mockFiles.keys())
            .filter((path) => path.startsWith(prefix))
            .map((path) => path.slice(prefix.length))
            .filter((path) => path.length > 0 && !path.includes("/"));
    }),
    deleteAsync: jest.fn(async (uri: string) => {
        if (mockFailRestoreDeletes && uri.includes("/restored-")) {
            throw new Error("Provider refused delete");
        }
        mockFiles.delete(uri);
        for (const path of Array.from(mockFiles.keys())) {
            if (path.startsWith(`${uri}/`)) mockFiles.delete(path);
        }
        mockDirectories.delete(uri);
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
        if (mockFailTrashMoves) throw new Error("Provider refused move");
        const value = mockFiles.get(from);
        if (value == null) throw new Error(`Missing mock file: ${from}`);
        mockFiles.set(to, value);
        mockFiles.delete(from);
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

jest.mock("expo-crypto", () => ({
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digestStringAsync: jest.fn(async (_algorithm: string, value: string) =>
        require("crypto").createHash("sha256").update(value).digest("hex")
    ),
}));

jest.mock("../../state/db/storage", () => ({
    persistRawSnapshot: (...args: [string, string]) => mockPersistRawSnapshot(...args),
}));

jest.mock("../../state/useStore", () => ({
    STORE_NAME: "song-seed-store",
    STORE_VERSION: 11,
}));

jest.mock("../../state/persistRuntime", () => ({
    setPersistBlocked: (...args: unknown[]) => mockSetPersistBlocked(...args),
}));

jest.mock("../../state/restoreRuntime", () => ({
    requireRestoreRestart: (...args: unknown[]) => mockRequireRestoreRestart(...args),
}));

jest.mock("../disasterRecoveryBackup", () => ({
    DR_BACKUP_FORMAT_VERSION: 1,
}));

import { restoreFromDisasterRecoveryBackup } from "../disasterRecoveryRestore";
import { cleanupInterruptedDisasterRecoveryRestores } from "../disasterRecoveryTemp";

const ARCHIVE_URI = "file:///picked/songseed-backup.zip";
const ORIGINAL_MEDIA_URI = "file:///doc/songseed/audio/clip-1.m4a";
const MEDIA_PATH = "songseed/audio/clip-1.m4a";
const MEDIA_ENTRY = `media/${MEDIA_PATH}`;
const MEDIA_BYTES = Uint8Array.from([1, 2, 3, 4, 5]);

function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
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
                                audioUri: MEDIA_PATH,
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

function installArchive(options?: {
    incomplete?: boolean;
    unsafePath?: string;
    compressionLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}) {
    const snapshotJson = JSON.stringify(snapshot());
    const mediaPath = options?.unsafePath ?? MEDIA_PATH;
    const mediaBase64 = Buffer.from(MEDIA_BYTES).toString("base64");
    const incomplete = Boolean(options?.incomplete);
    const manifest = {
        formatVersion: 1,
        storeVersion: 11,
        createdAt: "2026-06-23T10:00:00.000Z",
        status: incomplete ? "incomplete" : "complete",
        counts: { workspaces: 1, collections: 1, ideas: 1, clips: 1 },
        snapshotSha256: sha256(snapshotJson),
        files: incomplete
            ? []
            : [{ path: mediaPath, sha256: sha256(mediaBase64), sizeBytes: MEDIA_BYTES.length }],
        missing: incomplete
            ? [
                  {
                      path: MEDIA_PATH,
                      kind: "clip-audio",
                      critical: true,
                      ref: "idea:idea-1/clip:clip-1",
                  },
              ]
            : [],
    };
    const entries: Record<string, Uint8Array> = {
        "snapshot.json": strToU8(snapshotJson),
        "manifest.json": strToU8(JSON.stringify(manifest)),
    };
    if (!incomplete) {
        entries[`media/${mediaPath}`] = MEDIA_BYTES;
    }
    mockFiles.set(
        ARCHIVE_URI,
        Uint8Array.from(zipSync(entries, { level: options?.compressionLevel ?? 0 }))
    );
}

beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockDirectories.add("file:///doc/");
    mockPersistRawSnapshot.mockReset();
    mockPersistRawSnapshot.mockResolvedValue();
    mockSetPersistBlocked.mockReset();
    mockRequireRestoreRestart.mockReset();
    mockGetFreeDiskStorageAsync.mockReset();
    mockGetFreeDiskStorageAsync.mockResolvedValue(10 * 1024 * 1024 * 1024);
    mockFailRestoreDeletes = false;
    mockFailTrashMoves = false;
});

describe("restoreFromDisasterRecoveryBackup", () => {
    it("restores to unique paths without overwriting the current library", async () => {
        installArchive();
        const oldBytes = mockTextBytes("existing-current-audio");
        mockFiles.set(ORIGINAL_MEDIA_URI, oldBytes);

        const result = await restoreFromDisasterRecoveryBackup(ARCHIVE_URI);

        expect(result.status).toBe("complete");
        expect(mockFiles.get(ORIGINAL_MEDIA_URI)).toEqual(oldBytes);
        const restoredUri = Array.from(mockFiles.keys()).find((uri) =>
            uri.startsWith("file:///doc/songseed/audio/restored-")
        );
        expect(restoredUri).toBeDefined();
        expect(mockFiles.get(restoredUri!)).toEqual(MEDIA_BYTES);

        const persisted = JSON.parse(mockPersistRawSnapshot.mock.calls[0][1]);
        expect(persisted.version).toBe(11);
        expect(persisted.state.workspaces[0].ideas[0].clips[0].audioUri).toMatch(
            /^songseed\/audio\/restored-/
        );
        expect(mockSetPersistBlocked).toHaveBeenCalledWith(true);
        expect(mockRequireRestoreRestart).toHaveBeenCalledWith(
            { workspaces: 1, collections: 1, ideas: 1, clips: 1 },
            0
        );
        expect(
            Array.from(mockFiles.keys()).some((uri) => uri.includes("restore-journals"))
        ).toBe(true);
    });

    it("rejects incomplete backups before writing or committing anything", async () => {
        installArchive({ incomplete: true });

        await expect(restoreFromDisasterRecoveryBackup(ARCHIVE_URI)).rejects.toThrow(
            "incomplete and cannot safely restore"
        );
        expect(mockPersistRawSnapshot).not.toHaveBeenCalled();
        expect(mockRequireRestoreRestart).not.toHaveBeenCalled();
        expect(Array.from(mockFiles.keys()).filter((uri) => uri.includes("restored-"))).toHaveLength(0);
    });

    it("rejects unsafe media paths before writing", async () => {
        installArchive({ unsafePath: "songseed/audio/../../SQLite/songseed.db" });

        await expect(restoreFromDisasterRecoveryBackup(ARCHIVE_URI)).rejects.toThrow("unsafe");
        expect(mockPersistRawSnapshot).not.toHaveBeenCalled();
    });

    it("removes newly written files when the authoritative metadata commit fails", async () => {
        installArchive();
        mockPersistRawSnapshot.mockRejectedValueOnce(new Error("SQLite write failed"));

        await expect(restoreFromDisasterRecoveryBackup(ARCHIVE_URI)).rejects.toThrow(
            "SQLite write failed"
        );
        expect(Array.from(mockFiles.keys()).filter((uri) => uri.includes("restored-"))).toHaveLength(0);
        expect(Array.from(mockFiles.keys()).filter((uri) => uri.includes("restore-journals"))).toHaveLength(0);
        expect(mockSetPersistBlocked.mock.calls).toEqual([[true], [false]]);
        expect(mockRequireRestoreRestart).not.toHaveBeenCalled();
    });

    it("retains the recovery journal when a failed restore file cannot be deleted", async () => {
        installArchive();
        mockPersistRawSnapshot.mockRejectedValueOnce(new Error("SQLite write failed"));
        mockFailRestoreDeletes = true;

        await expect(restoreFromDisasterRecoveryBackup(ARCHIVE_URI)).rejects.toThrow(
            "SQLite write failed"
        );
        expect(Array.from(mockFiles.keys()).some((uri) => uri.includes("/restored-"))).toBe(true);
        expect(
            Array.from(mockFiles.keys()).some((uri) => uri.includes("restore-journals"))
        ).toBe(true);

        mockFailRestoreDeletes = false;
        await cleanupInterruptedDisasterRecoveryRestores(snapshot().workspaces as never);
        expect(Array.from(mockFiles.keys()).some((uri) => uri.includes("/restored-"))).toBe(false);
        expect(
            Array.from(mockFiles.keys()).some((uri) => uri.includes("restore-journals"))
        ).toBe(false);
    });

    it("rejects compressed archives instead of inflating them in memory", async () => {
        installArchive({ compressionLevel: 6 });

        await expect(restoreFromDisasterRecoveryBackup(ARCHIVE_URI)).rejects.toThrow(
            "uses compression"
        );
        expect(mockPersistRawSnapshot).not.toHaveBeenCalled();
    });

    it("rejects a restore when there is not enough free device storage", async () => {
        installArchive();
        mockGetFreeDiskStorageAsync.mockResolvedValueOnce(1);

        await expect(restoreFromDisasterRecoveryBackup(ARCHIVE_URI)).rejects.toThrow(
            "Not enough free device storage"
        );
        expect(mockPersistRawSnapshot).not.toHaveBeenCalled();
        expect(Array.from(mockFiles.keys()).filter((uri) => uri.includes("restored-"))).toHaveLength(0);
    });

    it("cancels before extraction and leaves the current library untouched", async () => {
        installArchive();
        const controller = new AbortController();

        await expect(
            restoreFromDisasterRecoveryBackup(ARCHIVE_URI, {
                signal: controller.signal,
                onProgress: (progress) => {
                    if (progress.phase === "verifying") controller.abort();
                },
            })
        ).rejects.toThrow("cancelled");
        expect(mockPersistRawSnapshot).not.toHaveBeenCalled();
        expect(Array.from(mockFiles.keys()).filter((uri) => uri.includes("restored-"))).toHaveLength(0);
    });

    it("quarantines displaced media only after the restored snapshot hydrates", async () => {
        installArchive();
        const oldBytes = mockTextBytes("existing-current-audio");
        mockFiles.set(ORIGINAL_MEDIA_URI, oldBytes);

        await restoreFromDisasterRecoveryBackup(ARCHIVE_URI, {
            displacedWorkspaces: snapshot().workspaces as never,
        });
        const persisted = JSON.parse(mockPersistRawSnapshot.mock.calls[0][1]);

        expect(mockFiles.get(ORIGINAL_MEDIA_URI)).toEqual(oldBytes);
        await cleanupInterruptedDisasterRecoveryRestores(persisted.state.workspaces);

        expect(mockFiles.has(ORIGINAL_MEDIA_URI)).toBe(false);
        expect(
            Array.from(mockFiles.entries()).some(
                ([uri, bytes]) => uri.includes("/songseed/trash/") && bytes === oldBytes
            )
        ).toBe(true);
        expect(
            Array.from(mockFiles.keys()).some((uri) => uri.includes("restore-journals"))
        ).toBe(false);
    });

    it("retains displaced media and the journal when restored media is missing", async () => {
        installArchive();
        const oldBytes = mockTextBytes("existing-current-audio");
        mockFiles.set(ORIGINAL_MEDIA_URI, oldBytes);

        await restoreFromDisasterRecoveryBackup(ARCHIVE_URI, {
            displacedWorkspaces: snapshot().workspaces as never,
        });
        const persisted = JSON.parse(mockPersistRawSnapshot.mock.calls[0][1]);
        const restoredUri = Array.from(mockFiles.keys()).find((uri) =>
            uri.startsWith("file:///doc/songseed/audio/restored-")
        )!;
        mockFiles.delete(restoredUri);

        await cleanupInterruptedDisasterRecoveryRestores(persisted.state.workspaces);

        expect(mockFiles.get(ORIGINAL_MEDIA_URI)).toEqual(oldBytes);
        expect(
            Array.from(mockFiles.keys()).some((uri) => uri.includes("restore-journals"))
        ).toBe(true);
    });

    it("retains the cleanup journal when displaced media cannot be quarantined", async () => {
        installArchive();
        mockFiles.set(ORIGINAL_MEDIA_URI, mockTextBytes("existing-current-audio"));

        await restoreFromDisasterRecoveryBackup(ARCHIVE_URI, {
            displacedWorkspaces: snapshot().workspaces as never,
        });
        const persisted = JSON.parse(mockPersistRawSnapshot.mock.calls[0][1]);
        mockFailTrashMoves = true;

        await cleanupInterruptedDisasterRecoveryRestores(persisted.state.workspaces);

        expect(mockFiles.has(ORIGINAL_MEDIA_URI)).toBe(true);
        expect(
            Array.from(mockFiles.keys()).some((uri) => uri.includes("restore-journals"))
        ).toBe(true);
    });
});
