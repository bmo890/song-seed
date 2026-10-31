import { bpmAtRate, bpmRange, rateAtBpm, speedBaseBpm, stepRateByBpm } from "../tempoSpeed";
import type { PlaybackClickGrid } from "../playbackClick";

const GRID: PlaybackClickGrid = {
  bpm: 120,
  meterId: "4/4",
  firstDownbeatMs: 0,
  tempoMap: undefined,
  gridValidToMs: undefined,
};

describe("speedBaseBpm", () => {
  it("is the take's tempo when the click trusts its grid", () => {
    expect(speedBaseBpm(GRID)).toBe(120);
  });

  it("is null with no grid or an untrusted one", () => {
    expect(speedBaseBpm(null)).toBeNull();
    expect(speedBaseBpm({ ...GRID, firstDownbeatMs: null })).toBeNull();
  });

  it("counts from the first segment of a tempo map", () => {
    const grid: PlaybackClickGrid = {
      ...GRID,
      tempoMap: {
        schemaVersion: 1,
        segments: [
          { atBar: 1, bpm: 92, meterId: "4/4" },
          { atBar: 9, bpm: 140, meterId: "4/4" },
        ],
      },
    };
    expect(speedBaseBpm(grid)).toBe(92);
  });
});

describe("bpm ↔ rate", () => {
  it("every whole bpm survives the round trip at any common tempo", () => {
    for (const base of [40, 63, 97, 100, 120, 137, 180, 240]) {
      const { minBpm, maxBpm } = bpmRange(base, 0.5, 1.5);
      for (let bpm = minBpm; bpm <= maxBpm; bpm += 1) {
        expect(bpmAtRate(base, rateAtBpm(base, bpm))).toBe(bpm);
      }
    }
  });

  it("keeps the range inside the rates", () => {
    expect(bpmRange(97, 0.5, 1.5)).toEqual({ minBpm: 49, maxBpm: 145 });
    expect(bpmRange(100, 0.5, 1.5)).toEqual({ minBpm: 50, maxBpm: 150 });
  });
});

describe("stepRateByBpm", () => {
  const step = (rate: number, direction: -1 | 1, baseBpm = 120) =>
    bpmAtRate(baseBpm, stepRateByBpm({ baseBpm, rate, direction, stepBpm: 5, minRate: 0.5, maxRate: 1.5 }));

  it("moves five bpm from a multiple of five", () => {
    expect(step(rateAtBpm(120, 80), 1)).toBe(85);
    expect(step(rateAtBpm(120, 80), -1)).toBe(75);
  });

  it("lands on the next multiple of five from an odd tempo", () => {
    expect(step(rateAtBpm(120, 82), 1)).toBe(85);
    expect(step(rateAtBpm(120, 82), -1)).toBe(80);
    // 0.6 × 97 = 58.2: read as 58.
    expect(step(0.6, 1, 97)).toBe(60);
    expect(step(0.6, -1, 97)).toBe(55);
  });

  it("holds inside the speed range", () => {
    expect(step(1.5, 1)).toBe(180);
    expect(step(0.5, -1)).toBe(60);
    // 97 × 0.5 = 48.5: the slowest whole bpm is 49, not 45.
    expect(step(rateAtBpm(97, 50), -1, 97)).toBe(49);
  });
});
