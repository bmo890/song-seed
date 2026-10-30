/**
 * Unfinalized WAV headers (2026-10-18).
 *
 * The recorder writes a canonical WAV header the moment capture starts, with the
 * RIFF and `data` chunk sizes as placeholders (0), and patches them only when the
 * take is stopped. A take the OS killed mid-capture keeps every PCM byte on disk but
 * still carries the placeholder header, so every reader (the duration probe, the
 * waveform decoder, the player) sees a 0-second file. Recovery used to land those
 * takes as "0:00" clips with a flat waveform even though the audio was all there.
 *
 * This module reads a header and says how to finalize it from the file's real size.
 * It is pure: the caller reads the first bytes and writes the patch.
 */

/** Enough bytes to walk past `fmt ` and any LIST/JUNK chunk a writer puts first. */
export const WAV_HEADER_PROBE_BYTES = 4096;

const PLACEHOLDER_SIZES = new Set([0, 0xffffffff]);

export type WavHeaderPatch = {
    /** Byte offset and new little-endian u32 value for each field to rewrite. */
    writes: { offset: number; value: number }[];
    dataBytes: number;
    durationMs: number;
};

export type WavHeaderAssessment =
    /** Not a RIFF/WAVE file, or a header this module doesn't understand: leave it alone. */
    | { kind: "notWav" }
    /** Sizes already describe the audio. */
    | { kind: "finalized" }
    /** A header with no audio after it: nothing was captured. */
    | { kind: "empty" }
    /** Audio is present but the header doesn't say so. */
    | { kind: "unfinalized"; patch: WavHeaderPatch };

function ascii(bytes: Uint8Array, offset: number) {
    return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function u16(bytes: Uint8Array, offset: number) {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

export function encodeU32LE(value: number): Uint8Array {
    return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

/**
 * Judge a WAV header against the file it heads. `header` is the first bytes of the
 * file (at least up to the `data` chunk header); `fileSize` is the size on disk.
 */
export function assessWavHeader(header: Uint8Array, fileSize: number): WavHeaderAssessment {
    if (header.length < 12 || ascii(header, 0) !== "RIFF" || ascii(header, 8) !== "WAVE") {
        return { kind: "notWav" };
    }

    let blockAlign = 0;
    let byteRate = 0;
    let offset = 12;
    while (offset + 8 <= header.length) {
        const id = ascii(header, offset);
        const size = u32(header, offset + 4);
        if (id === "fmt ") {
            if (offset + 8 + 16 > header.length) return { kind: "notWav" };
            byteRate = u32(header, offset + 8 + 8);
            blockAlign = u16(header, offset + 8 + 12);
        } else if (id === "data") {
            if (!blockAlign || !byteRate) return { kind: "notWav" };
            const dataStart = offset + 8;
            const present = Math.max(0, fileSize - dataStart);
            const usable = present - (present % blockAlign);
            if (usable <= 0) return { kind: "empty" };
            // A placeholder size, or one that promises more audio than the file holds
            // (killed after a partial patch), is rewritten. A smaller honest size is
            // kept: bytes after it may be a trailing chunk.
            if (!PLACEHOLDER_SIZES.has(size) && size <= present) return { kind: "finalized" };
            return {
                kind: "unfinalized",
                patch: {
                    writes: [
                        { offset: 4, value: dataStart + usable - 8 },
                        { offset: offset + 4, value: usable },
                    ],
                    dataBytes: usable,
                    durationMs: Math.round((usable / byteRate) * 1000),
                },
            };
        }
        // Chunks are word-aligned: an odd size carries one pad byte.
        offset += 8 + size + (size % 2);
    }
    return { kind: "notWav" };
}

export type WavLayout = {
    /** Byte offset of the first sample, just past the `data` chunk header. */
    dataStart: number;
    /** Whole frames of audio present, in bytes. */
    dataBytes: number;
    sampleRate: number;
    channels: number;
    bitsPerSample: number;
    blockAlign: number;
    sampleFormat: "int" | "float";
};

/**
 * Where a WAV's samples are and how they are packed, for code that rewrites the
 * audio around them. Only linear PCM (16/24/32-bit int, 32-bit float, plain or
 * extensible) is described; anything else is null, so callers leave it alone.
 */
export function parseWavLayout(header: Uint8Array, fileSize: number): WavLayout | null {
    if (header.length < 12 || ascii(header, 0) !== "RIFF" || ascii(header, 8) !== "WAVE") return null;
    let format: Omit<WavLayout, "dataStart" | "dataBytes"> | null = null;
    let offset = 12;
    while (offset + 8 <= header.length) {
        const id = ascii(header, offset);
        const size = u32(header, offset + 4);
        if (id === "fmt ") {
            if (offset + 8 + 16 > header.length) return null;
            const body = offset + 8;
            let tag = u16(header, body);
            // WAVE_FORMAT_EXTENSIBLE: the real tag opens the sub-format GUID.
            if (tag === 0xfffe && size >= 40 && body + 26 <= header.length) tag = u16(header, body + 24);
            const channels = u16(header, body + 2);
            const sampleRate = u32(header, body + 4);
            const blockAlign = u16(header, body + 12);
            const bitsPerSample = u16(header, body + 14);
            const isInt = tag === 1 && [16, 24, 32].includes(bitsPerSample);
            const isFloat = tag === 3 && bitsPerSample === 32;
            if ((!isInt && !isFloat) || !channels || !sampleRate || blockAlign !== channels * (bitsPerSample / 8)) {
                return null;
            }
            format = { sampleRate, channels, bitsPerSample, blockAlign, sampleFormat: isFloat ? "float" : "int" };
        } else if (id === "data") {
            if (!format) return null;
            const dataStart = offset + 8;
            const present = Math.max(0, fileSize - dataStart);
            const declared = PLACEHOLDER_SIZES.has(size) || size > present ? present : size;
            return { ...format, dataStart, dataBytes: declared - (declared % format.blockAlign) };
        }
        offset += 8 + size + (size % 2);
    }
    return null;
}
