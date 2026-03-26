import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipVersion, PlayerTarget } from "../types";
import { buildStaticWaveform } from "../utils";
import { activateAndPlay, replacePlaybackSource } from "../services/transportPlayback";
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
  const setPlayerPlaybackState = useStore((s) => s.setPlayerPlaybackState);

  const playerOptions = useMemo(() => ({ updateInterval: 33 }), []);
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
    setPlayerPlaybackState({
      positionMs: playerPosition,
      durationMs: playerDuration,
      isPlaying: isPlayerPlaying,
    });
  }, [isPlayerPlaying, playerDuration, playerPosition, setPlayerPlaybackState]);

  const activateLockScreenControls = useCallback((metadata?: LockScreenMetadata) => {
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
      activateLockScreenControls(lockScreenMetadataRef.current);
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
    if (!clip.audioUri) return;
    const operationId = ++operationIdRef.current;
    lockScreenMetadataRef.current = metadata;

    if (onBeforePlayNew) await onBeforePlayNew();
    if (!isOperationActive(operationId)) return;

    try {
      await player.pause();
      if (!isOperationActive(operationId)) return;

      await replacePlaybackSource(player, clip.audioUri, autoPlay);
      if (!isOperationActive(operationId)) return;
      // Publish the active target only after the source has loaded. That keeps the UI and
      // persisted player state from pointing at a clip that never actually became playable.
      setPlayerTarget({ ideaId, clipId: clip.id });
      setWaveformPeaks(
        clip.waveformPeaks?.length
          ? clip.waveformPeaks
          : buildStaticWaveform(`${clip.id}-${clip.durationMs ?? 0}`)
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
