import { useEffect, useMemo } from "react";
import { clampPitchShiftSemitones } from "../../../pitchShift";
import {
  useNativePitchTransport,
  type NativeTransportSource,
} from "../../../hooks/useNativePitchTransport";

type Args = {
  isFocused: boolean;
  audioUri?: string | null;
  playbackRate: number;
  pitchShiftSemitones: number;
  sourcePositionMs: number;
  sourceDurationMs: number;
  sourceIsPlaying: boolean;
  pauseSource: () => Promise<void>;
  playSource: () => Promise<void>;
  seekSourceTo: (ms: number) => Promise<void>;
  setSourcePlaybackRate: (rate: number) => void;
};

/**
 * Editor pitch/speed preview transport — a thin adapter over the shared
 * `useNativePitchTransport` core. Native ownership only engages for a non-zero
 * pitch shift (speed alone rides the expo-audio source); restarts from 0 when
 * play is pressed at the end.
 */
export function useEditorPreviewTransport({
  isFocused,
  audioUri,
  playbackRate,
  pitchShiftSemitones,
  sourcePositionMs,
  sourceDurationMs,
  sourceIsPlaying,
  pauseSource,
  playSource,
  seekSourceTo,
  setSourcePlaybackRate,
}: Args) {
  const clamped = clampPitchShiftSemitones(pitchShiftSemitones);

  const source = useMemo<NativeTransportSource>(
    () => ({
      sourceKey: audioUri ?? null,
      audioUri: audioUri ?? null,
      positionMs: sourcePositionMs,
      durationMs: sourceDurationMs,
      isPlaying: sourceIsPlaying,
      pause: pauseSource,
      play: playSource,
      seekTo: seekSourceTo,
      setPlaybackRate: setSourcePlaybackRate,
    }),
    [
      audioUri,
      pauseSource,
      playSource,
      seekSourceTo,
      setSourcePlaybackRate,
      sourceDurationMs,
      sourceIsPlaying,
      sourcePositionMs,
    ]
  );

  const core = useNativePitchTransport({
    ownerLabel: "editor-screen",
    wantsNative: isFocused && clamped !== 0,
    selectSupported: (caps) => caps.supportsEditorPreview,
    source,
    playbackRate,
    pitchShiftSemitones,
    restartAtEndOnPlay: true,
  });

  // Speed alone (no pitch shift) plays through the underlying source, so keep its
  // rate in sync whenever the native engine isn't owning playback.
  useEffect(() => {
    setSourcePlaybackRate(playbackRate);
  }, [playbackRate, setSourcePlaybackRate]);

  // Recover from a transient native error: clear the disable latch when leaving
  // the editor or when the user dials in a pitch again, so pitch preview doesn't
  // stay permanently "unavailable" for the rest of the session.
  useEffect(() => {
    if ((!isFocused || clamped !== 0) && core.nativeTransportDisabled) {
      core.clearDisabled();
    }
  }, [clamped, core.clearDisabled, core.nativeTransportDisabled, isFocused]);

  return useMemo(
    () => ({
      capabilities: core.capabilities,
      effectivePositionMs: core.effectivePositionMs,
      effectiveDurationMs: core.effectiveDurationMs,
      effectiveIsPlaying: core.effectiveIsPlaying,
      effectivePlaybackRate: core.effectivePlaybackRate,
      isPitchPreviewAvailable: core.capabilities.supportsEditorPreview && !core.nativeTransportDisabled,
      isUsingNativePitchPreview: core.isNativeTransportActive,
      play: core.play,
      pause: core.pause,
      seekTo: core.seekTo,
      togglePlay: core.togglePlay,
    }),
    [core]
  );
}
