import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { cancelActiveWaveformDecode } from "../services/waveformAnalysis";
import {
  generateWaveformSidecar,
  peekWaveformSidecar,
  readWaveformSidecar,
} from "../services/waveformSidecar";

/** Pause dwell before generating a missing sidecar. Opening the player lands paused
 *  and most listeners tap play within a beat; a play press preempts an in-flight
 *  decode (cancelActiveWaveformDecode), but skipping the decode's startup cost —
 *  and covering builds whose native module predates the cancel hook — is cheaper
 *  still. Short: the thumbnail bridges the wait. */
const GENERATION_PAUSE_DWELL_MS = 600;

type Args = {
  audioUri?: string | null;
  /** Inline low-res peaks shown until the detail sidecar is ready (and as a fallback). */
  thumbnailPeaks?: number[] | null;
  durationMs?: number;
  enabled?: boolean;
  /**
   * Hold off GENERATING a missing sidecar while true (an existing one still loads).
   * The native decode shares the Android MediaCodec pool with the player, so deriving
   * it mid-playback starves the codec and stalls the track ("plays a second then
   * pauses"). Callers pass their playing state here; generation runs once playback idles.
   */
  deferGeneration?: boolean;
};

/**
 * Supplies the high-resolution detail waveform for a clip's reel. An already-cached
 * sidecar is shown immediately; a missing one is GENERATED off the critical path
 * (after interactions settle, and never during active playback) so the multi-second
 * native decode of a long file never blocks the player's clip load or fights the
 * codec mid-track. The low-res thumbnail shows meanwhile so the reel is never empty.
 */
export type ClipWaveformSource = {
  /** What the reel should draw right now. */
  peaks: number[];
  /** Those peaks are the high-resolution sidecar (not the inline thumbnail). */
  isDetail: boolean;
  /** A cold sidecar read is still outstanding — detail is milliseconds away, so a
   *  surface can hold back a stand-in it knows is too coarse. */
  isResolvingDetail: boolean;
};

/**
 * Which waveform does this clip have RIGHT NOW — pure, so the first-frame contract is
 * testable without a renderer.
 *
 * Every input is read during render. That is the whole point: this bug has been
 * introduced twice by computing "is detail coming?" in an effect, which runs AFTER
 * paint — so frame one claimed nothing was coming, the reel painted the stretched
 * low-res stand-in, and the guard meant to prevent that never fired.
 */
export function resolveClipWaveformSource(args: {
  audioUri?: string | null;
  enabled: boolean;
  /** Synchronous in-memory sidecar hit, if any. */
  cachedPeaks?: number[] | null;
  /** Sidecar loaded by a previous read, tagged with the uri it came from. A mismatch
   *  is ignored so a clip switch never shows the PREVIOUS clip's wave for a frame. */
  detail?: { uri: string; peaks: number[] } | null;
  /** The uri whose read has finished — hit OR miss. A miss must clear resolving too,
   *  or a surface waiting on it would hold its placeholder until generation finishes. */
  resolvedUri?: string | null;
  thumbnailPeaks?: number[] | null;
}): ClipWaveformSource {
  const { audioUri, enabled, cachedPeaks, detail, resolvedUri, thumbnailPeaks } = args;
  const taggedDetail = detail && detail.uri === audioUri ? detail.peaks : null;
  const detailPeaks = taggedDetail ?? (enabled && audioUri ? cachedPeaks ?? null : null);
  const thumbnail = thumbnailPeaks && thumbnailPeaks.length ? thumbnailPeaks : [];
  return {
    peaks: detailPeaks ?? thumbnail,
    isDetail: !!detailPeaks,
    isResolvingDetail: !!enabled && !!audioUri && !detailPeaks && resolvedUri !== audioUri,
  };
}

export function useClipWaveform({
  audioUri,
  thumbnailPeaks,
  durationMs,
  enabled = true,
  deferGeneration = false,
}: Args) {
  // EVERYTHING about "which waveform do we have right now" is derived DURING RENDER,
  // never set from an effect. Effects run after paint, so any state they own is wrong
  // on the frame that matters — the first one the user sees. That is precisely how the
  // low-res flash survived an earlier attempt at this fix.
  //
  // Tagged with the uri it came FROM, so a stale sidecar is invisible in the same frame
  // the clip changes rather than one frame later.
  const [detail, setDetail] = useState<{ uri: string; peaks: number[] } | null>(null);
  /** The uri whose sidecar read has FINISHED (hit or miss). Lets `isResolvingDetail`
   *  be derived rather than toggled from an effect. */
  const [resolvedUri, setResolvedUri] = useState<string | null>(null);
  // True only while the native decode is actually inside the decoder — not while
  // waiting out the dwell, and not while deferred by playback. Surfaces use it to
  // caption real work ("Analyzing waveform…") without ever claiming work that is
  // standing down.
  const [isGenerating, setIsGenerating] = useState(false);

  // The cache is consulted at RENDER time, so a clip whose sidecar is already known
  // (opened before this session, or just analyzed by background hydration) paints at
  // full resolution on its first frame — no read, no upgrade in front of the user.
  const cachedPeaks = enabled && audioUri ? peekWaveformSidecar(audioUri) : null;
  const source = resolveClipWaveformSource({
    audioUri,
    enabled,
    cachedPeaks,
    detail,
    resolvedUri,
    thumbnailPeaks,
  });
  const detailPeaks = source.isDetail ? source.peaks : null;
  const isResolvingDetail = source.isResolvingDetail;

  // Cold read only — a cache hit is already served at render time above, so this
  // never runs for a known clip.
  useEffect(() => {
    if (!enabled || !audioUri || cachedPeaks) return;

    let cancelled = false;
    void (async () => {
      const existing = await readWaveformSidecar(audioUri);
      if (cancelled) return;
      if (existing && existing.length) setDetail({ uri: audioUri, peaks: existing });
      // Mark resolved either way — a MISSING sidecar must clear this too, or a
      // surface waiting on it would hold its placeholder until generation finishes.
      setResolvedUri(audioUri);
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUri, cachedPeaks, enabled]);

  // Expensive: generate a missing sidecar off the critical path — deferred until
  // interactions settle, a short pause dwell elapses, AND playback is idle, so the
  // native decode never fights the player for the codec. `detail` already set
  // (cached or freshly generated) → skip.
  useEffect(() => {
    if (!enabled || !audioUri || deferGeneration || detailPeaks) return;

    let cancelled = false;
    let decodeInFlight = false;
    let dwellTimer: ReturnType<typeof setTimeout> | null = null;
    const interaction = InteractionManager.runAfterInteractions(() => {
      dwellTimer = setTimeout(() => {
        if (cancelled) return;
        decodeInFlight = true;
        setIsGenerating(true);
        void (async () => {
          const peaks = await generateWaveformSidecar(audioUri, durationMs);
          // Clear BEFORE setDetail: success re-runs this effect (detail is a dep),
          // and the outgoing cleanup must not globally cancel other surfaces' work
          // over a decode that already finished.
          decodeInFlight = false;
          setIsGenerating(false);
          if (!cancelled && peaks && peaks.length) setDetail({ uri: audioUri, peaks });
        })();
      }, GENERATION_PAUSE_DWELL_MS);
    });

    return () => {
      cancelled = true;
      interaction?.cancel?.();
      if (dwellTimer) clearTimeout(dwellTimer);
      if (decodeInFlight) setIsGenerating(false);
      if (decodeInFlight) {
        // Playback starting (deferGeneration flip) or leaving the surface: the decode
        // this effect launched is still inside the native decoder — abort it so it
        // can't starve the player. It returns empty, persists nothing, and this effect
        // regenerates it on the next idle pass.
        cancelActiveWaveformDecode();
      }
    };
  }, [audioUri, durationMs, enabled, deferGeneration, detailPeaks]);

  return {
    peaks: source.peaks,
    isDetail: source.isDetail,
    isGenerating,
    isResolvingDetail,
  };
}

// NOTE ON THE PATTERN, because this bug has now been introduced twice: anything the
// FIRST rendered frame depends on must be derived in render (or a useState lazy
// initializer), never assigned by an effect. `isResolvingDetail` was previously
// useState(false) + set true in an effect — so frame one always claimed "nothing is
// coming", the reel painted the coarse stand-in, and the guard meant to prevent
// exactly that never fired.
