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

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      operationIdRef.current += 1;
      setPlayerPlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
      try {
        player.clearLockScreenControls();
      } catch {
        // ignore released player cleanup races on unmount
      }
    };
  }, [player, setPlayerPlaybackState]);

  const isOperationActive = (operationId: number) => isMountedRef.current && operationIdRef.current === operationId;

  function activateLockScreenControls(metadata?: LockScreenMetadata) {
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
  }

  async function closePlayer() {
    const operationId = ++operationIdRef.current;
    try {
      await player.pause();
    } catch {
      // ignore stale player shutdown errors
    }
    if (!isOperationActive(operationId)) return;
    try {
      player.clearLockScreenControls();
    } catch {
      // ignore released player cleanup races
    }
    setPlayerPlaybackState({
      positionMs: 0,
      durationMs: 0,
      isPlaying: false,
    });
    setPlayerTarget(null);
    setWaveformPeaks([]);
  }

  async function openPlayer(ideaId: string, clip: ClipVersion, metadata?: LockScreenMetadata, autoPlay = false) {
    if (!clip.audioUri) return;
    const operationId = ++operationIdRef.current;

    if (onBeforePlayNew) await onBeforePlayNew();
    if (!isOperationActive(operationId)) return;

    try {
      await player.pause();
      if (!isOperationActive(operationId)) return;

      setPlayerTarget({ ideaId, clipId: clip.id });
      setWaveformPeaks(clip.waveformPeaks?.length ? clip.waveformPeaks : buildStaticWaveform(`${clip.id}-${clip.durationMs ?? 0}`));
      if (!isOperationActive(operationId)) return;

      await replacePlaybackSource(player, clip.audioUri, autoPlay);
      if (!isOperationActive(operationId)) return;
      activateLockScreenControls(metadata);
    } catch (err) {
      console.log("FULL open error", err);
    }
  }

  function updateLockScreenMetadata(metadata?: LockScreenMetadata) {
    player.updateLockScreenMetadata({
      ...metadata,
      artist: "SongSeed",
    });
  }

  async function togglePlayer() {
    try {
      if (status.playing) {
        await player.pause();
        return;
      }

      await activateAndPlay(player, status, playerDuration, playerPosition);
    } catch (err) {
      console.log("FULL play error", err);
    }
  }

  async function pausePlayer() {
    try {
      await player.pause();
    } catch (err) {
      console.log("FULL pause error", err);
    }
  }

  async function playPlayer() {
    try {
      await activateAndPlay(player, status, playerDuration, playerPosition);
    } catch (err) {
      console.log("FULL resume error", err);
    }
  }

  async function seekTo(ms: number) {
    const durationMs = playerDuration || Math.round((status.duration ?? 0) * 1000);
    const targetMs = Math.max(0, Math.min(ms, durationMs || ms));
    await player.seekTo(targetMs / 1000);
  }

  async function seekBy(delta: number) {
    await seekTo(playerPosition + delta);
  }

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
