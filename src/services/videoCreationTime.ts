import { File } from "expo-file-system";

/** Seconds between the QuickTime epoch (1904-01-01) and the Unix epoch. */
const QUICKTIME_EPOCH_OFFSET_S = 2082844800;
/** Earliest believable recording time (2000-01-01). Cameras with no clock write 0. */
const EARLIEST_PLAUSIBLE_MS = Date.UTC(2000, 0, 1);
/** Top-level boxes walked before giving up (a real file has a handful). */
const MAX_BOXES = 64;

type Handle = ReturnType<File["open"]>;

function readAt(handle: Handle, offset: number, length: number): Uint8Array | null {
    handle.offset = offset;
    const bytes = handle.readBytes(length);
    return bytes.length === length ? bytes : null;
}

function view(bytes: Uint8Array) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function boxType(bytes: Uint8Array) {
    return String.fromCharCode(bytes[4]!, bytes[5]!, bytes[6]!, bytes[7]!);
}

/** One box header at `offset`: its type, where its content starts, where it ends. */
function readBox(handle: Handle, offset: number, limit: number) {
    const head = readAt(handle, offset, 8);
    if (!head) return null;
    const size32 = view(head).getUint32(0);
    let headerBytes = 8;
    let size = size32;
    if (size32 === 1) {
        const large = readAt(handle, offset + 8, 8);
        if (!large) return null;
        size = view(large).getUint32(0) * 2 ** 32 + view(large).getUint32(4);
        headerBytes = 16;
    } else if (size32 === 0) {
        size = limit - offset;
    }
    if (size < headerBytes || offset + size > limit) return null;
    return { type: boxType(head), contentStart: offset + headerBytes, end: offset + size };
}

function findChild(handle: Handle, start: number, end: number, type: string) {
    let offset = start;
    for (let i = 0; i < MAX_BOXES && offset + 8 <= end; i += 1) {
        const box = readBox(handle, offset, end);
        if (!box) return null;
        if (box.type === type) return box;
        offset = box.end;
    }
    return null;
}

/**
 * When a video was recorded, read from its own header (2026-10-20): the movie
 * header ("moov" > "mvhd") every phone camera and screen recorder writes. A
 * video handed over by the photo picker is a fresh copy, so its file date is
 * the moment of picking; this is the date the musician knows it by, and the
 * one the duplicate check needs. Plain JS over a few small reads, so it reaches
 * every build. Null when the file isn't an MP4/QuickTime movie or carries no
 * believable date.
 */
export function readVideoCreationTimeMs(uri: string): number | null {
    let handle: Handle | null = null;
    try {
        const file = new File(uri);
        if (!file.exists) return null;
        const size = file.size ?? 0;
        if (size < 16) return null;
        handle = file.open();
        const moov = findChild(handle, 0, size, "moov");
        if (!moov) return null;
        const mvhd = findChild(handle, moov.contentStart, moov.end, "mvhd");
        if (!mvhd) return null;
        const header = readAt(handle, mvhd.contentStart, 12);
        if (!header) return null;
        const version = header[0];
        const seconds =
            version === 1
                ? view(header).getUint32(4) * 2 ** 32 + view(header).getUint32(8)
                : view(header).getUint32(4);
        const ms = (seconds - QUICKTIME_EPOCH_OFFSET_S) * 1000;
        if (!Number.isFinite(ms) || ms < EARLIEST_PLAUSIBLE_MS || ms > Date.now() + 86_400_000) return null;
        return ms;
    } catch {
        return null;
    } finally {
        try {
            handle?.close();
        } catch {
            // Already closed.
        }
    }
}
