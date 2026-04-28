import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SongseedPitchShiftModule, {
  type NativePitchShiftCapabilities,
  type NativePitchShiftPlaybackState,
} from "../../../../modules/songseed-pitch-shift";
import {
  activatePlaybackAudioSession,
  createAudioSessionOwner,
  releaseAudioSessionOwner,
} from "../../../services/audioSession";
import { isPlaybackNearEnd } from "../../../services/transportPlayback";
import { buildUnavailablePitchShiftCapabilities, clampPitchShiftSemitones, type PitchShiftCapabilities } from "../../../pitchShift";

const DEFAULT_PLAYBACK_STATE: NativePitchShiftPlaybackState = {
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

function normalizeCapabilities(
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
  const [capabilities, setCapabilities] = useState<PitchShiftCapabilities>(
    buildUnavailablePitchShiftCapabilities()
  );
  const [nativeState, setNativeState] =
    useState<NativePitchShiftPlaybackState>(DEFAULT_PLAYBACK_STATE);
  const [nativeTransportDisabled, setNativeTransportDisabled] = useState(false);
  const nativeStateRef = useRef(nativeState);
  const loadedSourceRef = useRef<string | null>(null);
  const operationRef = useRef(0);
  const resumeOnReleaseRef = useRef(true);
  const audioSessionOwnerIdRef = useRef(createAudioSessionOwner("editor-screen"));
  const ownsAudioSessionRef = useRef(false);
  const clampedPitchShiftSemitones = clampPitchShiftSemitones(pitchShiftSemitones);

  nativeStateRef.current = nativeState;

  useEffect(() => {
    if (!SongseedPitchShiftModule) {
      return;
    }

    let cancelled = false;
    void SongseedPitchShiftModule.getCapabilities()
      .then((value) => {
        if (!cancelled) {
          setCapabilities(normalizeCapabilities(value));
        }
      })
      .catch((error) => {
        console.warn("Editor pitch preview capabilities lookup failed", error);
      });

    void SongseedPitchShiftModule.getPlaybackState()
      .then((value) => {
        if (!cancelled) {
          setNativeState(value);
        }
      })
      .catch(() => {});

    const stateSub = SongseedPitchShiftModule.addListener("onStateChange", (value) => {
      setNativeState(value);
    });
    const endSub = SongseedPitchShiftModule.addListener("onPlaybackEnded", (value) => {
      setNativeState(value);
    });
    const errorSub = SongseedPitchShiftModule.addListener("onError", ({ message }) => {
      console.warn("Editor pitch preview error", message);
      setNativeTransportDisabled(true);
    });

    return () => {
      cancelled = true;
      stateSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, []);

  const shouldUseNativeTransport =
    isFocused &&
    !!audioUri &&
    clampedPitchShiftSemitones !== 0 &&
    capabilities.supportsEditorPreview &&
    !nativeTransportDisabled;
  const isNativeTransportActive =
    shouldUseNativeTransport &&
    loadedSourceRef.current === audioUri &&
    nativeState.isLoaded;

  const ensureAudioSessionOwnership = useCallback(async () => {
    if (ownsAudioSessionRef.current) {
      return;
    }
    await activatePlaybackAudioSession({ ownerId: audioSessionOwnerIdRef.current });
    ownsAudioSessionRef.current = true;
  }, []);

  const releaseAudioSessionOwnership = useCallback(async () => {
    if (!ownsAudioSessionRef.current) {
      return;
    }
    ownsAudioSessionRef.current = false;
    await releaseAudioSessionOwner(audioSessionOwnerIdRef.current);
  }, []);

  const syncBackToSource = useCallback(
    async (resumePlayback: boolean) => {
      const snapshot = nativeStateRef.current;
      loadedSourceRef.current = null;

      if (SongseedPitchShiftModule) {
        try {
          const state = await SongseedPitchShiftModule.unload();
          setNativeState(state);
        } catch {}
      }

      await releaseAudioSessionOwnership();
      setSourcePlaybackRate(snapshot.playbackRate);
      await seekSourceTo(snapshot.currentTimeMs);
      if (resumePlayback && snapshot.isPlaying) {
        await playSource();
      }
    },
    [playSource, releaseAudioSessionOwnership, seekSourceTo, setSourcePlaybackRate]
  );

  const disableNativeTransport = useCallback(
    async (reason: string) => {
      console.warn(reason);
      setNativeTransportDisabled(true);
      await syncBackToSource(false);
    },
    [syncBackToSource]
  );

  useEffect(() => {
    setSourcePlaybackRate(playbackRate);
  }, [playbackRate, setSourcePlaybackRate]);

  useEffect(() => {
    if (!SongseedPitchShiftModule) {
      return;
    }

    const run = async () => {
      const op = ++operationRef.current;
      const nativeModule = SongseedPitchShiftModule;
      if (!nativeModule) {
        return;
      }

      if (!shouldUseNativeTransport || !audioUri) {
        if (loadedSourceRef.current || ownsAudioSessionRef.current) {
          await syncBackToSource(resumeOnReleaseRef.current && nativeStateRef.current.isPlaying);
        }
        return;
      }

      await ensureAudioSessionOwnership();
      if (op !== operationRef.current) {
        return;
      }

      if (sourceIsPlaying) {
        await pauseSource();
      }
      if (op !== operationRef.current) {
        return;
      }

      const shouldReload = loadedSourceRef.current !== audioUri || !nativeStateRef.current.isLoaded;
      if (shouldReload) {
        const state = await nativeModule.loadForPractice({
          sourceUri: audioUri,
          startPositionMs: sourcePositionMs,
          autoplay: sourceIsPlaying,
          playbackRate,
          pitchShiftSemitones: clampedPitchShiftSemitones,
        });
        if (op !== operationRef.current) {
          return;
        }
        loadedSourceRef.current = audioUri;
        setNativeState(state);
        return;
      }

      if (Math.abs(nativeStateRef.current.playbackRate - playbackRate) > 0.01) {
        const state = await nativeModule.setPlaybackRate(playbackRate);
        if (op === operationRef.current) {
          setNativeState(state);
        }
      }

      if (nativeStateRef.current.pitchShiftSemitones !== clampedPitchShiftSemitones) {
        const state = await nativeModule.setPitchShiftSemitones(clampedPitchShiftSemitones);
        if (op === operationRef.current) {
          setNativeState(state);
        }
      }
    };

    void run().catch((error) => {
      void disableNativeTransport(
        `Editor native preview sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
  }, [
    audioUri,
    clampedPitchShiftSemitones,
    disableNativeTransport,
    ensureAudioSessionOwnership,
    pauseSource,
    playbackRate,
    shouldUseNativeTransport,
    sourceIsPlaying,
    sourcePositionMs,
    syncBackToSource,
  ]);

  useEffect(() => {
    return () => {
      if (!SongseedPitchShiftModule) {
        return;
      }
      void SongseedPitchShiftModule.unload().catch(() => {});
      void releaseAudioSessionOwnership().catch(() => {});
      loadedSourceRef.current = null;
    };
  }, [releaseAudioSessionOwnership]);

  const play = useCallback(async () => {
    try {
      const normalizedDurationMs = isNativeTransportActive
        ? nativeStateRef.current.durationMs || sourceDurationMs
        : sourceDurationMs;
      const normalizedPositionMs = isNativeTransportActive
        ? nativeStateRef.current.currentTimeMs
        : sourcePositionMs;
      const isAtEnd = isPlaybackNearEnd(normalizedPositionMs, normalizedDurationMs);

      if (
        SongseedPitchShiftModule &&
        shouldUseNativeTransport &&
        !isNativeTransportActive &&
        audioUri
      ) {
        await ensureAudioSessionOwnership();
        if (sourceIsPlaying) {
          await pauseSource();
        }
        const state = await SongseedPitchShiftModule.loadForPractice({
          sourceUri: audioUri,
          startPositionMs: isAtEnd ? 0 : sourcePositionMs,
          autoplay: true,
          playbackRate,
          pitchShiftSemitones: clampedPitchShiftSemitones,
        });
        loadedSourceRef.current = audioUri;
        setNativeState(state);
        return;
      }

      if (isNativeTransportActive && SongseedPitchShiftModule) {
        if (isAtEnd) {
          const seekState = await SongseedPitchShiftModule.seekTo(0);
          setNativeState(seekState);
        }
        const state = await SongseedPitchShiftModule.play();
        setNativeState(state);
        return;
      }

      if (isAtEnd) {
        await seekSourceTo(0);
      }
      await playSource();
    } catch (error) {
      await disableNativeTransport(
        `Editor native preview play failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await playSource();
    }
  }, [
    audioUri,
    clampedPitchShiftSemitones,
    disableNativeTransport,
    ensureAudioSessionOwnership,
    isNativeTransportActive,
    pauseSource,
    pitchShiftSemitones,
    playbackRate,
    playSource,
    seekSourceTo,
    shouldUseNativeTransport,
    sourceIsPlaying,
    sourceDurationMs,
    sourcePositionMs,
  ]);

  const pause = useCallback(async () => {
    try {
      if (isNativeTransportActive && SongseedPitchShiftModule) {
        const state = await SongseedPitchShiftModule.pause();
        setNativeState(state);
        return;
      }
      await pauseSource();
    } catch (error) {
      await disableNativeTransport(
        `Editor native preview pause failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await pauseSource();
    }
  }, [disableNativeTransport, isNativeTransportActive, pauseSource]);

  const seekTo = useCallback(
    async (positionMs: number) => {
      try {
        if (isNativeTransportActive && SongseedPitchShiftModule) {
          const state = await SongseedPitchShiftModule.seekTo(positionMs);
          setNativeState(state);
          return;
        }
        await seekSourceTo(positionMs);
      } catch (error) {
        await disableNativeTransport(
          `Editor native preview seek failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        await seekSourceTo(positionMs);
      }
    },
    [disableNativeTransport, isNativeTransportActive, seekSourceTo]
  );

  const togglePlay = useCallback(async () => {
    const isPlaying = isNativeTransportActive ? nativeStateRef.current.isPlaying : sourceIsPlaying;
    if (isPlaying) {
      await pause();
      return;
    }
    await play();
  }, [isNativeTransportActive, pause, play, sourceIsPlaying]);

  const effectivePositionMs = isNativeTransportActive ? nativeState.currentTimeMs : sourcePositionMs;
  const effectiveDurationMs = isNativeTransportActive
    ? nativeState.durationMs || sourceDurationMs
    : sourceDurationMs;
  const effectiveIsPlaying = isNativeTransportActive ? nativeState.isPlaying : sourceIsPlaying;
  const effectivePlaybackRate = isNativeTransportActive ? nativeState.playbackRate : playbackRate;

  return useMemo(
    () => ({
      capabilities,
      effectivePositionMs,
      effectiveDurationMs,
      effectiveIsPlaying,
      effectivePlaybackRate,
      isPitchPreviewAvailable: capabilities.supportsEditorPreview && !nativeTransportDisabled,
      isUsingNativePitchPreview: isNativeTransportActive,
      play,
      pause,
      seekTo,
      togglePlay,
    }),
    [
      capabilities,
      effectiveDurationMs,
      effectiveIsPlaying,
      effectivePlaybackRate,
      effectivePositionMs,
      isNativeTransportActive,
      nativeTransportDisabled,
      pause,
      play,
      seekTo,
      togglePlay,
    ]
  );
}
