import { zipSync } from "fflate";

/**
 * detectPickedArchiveKind must tell the two Song Seed .zip formats apart so the import and
 * restore flows can redirect a misplaced file. It reads only the manifest via the streaming
 * indexer, which expects STORED (uncompressed) entries — so the fixtures use level 0.
 */

const mockFiles = new Map<string, Uint8Array>();

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
        open() {
            const bytes = mockFiles.get(this.uri);
            if (!bytes) throw new Error(`Missing mock file: ${this.uri}`);
            const handle = {
                offset: 0,
                readBytes(length: number) {
                    const chunk = bytes.slice(handle.offset, handle.offset + length);
                    handle.offset += chunk.length;
                    return chunk;
                },
                close() {},
            };
            return handle;
        }
    }
    return { File: MockFile };
});

import { detectPickedArchiveKind } from "../archiveKind";

function utf8(value: string) {
    return Uint8Array.from(Buffer.from(value, "utf8"));
}

function storeZip(entries: Record<string, string>): Uint8Array {
    const input: Record<string, [Uint8Array, { level: 0 }]> = {};
    for (const [name, value] of Object.entries(entries)) {
        input[name] = [utf8(value), { level: 0 }];
    }
    return zipSync(input as never);
}

beforeEach(() => {
    mockFiles.clear();
});

it("classifies a Song Seed Archive", async () => {
    mockFiles.set("file:///pick/archive.zip", storeZip({
        "manifest.json": JSON.stringify({ format: "song-seed-archive", schemaVersion: 6, workspaces: [] }),
    }));
    expect(await detectPickedArchiveKind("file:///pick/archive.zip")).toBe("song-seed-archive");
});

it("classifies a disaster-recovery backup", async () => {
    mockFiles.set("file:///pick/backup.zip", storeZip({
        "snapshot.json": JSON.stringify({ state: {} }),
        "manifest.json": JSON.stringify({
            formatVersion: 1,
            storeVersion: 11,
            createdAt: "2026-01-01T00:00:00.000Z",
            status: "complete",
            counts: { workspaces: 1, collections: 0, ideas: 1, clips: 1 },
            snapshotSha256: "deadbeef",
            files: [],
            missing: [],
        }),
    }));
    expect(await detectPickedArchiveKind("file:///pick/backup.zip")).toBe("song-seed-backup");
});

it("reports an unrelated zip (no manifest) as unknown", async () => {
    mockFiles.set("file:///pick/random.zip", storeZip({ "readme.txt": "hello" }));
    expect(await detectPickedArchiveKind("file:///pick/random.zip")).toBe("unknown");
});

it("reports a missing or unreadable file as unknown without throwing", async () => {
    await expect(detectPickedArchiveKind("file:///pick/missing.zip")).resolves.toBe("unknown");
});
