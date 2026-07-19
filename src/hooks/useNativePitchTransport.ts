import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SongNookPitchShiftModule, {
  type NativePitchShiftCapabilities,
  type NativePitchShiftPlaybackState,
} from "../../modules/songnook-pitch-shift";
import {
  activatePlaybackAudioSession,
  createAudioSessionOwner,
  releaseAudioSessionOwner,
} from "../services/audioSession";
import { isPlaybackNearEnd } from "../services/transportPlayback";
import {
  buildUnavailablePitchShiftCapabilities,
  clampPitchShiftSemitones,
  type PitchShiftCapabilities,
} from "../domain/pitchShift";

/** Tagged, greppable diagnostics for the native pitch/speed engine. Event-driven
 * only (never called from render) so it doesn't spam. Filter logs by "[pitch]". */
const pitchLog = (...args: unknown[]) => console.log("[pitch]", ...args);

/** Coalesce fast pitch/speed taps into a single native reconfiguration — media3's
 * audio pipeline stalls (buffer underrun, audio freezes) when `playbackParameters`
 * is flushed many times in quick succession during playback. Only the final value
 * of a burst is applied. Structural changes (load/ownership) stay immediate. */
const NATIVE_PARAM_DEBOUNCE_MS = 160;

export const DEFAULT_NATIVE_PLAYBACK_STATE: NativePitchShiftPlaybackState = {
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

export function normalizeNativePitchCapabilities(
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

/** The underlying ("source") transport the native pitch engine borrows from and
 * hands back to — the full player for practice, the expo-audio preview for the
 * editor. Identity `sourceKey` changing means a different source → reload. */
export type NativeTransportSource = {
  sourceKey: string | null;
  audioUri: string | null;
  positionMs: number;
  durationMs: number;
  isPlaying: boolean;
  pause: () => Promise<void>;
  play: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  setPlaybackRate: (rate: number) => void;
};

type UseNativePitchTransportArgs = {
  /** Audio-session owner label, e.g. "player-screen" / "editor-screen". */
  ownerLabel: string;
  /** Caller's predicate (mode / focus / sticky / pitch) — excludes caps, uri, disabled. */
  wantsNative: boolean;
  selectSupported: (caps: PitchShiftCapabilities) => boolean;
  source: NativeTransportSource;
  playbackRate: number;
  pitchShiftSemitones: number;
  /** Restart from 0 when play() is pressed near the end (editor). */
  restartAtEndOnPlay?: boolean;
  /** Force autoplay on (re)load regardless of prior playing state (player queue). */
  extraAutoplay?: boolean;
  /** Fired when native playback ends; receives the loaded source key. */
  onEnded?: (sourceKey: string | null) => void;
};

/**
 * Shared native pitch/speed transport engine. Owns the SongNookPitchShift native
 * module lifecycle — capabilities + listeners, audio-session ownership, load /
 * rate / pitch sync, hand-back to the source, and error fallback — and exposes a
 * source-agnostic transport. The player (practice) and the editor (preview) wrap
 * it with thin adapters; this is the single tried-and-tested implementation.
 */
export function useNativePitchTransport({
  ownerLabel,
  wantsNative,
  selectSupported,
  source,
  playbackRate,
  pitchShiftSemitones,
  restartAtEndOnPlay = false,
  extraAutoplay = false,
  onEnded,
}: UseNativePitchTransportArgs) {
  const [capabilities, setCapabilities] = useState<PitchShiftCapabilities>(
    buildUnavailablePitchShiftCapabilities()
  );
  const [nativeState, setNativeState] = useState<NativePitchShiftPlaybackState>(
    DEFAULT_NATIVE_PLAYBACK_STATE
  );
  const [nativeTransportDisabled, setNativeTransportDisabled] = useState(false);

  const nativeStateRef = useRef(nativeState);
  const loadedKeyRef = useRef<string | null>(null);
  const shouldResumeOnReleaseRef = useRef(true);
  const audioSessionOwnerIdRef = useRef(createAudioSessionOwner(ownerLabel));
  const ownsAudioSessionRef = useRef(false);
  const onEndedRef = useRef(onEnded);
  // Source + position read via refs so high-frequency position updates don't churn
  // the sync effect — position is only ever needed as a load start point.
  const sourceRef = useRef(source);

  nativeStateRef.current = nativeState;
  onEndedRef.current = onEnded;
  sourceRef.current = source;

  const clamped = clampPitchShiftSemitones(pitchShiftSemitones);
  const supported = selectSupported(capabilities);

  // Serialize every native engine command through one promise chain so rapid
  // changes (e.g. dragging the pitch stepper) can never issue overlapping
  // reconfigurations — the native audio graph throws "Unexpected runtime error"
  // when commanded concurrently. Each command waits for the previous to settle.
  const nativeOpChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const runExclusive = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const result = nativeOpChainRef.current.then(task, task);
    nativeOpChainRef.current = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }, []);

  // Latest desired transport target — read inside the coalesced reconcile so a
  // burst of changes collapses to the final value instead of replaying each step.
  const desiredRef = useRef({
    shouldOwn: false,
    sourceKey: source.sourceKey,
    audioUri: source.audioUri,
    playbackRate,
    pitch: clamped,
    extraAutoplay,
  });
  const reconcileQueuedRef = useRef(false);

  useEffect(() => {
    if (!SongNookPitchShiftModule) {
      return;
    }
    pitchLog(`[${ownerLabel}] subscribing to native pitch engine`);
    let cancelled = false;
    void SongNookPitchShiftModule.getCapabilities()
      .then((value) => {
        pitchLog(`[${ownerLabel}] capabilities`, value);
        if (!cancelled) setCapabilities(normalizeNativePitchCapabilities(value));
      })
      .catch((error) => console.warn("[pitch] capabilities lookup failed", error));
    void SongNookPitchShiftModule.getPlaybackState()
      .then((value) => {
        if (!cancelled) setNativeState(value);
      })
      .catch(() => {});

    const stateSub = SongNookPitchShiftModule.addListener("onStateChange", (value) => {
      setNativeState(value);
    });
    const endSub = SongNookPitchShiftModule.addListener("onPlaybackEnded", (value) => {
      pitchLog(`[${ownerLabel}] onPlaybackEnded`, { key: loadedKeyRef.current, atMs: value.currentTimeMs });
      setNativeState(value);
      onEndedRef.current?.(loadedKeyRef.current);
    });
    const errorSub = SongNookPitchShiftModule.addListener("onError", ({ message }) => {
      console.error(`[pitch] [${ownerLabel}] native engine error`, message);
      setNativeTransportDisabled(true);
    });
    return () => {
      cancelled = true;
      stateSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, []);

  const shouldOwnNativeTransport =
    wantsNative && supported && !nativeTransportDisabled && !!source.audioUri;
  const isNativeTransportActive =
    shouldOwnNativeTransport &&
    !!source.sourceKey &&
    loadedKeyRef.current === source.sourceKey &&
    nativeState.isLoaded;

  desiredRef.current = {
    shouldOwn: shouldOwnNativeTransport,
    sourceKey: source.sourceKey,
    audioUri: source.audioUri,
    playbackRate,
    pitch: clamped,
    extraAutoplay,
  };

  const ensureAudioSessionOwnership = useCallback(async () => {
    if (ownsAudioSessionRef.current) return;
    await activatePlaybackAudioSession({ ownerId: audioSessionOwnerIdRef.current });
    ownsAudioSessionRef.current = true;
  }, []);

  const releaseAudioSessionOwnership = useCallback(async () => {
    if (!ownsAudioSessionRef.current) return;
    ownsAudioSessionRef.current = false;
    await releaseAudioSessionOwner(audioSessionOwnerIdRef.current);
  }, []);

  const syncBackToSource = useCallback(
    async (resumePlayback: boolean) => {
      const src = sourceRef.current;
      const hasNativeSession = loadedKeyRef.current || nativeStateRef.current.isLoaded;

      if (!SongNookPitchShiftModule) {
        if (ownsAudioSessionRef.current) await releaseAudioSessionOwnership();
        shouldResumeOnReleaseRef.current = true;
        return;
      }
      if (!hasNativeSession && !ownsAudioSessionRef.current) {
        shouldResumeOnReleaseRef.current = true;
        return;
      }

      const snapshot = nativeStateRef.current;
      pitchLog(`[${ownerLabel}] syncBack → source`, {
        resumePlayback,
        positionMs: snapshot.currentTimeMs,
        playbackRate: snapshot.playbackRate,
        wasPlaying: snapshot.isPlaying,
      });
      loadedKeyRef.current = null;
      const state = await SongNookPitchShiftModule.unload();
      setNativeState(state);
      await releaseAudioSessionOwnership();
      await src.seekTo(snapshot.currentTimeMs);
      src.setPlaybackRate(snapshot.playbackRate);
      if (resumePlayback && snapshot.isPlaying) {
        await src.play();
      }
      shouldResumeOnReleaseRef.current = true;
    },
    [releaseAudioSessionOwnership]
  );

  const disableNativeTransport = useCallback(
    async (reason: string, options?: { forcePlay?: boolean }) => {
      console.warn(`[pitch] [${ownerLabel}] disabling native transport:`, reason);
      setNativeTransportDisabled(true);
      await syncBackToSource(false);
      if (options?.forcePlay) {
        await sourceRef.current.play();
      }
    },
    [syncBackToSource]
  );

  const clearDisabled = useCallback(() => setNativeTransportDisabled(false), []);

  // Bring the native engine in line with the latest desired target. Always runs
  // inside `runExclusive`, and reads `desiredRef` (not closure) so a coalesced
  // run applies the freshest value rather than a stale step from mid-drag.
  const reconcileNative = useCallback(async () => {
    const nativeModule = SongNookPitchShiftModule;
    if (!nativeModule) return;
    const d = desiredRef.current;
    const src = sourceRef.current;

    if (!d.shouldOwn || !d.audioUri) {
      if (loadedKeyRef.current || ownsAudioSessionRef.current) {
        await syncBackToSource(shouldResumeOnReleaseRef.current && nativeStateRef.current.isPlaying);
      }
      return;
    }

    shouldResumeOnReleaseRef.current = true;
    await ensureAudioSessionOwnership();
    if (src.isPlaying) await src.pause();

    const shouldReload = loadedKeyRef.current !== d.sourceKey || !nativeStateRef.current.isLoaded;
    if (shouldReload) {
      const autoplay =
        d.extraAutoplay || (loadedKeyRef.current ? nativeStateRef.current.isPlaying : src.isPlaying);
      const startPositionMs =
        loadedKeyRef.current && loadedKeyRef.current !== d.sourceKey ? 0 : src.positionMs;
      pitchLog(`[${ownerLabel}] sync → loadForPractice`, {
        startPositionMs,
        autoplay,
        playbackRate: d.playbackRate,
        pitchShiftSemitones: d.pitch,
      });
      const state = await nativeModule.loadForPractice({
        sourceUri: d.audioUri,
        startPositionMs,
        autoplay,
        playbackRate: d.playbackRate,
        pitchShiftSemitones: d.pitch,
      });
      loadedKeyRef.current = d.sourceKey;
      setNativeState(state);
      return;
    }

    if (Math.abs(nativeStateRef.current.playbackRate - desiredRef.current.playbackRate) > 0.01) {
      pitchLog(`[${ownerLabel}] sync → setPlaybackRate`, desiredRef.current.playbackRate);
      const state = await nativeModule.setPlaybackRate(desiredRef.current.playbackRate);
      setNativeState(state);
    }
    if (nativeStateRef.current.pitchShiftSemitones !== desiredRef.current.pitch) {
      pitchLog(`[${ownerLabel}] sync → setPitchShiftSemitones`, desiredRef.current.pitch);
      const state = await nativeModule.setPitchShiftSemitones(desiredRef.current.pitch);
      setNativeState(state);
    }
  }, [ensureAudioSessionOwnership, ownerLabel, syncBackToSource]);

  // Schedule a reconcile on the serialized chain. Coalesced: while one is already
  // queued, further requests fold into it (it reads the latest target when it
  // runs); the flag clears at run start so changes mid-run queue a trailing pass.
  const requestReconcile = useCallback(() => {
    if (!SongNookPitchShiftModule) return;
    if (reconcileQueuedRef.current) return;
    reconcileQueuedRef.current = true;
    void runExclusive(async () => {
      reconcileQueuedRef.current = false;
      try {
        await reconcileNative();
      } catch (error) {
        await disableNativeTransport(
          `Native transport sync failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }, [disableNativeTransport, reconcileNative, runExclusive]);

  // Structural changes (load / hand-back / source swap) reconcile immediately so
  // play and source switches stay responsive.
  useEffect(() => {
    requestReconcile();
  }, [shouldOwnNativeTransport, source.sourceKey, source.audioUri, extraAutoplay, requestReconcile]);

  // Pitch/speed changes are debounced: a burst of fast +/- taps collapses to one
  // native reconfiguration (the final value), since rapid playbackParameters
  // flushes stall media3's audio pipeline. A single deliberate tap still applies
  // after the short window.
  useEffect(() => {
    const handle = setTimeout(requestReconcile, NATIVE_PARAM_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [clamped, playbackRate, requestReconcile]);

  useEffect(() => {
    return () => {
      const nativeModule = SongNookPitchShiftModule;
      if (!nativeModule) return;
      void runExclusive(() => nativeModule.unload()).catch(() => {});
      void releaseAudioSessionOwnership().catch(() => {});
      loadedKeyRef.current = null;
    };
  }, [releaseAudioSessionOwnership, runExclusive]);

  const play = useCallback(
    () =>
      runExclusive(async () => {
        const src = sourceRef.current;
        try {
          const durationMs = isNativeTransportActive
            ? nativeStateRef.current.durationMs || src.durationMs
            : src.durationMs;
          const positionMs = isNativeTransportActive ? nativeStateRef.current.currentTimeMs : src.positionMs;
          const atEnd = restartAtEndOnPlay && isPlaybackNearEnd(positionMs, durationMs);
          pitchLog(`[${ownerLabel}] play`, {
            native: isNativeTransportActive,
            shouldOwn: shouldOwnNativeTransport,
            atEnd,
          });

          if (
            SongNookPitchShiftModule &&
            shouldOwnNativeTransport &&
            !isNativeTransportActive &&
            src.audioUri &&
            src.sourceKey != null
          ) {
            pitchLog(`[${ownerLabel}] play → loadForPractice`, {
              startPositionMs: atEnd ? 0 : src.positionMs,
              playbackRate,
              pitchShiftSemitones: clamped,
            });
            await ensureAudioSessionOwnership();
            if (src.isPlaying) await src.pause();
            const state = await SongNookPitchShiftModule.loadForPractice({
              sourceUri: src.audioUri,
              startPositionMs: atEnd ? 0 : src.positionMs,
              autoplay: true,
              playbackRate,
              pitchShiftSemitones: clamped,
            });
            loadedKeyRef.current = src.sourceKey;
            setNativeState(state);
            return;
          }

          if (isNativeTransportActive && SongNookPitchShiftModule) {
            if (atEnd) {
              const seekState = await SongNookPitchShiftModule.seekTo(0);
              setNativeState(seekState);
            }
            const state = await SongNookPitchShiftModule.play();
            setNativeState(state);
            return;
          }

          if (atEnd) await src.seekTo(0);
          await src.play();
        } catch (error) {
          await disableNativeTransport(
            `Native transport play failed: ${error instanceof Error ? error.message : String(error)}`,
            { forcePlay: true }
          );
        }
      }),
    [
      clamped,
      disableNativeTransport,
      ensureAudioSessionOwnership,
      isNativeTransportActive,
      playbackRate,
      restartAtEndOnPlay,
      runExclusive,
      shouldOwnNativeTransport,
    ]
  );

  const pause = useCallback(
    () =>
      runExclusive(async () => {
        try {
          if (isNativeTransportActive && SongNookPitchShiftModule) {
            const state = await SongNookPitchShiftModule.pause();
            setNativeState(state);
            return;
          }
          await sourceRef.current.pause();
        } catch (error) {
          await disableNativeTransport(
            `Native transport pause failed: ${error instanceof Error ? error.message : String(error)}`
          );
          await sourceRef.current.pause();
        }
      }),
    [disableNativeTransport, isNativeTransportActive, runExclusive]
  );

  const seekTo = useCallback(
    (positionMs: number) =>
      runExclusive(async () => {
        try {
          if (isNativeTransportActive && SongNookPitchShiftModule) {
            const state = await SongNookPitchShiftModule.seekTo(positionMs);
            setNativeState(state);
            return;
          }
          await sourceRef.current.seekTo(positionMs);
        } catch (error) {
          await disableNativeTransport(
            `Native transport seek failed: ${error instanceof Error ? error.message : String(error)}`
          );
          await sourceRef.current.seekTo(positionMs);
        }
      }),
    [disableNativeTransport, isNativeTransportActive, runExclusive]
  );

  const setPlaybackRate = useCallback(
    (rate: number) =>
      runExclusive(async () => {
        try {
          if (isNativeTransportActive && SongNookPitchShiftModule) {
            const state = await SongNookPitchShiftModule.setPlaybackRate(rate);
            setNativeState(state);
          }
          sourceRef.current.setPlaybackRate(rate);
        } catch (error) {
          await disableNativeTransport(
            `Native transport rate change failed: ${error instanceof Error ? error.message : String(error)}`
          );
          sourceRef.current.setPlaybackRate(rate);
        }
      }),
    [disableNativeTransport, isNativeTransportActive, runExclusive]
  );

  const togglePlay = useCallback(async () => {
    const isPlaying = isNativeTransportActive ? nativeStateRef.current.isPlaying : sourceRef.current.isPlaying;
    if (isPlaying) {
      await pause();
      return;
    }
    await play();
  }, [isNativeTransportActive, pause, play]);

  const prepareForRelease = useCallback(() => {
    shouldResumeOnReleaseRef.current = false;
  }, []);

  const effectivePositionMs = isNativeTransportActive ? nativeState.currentTimeMs : source.positionMs;
  const effectiveDurationMs = isNativeTransportActive
    ? nativeState.durationMs || source.durationMs
    : source.durationMs;
  const effectiveIsPlaying = isNativeTransportActive ? nativeState.isPlaying : source.isPlaying;
  const effectivePlaybackRate = isNativeTransportActive ? nativeState.playbackRate : playbackRate;

  return useMemo(
    () => ({
      capabilities,
      nativeState,
      nativeTransportDisabled,
      isOwningNativeTransport: shouldOwnNativeTransport,
      isNativeTransportActive,
      effectivePositionMs,
      effectiveDurationMs,
      effectiveIsPlaying,
      effectivePlaybackRate,
      play,
      pause,
      seekTo,
      setPlaybackRate,
      togglePlay,
      prepareForRelease,
      clearDisabled,
    }),
    [
      capabilities,
      clearDisabled,
      effectiveDurationMs,
      effectiveIsPlaying,
      effectivePlaybackRate,
      effectivePositionMs,
      isNativeTransportActive,
      nativeState,
      nativeTransportDisabled,
      pause,
      play,
      prepareForRelease,
      seekTo,
      setPlaybackRate,
      shouldOwnNativeTransport,
      togglePlay,
    ]
  );
}
