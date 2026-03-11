import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipVersion, PlayerTarget } from "../types";
import { buildStaticWaveform } from "../utils";
import { activatePlaybackAudioSession } from "../services/audioSession";

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

  const playerOptions = useMemo(() => ({ updateInterval: 33 }), []);
  const player = useAudioPlayer(null, playerOptions);
  const status = useAudioPlayerStatus(player);
  const playerPosition = Math.round((status.currentTime ?? 0) * 1000);
  const playerDuration = Math.round((status.duration ?? 0) * 1000);
  const isPlayerPlaying = !!status.playing && !status.didJustFinish;
  const didPlayerJustFinish = !!status.didJustFinish;

  useEffect(() => {
    const justFinishedNow = didPlayerJustFinish && !previousDidJustFinishRef.current;
    if (justFinishedNow) {
      setFinishedPlaybackClipId(playerTarget?.clipId ?? null);
      setFinishedPlaybackToken((prev) => prev + 1);
    }
    previousDidJustFinishRef.current = didPlayerJustFinish;
  }, [didPlayerJustFinish, playerTarget?.clipId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      operationIdRef.current += 1;
      try {
        player.clearLockScreenControls();
      } catch {
        // ignore released player cleanup races on unmount
      }
    };
  }, []);

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

      await activatePlaybackAudioSession();
      if (!isOperationActive(operationId)) return;

      await player.replace({ uri: clip.audioUri });
      if (!isOperationActive(operationId)) return;
      activateLockScreenControls(metadata);
      if (autoPlay) {
        await player.play();
      } else {
        await player.pause();
      }
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
    const durationMs = playerDuration || Math.round((status.duration ?? 0) * 1000);
    const positionMs = playerPosition || Math.round((status.currentTime ?? 0) * 1000);
    const atEnd = durationMs > 0 && positionMs >= durationMs - 250;

    try {
      if (status.playing) {
        await player.pause();
        return;
      }

      await activatePlaybackAudioSession();

      if (atEnd) {
        await player.seekTo(0);
      }
      await player.play();
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
    const durationMs = playerDuration || Math.round((status.duration ?? 0) * 1000);
    const positionMs = playerPosition || Math.round((status.currentTime ?? 0) * 1000);
    const atEnd = durationMs > 0 && positionMs >= durationMs - 250;

    try {
      await activatePlaybackAudioSession();
      if (atEnd) {
        await player.seekTo(0);
      }
      await player.play();
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

  return {
    playerTarget,
    playerPosition,
    playerDuration,
    isPlayerPlaying,
    didPlayerJustFinish,
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
    updateLockScreenMetadata,
  };
}
