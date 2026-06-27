import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../../state/useStore";
import { clampPitchShiftSemitones } from "../../../pitchShift";
import {
  useNativePitchTransport,
  type NativeTransportSource,
} from "../../../hooks/useNativePitchTransport";

type Args = {
  mode: "player" | "practice" | "playalong";
  isFocused: boolean;
  clip: { id: string; audioUri?: string | null } | null;
  pitchShiftSemitones: number;
  playerShouldAutoplay: boolean;
  fullPlayerPosition: number;
  fullPlayerDuration: number;
  fullPlayerPlaybackRate: number;
  fullPlayerIsPlaying: boolean;
  pauseFullPlayer: () => Promise<void>;
  playFullPlayer: () => Promise<void>;
  seekFullPlayerTo: (ms: number) => Promise<void>;
  setFullPlayerPlaybackRate: (rate: number) => void;
};

/**
 * Practice playback transport for the full player — pitch/speed via the native
 * engine, handed off to/from the full player. A thin adapter over the shared
 * `useNativePitchTransport` core: it adds the practice-only concerns (sticky
 * ownership, publishing position to the store, queue finish tokens, dock-close).
 */
export function usePlayerPracticePitchTransport({
  mode,
  isFocused,
  clip,
  pitchShiftSemitones,
  playerShouldAutoplay,
  fullPlayerPosition,
  fullPlayerDuration,
  fullPlayerPlaybackRate,
  fullPlayerIsPlaying,
  pauseFullPlayer,
  playFullPlayer,
  seekFullPlayerTo,
  setFullPlayerPlaybackRate,
}: Args) {
  const setPlayerPlaybackState = useStore((s) => s.setPlayerPlaybackState);
  const clamped = clampPitchShiftSemitones(pitchShiftSemitones);

  const [finishedPlaybackToken, setFinishedPlaybackToken] = useState(0);
  const [finishedPlaybackClipId, setFinishedPlaybackClipId] = useState<string | null>(null);

  // Sticky: once practice playback engages with a pitch shift, keep owning the
  // native transport even if pitch returns to 0, to avoid an audio re-route glitch.
  const stickyRef = useRef(false);

  const onEnded = useCallback((sourceKey: string | null) => {
    if (!sourceKey) return;
    setFinishedPlaybackClipId(sourceKey);
    setFinishedPlaybackToken((prev) => prev + 1);
  }, []);

  const source = useMemo<NativeTransportSource>(
    () => ({
      sourceKey: clip?.id ?? null,
      audioUri: clip?.audioUri ?? null,
      positionMs: fullPlayerPosition,
      durationMs: fullPlayerDuration,
      isPlaying: fullPlayerIsPlaying,
      pause: pauseFullPlayer,
      play: playFullPlayer,
      seekTo: seekFullPlayerTo,
      setPlaybackRate: setFullPlayerPlaybackRate,
    }),
    [
      clip?.id,
      clip?.audioUri,
      fullPlayerDuration,
      fullPlayerIsPlaying,
      fullPlayerPosition,
      pauseFullPlayer,
      playFullPlayer,
      seekFullPlayerTo,
      setFullPlayerPlaybackRate,
    ]
  );

  const wantsNative = mode === "practice" && isFocused && (stickyRef.current || clamped !== 0);

  const core = useNativePitchTransport({
    ownerLabel: "player-screen",
    wantsNative,
    selectSupported: (caps) => caps.supportsPracticePlayback,
    source,
    playbackRate: fullPlayerPlaybackRate,
    pitchShiftSemitones,
    extraAutoplay: playerShouldAutoplay,
    onEnded,
  });

  // Maintain sticky ownership + clear a prior error-disable on re-engage / mode exit.
  useEffect(() => {
    if (mode !== "practice" || !isFocused) {
      stickyRef.current = false;
      if (core.nativeTransportDisabled) core.clearDisabled();
      return;
    }
    if (clamped !== 0) {
      stickyRef.current = true;
      if (core.nativeTransportDisabled) core.clearDisabled();
    }
  }, [clamped, core.clearDisabled, core.nativeTransportDisabled, isFocused, mode]);

  // Publish native playback position into the store so the rest of the app (dock,
  // lock screen) tracks practice playback while the native engine owns transport.
  const lastPublishedRef = useRef({ at: 0, positionMs: 0, durationMs: 0, isPlaying: false });
  const ns = core.nativeState;
  useEffect(() => {
    if (!core.isOwningNativeTransport || !core.isNativeTransportActive) return;
    const now = Date.now();
    const last = lastPublishedRef.current;
    const shouldPublish =
      last.isPlaying !== ns.isPlaying ||
      last.durationMs !== ns.durationMs ||
      now - last.at >= 150 ||
      Math.abs(ns.currentTimeMs - last.positionMs) >= 250;
    if (!shouldPublish) return;
    setPlayerPlaybackState({
      positionMs: ns.currentTimeMs,
      durationMs: ns.durationMs,
      isPlaying: ns.isPlaying,
    });
    lastPublishedRef.current = {
      at: now,
      positionMs: ns.currentTimeMs,
      durationMs: ns.durationMs,
      isPlaying: ns.isPlaying,
    };
  }, [
    core.isOwningNativeTransport,
    core.isNativeTransportActive,
    ns.currentTimeMs,
    ns.durationMs,
    ns.isPlaying,
    setPlayerPlaybackState,
  ]);

  return useMemo(
    () => ({
      capabilities: core.capabilities,
      effectivePositionMs: core.effectivePositionMs,
      effectiveDurationMs: core.effectiveDurationMs,
      effectiveIsPlaying: core.effectiveIsPlaying,
      effectivePlaybackRate: core.effectivePlaybackRate,
      finishedPlaybackToken: core.isNativeTransportActive ? finishedPlaybackToken : 0,
      finishedPlaybackClipId: core.isNativeTransportActive ? finishedPlaybackClipId : null,
      isOwningNativeTransport: core.isOwningNativeTransport,
      isPitchShiftAvailable: core.capabilities.supportsPracticePlayback && !core.nativeTransportDisabled,
      play: core.play,
      pause: core.pause,
      seekTo: core.seekTo,
      setPlaybackRate: core.setPlaybackRate,
      togglePlay: core.togglePlay,
      prepareForPlayerClose: core.prepareForRelease,
      shouldSuppressSourceAutoplay: core.isOwningNativeTransport,
    }),
    [core, finishedPlaybackClipId, finishedPlaybackToken]
  );
}
