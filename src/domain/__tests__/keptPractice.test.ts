import { normalizeKeptPractice, sameKeptPractice } from "../keptPractice";

describe("kept practice", () => {
  it("nothing stored keeps nothing", () => {
    expect(normalizeKeptPractice(undefined)).toBeUndefined();
    expect(normalizeKeptPractice("x")).toBeUndefined();
  });

  it("a damaged value comes back usable, never out of range", () => {
    expect(
      normalizeKeptPractice({ pitchSemitones: 40, playbackRate: -1, countIn: "9b", loop: { startMs: 5000, endMs: 1000 } })
    ).toEqual({ pitchSemitones: 12, playbackRate: 1, clickEnabled: false, countIn: "off" });
  });

  it("keeps the loop only when it has a real region", () => {
    const kept = normalizeKeptPractice({ pitchSemitones: -2, playbackRate: 0.75, clickEnabled: true, countIn: "1b", loop: { startMs: 0, endMs: 8000 } });
    expect(kept?.loop).toEqual({ startMs: 0, endMs: 8000 });
    expect(sameKeptPractice(kept, { ...kept!, loop: { startMs: 0, endMs: 8000 } })).toBe(true);
    expect(sameKeptPractice(kept, { ...kept!, loop: undefined })).toBe(false);
  });
});
