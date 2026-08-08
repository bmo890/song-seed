import { useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "expo-audio";
import type { AudioStatus } from "expo-audio";
import { useThrottledAudioPlayerStatus } from "../../../hooks/useThrottledAudioPlayerStatus";
import { activatePlaybackAudioSession } from "../../../services/audioSession";
import { overdubGainDbToPlayerVolume } from "../../../domain/overdub";

/**
 * In-place audition for overdub alignment: plays the MASTER take and one RAW stem
 * together at a trial offset, live, without rendering the combined mix. This is what
 * closes the nudge feedback loop — tap a nudge, hear the result immediately, right next
 * to the alignment overlay.
 *
 * Offset handling avoids timers entirely (JS timers jitter far more than start latency):
 * both players are pre-seeked so that starting them in the same tick lands them in sync —
 *   master position = max(0, offset), stem position = master position − offset.
 * A positive offset therefore starts the audition at the moment the stem enters; a
 * negative offset drops the stem's head — both exactly mirroring the mix renderers.
 *
 * The audition LOOPS the layer's span (settled 2026-08-07): when the stem runs out the
 * pair restarts at the span's start — a steady pulse to nudge against, until stopped.
 *
 * `onMasterRawStatus` is the position feed: every native status event from the master
 * player, unthrottled and with no render involved — the bench uses it to drive the reel
 * playhead and the micro strip cursor, so the audition is never blind.
 */

export type AlignmentAuditionTarget = {
  stemId: string;
  masterAudioUri: string;
  stemAudioUri: string;
  offsetMs: number;
  stemGainDb: number;
};


export function useOverdubAlignmentAudition(options?: {
  onMasterRawStatus?: (status: AudioStatus) => void;
}) {
  // 100ms master ticks: the raw feed anchors the reel's dead-reckoned playhead, so the
  // anchors should arrive at roughly the cadence the main transport channel provides.
  const masterPlayer = useAudioPlayer(null, { updateInterval: 100 });
  const stemPlayer = useAudioPlayer(null, { updateInterval: 250 });
  const { status: masterStatus } = useThrottledAudioPlayerStatus(masterPlayer, {
    onRawStatus: options?.onMasterRawStatus,
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

    pauseBothSafely();
    await activatePlaybackAudioSession();

    if (loadedUrisRef.current.master !== target.masterAudioUri) {
      await masterPlayer.replace({ uri: target.masterAudioUri });
      loadedUrisRef.current.master = target.masterAudioUri;
    }
    if (loadedUrisRef.current.stem !== target.stemAudioUri) {
      await stemPlayer.replace({ uri: target.stemAudioUri });
      loadedUrisRef.current.stem = target.stemAudioUri;
    }
    if (startRunRef.current !== runToken) {
      return;
    }

    stemPlayer.volume = overdubGainDbToPlayerVolume(target.stemGainDb);
    masterPlayer.volume = 1;

    const masterStartMs = Math.max(0, target.offsetMs);
    const stemStartMs = masterStartMs - target.offsetMs;
    await Promise.all([
      masterPlayer.seekTo(masterStartMs / 1000),
      stemPlayer.seekTo(stemStartMs / 1000),
    ]);
    if (startRunRef.current !== runToken) {
      return;
    }

    // Same-tick starts: relative skew is just the difference in the two players' start
    // latencies (~±10 ms) — tight enough to judge alignment by ear.
    stemPlayer.play();
    masterPlayer.play();
    setAuditioningStemId(target.stemId);
  }

  function stop() {
    startRunRef.current += 1;
    lastTargetRef.current = null;
    pauseBothSafely();
    setAuditioningStemId(null);
  }

  // Span loop: the stem always runs out at the span's end (it starts at the span's
  // start), so its finish is the wrap point — restart the pair there. The master's tail
  // past the layer never plays, which is the point: the audition IS the layer's span.
  useEffect(() => {
    if (!auditioningStemId || !stemStatus.didJustFinish) {
      return;
    }
    const target = lastTargetRef.current;
    if (!target || target.stemId !== auditioningStemId) {
      return;
    }
    void start(target).catch(() => {
      stop();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stemStatus.didJustFinish, auditioningStemId]);

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
