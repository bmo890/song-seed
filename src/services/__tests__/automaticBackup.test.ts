/**
 * Automatic backup (founder decision C, 2026-11-02): one backup folder kept current in
 * place. Copies only what the folder lacks, commits with the manifest, survives an
 * interrupted run, prunes unused media after 30 days, and restores through the same
 * restore as a .zip.
 */
import { createHash } from "crypto";

const mockFiles = new Map<string, Uint8Array>();
const mockDirectories = new Set<string>(["file:///doc/", "file:///doc/songnook"]);
const mockPersistRawSnapshot = jest.fn<Promise<void>, [string, string]>();

function mockBytes(value: string) {
    return Uint8Array.from(Buffer.from(value, "utf8"));
}

jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { version: "1.0.0" } } }));
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///doc/",
    EncodingType: { Base64: "base64" },
    getFreeDiskStorageAsync: jest.fn(async () => 10 * 1024 * 1024 * 1024),
    getInfoAsync: jest.fn(async (uri: string) => {
        if (mockFiles.has(uri)) return { exists: true, size: mockFiles.get(uri)!.length };
        return { exists: mockDirectories.has(uri), isDirectory: mockDirectories.has(uri) };
    }),
    readAsStringAsync: jest.fn(async (uri: string) => Buffer.from(mockFiles.get(uri)!).toString("utf8")),
    writeAsStringAsync: jest.fn(async (uri: string, value: string) => {
        mockFiles.set(uri, mockBytes(value));
    }),
    makeDirectoryAsync: jest.fn(async (uri: string) => {
        mockDirectories.add(uri);
    }),
    readDirectoryAsync: jest.fn(async () => []),
    deleteAsync: jest.fn(async (uri: string) => {
        mockFiles.delete(uri);
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
        create() {
            mockFiles.set(this.uri, new Uint8Array(0));
        }
    }
    return { File: MockFile };
});
jest.mock("../fileHashing", () => ({
    sha256OfString: async (value: string) => require("crypto").createHash("sha256").update(value).digest("hex"),
    sha256OfFileBase64: async (uri: string) =>
        require("crypto")
            .createHash("sha256")
            .update(Buffer.from(mockFiles.get(uri)!).toString("base64"))
            .digest("hex"),
}));
jest.mock("../satelliteSnapshot", () => ({
    collectSatelliteSnapshot: async () => ({ schemaVersion: 1, stores: {} }),
    sanitizeSatelliteSnapshot: () => undefined,
    writeSatelliteSnapshot: jest.fn(),
}));
jest.mock("../libraryBackup", () => ({ collectSetAsideWorkspaceRows: async () => undefined }));
jest.mock("../audioStorage", () => ({ buildTimestampSlug: () => "2026-11-02-1200" }));
jest.mock("../../state/useStore", () => ({
    STORE_NAME: "songnook-store",
    STORE_VERSION: 12,
    buildPersistedAppStoreSnapshot: (state: unknown) => state,
}));
jest.mock("../../state/db/storage", () => ({
    persistRawSnapshot: (...args: [string, string]) => mockPersistRawSnapshot(...args),
    commitShardedWrite: jest.fn(),
}));
jest.mock("../../state/persistRuntime", () => ({
    setPersistBlocked: jest.fn(),
    getHydrationDegradedWorkspaceIds: () => [],
}));
jest.mock("../../state/restoreRuntime", () => ({ requireRestoreRestart: jest.fn() }));

import {
    AUTO_BACKUP_FOLDER_NAME,
    AUTO_BACKUP_PRUNE_AFTER_MS,
    mediaFileName,
    openFolderRestoreSource,
    runFolderBackup,
    type BackupFolderIO,
} from "../automaticBackup";
import { restoreFromSource } from "../disasterRecoveryRestore";

/** An in-memory folder provider (iCloud Drive / SAF stand-in). */
function memoryFolder() {
    const folder = new Map<string, Uint8Array>(); // "dir/name" -> bytes
    const dirs = new Set<string>(["picked:"]);
    const writes: string[] = [];
    let failManifestWrite = false;
    const io: BackupFolderIO = {
        bookmark: async (uri) => uri,
        resolve: async (handle) => {
            if (handle !== "handle") throw new Error("SONGNOOK_FOLDER_GONE");
            return { uri: "picked:", name: "iCloud Drive", handle };
        },
        child: async (dir, name, create) => {
            const uri = `${dir}/${name}`;
            if (dirs.has(uri)) return uri;
            if (!create) return null;
            dirs.add(uri);
            return uri;
        },
        list: async (dir) => {
            const out = [];
            for (const sub of dirs) {
                if (sub.startsWith(`${dir}/`) && !sub.slice(dir.length + 1).includes("/")) {
                    out.push({ name: sub.slice(dir.length + 1), uri: sub, size: -1, isDirectory: true });
                }
            }
            for (const [uri, bytes] of folder) {
                if (uri.startsWith(`${dir}/`) && !uri.slice(dir.length + 1).includes("/")) {
                    out.push({ name: uri.slice(dir.length + 1), uri, size: bytes.length, isDirectory: false });
                }
            }
            return out;
        },
        writeFile: async (dir, name, source) => {
            writes.push(name);
            folder.set(`${dir}/${name}`, mockFiles.get(source)!);
            return { uri: `${dir}/${name}`, sizeBytes: mockFiles.get(source)!.length };
        },
        writeText: async (dir, name, text) => {
            if (failManifestWrite && name.startsWith("manifest-")) throw new Error("killed");
            folder.set(`${dir}/${name}`, mockBytes(text));
            return { uri: `${dir}/${name}`, sizeBytes: mockBytes(text).length };
        },
        readText: async (uri) => Buffer.from(folder.get(uri)!).toString("utf8"),
        copyOut: async (uri, destination, options) => {
            const bytes = folder.get(uri)!;
            mockFiles.set(destination, bytes);
            return {
                crc32: 0,
                sizeBytes: bytes.length,
                sha256: options?.sha256
                    ? createHash("sha256").update(Buffer.from(bytes).toString("base64")).digest("hex")
                    : null,
            };
        },
        remove: async (uri) => {
            folder.delete(uri);
        },
    };
    return {
        io,
        folder,
        writes,
        failManifest: (on: boolean) => {
            failManifestWrite = on;
        },
        names: (dir: string) =>
            Array.from(folder.keys())
                .filter((uri) => uri.startsWith(`${dir}/`) && !uri.slice(dir.length + 1).includes("/"))
                .map((uri) => uri.slice(dir.length + 1))
                .sort(),
    };
}

const ROOT = `picked:/${AUTO_BACKUP_FOLDER_NAME}`;
const MEDIA = `${ROOT}/media`;
const AUDIO = "file:///doc/songnook/audio";

function library(clipIds: string[]) {
    return {
        workspaces: [
            {
                id: "ws-1",
                title: "Main",
                collections: [{ id: "col-1", title: "Songs", workspaceId: "ws-1", createdAt: 1, updatedAt: 1 }],
                ideas: [
                    {
                        id: "idea-1",
                        title: "Song",
                        collectionId: "col-1",
                        createdAt: 1,
                        lastActivityAt: 1,
                        clips: clipIds.map((id, index) => ({
                            id,
                            title: id,
                            createdAt: 1,
                            isPrimary: index === 0,
                            audioUri: `${AUDIO}/${id}.wav`,
                        })),
                    },
                ],
            },
        ],
        activityEvents: [],
        playlists: [],
        notes: [],
    } as never;
}

beforeEach(() => {
    mockFiles.clear();
    mockPersistRawSnapshot.mockClear();
    for (const id of ["clip-1", "clip-2", "clip-3"]) mockFiles.set(`${AUDIO}/${id}.wav`, mockBytes(`${id} audio`));
});

it("copies only what the folder lacks and keeps exactly one generation", async () => {
    const memory = memoryFolder();
    const first = await runFolderBackup(library(["clip-1", "clip-2"]), "handle", { io: memory.io, now: 1_000 });
    expect(first.status).toBe("complete");
    expect(first.copiedFiles).toBe(2);
    expect(memory.names(MEDIA)).toEqual([
        mediaFileName("songnook/audio/clip-1.wav"),
        mediaFileName("songnook/audio/clip-2.wav"),
    ]);

    const second = await runFolderBackup(library(["clip-1", "clip-2"]), "handle", { io: memory.io, now: 2_000 });
    expect(second.copiedFiles).toBe(0);

    const third = await runFolderBackup(library(["clip-1", "clip-2", "clip-3"]), "handle", { io: memory.io, now: 3_000 });
    expect(third.copiedFiles).toBe(1);
    expect(memory.writes).toHaveLength(3);
    // One snapshot + one manifest: the backup is kept current in place, never several copies.
    expect(memory.names(ROOT)).toEqual(["manifest-000000000003000.json", "snapshot-000000000003000.json"]);
});

it("an interrupted run leaves the previous backup whole, and the next run finishes", async () => {
    const memory = memoryFolder();
    await runFolderBackup(library(["clip-1"]), "handle", { io: memory.io, now: 1_000 });
    memory.failManifest(true);
    await expect(
        runFolderBackup(library(["clip-1", "clip-2"]), "handle", { io: memory.io, now: 2_000 })
    ).rejects.toThrow("killed");
    const source = await openFolderRestoreSource("handle", { io: memory.io });
    expect(source.createdAt).toBeDefined();
    const manifest = JSON.parse(await source.readEntryText("manifest.json"));
    expect(manifest.files.map((f: { path: string }) => f.path)).toEqual(["songnook/audio/clip-1.wav"]);

    memory.failManifest(false);
    const next = await runFolderBackup(library(["clip-1", "clip-2"]), "handle", { io: memory.io, now: 3_000 });
    // clip-2 landed whole during the interrupted run; it is fingerprinted, not copied again.
    expect(next.copiedFiles).toBe(0);
    expect(next.manifest.files).toHaveLength(2);
    expect(memory.names(ROOT)).toEqual(["manifest-000000000003000.json", "snapshot-000000000003000.json"]);
});

it("keeps media the library dropped for 30 days, then prunes it", async () => {
    const memory = memoryFolder();
    await runFolderBackup(library(["clip-1", "clip-2"]), "handle", { io: memory.io, now: 1_000 });
    const dropped = await runFolderBackup(library(["clip-1"]), "handle", { io: memory.io, now: 2_000 });
    expect(dropped.prunedFiles).toBe(0);
    expect(memory.names(MEDIA)).toHaveLength(2);
    const later = await runFolderBackup(library(["clip-1"]), "handle", {
        io: memory.io,
        now: 2_000 + AUTO_BACKUP_PRUNE_AFTER_MS,
    });
    expect(later.prunedFiles).toBe(1);
    expect(memory.names(MEDIA)).toEqual([mediaFileName("songnook/audio/clip-1.wav")]);
});

it("keeps the folder's copy of a recording this phone lost", async () => {
    const memory = memoryFolder();
    await runFolderBackup(library(["clip-1", "clip-2"]), "handle", { io: memory.io, now: 1_000 });
    mockFiles.delete(`${AUDIO}/clip-2.wav`);

    const later = await runFolderBackup(library(["clip-1", "clip-2"]), "handle", {
        io: memory.io,
        now: 1_000 + AUTO_BACKUP_PRUNE_AFTER_MS + 1,
    });

    expect(later.status).toBe("complete");
    expect(later.manifest.files.map((file) => file.path).sort()).toEqual([
        "songnook/audio/clip-1.wav",
        "songnook/audio/clip-2.wav",
    ]);
    expect(memory.names(MEDIA)).toContain(mediaFileName("songnook/audio/clip-2.wav"));
});

it("reports a folder that is gone as unavailable", async () => {
    const memory = memoryFolder();
    await expect(runFolderBackup(library(["clip-1"]), "other", { io: memory.io })).rejects.toMatchObject({
        code: "folderUnavailable",
    });
});

it("restores the library from the folder through the same restore as a .zip", async () => {
    const memory = memoryFolder();
    const state = library(["clip-1", "clip-2"]);
    await runFolderBackup(state, "handle", { io: memory.io, now: 1_000 });

    const result = await restoreFromSource(await openFolderRestoreSource("handle", { io: memory.io }));

    expect(result.status).toBe("complete");
    const committed = JSON.parse(mockPersistRawSnapshot.mock.calls[0][1]).state;
    const clips = committed.workspaces[0].ideas[0].clips;
    expect(clips).toHaveLength(2);
    for (const clip of clips) {
        expect(clip.audioUri).toMatch(/^songnook\/audio\/restored-[\w-]+\/clip-\d\.wav$/);
        expect(Buffer.from(mockFiles.get(`file:///doc/${clip.audioUri}`)!).toString()).toBe(`${clip.id} audio`);
    }
});
