import {
  barStartMs,
  beatAtMs,
  gridTempoMap,
  isSingleTempo,
  msAtBeat,
  msAtPulse,
  normalizeTempoMap,
  sanitizeTempoMap,
  segmentAtBar,
  singleSegmentMap,
  tempoMapEquals,
  MAX_TEMPO_MAP_SEGMENTS,
  TEMPO_MAP_SCHEMA_VERSION,
  type TempoMap,
  type TempoSegment,
} from "../tempoMap";
import type { MetronomeMeterId } from "../metronome";

const METER_IDS: MetronomeMeterId[] = ["3/4", "4/4", "5/4", "6/8"];
const PULSES: Record<MetronomeMeterId, number> = { "3/4": 3, "4/4": 4, "5/4": 5, "6/8": 6 };

function map(...segments: TempoSegment[]): TempoMap {
  return { schemaVersion: TEMPO_MAP_SCHEMA_VERSION, segments };
}

/** Deterministic pseudo-random stream (no Math.random — reproducible failures). */
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("singleSegmentMap / gridTempoMap", () => {
  it("bridges a plain RecordingGrid to a one-segment map", () => {
    const resolved = gridTempoMap({ bpm: 92, meterId: "4/4" });
    expect(resolved.segments).toEqual([{ atBar: 1, bpm: 92, meterId: "4/4" }]);
    expect(isSingleTempo(resolved)).toBe(true);
  });

  it("prefers the grid's own map and normalizes it", () => {
    const resolved = gridTempoMap({
      bpm: 92,
      meterId: "4/4",
      tempoMap: map(
        { atBar: 17, bpm: 70, meterId: "6/8" },
        { atBar: 1, bpm: 92, meterId: "4/4" }
      ),
    });
    expect(resolved.segments).toEqual([
      { atBar: 1, bpm: 92, meterId: "4/4" },
      { atBar: 17, bpm: 70, meterId: "6/8" },
    ]);
  });

  it("clamps out-of-range tempo when bridging", () => {
    expect(singleSegmentMap(999, "4/4").segments[0].bpm).toBe(240);
    expect(singleSegmentMap(2, "4/4").segments[0].bpm).toBe(40);
  });
});

describe("normalizeTempoMap", () => {
  it("sorts, re-anchors the earliest segment to bar 1, and drops no-ops", () => {
    const normalized = normalizeTempoMap(
      map(
        { atBar: 9, bpm: 120, meterId: "4/4" },
        { atBar: 3, bpm: 92, meterId: "4/4" },
        { atBar: 5, bpm: 92, meterId: "4/4" } // no-op vs bar 3
      )
    );
    expect(normalized.segments).toEqual([
      { atBar: 1, bpm: 92, meterId: "4/4" },
      { atBar: 9, bpm: 120, meterId: "4/4" },
    ]);
  });

  it("keeps the last edit when two segments land on the same bar", () => {
    const normalized = normalizeTempoMap(
      map({ atBar: 1, bpm: 92, meterId: "4/4" }, { atBar: 1, bpm: 100, meterId: "3/4" })
    );
    expect(normalized.segments).toEqual([{ atBar: 1, bpm: 100, meterId: "3/4" }]);
  });

  it("caps runaway segment lists", () => {
    const segments: TempoSegment[] = Array.from({ length: 500 }, (_, index) => ({
      atBar: index + 1,
      bpm: 40 + (index % 200),
      meterId: "4/4",
    }));
    expect(
      normalizeTempoMap(map(...segments)).segments.length
    ).toBeLessThanOrEqual(MAX_TEMPO_MAP_SEGMENTS);
  });
});

describe("bar/beat/ms conversions", () => {
  const twoPart = map(
    { atBar: 1, bpm: 120, meterId: "4/4" }, // pulse 500ms, bar 2000ms
    { atBar: 5, bpm: 60, meterId: "3/4" } // from 8000ms: pulse 1000ms, bar 3000ms
  );

  it("locates bar downbeats across a tempo change", () => {
    expect(barStartMs(twoPart, 1)).toBe(0);
    expect(barStartMs(twoPart, 5)).toBe(8000);
    expect(barStartMs(twoPart, 6)).toBe(11000);
  });

  it("extrapolates segment 1 backwards for count-in territory", () => {
    expect(barStartMs(twoPart, 0)).toBe(-2000);
    expect(msAtPulse(twoPart, -4)).toBe(-2000);
    const point = beatAtMs(twoPart, -1500);
    expect(point).toMatchObject({ bar: 0, beatInBar: 2, absolutePulse: -3 });
  });

  it("resolves grid points on both sides of the change", () => {
    expect(beatAtMs(twoPart, 2500)).toMatchObject({
      bar: 2,
      beatInBar: 2,
      absolutePulse: 5,
      bpm: 120,
      meterId: "4/4",
    });
    expect(beatAtMs(twoPart, 9000)).toMatchObject({
      bar: 5,
      beatInBar: 2,
      absolutePulse: 17, // 16 pulses in bars 1-4, then beat 2 of bar 5
      bpm: 60,
      meterId: "3/4",
    });
  });

  it("lands exactly on the boundary bar's downbeat at the changeover instant", () => {
    const point = beatAtMs(twoPart, 8000);
    expect(point).toMatchObject({ bar: 5, beatInBar: 1, bpm: 60 });
    expect(point.barStartMs).toBe(8000);
  });

  it("reports the editor-facing segment at any bar", () => {
    expect(segmentAtBar(twoPart, 4).bpm).toBe(120);
    expect(segmentAtBar(twoPart, 5).bpm).toBe(60);
    expect(segmentAtBar(twoPart, 40).bpm).toBe(60);
  });

  it("round-trips msAtBeat ↔ beatAtMs across random multi-segment maps", () => {
    const rng = makeRng(20260728);
    for (let trial = 0; trial < 300; trial += 1) {
      const segmentCount = 1 + Math.floor(rng() * 5);
      const segments: TempoSegment[] = [];
      let bar = 1;
      for (let index = 0; index < segmentCount; index += 1) {
        segments.push({
          atBar: bar,
          bpm: 40 + Math.floor(rng() * 201),
          meterId: METER_IDS[Math.floor(rng() * METER_IDS.length)],
        });
        bar += 1 + Math.floor(rng() * 12);
      }
      const candidate = normalizeTempoMap(map(...segments));

      // Random musical position, occasionally before grid zero.
      const targetBar = Math.floor(rng() * 40) - 2;
      const pulsesInBar = PULSES[segmentAtBar(candidate, targetBar).meterId];
      const targetBeat = 1 + Math.floor(rng() * pulsesInBar);

      const ms = msAtBeat(candidate, { bar: targetBar, beat: targetBeat });
      const point = beatAtMs(candidate, ms);
      expect({ bar: point.bar, beat: point.beatInBar }).toEqual({
        bar: targetBar,
        beat: targetBeat,
      });
      expect(point.pulseStartMs).toBeCloseTo(ms, 6);
      expect(msAtPulse(candidate, point.absolutePulse)).toBeCloseTo(ms, 6);
    }
  });
});

describe("tempoMapEquals", () => {
  it("compares by value and treats undefined strictly", () => {
    const left = map({ atBar: 1, bpm: 92, meterId: "4/4" });
    expect(tempoMapEquals(left, map({ atBar: 1, bpm: 92, meterId: "4/4" }))).toBe(true);
    expect(tempoMapEquals(left, map({ atBar: 1, bpm: 93, meterId: "4/4" }))).toBe(false);
    expect(tempoMapEquals(left, undefined)).toBe(false);
    expect(tempoMapEquals(undefined, undefined)).toBe(true);
  });
});

describe("sanitizeTempoMap (untrusted input)", () => {
  it("accepts a well-formed archived map", () => {
    const sanitized = sanitizeTempoMap({
      schemaVersion: 1,
      segments: [
        { atBar: 1, bpm: 92, meterId: "4/4" },
        { atBar: 17, bpm: 70, meterId: "6/8" },
      ],
    });
    expect(sanitized?.segments).toHaveLength(2);
  });

  it("drops malformed segments and rejects hopeless values", () => {
    expect(sanitizeTempoMap(null)).toBeUndefined();
    expect(sanitizeTempoMap("4/4 at 92")).toBeUndefined();
    expect(sanitizeTempoMap({ segments: [] })).toBeUndefined();
    expect(
      sanitizeTempoMap({ segments: [{ atBar: "one", bpm: 92, meterId: "4/4" }] })
    ).toBeUndefined();
    expect(
      sanitizeTempoMap({ segments: [{ atBar: 1, bpm: 92, meterId: "9/13" }] })
    ).toBeUndefined();

    const partial = sanitizeTempoMap({
      segments: [
        { atBar: 1, bpm: Number.NaN, meterId: "4/4" },
        { atBar: 3, bpm: 84, meterId: "3/4" },
      ],
    });
    expect(partial?.segments).toEqual([{ atBar: 1, bpm: 84, meterId: "3/4" }]);
  });

  it("survives unknown future fields on segments", () => {
    const sanitized = sanitizeTempoMap({
      schemaVersion: 2,
      segments: [{ atBar: 1, bpm: 92, meterId: "4/4", rampToBpm: 140 }],
    });
    expect(sanitized?.segments).toEqual([{ atBar: 1, bpm: 92, meterId: "4/4" }]);
  });
});

/**
 * The live recording ruler walks pulses through the map rather than multiplying one beat
 * length, because the founder's takes carry a programmed change (92·3/4 → 102·4/4 at bar 9)
 * and the old ruler drew 3/4-at-92 spacing over a 4/4-at-102 click from bar 9 onward.
 */
describe("walking pulses across a change, the way the live ruler does", () => {
  const map = normalizeTempoMap({
    schemaVersion: 1,
    segments: [
      { atBar: 1, bpm: 92, meterId: "3/4" },
      { atBar: 9, bpm: 102, meterId: "4/4" },
    ],
  });
  const beat92 = 60000 / 92;
  const beat102 = 60000 / 102;

  it("spaces pulses by the segment they fall in", () => {
    // Pulses 0..23 are the first eight 3/4 bars; 24 onward are 4/4 at 102.
    expect(msAtPulse(map, 1) - msAtPulse(map, 0)).toBeCloseTo(beat92, 6);
    expect(msAtPulse(map, 23) - msAtPulse(map, 22)).toBeCloseTo(beat92, 6);
    expect(msAtPulse(map, 25) - msAtPulse(map, 24)).toBeCloseTo(beat102, 6);
  });

  it("puts the change exactly on bar 9's downbeat", () => {
    const changeMs = 8 * 3 * beat92;
    expect(msAtPulse(map, 24)).toBeCloseTo(changeMs, 6);
    expect(beatAtMs(map, changeMs).bar).toBe(9);
    expect(beatAtMs(map, changeMs).beatInBar).toBe(1);
  });

  it("marks bar lines every 3 pulses before the change and every 4 after", () => {
    const barPulses: number[] = [];
    for (let pulse = 0; pulse < 40; pulse += 1) {
      if (beatAtMs(map, msAtPulse(map, pulse)).beatInBar === 1) barPulses.push(pulse);
    }
    expect(barPulses.slice(0, 9)).toEqual([0, 3, 6, 9, 12, 15, 18, 21, 24]);
    expect(barPulses.slice(9, 12)).toEqual([28, 32, 36]);
  });
});
