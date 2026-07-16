import { useAudioPlayer } from "expo-audio";
import { useThrottledAudioPlayerStatus } from "./useThrottledAudioPlayerStatus";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import { ClipVersion, PlayerTarget } from "../types";
import {
  getClipPlaybackDurationMs,
  getClipPlaybackUri,
} from "../clipPresentation";
import { activateAndPlay, replacePlaybackSource } from "../services/transportPlayback";
import { getLockScreenArtworkUrl, prefetchLockScreenArtwork } from "../services/lockScreenArtwork";
import { beginForegroundAudioLoad, endForegroundAudioLoad } from "../services/audioForegroundActivity";
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
  artist?: string;
  albumTitle?: string;
};

// Lock-screen "previous" follows the universal media convention (Spotify, Apple
// Music, media3's default): pressing it past this position restarts the clip;
// pressing it within the threshold goes to the previous queue item. 3000ms is
// media3's own maxSeekToPreviousPositionMs default.
const LOCK_SCREEN_PREVIOUS_RESTART_MS = 3000;

// Lock-screen button config derives from the live queue: next is grayed out at
// the end of the queue (or with no queue), previous stays tappable because it
// always at least restarts the clip.
const buildLockScreenOptions = () => {
  const { playerQueue, playerQueueIndex } = useStore.getState();
  return {
    // The native scrubber handles in-clip seeking; the button slots go to
    // queue navigation instead (mirrors the mini player's prev/next).
    showSeekBackward: false,
    showSeekForward: false,
    showPreviousTrack: true,
    showNextTrack: true,
    nextTrackEnabled: playerQueueIndex < playerQueue.length - 1,
    previousTrackEnabled: true,
  };
};

// How long a reported position may be held at a gate target (source swap or seek)
// before we give up waiting for the native clock to converge. Seeks inside long files
// (30+ min) can take well over a second under load — a short gate lets stale pre-seek
// positions leak through and the playhead visibly "jumps back and around" before
// landing. Convergence releases the gate early, so fast seeks pay nothing.
const SOURCE_POSITION_GATE_MS = 2500;
// How close the native clock must land to the seek target before the gate releases and
// resumes showing the real position. Must be wide enough to count a normal landing as
// "arrived" — m4a/AAC seeks snap to the nearest keyframe (often 150–300ms off the request),
// and a resumed playhead moves further away each frame. Too tight (the old 120ms) meant a
// keyframe-off or playing seek never converged, so the gate froze the display at the target
// for the full timeout and then snapped — the "jumps away then returns" scrub glitch. A
// backward/forward scrub's STALE pre-seek report is seconds away, so this still rejects it.
const SOURCE_POSITION_GATE_TOLERANCE_MS = 320;

export function useFullPlayer({ onBeforePlayNew }: Args = {}) {
  const [playerTarget, setPlayerTarget] = useState<PlayerTarget>(null);
  const [finishedPlaybackToken, setFinishedPlaybackToken] = useState(0);
  const [finishedPlaybackClipId, setFinishedPlaybackClipId] = useState<string | null>(null);
  // Bumped whenever a load operation SETTLES (success, failure, or mid-flight abort).
  // Screens key their load-reconciliation effects on this so an aborted open — which
  // otherwise changes no React state — still triggers a re-check instead of leaving
  // the engine silently pointed at the previous clip while the UI shows the new one.
  const [engineOpNonce, setEngineOpNonce] = useState(0);
  const operationIdRef = useRef(0);
  const isMountedRef = useRef(true);
  // Ref mirror so stable callbacks (togglePlayer) can read the engine's loaded
  // target at call time without depending on the state value.
  const playerTargetRef = useRef<PlayerTarget>(null);
  playerTargetRef.current = playerTarget;
  // The clip currently being loaded, and whether it should play once loaded. Repeated
  // opens of the SAME clip coalesce onto the in-flight load instead of restarting it —
  // without this, mashing play during a slow load (big library) makes each press abort
  // the previous load via a new operation id, so nothing ever finishes (a livelock that
  // only clears after you stop pressing). A different clip still supersedes normally.
  const openingClipIdRef = useRef<string | null>(null);
  const autoplayWhenLoadedRef = useRef(false);
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
  // Throttled: transitions commit immediately; pure position ticks re-render at
  // ~5Hz instead of the native 20Hz. Smooth playhead motion is the UI-thread
  // transport clock's job — it only needs these periodic corrections.
  const { status, statusRef } = useThrottledAudioPlayerStatus(player, { positionIntervalMs: 200 });
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
    playerPositionRef.current = playerPosition;
    playerDurationRef.current = playerDuration;
  }, [playerDuration, playerPosition]);

  useEffect(() => {
    const justFinishedNow = didPlayerJustFinish && !previousDidJustFinishRef.current;
    if (justFinishedNow) {
      setFinishedPlaybackClipId(playerTarget?.clipId ?? null);
      setFinishedPlaybackToken((prev) => prev + 1);
    }
    previousDidJustFinishRef.current = didPlayerJustFinish;
  }, [didPlayerJustFinish, playerTarget?.clipId]);

  useEffect(() => {
    // While a DIFFERENT clip is loading, the engine's status still describes the
    // previous clip (a paused source emits no fresh ticks, and pause/replace land
    // several awaits into openPlayer). Publishing it would stomp the zeroed state
    // openPlayer just wrote for the incoming clip — stand down until the load
    // settles; the finally block's engineOpNonce keeps screens reconciled.
    if (
      openingClipIdRef.current !== null &&
      openingClipIdRef.current !== playerTargetRef.current?.clipId
    ) {
      return;
    }
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

    // Diagnostic: an unexplained playing→paused flip (no user pause, no clip end)
    // is the signature of native-side interference — codec starvation from a decode,
    // audio-focus loss, an interruption. Keep it visible so field reports of "it
    // paused by itself" can be correlated against the surrounding [waveform]/
    // [hydration] log lines.
    if (lastPublished.isPlaying && !isPlayerPlaying && !didPlayerJustFinish) {
      console.log(
        `[playback] playing→paused at ${playerPosition}ms (not end-of-clip — user pause or native interruption)`
      );
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
  }, [didPlayerJustFinish, isPlayerPlaying, playerDuration, playerPosition, setPlayerPlaybackState]);

  // Resolve the bundled artwork before the first activation so the lock screen
  // never appears artless while the asset is still being materialized.
  useEffect(() => {
    prefetchLockScreenArtwork();
  }, []);

  // Lock-screen prev/next drive the queue exactly like the mini player's buttons
  // (GlobalMediaDock): stop any inline preview, then move the queue index.
  // Previous follows the standard restart-then-previous convention (see
  // LOCK_SCREEN_PREVIOUS_RESTART_MS); next is a guarded no-op at the queue end
  // (the button is also grayed out natively via nextTrackEnabled).
  useEffect(() => {
    const subscription = player.addListener("lockScreenCommand", ({ command }) => {
      const { playerQueue, playerQueueIndex } = useStore.getState();

      if (command === "previousTrack") {
        const hasPrevious = playerQueue.length > 0 && playerQueueIndex > 0;
        const positionMs = player.currentTime * 1000;
        if (!hasPrevious || positionMs > LOCK_SCREEN_PREVIOUS_RESTART_MS) {
          player.seekTo(0);
          return;
        }
        useStore.getState().requestInlineStop();
        useStore.getState().advancePlayerQueue("previous", true);
        return;
      }

      if (playerQueueIndex + 1 >= playerQueue.length) return;
      useStore.getState().requestInlineStop();
      useStore.getState().advancePlayerQueue("next", true);
    });

    return () => {
      subscription.remove();
    };
  }, [player]);

  // Keep the native next-button enabled state in step with the queue: gray it
  // out on the last item, light it back up when something is queued behind it.
  useEffect(() => {
    let lastNextEnabled: boolean | null = null;
    const unsubscribe = useStore.subscribe((state) => {
      const nextEnabled = state.playerQueueIndex < state.playerQueue.length - 1;
      if (nextEnabled === lastNextEnabled) return;
      lastNextEnabled = nextEnabled;
      if (!isLockScreenActiveRef.current) return;
      try {
        player.updateLockScreenOptions(buildLockScreenOptions());
      } catch {
        // ignore released player cleanup races
      }
    });

    return unsubscribe;
  }, [player]);

  const activateLockScreenControls = useCallback((metadata?: LockScreenMetadata) => {
    try {
      player.setActiveForLockScreen(
        true,
        {
          ...metadata,
          artist: metadata?.artist ?? "Songstead",
          artworkUrl: getLockScreenArtworkUrl(),
        },
        buildLockScreenOptions()
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

  // The media session persists across pauses (standard media behavior: a paused
  // card stays up, with pause reflected natively). It is only torn down when the
  // playback session truly ends — closePlayer and unmount. Skipping re-activation
  // while already active avoids the native session rebuild that made the card
  // blink on every pause/play and scrub. (History: clear-on-pause came from
  // b7949d0 as an implicit handoff with the inline preview player; the handoff
  // is now explicit — see the inline-claim effect below.)
  useEffect(() => {
    if (!isPlayerPlaying) return;
    if (isLockScreenActiveRef.current) return;
    if (appStateRef.current !== "active") return;
    activateLockScreenControls(lockScreenMetadataRef.current);
  }, [activateLockScreenControls, isPlayerPlaying]);

  // Explicit handoff with the inline preview player (it claims the lock screen
  // for background audio during previews — f63302c). When inline claims, our
  // native slot is gone regardless of what our ref says; when inline releases,
  // re-claim on behalf of the still-loaded full-player session so the card
  // survives previews instead of vanishing with them.
  useEffect(() => {
    let lastInlineTarget = useStore.getState().inlineTarget;
    const unsubscribe = useStore.subscribe((state) => {
      const previous = lastInlineTarget;
      lastInlineTarget = state.inlineTarget;

      if (!previous && state.inlineTarget) {
        isLockScreenActiveRef.current = false;
        return;
      }

      if (previous && !state.inlineTarget && state.playerTarget) {
        if (appStateRef.current !== "active") return;
        activateLockScreenControls(lockScreenMetadataRef.current);
      }
    });

    return unsubscribe;
  }, [activateLockScreenControls]);

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
    lastPublishedPlaybackRef.current = { at: Date.now(), positionMs: 0, durationMs: 0, isPlaying: false };
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
    // Already loading THIS clip: coalesce onto the in-flight load rather than aborting
    // and restarting it (that's the mash-play-during-load livelock). Only ever upgrade
    // to autoplay — a later plain open must not cancel an autoplay a play-press asked for.
    if (openingClipIdRef.current === clip.id) {
      if (autoPlay) autoplayWhenLoadedRef.current = true;
      return;
    }
    openingClipIdRef.current = clip.id;
    autoplayWhenLoadedRef.current = autoPlay;
    // Claim the operation BEFORE the first await so a DIFFERENT clip supersedes this one
    // in user-intent order (claiming after the async URI resolution let a slow early tap
    // cancel a fast later one mid-flight).
    const operationId = ++operationIdRef.current;
    // Zero the visible position BEFORE the first await. The old clip's position lives on
    // in the native player and the throttled status cache (a paused player emits no new
    // ticks), so every render between now and the source swap would otherwise show the
    // PREVIOUS clip's playhead on the new clip. Gate + refs + store all go to 0 up front.
    if (playerTargetRef.current?.clipId !== clip.id) {
      holdSourcePositionAt(0);
      const zeroed = {
        positionMs: 0,
        durationMs: getClipPlaybackDurationMs(clip) ?? 0,
        isPlaying: false,
      };
      setPlayerPlaybackState(zeroed);
      // Keep the throttled publisher's cache in step with the direct write, so its
      // next run doesn't see a phantom delta and republish stale engine status.
      lastPublishedPlaybackRef.current = { at: Date.now(), ...zeroed };
    }
    // Signal foreground load so background hydration stands clear of the codec.
    beginForegroundAudioLoad();
    try {
      const playbackUri = await resolvePlayableUriWithDiagnostics(ideaId, clip);
      if (!playbackUri) {
        // Load never started: the zeroed state above described a clip that won't
        // arrive. Release the hold so the publisher (which resumes after finally)
        // can restore the engine's real status, and let engineOpNonce reconcile
        // the screens.
        releaseSourcePositionHold();
        return;
      }
      if (!isOperationActive(operationId)) return;
      lockScreenMetadataRef.current = metadata;

      if (onBeforePlayNew) await onBeforePlayNew();
      if (!isOperationActive(operationId)) return;

      try {
        holdSourcePositionAt(0);
        await player.pause();
        if (!isOperationActive(operationId)) return;

        // Read the autoplay intent as late as possible so a play-press that arrived
        // during the (slow) load window is honored on this same load.
        await replacePlaybackSource(player, playbackUri, autoplayWhenLoadedRef.current);
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
        lastPublishedPlaybackRef.current = { at: Date.now(), positionMs: 0, durationMs: 0, isPlaying: false };
        useStore.getState().clearPlayerQueue();
        setPlayerTarget(null);
        currentSourceUriRef.current = null;
        console.warn(
          `[playback] FULL open error for clip ${clip.id} ("${clip.title}") uri=${playbackUri}`,
          err
        );
      }
    } finally {
      endForegroundAudioLoad();
      // Only the owning open clears the in-flight marker (a superseding different-clip
      // open has already claimed it).
      if (openingClipIdRef.current === clip.id) {
        openingClipIdRef.current = null;
        autoplayWhenLoadedRef.current = false;
      }
      // Settle signal — aborted opens change no other state, and without this the
      // screen's load effect never re-runs and the engine stays on the OLD clip
      // while every store-driven surface shows the new one.
      if (isMountedRef.current) setEngineOpNonce((n) => n + 1);
    }
  }, [holdSourcePositionAt, isOperationActive, onBeforePlayNew, player, releaseSourcePositionHold, setPlayerPlaybackState]);

  const syncPlayerSource = useCallback(async (
    ideaId: string,
    clip: ClipVersion,
    metadata?: LockScreenMetadata,
    resumeAtMs = 0,
    shouldPlay = false
  ) => {
    const operationId = ++operationIdRef.current;
    beginForegroundAudioLoad();
    try {
      const playbackUri = await resolvePlayableUriWithDiagnostics(ideaId, clip);
      if (!playbackUri) return;
      if (currentSourceUriRef.current === playbackUri) return;
      if (!isOperationActive(operationId)) return;
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
    } finally {
      endForegroundAudioLoad();
      if (isMountedRef.current) setEngineOpNonce((n) => n + 1);
    }
  }, [holdSourcePositionAt, isOperationActive, player, releaseSourcePositionHold]);

  const updateLockScreenMetadata = useCallback((metadata?: LockScreenMetadata) => {
    lockScreenMetadataRef.current = metadata;
    if (!isLockScreenActiveRef.current) {
      return;
    }
    player.updateLockScreenMetadata({
      ...metadata,
      artist: metadata?.artist ?? "Songstead",
      artworkUrl: getLockScreenArtworkUrl(),
    });
  }, [player]);

  // The last line of defense against the "UI shows clip B, audio plays clip A" state:
  // if the loaded source doesn't match the session's intended target (a canceled or
  // silently-failed load left them desynced), don't play the stale audio — load the
  // right clip (with autoplay) instead. Returns true when it took over the play.
  const reconcileToStoreTargetBeforePlay = useCallback(async (): Promise<boolean> => {
    const storeTarget = useStore.getState().playerTarget;
    if (!storeTarget) return false;
    const engineClipId = playerTargetRef.current?.clipId ?? null;
    if (engineClipId === storeTarget.clipId && currentSourceUriRef.current) return false;
    const idea = useStore
      .getState()
      .workspaces.flatMap((workspace) => workspace.ideas)
      .find((candidate) => candidate.id === storeTarget.ideaId);
    const clip = idea?.clips.find((candidate) => candidate.id === storeTarget.clipId);
    if (!idea || !clip) return false;
    console.warn(
      `[playback] engine/target desync (engine=${engineClipId ?? "none"} target=${storeTarget.clipId}) — reloading before play`
    );
    await openPlayer(idea.id, clip, { title: clip.title, albumTitle: idea.title }, true);
    return true;
  }, [openPlayer]);

  const togglePlayer = useCallback(async () => {
    const latestStatus = statusRef.current;
    try {
      if (latestStatus.playing) {
        await player.pause();
        return;
      }

      if (await reconcileToStoreTargetBeforePlay()) return;

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
  }, [player, reconcileToStoreTargetBeforePlay]);

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
      if (await reconcileToStoreTargetBeforePlay()) return;

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
  }, [player, reconcileToStoreTargetBeforePlay]);

  const seekTo = useCallback(async (ms: number) => {
    const latestStatus = statusRef.current;
    const durationMs = playerDurationRef.current || Math.round((latestStatus.duration ?? 0) * 1000);
    const targetMs = Math.max(0, Math.min(ms, durationMs || ms));
    // Hold the reported position AT the target until the native clock converges.
    // Seeks inside long files land slowly; without the gate, stale pre-seek ticks
    // keep flowing out and the playhead visibly jumps back before settling.
    holdSourcePositionAt(targetMs);
    await player.seekTo(targetMs / 1000);
    playerPositionRef.current = targetMs;
  }, [holdSourcePositionAt, player]);

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
    engineOpNonce,
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
