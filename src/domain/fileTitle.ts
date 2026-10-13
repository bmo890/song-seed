/**
 * A file name read as a title: "A War In Me.wav" is a song called "A War In
 * Me", not a song called "A War In Me.wav". Only real audio / SongNook
 * extensions come off — "Mix v2.1" keeps its ".1" — and only once, so a name
 * that genuinely ends in a dot-word stays as typed.
 *
 * Received parcels titled clips with the raw file name until 2026-10-11
 * (TransferReceiveScreen, fixed in 3da4d35); this helper is that fix, pinned
 * by a test so it cannot quietly regress.
 */
const TITLE_EXTENSIONS = new Set([
  "m4a", "mp3", "wav", "aac", "flac", "ogg", "oga", "opus", "aif", "aiff", "caf", "wma", "mid", "midi",
  "songnook", "zip",
]);

export function titleFromFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const dot = trimmed.lastIndexOf(".");
  if (dot <= 0) return trimmed;
  const extension = trimmed.slice(dot + 1).toLowerCase();
  if (!TITLE_EXTENSIONS.has(extension)) return trimmed;
  return trimmed.slice(0, dot).trim() || trimmed;
}
