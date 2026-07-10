import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { generateWaveformSidecar, readWaveformSidecar } from "../services/waveformSidecar";

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
  // interactions settle AND playback is idle, so the native decode never fights the
  // player for the codec. `detail` already set (cached or freshly generated) → skip.
  useEffect(() => {
    if (!enabled || !audioUri || deferGeneration || detail) return;

    let cancelled = false;
    const interaction = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        const peaks = await generateWaveformSidecar(audioUri, durationMs);
        if (!cancelled && peaks && peaks.length) setDetail(peaks);
      })();
    });

    return () => {
      cancelled = true;
      interaction?.cancel?.();
    };
  }, [audioUri, durationMs, enabled, deferGeneration, detail]);

  const thumbnail = thumbnailPeaks && thumbnailPeaks.length ? thumbnailPeaks : [];
  return {
    peaks: detail ?? thumbnail,
    isDetail: !!detail,
  };
}
