import type { ClipVersion, SongIdea } from "./types";
import type { NativeMixedRenderInput } from "../modules/songseed-pitch-shift";

export const OVERDUB_GAIN_MIN_DB = -18;
export const OVERDUB_GAIN_MAX_DB = 6;
export const OVERDUB_GAIN_STEP_DB = 2;

export function clampOverdubGainDb(value: number) {
  return Math.max(OVERDUB_GAIN_MIN_DB, Math.min(OVERDUB_GAIN_MAX_DB, Math.round(value)));
}

export function getDefaultOverdubStemTitle(clip: ClipVersion) {
  const nextIndex = (clip.overdub?.stems.length ?? 0) + 1;
  return `Layer ${nextIndex}`;
}

export function buildCombinedClipTitle(_idea: SongIdea, clip: ClipVersion) {
  return `${clip.title} Mix`;
}

export function toggleLowCutTonePreset(current: string | undefined) {
  return current === "low-cut" ? "neutral" : "low-cut";
}

export function buildClipOverdubMixInputs(clip: ClipVersion): NativeMixedRenderInput[] {
  const rootAudioUri = clip.audioUri;
  if (!rootAudioUri) {
    return [];
  }

  const inputs: NativeMixedRenderInput[] = [
    {
      inputUri: rootAudioUri,
      gainDb: 0,
      offsetMs: 0,
      tonePreset: "neutral",
    },
  ];

  for (const stem of clip.overdub?.stems ?? []) {
    if (!stem.audioUri || stem.isMuted) {
      continue;
    }

    inputs.push({
      inputUri: stem.audioUri,
      gainDb: clampOverdubGainDb(stem.gainDb),
      offsetMs: Math.max(0, Math.round(stem.offsetMs)),
      tonePreset: stem.tonePreset,
    });
  }

  return inputs;
}
