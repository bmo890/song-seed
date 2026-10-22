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
