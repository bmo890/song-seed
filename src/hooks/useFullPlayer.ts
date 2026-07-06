import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { ClipVersion, PlayerTarget } from "../types";
import {
  getClipPlaybackDurationMs,
  getClipPlaybackUri,
} from "../clipPresentation";
import { activateAndPlay, replacePlaybackSource } from "../services/transportPlayback";
import { appActions } from "../state/actions";
import { useStore } from "../state/useStore";

/** Clips whose stale rendered mix is already being healed — don't double-schedule. */
const mixSelfHealInFlight = new Set<string>();

/**
 * Resolve the URI the player should actually load, with loud diagnostics. A layered
 * clip's rendered mix is a derived FILE that can go stale (e.g. the app died between a
 * mix swap's file cleanup and the state persist) — a dangling reference makes that one
 * clip silently unplayable. Log exactly what we chose and whether it exists on disk; a
 * missing rendered mix SELF-HEALS: clear the stale reference (so playback resolves to
 * the base take immediately) and queue a fresh background render so the layers return.
 */
async function resolvePlayableUriWithDiagnostics(
  ideaId: string,
  clip: ClipVersion
): Promise<string | null> {
  const mixUri = clip.overdub?.renderedMixUri ?? null;
  const playbackUri = getClipPlaybackUri(clip);
  if (!playbackUri) {
    console.warn(
      `[playback] clip ${clip.id} ("${clip.title}") has NO playable source ` +
        `(renderedMixUri=${mixUri ?? "none"}, audioUri=${clip.audioUri ?? "none"})`
    );
    return null;
  }

  const usingMix = playbackUri === mixUri;
  const info = await FileSystem.getInfoAsync(playbackUri).catch(() => null);
  console.log(
    `[playback] clip ${clip.id} ("${clip.title}") source=${usingMix ? "rendered-mix" : "base"} ` +
      `exists=${info ? String(info.exists) : "unknown"}` +
      `${info?.exists && "size" in info ? ` size=${info.size}` : ""} uri=${playbackUri}`
  );

  if (info && !info.exists && usingMix && clip.audioUri) {
    console.warn(
      `[playback] rendered mix file MISSING for clip ${clip.id} — playing the base take ` +
        `and re-rendering the layer mix in the background (self-heal)`
    );
    if (!mixSelfHealInFlight.has(clip.id)) {
      mixSelfHealInFlight.add(clip.id);
      try {
        // Drop the dangling reference first so every consumer resolves to the base take,
        // then rebuild the mix from the (intact) base + stem files.
        useStore.getState().clearClipOverdubRenderedMix(ideaId, clip.id);
        void appActions
          .rerenderClipOverdubMix(ideaId, clip.id)
          .catch((error) => {
            console.warn(`[playback] mix self-heal re-render failed for clip ${clip.id}`, error);
          })
          .finally(() => {
            mixSelfHealInFlight.delete(clip.id);
          });
      } catch (error) {
        mixSelfHealInFlight.delete(clip.id);
        console.warn(`[playback] mix self-heal failed for clip ${clip.id}`, error);
      }
    }
    return clip.audioUri;
  }

  return playbackUri;
}

type Args = {
  onBeforePlayNew?: () => Promise<void> | void;
};

type LockScreenMetadata = {
  title?: string;
  albumTitle?: string;
};

const SOURCE_POSITION_GATE_MS = 1000;
const SOURCE_POSITION_GATE_TOLERANCE_MS = 120;

export function useFullPlayer({ onBeforePlayNew }: Args = {}) {
  const [playerTarget, setPlayerTarget] = useState<PlayerTarget>(null);
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
  const sourcePositionGateRef = useRef<{
    targetMs: number;
    until: number;
    accepted: boolean;
  } | null>(null);
  const rawPlayerPosition = Math.round((status.currentTime ?? 0) * 1000);
  const playerDuration = Math.round((status.duration ?? 0) * 1000);
  const sourcePositionGate = sourcePositionGateRef.current;
  const playerPosition =
    sourcePositionGate && !sourcePositionGate.accepted
      ? Math.abs(rawPlayerPosition - sourcePositionGate.targetMs) <= SOURCE_POSITION_GATE_TOLERANCE_MS
        ? rawPlayerPosition
        : Date.now() < sourcePositionGate.until
          ? sourcePositionGate.targetMs
          : rawPlayerPosition
      : rawPlayerPosition;
  if (
    sourcePositionGate &&
    !sourcePositionGate.accepted &&
    (Math.abs(rawPlayerPosition - sourcePositionGate.targetMs) <= SOURCE_POSITION_GATE_TOLERANCE_MS ||
      Date.now() >= sourcePositionGate.until)
  ) {
    sourcePositionGate.accepted = true;
  }
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
  const currentSourceUriRef = useRef<string | null>(null);

  const holdSourcePositionAt = useCallback((targetMs: number) => {
    const safeTargetMs = Math.max(0, targetMs);
    sourcePositionGateRef.current = {
      targetMs: safeTargetMs,
      until: Date.now() + SOURCE_POSITION_GATE_MS,
      accepted: false,
    };
    playerPositionRef.current = safeTargetMs;
  }, []);

  const releaseSourcePositionHold = useCallback(() => {
    sourcePositionGateRef.current = null;
  }, []);

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
    currentSourceUriRef.current = null;
    releaseSourcePositionHold();
  }, [clearLockScreenControls, isOperationActive, player, releaseSourcePositionHold, setPlayerPlaybackState]);

  const openPlayer = useCallback(async (
    ideaId: string,
    clip: ClipVersion,
    metadata?: LockScreenMetadata,
    autoPlay = false
  ) => {
    const playbackUri = await resolvePlayableUriWithDiagnostics(ideaId, clip);
    if (!playbackUri) return;
    const operationId = ++operationIdRef.current;
    lockScreenMetadataRef.current = metadata;

    if (onBeforePlayNew) await onBeforePlayNew();
    if (!isOperationActive(operationId)) return;

    try {
      holdSourcePositionAt(0);
      await player.pause();
      if (!isOperationActive(operationId)) return;

      await replacePlaybackSource(player, playbackUri, autoPlay);
      if (!isOperationActive(operationId)) return;
      currentSourceUriRef.current = playbackUri;
      // Publish the active target only after the source has loaded. That keeps the UI and
      // persisted player state from pointing at a clip that never actually became playable.
      setPlayerTarget({ ideaId, clipId: clip.id });
    } catch (err) {
      releaseSourcePositionHold();
      setPlayerPlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
      useStore.getState().clearPlayerQueue();
      setPlayerTarget(null);
      currentSourceUriRef.current = null;
      console.warn(
        `[playback] FULL open error for clip ${clip.id} ("${clip.title}") uri=${playbackUri}`,
        err
      );
    }
  }, [holdSourcePositionAt, isOperationActive, onBeforePlayNew, player, releaseSourcePositionHold, setPlayerPlaybackState]);

  const syncPlayerSource = useCallback(async (
    ideaId: string,
    clip: ClipVersion,
    metadata?: LockScreenMetadata,
    resumeAtMs = 0,
    shouldPlay = false
  ) => {
    const playbackUri = await resolvePlayableUriWithDiagnostics(ideaId, clip);
    if (!playbackUri) return;
    if (currentSourceUriRef.current === playbackUri) return;

    const operationId = ++operationIdRef.current;
    lockScreenMetadataRef.current = metadata;

    try {
      const safeResumeAtMs = Math.max(0, Math.min(resumeAtMs, getClipPlaybackDurationMs(clip) ?? resumeAtMs));
      holdSourcePositionAt(safeResumeAtMs);
      await player.pause();
      if (!isOperationActive(operationId)) return;

      await replacePlaybackSource(player, playbackUri, false);
      if (!isOperationActive(operationId)) return;

      await player.seekTo(safeResumeAtMs / 1000);
      if (!isOperationActive(operationId)) return;

      if (shouldPlay) {
        await activateAndPlay(
          player,
          {
            duration: (getClipPlaybackDurationMs(clip) ?? 0) / 1000,
            currentTime: safeResumeAtMs / 1000,
          },
          getClipPlaybackDurationMs(clip) ?? 0,
          safeResumeAtMs
        );
        if (!isOperationActive(operationId)) return;
      }

      currentSourceUriRef.current = playbackUri;
      setPlayerTarget({ ideaId, clipId: clip.id });
    } catch (err) {
      releaseSourcePositionHold();
      console.warn(
        `[playback] FULL sync source error for clip ${clip.id} ("${clip.title}") uri=${playbackUri}`,
        err
      );
    }
  }, [holdSourcePositionAt, isOperationActive, player, releaseSourcePositionHold]);

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
        playerPositionRef.current,
        {
          onRestartFromEnd: () => {
            playerPositionRef.current = 0;
          },
        }
      );
    } catch (err) {
      console.warn("FULL play error", err);
    }
  }, [player]);

  const pausePlayer = useCallback(async () => {
    try {
      await player.pause();
    } catch (err) {
      console.warn("FULL pause error", err);
    }
  }, [player]);

  const playPlayer = useCallback(async () => {
    const latestStatus = statusRef.current;
    try {
      await activateAndPlay(
        player,
        latestStatus,
        playerDurationRef.current,
        playerPositionRef.current,
        {
          onRestartFromEnd: () => {
            playerPositionRef.current = 0;
          },
        }
      );
    } catch (err) {
      console.warn("FULL resume error", err);
    }
  }, [player]);

  const seekTo = useCallback(async (ms: number) => {
    const latestStatus = statusRef.current;
    const durationMs = playerDurationRef.current || Math.round((latestStatus.duration ?? 0) * 1000);
    const targetMs = Math.max(0, Math.min(ms, durationMs || ms));
    await player.seekTo(targetMs / 1000);
    playerPositionRef.current = targetMs;
    releaseSourcePositionHold();
  }, [player, releaseSourcePositionHold]);

  const seekBy = useCallback(async (delta: number) => {
    await seekTo(playerPositionRef.current + delta);
  }, [seekTo]);

  const setPlaybackRate = useCallback((rate: number) => {
    const nextRate = Math.max(0.5, Math.min(rate, 2));
    try {
      player.setPlaybackRate(nextRate);
    } catch (err) {
      console.warn("FULL setPlaybackRate error", err);
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
    currentPlaybackSourceUri: currentSourceUriRef.current,
    syncPlayerSource,
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
