import { useMemo, useState } from "react";
import { clampPitchShiftSemitones } from "../../../pitchShift";

const MIN_PLAYBACK_RATE = 0.5;
const MAX_PLAYBACK_RATE = 2.0;

function clampPlaybackRate(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Math.max(MIN_PLAYBACK_RATE, Math.min(MAX_PLAYBACK_RATE, rounded));
}

export function useEditorTransformState() {
  const [pitchShiftSemitones, setPitchShiftSemitonesState] = useState(0);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const setPitchShiftSemitones = (value: number) => {
    setPitchShiftSemitonesState(clampPitchShiftSemitones(value));
  };

  const setPlaybackRate = (value: number) => {
    setPlaybackRateState(clampPlaybackRate(value));
  };

  const resetTransforms = () => {
    setPitchShiftSemitonesState(0);
    setPlaybackRateState(1);
  };

  const hasActiveTransforms = useMemo(
    () => pitchShiftSemitones !== 0 || Math.abs(playbackRate - 1) > 0.001,
    [pitchShiftSemitones, playbackRate]
  );

  return {
    pitchShiftSemitones,
    playbackRate,
    setPitchShiftSemitones,
    setPlaybackRate,
    resetTransforms,
    hasActiveTransforms,
  };
}
