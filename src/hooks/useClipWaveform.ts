import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { cancelActiveWaveformDecode } from "../services/waveformAnalysis";
import { generateWaveformSidecar, readWaveformSidecar } from "../services/waveformSidecar";

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
export function useClipWaveform({
  audioUri,
  thumbnailPeaks,
  durationMs,
  enabled = true,
  deferGeneration = false,
}: Args) {
  const [detail, setDetail] = useState<number[] | null>(null);
  // True only while the native decode is actually inside the decoder — not while
  // waiting out the dwell, and not while deferred by playback. Surfaces use it to
  // caption real work ("Analyzing waveform…") without ever claiming work that is
  // standing down.
  const [isGenerating, setIsGenerating] = useState(false);

  // Cheap: load any already-cached sidecar right away (just a file read). Reset when
  // the source changes so a stale wave never lingers onto the next clip.
  useEffect(() => {
    setDetail(null);
    if (!enabled || !audioUri) return;

    let cancelled = false;
    void (async () => {
      const existing = await readWaveformSidecar(audioUri);
      if (!cancelled && existing && existing.length) setDetail(existing);
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUri, enabled]);

  // Expensive: generate a missing sidecar off the critical path — deferred until
  // interactions settle, a short pause dwell elapses, AND playback is idle, so the
  // native decode never fights the player for the codec. `detail` already set
  // (cached or freshly generated) → skip.
  useEffect(() => {
    if (!enabled || !audioUri || deferGeneration || detail) return;

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
          if (!cancelled && peaks && peaks.length) setDetail(peaks);
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
  }, [audioUri, durationMs, enabled, deferGeneration, detail]);

  const thumbnail = thumbnailPeaks && thumbnailPeaks.length ? thumbnailPeaks : [];
  return {
    peaks: detail ?? thumbnail,
    isDetail: !!detail,
    isGenerating,
  };
}
