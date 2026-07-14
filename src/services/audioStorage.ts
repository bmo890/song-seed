import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { createAudioPlayer } from "expo-audio";
import { Platform, Share } from "react-native";
import { computeWaveformPeaks, computeWaveformWithNativeDuration, getNativeAudioDurationMs, type WaveformDecodeMode } from "./waveformAnalysis";
import { buildDefaultIdeaTitle, buildStaticWaveform } from "../utils";
import { SONG_SEED_AUDIO_DIR, SONG_SEED_PREVIEW_AUDIO_DIR, SONG_SEED_SHARE_DIR } from "./storagePaths";
import { cleanupShareTempFile } from "./managedMedia";
import {
    reportBackupProgress,
    throwIfBackupCancelled,
    yieldToBackupUi,
    type BackupOperationOptions,
} from "./backupOperation";
import { IncrementalCrc32 } from "./streamingIntegrity";

export const MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS = 30 * 60 * 1000;
export const MANAGED_WAVEFORM_PEAK_COUNT = 256;

/**
 * Placeholder waveform resolution for freshly imported clips. Deliberately BELOW
 * MANAGED_WAVEFORM_PEAK_COUNT: the app treats a full-resolution waveform (length >=
 * MANAGED_WAVEFORM_PEAK_COUNT) as "already analyzed" — both the player-open repair
 * (usePlayerScreenLifecycle) and the launch backfill (backgroundWaveformHydration)
 * key off that. A full-resolution PLACEHOLDER would masquerade as a real waveform and,
 * if the app is killed before background analysis lands, permanently starve the clip of
 * its real waveform. A sub-resolution placeholder still renders an envelope on the card
 * (the reel/minimap downsample any length) while staying detectable as "needs analysis".
 */
export const IMPORT_PLACEHOLDER_WAVEFORM_PEAK_COUNT = 128;

export type ImportedAudioAsset = {
    uri: string;
    name?: string;
    mimeType?: string | null;
    sourceCreatedAt?: number;
    sourceCreatedAtSource?: "document-picker-last-modified" | "file-modification-time";
};

type ManagedAudioResult = {
    audioUri: string;
    durationMs?: number;
    waveformPeaks?: number[];
};

export type ImportedManagedAudioAsset = ImportedAudioAsset &
    ManagedAudioResult & {
        targetId: string;
    };

type AudioMetadataLoadOptions = {
    lightweight?: boolean;
    /** "interactive" when the user is actively waiting on this metadata (editor
     *  save/export, player-open hydration): the decode then runs immediately and
     *  cannot be preempted by playback. Defaults to "background" (idle-gated,
     *  cancellable; callers must treat placeholder results as retryable). */
    decodeMode?: WaveformDecodeMode;
};

export type AudioImportFailure = {
    asset: ImportedAudioAsset;
    error: unknown;
};

export type ShareableAudioClip = {
    title: string;
    audioUri: string;
};

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

const MIN_PLAUSIBLE_EXTERNAL_TIMESTAMP = Date.UTC(1990, 0, 1);
const MAX_EXTERNAL_TIMESTAMP_DRIFT_MS = 24 * 60 * 60 * 1000;

function normalizeExternalTimestamp(timestamp: number | null | undefined) {
    if (!Number.isFinite(timestamp)) return undefined;

    let normalized = Number(timestamp);

    if (normalized > 0 && normalized < 1e12) {
        normalized *= 1000;
    }

    normalized = Math.round(normalized);

    if (
        normalized < MIN_PLAUSIBLE_EXTERNAL_TIMESTAMP ||
        normalized > Date.now() + MAX_EXTERNAL_TIMESTAMP_DRIFT_MS
    ) {
        return undefined;
    }

    return normalized;
}

export async function enrichImportedAudioAsset(
    asset: Pick<ImportedAudioAsset, "uri" | "name" | "mimeType">,
    options?: {
        lastModified?: number | null;
        sourceHint?: ImportedAudioAsset["sourceCreatedAtSource"];
    }
): Promise<ImportedAudioAsset> {
    const explicitSourceCreatedAt = normalizeExternalTimestamp(options?.lastModified);
    if (explicitSourceCreatedAt) {
        return {
            ...asset,
            sourceCreatedAt: explicitSourceCreatedAt,
            sourceCreatedAtSource: options?.sourceHint ?? "document-picker-last-modified",
        };
    }

    try {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if ("exists" in info && info.exists && "modificationTime" in info) {
            const sourceCreatedAt = normalizeExternalTimestamp(info.modificationTime);
            if (sourceCreatedAt) {
                return {
                    ...asset,
                    sourceCreatedAt,
                    sourceCreatedAtSource: "file-modification-time",
                };
            }
        }
    } catch {
        // Some external providers do not expose file metadata through Expo FS.
    }

    return { ...asset };
}

type ExpoSharingModule = {
    isAvailableAsync: () => Promise<boolean>;
    shareAsync: (
        url: string,
        options?: {
            dialogTitle?: string;
            mimeType?: string;
            UTI?: string;
        }
    ) => Promise<void>;
};

function getExpoSharingModule(): ExpoSharingModule | null {
    try {
        const candidate = require("expo-sharing") as ExpoSharingModule;
        return candidate;
    } catch {
        return null;
    }
}

function getAudioShareMimeType(audioUri: string) {
    const lower = audioUri.toLowerCase();
    if (lower.endsWith(".wav")) return "audio/wav";
    if (lower.endsWith(".mp3")) return "audio/mpeg";
    if (lower.endsWith(".m4a")) return "audio/mp4";
    if (lower.endsWith(".aac")) return "audio/aac";
    if (lower.endsWith(".ogg")) return "audio/ogg";
    return "audio/*";
}

export function getArchiveFileExtension(audioUri: string) {
    const match = audioUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match?.[1]?.toLowerCase() ?? "m4a";
}

export function sanitizeArchiveSegment(value: string) {
    const normalized = value
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return normalized || "Clip";
}

export function buildTimestampSlug() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}${mm}${dd}-${hh}${min}`;
}

function encodeUtf8(value: string) {
    return new TextEncoder().encode(value);
}

function base64ToBytes(base64: string) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const clean = base64.replace(/[^A-Za-z0-9+/=]/g, "");
    let buffer = 0;
    let bits = 0;
    const output: number[] = [];

    for (const char of clean) {
        if (char === "=") break;
        const index = alphabet.indexOf(char);
        if (index < 0) continue;
        buffer = (buffer << 6) | index;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            output.push((buffer >> bits) & 0xff);
        }
    }

    return Uint8Array.from(output);
}

function bytesToBase64(bytes: Uint8Array) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let output = "";

    for (let index = 0; index < bytes.length; index += 3) {
        const a = bytes[index] ?? 0;
        const b = bytes[index + 1] ?? 0;
        const c = bytes[index + 2] ?? 0;
        const chunk = (a << 16) | (b << 8) | c;

        output += alphabet[(chunk >> 18) & 0x3f];
        output += alphabet[(chunk >> 12) & 0x3f];
        output += index + 1 < bytes.length ? alphabet[(chunk >> 6) & 0x3f] : "=";
        output += index + 2 < bytes.length ? alphabet[chunk & 0x3f] : "=";
    }

    return output;
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

export async function ensureShareDirectory() {
    if (!FileSystem.documentDirectory) {
        throw new Error("Document directory unavailable.");
    }

    const info = await FileSystem.getInfoAsync(SONG_SEED_SHARE_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(SONG_SEED_SHARE_DIR, { intermediates: true });
    }
}

export async function shareFileUri(fileUri: string, title: string, mimeType: string) {
    const expoSharing = getExpoSharingModule();

    if (expoSharing) {
        const isAvailable = await expoSharing.isAvailableAsync();
        if (!isAvailable) {
            throw new Error("Native file sharing is unavailable on this device.");
        }

        await expoSharing.shareAsync(fileUri, {
            dialogTitle: title,
            mimeType,
        });
        return;
    }

    if (Platform.OS === "android") {
        throw new Error("This Android build does not include native file sharing. Install expo-sharing and rebuild the app.");
    }

    await Share.share(
        {
            title,
            url: fileUri,
        },
        {
            subject: title,
        }
    );
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

export async function loadAudioDurationMs(audioUri: string, timeoutMs = 5000): Promise<number | undefined> {
    const player = createAudioPlayer({ uri: audioUri }, { updateInterval: 250 });

    return await new Promise((resolve) => {
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let subscription: { remove: () => void } | null = null;

        const readDurationMs = (durationSeconds?: number) => {
            const duration = durationSeconds ?? player.duration ?? player.currentStatus?.duration ?? 0;
            const durationMs = Math.round(duration * 1000);
            return durationMs > 0 ? durationMs : undefined;
        };

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            try {
                subscription?.remove();
            } catch {
                // Ignore shared object cleanup noise.
            }
            try {
                player.remove();
            } catch {
                // Ignore already released player cleanup.
            }
        };

        const settle = (durationSeconds?: number) => {
            if (settled) return;
            settled = true;
            const durationMs = readDurationMs(durationSeconds);
            cleanup();
            resolve(durationMs);
        };

        const trySettle = (durationSeconds?: number) => {
            const durationMs = readDurationMs(durationSeconds);
            if (durationMs) {
                settle(durationSeconds);
            }
        };

        subscription = player.addListener("playbackStatusUpdate", (status) => {
            trySettle(status.duration);
        });

        trySettle();
        timeoutId = setTimeout(() => settle(), timeoutMs);
    });
}

export async function loadManagedAudioMetadata(
    audioUri: string,
    seed: string,
    durationHint?: number,
    options?: AudioMetadataLoadOptions
) {
    // Lightweight (batch import) skips the expensive waveform DECODE, but still fills
    // the duration via a cheap native container-metadata probe (no PCM decode, no
    // AVPlayer/MediaPlayer item load — ~ms per file). It reads the same KEY_DURATION /
    // AVAsset.duration the background decoder later reports, so the clip's length is
    // correct the moment its card appears and never shifts when the waveform lands.
    // Falls back to undefined when the native method is absent (older build / web):
    // background hydration then derives the duration afterward, exactly as before.
    if (options?.lightweight) {
        const probedDurationMs =
            durationHint && durationHint > 0
                ? durationHint
                : await getNativeAudioDurationMs(audioUri);
        return {
            durationMs: probedDurationMs && probedDurationMs > 0 ? probedDurationMs : undefined,
            // Sub-resolution placeholder: a real duration on the card, but a waveform the
            // "hydrated?" checks (player-open repair + launch backfill) still recognize as
            // pending — so a restart mid-import can't strand the clip on a fake waveform.
            waveformPeaks: buildStaticWaveform(`${seed}-pending`, IMPORT_PLACEHOLDER_WAVEFORM_PEAK_COUNT),
            usedDetailedAnalysis: false,
        };
    }

    let durationMs = durationHint && durationHint > 0 ? durationHint : await loadAudioDurationMs(audioUri);

    if (durationMs && durationMs > MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS) {
        return {
            durationMs,
            waveformPeaks: buildStaticWaveform(`${seed}-${durationMs}`, MANAGED_WAVEFORM_PEAK_COUNT),
            usedDetailedAnalysis: false,
        };
    }

    try {
        if (durationMs && durationMs > 0) {
            const peaks = await computeWaveformPeaks(audioUri, MANAGED_WAVEFORM_PEAK_COUNT, durationMs, {
                mode: options?.decodeMode,
            });
            if (peaks.length) {
                return {
                    durationMs,
                    waveformPeaks: peaks,
                    usedDetailedAnalysis: true,
                };
            }
        } else {
            // The expo-audio duration probe failed (it silently times out after 5s on a
            // busy device). The native decoder reads the duration from the container for
            // free while decoding — without this path, a clip whose one probe attempt
            // failed stayed at "0:00" until it was played.
            const nativeResult = await computeWaveformWithNativeDuration(
                audioUri,
                MANAGED_WAVEFORM_PEAK_COUNT,
                { mode: options?.decodeMode }
            );
            if (nativeResult.durationMs && nativeResult.durationMs > 0) {
                durationMs = nativeResult.durationMs;
                if (nativeResult.peaks.length && durationMs <= MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS) {
                    return {
                        durationMs,
                        waveformPeaks: nativeResult.peaks,
                        usedDetailedAnalysis: true,
                    };
                }
            }
        }
    } catch {
        // fall through to the deterministic placeholder below
    }

    return {
        durationMs,
        waveformPeaks: buildStaticWaveform(`${seed}-${durationMs ?? 0}`, MANAGED_WAVEFORM_PEAK_COUNT),
        usedDetailedAnalysis: false,
    };
}

function getFileExtension(name?: string, mimeType?: string | null) {
    const byName = name?.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
    if (byName) return byName;

    switch (mimeType) {
        case "audio/mpeg":
            return "mp3";
        case "audio/mp4":
        case "audio/x-m4a":
            return "m4a";
        case "audio/wav":
        case "audio/x-wav":
            return "wav";
        case "audio/aac":
            return "aac";
        case "audio/flac":
            return "flac";
        case "audio/ogg":
            return "ogg";
        default:
            return "m4a";
    }
}

export function buildImportedTitle(sourceName?: string) {
    const trimmed = sourceName?.trim();
    if (!trimmed) {
        return `Import ${buildDefaultIdeaTitle()}`;
    }

    const withoutExtension = trimmed.replace(/\.[^./\\]+$/, "").trim();
    return withoutExtension || trimmed;
}

async function ensureAudioDirectory() {
    if (!FileSystem.documentDirectory) {
        throw new Error("Document directory unavailable.");
    }

    const info = await FileSystem.getInfoAsync(SONG_SEED_AUDIO_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(SONG_SEED_AUDIO_DIR, { intermediates: true });
    }
}

export async function ensurePreviewAudioDirectory() {
    if (!FileSystem.documentDirectory) {
        throw new Error("Document directory unavailable.");
    }

    const info = await FileSystem.getInfoAsync(SONG_SEED_PREVIEW_AUDIO_DIR);
    if (!info.exists) {
        await FileSystem.makeDirectoryAsync(SONG_SEED_PREVIEW_AUDIO_DIR, { intermediates: true });
    }
}

export async function pickSingleAudioFile(): Promise<ImportedAudioAsset | null> {
    const assets = await pickAudioFiles({ multiple: false });
    return assets[0] ?? null;
}

export async function pickAudioFiles(options?: { multiple?: boolean }): Promise<ImportedAudioAsset[]> {
    const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        multiple: options?.multiple ?? false,
        copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets.length) {
        return [];
    }

    return Promise.all(
        result.assets.map((asset) =>
            enrichImportedAudioAsset(
                {
                    uri: asset.uri,
                    name: asset.name,
                    mimeType: asset.mimeType,
                },
                {
                    lastModified: asset.lastModified,
                    sourceHint: "document-picker-last-modified",
                }
            )
        )
    );
}

/**
 * __DEV__ ONLY. The iOS Simulator can't reach the system document picker, so
 * automated import tests read audio from `Documents/dev-samples/` instead (push
 * files there with `xcrun simctl get_app_container`). Returns them as import
 * assets so the real import pipeline can run unchanged, minus the OS picker.
 * Always returns [] in production builds.
 */
export async function listDevSampleAudioAssets(): Promise<ImportedAudioAsset[]> {
    if (!__DEV__ || !FileSystem.documentDirectory) return [];
    const dir = `${FileSystem.documentDirectory}dev-samples`;
    try {
        const info = await FileSystem.getInfoAsync(dir);
        if (!("exists" in info) || !info.exists) return [];
        const names = await FileSystem.readDirectoryAsync(dir);
        const audio = names
            .filter((name) => /\.(m4a|mp3|wav|aac|caf|aiff?)$/i.test(name))
            .sort();
        return Promise.all(
            audio.map((name) =>
                enrichImportedAudioAsset(
                    { uri: `${dir}/${name}`, name, mimeType: "audio/x-m4a" },
                    { sourceHint: "file-modification-time" }
                )
            )
        );
    } catch (error) {
        console.warn("listDevSampleAudioAssets failed", error);
        return [];
    }
}

export async function importAudioAsset(
    asset: ImportedAudioAsset,
    targetId: string,
    options?: AudioMetadataLoadOptions
): Promise<ManagedAudioResult> {
    await ensureAudioDirectory();

    const extension = getFileExtension(asset.name, asset.mimeType);
    const destinationUri = `${SONG_SEED_AUDIO_DIR}/${targetId}.${extension}`;
    const copiedToManagedStorage = asset.uri !== destinationUri;

    try {
        if (copiedToManagedStorage) {
            await FileSystem.copyAsync({ from: asset.uri, to: destinationUri });
        }

        const metadata = await loadManagedAudioMetadata(
            destinationUri,
            `${targetId}-${asset.name ?? "imported"}`,
            undefined,
            options
        );

        return {
            audioUri: destinationUri,
            durationMs: metadata.durationMs,
            waveformPeaks: metadata.waveformPeaks,
        };
    } catch (error) {
        // Remove partially imported managed files so failed imports do not silently accumulate
        // orphaned audio that the store never referenced.
        if (copiedToManagedStorage) {
            await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => {});
        }
        throw error;
    }
}

// How many file imports run at once. Each import is I/O-bound (a file copy), so a
// small pool overlaps the copies without flooding the filesystem bridge. Serial was
// the other dominant cost of large imports (100 files = 100 round trips end-to-end).
const IMPORT_CONCURRENCY = 4;

export async function importAudioAssets(
    assets: ImportedAudioAsset[],
    buildTargetId: (asset: ImportedAudioAsset, index: number) => string,
    onProgress?: (current: number, total: number, failed: number) => void,
    options?: AudioMetadataLoadOptions & {
        onImported?: (asset: ImportedManagedAudioAsset, index: number) => void;
    }
): Promise<{ imported: ImportedManagedAudioAsset[]; failed: AudioImportFailure[] }> {
    // Index-addressed slots keep the results in the caller's order (project-mode
    // pairs clips with per-asset date metadata by index) even though completion
    // order is arbitrary.
    const importedSlots: (ImportedManagedAudioAsset | null)[] = new Array(assets.length).fill(null);
    const failed: AudioImportFailure[] = [];
    let completed = 0;
    let nextIndex = 0;

    const runWorker = async () => {
        while (nextIndex < assets.length) {
            const index = nextIndex;
            nextIndex += 1;
            const asset = assets[index]!;
            const targetId = buildTargetId(asset, index);

            try {
                const managed = await importAudioAsset(asset, targetId, options);
                const importedAsset = {
                    ...asset,
                    ...managed,
                    targetId,
                };
                importedSlots[index] = importedAsset;
                options?.onImported?.(importedAsset, index);
            } catch (error) {
                failed.push({ asset, error });
            }

            completed += 1;
            onProgress?.(completed, assets.length, failed.length);
        }
    };

    const workerCount = Math.max(1, Math.min(IMPORT_CONCURRENCY, assets.length));
    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    const imported = importedSlots.filter(
        (slot): slot is ImportedManagedAudioAsset => slot !== null
    );
    return { imported, failed };
}

export async function importRecordedAudioAsset(recordingUri: string, targetId: string): Promise<ManagedAudioResult> {
    const filename = recordingUri.split("/").pop() || `${targetId}.m4a`;
    return importAudioAsset(
        {
            uri: recordingUri,
            name: filename,
            mimeType: "audio/mp4",
        },
        targetId
    );
}

export async function shareAudioFile(audioUri: string, title: string) {
    const info = await FileSystem.getInfoAsync(audioUri);
    if (!info.exists) {
        throw new Error("File not found.");
    }

    await ensureShareDirectory();

    const extension = getArchiveFileExtension(audioUri);
    const baseName = sanitizeArchiveSegment(title || "Clip");
    const shareUri = `${SONG_SEED_SHARE_DIR}/${baseName} ${buildTimestampSlug()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;

    try {
        await FileSystem.copyAsync({ from: audioUri, to: shareUri });
        await shareFileUri(shareUri, title, getAudioShareMimeType(audioUri));
    } finally {
        await cleanupShareTempFile(shareUri);
    }
}

export async function shareAudioClips(clips: ShareableAudioClip[], bundleLabel = "SongSeed Clips") {
    if (clips.length === 0) {
        throw new Error("No audio clips selected to share.");
    }

    if (clips.length === 1) {
        const [clip] = clips;
        await shareAudioFile(clip.audioUri, clip.title);
        return;
    }

    await ensureShareDirectory();

    const usedNames = new Set<string>();
    const archiveEntries: ZipArchiveEntry[] = clips.map((clip, index) => {
        const baseName = sanitizeArchiveSegment(clip.title);
        const extension = getArchiveFileExtension(clip.audioUri);
        let archiveName = `${baseName}.${extension}`;
        let suffix = 2;

        while (usedNames.has(archiveName)) {
            archiveName = `${baseName} ${suffix}.${extension}`;
            suffix += 1;
        }

        usedNames.add(archiveName);

        return {
            archiveName,
            fileUri: clip.audioUri,
        };
    });

    const archiveTitle = `${sanitizeArchiveSegment(bundleLabel)} ${buildTimestampSlug()}`;
    const archiveUri = `${SONG_SEED_SHARE_DIR}/${archiveTitle}.zip`;

    try {
        await createZipArchive(archiveUri, archiveEntries);
        await shareFileUri(archiveUri, archiveTitle, "application/zip");
    } finally {
        await cleanupShareTempFile(archiveUri);
    }
}
