import { trimAudio } from "@siteed/audio-studio";
import SongNookPitchShiftModule, { type NativeTrimRange } from "../../modules/songnook-pitch-shift";

type TrimArgs =
  | { fileUri: string; mode: "single"; startTimeMs: number; endTimeMs: number; outputFileName?: string }
  | { fileUri: string; mode: "remove"; ranges: NativeTrimRange[]; durationMs: number; outputFileName?: string };

/** Kept ranges = the complement of the removed ranges over [0, durationMs]. */
function complementRanges(removeRanges: NativeTrimRange[], durationMs: number): NativeTrimRange[] {
  const clamped = removeRanges
    .map((range) => ({
      startTimeMs: Math.max(0, Math.min(durationMs, range.startTimeMs)),
      endTimeMs: Math.max(0, Math.min(durationMs, range.endTimeMs)),
    }))
    .filter((range) => range.endTimeMs > range.startTimeMs)
    .sort((a, b) => a.startTimeMs - b.startTimeMs);

  const keep: NativeTrimRange[] = [];
  let cursor = 0;
  for (const range of clamped) {
    if (range.startTimeMs > cursor) {
      keep.push({ startTimeMs: cursor, endTimeMs: range.startTimeMs });
    }
    cursor = Math.max(cursor, range.endTimeMs);
  }
  if (cursor < durationMs) {
    keep.push({ startTimeMs: cursor, endTimeMs: durationMs });
  }
  return keep;
}

/**
 * Render a trimmed clip by concatenating kept ranges (extract = one range; cut =
 * the complement of the removed ranges). Prefers the in-house media3 / AVFoundation
 * renderer; falls back to @siteed `trimAudio` if it's unavailable or fails. Returns
 * `{ uri }` to match the @siteed shape so call sites stay unchanged.
 */
export async function trimAudioRanges(args: TrimArgs): Promise<{ uri: string }> {
  const native = SongNookPitchShiftModule;
  const keepRanges =
    args.mode === "single"
      ? [{ startTimeMs: args.startTimeMs, endTimeMs: args.endTimeMs }]
      : complementRanges(args.ranges, args.durationMs);

  if (native?.renderTrim && keepRanges.length > 0) {
    try {
      const result = await native.renderTrim({
        inputUri: args.fileUri,
        ranges: keepRanges,
        outputFileName: args.outputFileName,
      });
      return { uri: result.outputUri };
    } catch (error) {
      console.warn("[trim] native renderTrim failed; falling back to @siteed", error);
    }
  }

  if (args.mode === "single") {
    const result = await trimAudio({
      fileUri: args.fileUri,
      mode: "single",
      startTimeMs: args.startTimeMs,
      endTimeMs: args.endTimeMs,
    });
    return { uri: result.uri };
  }

  const result = await trimAudio({
    fileUri: args.fileUri,
    mode: "remove",
    ranges: args.ranges.map((range) => ({ startTimeMs: range.startTimeMs, endTimeMs: range.endTimeMs })),
  });
  return { uri: result.uri };
}
