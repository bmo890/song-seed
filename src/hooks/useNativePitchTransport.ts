import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SongseedPitchShiftModule, {
  type NativePitchShiftCapabilities,
  type NativePitchShiftPlaybackState,
} from "../../modules/songseed-pitch-shift";
import {
  activatePlaybackAudioSession,
  createAudioSessionOwner,
  releaseAudioSessionOwner,
} from "../services/audioSession";
import { isPlaybackNearEnd } from "../services/transportPlayback";
import {
  buildUnavailablePitchShiftCapabilities,
  clampPitchShiftSemitones,
  type PitchShiftCapabilities,
} from "../pitchShift";

export const DEFAULT_NATIVE_PLAYBACK_STATE: NativePitchShiftPlaybackState = {
  isAvailable: false,
  isLoaded: false,
  isPlaying: false,
  didJustFinish: false,
  currentTimeMs: 0,
  durationMs: 0,
  playbackRate: 1,
  pitchShiftSemitones: 0,
  sourceUri: null,
};

export function normalizeNativePitchCapabilities(
  value: NativePitchShiftCapabilities | null | undefined
): PitchShiftCapabilities {
  if (!value) {
    return buildUnavailablePitchShiftCapabilities();
  }
  return {
    isAvailable: value.isAvailable,
    supportsPracticePlayback: value.supportsPracticePlayback,
    supportsEditorPreview: value.supportsEditorPreview,
    supportsOfflineRender: value.supportsOfflineRender,
    minSemitones: value.minSemitones,
    maxSemitones: value.maxSemitones,
  };
}

/** The underlying ("source") transport the native pitch engine borrows from and
 * hands back to — the full player for practice, the expo-audio preview for the
 * editor. Identity `sourceKey` changing means a different source → reload. */
export type NativeTransportSource = {
  sourceKey: string | null;
  audioUri: string | null;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  pause: () => Promise<void>;
  play: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  setPlaybackRate: (rate: number) => void;
};

type UseNativePitchTransportArgs = {
  /** Audio-session owner label, e.g. "player-screen" / "editor-screen". */
  ownerLabel: string;
  /** Caller's predicate (mode / focus / sticky / pitch) — excludes caps, uri, disabled. */
  wantsNative: boolean;
  selectSupported: (caps: PitchShiftCapabilities) => boolean;
  source: NativeTransportSource;
  playbackRate: number;
  pitchShiftSemitones: number;
  /** Restart from 0 when play() is pressed near the end (editor). */
  restartAtEndOnPlay?: boolean;
  /** Force autoplay on (re)load regardless of prior playing state (player queue). */
  extraAutoplay?: boolean;
  /** Fired when native playback ends; receives the loaded source key. */
  onEnded?: (sourceKey: string | null) => void;
};

/**
 * Shared native pitch/speed transport engine. Owns the SongseedPitchShift native
 * module lifecycle — capabilities + listeners, audio-session ownership, load /
 * rate / pitch sync, hand-back to the source, and error fallback — and exposes a
 * source-agnostic transport. The player (practice) and the editor (preview) wrap
 * it with thin adapters; this is the single tried-and-tested implementation.
 */
export function useNativePitchTransport({
  ownerLabel,
  wantsNative,
  selectSupported,
  source,
  playbackRate,
  pitchShiftSemitones,
  restartAtEndOnPlay = false,
  extraAutoplay = false,
  onEnded,
}: UseNativePitchTransportArgs) {
  const [capabilities, setCapabilities] = useState<PitchShiftCapabilities>(
    buildUnavailablePitchShiftCapabilities()
  );
  const [nativeState, setNativeState] = useState<NativePitchShiftPlaybackState>(
    DEFAULT_NATIVE_PLAYBACK_STATE
  );
  const [nativeTransportDisabled, setNativeTransportDisabled] = useState(false);

  const nativeStateRef = useRef(nativeState);
  const loadedKeyRef = useRef<string | null>(null);
  const operationRef = useRef(0);
  const shouldResumeOnReleaseRef = useRef(true);
  const audioSessionOwnerIdRef = useRef(createAudioSessionOwner(ownerLabel));
  const ownsAudioSessionRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  // Source + position read via refs so high-frequency position updates don't churn
  // the sync effect — position is only ever needed as a load start point.
  const sourceRef = useRef(source);

  nativeStateRef.current = nativeState;
  onEndedRef.current = onEnded;
  sourceRef.current = source;

  const clamped = clampPitchShiftSemitones(pitchShiftSemitones);
  const supported = selectSupported(capabilities);

  useEffect(() => {
    if (!SongseedPitchShiftModule) {
      return;
    }
    let cancelled = false;
    void SongseedPitchShiftModule.getCapabilities()
      .then((value) => {
        if (!cancelled) setCapabilities(normalizeNativePitchCapabilities(value));
      })
      .catch((error) => console.warn("Pitch transport capabilities lookup failed", error));
    void SongseedPitchShiftModule.getPlaybackState()
      .then((value) => {
        if (!cancelled) setNativeState(value);
      })
      .catch(() => {});

    const stateSub = SongseedPitchShiftModule.addListener("onStateChange", (value) => {
      setNativeState(value);
    });
    const endSub = SongseedPitchShiftModule.addListener("onPlaybackEnded", (value) => {
      setNativeState(value);
      onEndedRef.current?.(loadedKeyRef.current);
    });
    const errorSub = SongseedPitchShiftModule.addListener("onError", ({ message }) => {
      console.warn("Pitch transport error", message);
      setNativeTransportDisabled(true);
    });
    return () => {
      cancelled = true;
      stateSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, []);

  const shouldOwnNativeTransport =
    wantsNative && supported && !nativeTransportDisabled && !!source.audioUri;
  const isNativeTransportActive =
    shouldOwnNativeTransport &&
    !!source.sourceKey &&
    loadedKeyRef.current === source.sourceKey &&
    nativeState.isLoaded;

  const ensureAudioSessionOwnership = useCallback(async () => {
    if (ownsAudioSessionRef.current) return;
    await activatePlaybackAudioSession({ ownerId: audioSessionOwnerIdRef.current });
    ownsAudioSessionRef.current = true;
  }, []);

  const releaseAudioSessionOwnership = useCallback(async () => {
    if (!ownsAudioSessionRef.current) return;
    ownsAudioSessionRef.current = false;
    await releaseAudioSessionOwner(audioSessionOwnerIdRef.current);
  }, []);

  const syncBackToSource = useCallback(
    async (resumePlayback: boolean) => {
      const src = sourceRef.current;
      const hasNativeSession = loadedKeyRef.current || nativeStateRef.current.isLoaded;

      if (!SongseedPitchShiftModule) {
        if (ownsAudioSessionRef.current) await releaseAudioSessionOwnership();
        shouldResumeOnReleaseRef.current = true;
        return;
      }
      if (!hasNativeSession && !ownsAudioSessionRef.current) {
        shouldResumeOnReleaseRef.current = true;
        return;
      }

      const snapshot = nativeStateRef.current;
      loadedKeyRef.current = null;
      const state = await SongseedPitchShiftModule.unload();
      setNativeState(state);
      await releaseAudioSessionOwnership();
      await src.seekTo(snapshot.currentTimeMs);
      src.setPlaybackRate(snapshot.playbackRate);
      if (resumePlayback && snapshot.isPlaying) {
        await src.play();
      }
      shouldResumeOnReleaseRef.current = true;
    },
    [releaseAudioSessionOwnership]
  );

  const disableNativeTransport = useCallback(
    async (reason: string, options?: { forcePlay?: boolean }) => {
      console.warn(reason);
      setNativeTransportDisabled(true);
      await syncBackToSource(false);
      if (options?.forcePlay) {
        await sourceRef.current.play();
      }
    },
    [syncBackToSource]
  );

  const clearDisabled = useCallback(() => setNativeTransportDisabled(false), []);

  useEffect(() => {
    if (!SongseedPitchShiftModule) {
      return;
    }
    const run = async () => {
      const op = ++operationRef.current;
      const nativeModule = SongseedPitchShiftModule;
      const src = sourceRef.current;
      if (!nativeModule || !shouldOwnNativeTransport || !src.audioUri) {
        if (loadedKeyRef.current || ownsAudioSessionRef.current) {
          await syncBackToSource(shouldResumeOnReleaseRef.current && nativeStateRef.current.isPlaying);
        }
        return;
      }

      shouldResumeOnReleaseRef.current = true;
      await ensureAudioSessionOwnership();
      if (op !== operationRef.current) return;

      if (src.isPlaying) await src.pause();
      if (op !== operationRef.current) return;

      const shouldReload = loadedKeyRef.current !== src.sourceKey || !nativeStateRef.current.isLoaded;
      if (shouldReload) {
        const autoplay =
          extraAutoplay || (loadedKeyRef.current ? nativeStateRef.current.isPlaying : src.isPlaying);
        const startPositionMs =
          loadedKeyRef.current && loadedKeyRef.current !== src.sourceKey ? 0 : src.positionMs;
        const state = await nativeModule.loadForPractice({
          sourceUri: src.audioUri,
          startPositionMs,
          autoplay,
          playbackRate,
          pitchShiftSemitones: clamped,
        });
        if (op !== operationRef.current) return;
        loadedKeyRef.current = src.sourceKey;
        setNativeState(state);
        return;
      }

      if (Math.abs(nativeStateRef.current.playbackRate - playbackRate) > 0.01) {
        const state = await nativeModule.setPlaybackRate(playbackRate);
        if (op === operationRef.current) setNativeState(state);
      }
      if (nativeStateRef.current.pitchShiftSemitones !== clamped) {
        const state = await nativeModule.setPitchShiftSemitones(clamped);
        if (op === operationRef.current) setNativeState(state);
      }
    };

    void run().catch((error) => {
      void disableNativeTransport(
        `Native transport sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });
  }, [
    shouldOwnNativeTransport,
    source.sourceKey,
    source.audioUri,
    clamped,
    playbackRate,
    extraAutoplay,
    ensureAudioSessionOwnership,
    syncBackToSource,
    disableNativeTransport,
  ]);

  useEffect(() => {
    return () => {
      if (!SongseedPitchShiftModule) return;
      void SongseedPitchShiftModule.unload().catch(() => {});
      void releaseAudioSessionOwnership().catch(() => {});
      loadedKeyRef.current = null;
    };
  }, [releaseAudioSessionOwnership]);

  const play = useCallback(async () => {
    const src = sourceRef.current;
    try {
      const durationMs = isNativeTransportActive
        ? nativeStateRef.current.durationMs || src.durationMs
        : src.durationMs;
      const positionMs = isNativeTransportActive ? nativeStateRef.current.currentTimeMs : src.positionMs;
      const atEnd = restartAtEndOnPlay && isPlaybackNearEnd(positionMs, durationMs);

      if (
        SongseedPitchShiftModule &&
        shouldOwnNativeTransport &&
        !isNativeTransportActive &&
        src.audioUri &&
        src.sourceKey != null
      ) {
        await ensureAudioSessionOwnership();
        if (src.isPlaying) await src.pause();
        const state = await SongseedPitchShiftModule.loadForPractice({
          sourceUri: src.audioUri,
          startPositionMs: atEnd ? 0 : src.positionMs,
          autoplay: true,
          playbackRate,
          pitchShiftSemitones: clamped,
        });
        loadedKeyRef.current = src.sourceKey;
        setNativeState(state);
        return;
      }

      if (isNativeTransportActive && SongseedPitchShiftModule) {
        if (atEnd) {
          const seekState = await SongseedPitchShiftModule.seekTo(0);
          setNativeState(seekState);
        }
        const state = await SongseedPitchShiftModule.play();
        setNativeState(state);
        return;
      }

      if (atEnd) await src.seekTo(0);
      await src.play();
    } catch (error) {
      await disableNativeTransport(
        `Native transport play failed: ${error instanceof Error ? error.message : String(error)}`,
        { forcePlay: true }
      );
    }
  }, [
    clamped,
    disableNativeTransport,
    ensureAudioSessionOwnership,
    isNativeTransportActive,
    playbackRate,
    restartAtEndOnPlay,
    shouldOwnNativeTransport,
  ]);

  const pause = useCallback(async () => {
    try {
      if (isNativeTransportActive && SongseedPitchShiftModule) {
        const state = await SongseedPitchShiftModule.pause();
        setNativeState(state);
        return;
      }
      await sourceRef.current.pause();
    } catch (error) {
      await disableNativeTransport(
        `Native transport pause failed: ${error instanceof Error ? error.message : String(error)}`
      );
      await sourceRef.current.pause();
    }
  }, [disableNativeTransport, isNativeTransportActive]);

  const seekTo = useCallback(
    async (positionMs: number) => {
      try {
        if (isNativeTransportActive && SongseedPitchShiftModule) {
          const state = await SongseedPitchShiftModule.seekTo(positionMs);
          setNativeState(state);
          return;
        }
        await sourceRef.current.seekTo(positionMs);
      } catch (error) {
        await disableNativeTransport(
          `Native transport seek failed: ${error instanceof Error ? error.message : String(error)}`
        );
        await sourceRef.current.seekTo(positionMs);
      }
    },
    [disableNativeTransport, isNativeTransportActive]
  );

  const setPlaybackRate = useCallback(
    async (rate: number) => {
      try {
        if (isNativeTransportActive && SongseedPitchShiftModule) {
          const state = await SongseedPitchShiftModule.setPlaybackRate(rate);
          setNativeState(state);
        }
        sourceRef.current.setPlaybackRate(rate);
      } catch (error) {
        await disableNativeTransport(
          `Native transport rate change failed: ${error instanceof Error ? error.message : String(error)}`
        );
        sourceRef.current.setPlaybackRate(rate);
      }
    },
    [disableNativeTransport, isNativeTransportActive]
  );

  const togglePlay = useCallback(async () => {
    const isPlaying = isNativeTransportActive ? nativeStateRef.current.isPlaying : sourceRef.current.isPlaying;
    if (isPlaying) {
      await pause();
      return;
    }
    await play();
  }, [isNativeTransportActive, pause, play]);

  const prepareForRelease = useCallback(() => {
    shouldResumeOnReleaseRef.current = false;
  }, []);

  const effectivePositionMs = isNativeTransportActive ? nativeState.currentTimeMs : source.positionMs;
  const effectiveDurationMs = isNativeTransportActive
    ? nativeState.durationMs || source.durationMs
    : source.durationMs;
  const effectiveIsPlaying = isNativeTransportActive ? nativeState.isPlaying : source.isPlaying;
  const effectivePlaybackRate = isNativeTransportActive ? nativeState.playbackRate : playbackRate;

  return useMemo(
    () => ({
      capabilities,
      nativeState,
      nativeTransportDisabled,
      isOwningNativeTransport: shouldOwnNativeTransport,
      isNativeTransportActive,
      effectivePositionMs,
      effectiveDurationMs,
      effectiveIsPlaying,
      effectivePlaybackRate,
      play,
      pause,
      seekTo,
      setPlaybackRate,
      togglePlay,
      prepareForRelease,
      clearDisabled,
    }),
    [
      capabilities,
      clearDisabled,
      effectiveDurationMs,
      effectiveIsPlaying,
      effectivePlaybackRate,
      effectivePositionMs,
      isNativeTransportActive,
      nativeState,
      nativeTransportDisabled,
      pause,
      play,
      prepareForRelease,
      seekTo,
      setPlaybackRate,
      shouldOwnNativeTransport,
      togglePlay,
    ]
  );
}
