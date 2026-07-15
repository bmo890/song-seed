/**
 * The zip writer's single-pass mode: entries WITHOUT a precomputed CRC stream once,
 * with the CRC computed in-flight and patched into the already-written local header.
 * Validity is proven by reading the archive back through the strict stored-zip reader,
 * which verifies the end record, sizes, and every entry's CRC.
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
    makeDirectoryAsync: jest.fn(async (uri: string) => {
        mockDirectories.add(uri);
    }),
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

jest.mock("expo-audio", () => ({ createAudioPlayer: jest.fn() }));
jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));
jest.mock("../waveformAnalysis", () => ({ computeWaveformPeaks: jest.fn() }));
jest.mock("../../../modules/songseed-file-io", () => ({
    isSongseedFileIOAvailable: () => false,
    copyLocalFileToContentUri: jest.fn(),
    deleteContentUri: jest.fn(),
}));

import { createZipArchive } from "../zipArchive";
import { indexStoredZipArchive, readStoredZipEntryBytes } from "../storedZipArchive";
import type { BackupOperationProgress } from "../backupOperation";

const ARCHIVE_URI = "file:///doc/songseed/share/test-archive.zip";

function fixture(size: number, seed: number) {
    return Uint8Array.from({ length: size }, (_, index) => (index * seed + 7) & 0xff);
}

beforeEach(() => {
    mockFiles.clear();
    mockDirectories.clear();
    mockDirectories.add("file:///doc/");
    mockDirectories.add("file:///doc/songseed");
});

describe("createZipArchive single-pass (deferred CRC)", () => {
    it("writes a valid archive for file entries without precomputed CRCs", async () => {
        const audioA = fixture(300 * 1024 + 13, 31); // spans multiple stream chunks
        const audioB = fixture(5 * 1024 + 1, 101);
        mockFiles.set("file:///doc/songseed/audio/a.m4a", audioA);
        mockFiles.set("file:///doc/songseed/audio/b.m4a", audioB);

        await createZipArchive(ARCHIVE_URI, [
            { archiveName: "manifest.json", data: '{"ok":true}' },
            // Export-style entries: size known, CRC NOT precomputed.
            { archiveName: "audio/a.m4a", fileUri: "file:///doc/songseed/audio/a.m4a", sizeBytes: audioA.length },
            // Neither size nor CRC provided — writer stats the file itself.
            { archiveName: "audio/b.m4a", fileUri: "file:///doc/songseed/audio/b.m4a" },
        ]);

        // The strict stored-zip reader validates the end record and every entry, and
        // streaming an entry verifies its CRC against the (patched) headers.
        const index = await indexStoredZipArchive(ARCHIVE_URI);
        expect(Array.from(index.entries.keys()).sort()).toEqual([
            "audio/a.m4a",
            "audio/b.m4a",
            "manifest.json",
        ]);
        const readA = await readStoredZipEntryBytes(index, index.entries.get("audio/a.m4a")!);
        const readB = await readStoredZipEntryBytes(index, index.entries.get("audio/b.m4a")!);
        expect(readA).toEqual(audioA);
        expect(readB).toEqual(audioB);
        // Local-header CRC (used by other unzip tools) must match the central directory's.
        expect(index.entries.get("audio/a.m4a")!.crc32).not.toBe(0);
    });

    it("reports packaging progress from the first streamed bytes (no silent pre-read)", async () => {
        const audio = fixture(5 * 1024 * 1024, 17); // > yield threshold so progress fires mid-write
        mockFiles.set("file:///doc/songseed/audio/big.m4a", audio);

        const events: BackupOperationProgress[] = [];
        await createZipArchive(
            ARCHIVE_URI,
            [{ archiveName: "audio/big.m4a", fileUri: "file:///doc/songseed/audio/big.m4a", sizeBytes: audio.length }],
            { onProgress: (progress) => events.push(progress) }
        );

        const packaging = events.filter((event) => event.phase === "packaging");
        expect(packaging.length).toBeGreaterThan(1);
        // Totals are truthful (single read of the source) and intermediate progress exists.
        expect(packaging[0].totalBytes).toBe(audio.length);
        expect(packaging.some((event) => event.completedBytes > 0 && event.completedBytes < audio.length)).toBe(
            true
        );
    });

    it("still verifies precomputed CRCs (backup path unchanged)", async () => {
        const audio = fixture(64 * 1024, 13);
        mockFiles.set("file:///doc/songseed/audio/c.m4a", audio);

        await expect(
            createZipArchive(ARCHIVE_URI, [
                {
                    archiveName: "audio/c.m4a",
                    fileUri: "file:///doc/songseed/audio/c.m4a",
                    sizeBytes: audio.length,
                    crc32: 0xdeadbeef, // wrong on purpose
                },
            ])
        ).rejects.toThrow("File changed while packaging");
    });
});
