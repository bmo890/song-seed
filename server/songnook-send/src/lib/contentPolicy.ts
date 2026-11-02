/**
 * What may be uploaded. Enforced SERVER-SIDE because every client is untrusted —
 * the desktop page is public HTML/JS and the raw API is reachable by anyone.
 *
 * Only audio and the branded `.songnook` archive are allowed. Everything else
 * (video, office docs, pdf, executables, bare zips) is rejected. Note the
 * inherent limit: `.songnook` is an opaque ZIP we must not unpack, so a
 * determined abuser can still smuggle bytes inside one — access control + rate
 * limits + expiry contain that; content-typing alone cannot.
 */

// The ONE list every end of Send reads: the app's sender and receiver, this
// check and the web sender page (audit 2026-11-02, 12h H-1). Bundled from the
// app's source so the two can never drift.
import {
  SEND_ARCHIVE_EXTENSION,
  SEND_ARCHIVE_MIMES,
  SEND_AUDIO_EXTENSIONS,
} from "../../../../src/domain/sendFormats.ts";

// Audio extensions we accept (lowercase, no dot).
const AUDIO_EXTS = new Set(SEND_AUDIO_EXTENSIONS);

const SONGNOOK_EXT = SEND_ARCHIVE_EXTENSION;

// Mime allowed to accompany a `.songnook` file (its internals are a zip).
const ARCHIVE_MIMES = new Set(SEND_ARCHIVE_MIMES);

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

  if (ext === SONGNOOK_EXT) {
    if (ARCHIVE_MIMES.has(mime)) return { ok: true };
    return { ok: false, reason: "songnook files must be application/octet-stream or application/zip" };
  }

  if (AUDIO_EXTS.has(ext)) {
    // audio/* covers audio/mp4, audio/mpeg, audio/wav, …; octet-stream is a
    // common fallback some pickers report for audio.
    if (mime.startsWith("audio/") || mime === "application/octet-stream") return { ok: true };
    return { ok: false, reason: `mime "${mime}" is not audio` };
  }

  return { ok: false, reason: `file type ".${ext || "?"}" is not accepted (audio or .songnook only)` };
}

// ── Finalize-time magic-byte check ───────────────────────────────────────────
// ZIP local-file-header signature "PK\x03\x04". A `.songnook` file must be a
// real zip; this rejects arbitrary bytes renamed to .songnook. (It cannot see
// INSIDE the zip — that's the opaque-file residual.)
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** A sealed parcel's items are numbered `N.sealed`; their real names and
 *  types live in the sealed envelope, out of the server's sight. */
export function isSealedItemName(fileName: string): boolean {
  return /^[1-9][0-9]{0,2}\.sealed$/.test(fileName);
}

/** "SNS1": the first four bytes of every sealed file. */
export function looksSealed(head: Uint8Array): boolean {
  return head.length >= 4 && head[0] === 0x53 && head[1] === 0x4e && head[2] === 0x53 && head[3] === 0x31;
}

/** A sealed envelope: base64 of an SNS1 file ("U05TMQ"), at most 64 KB. */
export function sealedMetaValid(value: unknown): value is string {
  return typeof value === "string" && value.length <= 65536 && /^U05TMQ[A-Za-z0-9+/]*={0,2}$/.test(value);
}

export function looksLikeZip(head: Uint8Array): boolean {
  if (head.length < 4) return false;
  return ZIP_MAGIC.every((b, i) => head[i] === b);
}

/** Whether an item's stored bytes should be magic-checked, and against what. */
export function requiresZipMagic(fileName: string): boolean {
  return extensionOf(fileName) === SONGNOOK_EXT;
}
