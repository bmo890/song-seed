/**
 * Which audio containers an import can keep as-is, and which need a word.
 *
 * AIFF (2026-10-11): iOS decodes it (AVFoundation), Android does not —
 * media3 ships no AIFF extractor and the platform MediaExtractor can't read it
 * either, so an AIFF clip would import, then never play or get a waveform. On
 * iOS the import converts it to M4A; on Android it is refused with a clear
 * message instead of failing quietly later.
 *
 * Video (2026-10-19): a video the musician recorded — a rehearsal, a lesson, a
 * screen recording — imports as a clip of its sound; the picture is dropped and
 * the library never holds the video. MP4, MOV, M4V and 3GP are what phones write
 * and both platforms read them natively, so those four are the whole list. WebM
 * and MKV are left out on purpose: iOS can't open them at all, and one platform
 * accepting a file the other refuses would be a worse surprise than neither.
 */
export const UNSUPPORTED_AUDIO_FORMAT = "UNSUPPORTED_AUDIO_FORMAT";

export class UnsupportedAudioFormatError extends Error {
  readonly code = UNSUPPORTED_AUDIO_FORMAT;
  constructor(readonly format: string, message?: string) {
    super(message ?? `Unsupported audio format: ${format}`);
    this.name = "UnsupportedAudioFormatError";
  }
}

export function isAiffExtension(extension: string | undefined | null): boolean {
  const lower = (extension ?? "").toLowerCase();
  return lower === "aif" || lower === "aiff" || lower === "aifc";
}

export function isUnsupportedAudioFormatError(error: unknown): error is UnsupportedAudioFormatError {
  return (
    !!error &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === UNSUPPORTED_AUDIO_FORMAT
  );
}

/** The distinct formats among a batch's failures that were refused for being
 *  unsupported — what an import summary names, once, instead of per file. */
export function unsupportedFormatsIn(failures: ReadonlyArray<{ error: unknown }>): string[] {
  const formats = new Set<string>();
  for (const failure of failures) {
    if (isUnsupportedAudioFormatError(failure.error)) formats.add(failure.error.format);
  }
  return [...formats];
}

/** A video that has no audio track — nothing to import. */
export const NO_AUDIO_FORMAT = "no-audio";
/** A video the device couldn't open or extract (or a build without the extractor). */
export const VIDEO_FORMAT = "video";

/** The containers phone cameras and screen recorders write. */
export const VIDEO_IMPORT_EXTENSIONS = ["mp4", "mov", "m4v", "3gp"] as const;
/** The same four as MIME types — what the file pickers and share filters accept. */
export const VIDEO_IMPORT_MIME_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v", "video/3gpp"] as const;

const VIDEO_EXTENSION_SET = new Set<string>(VIDEO_IMPORT_EXTENSIONS);
const VIDEO_MIME_SET = new Set<string>(VIDEO_IMPORT_MIME_TYPES);

function extensionOf(name: string | undefined | null): string | null {
  return name?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? null;
}

/**
 * Should this import be treated as a video (sound lifted out, picture dropped)?
 * A supported video MIME type decides; failing that, the file name's extension.
 * An explicit audio MIME type always wins — an `.mp4` labelled `audio/mp4` is
 * already audio and copies as-is.
 */
export function isVideoImport(name: string | undefined | null, mimeType: string | undefined | null): boolean {
  const mime = mimeType?.toLowerCase().trim() ?? "";
  if (mime.startsWith("audio/")) return false;
  if (VIDEO_MIME_SET.has(mime)) return true;
  const extension = extensionOf(name);
  return extension ? VIDEO_EXTENSION_SET.has(extension) : false;
}

/** Did the native extractor refuse because the video has no sound? */
export function isNoAudioTrackError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return message.includes("NO_AUDIO_TRACK");
}
