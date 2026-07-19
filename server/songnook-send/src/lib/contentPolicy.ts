/**
 * What may be uploaded. Enforced SERVER-SIDE because every client is untrusted —
 * the desktop page is public HTML/JS and the raw API is reachable by anyone.
 *
 * Only audio and the branded `.songstead` archive are allowed. Everything else
 * (video, office docs, pdf, executables, bare zips) is rejected. Note the
 * inherent limit: `.songstead` is an opaque ZIP we must not unpack, so a
 * determined abuser can still smuggle bytes inside one — access control + rate
 * limits + expiry contain that; content-typing alone cannot.
 */

// Audio extensions we accept (lowercase, no dot).
const AUDIO_EXTS = new Set([
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
]);

const SONGSTEAD_EXT = "songstead";

// Mime allowed to accompany a `.songstead` file (its internals are a zip).
const ARCHIVE_MIMES = new Set(["application/octet-stream", "application/zip"]);

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

export interface UploadCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Belt-and-suspenders: the extension AND the declared mime must both agree with
 * an allowed family, so lying about one doesn't get you through.
 */
export function checkUploadAllowed(fileName: string, mimeType: string): UploadCheck {
  const ext = extensionOf(fileName);
  const mime = (mimeType || "").toLowerCase();

  if (ext === SONGSTEAD_EXT) {
    if (ARCHIVE_MIMES.has(mime)) return { ok: true };
    return { ok: false, reason: "songstead files must be application/octet-stream or application/zip" };
  }

  if (AUDIO_EXTS.has(ext)) {
    // audio/* covers audio/mp4, audio/mpeg, audio/wav, …; octet-stream is a
    // common fallback some pickers report for audio.
    if (mime.startsWith("audio/") || mime === "application/octet-stream") return { ok: true };
    return { ok: false, reason: `mime "${mime}" is not audio` };
  }

  return { ok: false, reason: `file type ".${ext || "?"}" is not accepted (audio or .songstead only)` };
}

// ── Finalize-time magic-byte check ───────────────────────────────────────────
// ZIP local-file-header signature "PK\x03\x04". A `.songstead` file must be a
// real zip; this rejects arbitrary bytes renamed to .songstead. (It cannot see
// INSIDE the zip — that's the opaque-file residual.)
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export function looksLikeZip(head: Uint8Array): boolean {
  if (head.length < 4) return false;
  return ZIP_MAGIC.every((b, i) => head[i] === b);
}

/** Whether an item's stored bytes should be magic-checked, and against what. */
export function requiresZipMagic(fileName: string): boolean {
  return extensionOf(fileName) === SONGSTEAD_EXT;
}
