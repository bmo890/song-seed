import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import {
    reportBackupProgress,
    throwIfBackupCancelled,
    yieldToBackupUi,
    type BackupOperationOptions,
} from "./backupOperation";
import { IncrementalCrc32 } from "./streamingIntegrity";

export type ZipArchiveEntry = {
    archiveName: string;
    fileUri?: string;
    data?: string | Uint8Array;
    directory?: boolean;
    missingMessage?: string;
    /** Precomputed by callers that already scan large files for another checksum. */
    sizeBytes?: number;
    crc32?: number;
};

function encodeUtf8(value: string) {
    return new TextEncoder().encode(value);
}

function crc32(bytes: Uint8Array) {
    return new IncrementalCrc32().update(bytes).digest();
}

const ZIP_STREAM_CHUNK_BYTES = 512 * 1024;
const ZIP32_MAX_VALUE = 0xffffffff;
const ZIP32_MAX_ENTRIES = 0xffff;

function buildZipLocalHeader(filenameBytes: Uint8Array, size: number, checksum: number) {
    const header = new Uint8Array(30 + filenameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, filenameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(filenameBytes, 30);

    return header;
}

function buildZipCentralHeader(filenameBytes: Uint8Array, size: number, checksum: number, localOffset: number) {
    const header = new Uint8Array(46 + filenameBytes.length);
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, checksum, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, filenameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, localOffset, true);
    header.set(filenameBytes, 46);

    return header;
}

function buildZipEndRecord(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
    const record = new Uint8Array(22);
    const view = new DataView(record.buffer);

    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entryCount, true);
    view.setUint16(10, entryCount, true);
    view.setUint32(12, centralDirectorySize, true);
    view.setUint32(16, centralDirectoryOffset, true);
    view.setUint16(20, 0, true);

    return record;
}

export async function createZipArchive(
    destinationUri: string,
    entries: ZipArchiveEntry[],
    options?: BackupOperationOptions
) {
    const resolvedEntries: Array<{
        archiveName: string;
        filenameBytes: Uint8Array;
        data?: Uint8Array;
        fileUri?: string;
        checksum: number;
        /** CRC computed while streaming, then patched into the already-written local header. */
        deferredCrc?: boolean;
        size: number;
    }> = [];

    for (const entry of entries) {
        throwIfBackupCancelled(options?.signal);
        if (entry.directory) {
            const directoryName = entry.archiveName.endsWith("/")
                ? entry.archiveName
                : `${entry.archiveName}/`;
            resolvedEntries.push({
                archiveName: directoryName,
                filenameBytes: encodeUtf8(directoryName),
                data: new Uint8Array(0),
                checksum: 0,
                size: 0,
            });
            continue;
        }

        if (typeof entry.fileUri === "string") {
            const info = await FileSystem.getInfoAsync(entry.fileUri);
            if (!info.exists) {
                throw new Error(`Missing file: ${entry.archiveName}`);
            }

            // No pre-read pass: size comes from the caller or the filesystem, and a missing
            // CRC is computed WHILE the entry streams, then patched into its local header.
            // The old resolve pass silently read every byte before packaging began, which
            // left exports sitting at 0% for the entire first read of the library.
            // File.size is the fallback for providers whose getInfoAsync omits .size.
            const statedSize =
                typeof info.size === "number" ? info.size : new File(entry.fileUri).size;
            const size =
                entry.sizeBytes ??
                (Number.isSafeInteger(statedSize) && statedSize >= 0 ? statedSize : null);
            if (size == null || !Number.isSafeInteger(size) || size < 0) {
                throw new Error(`Could not determine file size for ${entry.archiveName}`);
            }
            if (entry.sizeBytes != null && typeof info.size === "number" && info.size !== size) {
                throw new Error(`File changed while preparing archive: ${entry.archiveName}`);
            }

            resolvedEntries.push({
                archiveName: entry.archiveName,
                filenameBytes: encodeUtf8(entry.archiveName),
                fileUri: entry.fileUri,
                checksum: entry.crc32 ?? 0,
                deferredCrc: entry.crc32 == null,
                size,
            });
            continue;
        }

        let data: Uint8Array;
        if (typeof entry.data === "string") {
            data = encodeUtf8(entry.data);
        } else if (entry.data instanceof Uint8Array) {
            data = entry.data;
        } else {
            throw new Error(`No archive data for ${entry.archiveName}`);
        }

        resolvedEntries.push({
            archiveName: entry.archiveName,
            filenameBytes: encodeUtf8(entry.archiveName),
            data,
            checksum: crc32(data),
            size: data.length,
        });
    }

    if (resolvedEntries.length >= ZIP32_MAX_ENTRIES) {
        throw new Error("Archive contains too many files for the supported ZIP format.");
    }
    let projectedOffset = 0;
    for (const entry of resolvedEntries) {
        if (entry.size > ZIP32_MAX_VALUE) {
            throw new Error(`Archive file is too large for the supported ZIP format: ${entry.archiveName}`);
        }
        projectedOffset += 30 + entry.filenameBytes.length + entry.size;
        if (projectedOffset > ZIP32_MAX_VALUE) {
            throw new Error("Archive exceeds the 4 GB limit of the supported ZIP format.");
        }
    }
    const projectedCentralDirectorySize = resolvedEntries.reduce(
        (sum, entry) => sum + 46 + entry.filenameBytes.length,
        0
    );
    if (projectedOffset + projectedCentralDirectorySize + 22 > ZIP32_MAX_VALUE) {
        throw new Error("Archive exceeds the 4 GB limit of the supported ZIP format.");
    }

    const destinationFile = new File(destinationUri);
    destinationFile.create({ intermediates: true, overwrite: true });
    const destinationHandle = destinationFile.open();
    const totalSourceBytes = resolvedEntries.reduce((sum, entry) => sum + entry.size, 0);
    let completedSourceBytes = 0;
    let completed = false;

    try {
        let localOffset = 0;
        const centralParts: Uint8Array[] = [];

        for (const entry of resolvedEntries) {
            throwIfBackupCancelled(options?.signal);
            const localHeader = buildZipLocalHeader(entry.filenameBytes, entry.size, entry.checksum);
            destinationHandle.writeBytes(localHeader);

            if (entry.fileUri) {
                const sourceFile = new File(entry.fileUri);
                const sourceHandle = sourceFile.open();
                let writtenForEntry = 0;
                let bytesSinceYield = 0;
                const writtenCrc = new IncrementalCrc32();
                try {
                    while (true) {
                        throwIfBackupCancelled(options?.signal);
                        const chunk = sourceHandle.readBytes(ZIP_STREAM_CHUNK_BYTES);
                        if (chunk.length === 0) break;
                        destinationHandle.writeBytes(chunk);
                        writtenCrc.update(chunk);
                        writtenForEntry += chunk.length;
                        completedSourceBytes += chunk.length;
                        bytesSinceYield += chunk.length;
                        if (bytesSinceYield >= 2 * 1024 * 1024) {
                            reportBackupProgress(options, {
                                phase: "packaging",
                                completedBytes: completedSourceBytes,
                                totalBytes: totalSourceBytes,
                                message: "Packaging",
                            });
                            bytesSinceYield = 0;
                            await yieldToBackupUi(options?.signal);
                        }
                    }
                } finally {
                    sourceHandle.close();
                }
                if (writtenForEntry !== entry.size) {
                    throw new Error(`File changed while packaging archive: ${entry.archiveName}`);
                }
                if (entry.deferredCrc) {
                    // Patch the streamed CRC into the local header written above (CRC field
                    // lives at header offset 14); the central directory (built below from
                    // entry.checksum) gets the same value. Offsets are tracked deterministically.
                    entry.checksum = writtenCrc.digest();
                    destinationHandle.offset = localOffset + 14;
                    const crcBytes = new Uint8Array(4);
                    new DataView(crcBytes.buffer).setUint32(0, entry.checksum, true);
                    destinationHandle.writeBytes(crcBytes);
                    destinationHandle.offset = localOffset + localHeader.length + entry.size;
                } else if (writtenCrc.digest() !== entry.checksum) {
                    throw new Error(`File changed while packaging archive: ${entry.archiveName}`);
                }
            } else if (entry.data) {
                destinationHandle.writeBytes(entry.data);
                completedSourceBytes += entry.data.length;
            }

            centralParts.push(
                buildZipCentralHeader(entry.filenameBytes, entry.size, entry.checksum, localOffset)
            );
            localOffset += localHeader.length + entry.size;
        }

        const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
        for (const part of centralParts) {
            destinationHandle.writeBytes(part);
        }
        destinationHandle.writeBytes(
            buildZipEndRecord(resolvedEntries.length, centralDirectorySize, localOffset)
        );
        completed = true;
    } finally {
        destinationHandle.close();
        if (!completed) {
            await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => {});
        }
    }

    reportBackupProgress(options, {
        phase: "packaging",
        completedBytes: totalSourceBytes,
        totalBytes: totalSourceBytes,
        message: "Packaged",
    });
}
