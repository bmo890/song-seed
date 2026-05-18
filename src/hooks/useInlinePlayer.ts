import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as FileSystem from "expo-file-system";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClipVersion, InlineTarget } from "../types";
import { getClipPlaybackUri } from "../clipPresentation";
import { activateAndPlay, replacePlaybackSource } from "../services/transportPlayback";
import { useStore } from "../state/useStore";

type Args = {
  onBeforePlayNew?: () => Promise<void> | void;
};

type ResetInlinePlayerOptions = {
  releaseOwnership?: boolean;
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

function getInlineDebugError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stackTop: error.stack?.split("\n").slice(0, 3).join(" | "),
    };
  }
  return { message: String(error) };
}

function getUriTail(uri: string) {
  return uri.split("/").pop()?.slice(-80) ?? uri.slice(-80);
}

function getUriScheme(uri: string) {
  return uri.match(/^([a-zA-Z][a-zA-Z\d+.-]*):/)?.[1] ?? "unknown";
}

async function getPlaybackUriDebugInfo(uri: string) {
  const base = {
    scheme: getUriScheme(uri),
    tail: getUriTail(uri),
    isFileUri: uri.startsWith("file://"),
  };

  if (!uri.startsWith("file://")) return base;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    return {
      ...base,
      exists: info.exists,
      size: info.exists && "size" in info ? info.size ?? null : null,
      modificationTime:
        info.exists && "modificationTime" in info ? info.modificationTime ?? null : null,
    };
  } catch (error) {
    return {
      ...base,
      error: getInlineDebugError(error),
    };
  }
}

let inlinePlayerOwnerIdCounter = 1;
let activeInlinePlayerSession:
  | {
      ownerId: number;
      reset: (options?: ResetInlinePlayerOptions) => Promise<void>;
    }
  | null = null;

export function useInlinePlayer({ onBeforePlayNew }: Args = {}) {
  const [inlineTarget, setInlineTarget] = useState<InlineTarget>(null);
  const [inlinePlayingOverride, setInlinePlayingOverride] = useState<boolean | null>(null);
  const [inlinePositionOverrideMs, setInlinePositionOverrideMs] = useState<number | null>(null);
  const [inlineDurationOverrideMs, setInlineDurationOverrideMs] = useState<number | null>(null);
  const [sourceSwitchToken, setSourceSwitchToken] = useState<number | null>(null);
  const wasPlayingBeforeScrubRef = useRef(false);
  const scrubPausePromiseRef = useRef<Promise<void> | null>(null);
  const playRequestIdRef = useRef(0);
  const sourceSwitchHoldRef = useRef<SourceSwitchHold | null>(null);
  const pendingPlayTargetRef = useRef<PendingPlayTarget | null>(null);
  const lastStatusLogKeyRef = useRef("");
  const lastMismatchLogKeyRef = useRef("");
  const latestDebugStateRef = useRef<Record<string, unknown>>({});
  const stopRequestToken = useStore((s) => s.inlineStopRequestToken);
  const toggleRequestToken = useStore((s) => s.inlineToggleRequestToken);
  const setStoreInlineTarget = useStore((s) => s.setInlineTarget);
  const setInlinePlaybackState = useStore((s) => s.setInlinePlaybackState);
  const clearPlayerQueue = useStore((s) => s.clearPlayerQueue);
  const requestPlayerClose = useStore((s) => s.requestPlayerClose);
  const seekRequestToken = useStore((s) => s.inlineSeekRequestToken);
  const seekTargetMs = useStore((s) => s.inlineSeekTargetMs);
  const inlinePlaybackSpeed = useStore((s) => s.inlinePlaybackSpeed);
  const handledStopTokenRef = useRef(stopRequestToken);
  const handledToggleTokenRef = useRef(toggleRequestToken);
  const handledSeekTokenRef = useRef(seekRequestToken);
  const lastAppliedSpeedRef = useRef(inlinePlaybackSpeed);
  const ownerIdRef = useRef(inlinePlayerOwnerIdCounter++);

  const playerOptions = useMemo(() => ({ updateInterval: 100, keepAudioSessionActive: true }), []);
  const player = useAudioPlayer(null, playerOptions);
  const status = useAudioPlayerStatus(player);
  const rawInlinePosition = Math.round((status.currentTime ?? 0) * 1000);
  const rawInlineDuration = Math.round((status.duration ?? 0) * 1000);
  const inlinePosition = inlinePositionOverrideMs ?? rawInlinePosition;
  const inlineDuration = inlineDurationOverrideMs ?? rawInlineDuration;
  const nativeInlinePlaying = !!status.playing && !status.didJustFinish;
  const isInlinePlaying = inlinePlayingOverride ?? nativeInlinePlaying;
  latestDebugStateRef.current = {
    target: inlineTarget,
    rawPositionMs: rawInlinePosition,
    rawDurationMs: rawInlineDuration,
    effectivePositionMs: inlinePosition,
    effectiveDurationMs: inlineDuration,
    nativePlaying: nativeInlinePlaying,
    effectivePlaying: isInlinePlaying,
    playingOverride: inlinePlayingOverride,
    positionOverrideMs: inlinePositionOverrideMs,
    durationOverrideMs: inlineDurationOverrideMs,
    sourceSwitchToken,
    playbackState: status.playbackState,
    timeControlStatus: status.timeControlStatus,
    reasonForWaitingToPlay: status.reasonForWaitingToPlay,
    isLoaded: status.isLoaded,
    isBuffering: status.isBuffering,
    didJustFinish: status.didJustFinish,
  };

  function inlineDebug(event: string, payload: Record<string, unknown> = {}) {
    console.log("[inline-debug:inline-player]", event, {
      ownerId: ownerIdRef.current,
      activeOwnerId: activeInlinePlayerSession?.ownerId ?? null,
      isOwner: isInlineOwner(),
      requestId: playRequestIdRef.current,
      target: inlineTarget,
      ...payload,
    });
  }

  function claimInlineOwnership(reset: (options?: ResetInlinePlayerOptions) => Promise<void>) {
    activeInlinePlayerSession = {
      ownerId: ownerIdRef.current,
      reset,
    };
  }

  function isInlineOwner() {
    return activeInlinePlayerSession?.ownerId === ownerIdRef.current;
  }

  async function releasePreviousInlineOwner() {
    if (!activeInlinePlayerSession || activeInlinePlayerSession.ownerId === ownerIdRef.current) {
      inlineDebug("release-previous-skip", {
        reason: !activeInlinePlayerSession ? "none" : "same-owner",
      });
      return;
    }

    const previousOwnerId = activeInlinePlayerSession.ownerId;
    inlineDebug("release-previous-start", { previousOwnerId });
    try {
      await activeInlinePlayerSession.reset({ awaitPause: false });
      inlineDebug("release-previous-done", { previousOwnerId });
    } catch (error) {
      inlineDebug("release-previous-error", {
        previousOwnerId,
        error: getInlineDebugError(error),
      });
      console.log("INLINE release previous owner error", error);
    }
  }

  function ignoreReleasedPlayerError(error: unknown) {
    const message = String(error);
    return message.includes("already released") || message.includes("cannot be cast");
  }

  function callPlayerSafely(action: () => void | Promise<void>, label: string) {
    inlineDebug("native-call-start", { label });
    try {
      return Promise.resolve(action()).then(() => {
        inlineDebug("native-call-done", { label });
      }).catch((error) => {
        if (!ignoreReleasedPlayerError(error)) {
          inlineDebug("native-call-error", { label, error: getInlineDebugError(error) });
          console.log(`INLINE ${label} error`, error);
          return;
        }
        inlineDebug("native-call-ignored-released-player", {
          label,
          error: getInlineDebugError(error),
        });
      });
    } catch (error) {
      if (!ignoreReleasedPlayerError(error)) {
        inlineDebug("native-call-sync-error", { label, error: getInlineDebugError(error) });
        console.log(`INLINE ${label} error`, error);
        return Promise.resolve();
      }
      inlineDebug("native-call-sync-ignored-released-player", {
        label,
        error: getInlineDebugError(error),
      });
      return Promise.resolve();
    }
  }

  function releaseSourceSwitchHold(reason = "unknown") {
    inlineDebug("source-switch-hold-release", {
      reason,
      hold: sourceSwitchHoldRef.current,
      latest: latestDebugStateRef.current,
    });
    sourceSwitchHoldRef.current = null;
    setSourceSwitchToken(null);
    setInlinePositionOverrideMs(null);
    setInlineDurationOverrideMs(null);
  }

  function failSourceSwitchLoad(
    reason: string,
    hold = sourceSwitchHoldRef.current,
    latest = latestDebugStateRef.current
  ) {
    if (hold && playRequestIdRef.current !== hold.requestId) return;
    inlineDebug("source-switch-load-timeout", {
      reason,
      hold,
      latest,
    });
    sourceSwitchHoldRef.current = null;
    pendingPlayTargetRef.current = null;
    setSourceSwitchToken(null);
    setInlinePositionOverrideMs(null);
    setInlineDurationOverrideMs(null);
    setInlinePlayingOverride(false);
    setInlineTarget(null);
    if (isInlineOwner()) {
      setStoreInlineTarget(null);
      setInlinePlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
    }
    void pauseNativePlayer({ awaitPause: false });
  }

  function logPlaybackFileDiagnostics(requestId: number, playbackUri: string, clip: ClipVersion) {
    void (async () => {
      const playbackFile = await getPlaybackUriDebugInfo(playbackUri);
      inlineDebug("toggle-inline-file-diagnostics", {
        requestId,
        currentRequestId: playRequestIdRef.current,
        clipId: clip.id,
        clipDurationMs: clip.durationMs,
        usesRenderedMix: playbackUri === clip.overdub?.renderedMixUri,
        audioUriTail: clip.audioUri ? getUriTail(clip.audioUri) : null,
        sourceAudioUriTail: clip.sourceAudioUri ? getUriTail(clip.sourceAudioUri) : null,
        renderedMixUriTail: clip.overdub?.renderedMixUri
          ? getUriTail(clip.overdub.renderedMixUri)
          : null,
        renderedMixDurationMs: clip.overdub?.renderedMixDurationMs ?? null,
        playbackFile,
      });
    })();
  }

  useEffect(() => {
    if (inlinePlayingOverride === null) return;
    if (sourceSwitchToken !== null) return;
    if (nativeInlinePlaying !== inlinePlayingOverride) return;
    inlineDebug("playing-override-cleared", {
      nativeInlinePlaying,
      inlinePlayingOverride,
      latest: latestDebugStateRef.current,
    });
    setInlinePlayingOverride(null);
  }, [inlinePlayingOverride, nativeInlinePlaying, sourceSwitchToken]);

  useEffect(() => {
    const shouldLog =
      !!inlineTarget ||
      nativeInlinePlaying ||
      inlinePlayingOverride !== null ||
      sourceSwitchToken !== null ||
      rawInlinePosition > 0;
    if (!shouldLog) return;

    const positionBucket = Math.floor(rawInlinePosition / 250);
    const logKey = JSON.stringify({
      positionBucket,
      rawInlineDuration,
      nativeInlinePlaying,
      effectivePlaying: isInlinePlaying,
      inlinePlayingOverride,
      inlinePositionOverrideMs,
      inlineDurationOverrideMs,
      sourceSwitchToken,
      playbackState: status.playbackState,
      timeControlStatus: status.timeControlStatus,
      reasonForWaitingToPlay: status.reasonForWaitingToPlay,
      isLoaded: status.isLoaded,
      isBuffering: status.isBuffering,
      didJustFinish: status.didJustFinish,
      target: inlineTarget,
    });
    if (lastStatusLogKeyRef.current === logKey) return;
    lastStatusLogKeyRef.current = logKey;
    inlineDebug("status", {
      rawPositionMs: rawInlinePosition,
      rawDurationMs: rawInlineDuration,
      effectivePositionMs: inlinePosition,
      effectiveDurationMs: inlineDuration,
      nativePlaying: nativeInlinePlaying,
      effectivePlaying: isInlinePlaying,
      playingOverride: inlinePlayingOverride,
      positionOverrideMs: inlinePositionOverrideMs,
      durationOverrideMs: inlineDurationOverrideMs,
      sourceSwitchToken,
      playbackState: status.playbackState,
      timeControlStatus: status.timeControlStatus,
      reasonForWaitingToPlay: status.reasonForWaitingToPlay,
      isLoaded: status.isLoaded,
      isBuffering: status.isBuffering,
      didJustFinish: status.didJustFinish,
    });
  }, [
    inlineDuration,
    inlineDurationOverrideMs,
    inlinePlayingOverride,
    inlinePosition,
    inlinePositionOverrideMs,
    inlineTarget,
    isInlinePlaying,
    nativeInlinePlaying,
    rawInlineDuration,
    rawInlinePosition,
    sourceSwitchToken,
    status.didJustFinish,
    status.isBuffering,
    status.isLoaded,
    status.playbackState,
    status.reasonForWaitingToPlay,
    status.timeControlStatus,
  ]);

  useEffect(() => {
    const hasMismatch =
      inlineTarget &&
      inlinePlayingOverride !== null &&
      inlinePlayingOverride !== nativeInlinePlaying;
    if (!hasMismatch) return;
    const mismatchKey = JSON.stringify({
      inlineTarget,
      inlinePlayingOverride,
      nativeInlinePlaying,
      sourceSwitchToken,
      rawInlinePosition,
      playbackState: status.playbackState,
      timeControlStatus: status.timeControlStatus,
    });
    if (lastMismatchLogKeyRef.current === mismatchKey) return;
    lastMismatchLogKeyRef.current = mismatchKey;
    inlineDebug("playing-mismatch", {
      nativePlaying: nativeInlinePlaying,
      playingOverride: inlinePlayingOverride,
      effectivePlaying: isInlinePlaying,
      sourceSwitchToken,
      latest: latestDebugStateRef.current,
    });
  }, [
    inlinePlayingOverride,
    inlineTarget,
    isInlinePlaying,
    nativeInlinePlaying,
    rawInlinePosition,
    sourceSwitchToken,
    status.playbackState,
    status.timeControlStatus,
  ]);

  useEffect(() => {
    const hold = sourceSwitchHoldRef.current;
    if (!hold || sourceSwitchToken === null || inlinePositionOverrideMs === null) return;

    if (playRequestIdRef.current !== hold.requestId) {
      releaseSourceSwitchHold("stale-request");
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
      releaseSourceSwitchHold("native-position-reset");
      return;
    }

    const sourceLooksUnableToLoad =
      rawInlineDuration === 0 &&
      !nativeInlinePlaying &&
      (status.playbackState === "idle" || status.playbackState === "buffering" || !status.isLoaded);
    if (elapsedMs >= SOURCE_SWITCH_LOAD_TIMEOUT_MS && sourceLooksUnableToLoad) {
      failSourceSwitchLoad("native-never-loaded", hold, latestDebugStateRef.current);
      return;
    }

    inlineDebug("source-switch-hold-active", {
      hold,
      elapsedMs,
      rawInlinePosition,
      rawInlineDuration,
      previousPositionMs: hold.previousPositionMs,
      previousDurationMs: hold.previousDurationMs,
      expectedDurationMs,
      durationChangedFromPrevious,
      durationLooksLikeExpected,
      sourceLooksUnableToLoad,
    });

    const remainingTimeoutMs = SOURCE_SWITCH_LOAD_TIMEOUT_MS - elapsedMs;
    if (!sourceLooksUnableToLoad || remainingTimeoutMs <= 0) return;

    const timeout = setTimeout(() => {
      if (playRequestIdRef.current !== hold.requestId) return;
      const latest = latestDebugStateRef.current;
      const latestRawDurationMs = Number(latest.rawDurationMs ?? 0);
      const latestNativePlaying = latest.nativePlaying === true;
      const latestPlaybackState = String(latest.playbackState ?? "");
      const latestIsLoaded = latest.isLoaded === true;
      const latestStillUnableToLoad =
        latestRawDurationMs === 0 &&
        !latestNativePlaying &&
        (latestPlaybackState === "idle" || latestPlaybackState === "buffering" || !latestIsLoaded);
      if (!latestStillUnableToLoad) return;
      failSourceSwitchLoad("native-never-loaded-timeout", hold, latest);
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

  useEffect(() => {
    if (status.didJustFinish && inlineTarget) {
      if (!isInlineOwner()) return;
      if (sourceSwitchToken !== null || sourceSwitchHoldRef.current || inlinePositionOverrideMs !== null) {
        inlineDebug("did-just-finish-ignored-source-switch", {
          latest: latestDebugStateRef.current,
          hold: sourceSwitchHoldRef.current,
        });
        return;
      }
      inlineDebug("did-just-finish-clear-target", {
        latest: latestDebugStateRef.current,
      });
      setInlineTarget(null);
      setInlinePlayingOverride(false);
    }
  }, [inlinePositionOverrideMs, inlineTarget, sourceSwitchToken, status.didJustFinish]);

  useEffect(() => {
    if (!isInlineOwner()) return;
    inlineDebug("store-target-publish", { inlineTarget });
    setStoreInlineTarget(inlineTarget);
  }, [inlineTarget, setStoreInlineTarget]);

  useEffect(() => {
    if (!isInlineOwner()) return;
    inlineDebug("store-playback-publish", {
      positionMs: inlinePosition,
      durationMs: inlineDuration,
      isPlaying: isInlinePlaying,
    });
    setInlinePlaybackState({
      positionMs: inlinePosition,
      durationMs: inlineDuration,
      isPlaying: isInlinePlaying,
    });
  }, [inlineDuration, inlinePosition, isInlinePlaying, setInlinePlaybackState]);

  useEffect(() => {
    if (stopRequestToken === handledStopTokenRef.current) return;
    handledStopTokenRef.current = stopRequestToken;
    if (!isInlineOwner()) {
      inlineDebug("stop-token-ignored-not-owner", { stopRequestToken });
      return;
    }
    inlineDebug("stop-token-received", { stopRequestToken });
    void resetInlinePlayer();
  }, [stopRequestToken]);

  useEffect(() => {
    if (toggleRequestToken === handledToggleTokenRef.current) return;
    handledToggleTokenRef.current = toggleRequestToken;
    if (!inlineTarget) {
      inlineDebug("toggle-token-ignored-no-target", { toggleRequestToken });
      return;
    }
    if (!isInlineOwner()) {
      inlineDebug("toggle-token-ignored-not-owner", { toggleRequestToken });
      return;
    }
    inlineDebug("toggle-token-received", { toggleRequestToken });
    void toggleActiveInlinePlayback();
  }, [inlineTarget, toggleRequestToken]);

  useEffect(() => {
    if (seekRequestToken === handledSeekTokenRef.current) return;
    handledSeekTokenRef.current = seekRequestToken;
    if (!inlineTarget) {
      inlineDebug("seek-token-ignored-no-target", { seekRequestToken, seekTargetMs });
      return;
    }
    if (!isInlineOwner()) {
      inlineDebug("seek-token-ignored-not-owner", { seekRequestToken, seekTargetMs });
      return;
    }
    inlineDebug("seek-token-received", { seekRequestToken, seekTargetMs });
    void seekInline(seekTargetMs);
  }, [seekRequestToken]);

  useEffect(() => {
    if (inlinePlaybackSpeed !== lastAppliedSpeedRef.current) {
      inlineDebug("speed-change", {
        previousSpeed: lastAppliedSpeedRef.current,
        nextSpeed: inlinePlaybackSpeed,
      });
      lastAppliedSpeedRef.current = inlinePlaybackSpeed;
      try {
        (player as any).setPlaybackRate?.(inlinePlaybackSpeed);
      } catch (error) {
        inlineDebug("speed-change-error", { error: getInlineDebugError(error) });
      }
    }
  }, [inlinePlaybackSpeed, player]);

  function clearInlineUiState(options?: ResetInlinePlayerOptions) {
    inlineDebug("clear-ui-state-start", {
      options,
      latest: latestDebugStateRef.current,
    });
    try { player.clearLockScreenControls(); } catch {}
    sourceSwitchHoldRef.current = null;
    setSourceSwitchToken(null);
    setInlinePositionOverrideMs(null);
    setInlineDurationOverrideMs(null);
    scrubPausePromiseRef.current = null;
    wasPlayingBeforeScrubRef.current = false;
    setInlinePlayingOverride(false);
    setInlineTarget(null);
    if (isInlineOwner()) {
      setStoreInlineTarget(null);
      setInlinePlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
      if (options?.releaseOwnership !== false) {
        activeInlinePlayerSession = null;
      }
    }
    inlineDebug("clear-ui-state-done", { options });
  }

  async function pauseNativePlayer(options?: { awaitPause?: boolean }) {
    inlineDebug("pause-native-start", { options });
    const pausePromise = callPlayerSafely(() => player.pause(), "pause");
    if (options?.awaitPause === false) {
      inlineDebug("pause-native-detached", { options });
      return;
    }
    await pausePromise;
    inlineDebug("pause-native-awaited", { options });
  }

  async function resetInlinePlayer(options?: ResetInlinePlayerOptions) {
    inlineDebug("reset-start", { options, previousRequestId: playRequestIdRef.current });
    playRequestIdRef.current += 1;
    pendingPlayTargetRef.current = null;
    clearInlineUiState(options);
    await pauseNativePlayer({ awaitPause: options?.awaitPause });
    inlineDebug("reset-done", { options });
  }

  async function toggleActiveInlinePlayback() {
    try {
      inlineDebug("toggle-active-start", {
        latest: latestDebugStateRef.current,
      });
      if (isInlinePlaying) {
        setInlinePlayingOverride(false);
        inlineDebug("toggle-active-pause-immediate-ui", {
          latest: latestDebugStateRef.current,
        });
        void pauseNativePlayer({ awaitPause: false });
        return;
      }

      setInlinePlayingOverride(true);
      inlineDebug("toggle-active-play-immediate-ui", {
        latest: latestDebugStateRef.current,
      });
      await activateAndPlay(player, status, inlineDuration, inlinePosition);
      inlineDebug("toggle-active-play-native-done", {
        latest: latestDebugStateRef.current,
      });
    } catch (err) {
      setInlinePlayingOverride(false);
      inlineDebug("toggle-active-error", { error: getInlineDebugError(err) });
      console.log("INLINE toggle error", err);
    }
  }

  async function toggleInlinePlayback(ideaId: string, clip: ClipVersion) {
    const playbackUri = getClipPlaybackUri(clip);
    inlineDebug("toggle-inline-request", {
      ideaId,
      clipId: clip.id,
      clipTitle: clip.title,
      clipDurationMs: clip.durationMs,
      playbackUriTail: playbackUri ? getUriTail(playbackUri) : null,
      latest: latestDebugStateRef.current,
    });
    if (!playbackUri) {
      inlineDebug("toggle-inline-missing-uri", {
        ideaId,
        clipId: clip.id,
      });
      return;
    }

    const pendingPlayTarget = pendingPlayTargetRef.current;
    if (pendingPlayTarget?.ideaId === ideaId && pendingPlayTarget.clipId === clip.id) {
      inlineDebug("toggle-inline-duplicate-pending-ignored", {
        ideaId,
        clipId: clip.id,
        pendingPlayTarget,
      });
      return;
    }

    if (inlineTarget && inlineTarget.ideaId === ideaId && inlineTarget.clipId === clip.id) {
      inlineDebug("toggle-inline-same-target", {
        ideaId,
        clipId: clip.id,
        latest: latestDebugStateRef.current,
      });
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
        inlineDebug(
          sameTargetLooksStuck
            ? "toggle-inline-same-target-stuck-retry"
            : "toggle-inline-same-target-starting-ignored",
          {
            ideaId,
            clipId: clip.id,
            latest: latestDebugStateRef.current,
          }
        );
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
      const requestStartedAtMs = Date.now();
      requestId = playRequestIdRef.current + 1;
      playRequestIdRef.current = requestId;
      pendingPlayTargetRef.current = { requestId, ideaId, clipId: clip.id };
      logPlaybackFileDiagnostics(requestId, playbackUri, clip);
      await releasePreviousInlineOwner();
      claimInlineOwnership(resetInlinePlayer);
      inlineDebug("toggle-inline-new-target-claimed", {
        requestId,
        ideaId,
        clipId: clip.id,
        previousTarget: inlineTarget,
      });
      requestPlayerClose();
      clearPlayerQueue();
      inlineDebug("toggle-inline-before-play-new-start", { requestId, hasHook: !!onBeforePlayNew });
      if (onBeforePlayNew) await onBeforePlayNew();
      inlineDebug("toggle-inline-before-play-new-done", {
        requestId,
        elapsedMs: Date.now() - requestStartedAtMs,
      });
      clearInlineUiState({ releaseOwnership: false });

      sourceSwitchHoldRef.current = {
        requestId,
        startedAtMs: Date.now(),
        previousPositionMs: rawInlinePosition,
        previousDurationMs: rawInlineDuration,
      };
      setSourceSwitchToken(requestId);
      setInlinePositionOverrideMs(0);
      setInlineDurationOverrideMs(clip.durationMs ?? 0);
      inlineDebug("toggle-inline-source-hold-set", {
        requestId,
        hold: sourceSwitchHoldRef.current,
        durationOverrideMs: clip.durationMs ?? 0,
      });
      setInlineTarget({ ideaId, clipId: clip.id });
      setInlinePlayingOverride(true);
      inlineDebug("toggle-inline-ui-active-set", {
        requestId,
        ideaId,
        clipId: clip.id,
        elapsedMs: Date.now() - requestStartedAtMs,
      });
      const replaceStartedAtMs = Date.now();
      inlineDebug("toggle-inline-replace-start", {
        requestId,
        playbackUriTail: getUriTail(playbackUri),
        seekToStart: false,
      });
      await replacePlaybackSource(player, playbackUri, true, { seekToStart: false });
      inlineDebug("toggle-inline-replace-done", {
        requestId,
        replaceElapsedMs: Date.now() - replaceStartedAtMs,
        totalElapsedMs: Date.now() - requestStartedAtMs,
        latest: latestDebugStateRef.current,
      });
      if (playRequestIdRef.current !== requestId) {
        inlineDebug("toggle-inline-stale-after-replace", {
          requestId,
          currentRequestId: playRequestIdRef.current,
        });
        return;
      }
      setTimeout(() => {
        if (playRequestIdRef.current !== requestId) return;
        inlineDebug("toggle-inline-post-play-check", {
          requestId,
          elapsedMs: Date.now() - requestStartedAtMs,
          latest: latestDebugStateRef.current,
        });
      }, 650);
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
        releaseSourceSwitchHold("play-error");
        setInlineTarget(null);
        setInlinePlayingOverride(false);
      }
      inlineDebug("toggle-inline-error", {
        requestId,
        ideaId,
        clipId: clip.id,
        error: getInlineDebugError(err),
      });
      console.log("INLINE play error", err);
    } finally {
      if (requestId !== null && pendingPlayTargetRef.current?.requestId === requestId) {
        pendingPlayTargetRef.current = null;
        inlineDebug("toggle-inline-pending-cleared", { requestId });
      }
    }
  }

  async function seekInline(ms: number) {
    const durationMs = inlineDuration || Math.round((status.duration ?? 0) * 1000);
    const targetMs = Math.max(0, Math.min(ms, durationMs || ms));
    inlineDebug("seek-inline-start", {
      requestedMs: ms,
      targetMs,
      durationMs,
      latest: latestDebugStateRef.current,
    });
    await callPlayerSafely(() => player.seekTo(targetMs / 1000), "seek");
    inlineDebug("seek-inline-done", {
      requestedMs: ms,
      targetMs,
      latest: latestDebugStateRef.current,
    });
  }

  async function beginInlineScrub() {
    inlineDebug("scrub-begin", {
      latest: latestDebugStateRef.current,
    });
    wasPlayingBeforeScrubRef.current = isInlinePlaying;
    scrubPausePromiseRef.current = null;
  }

  async function endInlineScrub(ms: number) {
    inlineDebug("scrub-end-start", {
      requestedMs: ms,
      wasPlayingBeforeScrub: wasPlayingBeforeScrubRef.current,
      latest: latestDebugStateRef.current,
    });
    await seekInline(ms);
    wasPlayingBeforeScrubRef.current = false;
    scrubPausePromiseRef.current = null;
    inlineDebug("scrub-end-done", {
      requestedMs: ms,
      latest: latestDebugStateRef.current,
    });
  }

  async function cancelInlineScrub() {
    inlineDebug("scrub-cancel", {
      wasPlayingBeforeScrub: wasPlayingBeforeScrubRef.current,
      latest: latestDebugStateRef.current,
    });
    wasPlayingBeforeScrubRef.current = false;
    scrubPausePromiseRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (!isInlineOwner()) return;
      inlineDebug("unmount-owner-cleanup", {
        latest: latestDebugStateRef.current,
      });
      activeInlinePlayerSession = null;
      setStoreInlineTarget(null);
      setInlinePlaybackState({
        positionMs: 0,
        durationMs: 0,
        isPlaying: false,
      });
      try { player.clearLockScreenControls(); } catch {}
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
