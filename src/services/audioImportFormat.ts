/**
 * Which audio containers an import can keep as-is, and which need a word.
 *
 * AIFF (2026-10-11): iOS decodes it (AVFoundation), Android does not —
 * media3 ships no AIFF extractor and the platform MediaExtractor can't read it
 * either, so an AIFF clip would import, then never play or get a waveform. On
 * iOS the import converts it to M4A; on Android it is refused with a clear
 * message instead of failing quietly later.
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
