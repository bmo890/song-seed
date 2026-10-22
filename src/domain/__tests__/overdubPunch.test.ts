import { clampPunchInMs, snapPunchInMsToGrid } from "../overdub";

const grid = { bpm: 60, beatsPerBar: 4, firstDownbeatMs: 0 } as never;

describe("where a layer starts", () => {
  it("a dragged start stays where it was put", () => {
    expect(clampPunchInMs(2600, 64000)).toBe(2600);
    // The player's Layer key still lands on the bar (here 4 s at 60 bpm in 4/4).
    expect(snapPunchInMsToGrid(2600, grid, 64000)).toBe(4000);
  });

  it("near the top is from the top", () => {
    expect(clampPunchInMs(600, 64000)).toBe(0);
    expect(clampPunchInMs(-5, 64000)).toBe(0);
  });

  it("never past the end of the song", () => {
    expect(clampPunchInMs(70000, 64000)).toBe(63000);
  });
});

describe("a new layer's name", () => {
  const { getDefaultOverdubStemTitle } = jest.requireActual("../overdub");
  const clipWith = (titles: string[]) =>
    ({ overdub: { stems: titles.map((title, i) => ({ id: String(i), title })) } }) as never;

  it("never repeats a number already taken", () => {
    expect(getDefaultOverdubStemTitle(clipWith(["Layer 2"]))).toBe("Layer 3");
    expect(getDefaultOverdubStemTitle(clipWith([]))).toBe("Layer 1");
    expect(getDefaultOverdubStemTitle(clipWith(["Harmony", "Layer 1"]))).toBe("Layer 3");
  });
});

describe("where a start falls in the song's bar", () => {
  const { punchPhaseInBarMs } = jest.requireActual("../overdub");
  const grid = { bpm: 120, firstDownbeatMs: 250 } as never; // 2 s bars in 4/4

  it("measures from the song's own downbeat", () => {
    expect(punchPhaseInBarMs(2250, grid, 2000)).toBe(0);
    expect(punchPhaseInBarMs(3250, grid, 2000)).toBe(1000);
    expect(punchPhaseInBarMs(2249.5, grid, 2000)).toBe(0);
  });

  it("has nothing to lock to without a measured downbeat", () => {
    expect(punchPhaseInBarMs(3250, { bpm: 120 } as never, 2000)).toBe(0);
  });
});
