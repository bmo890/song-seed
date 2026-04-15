import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { ClipVersion, PlayerTarget } from "../types";
import {
  getClipPlaybackDurationMs,
  getClipPlaybackUri,
  getClipPlaybackWaveformPeaks,
} from "../clipPresentation";
import { buildStaticWaveform } from "../utils";
import { activateAndPlay, replacePlaybackSource } from "../services/transportPlayback";
import { MANAGED_WAVEFORM_PEAK_COUNT } from "../services/audioStorage";
import { useStore } from "../state/useStore";

type Args = {
  onBeforePlayNew?: () => Promise<void> | void;
};

type LockScreenMetadata = {
  title?: string;
  albumTitle?: string;
};

export function useFullPlayer({ onBeforePlayNew }: Args = {}) {
  const [playerTarget, setPlayerTarget] = useState<PlayerTarget>(null);
  const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
  const [finishedPlaybackToken, setFinishedPlaybackToken] = useState(0);
  const [finishedPlaybackClipId, setFinishedPlaybackClipId] = useState<string | null>(null);
  const operationIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const previousDidJustFinishRef = useRef(false);
  const lastPublishedPlaybackRef = useRef({
    at: 0,
    positionMs: 0,
    durationMs: 0,
    isPlaying: false,
  });
  const setPlayerPlaybackState = useStore((s) => s.setPlayerPlaybackState);

  const playerOptions = useMemo(() => ({ updateInterval: 50 }), []);
  const player = useAudioPlayer(null, playerOptions);
  const status = useAudioPlayerStatus(player);
  const playerPosition = Math.round((status.currentTime ?? 0) * 1000);
  const playerDuration = Math.round((status.duration ?? 0) * 1000);
  const isPlayerPlaying = !!status.playing && !status.didJustFinish;
  const didPlayerJustFinish = !!status.didJustFinish;
  const playbackRate = status.playbackRate ?? 1;
  // Keep transport callbacks stable. PlayerScreen is always mounted, so function identity churn
  // here can retrigger effect chains and store updates on every render.
  const statusRef = useRef(status);
  const playerPositionRef = useRef(playerPosition);
  const playerDurationRef = useRef(playerDuration);
  const lockScreenMetadataRef = useRef<LockScreenMetadata | undefined>(undefined);
  const isLockScreenActiveRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    statusRef.current = status;
    playerPositionRef.current = playerPosition;
    playerDurationRef.current = playerDuration;
  }, [playerDuration, playerPosition, status]);

  useEffect(() => {
    const justFinishedNow = didPlayerJustFinish && !previousDidJustFinishRef.current;
    if (justFinishedNow) {
      setFinishedPlaybackClipId(playerTarget?.clipId ?? null);
      setFinishedPlaybackToken((prev) => prev + 1);
    }
    previousDidJustFinishRef.current = didPlayerJustFinish;
  }, [didPlayerJustFinish, playerTarget?.clipId]);

  useEffect(() => {
    const now = Date.now();
    const lastPublished = lastPublishedPlaybackRef.current;
    const shouldPublish =
      lastPublished.isPlaying !== isPlayerPlaying ||
      lastPublished.durationMs !== playerDuration ||
      now - lastPublished.at >= 150 ||
      Math.abs(playerPosition - lastPublished.positionMs) >= 250;

    if (!shouldPublish) {
      return;
    }

    setPlayerPlaybackState({
      positionMs: playerPosition,
      durationMs: playerDuration,
      isPlaying: isPlayerPlaying,
    });
    lastPublishedPlaybackRef.current = {
      at: now,
      positionMs: playerPosition,
      durationMs: playerDuration,
      isPlaying: isPlayerPlaying,
    };
  }, [isPlayerPlaying, playerDuration, playerPosition, setPlayerPlaybackState]);

  const activateLockScreenControls = useCallback((metadata?: LockScreenMetadata) => {
    try {
      player.setActiveForLockScreen(
        true,
        {
          ...metadata,
          artist: "SongSeed",
        },
        {
          showSeekBackward: true,
          showSeekForward: true,
        }
      );
      isLockScreenActiveRef.current = true;
    } catch (error) {
      isLockScreenActiveRef.current = false;
      const message = error instanceof Error ? error.message : String(error);
      const isBackgroundStartRestriction =
        Platform.OS === "android" &&
        message.includes("ForegroundServiceStartNotAllowedException");

      if (!isBackgroundStartRestriction) {
        console.warn("FULL lock screen activate error", error);
      }
    }
  }, [player]);

  const clearLockScreenControls = useCallback(() => {
    try {
      player.clearLockScreenControls();
    } catch {
      // ignore released player cleanup races
    }
    isLockScreenActiveRef.current = false;
  }, [player]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;

      if (nextState === "active" && isPlayerPlaying && !isLockScreenActiveRef.current) {
        activateLockScreenControls(lockScreenMetadataRef.current);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [activateLockScreenControls, isPlayerPlaying]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      operationIdRef.current += 1;
      setPlayerPlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
      clearLockScreenControls();
    };
  }, [clearLockScreenControls, setPlayerPlaybackState]);

  useEffect(() => {
    if (isPlayerPlaying) {
      if (appStateRef.current === "active") {
        activateLockScreenControls(lockScreenMetadataRef.current);
      }
      return;
    }
    clearLockScreenControls();
  }, [activateLockScreenControls, clearLockScreenControls, isPlayerPlaying]);

  const isOperationActive = useCallback(
    (operationId: number) => isMountedRef.current && operationIdRef.current === operationId,
    []
  );

  const closePlayer = useCallback(async () => {
    const operationId = ++operationIdRef.current;
    try {
      await player.pause();
    } catch {
      // ignore stale player shutdown errors
    }
    if (!isOperationActive(operationId)) return;
    clearLockScreenControls();
    setPlayerPlaybackState({
      positionMs: 0,
      durationMs: 0,
      isPlaying: false,
    });
    setPlayerTarget(null);
    setWaveformPeaks([]);
  }, [clearLockScreenControls, isOperationActive, player, setPlayerPlaybackState]);

  const openPlayer = useCallback(async (
    ideaId: string,
    clip: ClipVersion,
    metadata?: LockScreenMetadata,
    autoPlay = false
  ) => {
    const playbackUri = getClipPlaybackUri(clip);
    if (!playbackUri) return;
    const operationId = ++operationIdRef.current;
    lockScreenMetadataRef.current = metadata;

    if (onBeforePlayNew) await onBeforePlayNew();
    if (!isOperationActive(operationId)) return;

    try {
      await player.pause();
      if (!isOperationActive(operationId)) return;

      await replacePlaybackSource(player, playbackUri, autoPlay);
      if (!isOperationActive(operationId)) return;
      // Publish the active target only after the source has loaded. That keeps the UI and
      // persisted player state from pointing at a clip that never actually became playable.
      setPlayerTarget({ ideaId, clipId: clip.id });
      const playbackWaveformPeaks = getClipPlaybackWaveformPeaks(clip);
      setWaveformPeaks(
        playbackWaveformPeaks?.length
          ? playbackWaveformPeaks
          : buildStaticWaveform(
              `${clip.id}-${getClipPlaybackDurationMs(clip) ?? 0}`,
              MANAGED_WAVEFORM_PEAK_COUNT
            )
      );
    } catch (err) {
      setPlayerPlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
      useStore.getState().clearPlayerQueue();
      setPlayerTarget(null);
      setWaveformPeaks([]);
      console.log("FULL open error", err);
    }
  }, [isOperationActive, onBeforePlayNew, player, setPlayerPlaybackState]);

  const updateLockScreenMetadata = useCallback((metadata?: LockScreenMetadata) => {
    lockScreenMetadataRef.current = metadata;
    if (!isLockScreenActiveRef.current) {
      return;
    }
    player.updateLockScreenMetadata({
      ...metadata,
      artist: "SongSeed",
    });
  }, [player]);

  const togglePlayer = useCallback(async () => {
    const latestStatus = statusRef.current;
    try {
      if (latestStatus.playing) {
        await player.pause();
        return;
      }

      await activateAndPlay(
        player,
        latestStatus,
        playerDurationRef.current,
        playerPositionRef.current
      );
    } catch (err) {
      console.log("FULL play error", err);
    }
  }, [player]);

  const pausePlayer = useCallback(async () => {
    try {
      await player.pause();
    } catch (err) {
      console.log("FULL pause error", err);
    }
  }, [player]);

  const playPlayer = useCallback(async () => {
    const latestStatus = statusRef.current;
    try {
      await activateAndPlay(
        player,
        latestStatus,
        playerDurationRef.current,
        playerPositionRef.current
      );
    } catch (err) {
      console.log("FULL resume error", err);
    }
  }, [player]);

  const seekTo = useCallback(async (ms: number) => {
    const latestStatus = statusRef.current;
    const durationMs = playerDurationRef.current || Math.round((latestStatus.duration ?? 0) * 1000);
    const targetMs = Math.max(0, Math.min(ms, durationMs || ms));
    await player.seekTo(targetMs / 1000);
  }, [player]);

  const seekBy = useCallback(async (delta: number) => {
    await seekTo(playerPositionRef.current + delta);
  }, [seekTo]);

  const setPlaybackRate = useCallback((rate: number) => {
    const nextRate = Math.max(0.5, Math.min(rate, 2));
    try {
      player.setPlaybackRate(nextRate);
    } catch (err) {
      console.log("FULL setPlaybackRate error", err);
    }
  }, [player]);

  return {
    playerTarget,
    playerPosition,
    playerDuration,
    isPlayerPlaying,
    didPlayerJustFinish,
    playbackRate,
    finishedPlaybackToken,
    finishedPlaybackClipId,
    waveformPeaks,
    openPlayer,
    closePlayer,
    togglePlayer,
    pausePlayer,
    playPlayer,
    seekTo,
    seekBy,
    setPlaybackRate,
    updateLockScreenMetadata,
  };
}
