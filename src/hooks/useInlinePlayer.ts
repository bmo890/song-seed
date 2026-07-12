import { useAudioPlayer } from "expo-audio";
import { useThrottledAudioPlayerStatus } from "./useThrottledAudioPlayerStatus";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipVersion, InlineTarget } from "../types";
import { getClipPlaybackUri } from "../clipPresentation";
import { activateAndPlay, replacePlaybackSource } from "../services/transportPlayback";
import { useStore } from "../state/useStore";
import { appActions } from "../state/actions";

type Args = {
  onBeforePlayNew?: () => Promise<void> | void;
};

type ResetInlinePlayerOptions = {
  awaitPause?: boolean;
};

type SourceSwitchHold = {
  requestId: number;
  startedAtMs: number;
  previousPositionMs: number;
  previousDurationMs: number;
};

type PendingPlayTarget = {
  requestId: number;
  ideaId: string;
  clipId: string;
};

const SOURCE_SWITCH_READY_POSITION_MS = 500;
const SOURCE_SWITCH_LOAD_TIMEOUT_MS = 2500;

function durationToleranceMs(durationMs: number) {
  return Math.max(750, durationMs * 0.2);
}

export function useInlinePlayer({ onBeforePlayNew }: Args = {}) {
  const [inlineTarget, setInlineTarget] = useState<InlineTarget>(null);
  const [inlinePlayingOverride, setInlinePlayingOverride] = useState<boolean | null>(null);
  const [inlinePositionOverrideMs, setInlinePositionOverrideMs] = useState<number | null>(null);
  const [inlineDurationOverrideMs, setInlineDurationOverrideMs] = useState<number | null>(null);
  const [sourceSwitchToken, setSourceSwitchToken] = useState<number | null>(null);
  const playRequestIdRef = useRef(0);
  const sourceSwitchHoldRef = useRef<SourceSwitchHold | null>(null);
  const pendingPlayTargetRef = useRef<PendingPlayTarget | null>(null);
  const stopRequestToken = useStore((s) => s.inlineStopRequestToken);
  const setStoreInlineTarget = useStore((s) => s.setInlineTarget);
  const setInlinePlaybackState = useStore((s) => s.setInlinePlaybackState);
  const handledStopTokenRef = useRef(stopRequestToken);

  const playerOptions = useMemo(() => ({ updateInterval: 100, keepAudioSessionActive: true }), []);
  const player = useAudioPlayer(null, playerOptions);
  // Throttled: state transitions (incl. playbackState, which gates source switches)
  // commit immediately; pure position ticks at ~5Hz instead of 10Hz. The whole app
  // re-renders under the root provider on these commits, so cadence matters.
  const { status } = useThrottledAudioPlayerStatus(player, { positionIntervalMs: 200 });
  const rawInlinePosition = Math.round((status.currentTime ?? 0) * 1000);
  const rawInlineDuration = Math.round((status.duration ?? 0) * 1000);
  const inlinePosition = inlinePositionOverrideMs ?? rawInlinePosition;
  const inlineDuration = inlineDurationOverrideMs ?? rawInlineDuration;
  const nativeInlinePlaying = !!status.playing && !status.didJustFinish;
  const isInlinePlaying = inlinePlayingOverride ?? nativeInlinePlaying;

  // Latest player-load state, read by the source-switch timeout below (whose
  // closure would otherwise capture stale values when it fires).
  const latestStateRef = useRef({
    rawDurationMs: rawInlineDuration,
    nativePlaying: nativeInlinePlaying,
    playbackState: status.playbackState ?? "",
    isLoaded: !!status.isLoaded,
  });
  latestStateRef.current = {
    rawDurationMs: rawInlineDuration,
    nativePlaying: nativeInlinePlaying,
    playbackState: status.playbackState ?? "",
    isLoaded: !!status.isLoaded,
  };

  function ignoreReleasedPlayerError(error: unknown) {
    const message = String(error);
    return message.includes("already released") || message.includes("cannot be cast");
  }

  function callPlayerSafely(action: () => void | Promise<void>, label: string) {
    try {
      return Promise.resolve(action()).catch((error) => {
        if (!ignoreReleasedPlayerError(error)) {
          console.warn(`INLINE ${label} error`, error);
        }
      });
    } catch (error) {
      if (!ignoreReleasedPlayerError(error)) {
        console.warn(`INLINE ${label} error`, error);
      }
      return Promise.resolve();
    }
  }

  function releaseSourceSwitchHold() {
    sourceSwitchHoldRef.current = null;
    setSourceSwitchToken(null);
    setInlinePositionOverrideMs(null);
    setInlineDurationOverrideMs(null);
  }

  function failSourceSwitchLoad(hold = sourceSwitchHoldRef.current) {
    if (hold && playRequestIdRef.current !== hold.requestId) return;
    sourceSwitchHoldRef.current = null;
    pendingPlayTargetRef.current = null;
    setSourceSwitchToken(null);
    setInlinePositionOverrideMs(null);
    setInlineDurationOverrideMs(null);
    setInlinePlayingOverride(false);
    setInlineTarget(null);
    setStoreInlineTarget(null);
    setInlinePlaybackState({ positionMs: 0, durationMs: 0, isPlaying: false });
    void pauseNativePlayer({ awaitPause: false });
  }

  // Once native playback catches up to an optimistic play/pause override, drop
  // the override and let native status drive the UI again.
  useEffect(() => {
    if (inlinePlayingOverride === null) return;
    if (sourceSwitchToken !== null) return;
    if (nativeInlinePlaying !== inlinePlayingOverride) return;
    setInlinePlayingOverride(null);
  }, [inlinePlayingOverride, nativeInlinePlaying, sourceSwitchToken]);

  // While a source switch is held, watch for the new clip to load (release the
  // hold) or fail to load within the timeout (fail the switch).
  useEffect(() => {
    const hold = sourceSwitchHoldRef.current;
    if (!hold || sourceSwitchToken === null || inlinePositionOverrideMs === null) return;

    if (playRequestIdRef.current !== hold.requestId) {
      releaseSourceSwitchHold();
      return;
    }

    const elapsedMs = Date.now() - hold.startedAtMs;
    const expectedDurationMs = inlineDurationOverrideMs ?? 0;
    const nativeHasLoadedDuration = rawInlineDuration > 0;
    const durationChangedFromPrevious =
      Math.abs(rawInlineDuration - hold.previousDurationMs) > SOURCE_SWITCH_READY_POSITION_MS;
    const durationLooksLikeExpected =
      expectedDurationMs > 0 &&
      Math.abs(rawInlineDuration - expectedDurationMs) <= durationToleranceMs(expectedDurationMs);
    const nativePositionLooksReset =
      nativeHasLoadedDuration &&
      (rawInlinePosition <= SOURCE_SWITCH_READY_POSITION_MS ||
        rawInlinePosition + SOURCE_SWITCH_READY_POSITION_MS < hold.previousPositionMs ||
        (durationChangedFromPrevious && durationLooksLikeExpected));

    if (nativePositionLooksReset) {
      releaseSourceSwitchHold();
      return;
    }

    const sourceLooksUnableToLoad =
      rawInlineDuration === 0 &&
      !nativeInlinePlaying &&
      (status.playbackState === "idle" || status.playbackState === "buffering" || !status.isLoaded);
    if (elapsedMs >= SOURCE_SWITCH_LOAD_TIMEOUT_MS && sourceLooksUnableToLoad) {
      failSourceSwitchLoad(hold);
      return;
    }

    const remainingTimeoutMs = SOURCE_SWITCH_LOAD_TIMEOUT_MS - elapsedMs;
    if (!sourceLooksUnableToLoad || remainingTimeoutMs <= 0) return;

    const timeout = setTimeout(() => {
      if (playRequestIdRef.current !== hold.requestId) return;
      const latest = latestStateRef.current;
      const latestStillUnableToLoad =
        latest.rawDurationMs === 0 &&
        !latest.nativePlaying &&
        (latest.playbackState === "idle" ||
          latest.playbackState === "buffering" ||
          !latest.isLoaded);
      if (!latestStillUnableToLoad) return;
      failSourceSwitchLoad(hold);
    }, remainingTimeoutMs);

    return () => clearTimeout(timeout);
  }, [
    inlineDurationOverrideMs,
    inlinePositionOverrideMs,
    nativeInlinePlaying,
    rawInlineDuration,
    rawInlinePosition,
    sourceSwitchToken,
    status.isLoaded,
    status.playbackState,
  ]);

  // Clip finished playing — clear the active target (unless a source switch is
  // mid-flight, in which case didJustFinish is from the outgoing clip).
  useEffect(() => {
    if (status.didJustFinish && inlineTarget) {
      if (
        sourceSwitchToken !== null ||
        sourceSwitchHoldRef.current ||
        inlinePositionOverrideMs !== null
      ) {
        return;
      }
      setInlineTarget(null);
      setInlinePlayingOverride(false);
    }
  }, [inlinePositionOverrideMs, inlineTarget, sourceSwitchToken, status.didJustFinish]);

  // Publish target + playback state to the store so leaf views can subscribe.
  useEffect(() => {
    setStoreInlineTarget(inlineTarget);
  }, [inlineTarget, setStoreInlineTarget]);

  // Bank the duration the engine loaded, back onto the clip — so previewing a
  // freshly-imported clip (whose stored durationMs is still missing) fills its
  // "0:00" card instead of discarding the number. Once per target; only when the
  // source has settled and a real duration is available.
  const durationWrittenTargetRef = useRef<string | null>(null);
  useEffect(() => {
    if (!inlineTarget) {
      durationWrittenTargetRef.current = null;
      return;
    }
    if (sourceSwitchToken !== null || !status.isLoaded || rawInlineDuration <= 0) return;
    const key = `${inlineTarget.ideaId}:${inlineTarget.clipId}`;
    if (durationWrittenTargetRef.current === key) return;

    const state = useStore.getState();
    for (const workspace of state.workspaces) {
      const idea = workspace.ideas.find((candidate) => candidate.id === inlineTarget.ideaId);
      const clip = idea?.clips.find((candidate) => candidate.id === inlineTarget.clipId);
      if (!clip) continue;
      durationWrittenTargetRef.current = key; // handled — don't rescan this target
      if (!clip.durationMs || clip.durationMs <= 0) {
        appActions.hydrateClipAudioMetadata(workspace.id, inlineTarget.ideaId, inlineTarget.clipId, {
          durationMs: rawInlineDuration,
        });
      }
      break;
    }
  }, [inlineTarget, sourceSwitchToken, status.isLoaded, rawInlineDuration]);

  useEffect(() => {
    setInlinePlaybackState({
      positionMs: inlinePosition,
      durationMs: inlineDuration,
      isPlaying: isInlinePlaying,
    });
  }, [inlineDuration, inlinePosition, isInlinePlaying, setInlinePlaybackState]);

  // App-wide "stop any preview" event (e.g. recording, opening the full player).
  useEffect(() => {
    if (stopRequestToken === handledStopTokenRef.current) return;
    handledStopTokenRef.current = stopRequestToken;
    void resetInlinePlayer();
  }, [stopRequestToken]);

  function clearInlineUiState() {
    try {
      player.clearLockScreenControls();
    } catch {}
    sourceSwitchHoldRef.current = null;
    setSourceSwitchToken(null);
    setInlinePositionOverrideMs(null);
    setInlineDurationOverrideMs(null);
    setInlinePlayingOverride(false);
    setInlineTarget(null);
    setStoreInlineTarget(null);
    setInlinePlaybackState({ positionMs: 0, durationMs: 0, isPlaying: false });
  }

  async function pauseNativePlayer(options?: { awaitPause?: boolean }) {
    const pausePromise = callPlayerSafely(() => player.pause(), "pause");
    if (options?.awaitPause === false) return;
    await pausePromise;
  }

  async function resetInlinePlayer(options?: ResetInlinePlayerOptions) {
    playRequestIdRef.current += 1;
    pendingPlayTargetRef.current = null;
    clearInlineUiState();
    await pauseNativePlayer({ awaitPause: options?.awaitPause });
  }

  async function toggleActiveInlinePlayback() {
    try {
      if (isInlinePlaying) {
        setInlinePlayingOverride(false);
        void pauseNativePlayer({ awaitPause: false });
        return;
      }
      setInlinePlayingOverride(true);
      await activateAndPlay(player, status, inlineDuration, inlinePosition);
    } catch (err) {
      setInlinePlayingOverride(false);
      console.warn("INLINE toggle error", err);
    }
  }

  async function toggleInlinePlayback(ideaId: string, clip: ClipVersion) {
    const playbackUri = getClipPlaybackUri(clip);
    if (!playbackUri) return;

    const pendingPlayTarget = pendingPlayTargetRef.current;
    if (pendingPlayTarget?.ideaId === ideaId && pendingPlayTarget.clipId === clip.id) {
      return;
    }

    if (inlineTarget && inlineTarget.ideaId === ideaId && inlineTarget.clipId === clip.id) {
      const sameTargetStillStarting =
        inlinePlayingOverride === true &&
        !nativeInlinePlaying &&
        (sourceSwitchToken !== null ||
          status.isBuffering ||
          !status.isLoaded ||
          status.playbackState === "idle");
      if (sameTargetStillStarting) {
        const sameTargetLooksStuck =
          sourceSwitchToken === null &&
          !status.isBuffering &&
          !status.isLoaded &&
          status.playbackState === "idle";
        if (!sameTargetLooksStuck) {
          return;
        }
      } else {
        await toggleActiveInlinePlayback();
        return;
      }
    }

    let requestId: number | null = null;
    try {
      requestId = playRequestIdRef.current + 1;
      playRequestIdRef.current = requestId;
      pendingPlayTargetRef.current = { requestId, ideaId, clipId: clip.id };

      // Optimistic UI FIRST: the card flips to "playing" on the same tick as the tap.
      // Waiting for the other transport to pause before flipping (the old order) added a
      // visible native-roundtrip delay between pressing play and any visual response.
      clearInlineUiState();
      sourceSwitchHoldRef.current = {
        requestId,
        startedAtMs: Date.now(),
        previousPositionMs: rawInlinePosition,
        previousDurationMs: rawInlineDuration,
      };
      setSourceSwitchToken(requestId);
      setInlinePositionOverrideMs(0);
      setInlineDurationOverrideMs(clip.durationMs ?? 0);
      setInlineTarget({ ideaId, clipId: clip.id });
      setInlinePlayingOverride(true);

      if (onBeforePlayNew) await onBeforePlayNew();
      if (playRequestIdRef.current !== requestId) {
        return;
      }
      await replacePlaybackSource(player, playbackUri, true, { seekToStart: false });
      if (playRequestIdRef.current !== requestId) {
        return;
      }
      void callPlayerSafely(
        () =>
          player.setActiveForLockScreen(
            true,
            { title: clip.title || "Clip", artist: "SongSeed" },
            { showSeekBackward: true, showSeekForward: true }
          ),
        "lock screen"
      );
    } catch (err) {
      if (requestId !== null && playRequestIdRef.current === requestId) {
        releaseSourceSwitchHold();
        setInlineTarget(null);
        setInlinePlayingOverride(false);
      }
      console.warn("INLINE play error", err);
    } finally {
      if (requestId !== null && pendingPlayTargetRef.current?.requestId === requestId) {
        pendingPlayTargetRef.current = null;
      }
    }
  }

  async function seekInline(ms: number) {
    const durationMs = inlineDuration || Math.round((status.duration ?? 0) * 1000);
    const targetMs = Math.max(0, Math.min(ms, durationMs || ms));
    await callPlayerSafely(() => player.seekTo(targetMs / 1000), "seek");
  }

  // Scrub gesture hooks for the MiniProgress contract. Inline preview seeks while
  // playing (no pause needed), so begin/cancel have no extra work; the seek lands
  // on release via endInlineScrub.
  async function beginInlineScrub() {}

  async function endInlineScrub(ms: number) {
    await seekInline(ms);
  }

  async function cancelInlineScrub() {}

  useEffect(() => {
    return () => {
      setStoreInlineTarget(null);
      setInlinePlaybackState({ positionMs: 0, durationMs: 0, isPlaying: false });
      try {
        player.clearLockScreenControls();
      } catch {}
      void callPlayerSafely(() => player.pause(), "pause");
    };
  }, [player, setInlinePlaybackState, setStoreInlineTarget]);

  return {
    inlineTarget,
    inlinePosition,
    inlineDuration,
    isInlinePlaying,
    toggleInlinePlayback,
    beginInlineScrub,
    endInlineScrub,
    cancelInlineScrub,
    seekInline,
    resetInlinePlayer,
  };
}
