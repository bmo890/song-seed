import type { ClipOverdubRootSettings, ClipVersion, SongIdea } from "./types";
import type { NativeMixedRenderInput } from "../modules/songseed-pitch-shift";

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
    return 0;
  }

  return Math.max(0, Math.round(rootDurationMs!) - Math.round(stemDurationMs!));
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

export function formatClipOverdubStemOffsetLabel(offsetMs: number) {
  if (!Number.isFinite(offsetMs) || offsetMs === 0) {
    return "In place";
  }
  return offsetMs > 0 ? `+${Math.round(offsetMs)} ms` : `${Math.round(offsetMs)} ms`;
}

export function buildClipOverdubMixInputs(clip: ClipVersion): NativeMixedRenderInput[] {
  const rootAudioUri = clip.audioUri;
  if (!rootAudioUri) {
    return [];
  }
  const rootSettings = getClipOverdubRootSettings(clip);
  const rootDurationMs = clip.durationMs;

  const inputs: NativeMixedRenderInput[] = [
    {
      inputUri: rootAudioUri,
      gainDb: rootSettings.gainDb,
      offsetMs: 0,
      tonePreset: rootSettings.tonePreset,
    },
  ];

  for (const stem of clip.overdub?.stems ?? []) {
    if (!stem.audioUri || stem.isMuted) {
      continue;
    }

    inputs.push({
      inputUri: stem.audioUri,
      gainDb: clampOverdubGainDb(stem.gainDb),
      offsetMs: clampClipOverdubStemOffsetMs(stem.offsetMs, rootDurationMs, stem.durationMs),
      tonePreset: stem.tonePreset,
    });
  }

  return inputs;
}
