import { normalizeKeptPractice, sameKeptPractice, toggleKeptPart } from "../keptPractice";

describe("kept practice", () => {
  it("nothing stored keeps nothing", () => {
    expect(normalizeKeptPractice(undefined)).toBeUndefined();
    expect(normalizeKeptPractice("x")).toBeUndefined();
    expect(normalizeKeptPractice({})).toBeUndefined();
  });

  it("a damaged value comes back usable, never out of range", () => {
    expect(
      normalizeKeptPractice({
        sound: { pitchSemitones: 40, playbackRate: -1 },
        loop: { countIn: "9b", region: { startMs: 5000, endMs: 1000 } },
      })
    ).toEqual({
      sound: { pitchSemitones: 12, playbackRate: 1, clickEnabled: false },
      loop: { countIn: "off" },
    });
  });

  it("keeps the loop's region only when it is real", () => {
    const kept = normalizeKeptPractice({ loop: { countIn: "1b", region: { startMs: 0, endMs: 8000 } } });
    expect(kept).toEqual({ loop: { countIn: "1b", region: { startMs: 0, endMs: 8000 } } });
    expect(sameKeptPractice(kept, { loop: { countIn: "1b", region: { startMs: 0, endMs: 8000 } } })).toBe(true);
    expect(sameKeptPractice(kept, { loop: { countIn: "1b" } })).toBe(false);
  });

  it("the old single switch reads as both drawers kept", () => {
    expect(
      normalizeKeptPractice({ pitchSemitones: -2, playbackRate: 0.75, clickEnabled: true, countIn: "1b", loop: { startMs: 0, endMs: 8000 } })
    ).toEqual({
      sound: { pitchSemitones: -2, playbackRate: 0.75, clickEnabled: true },
      loop: { countIn: "1b", region: { startMs: 0, endMs: 8000 } },
    });
  });

  it("each drawer's keep stands alone", () => {
    const now = {
      sound: { pitchSemitones: 3, playbackRate: 1, clickEnabled: false },
      loop: { countIn: "off" as const, region: { startMs: 0, endMs: 4000 } },
    };
    const soundOnly = toggleKeptPart(undefined, "sound", now);
    expect(soundOnly).toEqual({ sound: now.sound });
    const both = toggleKeptPart(soundOnly, "loop", now);
    expect(both).toEqual({ sound: now.sound, loop: now.loop });
    expect(toggleKeptPart(both, "loop", now)).toEqual({ sound: now.sound });
    expect(toggleKeptPart(soundOnly, "sound", now)).toBeUndefined();
  });
});
