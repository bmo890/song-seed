import type { AudioStatus } from "expo-audio";
import { shouldCommitStatus } from "../useThrottledAudioPlayerStatus";

function status(overrides: Partial<AudioStatus> = {}): AudioStatus {
  return {
    id: 1,
    currentTime: 0,
    duration: 60,
    isLoaded: true,
    playing: true,
    didJustFinish: false,
    playbackState: "readyToPlay",
    playbackRate: 1,
    isBuffering: false,
    mute: false,
    loop: false,
    timeControlStatus: "playing",
    reasonForWaitingToPlay: null,
    audioChannels: 2,
    sampleRate: 44100,
    ...overrides,
  } as unknown as AudioStatus;
}

const BASE = {
  lastCommitAtMs: 0,
  nowMs: 10_000,
  positionIntervalMs: 200,
};

describe("shouldCommitStatus", () => {
  it("does not commit for a position tick inside the same second", () => {
    // The whole point: ~20 of these arrive per second and none of them change the display.
    expect(
      shouldCommitStatus({
        ...BASE,
        previous: status({ currentTime: 3.05 }),
        next: status({ currentTime: 3.1 }),
      })
    ).toBe(false);
  });

  it("commits when the displayed second changes", () => {
    expect(
      shouldCommitStatus({
        ...BASE,
        previous: status({ currentTime: 3.95 }),
        next: status({ currentTime: 4.01 }),
      })
    ).toBe(true);
  });

  it("holds the second change back until the interval floor has passed", () => {
    expect(
      shouldCommitStatus({
        ...BASE,
        previous: status({ currentTime: 3.95 }),
        next: status({ currentTime: 4.01 }),
        lastCommitAtMs: 9_900,
        nowMs: 10_000,
      })
    ).toBe(false);
  });

  describe("transitions always commit, whatever the clock says", () => {
    const previous = status({ currentTime: 3.05 });
    const inSameSecond = { ...BASE, previous, lastCommitAtMs: 10_000, nowMs: 10_000 };

    it("play/pause", () => {
      expect(
        shouldCommitStatus({ ...inSameSecond, next: status({ currentTime: 3.1, playing: false }) })
      ).toBe(true);
    });

    it("finishing", () => {
      expect(
        shouldCommitStatus({
          ...inSameSecond,
          next: status({ currentTime: 3.1, didJustFinish: true }),
        })
      ).toBe(true);
    });

    it("load state", () => {
      expect(
        shouldCommitStatus({ ...inSameSecond, next: status({ currentTime: 3.1, isLoaded: false }) })
      ).toBe(true);
    });

    it("rate change", () => {
      expect(
        shouldCommitStatus({ ...inSameSecond, next: status({ currentTime: 3.1, playbackRate: 2 }) })
      ).toBe(true);
    });

    it("duration change (a source swap)", () => {
      expect(
        shouldCommitStatus({ ...inSameSecond, next: status({ currentTime: 3.1, duration: 120 }) })
      ).toBe(true);
    });

    it("a jump far beyond tick spacing (a seek)", () => {
      expect(
        shouldCommitStatus({ ...inSameSecond, next: status({ currentTime: 41 }) })
      ).toBe(true);
    });
  });

  it("keeps ticking across seconds when compared against the last COMMITTED status", () => {
    // The hook compares against what React last saw, not the previous event. If it
    // compared against the previous event, a second boundary crossed during a throttled
    // gap would be noticed once and then never again — the readout would freeze.
    const committed = status({ currentTime: 3.95 });
    const firstTickOfNewSecond = status({ currentTime: 4.01 });
    const laterTickOfNewSecond = status({ currentTime: 4.6 });

    expect(
      shouldCommitStatus({ ...BASE, previous: committed, next: firstTickOfNewSecond })
    ).toBe(true);
    // Suppose that commit was skipped by the interval floor; the next tick still qualifies.
    expect(
      shouldCommitStatus({ ...BASE, previous: committed, next: laterTickOfNewSecond })
    ).toBe(true);
  });

  it("commits once per second rather than once per event during steady playback", () => {
    // Walk a second of 20Hz reports through the real decision path.
    let lastCommitted = status({ currentTime: 3.0 });
    let lastCommitAtMs = 0;
    let commits = 0;
    for (let tick = 1; tick <= 20; tick += 1) {
      const nowMs = tick * 50;
      const next = status({ currentTime: 3.0 + tick * 0.05 });
      if (
        shouldCommitStatus({
          previous: lastCommitted,
          next,
          lastCommitAtMs,
          nowMs,
          positionIntervalMs: 200,
        })
      ) {
        commits += 1;
        lastCommitted = next;
        lastCommitAtMs = nowMs;
      }
    }
    expect(commits).toBe(1);
  });
});
