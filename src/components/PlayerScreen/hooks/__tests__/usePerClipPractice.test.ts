import {
  NEUTRAL_CLIP_PRACTICE,
  switchClipPractice,
  type ClipPracticeSettings,
} from "../usePerClipPractice";

/** A player whose live settings follow whatever the switch hands it. */
function player() {
  const saved = new Map<string, ClipPracticeSettings>();
  let live: ClipPracticeSettings = { ...NEUTRAL_CLIP_PRACTICE };
  let clipId: string | null = null;
  return {
    show(next: string | null) {
      const apply = switchClipPractice(saved, clipId, live, next);
      clipId = next;
      if (apply) live = { ...apply };
    },
    set(next: Partial<ClipPracticeSettings>) {
      live = { ...live, ...next };
    },
    get live() {
      return live;
    },
  };
}

describe("per-clip practice", () => {
  it("a pitch set on one song does not follow the queue into the next", () => {
    const p = player();
    p.show("song-a");
    p.set({ pitchSemitones: 3, playbackRate: 0.8 });
    p.show("song-b");
    expect(p.live).toEqual(NEUTRAL_CLIP_PRACTICE);
  });

  it("going back to a clip brings back what was set on it", () => {
    const p = player();
    p.show("song-a");
    p.set({ pitchSemitones: -2, clickEnabled: true, countIn: "1b" });
    p.show("song-b");
    p.set({ playbackRate: 1.25 });
    p.show("song-a");
    expect(p.live).toEqual({ pitchSemitones: -2, playbackRate: 1, clickEnabled: true, countIn: "1b" });
    p.show("song-b");
    expect(p.live.playbackRate).toBe(1.25);
    expect(p.live.pitchSemitones).toBe(0);
  });

  it("the first clip of a session starts neutral, whatever the player held before", () => {
    const p = player();
    p.set({ playbackRate: 0.5 });
    p.show("song-a");
    expect(p.live).toEqual(NEUTRAL_CLIP_PRACTICE);
  });
});
