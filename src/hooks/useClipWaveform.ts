import { useEffect, useState } from "react";
import { ensureWaveformSidecar } from "../services/waveformSidecar";

type Args = {
  audioUri?: string | null;
  /** Inline low-res peaks shown until the detail sidecar is ready (and as a fallback). */
  thumbnailPeaks?: number[] | null;
  durationMs?: number;
  enabled?: boolean;
};

/**
 * Supplies the high-resolution detail waveform for a clip's reel. Lazily loads the
 * sidecar (generating + caching it on first access) and falls back to the inline
 * thumbnail until the detail is ready, so the reel never renders empty or blocky.
 */
export function useClipWaveform({ audioUri, thumbnailPeaks, durationMs, enabled = true }: Args) {
  const [detail, setDetail] = useState<number[] | null>(null);

  useEffect(() => {
    setDetail(null);
    if (!enabled || !audioUri) return;

    let cancelled = false;
    void (async () => {
      const peaks = await ensureWaveformSidecar(audioUri, durationMs);
      if (!cancelled && peaks && peaks.length) setDetail(peaks);
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUri, durationMs, enabled]);

  const thumbnail = thumbnailPeaks && thumbnailPeaks.length ? thumbnailPeaks : [];
  return {
    peaks: detail ?? thumbnail,
    isDetail: !!detail,
  };
}
