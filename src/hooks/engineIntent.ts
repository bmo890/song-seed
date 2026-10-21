/**
 * Whether the pitch engine is "playing" as a person means it (2026-10-21).
 *
 * Android's engine reports ExoPlayer's isPlaying, which is false while audio
 * loads: after every play, seek, pitch or speed change. Shown raw, the play
 * button flipped back to play while the clip was starting, and the twin mirror
 * read each load as someone pressing pause (founder's screen recording: four
 * pause/play flips and a five-second stall per press). What we asked for is
 * the truth; the engine's report only overrules it when it says so plainly:
 * a newer build sends playWhenReady, a finish ends it, and a stop that lasts
 * longer than any load (an audio-focus loss, a call) is believed.
 */
export const ENGINE_LOAD_GRACE_MS = 3000;

export type EngineIntent = {
  playing: boolean;
  /** When we last asked it to play, or last saw it really playing. */
  since: number;
};

export type EngineReport = {
  isLoaded: boolean;
  isPlaying: boolean;
  didJustFinish: boolean;
  /** Present on native builds from 2026-10-21 on (Android): the ask, not the sound. */
  playWhenReady?: boolean;
};

export function presentEngineReport(
  report: EngineReport,
  intent: EngineIntent,
  now: number
): { playing: boolean; intent: EngineIntent; recheckInMs: number | null } {
  if (report.didJustFinish || !report.isLoaded) {
    return { playing: false, intent: { playing: false, since: now }, recheckInMs: null };
  }
  if (typeof report.playWhenReady === "boolean") {
    return {
      playing: report.playWhenReady,
      intent: { playing: report.playWhenReady, since: now },
      recheckInMs: null,
    };
  }
  if (report.isPlaying) {
    return { playing: true, intent: { playing: true, since: now }, recheckInMs: null };
  }
  if (!intent.playing) {
    return { playing: false, intent, recheckInMs: null };
  }
  const waited = now - intent.since;
  if (waited < ENGINE_LOAD_GRACE_MS) {
    return { playing: true, intent, recheckInMs: ENGINE_LOAD_GRACE_MS - waited };
  }
  return { playing: false, intent: { playing: false, since: now }, recheckInMs: null };
}
