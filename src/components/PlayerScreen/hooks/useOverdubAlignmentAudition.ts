import { useEffect, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { activatePlaybackAudioSession } from "../../../services/audioSession";

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
 */

export type AlignmentAuditionTarget = {
  stemId: string;
  masterAudioUri: string;
  stemAudioUri: string;
  offsetMs: number;
  stemGainDb: number;
};

/** dB → linear volume, clamped to the 0..1 range expo-audio accepts (boosts flatten to 1 —
 *  audition is for timing, not level judgement). */
function dbToPlayerVolume(gainDb: number) {
  return Math.max(0, Math.min(1, Math.pow(10, gainDb / 20)));
}

export function useOverdubAlignmentAudition() {
  const masterPlayer = useAudioPlayer(null, { updateInterval: 250 });
  const stemPlayer = useAudioPlayer(null, { updateInterval: 250 });
  const masterStatus = useAudioPlayerStatus(masterPlayer);
  const stemStatus = useAudioPlayerStatus(stemPlayer);

  const [auditioningStemId, setAuditioningStemId] = useState<string | null>(null);
  const loadedUrisRef = useRef<{ master: string | null; stem: string | null }>({
    master: null,
    stem: null,
  });
  const startRunRef = useRef(0);

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

    stemPlayer.volume = dbToPlayerVolume(target.stemGainDb);
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
    pauseBothSafely();
    setAuditioningStemId(null);
  }

  // Both streams ran out — leave audition mode so the button returns to "play".
  useEffect(() => {
    if (!auditioningStemId) {
      return;
    }
    if (masterStatus.didJustFinish && !stemStatus.playing) {
      setAuditioningStemId(null);
    }
  }, [auditioningStemId, masterStatus.didJustFinish, stemStatus.playing]);

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
