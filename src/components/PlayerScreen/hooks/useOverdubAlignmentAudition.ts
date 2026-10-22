import { useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "expo-audio";
import type { AudioStatus } from "expo-audio";
import { useThrottledAudioPlayerStatus } from "../../../hooks/useThrottledAudioPlayerStatus";
import { activatePlaybackAudioSession } from "../../../services/audioSession";

/**
 * Play together (founder, 2026-10-22: "the song as it will sound"): the song
 * WITHOUT this layer (the bed) and the layer itself, both rendered once
 * (services/layerAudition.ts), played side by side at the layer's live offset.
 * A nudge only changes where the two start, so it is heard at once.
 *
 * The layer file carries `layerLeadMs` of silence in front, so both players can
 * be pre-seeked and started in the same tick from a run-up before the layer —
 * no timers (JS timers jitter far more than start latency):
 *   bed position = max(0, offset − lead), layer position = lead − (offset − bed position).
 *
 * It plays ONCE, from the run-up to just past the layer's end, then stops. The
 * old span loop snapped the playhead back every time the layer ended, which read
 * as the playhead jumping (founder, 2026-10-22).
 *
 * `onMasterRawStatus` is the position feed: every native status event from the
 * bed player, unthrottled and with no render involved — the bench uses it to
 * drive the reel playhead and the strip cursor.
 */

export type AlignmentAuditionTarget = {
  stemId: string;
  /** The song without this layer (or the raw base take when rendering is unavailable). */
  bedUri: string;
  /** This layer, with `layerLeadMs` of silence in front. */
  layerUri: string;
  layerLeadMs: number;
  /** Player volume for the layer: 1 when its level is rendered in. */
  layerVolume: number;
  offsetMs: number;
  layerDurationMs: number;
};

/** How long the song keeps playing after the layer ends. */
const AUDITION_TAIL_MS = 1500;

export function useOverdubAlignmentAudition(options?: {
  onMasterRawStatus?: (status: AudioStatus) => void;
}) {
  // 100ms master ticks: the raw feed anchors the reel's dead-reckoned playhead, so the
  // anchors should arrive at roughly the cadence the main transport channel provides.
  const masterPlayer = useAudioPlayer(null, { updateInterval: 100 });
  const stemPlayer = useAudioPlayer(null, { updateInterval: 250 });
  const endMsRef = useRef<number | null>(null);
  const { status: masterStatus } = useThrottledAudioPlayerStatus(masterPlayer, {
    onRawStatus: (status: AudioStatus) => {
      options?.onMasterRawStatus?.(status);
      const endMs = endMsRef.current;
      if (endMs != null && (status.currentTime ?? 0) * 1000 >= endMs) {
        endMsRef.current = null;
        stop();
      }
    },
  });
  const { status: stemStatus } = useThrottledAudioPlayerStatus(stemPlayer);

  const [auditioningStemId, setAuditioningStemId] = useState<string | null>(null);
  const loadedUrisRef = useRef<{ master: string | null; stem: string | null }>({
    master: null,
    stem: null,
  });
  const startRunRef = useRef(0);
  const lastTargetRef = useRef<AlignmentAuditionTarget | null>(null);

  const isAuditionPlaying =
    auditioningStemId !== null && (!!masterStatus.playing || !!stemStatus.playing);

  function pauseBothSafely() {
    try {
      const masterResult = masterPlayer.pause();
      void Promise.resolve(masterResult).catch(() => {});
    } catch {
      // Ignore stale native handles during teardown/handoff.
    }
    try {
      const stemResult = stemPlayer.pause();
      void Promise.resolve(stemResult).catch(() => {});
    } catch {
      // Ignore stale native handles during teardown/handoff.
    }
  }

  async function start(target: AlignmentAuditionTarget) {
    const runToken = startRunRef.current + 1;
    startRunRef.current = runToken;
    lastTargetRef.current = target;
    endMsRef.current = null;

    pauseBothSafely();
    await activatePlaybackAudioSession();

    if (loadedUrisRef.current.master !== target.bedUri) {
      await masterPlayer.replace({ uri: target.bedUri });
      loadedUrisRef.current.master = target.bedUri;
    }
    if (loadedUrisRef.current.stem !== target.layerUri) {
      await stemPlayer.replace({ uri: target.layerUri });
      loadedUrisRef.current.stem = target.layerUri;
    }
    if (startRunRef.current !== runToken) {
      return;
    }

    stemPlayer.volume = target.layerVolume;
    masterPlayer.volume = 1;

    const bedStartMs = Math.max(0, target.offsetMs - target.layerLeadMs);
    const layerStartMs = Math.max(0, target.layerLeadMs - (target.offsetMs - bedStartMs));
    await Promise.all([
      masterPlayer.seekTo(bedStartMs / 1000),
      stemPlayer.seekTo(layerStartMs / 1000),
    ]);
    if (startRunRef.current !== runToken) {
      return;
    }

    // Same-tick starts: relative skew is just the difference in the two players' start
    // latencies (~±10 ms) — tight enough to judge alignment by ear.
    endMsRef.current = target.offsetMs + target.layerDurationMs + AUDITION_TAIL_MS;
    stemPlayer.play();
    masterPlayer.play();
    setAuditioningStemId(target.stemId);
  }

  function stop() {
    endMsRef.current = null;
    startRunRef.current += 1;
    lastTargetRef.current = null;
    pauseBothSafely();
    setAuditioningStemId(null);
  }

  // The song ran out before the tail did: done.
  useEffect(() => {
    if (auditioningStemId && masterStatus.didJustFinish) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterStatus.didJustFinish, auditioningStemId]);

  useEffect(() => {
    return () => {
      pauseBothSafely();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    auditioningStemId,
    isAuditionPlaying,
    start,
    stop,
  };
}
