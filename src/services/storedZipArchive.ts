import { File } from "expo-file-system";
import { strFromU8 } from "fflate";
import {
    reportBackupProgress,
    throwIfBackupCancelled,
    yieldToBackupUi,
    type BackupOperationOptions,
} from "./backupOperation";
import { IncrementalCrc32 } from "./streamingIntegrity";

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP64_END_SIGNATURE = 0x06064b50;
const ZIP32_MAX_ENTRIES = 0xffff;
const ZIP32_MAX_VALUE = 0xffffffff;
const MAX_ZIP_COMMENT_BYTES = 0xffff;
const ZIP_END_RECORD_BYTES = 22;
const STREAM_CHUNK_BYTES = 256 * 1024;
const YIELD_AFTER_BYTES = 2 * 1024 * 1024;

export const MAX_BACKUP_METADATA_ENTRY_BYTES = 128 * 1024 * 1024;

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
    const entriesOnDisk = view.getUint16(endOffset + 8, true);
    const totalEntries = view.getUint16(endOffset + 10, true);
    const centralSize = view.getUint32(endOffset + 12, true);
    const declaredCentralOffset = view.getUint32(endOffset + 16, true);
    const absoluteEndOffset = tailOffset + endOffset;

    if (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries) {
        throw new StoredZipError("Multi-part ZIP backups are not supported.");
    }
    if (totalEntries === ZIP32_MAX_ENTRIES || declaredCentralOffset === ZIP32_MAX_VALUE) {
        throw new StoredZipError("ZIP64 backups are not supported by this Song Seed version.");
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
 * Indexes the local headers without loading media payloads. Song Seed backups use the
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
    if (archiveSizeBytes > ZIP32_MAX_VALUE) {
        throw new StoredZipError("Backup archive exceeds the supported 4 GB ZIP limit.");
    }

    reportBackupProgress(options, {
        phase: "inspecting",
        completedBytes: 0,
        totalBytes: archiveSizeBytes,
        message: "Inspecting backup",
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
            if (signature === ZIP64_END_SIGNATURE) {
                throw new StoredZipError("ZIP64 backups are not supported by this Song Seed version.");
            }
            if (signature !== LOCAL_FILE_HEADER_SIGNATURE) {
                throw new StoredZipError("Backup contains an invalid ZIP entry header.");
            }
            if (entries.size >= ZIP32_MAX_ENTRIES) {
                throw new StoredZipError("Backup contains too many files for ZIP32.");
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
            const compressedSize = view.getUint32(14, true);
            const uncompressedSize = view.getUint32(18, true);
            const nameLength = view.getUint16(22, true);
            const extraLength = view.getUint16(24, true);

            if ((flags & 0x0001) !== 0) {
                throw new StoredZipError("Encrypted ZIP entries are not supported.");
            }
            if ((flags & 0x0008) !== 0) {
                throw new StoredZipError("ZIP data descriptors are not supported in Song Seed backups.");
            }
            if (method !== 0 || compressedSize !== uncompressedSize) {
                throw new StoredZipError(
                    "This backup uses compression that Song Seed cannot restore safely."
                );
            }
            if (compressedSize === ZIP32_MAX_VALUE || uncompressedSize === ZIP32_MAX_VALUE) {
                throw new StoredZipError("ZIP64 backup entries are not supported.");
            }
            if (nameLength === 0) {
                throw new StoredZipError("Backup contains an unnamed ZIP entry.");
            }

            const nameBytes = readExact(handle, nameLength, "an entry name");
            const name = strFromU8(nameBytes);
            if (entries.has(name)) {
                throw new StoredZipError(`Backup contains a duplicate archive entry: ${name}`);
            }
            if (extraLength > 0) {
                readExact(handle, extraLength, "ZIP entry metadata");
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
                    message: "Inspecting backup",
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
        message: "Backup structure verified",
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
                        message: options.progressMessage ?? "Processing backup",
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
