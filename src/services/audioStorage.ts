import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { createAudioPlayer } from "expo-audio";
import { Platform, Share } from "react-native";
import { extractAudioAnalysis } from "@siteed/audio-studio";
import { buildDefaultIdeaTitle, buildStaticWaveform, metersToWaveformPeaks } from "../utils";
import { SONG_SEED_AUDIO_DIR, SONG_SEED_SHARE_DIR } from "./storagePaths";
import { cleanupShareTempFile } from "./managedMedia";

export const MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS = 30 * 60 * 1000;

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

function analysisToWaveformPeaks(analysis: { dataPoints: Array<{ dB: number; amplitude: number }> }) {
    const levelsAsDb = analysis.dataPoints.map((point) =>
        Number.isFinite(point.dB) ? point.dB : point.amplitude > 0 ? 20 * Math.log10(point.amplitude) : -60
    );

    return metersToWaveformPeaks(levelsAsDb, 96);
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

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) === 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[index] = value >>> 0;
    }
    return table;
})();

function crc32(bytes: Uint8Array) {
    let crc = 0xffffffff;
    for (let index = 0; index < bytes.length; index += 1) {
        crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function updateCrc32(crc: number, bytes: Uint8Array) {
    let nextCrc = crc;
    for (let index = 0; index < bytes.length; index += 1) {
        nextCrc = CRC32_TABLE[(nextCrc ^ bytes[index]) & 0xff] ^ (nextCrc >>> 8);
    }
    return nextCrc;
}

const ZIP_STREAM_CHUNK_BYTES = 64 * 1024;

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

export async function createZipArchive(destinationUri: string, entries: ZipArchiveEntry[]) {
    const resolvedEntries = await Promise.all(
        entries.map(async (entry) => {
            if (entry.directory) {
                const directoryName = entry.archiveName.endsWith("/") ? entry.archiveName : `${entry.archiveName}/`;
                return {
                    archiveName: directoryName,
                    filenameBytes: encodeUtf8(directoryName),
                    data: new Uint8Array(0),
                    checksum: 0,
                    size: 0,
                };
            }

            if (typeof entry.fileUri === "string") {
                const file = new File(entry.fileUri);
                const info = await FileSystem.getInfoAsync(entry.fileUri);
                if (!info.exists) {
                    throw new Error(`Missing file: ${entry.archiveName}`);
                }

                let crc = 0xffffffff;
                let size = 0;
                const handle = file.open();
                try {
                    while (true) {
                        const chunk = handle.readBytes(ZIP_STREAM_CHUNK_BYTES);
                        if (chunk.length === 0) break;
                        crc = updateCrc32(crc, chunk);
                        size += chunk.length;
                    }
                } finally {
                    handle.close();
                }

                return {
                    archiveName: entry.archiveName,
                    filenameBytes: encodeUtf8(entry.archiveName),
                    fileUri: entry.fileUri,
                    checksum: (crc ^ 0xffffffff) >>> 0,
                    size,
                };
            }

            let data: Uint8Array;
            if (typeof entry.data === "string") {
                data = encodeUtf8(entry.data);
            } else if (entry.data instanceof Uint8Array) {
                data = entry.data;
            } else {
                throw new Error(`No archive data for ${entry.archiveName}`);
            }

            return {
                archiveName: entry.archiveName,
                filenameBytes: encodeUtf8(entry.archiveName),
                data,
                checksum: crc32(data),
                size: data.length,
            };
        })
    );

    const destinationFile = new File(destinationUri);
    destinationFile.create({ intermediates: true, overwrite: true });
    const destinationHandle = destinationFile.open();

    try {
        let localOffset = 0;
        const centralParts: Uint8Array[] = [];

        for (const entry of resolvedEntries) {
            const localHeader = buildZipLocalHeader(entry.filenameBytes, entry.size, entry.checksum);
            destinationHandle.writeBytes(localHeader);

            if (entry.fileUri) {
                const sourceFile = new File(entry.fileUri);
                const sourceHandle = sourceFile.open();
                try {
                    while (true) {
                        const chunk = sourceHandle.readBytes(ZIP_STREAM_CHUNK_BYTES);
                        if (chunk.length === 0) break;
                        destinationHandle.writeBytes(chunk);
                    }
                } finally {
                    sourceHandle.close();
                }
            } else if (entry.data) {
                destinationHandle.writeBytes(entry.data);
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
    } finally {
        destinationHandle.close();
    }
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
    const durationMs = durationHint && durationHint > 0 ? durationHint : await loadAudioDurationMs(audioUri);

    // Batch imports intentionally skip detailed analysis so large imports do not
    // queue enough native work to get the app killed before any state is committed.
    if (options?.lightweight || (durationMs && durationMs > MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS)) {
        return {
            durationMs,
            waveformPeaks: buildStaticWaveform(`${seed}-${durationMs}`, 96),
            usedDetailedAnalysis: false,
        };
    }

    try {
        const analysis = await extractAudioAnalysis({ fileUri: audioUri });
        return {
            durationMs: analysis.durationMs,
            waveformPeaks: analysisToWaveformPeaks(analysis),
            usedDetailedAnalysis: true,
        };
    } catch {
        return {
            durationMs,
            waveformPeaks: buildStaticWaveform(`${seed}-${durationMs ?? 0}`, 96),
            usedDetailedAnalysis: false,
        };
    }
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

export async function importAudioAssets(
    assets: ImportedAudioAsset[],
    buildTargetId: (asset: ImportedAudioAsset, index: number) => string,
    onProgress?: (current: number, total: number, failed: number) => void,
    options?: AudioMetadataLoadOptions & {
        onImported?: (asset: ImportedManagedAudioAsset, index: number) => void;
    }
): Promise<{ imported: ImportedManagedAudioAsset[]; failed: AudioImportFailure[] }> {
    const imported: ImportedManagedAudioAsset[] = [];
    const failed: AudioImportFailure[] = [];

    for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index]!;
        const targetId = buildTargetId(asset, index);

        try {
            const managed = await importAudioAsset(asset, targetId, options);
            const importedAsset = {
                ...asset,
                ...managed,
                targetId,
            };
            imported.push(importedAsset);
            options?.onImported?.(importedAsset, index);
        } catch (error) {
            failed.push({ asset, error });
        }

        onProgress?.(index + 1, assets.length, failed.length);
    }

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
