import type { ClipOverdubRootSettings, ClipOverdubStem, ClipVersion, RecordingGrid, SongIdea } from "./types";
import type { NativeMixedRenderInput } from "../modules/songseed-pitch-shift";
import { getMetronomeMeterPreset } from "./metronome";
import { fmtDuration } from "./utils";
import { hueToAccentHex } from "./workspaceTheme";

export const OVERDUB_GAIN_MIN_DB = -24;
export const OVERDUB_GAIN_MAX_DB = 12;
export const OVERDUB_GAIN_STEP_DB = 4;
export const DEFAULT_CLIP_OVERDUB_ROOT_SETTINGS: ClipOverdubRootSettings = {
  gainDb: 0,
  tonePreset: "neutral",
};

export function clampOverdubGainDb(value: number) {
  return Math.max(OVERDUB_GAIN_MIN_DB, Math.min(OVERDUB_GAIN_MAX_DB, Math.round(value)));
}

export function getDefaultOverdubStemTitle(clip: ClipVersion) {
  const nextIndex = (clip.overdub?.stems.length ?? 0) + 1;
  return `Layer ${nextIndex}`;
}

// ── Layer colour ─────────────────────────────────────────────────────────────
// Each layer gets an accent colour automatically at creation — a golden-angle hue
// rotation (~137.5°) so consecutive layers land far apart on the wheel regardless of
// how many exist, without tracking which hues are "taken". Shown as the layer card's
// tint, its lane on the reel, and its waveform in Align; adjustable anytime via the
// layer's ⋯ menu.
const OVERDUB_STEM_HUE_STEP = 137.5;
const OVERDUB_STEM_HUE_SEED = 18; // offsets the first layer off pure red

export function assignNextOverdubStemColor(existingStemCount: number): string {
  const hue = (OVERDUB_STEM_HUE_SEED + existingStemCount * OVERDUB_STEM_HUE_STEP) % 360;
  return hueToAccentHex(hue);
}

/** Stems saved before the colour field existed fall back to a colour derived from
 *  their position, so old layers still render distinctly instead of all-terracotta. */
export function getOverdubStemColor(stem: Pick<ClipOverdubStem, "color">, indexFallback: number): string {
  return stem.color ?? assignNextOverdubStemColor(indexFallback);
}

/** rgba() with the given alpha — layer lanes/waveforms use partial opacity so
 *  overlapping layers blend instead of fully occluding each other. */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getClipOverdubRootSettings(clip: ClipVersion): ClipOverdubRootSettings {
  return {
    gainDb: clampOverdubGainDb(clip.overdub?.root?.gainDb ?? DEFAULT_CLIP_OVERDUB_ROOT_SETTINGS.gainDb),
    tonePreset: clip.overdub?.root?.tonePreset ?? DEFAULT_CLIP_OVERDUB_ROOT_SETTINGS.tonePreset,
  };
}

export function buildCombinedClipTitle(_idea: SongIdea, clip: ClipVersion) {
  return `${clip.title} Mix`;
}

export function toggleLowCutTonePreset(current: string | undefined) {
  return current === "low-cut" ? "neutral" : "low-cut";
}

/** Fine-alignment steps for nudging a stem against the guide (same interaction pattern
 *  as the Bluetooth calibration tweaks). Coarse placement is the recording flow's job. */
export const OVERDUB_STEM_NUDGE_STEP_SMALL_MS = 10;
export const OVERDUB_STEM_NUDGE_STEP_LARGE_MS = 25;

/** How far a stem may be pulled EARLIER than the guide (negative offset = the mixer
 *  drops the first |offset| of the stem). Recording latency makes stems land late, so
 *  correction is usually in this direction; bounded so a runaway nudge can't silence
 *  the whole stem. */
export const MIN_CLIP_OVERDUB_STEM_OFFSET_MS = -2000;

/** Extra positive headroom past the "fits inside the master" bound. A typical overdub is
 *  the same length as its guide, which used to make the natural max 0 — no positive
 *  nudge at all. Pushing later may extend the stem past the master's end; the mix render
 *  already sizes its output to the longest input, so the tail simply plays out. */
export const MAX_EXTRA_CLIP_OVERDUB_STEM_OFFSET_MS = 2000;

export function getMinClipOverdubStemOffsetMs(stemDurationMs: number | undefined) {
  if (!Number.isFinite(stemDurationMs)) {
    return MIN_CLIP_OVERDUB_STEM_OFFSET_MS;
  }
  return Math.max(MIN_CLIP_OVERDUB_STEM_OFFSET_MS, -Math.round(stemDurationMs!));
}

export function getMaxClipOverdubStemOffsetMs(
  rootDurationMs: number | undefined,
  stemDurationMs: number | undefined
) {
  if (!Number.isFinite(rootDurationMs) || !Number.isFinite(stemDurationMs)) {
    return MAX_EXTRA_CLIP_OVERDUB_STEM_OFFSET_MS;
  }

  return (
    Math.max(0, Math.round(rootDurationMs!) - Math.round(stemDurationMs!)) +
    MAX_EXTRA_CLIP_OVERDUB_STEM_OFFSET_MS
  );
}

export function clampClipOverdubStemOffsetMs(
  nextOffsetMs: number,
  rootDurationMs: number | undefined,
  stemDurationMs: number | undefined
) {
  const maxOffsetMs = getMaxClipOverdubStemOffsetMs(rootDurationMs, stemDurationMs);
  const minOffsetMs = getMinClipOverdubStemOffsetMs(stemDurationMs);
  return Math.max(minOffsetMs, Math.min(maxOffsetMs, Math.round(nextOffsetMs)));
}

/** Punch points closer to the top than this record as a classic from-the-start layer —
 *  a sub-second punch is indistinguishable from "I just hit record". */
const MIN_PUNCH_IN_MS = 1000;

/** Bar length of a clip's tempo grid, or null when the clip has no usable grid. */
export function getRecordingGridBarMs(grid: RecordingGrid | null | undefined): number | null {
  if (!grid || !Number.isFinite(grid.bpm) || grid.bpm <= 0) {
    return null;
  }
  const pulsesPerBar = Math.max(1, getMetronomeMeterPreset(grid.meterId).pulsesPerBar);
  return (60000 / grid.bpm) * pulsesPerBar;
}

/**
 * Snap a requested punch-in point to the master's bar grid so the layer starts in the
 * pocket, not at a ragged scrub timestamp. Grid bars are anchored at the measured
 * firstDownbeatMs — no grid (or no measured downbeat) means no snapping, only clamping.
 * Returns 0 for punch points too close to the top (classic full-length layer).
 */
export function snapPunchInMsToGrid(
  requestedMs: number,
  grid: RecordingGrid | null | undefined,
  masterDurationMs?: number
): number {
  if (!Number.isFinite(requestedMs) || requestedMs <= 0) {
    return 0;
  }
  let snapped = Math.round(requestedMs);
  const barMs = getRecordingGridBarMs(grid);
  if (barMs != null && grid?.firstDownbeatMs != null) {
    const barsFromAnchor = Math.round((snapped - grid.firstDownbeatMs) / barMs);
    snapped = Math.round(grid.firstDownbeatMs + barsFromAnchor * barMs);
  }
  if (Number.isFinite(masterDurationMs) && masterDurationMs! > 0) {
    // A punch at/past the end records over nothing — pull it back inside the master.
    snapped = Math.min(snapped, Math.max(0, Math.round(masterDurationMs!) - MIN_PUNCH_IN_MS));
  }
  return snapped < MIN_PUNCH_IN_MS ? 0 : snapped;
}

export function formatClipOverdubStemOffsetLabel(offsetMs: number) {
  if (!Number.isFinite(offsetMs) || offsetMs === 0) {
    return "In place";
  }
  // Second-scale offsets are punch-in placements — read as a song position, not a nudge.
  if (offsetMs >= MIN_PUNCH_IN_MS) {
    return `at ${fmtDuration(offsetMs)}`;
  }
  return offsetMs > 0 ? `+${Math.round(offsetMs)} ms` : `${Math.round(offsetMs)} ms`;
}

/**
 * Headroom trim applied to EVERY input of an N-way mix, in dB. The native mixers SUM the
 * sources with no attenuation, so a master plus several similarly-hot layers saturates
 * and clips — heard on device as "booming"/overdrive once enough layers stack. Power-
 * preserving 1/√N scaling (−10·log10(N) dB) keeps the mix's overall energy comparable
 * to a single track while making the summed peaks fit: −3 dB at 2 inputs, −7.8 dB at 6.
 */
export function getMixHeadroomDb(inputCount: number): number {
  if (!Number.isFinite(inputCount) || inputCount <= 1) {
    return 0;
  }
  return -10 * Math.log10(inputCount);
}

/** dB → linear player volume, clamped to the 0..1 range expo-audio accepts (boosts
 *  flatten to 1 — live previews are for timing/balance judgement, not level boosts). */
export function overdubGainDbToPlayerVolume(gainDb: number): number {
  return Math.max(0, Math.min(1, Math.pow(10, gainDb / 20)));
}

export function buildClipOverdubMixInputs(clip: ClipVersion): NativeMixedRenderInput[] {
  const rootAudioUri = clip.audioUri;
  if (!rootAudioUri) {
    return [];
  }
  const rootSettings = getClipOverdubRootSettings(clip);
  const rootDurationMs = clip.durationMs;
  const activeStems = (clip.overdub?.stems ?? []).filter((stem) => stem.audioUri && !stem.isMuted);
  const headroomDb = getMixHeadroomDb(1 + activeStems.length);

  const inputs: NativeMixedRenderInput[] = [
    {
      inputUri: rootAudioUri,
      gainDb: rootSettings.gainDb + headroomDb,
      offsetMs: 0,
      tonePreset: rootSettings.tonePreset,
    },
  ];

  for (const stem of activeStems) {
    inputs.push({
      inputUri: stem.audioUri!,
      gainDb: clampOverdubGainDb(stem.gainDb) + headroomDb,
      offsetMs: clampClipOverdubStemOffsetMs(stem.offsetMs, rootDurationMs, stem.durationMs),
      tonePreset: stem.tonePreset,
    });
  }

  return inputs;
}
