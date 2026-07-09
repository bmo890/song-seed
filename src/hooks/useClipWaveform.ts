import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";
import { generateWaveformSidecar, readWaveformSidecar } from "../services/waveformSidecar";

type Args = {
  audioUri?: string | null;
  /** Inline low-res peaks shown until the detail sidecar is ready (and as a fallback). */
  thumbnailPeaks?: number[] | null;
  durationMs?: number;
  enabled?: boolean;
};

/**
 * Supplies the high-resolution detail waveform for a clip's reel. An already-cached
 * sidecar is shown immediately; a missing one is GENERATED off the critical path
 * (after interactions settle) so the multi-second native decode of a long file never
 * blocks the player's own clip load — that contention was the "full player won't start
 * on a long clip" stall. The low-res thumbnail shows meanwhile so the reel is never empty.
 */
export function useClipWaveform({ audioUri, thumbnailPeaks, durationMs, enabled = true }: Args) {
  const [detail, setDetail] = useState<number[] | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!enabled || !audioUri) return;

    let cancelled = false;
    let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;

    void (async () => {
      // Cheap: an existing sidecar is just a file read — show it right away.
      const existing = await readWaveformSidecar(audioUri);
      if (cancelled) return;
      if (existing && existing.length) {
        setDetail(existing);
        return;
      }

      // Expensive: defer generation until the load/animation has settled so the decode
      // (serialized app-wide in waveformAnalysis) doesn't fight the player for the codec.
      interaction = InteractionManager.runAfterInteractions(() => {
        void (async () => {
          const peaks = await generateWaveformSidecar(audioUri, durationMs);
          if (!cancelled && peaks && peaks.length) setDetail(peaks);
        })();
      });
    })();

    return () => {
      cancelled = true;
      interaction?.cancel?.();
    };
  }, [audioUri, durationMs, enabled]);

  const thumbnail = thumbnailPeaks && thumbnailPeaks.length ? thumbnailPeaks : [];
  return {
    peaks: detail ?? thumbnail,
    isDetail: !!detail,
  };
}
