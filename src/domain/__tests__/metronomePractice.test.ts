import {
  MAX_PRACTICE_BARS,
  PRACTICE_SUB_ACCENT_WEIGHT,
  PRACTICE_SUB_WEIGHT,
  beatTier,
  cycleBeatWeight,
  cycleSubWeight,
  defaultPractice,
  practiceSteps,
  practiceSubdivisions,
  sanitizePractice,
  subTier,
  withAllSilent,
  withAllSounding,
  withBarAdded,
  withBarRemoved,
  withBarRestToggled,
  withBeatCycled,
  withSubCycled,
} from "../metronomePractice";

const FOUR = [1, 0.44, 0.44, 0.44];

describe("metronome practice pattern", () => {
  it("opens on one full bar of the feel, keeping a subdivision the meter allows", () => {
    const practice = defaultPractice("4/4", FOUR, 2);
    expect(practice.bars).toHaveLength(1);
    expect(practice.subdivision).toBe(2);
    expect(practiceSteps(practice)).toEqual([1, PRACTICE_SUB_WEIGHT, 0.44, PRACTICE_SUB_WEIGHT, 0.44, PRACTICE_SUB_WEIGHT, 0.44, PRACTICE_SUB_WEIGHT]);
    expect(defaultPractice("12/8", new Array(12).fill(0.44), 4).subdivision).toBe(1);
  });

  it("offers only subdivisions that keep a row tappable", () => {
    expect(practiceSubdivisions("4/4")).toEqual([1, 2, 3, 4]);
    expect(practiceSubdivisions("7/8")).toEqual([1, 2, 3]);
    expect(practiceSubdivisions("12/8")).toEqual([1, 2]);
  });

  it("cycles a beat accent → click → silent and a sub-beat sound → accent → silent", () => {
    expect(beatTier(cycleBeatWeight(1))).toBe("click");
    expect(beatTier(cycleBeatWeight(0.44))).toBe("rest");
    expect(beatTier(cycleBeatWeight(0))).toBe("accent");
    expect(cycleSubWeight(PRACTICE_SUB_WEIGHT)).toBe(PRACTICE_SUB_ACCENT_WEIGHT);
    expect(subTier(cycleSubWeight(PRACTICE_SUB_ACCENT_WEIGHT))).toBe("off");
    expect(cycleSubWeight(0)).toBe(PRACTICE_SUB_WEIGHT);
  });

  it("plays each bar's own beats and sub-beats; a resting bar is silent but keeps them", () => {
    let practice = withBarAdded(defaultPractice("2/4", [1, 0.44], 2));
    practice = withBeatCycled(practice, 1, 1); // bar 2, beat 2: click → silent
    practice = withSubCycled(practice, 1, 0, 1); // bar 2, the "and" of 1: accent
    expect(practiceSteps(practice)).toEqual([
      1, PRACTICE_SUB_WEIGHT, 0.44, PRACTICE_SUB_WEIGHT,
      1, PRACTICE_SUB_ACCENT_WEIGHT, 0, PRACTICE_SUB_WEIGHT,
    ]);
    const rested = withBarRestToggled(practice, 1);
    expect(practiceSteps(rested).slice(4)).toEqual([0, 0, 0, 0]);
    expect(practiceSteps(withBarRestToggled(rested, 1))).toEqual(practiceSteps(practice));
  });

  it("adds bars by copying the last, up to four, and never drops below one", () => {
    let practice = defaultPractice("3/4", [1, 0.44, 0.44], 1);
    for (let i = 0; i < 6; i += 1) practice = withBarAdded(practice);
    expect(practice.bars).toHaveLength(MAX_PRACTICE_BARS);
    for (let i = 0; i < 6; i += 1) practice = withBarRemoved(practice);
    expect(practice.bars).toHaveLength(1);
  });

  it("silences everything, then sounds everything on the feel's accents", () => {
    const practice = withBarAdded(defaultPractice("4/4", FOUR, 4));
    const silent = withAllSilent(withBarRestToggled(practice, 0));
    expect(practiceSteps(silent).every((step) => step === 0)).toBe(true);
    expect(silent.bars[0].rest).toBe(false);
    expect(practiceSteps(withAllSounding(silent, FOUR))).toEqual(practiceSteps(practice));
  });

  it("only trusts a stored pattern that still fits its meter", () => {
    const practice = withBarAdded(defaultPractice("4/4", FOUR, 3));
    expect(sanitizePractice(JSON.parse(JSON.stringify(practice)))).toEqual(practice);
    expect(sanitizePractice({ ...practice, meterId: "3/4" })).toBeNull();
    expect(sanitizePractice({ ...practice, subdivision: 5 })).toBeNull();
    expect(sanitizePractice({ ...practice, bars: [] })).toBeNull();
    expect(sanitizePractice(null)).toBeNull();
  });
});
