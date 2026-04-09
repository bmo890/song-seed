import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SongseedPitchShiftModule from "../../../../modules/songseed-pitch-shift";
import type {
  NativePitchShiftCapabilities,
  NativePitchShiftPlaybackState,
} from "../../../../modules/songseed-pitch-shift";
import {
  activatePlaybackAudioSession,
  createAudioSessionOwner,
  releaseAudioSessionOwner,
} from "../../../services/audioSession";
import { useStore } from "../../../state/useStore";
import {
  buildUnavailablePitchShiftCapabilities,
  clampPitchShiftSemitones,
  type PitchShiftCapabilities,
} from "../../../pitchShift";

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

type Args = {
  mode: "player" | "practice";
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
  const [capabilities, setCapabilities] = useState<PitchShiftCapabilities>(
    buildUnavailablePitchShiftCapabilities()
  );
  const [nativeState, setNativeState] =
    useState<NativePitchShiftPlaybackState>(DEFAULT_PLAYBACK_STATE);
  const [nativeTransportDisabled, setNativeTransportDisabled] = useState(false);
  const [finishedPlaybackToken, setFinishedPlaybackToken] = useState(0);
  const [finishedPlaybackClipId, setFinishedPlaybackClipId] = useState<string | null>(null);
  const nativeStateRef = useRef(nativeState);
  const nativeTransportStickyRef = useRef(false);
  const loadedClipIdRef = useRef<string | null>(null);
  const operationRef = useRef(0);
  const shouldResumeOnReleaseRef = useRef(true);
  const audioSessionOwnerIdRef = useRef(createAudioSessionOwner("player-screen"));
  const ownsAudioSessionRef = useRef(false);
  const lastPublishedPlaybackRef = useRef({
    at: 0,
    positionMs: 0,
    durationMs: 0,
    isPlaying: false,
  });
  const setPlayerPlaybackState = useStore((s) => s.setPlayerPlaybackState);
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
        console.warn("Pitch shift capabilities lookup failed", error);
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
      if (loadedClipIdRef.current) {
        setFinishedPlaybackClipId(loadedClipIdRef.current);
        setFinishedPlaybackToken((prev) => prev + 1);
      }
    });
    const errorSub = SongseedPitchShiftModule.addListener("onError", ({ message }) => {
      console.warn("Pitch shift playback error", message);
      nativeTransportStickyRef.current = false;
      setNativeTransportDisabled(true);
    });

    return () => {
      cancelled = true;
      stateSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, []);

  useEffect(() => {
    if (mode !== "practice" || !isFocused) {
      nativeTransportStickyRef.current = false;
      setNativeTransportDisabled(false);
      return;
    }

    if (clampedPitchShiftSemitones !== 0) {
      nativeTransportStickyRef.current = true;
      if (nativeTransportDisabled) {
        setNativeTransportDisabled(false);
      }
    }
  }, [clampedPitchShiftSemitones, isFocused, mode, nativeTransportDisabled]);

  const shouldOwnNativeTransport =
    mode === "practice" &&
    isFocused &&
    capabilities.supportsPracticePlayback &&
    !nativeTransportDisabled &&
    !!clip?.audioUri &&
    (nativeTransportStickyRef.current || clampedPitchShiftSemitones !== 0);
  const isNativeTransportActive =
    shouldOwnNativeTransport &&
    !!clip?.id &&
    loadedClipIdRef.current === clip.id &&
    nativeState.isLoaded;

  const ensureAudioSessionOwnership = useCallback(async () => {
    if (ownsAudioSessionRef.current) {
      return;
    }
    await activatePlaybackAudioSession({
      ownerId: audioSessionOwnerIdRef.current,
    });
    ownsAudioSessionRef.current = true;
  }, []);

  const releaseAudioSessionOwnership = useCallback(async () => {
    if (!ownsAudioSessionRef.current) {
      return;
    }
    ownsAudioSessionRef.current = false;
    await releaseAudioSessionOwner(audioSessionOwnerIdRef.current);
  }, []);

  const syncBackToFullPlayer = useCallback(
    async (resumePlayback: boolean) => {
      const hasNativeSession = loadedClipIdRef.current || nativeStateRef.current.isLoaded;

      if (!SongseedPitchShiftModule) {
        if (ownsAudioSessionRef.current) {
          await releaseAudioSessionOwnership();
        }
        shouldResumeOnReleaseRef.current = true;
        return;
      }

      if (!hasNativeSession && !ownsAudioSessionRef.current) {
        shouldResumeOnReleaseRef.current = true;
        return;
      }

      const snapshot = nativeStateRef.current;
      loadedClipIdRef.current = null;
      const state = await SongseedPitchShiftModule.unload();
      setNativeState(state);
      await releaseAudioSessionOwnership();
      await seekFullPlayerTo(snapshot.currentTimeMs);
      setFullPlayerPlaybackRate(snapshot.playbackRate);
      if (resumePlayback && snapshot.isPlaying) {
        await playFullPlayer();
      }
      shouldResumeOnReleaseRef.current = true;
    },
    [
      playFullPlayer,
      releaseAudioSessionOwnership,
      seekFullPlayerTo,
      setFullPlayerPlaybackRate,
    ]
  );

  const disableNativeTransport = useCallback(
    async (reason: string, options?: { forcePlay?: boolean }) => {
      console.warn(reason);
      nativeTransportStickyRef.current = false;
      setNativeTransportDisabled(true);
      await syncBackToFullPlayer(false);
      if (options?.forcePlay) {
        await playFullPlayer();
      }
    },
    [playFullPlayer, syncBackToFullPlayer]
  );

  useEffect(() => {
    if (!SongseedPitchShiftModule) {
      return;
    }

    const run = async () => {
      const op = ++operationRef.current;
      const nativeModule = SongseedPitchShiftModule;

      if (!nativeModule || !shouldOwnNativeTransport || !clip?.audioUri) {
        if (loadedClipIdRef.current || ownsAudioSessionRef.current) {
          await syncBackToFullPlayer(
            shouldResumeOnReleaseRef.current && nativeStateRef.current.isPlaying
          );
        }
        return;
      }

      shouldResumeOnReleaseRef.current = true;
      await ensureAudioSessionOwnership();
      if (op !== operationRef.current) {
        return;
      }

      if (fullPlayerIsPlaying) {
        await pauseFullPlayer();
      }
      if (op !== operationRef.current) {
        return;
      }

      const nextPitch = clampedPitchShiftSemitones;
      const shouldReload =
        loadedClipIdRef.current !== clip.id || !nativeStateRef.current.isLoaded;

      if (shouldReload) {
        const shouldAutoplay =
          playerShouldAutoplay ||
          (loadedClipIdRef.current ? nativeStateRef.current.isPlaying : fullPlayerIsPlaying);
        const startPositionMs =
          loadedClipIdRef.current && loadedClipIdRef.current !== clip.id
            ? 0
            : fullPlayerPosition;
        const state = await nativeModule.loadForPractice({
          sourceUri: clip.audioUri,
          startPositionMs,
          autoplay: shouldAutoplay,
          playbackRate: fullPlayerPlaybackRate,
          pitchShiftSemitones: nextPitch,
        });
        if (op !== operationRef.current) {
          return;
        }
        loadedClipIdRef.current = clip.id;
        setNativeState(state);
        return;
      }

      if (Math.abs(nativeStateRef.current.playbackRate - fullPlayerPlaybackRate) > 0.01) {
        const state = await nativeModule.setPlaybackRate(fullPlayerPlaybackRate);
        if (op === operationRef.current) {
          setNativeState(state);
        }
      }

      if (nativeStateRef.current.pitchShiftSemitones !== nextPitch) {
        const state = await nativeModule.setPitchShiftSemitones(nextPitch);
        if (op === operationRef.current) {
          setNativeState(state);
        }
      }
    };

    void run().catch((error) => {
      void disableNativeTransport(
        `Player native transport sync failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    });
  }, [
    clip?.audioUri,
    clip?.id,
    clampedPitchShiftSemitones,
    disableNativeTransport,
    ensureAudioSessionOwnership,
    fullPlayerIsPlaying,
    fullPlayerPlaybackRate,
    fullPlayerPosition,
    isFocused,
    mode,
    nativeTransportDisabled,
    pauseFullPlayer,
    playerShouldAutoplay,
    shouldOwnNativeTransport,
    syncBackToFullPlayer,
  ]);

  useEffect(() => {
    if (!shouldOwnNativeTransport || !isNativeTransportActive) {
      return;
    }

    const now = Date.now();
    const lastPublished = lastPublishedPlaybackRef.current;
    const shouldPublish =
      lastPublished.isPlaying !== nativeState.isPlaying ||
      lastPublished.durationMs !== nativeState.durationMs ||
      now - lastPublished.at >= 150 ||
      Math.abs(nativeState.currentTimeMs - lastPublished.positionMs) >= 250;

    if (!shouldPublish) {
      return;
    }

    setPlayerPlaybackState({
      positionMs: nativeState.currentTimeMs,
      durationMs: nativeState.durationMs,
      isPlaying: nativeState.isPlaying,
    });
    lastPublishedPlaybackRef.current = {
      at: now,
      positionMs: nativeState.currentTimeMs,
      durationMs: nativeState.durationMs,
      isPlaying: nativeState.isPlaying,
    };
  }, [
    isNativeTransportActive,
    nativeState.currentTimeMs,
    nativeState.durationMs,
    nativeState.isPlaying,
    setPlayerPlaybackState,
    shouldOwnNativeTransport,
  ]);

  useEffect(() => {
    return () => {
      if (!SongseedPitchShiftModule) {
        return;
      }
      void SongseedPitchShiftModule.unload().catch(() => {});
      void releaseAudioSessionOwnership().catch(() => {});
      loadedClipIdRef.current = null;
    };
  }, [releaseAudioSessionOwnership]);

  const play = useCallback(async () => {
    try {
      if (SongseedPitchShiftModule && shouldOwnNativeTransport) {
        await ensureAudioSessionOwnership();
      }

      if (
        SongseedPitchShiftModule &&
        shouldOwnNativeTransport &&
        !isNativeTransportActive &&
        clip?.audioUri &&
        clip?.id
      ) {
        if (fullPlayerIsPlaying) {
          await pauseFullPlayer();
        }
        const state = await SongseedPitchShiftModule.loadForPractice({
          sourceUri: clip.audioUri,
          startPositionMs: fullPlayerPosition,
          autoplay: true,
          playbackRate: fullPlayerPlaybackRate,
          pitchShiftSemitones: clampedPitchShiftSemitones,
        });
        loadedClipIdRef.current = clip.id;
        setNativeState(state);
        return;
      }

      if (isNativeTransportActive && SongseedPitchShiftModule) {
        const state = await SongseedPitchShiftModule.play();
        setNativeState(state);
        return;
      }
      await playFullPlayer();
    } catch (error) {
      await disableNativeTransport(
        `Player native transport play failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { forcePlay: true }
      );
    }
  }, [
    disableNativeTransport,
    clip?.audioUri,
    clip?.id,
    clampedPitchShiftSemitones,
    ensureAudioSessionOwnership,
    fullPlayerIsPlaying,
    fullPlayerPlaybackRate,
    fullPlayerPosition,
    isNativeTransportActive,
    pauseFullPlayer,
    playFullPlayer,
    shouldOwnNativeTransport,
  ]);

  const pause = useCallback(async () => {
    try {
      if (isNativeTransportActive && SongseedPitchShiftModule) {
        const state = await SongseedPitchShiftModule.pause();
        setNativeState(state);
        return;
      }
      await pauseFullPlayer();
    } catch (error) {
      await disableNativeTransport(
        `Player native transport pause failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      await pauseFullPlayer();
    }
  }, [disableNativeTransport, isNativeTransportActive, pauseFullPlayer]);

  const seekTo = useCallback(
    async (positionMs: number) => {
      try {
        if (isNativeTransportActive && SongseedPitchShiftModule) {
          const state = await SongseedPitchShiftModule.seekTo(positionMs);
          setNativeState(state);
          return;
        }
        await seekFullPlayerTo(positionMs);
      } catch (error) {
        await disableNativeTransport(
          `Player native transport seek failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        await seekFullPlayerTo(positionMs);
      }
    },
    [disableNativeTransport, isNativeTransportActive, seekFullPlayerTo]
  );

  const setPlaybackRate = useCallback(
    async (rate: number) => {
      try {
        if (isNativeTransportActive && SongseedPitchShiftModule) {
          const state = await SongseedPitchShiftModule.setPlaybackRate(rate);
          setNativeState(state);
        }
        setFullPlayerPlaybackRate(rate);
      } catch (error) {
        await disableNativeTransport(
          `Player native transport rate change failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        setFullPlayerPlaybackRate(rate);
      }
    },
    [disableNativeTransport, isNativeTransportActive, setFullPlayerPlaybackRate]
  );

  const togglePlay = useCallback(async () => {
    const isPlaying = isNativeTransportActive
      ? nativeStateRef.current.isPlaying
      : fullPlayerIsPlaying;
    if (isPlaying) {
      await pause();
      return;
    }
    await play();
  }, [fullPlayerIsPlaying, isNativeTransportActive, pause, play]);

  const prepareForPlayerClose = useCallback(() => {
    shouldResumeOnReleaseRef.current = false;
  }, []);

  const effectivePositionMs = isNativeTransportActive
    ? nativeState.currentTimeMs
    : fullPlayerPosition;
  const effectiveDurationMs = isNativeTransportActive
    ? nativeState.durationMs || fullPlayerDuration
    : fullPlayerDuration;
  const effectiveIsPlaying = isNativeTransportActive
    ? nativeState.isPlaying
    : fullPlayerIsPlaying;
  const effectivePlaybackRate = isNativeTransportActive
    ? nativeState.playbackRate
    : fullPlayerPlaybackRate;

  return useMemo(
    () => ({
      capabilities,
      effectivePositionMs,
      effectiveDurationMs,
      effectiveIsPlaying,
      effectivePlaybackRate,
      finishedPlaybackToken: isNativeTransportActive ? finishedPlaybackToken : 0,
      finishedPlaybackClipId: isNativeTransportActive ? finishedPlaybackClipId : null,
      isOwningNativeTransport: shouldOwnNativeTransport,
      isPitchShiftAvailable:
        capabilities.supportsPracticePlayback && !nativeTransportDisabled,
      play,
      pause,
      seekTo,
      setPlaybackRate,
      togglePlay,
      prepareForPlayerClose,
      shouldSuppressSourceAutoplay: shouldOwnNativeTransport,
    }),
    [
      capabilities,
      effectiveDurationMs,
      effectiveIsPlaying,
      effectivePlaybackRate,
      effectivePositionMs,
      finishedPlaybackClipId,
      finishedPlaybackToken,
      isNativeTransportActive,
      nativeTransportDisabled,
      pause,
      play,
      prepareForPlayerClose,
      seekTo,
      setPlaybackRate,
      shouldOwnNativeTransport,
      togglePlay,
    ]
  );
}
