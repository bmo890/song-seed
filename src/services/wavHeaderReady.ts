import * as FileSystem from "expo-file-system/legacy";

/** The recorder's WAV header is the canonical 44 bytes; the data size sits at byte 40. */
const WAV_HEADER_BYTES = 44;
const DATA_SIZE_OFFSET = 40;
const POLL_MS = 40;

/** Little-endian uint32 from base64 of exactly four bytes. */
export function readUint32LE(base64: string): number | null {
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    return null;
  }
  if (binary.length < 4) return null;
  return (
    (binary.charCodeAt(0) |
      (binary.charCodeAt(1) << 8) |
      (binary.charCodeAt(2) << 16) |
      (binary.charCodeAt(3) << 24)) >>>
    0
  );
}

/** The header's data size matches what is actually on disk. */
export function wavHeaderMatchesFile(dataSize: number | null, fileSize: number): boolean {
  return dataSize != null && dataSize > 0 && dataSize === fileSize - WAV_HEADER_BYTES;
}

/**
 * Wait until a just-stopped take's WAV header states the file's real length.
 *
 * iOS hands back `stopRecording()` before it writes the final data size into the
 * header (audio-studio finishes it on a background queue). Anything that reads the file
 * in that window sees a stale length: the head trim cut every layer take to ~12 s in the
 * simulator (2026-10-22), dropping the rest of the performance. Android writes the
 * header before it returns, so this resolves at once there.
 *
 * Resolves true when the header is final (or the file is not a WAV), false on timeout:
 * the caller must then avoid anything that would rewrite the take from a stale read.
 */
export async function waitForFinalWavHeader(fileUri: string, timeoutMs = 3000): Promise<boolean> {
  if (!/\.wav$/i.test(fileUri.split("?")[0] ?? "")) return true;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists && typeof info.size === "number") {
        const header = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
          position: DATA_SIZE_OFFSET,
          length: 4,
        });
        if (wavHeaderMatchesFile(readUint32LE(header), info.size)) return true;
      }
    } catch {
      // A read racing the writer: try again on the next tick.
    }
    if (Date.now() >= deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}
