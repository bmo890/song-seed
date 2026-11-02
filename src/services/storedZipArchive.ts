import { File } from "expo-file-system";
import { i18n } from "../i18n/instance";
import { strFromU8 } from "fflate";
import {
    BackupOperationCancelledError,
    reportBackupProgress,
    throwIfBackupCancelled,
    yieldToBackupUi,
    type BackupOperationOptions,
} from "./backupOperation";
import { IncrementalCrc32 } from "./streamingIntegrity";
import * as FileSystem from "expo-file-system/legacy";
import { NATIVE_IO_CANCELLED, extractRangeNative, isNativeZipAvailable } from "../../modules/songnook-file-io";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_END_SIGNATURE = 0x06064b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EXTRA_ID = 0x0001;
const ZIP64_LOCATOR_BYTES = 20;
const ZIP64_END_RECORD_BYTES = 56;
const ZIP32_MAX_ENTRIES = 0xffff;
const ZIP32_MAX_VALUE = 0xffffffff;
const MAX_ZIP_COMMENT_BYTES = 0xffff;
const ZIP_END_RECORD_BYTES = 22;
const STREAM_CHUNK_BYTES = 256 * 1024;
const YIELD_AFTER_BYTES = 2 * 1024 * 1024;

export const MAX_BACKUP_METADATA_ENTRY_BYTES = 128 * 1024 * 1024;
/** manifest.json of a SHARED archive (a file someone sent): far below the backup cap, so
 *  a hostile manifest is refused before JSON.parse can exhaust Hermes (sweep #21). 32 MB
 *  still fits the inline waveforms of a full-fidelity 4 GB archive. */
export const MAX_ARCHIVE_MANIFEST_ENTRY_BYTES = 32 * 1024 * 1024;

export type StoredZipEntry = {
    name: string;
    sizeBytes: number;
    crc32: number;
    dataOffset: number;
    localHeaderOffset: number;
};

export type StoredZipIndex = {
    archiveUri: string;
    archiveSizeBytes: number;
    entries: Map<string, StoredZipEntry>;
};

export class StoredZipError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "StoredZipError";
    }
}

function readExact(
    handle: ReturnType<File["open"]>,
    length: number,
    context: string
) {
    const bytes = handle.readBytes(length);
    if (bytes.length !== length) {
        throw new StoredZipError(`Backup archive ended unexpectedly while reading ${context}.`);
    }
    return bytes;
}

function readAt(
    handle: ReturnType<File["open"]>,
    offset: number,
    length: number,
    context: string
) {
    handle.offset = offset;
    return readExact(handle, length, context);
}

function uint32(bytes: Uint8Array, offset = 0) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

/** Little-endian 64-bit read; exact up to 2^53, far past any phone's library. */
function uint64(view: DataView, offset: number) {
    const value = view.getUint32(offset, true) + view.getUint32(offset + 4, true) * 0x100000000;
    if (!Number.isSafeInteger(value)) {
        throw new StoredZipError("Backup ZIP64 value is out of range.");
    }
    return value;
}

/** The two 64-bit sizes a Zip64 local header carries in its 0x0001 extra field. */
function readZip64LocalSizes(extra: Uint8Array) {
    const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength);
    let at = 0;
    while (at + 4 <= extra.length) {
        const id = view.getUint16(at, true);
        const length = view.getUint16(at + 2, true);
        if (at + 4 + length > extra.length) break;
        if (id === ZIP64_EXTRA_ID && length >= 16) {
            return { uncompressedSize: uint64(view, at + 4), compressedSize: uint64(view, at + 12) };
        }
        at += 4 + length;
    }
    throw new StoredZipError("Backup ZIP64 entry is missing its size record.");
}

function validateEndRecord(
    handle: ReturnType<File["open"]>,
    archiveSizeBytes: number,
    centralDirectoryOffset: number,
    localEntryCount: number
) {
    const tailSize = Math.min(
        archiveSizeBytes,
        ZIP_END_RECORD_BYTES + MAX_ZIP_COMMENT_BYTES
    );
    const tailOffset = archiveSizeBytes - tailSize;
    const tail = readAt(handle, tailOffset, tailSize, "the ZIP end record");
    const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    let endOffset = -1;

    for (let offset = tail.length - ZIP_END_RECORD_BYTES; offset >= 0; offset -= 1) {
        if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
            const commentLength = view.getUint16(offset + 20, true);
            if (offset + ZIP_END_RECORD_BYTES + commentLength === tail.length) {
                endOffset = offset;
                break;
            }
        }
    }

    if (endOffset < 0) {
        throw new StoredZipError("Backup archive is missing a valid ZIP end record.");
    }

    const diskNumber = view.getUint16(endOffset + 4, true);
    const centralDisk = view.getUint16(endOffset + 6, true);
    let entriesOnDisk = view.getUint16(endOffset + 8, true);
    let totalEntries = view.getUint16(endOffset + 10, true);
    let centralSize = view.getUint32(endOffset + 12, true);
    let declaredCentralOffset = view.getUint32(endOffset + 16, true);
    // Where the directory must end: the classic end record, or the Zip64 end record
    // that precedes it.
    let absoluteEndOffset = tailOffset + endOffset;

    if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
        throw new StoredZipError("Multi-part ZIP backups are not supported.");
    }
    if (
        totalEntries === ZIP32_MAX_ENTRIES ||
        centralSize === ZIP32_MAX_VALUE ||
        declaredCentralOffset === ZIP32_MAX_VALUE
    ) {
        // Zip64 (> 4 GB or > 65,535 files): the locator sits right before the classic
        // end record and points at the Zip64 end record, which holds the real values.
        const locatorOffset = absoluteEndOffset - ZIP64_LOCATOR_BYTES;
        if (locatorOffset < 0) {
            throw new StoredZipError("Backup archive is missing its ZIP64 locator.");
        }
        const locator = readAt(handle, locatorOffset, ZIP64_LOCATOR_BYTES, "the ZIP64 locator");
        const locatorView = new DataView(locator.buffer, locator.byteOffset, locator.byteLength);
        if (locatorView.getUint32(0, true) !== ZIP64_LOCATOR_SIGNATURE || locatorView.getUint32(4, true) !== 0) {
            throw new StoredZipError("Backup archive has an invalid ZIP64 locator.");
        }
        const zip64EndOffset = uint64(locatorView, 8);
        if (zip64EndOffset + ZIP64_END_RECORD_BYTES !== locatorOffset) {
            throw new StoredZipError("Backup ZIP64 end record is misplaced.");
        }
        const record = readAt(handle, zip64EndOffset, ZIP64_END_RECORD_BYTES, "the ZIP64 end record");
        const recordView = new DataView(record.buffer, record.byteOffset, record.byteLength);
        if (recordView.getUint32(0, true) !== ZIP64_END_SIGNATURE) {
            throw new StoredZipError("Backup archive has an invalid ZIP64 end record.");
        }
        if (recordView.getUint32(16, true) !== 0 || recordView.getUint32(20, true) !== 0) {
            throw new StoredZipError("Multi-part ZIP backups are not supported.");
        }
        entriesOnDisk = uint64(recordView, 24);
        totalEntries = uint64(recordView, 32);
        centralSize = uint64(recordView, 40);
        declaredCentralOffset = uint64(recordView, 48);
        absoluteEndOffset = zip64EndOffset;
        if (entriesOnDisk !== totalEntries) {
            throw new StoredZipError("Multi-part ZIP backups are not supported.");
        }
    }
    if (totalEntries !== localEntryCount) {
        throw new StoredZipError("Backup ZIP entry count does not match its directory.");
    }
    if (declaredCentralOffset !== centralDirectoryOffset) {
        throw new StoredZipError("Backup ZIP directory offset is invalid.");
    }
    if (centralDirectoryOffset + centralSize !== absoluteEndOffset) {
        throw new StoredZipError("Backup ZIP directory size is invalid.");
    }
}

/**
 * Indexes the local headers without loading media payloads. SongNook backups use the
 * stored (uncompressed) ZIP method so each entry can later be verified and copied in
 * bounded chunks.
 */
export async function indexStoredZipArchive(
    archiveUri: string,
    options?: BackupOperationOptions
): Promise<StoredZipIndex> {
    throwIfBackupCancelled(options?.signal);
    const file = new File(archiveUri);
    if (!file.exists) {
        throw new StoredZipError("Backup file could not be found.");
    }
    const archiveSizeBytes = file.size;
    if (!Number.isFinite(archiveSizeBytes) || archiveSizeBytes < ZIP_END_RECORD_BYTES) {
        throw new StoredZipError("Backup archive is empty or unreadable.");
    }
    if (!Number.isSafeInteger(archiveSizeBytes)) {
        throw new StoredZipError("Backup archive is too large to read.");
    }

    reportBackupProgress(options, {
        phase: "inspecting",
        completedBytes: 0,
        totalBytes: archiveSizeBytes,
        message: i18n.t("process.inspectingBackup"),
    });

    const entries = new Map<string, StoredZipEntry>();
    const handle = file.open();
    let centralDirectoryOffset = -1;
    try {
        while ((handle.offset ?? 0) < archiveSizeBytes) {
            throwIfBackupCancelled(options?.signal);
            const localHeaderOffset = handle.offset ?? 0;
            const signatureBytes = readExact(handle, 4, "an entry header");
            const signature = uint32(signatureBytes);

            if (signature === CENTRAL_DIRECTORY_SIGNATURE) {
                centralDirectoryOffset = localHeaderOffset;
                break;
            }
            if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
                throw new StoredZipError("Backup contains an invalid ZIP entry header.");
            }

            const fixedHeader = readExact(handle, 26, "an entry header");
            const view = new DataView(
                fixedHeader.buffer,
                fixedHeader.byteOffset,
                fixedHeader.byteLength
            );
            const flags = view.getUint16(2, true);
            const method = view.getUint16(4, true);
            const checksum = view.getUint32(10, true);
            let compressedSize = view.getUint32(14, true);
            let uncompressedSize = view.getUint32(18, true);
            const nameLength = view.getUint16(22, true);
            const extraLength = view.getUint16(24, true);

            if ((flags & 0x0001) !== 0) {
                throw new StoredZipError("Encrypted ZIP entries are not supported.");
            }
            if ((flags & 0x0008) !== 0) {
                throw new StoredZipError("ZIP data descriptors are not supported in SongNook backups.");
            }
            if (method !== 0) {
                throw new StoredZipError(
                    "This backup uses compression that SongNook cannot restore safely."
                );
            }
            if (nameLength === 0) {
                throw new StoredZipError("Backup contains an unnamed ZIP entry.");
            }

            const nameBytes = readExact(handle, nameLength, "an entry name");
            const name = strFromU8(nameBytes);
            if (entries.has(name)) {
                throw new StoredZipError(`Backup contains a duplicate archive entry: ${name}`);
            }
            const extra = extraLength > 0 ? readExact(handle, extraLength, "ZIP entry metadata") : null;
            if (compressedSize === ZIP32_MAX_VALUE || uncompressedSize === ZIP32_MAX_VALUE) {
                // Zip64 entry (a file of 4 GB or more): the real sizes are in the extra field.
                const sizes = readZip64LocalSizes(extra ?? new Uint8Array(0));
                compressedSize = sizes.compressedSize;
                uncompressedSize = sizes.uncompressedSize;
            }
            if (compressedSize !== uncompressedSize) {
                throw new StoredZipError(
                    "This backup uses compression that SongNook cannot restore safely."
                );
            }
            const dataOffset = handle.offset ?? 0;
            const dataEnd = dataOffset + compressedSize;
            if (dataEnd > archiveSizeBytes) {
                throw new StoredZipError(`Backup entry extends beyond the archive: ${name}`);
            }

            entries.set(name, {
                name,
                sizeBytes: uncompressedSize,
                crc32: checksum,
                dataOffset,
                localHeaderOffset,
            });
            handle.offset = dataEnd;

            if (entries.size % 256 === 0) {
                reportBackupProgress(options, {
                    phase: "inspecting",
                    completedBytes: dataEnd,
                    totalBytes: archiveSizeBytes,
                    message: i18n.t("process.inspectingBackup"),
                });
                await yieldToBackupUi(options?.signal);
            }
        }

        if (centralDirectoryOffset < 0) {
            throw new StoredZipError("Backup archive is missing its ZIP directory.");
        }
        validateEndRecord(handle, archiveSizeBytes, centralDirectoryOffset, entries.size);
    } finally {
        handle.close();
    }

    reportBackupProgress(options, {
        phase: "inspecting",
        completedBytes: archiveSizeBytes,
        totalBytes: archiveSizeBytes,
        message: i18n.t("process.backupVerified"),
    });
    return { archiveUri, archiveSizeBytes, entries };
}

export async function streamStoredZipEntry(
    index: StoredZipIndex,
    entry: StoredZipEntry,
    onChunk: (chunk: Uint8Array) => void | Promise<void>,
    options?: BackupOperationOptions & {
        phase?: "verifying" | "restoring";
        progressOffsetBytes?: number;
        progressTotalBytes?: number;
        progressMessage?: string;
    }
) {
    throwIfBackupCancelled(options?.signal);
    const file = new File(index.archiveUri);
    const handle = file.open();
    const crc = new IncrementalCrc32();
    let remaining = entry.sizeBytes;
    let processed = 0;
    let bytesSinceYield = 0;

    try {
        handle.offset = entry.dataOffset;
        while (remaining > 0) {
            throwIfBackupCancelled(options?.signal);
            const requested = Math.min(STREAM_CHUNK_BYTES, remaining);
            const chunk = readExact(handle, requested, entry.name);
            crc.update(chunk);
            await onChunk(chunk);
            remaining -= chunk.length;
            processed += chunk.length;
            bytesSinceYield += chunk.length;

            if (bytesSinceYield >= YIELD_AFTER_BYTES) {
                if (options?.phase) {
                    reportBackupProgress(options, {
                        phase: options.phase,
                        completedBytes: (options.progressOffsetBytes ?? 0) + processed,
                        totalBytes: options.progressTotalBytes ?? entry.sizeBytes,
                        message: options.progressMessage ?? i18n.t("process.processingBackup"),
                    });
                }
                bytesSinceYield = 0;
                await yieldToBackupUi(options?.signal);
            }
        }
    } finally {
        handle.close();
    }

    if (crc.digest() !== entry.crc32) {
        throw new StoredZipError(`Backup ZIP checksum failed for ${entry.name}.`);
    }
    return { sizeBytes: processed, crc32: entry.crc32 };
}

/**
 * Stream one entry straight to a file on disk in bounded chunks (native reads +
 * native writes; the entry's CRC is verified in-stream). Never holds more than a
 * chunk in memory — use this for media payloads instead of readStoredZipEntryBytes.
 */
export async function extractStoredZipEntryToFile(
    index: StoredZipIndex,
    entry: StoredZipEntry,
    targetUri: string,
    options?: BackupOperationOptions
) {
    if (isNativeZipAvailable()) {
        // One native read and write, CRC checked from the same bytes (2026-10-20).
        let result: Awaited<ReturnType<typeof extractRangeNative>>;
        try {
            result = await extractRangeNative(index.archiveUri, entry.dataOffset, entry.sizeBytes, targetUri, {
                signal: options?.signal,
            });
        } catch (error) {
            if (options?.signal?.aborted || (error instanceof Error && error.message === NATIVE_IO_CANCELLED)) {
                throw new BackupOperationCancelledError();
            }
            throw error;
        }
        if (result.crc32 !== entry.crc32 >>> 0 || result.sizeBytes !== entry.sizeBytes) {
            await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => {});
            throw new StoredZipError(`Backup ZIP checksum failed for ${entry.name}.`);
        }
        return;
    }
    const targetFile = new File(targetUri);
    targetFile.create({ intermediates: true, overwrite: true });
    const handle = targetFile.open();
    try {
        await streamStoredZipEntry(index, entry, (chunk) => handle.writeBytes(chunk), options);
    } finally {
        handle.close();
    }
}

/**
 * Read one entry back from disk and check its bytes against the CRC recorded when it
 * was written. Throws `StoredZipError` on a mismatch. A package is read back like this
 * before anything is deleted on the strength of it (audit 2026-11-02, 03 #7).
 */
export async function verifyStoredZipEntryReadable(index: StoredZipIndex, entry: StoredZipEntry) {
    if (isNativeZipAvailable() && FileSystem.cacheDirectory) {
        // One native read; the copy it leaves is scratch and goes at once.
        const scratchUri = `${FileSystem.cacheDirectory}songnook-verify-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 8)}`;
        try {
            await extractStoredZipEntryToFile(index, entry, scratchUri);
        } finally {
            await FileSystem.deleteAsync(scratchUri, { idempotent: true }).catch(() => {});
        }
        return;
    }
    await streamStoredZipEntry(index, entry, () => {});
}

export async function readStoredZipEntryBytes(
    index: StoredZipIndex,
    entry: StoredZipEntry,
    maxBytes = MAX_BACKUP_METADATA_ENTRY_BYTES,
    options?: BackupOperationOptions
) {
    if (entry.sizeBytes > maxBytes) {
        throw new StoredZipError(`Backup metadata entry is too large: ${entry.name}`);
    }
    const output = new Uint8Array(entry.sizeBytes);
    let offset = 0;
    await streamStoredZipEntry(
        index,
        entry,
        (chunk) => {
            output.set(chunk, offset);
            offset += chunk.length;
        },
        options
    );
    return output;
}
