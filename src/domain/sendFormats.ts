/**
 * What a SongNook Send parcel may carry: ONE list, read by every end (audit
 * 2026-11-02, 12h H-1). The app's sender (services/shareLink), the receiver
 * (services/receiveTransfer), the service's upload check
 * (server/songnook-send/src/lib/contentPolicy.ts) and the web sender page
 * (server/songnook-send/src/pages/sender.ts) all import it, so a parcel that
 * leaves one end is always one the other can open. Before, the sealed path let
 * .opus, .wma and MIDI files (all importable by share) and any audio/* from the
 * web page through, told the sender "Link ready", and the recipient's app
 * refused the whole parcel.
 *
 * Pure data, no imports: the Worker bundles this file as it is.
 */

/** Audio extensions every end accepts (lowercase, no dot). */
export const SEND_AUDIO_EXTENSIONS: readonly string[] = [
    "m4a",
    "mp3",
    "wav",
    "aac",
    "flac",
    "ogg",
    "oga",
    "aif",
    "aiff",
    "caf",
];

/** The SongNook package. */
export const SEND_ARCHIVE_EXTENSION = "songnook";

/** Mime types a package may declare (its insides are a zip). */
export const SEND_ARCHIVE_MIMES: readonly string[] = ["application/octet-stream", "application/zip"];

export function sendExtensionOf(fileName: string): string {
    const dot = fileName.lastIndexOf(".");
    return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

/**
 * The extension AND the declared mime must agree with an allowed family.
 * Octet-stream is accepted for audio: some pickers report it.
 */
export function isSendableFile(fileName: string, mimeType: string): boolean {
    const ext = sendExtensionOf(fileName);
    const mime = (mimeType || "").toLowerCase();
    if (ext === SEND_ARCHIVE_EXTENSION) return SEND_ARCHIVE_MIMES.includes(mime);
    if (SEND_AUDIO_EXTENSIONS.includes(ext)) return mime.startsWith("audio/") || mime === "application/octet-stream";
    return false;
}
