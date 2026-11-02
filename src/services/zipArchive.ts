import * as FileSystem from "expo-file-system/legacy";
import { i18n } from "../i18n/instance";
import { File } from "expo-file-system";
import {
    BackupOperationCancelledError,
    reportBackupProgress,
    throwIfBackupCancelled,
    yieldToBackupUi,
    type BackupOperationOptions,
} from "./backupOperation";
import { IncrementalCrc32 } from "./streamingIntegrity";
import {
    NATIVE_IO_CANCELLED,
    NativeZipWriter,
    isNativeZip64Available,
    isNativeZipAvailable,
} from "../../modules/songnook-file-io";

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
const ZIP64_EXTRA_ID = 0x0001;
const TWO_POW_32 = 0x100000000;

/*
 * Zip64 (audit 2026-11-02 G1): a library past 4 GB used to be refused outright. Any
 * entry whose size or offset reaches the 32-bit ceiling, and any archive whose
 * directory does, now carries the standard Zip64 records (APPNOTE 4.3.14, 4.5.3):
 *   - local header: sizes 0xFFFFFFFF + a 0x0001 extra holding both 64-bit sizes;
 *   - central header: sizes AND offset 0xFFFFFFFF + a 0x0001 extra holding all three;
 *   - after the directory: the Zip64 end record and its locator, then the classic end
 *     record with every overflowing field saturated.
 * Archives under 4 GB are byte-for-byte what they always were. The native writers in
 * modules/songnook-file-io follow the same rules.
 */
export function needsZip64Value(value: number) {
    return value >= ZIP32_MAX_VALUE;
}

function setUint64(view: DataView, offset: number, value: number) {
    view.setUint32(offset, value % TWO_POW_32, true);
    view.setUint32(offset + 4, Math.floor(value / TWO_POW_32), true);
}

/** Size of one entry's local header + name (+ Zip64 extra when its size needs it). */
export function zipLocalHeaderBytes(nameLength: number, zip64: boolean) {
    return 30 + nameLength + (zip64 ? 20 : 0);
}

/** Size of one entry's central header + name (+ Zip64 extra when it needs one). */
export function zipCentralHeaderBytes(nameLength: number, zip64: boolean) {
    return 46 + nameLength + (zip64 ? 28 : 0);
}

/** Zip64 end record + locator, written after the directory when the archive needs them. */
export const ZIP64_END_BYTES = 56 + 20;

function buildZipLocalHeader(filenameBytes: Uint8Array, size: number, checksum: number, zip64 = false) {
    const header = new Uint8Array(zipLocalHeaderBytes(filenameBytes.length, zip64));
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, zip64 ? 45 : 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, checksum, true);
    view.setUint32(18, zip64 ? ZIP32_MAX_VALUE : size, true);
    view.setUint32(22, zip64 ? ZIP32_MAX_VALUE : size, true);
    view.setUint16(26, filenameBytes.length, true);
    view.setUint16(28, zip64 ? 20 : 0, true);
    header.set(filenameBytes, 30);
    if (zip64) {
        const extra = 30 + filenameBytes.length;
        view.setUint16(extra, ZIP64_EXTRA_ID, true);
        view.setUint16(extra + 2, 16, true);
        setUint64(view, extra + 4, size);
        setUint64(view, extra + 12, size);
    }

    return header;
}

function buildZipCentralHeader(
    filenameBytes: Uint8Array,
    size: number,
    checksum: number,
    localOffset: number,
    zip64 = false
) {
    const header = new Uint8Array(zipCentralHeaderBytes(filenameBytes.length, zip64));
    const view = new DataView(header.buffer);

    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, zip64 ? 45 : 20, true);
    view.setUint16(6, zip64 ? 45 : 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, checksum, true);
    view.setUint32(20, zip64 ? ZIP32_MAX_VALUE : size, true);
    view.setUint32(24, zip64 ? ZIP32_MAX_VALUE : size, true);
    view.setUint16(28, filenameBytes.length, true);
    view.setUint16(30, zip64 ? 28 : 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, zip64 ? ZIP32_MAX_VALUE : localOffset, true);
    header.set(filenameBytes, 46);
    if (zip64) {
        const extra = 46 + filenameBytes.length;
        view.setUint16(extra, ZIP64_EXTRA_ID, true);
        view.setUint16(extra + 2, 24, true);
        setUint64(view, extra + 4, size);
        setUint64(view, extra + 12, size);
        setUint64(view, extra + 20, localOffset);
    }

    return header;
}

/** Whether the archive's tail needs the Zip64 end record. */
export function zipNeedsZip64End(entryCount: number, centralDirectorySize: number, centralDirectoryOffset: number) {
    return (
        entryCount >= ZIP32_MAX_ENTRIES ||
        needsZip64Value(centralDirectorySize) ||
        needsZip64Value(centralDirectoryOffset)
    );
}

function buildZipEndRecord(
    entryCount: number,
    centralDirectorySize: number,
    centralDirectoryOffset: number,
    forceZip64 = false
) {
    const zip64 = forceZip64 || zipNeedsZip64End(entryCount, centralDirectorySize, centralDirectoryOffset);
    const record = new Uint8Array((zip64 ? ZIP64_END_BYTES : 0) + 22);
    const view = new DataView(record.buffer);
    let at = 0;
    if (zip64) {
        const zip64EndOffset = centralDirectoryOffset + centralDirectorySize;
        view.setUint32(0, 0x06064b50, true);
        setUint64(view, 4, 44);
        view.setUint16(12, 45, true);
        view.setUint16(14, 45, true);
        view.setUint32(16, 0, true);
        view.setUint32(20, 0, true);
        setUint64(view, 24, entryCount);
        setUint64(view, 32, entryCount);
        setUint64(view, 40, centralDirectorySize);
        setUint64(view, 48, centralDirectoryOffset);
        view.setUint32(56, 0x07064b50, true);
        view.setUint32(60, 0, true);
        setUint64(view, 64, zip64EndOffset);
        view.setUint32(72, 1, true);
        at = ZIP64_END_BYTES;
    }

    view.setUint32(at, 0x06054b50, true);
    view.setUint16(at + 4, 0, true);
    view.setUint16(at + 6, 0, true);
    view.setUint16(at + 8, zip64 ? ZIP32_MAX_ENTRIES : entryCount, true);
    view.setUint16(at + 10, zip64 ? ZIP32_MAX_ENTRIES : entryCount, true);
    view.setUint32(at + 12, zip64 ? ZIP32_MAX_VALUE : centralDirectorySize, true);
    view.setUint32(at + 16, zip64 ? ZIP32_MAX_VALUE : centralDirectoryOffset, true);
    view.setUint16(at + 20, 0, true);

    return record;
}

/** Whole-archive byte count for a stored zip, Zip64 records included where needed. */
export function projectStoredZipBytes(entries: Array<{ nameLength: number; size: number }>, forceZip64 = false) {
    let offset = 0;
    let central = 0;
    for (const entry of entries) {
        const entryZip64 = forceZip64 || needsZip64Value(entry.size) || needsZip64Value(offset);
        central += zipCentralHeaderBytes(entry.nameLength, entryZip64);
        offset += zipLocalHeaderBytes(entry.nameLength, forceZip64 || needsZip64Value(entry.size)) + entry.size;
    }
    const tail = forceZip64 || zipNeedsZip64End(entries.length, central, offset) ? ZIP64_END_BYTES + 22 : 22;
    return offset + central + tail;
}

export async function createZipArchive(
    destinationUri: string,
    entries: ZipArchiveEntry[],
    options?: BackupOperationOptions & {
        /** Tests only: write Zip64 records for every entry, as a > 4 GB archive would. */
        forceZip64?: boolean;
    }
) {
    const forceZip64 = options?.forceZip64 === true;
    const resolvedEntries: Array<{
        archiveName: string;
        filenameBytes: Uint8Array;
        data?: Uint8Array;
        /** The entry's text when it was given as a string (sent natively without a base64 trip). */
        text?: string;
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
            text: typeof entry.data === "string" ? entry.data : undefined,
            checksum: isNativeZipAvailable() ? 0 : crc32(data),
            size: data.length,
        });
    }

    for (const entry of resolvedEntries) {
        if (!Number.isSafeInteger(entry.size) || entry.size < 0) {
            throw new Error(`Could not determine file size for ${entry.archiveName}`);
        }
    }
    const projectedBytes = projectStoredZipBytes(
        resolvedEntries.map((entry) => ({ nameLength: entry.filenameBytes.length, size: entry.size })),
        forceZip64
    );
    const needsZip64 = forceZip64 || needsZip64Value(projectedBytes) || resolvedEntries.length >= ZIP32_MAX_ENTRIES;

    // Builds whose native writer predates Zip64 take the JS path for a > 4 GB archive.
    if (isNativeZipAvailable() && !forceZip64 && (!needsZip64 || isNativeZip64Available())) {
        await writeZipNatively(destinationUri, resolvedEntries, options);
        return;
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
            const localZip64 = forceZip64 || needsZip64Value(entry.size);
            const centralZip64 = localZip64 || needsZip64Value(localOffset);
            const localHeader = buildZipLocalHeader(entry.filenameBytes, entry.size, entry.checksum, localZip64);
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
                                message: i18n.t("process.packaging"),
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
                buildZipCentralHeader(entry.filenameBytes, entry.size, entry.checksum, localOffset, centralZip64)
            );
            localOffset += localHeader.length + entry.size;
        }

        const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
        for (const part of centralParts) {
            destinationHandle.writeBytes(part);
        }
        destinationHandle.writeBytes(
            buildZipEndRecord(resolvedEntries.length, centralDirectorySize, localOffset, forceZip64)
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
        message: i18n.t("process.packaged"),
    });
}

/** Base64 of raw bytes, for the rare binary data entry handed to the native writer. */
function bytesToBase64(bytes: Uint8Array) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
}

/** A native cancellation (or an aborted signal) surfaces as the backup's own cancel error. */
export function rethrowNativeCancel(error: unknown, signal?: AbortSignal): never {
    if (signal?.aborted || (error instanceof Error && error.message === NATIVE_IO_CANCELLED)) {
        throw new BackupOperationCancelledError();
    }
    throw error;
}

/**
 * The same archive, written by native code (2026-10-20): each file is read once and
 * streamed into the zip with its CRC computed on the way, instead of four trips of every
 * byte through JavaScript. Byte-identical layout to the JS writer above.
 */
async function writeZipNatively(
    destinationUri: string,
    entries: Array<{
        archiveName: string;
        data?: Uint8Array;
        text?: string;
        fileUri?: string;
        checksum: number;
        deferredCrc?: boolean;
        size: number;
    }>,
    options?: BackupOperationOptions
) {
    const totalSourceBytes = entries.reduce((sum, entry) => sum + entry.size, 0);
    let completedSourceBytes = 0;
    const writer = await NativeZipWriter.create(destinationUri);
    let finished = false;
    try {
        for (const entry of entries) {
            throwIfBackupCancelled(options?.signal);
            if (entry.fileUri) {
                const before = completedSourceBytes;
                const written = await writer.addFile(entry.archiveName, entry.fileUri, {
                    expectedSizeBytes: entry.size,
                    signal: options?.signal,
                    onProgress: ({ completedBytes }) =>
                        reportBackupProgress(options, {
                            phase: "packaging",
                            completedBytes: before + completedBytes,
                            totalBytes: totalSourceBytes,
                            message: i18n.t("process.packaging"),
                        }),
                });
                if (!entry.deferredCrc && written.crc32 !== entry.checksum >>> 0) {
                    throw new Error(`File changed while packaging archive: ${entry.archiveName}`);
                }
            } else if (entry.text !== undefined) {
                await writer.addText(entry.archiveName, entry.text);
            } else {
                await writer.addBase64(entry.archiveName, bytesToBase64(entry.data ?? new Uint8Array(0)));
            }
            completedSourceBytes += entry.size;
            reportBackupProgress(options, {
                phase: "packaging",
                completedBytes: completedSourceBytes,
                totalBytes: totalSourceBytes,
                message: i18n.t("process.packaging"),
            });
        }
        await writer.finish();
        finished = true;
    } catch (error) {
        rethrowNativeCancel(error, options?.signal);
    } finally {
        if (!finished) await writer.abort();
    }
    reportBackupProgress(options, {
        phase: "packaging",
        completedBytes: totalSourceBytes,
        totalBytes: totalSourceBytes,
        message: i18n.t("process.packaged"),
    });
}
