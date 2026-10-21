import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../../state/useStore";
import { isTonePresetNeutral } from "../../../domain/overdub";
import { clampPitchShiftSemitones } from "../../../domain/pitchShift";
import {
  useNativePitchTransport,
  type NativeTransportSource,
} from "../../../hooks/useNativePitchTransport";

type Args = {
  mode: "player" | "practice" | "layers";
  isFocused: boolean;
  /** The engine may keep sounding: the player is up, docked, or under a
   *  non-audio screen. False only while a screen that takes the audio is up. */
  engaged: boolean;
  /** The full player is loaded with this same clip. */
  sourceInSync: boolean;
  clip: { id: string; audioUri?: string | null } | null;
  pitchShiftSemitones: number;
  /** The take's level and tone (its root overdub settings); null when no clip. */
  sound: { gainDb: number; tonePreset: string } | null;
  playerShouldAutoplay: boolean;
  fullPlayerPosition: number;
  fullPlayerDuration: number;
  fullPlayerPlaybackRate: number;
  fullPlayerIsPlaying: boolean;
  pauseFullPlayer: () => Promise<void>;
  playFullPlayer: () => Promise<void>;
  seekFullPlayerTo: (ms: number) => Promise<void>;
  setFullPlayerPlaybackRate: (rate: number) => void;
  setFullPlayerMuted: (muted: boolean) => void;
};

/**
 * Practice playback transport for the full player — pitch/speed via the native
 * engine, handed off to/from the full player. A thin adapter over the shared
 * `useNativePitchTransport` core: it adds the practice-only concerns (sticky
 * ownership, publishing position to the store, queue finish tokens, dock-close).
 */
export function usePlayerPracticePitchTransport({
  mode,
  engaged,
  sourceInSync,
  clip,
  pitchShiftSemitones,
  sound,
  playerShouldAutoplay,
  fullPlayerPosition,
  fullPlayerDuration,
  fullPlayerPlaybackRate,
  fullPlayerIsPlaying,
  pauseFullPlayer,
  playFullPlayer,
  seekFullPlayerTo,
  setFullPlayerPlaybackRate,
  setFullPlayerMuted,
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
      setMuted: setFullPlayerMuted,
      inSync: sourceInSync,
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
      setFullPlayerMuted,
      sourceInSync,
    ]
  );

  // A take with a non-neutral sound (Sound room: level or tone) is heard through
  // the native engine in every mode of the full player, not only with Tools open:
  // the sound is the take's, not a practice bend. Pitch, like speed, now holds
  // when Tools close (2026-10-20: the chart reads against it, so it must still
  // sound while you read); only the layers bench, which plays its own audio,
  // sets it aside.
  const soundIsNeutral = (sound?.gainDb ?? 0) === 0 && isTonePresetNeutral(sound?.tonePreset);
  const pitchMode = mode !== "layers";
  // Engaged, not focused (2026-10-21): docked, or under the drawer or a lyric
  // editor, the clip keeps its pitch and sound; only a screen that takes the
  // audio (recorder, editor) makes the engine hand back.
  const wantsNative =
    engaged && (!soundIsNeutral || (pitchMode && (stickyRef.current || clamped !== 0)));

  const core = useNativePitchTransport({
    ownerLabel: "player-screen",
    wantsNative,
    selectSupported: (caps) => caps.supportsPracticePlayback,
    source,
    playbackRate: fullPlayerPlaybackRate,
    pitchShiftSemitones,
    sound: sound ?? undefined,
    extraAutoplay: playerShouldAutoplay,
    onEnded,
    twinSource: true,
    throttlePositionCommits: true,
  });

  // Maintain sticky ownership + clear a prior error-disable on re-engage / mode exit.
  // A clip of its own starts unstuck: its pitch is its own (per-clip settings).
  const stickyClipIdRef = useRef(clip?.id);
  useEffect(() => {
    const clipChanged = stickyClipIdRef.current !== clip?.id;
    stickyClipIdRef.current = clip?.id;
    if (!pitchMode || !engaged || clipChanged) {
      stickyRef.current = false;
      if (core.nativeTransportDisabled) core.clearDisabled();
      return;
    }
    if (clamped !== 0) {
      stickyRef.current = true;
      if (core.nativeTransportDisabled) core.clearDisabled();
    }
  }, [clamped, clip?.id, core.clearDisabled, core.nativeTransportDisabled, engaged, pitchMode]);

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
      /** The engine is loaded with this clip and its reports drive the clock. */
      isNativeClockActive: core.isNativeTransportActive,
      positionChannel: core.positionChannel,
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
