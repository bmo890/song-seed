import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { createAudioPlayer } from "expo-audio";
import { Platform, Share } from "react-native";
import { extractAudioAnalysis } from "@siteed/expo-audio-studio";
import { buildStaticWaveform, metersToWaveformPeaks } from "../utils";

const SONG_SEED_ROOT = `${FileSystem.documentDirectory ?? ""}songseed`;
const SONG_SEED_AUDIO_DIR = `${SONG_SEED_ROOT}/audio`;
const SONG_SEED_SHARE_DIR = `${SONG_SEED_ROOT}/share`;
export const MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS = 30 * 60 * 1000;

export type ImportedAudioAsset = {
    uri: string;
    name?: string;
    mimeType?: string | null;
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
                    filenameBytes: encodeUtf8(directoryName),
                    data: new Uint8Array(0),
                    checksum: 0,
                };
            }

            let data: Uint8Array;
            if (typeof entry.fileUri === "string") {
                const info = await FileSystem.getInfoAsync(entry.fileUri);
                if (!info.exists) {
                    throw new Error(`Missing file: ${entry.archiveName}`);
                }

                const base64 = await FileSystem.readAsStringAsync(entry.fileUri, {
                    encoding: FileSystem.EncodingType.Base64,
                });
                data = base64ToBytes(base64);
            } else if (typeof entry.data === "string") {
                data = encodeUtf8(entry.data);
            } else if (entry.data instanceof Uint8Array) {
                data = entry.data;
            } else {
                throw new Error(`No archive data for ${entry.archiveName}`);
            }

            const filenameBytes = encodeUtf8(entry.archiveName);
            const checksum = crc32(data);

            return {
                filenameBytes,
                data,
                checksum,
            };
        })
    );

    let localOffset = 0;
    const localParts: Uint8Array[] = [];
    const centralParts: Uint8Array[] = [];

    resolvedEntries.forEach((entry) => {
        const localHeader = buildZipLocalHeader(entry.filenameBytes, entry.data.length, entry.checksum);
        const centralHeader = buildZipCentralHeader(entry.filenameBytes, entry.data.length, entry.checksum, localOffset);

        localParts.push(localHeader, entry.data);
        centralParts.push(centralHeader);
        localOffset += localHeader.length + entry.data.length;
    });

    const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const endRecord = buildZipEndRecord(resolvedEntries.length, centralDirectorySize, localOffset);
    const totalSize =
        localParts.reduce((sum, part) => sum + part.length, 0) +
        centralDirectorySize +
        endRecord.length;
    const zipBytes = new Uint8Array(totalSize);

    let cursor = 0;
    [...localParts, ...centralParts, endRecord].forEach((part) => {
        zipBytes.set(part, cursor);
        cursor += part.length;
    });

    await FileSystem.writeAsStringAsync(destinationUri, bytesToBase64(zipBytes), {
        encoding: FileSystem.EncodingType.Base64,
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

export async function loadManagedAudioMetadata(audioUri: string, seed: string, durationHint?: number) {
    const durationMs = durationHint && durationHint > 0 ? durationHint : await loadAudioDurationMs(audioUri);

    if (durationMs && durationMs > MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS) {
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
        return `Imported Clip — ${new Date().toLocaleString("en-US", {
            month: "2-digit",
            day: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        })}`;
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

    return result.assets.map((asset) => ({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
    }));
}

export async function importAudioAsset(asset: ImportedAudioAsset, targetId: string): Promise<ManagedAudioResult> {
    await ensureAudioDirectory();

    const extension = getFileExtension(asset.name, asset.mimeType);
    const destinationUri = `${SONG_SEED_AUDIO_DIR}/${targetId}.${extension}`;

    if (asset.uri !== destinationUri) {
        await FileSystem.copyAsync({ from: asset.uri, to: destinationUri });
    }

    const metadata = await loadManagedAudioMetadata(destinationUri, `${targetId}-${asset.name ?? "imported"}`);

    return {
        audioUri: destinationUri,
        durationMs: metadata.durationMs,
        waveformPeaks: metadata.waveformPeaks,
    };
}

export async function importAudioAssets(
    assets: ImportedAudioAsset[],
    buildTargetId: (asset: ImportedAudioAsset, index: number) => string
): Promise<{ imported: ImportedManagedAudioAsset[]; failed: AudioImportFailure[] }> {
    const imported: ImportedManagedAudioAsset[] = [];
    const failed: AudioImportFailure[] = [];

    for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index]!;
        const targetId = buildTargetId(asset, index);

        try {
            const managed = await importAudioAsset(asset, targetId);
            imported.push({
                ...asset,
                ...managed,
                targetId,
            });
        } catch (error) {
            failed.push({ asset, error });
        }
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

    await FileSystem.copyAsync({ from: audioUri, to: shareUri });
    await shareFileUri(shareUri, title, getAudioShareMimeType(audioUri));
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

    await createZipArchive(archiveUri, archiveEntries);
    await shareFileUri(archiveUri, archiveTitle, "application/zip");
}
