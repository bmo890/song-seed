import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SongNookPitchShiftModule, {
  type NativePitchShiftCapabilities,
  type NativePitchShiftPlaybackState,
  type NativeSoundSettings,
} from "../../modules/songnook-pitch-shift";
import {
  activatePlaybackAudioSession,
  createAudioSessionOwner,
  releaseAudioSessionOwner,
} from "../services/audioSession";
import { isPlaybackNearEnd } from "../services/transportPlayback";
import { classifyTwinMove } from "./twinFollow";
import { shouldCommitNativeState } from "./nativeStateCommit";
import { createTransportPositionChannel } from "../domain/transportPosition";
import {
  buildUnavailablePitchShiftCapabilities,
  clampPitchShiftSemitones,
  type PitchShiftCapabilities,
} from "../domain/pitchShift";

/** How long after a pause the engine's "ended" report is taken as the pause's echo. */
const PAUSE_ECHO_MS = 2000;

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
  /** Silences the source while the engine sounds (the muted twin, below). */
  setMuted?: (muted: boolean) => void;
  /** The source engine is loaded with this same clip (false mid-swap). */
  inSync?: boolean;
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
  /** The take's level and tone (Sound room). Omit for a flat transport. */
  sound?: NativeSoundSettings;
  /** Restart from 0 when play() is pressed near the end (editor). */
  restartAtEndOnPlay?: boolean;
  /** Force autoplay on (re)load regardless of prior playing state (player queue). */
  extraAutoplay?: boolean;
  /** Fired when native playback ends; receives the loaded source key. */
  onEnded?: (sourceKey: string | null) => void;
  /**
   * Keep the source running MUTED alongside the engine instead of pausing it
   * (2026-10-21, the full player). The source is what the dock, the lock screen
   * and headphone buttons drive; muted and in step, it keeps them truthful, and
   * a play, pause or seek they make on it is mirrored onto the engine. Without
   * it a pitched clip snapped back to its original pitch when the player
   * docked, and a lock-screen play started the source alongside the engine.
   */
  twinSource?: boolean;
  /**
   * Render on a change of state and once a second, like the plain player, instead
   * of on every engine report; the reel and the loop read `positionChannel`. Off
   * for callers that still take position as a prop (the editor preview).
   */
  throttlePositionCommits?: boolean;
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
  sound,
  restartAtEndOnPlay = false,
  extraAutoplay = false,
  onEnded,
  twinSource = false,
  throttlePositionCommits = false,
}: UseNativePitchTransportArgs) {
  const soundGainDb = sound?.gainDb ?? 0;
  const soundTonePreset = sound?.tonePreset ?? "neutral";
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

  onEndedRef.current = onEnded;
  sourceRef.current = source;

  // Every engine report lands here. The ref and the channel always carry the
  // latest; React renders only when shouldCommitNativeState says so (or a
  // command result forces it), so a playing engine costs what the plain
  // player costs: about one render a second.
  const positionChannel = useRef(createTransportPositionChannel()).current;
  const committedNativeRef = useRef(nativeState);
  const lastNativeCommitAtRef = useRef(0);
  const nativeReportAtRef = useRef(0);
  const receiveNativeState = useCallback(
    (value: NativePitchShiftPlaybackState, opts?: { force?: boolean; seekLanded?: boolean }) => {
      nativeStateRef.current = value;
      nativeReportAtRef.current = Date.now();
      positionChannel.publish({
        positionMs: value.currentTimeMs,
        isPlaying: value.isPlaying,
        playbackRate: value.playbackRate > 0 ? value.playbackRate : 1,
        seekLanded: opts?.seekLanded,
      });
      const now = Date.now();
      if (
        !opts?.force &&
        throttlePositionCommits &&
        !shouldCommitNativeState(committedNativeRef.current, value, lastNativeCommitAtRef.current, now)
      ) {
        return;
      }
      committedNativeRef.current = value;
      lastNativeCommitAtRef.current = now;
      setNativeState(value);
    },
    [positionChannel, throttlePositionCommits]
  );
  const receiveNativeStateRef = useRef(receiveNativeState);
  receiveNativeStateRef.current = receiveNativeState;
  // Stopping the engine's player also fires its "segment played" callback, which
  // the engine reports as the end of the clip. A pause is not an end: remember
  // where we paused so that report can be told apart and undone.
  const lastPauseRef = useRef<{ at: number; positionMs: number } | null>(null);
  /** Where the engine is now: its last report, carried forward while it plays. */
  const estimateEnginePositionMs = useCallback(() => {
    const engine = nativeStateRef.current;
    if (!engine.isPlaying) return engine.currentTimeMs;
    const elapsed = Math.max(0, Date.now() - nativeReportAtRef.current) * (engine.playbackRate || 1);
    return Math.min(engine.durationMs || Infinity, engine.currentTimeMs + elapsed);
  }, []);
  /**
   * Pause the engine and say where it stopped. The pause's echo can land before
   * the call returns, so its result may already read "finished at the end"; then
   * the position from just before the pause is the truth.
   */
  const pauseEngine = useCallback(
    async (nativeModule: NonNullable<typeof SongNookPitchShiftModule>) => {
      const before = estimateEnginePositionMs();
      lastPauseRef.current = { at: Date.now(), positionMs: before };
      const raw = await nativeModule.pause();
      const echoed = raw.didJustFinish && !isPlaybackNearEnd(before, raw.durationMs);
      const state = echoed ? { ...raw, currentTimeMs: before, didJustFinish: false } : raw;
      lastPauseRef.current = { at: Date.now(), positionMs: state.currentTimeMs };
      return state;
    },
    [estimateEnginePositionMs]
  );
  /** Until when a "finished" state is the pause's echo and is dropped, not shown. */
  const dropEchoUntilRef = useRef(0);

  // ── The muted twin ─────────────────────────────────────────────────────────
  // When we last moved the twin ourselves, so a scrub check skips our own seeks.
  const twinLastCommandAtRef = useRef(0);
  const twinPlay = useCallback(async () => {
    if (!twinSource) return;
    twinLastCommandAtRef.current = Date.now();
    if (!sourceRef.current.isPlaying) await sourceRef.current.play();
  }, [twinSource]);
  const twinPause = useCallback(async () => {
    if (!twinSource) return;
    twinLastCommandAtRef.current = Date.now();
    if (sourceRef.current.isPlaying) await sourceRef.current.pause();
  }, [twinSource]);
  const twinSeek = useCallback(async (positionMs: number) => {
    if (!twinSource) return;
    twinLastCommandAtRef.current = Date.now();
    await sourceRef.current.seekTo(positionMs);
  }, [twinSource]);

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
  const runExclusiveRef = useRef(runExclusive);

  // Latest desired transport target — read inside the coalesced reconcile so a
  // burst of changes collapses to the final value instead of replaying each step.
  const desiredRef = useRef({
    shouldOwn: false,
    sourceKey: source.sourceKey,
    audioUri: source.audioUri,
    playbackRate,
    pitch: clamped,
    gainDb: soundGainDb,
    tonePreset: soundTonePreset,
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
        if (!cancelled) receiveNativeStateRef.current(value, { force: true });
      })
      .catch(() => {});

    const stateSub = SongNookPitchShiftModule.addListener("onStateChange", (value) => {
      // The echo's own state says the clip is over; showing it would tell the
      // dock (and the store) the song had finished.
      if (value.didJustFinish && Date.now() < dropEchoUntilRef.current) return;
      receiveNativeStateRef.current(value);
    });
    const endSub = SongNookPitchShiftModule.addListener("onPlaybackEnded", (value) => {
      const paused = lastPauseRef.current;
      if (
        paused &&
        Date.now() - paused.at < PAUSE_ECHO_MS &&
        !isPlaybackNearEnd(paused.positionMs, value.durationMs)
      ) {
        pitchLog(`[${ownerLabel}] end after pause ignored`, { pausedAtMs: paused.positionMs });
        dropEchoUntilRef.current = Date.now() + PAUSE_ECHO_MS;
        const nativeModule = SongNookPitchShiftModule;
        if (!nativeModule) return;
        // Queued behind the pause itself, so it reads where the pause really landed.
        void runExclusiveRef.current(async () => {
          const at = lastPauseRef.current ?? paused;
          lastPauseRef.current = null;
          try {
            if (nativeStateRef.current.isPlaying) return;
            receiveNativeStateRef.current(await nativeModule.seekTo(at.positionMs), { force: true });
          } finally {
            dropEchoUntilRef.current = 0;
          }
        }).catch(() => {});
        return;
      }
      lastPauseRef.current = null;
      pitchLog(`[${ownerLabel}] onPlaybackEnded`, { key: loadedKeyRef.current, atMs: value.currentTimeMs });
      receiveNativeStateRef.current(value, { force: true });
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
    gainDb: soundGainDb,
    tonePreset: soundTonePreset,
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
      const sameSource = loadedKeyRef.current === src.sourceKey;
      loadedKeyRef.current = null;
      const state = await SongNookPitchShiftModule.unload();
      receiveNativeStateRef.current(state, { force: true });
      await releaseAudioSessionOwnership();
      src.setMuted?.(false);
      // The source already moved on to another clip (the queue advanced): it
      // has its own position and state, so nothing of the old clip carries over.
      if (!sameSource) {
        shouldResumeOnReleaseRef.current = true;
        return;
      }
      await src.seekTo(snapshot.currentTimeMs);
      src.setPlaybackRate(snapshot.playbackRate);
      if (resumePlayback && snapshot.isPlaying) {
        if (!src.isPlaying) await src.play();
      } else if (twinSource && src.isPlaying) {
        await src.pause();
      }
      shouldResumeOnReleaseRef.current = true;
    },
    [releaseAudioSessionOwnership, twinSource]
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
    if (twinSource) {
      src.setMuted?.(true);
    } else if (src.isPlaying) {
      await src.pause();
    }

    const shouldReload = loadedKeyRef.current !== d.sourceKey || !nativeStateRef.current.isLoaded;
    if (shouldReload) {
      // With the twin, the source's own play state is the truth outside
      // controls see (and the queue has just set it for a new clip).
      const autoplay =
        d.extraAutoplay ||
        (twinSource
          ? src.isPlaying || (!!loadedKeyRef.current && nativeStateRef.current.isPlaying)
          : loadedKeyRef.current ? nativeStateRef.current.isPlaying : src.isPlaying);
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
        gainDb: d.gainDb,
        tonePreset: d.tonePreset,
      });
      loadedKeyRef.current = d.sourceKey;
      receiveNativeStateRef.current(state, { force: true });
      if (twinSource) {
        // The twin sits where the engine is; its play state converges below.
        // A freshly loaded clip on the twin can fall back to 1x; it keeps the
        // engine's speed or the two clocks part.
        src.setPlaybackRate(d.playbackRate);
        await twinSeek(state.currentTimeMs);
        if (state.isPlaying && !src.isPlaying) await twinPlay();
      }
      return;
    }

    if (Math.abs(nativeStateRef.current.playbackRate - desiredRef.current.playbackRate) > 0.01) {
      pitchLog(`[${ownerLabel}] sync → setPlaybackRate`, desiredRef.current.playbackRate);
      const state = await nativeModule.setPlaybackRate(desiredRef.current.playbackRate);
      receiveNativeStateRef.current(state, { force: true });
      if (twinSource) src.setPlaybackRate(desiredRef.current.playbackRate);
    }
    if (nativeStateRef.current.pitchShiftSemitones !== desiredRef.current.pitch) {
      pitchLog(`[${ownerLabel}] sync → setPitchShiftSemitones`, desiredRef.current.pitch);
      const state = await nativeModule.setPitchShiftSemitones(desiredRef.current.pitch);
      receiveNativeStateRef.current(state, { force: true });
    }
    // Level and tone: a native build without the EQ stage has no setSound and
    // reports no sound in its state; the take then plays flat, and we say nothing.
    if (
      nativeModule.setSound &&
      ((nativeStateRef.current.soundGainDb ?? 0) !== desiredRef.current.gainDb ||
        (nativeStateRef.current.soundTonePreset ?? "neutral") !== desiredRef.current.tonePreset)
    ) {
      pitchLog(`[${ownerLabel}] sync → setSound`, {
        gainDb: desiredRef.current.gainDb,
        tonePreset: desiredRef.current.tonePreset,
      });
      const state = await nativeModule.setSound({
        gainDb: desiredRef.current.gainDb,
        tonePreset: desiredRef.current.tonePreset,
      });
      receiveNativeStateRef.current(state, { force: true });
    }
  }, [ensureAudioSessionOwnership, ownerLabel, syncBackToSource, twinPlay, twinSeek, twinSource]);

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
  }, [clamped, playbackRate, soundGainDb, soundTonePreset, requestReconcile]);

  useEffect(() => {
    return () => {
      const nativeModule = SongNookPitchShiftModule;
      if (!nativeModule) return;
      void runExclusive(() => nativeModule.unload()).catch(() => {});
      void releaseAudioSessionOwnership().catch(() => {});
      loadedKeyRef.current = null;
      sourceRef.current.setMuted?.(false);
    };
  }, [releaseAudioSessionOwnership, runExclusive]);

  // ── Mirror: the dock, the lock screen and headphones act on the twin ───────
  // The twin's play state is the one every outside control sees and changes,
  // so it decides playing or paused; the engine's position is what is heard,
  // so the twin follows it. When the two disagree for a moment (a remote play
  // or pause, the queue moving on, a load landing), they converge: the engine
  // takes the twin's play state and the twin jumps silently to the engine's
  // place. Our own commands move both together, so they never disagree for
  // long. A natural end is not a pause: the engine ends on its own.
  const TWIN_SETTLE_MS = 250;
  useEffect(() => {
    if (!twinSource || !isNativeTransportActive || !SongNookPitchShiftModule) return;
    if (source.inSync === false) return;
    if (source.isPlaying === nativeState.isPlaying) return;
    const nativeModule = SongNookPitchShiftModule;
    const timer = setTimeout(() => {
      const src = sourceRef.current;
      const engine = nativeStateRef.current;
      if (src.inSync === false || src.isPlaying === engine.isPlaying) return;
      if (isPlaybackNearEnd(src.positionMs, src.durationMs)) return;
      if (isPlaybackNearEnd(engine.currentTimeMs, engine.durationMs)) return;
      const wantPlaying = src.isPlaying;
      pitchLog(`[${ownerLabel}] twin → engine`, { play: wantPlaying });
      void runExclusive(async () => {
        if (nativeStateRef.current.isPlaying === wantPlaying) return;
        if (wantPlaying) lastPauseRef.current = null;
        const state = wantPlaying ? await nativeModule.play() : await pauseEngine(nativeModule);
        receiveNativeStateRef.current(state, { force: true });
        await twinSeek(state.currentTimeMs);
      }).catch(() => {});
    }, TWIN_SETTLE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.isPlaying, nativeState.isPlaying, isNativeTransportActive, twinSource, source.inSync]);

  // A lock-screen scrub makes the twin jump: the engine follows it. Drift, or
  // an engine that stalls, moves the silent twin back instead (twinFollow.ts).
  const twinLastReportRef = useRef<{ positionMs: number; at: number; playing: boolean } | null>(null);
  useEffect(() => {
    const now = Date.now();
    const previous = twinLastReportRef.current;
    twinLastReportRef.current = { positionMs: source.positionMs, at: now, playing: source.isPlaying };
    if (!twinSource || !isNativeTransportActive || !SongNookPitchShiftModule) return;
    // A window that spans a play or a pause has no single rate to judge it by.
    if (source.inSync === false || !previous || previous.playing !== source.isPlaying) return;
    if (now - twinLastCommandAtRef.current < TWIN_SETTLE_MS * 2) return;
    const engine = nativeStateRef.current;
    const move = classifyTwinMove({
      previousMs: previous.positionMs,
      previousAt: previous.at,
      positionMs: source.positionMs,
      at: now,
      rate: source.isPlaying ? engine.playbackRate || 1 : 0,
      engineMs: engine.currentTimeMs,
    });
    if (move === "none") return;
    if (move === "drift") {
      void twinSeek(engine.currentTimeMs).catch(() => {});
      return;
    }
    const nativeModule = SongNookPitchShiftModule;
    const target = source.positionMs;
    twinLastCommandAtRef.current = now;
    pitchLog(`[${ownerLabel}] twin scrub → engine`, { target });
    void runExclusive(async () => {
      const state = await nativeModule.seekTo(target);
      receiveNativeStateRef.current(state, { force: true, seekLanded: true });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.positionMs, isNativeTransportActive, twinSource]);

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
            if (twinSource) src.setMuted?.(true);
            else if (src.isPlaying) await src.pause();
            const state = await SongNookPitchShiftModule.loadForPractice({
              sourceUri: src.audioUri,
              startPositionMs: atEnd ? 0 : src.positionMs,
              autoplay: true,
              playbackRate,
              pitchShiftSemitones: clamped,
              gainDb: soundGainDb,
              tonePreset: soundTonePreset,
            });
            loadedKeyRef.current = src.sourceKey;
            receiveNativeStateRef.current(state, { force: true });
            if (atEnd) await twinSeek(0);
            await twinPlay();
            return;
          }

          if (isNativeTransportActive && SongNookPitchShiftModule) {
            if (atEnd) {
              const seekState = await SongNookPitchShiftModule.seekTo(0);
              receiveNativeStateRef.current(seekState, { force: true, seekLanded: true });
              await twinSeek(0);
            }
            const state = await SongNookPitchShiftModule.play();
            receiveNativeStateRef.current(state, { force: true });
            await twinPlay();
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
      soundGainDb,
      soundTonePreset,
      twinPlay,
      twinSeek,
      twinSource,
    ]
  );

  const pause = useCallback(
    () =>
      runExclusive(async () => {
        try {
          if (isNativeTransportActive && SongNookPitchShiftModule) {
            const state = await pauseEngine(SongNookPitchShiftModule);
            receiveNativeStateRef.current(state, { force: true });
            await twinPause();
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
    [disableNativeTransport, isNativeTransportActive, pauseEngine, runExclusive, twinPause]
  );

  const seekTo = useCallback(
    (positionMs: number) =>
      runExclusive(async () => {
        try {
          if (isNativeTransportActive && SongNookPitchShiftModule) {
            const state = await SongNookPitchShiftModule.seekTo(positionMs);
            receiveNativeStateRef.current(state, { force: true, seekLanded: true });
            await twinSeek(positionMs);
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
    [disableNativeTransport, isNativeTransportActive, runExclusive, twinSeek]
  );

  const setPlaybackRate = useCallback(
    (rate: number) =>
      runExclusive(async () => {
        try {
          if (isNativeTransportActive && SongNookPitchShiftModule) {
            const state = await SongNookPitchShiftModule.setPlaybackRate(rate);
            receiveNativeStateRef.current(state, { force: true });
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
      positionChannel,
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
      positionChannel,
      prepareForRelease,
      seekTo,
      setPlaybackRate,
      shouldOwnNativeTransport,
      togglePlay,
    ]
  );
}
