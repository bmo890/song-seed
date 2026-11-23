import { useMemo, useState } from "react";
import { clampPitchShiftSemitones } from "../../../domain/pitchShift";
import {
  clampSoundLevelDb,
  isTonePresetNeutral,
  toggleToneFlag as toggleFlag,
  type OverdubToneFlag,
} from "../../../domain/overdub";

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2.0;

function clampPlaybackRate(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Math.max(MIN_PLAYBACK_RATE, Math.min(MAX_PLAYBACK_RATE, rounded));
}

/**
 * What the editor will bake into the copy it saves: a speed and pitch change, and (EQ
 * tab, founder 2026-11-23: "we will also need these functionalities ... in the 'edit'
 * view") a level and tone. Draft values, auditioned live; nothing touches the clip
 * until the footer's save.
 */
export function useEditorTransformState() {
  const [pitchShiftSemitones, setPitchShiftSemitonesState] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [gainDb, setGainDbState] = useState(0);
  const [tonePreset, setTonePreset] = useState("neutral");

  const setPitchShiftSemitones = (value: number) => {
    setPitchShiftSemitonesState(clampPitchShiftSemitones(value));
  };

  const setPlaybackRate = (value: number) => {
    setPlaybackRateState(clampPlaybackRate(value));
  };

  const setGainDb = (value: number) => {
    setGainDbState(clampSoundLevelDb(value));
  };

  // Functional, so Auto fix flipping several keys in one tick lands them all.
  const toggleToneFlag = (flag: OverdubToneFlag) => {
    setTonePreset((current) => toggleFlag(current, flag));
  };

  const resetTransforms = () => {
    setPitchShiftSemitonesState(0);
    setPlaybackRateState(1);
    setGainDbState(0);
    setTonePreset("neutral");
  };

  const hasSpeedOrPitch = useMemo(
    () => pitchShiftSemitones !== 0 || Math.abs(playbackRate - 1) > 0.001,
    [pitchShiftSemitones, playbackRate]
  );
  const hasSound = gainDb !== 0 || !isTonePresetNeutral(tonePreset);

  return {
    pitchShiftSemitones,
    playbackRate,
    gainDb,
    tonePreset,
    setPitchShiftSemitones,
    setPlaybackRate,
    setGainDb,
    toggleToneFlag,
    resetTransforms,
    hasSpeedOrPitch,
    hasSound,
    /** Anything the save would bake. */
    hasActiveTransforms: hasSpeedOrPitch || hasSound,
  };
}
