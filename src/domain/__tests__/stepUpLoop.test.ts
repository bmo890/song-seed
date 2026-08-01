import {
  MAX_STEP_UP_STAGES,
  STEP_UP_BUILTIN_PRESETS,
  STEP_UP_DEFAULTS,
  STEP_UP_DEFAULT_SEQUENCE,
  clickRateBounds,
  intersectRateBounds,
  matchStepUpPreset,
  normalizeStepUpParams,
  normalizeStepUpSequence,
  stagesFromLadder,
  stepUpProgressAtLoop,
  stepUpRateAtLoop,
  stepUpSequenceProgressAtLoop,
  stepUpSequenceTotalLoops,
  stepUpSequencesEqual,
  type StepUpParams,
  type StepUpStage,
} from "../stepUpLoop";
import { clickEngineParamsAt, type PlaybackClickGrid } from "../playbackClick";

const DEFAULTS: StepUpParams = STEP_UP_DEFAULTS;

describe("normalizeStepUpParams", () => {
  it("passes sane params through on the rate lattice", () => {
    expect(normalizeStepUpParams(DEFAULTS)).toEqual(DEFAULTS);
  });

  it("clamps rates into the given bounds", () => {
    const params = normalizeStepUpParams(DEFAULTS, { minRate: 0.6, maxRate: 0.9 });
    expect(params.startRate).toBe(0.6);
    expect(params.targetRate).toBe(0.9);
  });

  it("never lets the target sit below the start", () => {
    const params = normalizeStepUpParams({ ...DEFAULTS, startRate: 0.8, targetRate: 0.6 });
    expect(params.targetRate).toBe(0.8);
  });

  it("repairs junk with the defaults", () => {
    const params = normalizeStepUpParams({
      startRate: NaN,
      increment: -1,
      loopsPerStep: 0,
      targetRate: Infinity,
    });
    expect(params).toEqual(DEFAULTS);
  });

  it("allows a target beyond 1x", () => {
    const params = normalizeStepUpParams({ ...DEFAULTS, targetRate: 1.25 });
    expect(params.targetRate).toBe(1.25);
  });

  it("rounds fractional loopsPerStep to a whole count", () => {
    expect(normalizeStepUpParams({ ...DEFAULTS, loopsPerStep: 2.6 }).loopsPerStep).toBe(3);
  });
});

describe("stepUpRateAtLoop", () => {
  it("climbs the default ladder: +0.05 every 4 passes, holding at 1x", () => {
    expect(stepUpRateAtLoop(DEFAULTS, 0)).toBe(0.5);
    expect(stepUpRateAtLoop(DEFAULTS, 3)).toBe(0.5);
    expect(stepUpRateAtLoop(DEFAULTS, 4)).toBe(0.55);
    expect(stepUpRateAtLoop(DEFAULTS, 8)).toBe(0.6);
    expect(stepUpRateAtLoop(DEFAULTS, 4 * 10)).toBe(1);
    expect(stepUpRateAtLoop(DEFAULTS, 500)).toBe(1);
  });

  it("stays exactly on the lattice with no float dirt", () => {
    for (let loops = 0; loops <= 60; loops += 1) {
      const rate = stepUpRateAtLoop(DEFAULTS, loops);
      expect(rate).toBe(Math.round(rate * 100) / 100);
    }
    // 0.5 + 3 * 0.05 must be 0.65, not 0.6500000000000001.
    expect(stepUpRateAtLoop(DEFAULTS, 12)).toBe(0.65);
  });

  it("supports climbing past 1x when the target allows it", () => {
    const params = normalizeStepUpParams({ ...DEFAULTS, startRate: 1, targetRate: 1.2, increment: 0.1, loopsPerStep: 2 });
    expect(stepUpRateAtLoop(params, 2)).toBe(1.1);
    expect(stepUpRateAtLoop(params, 4)).toBe(1.2);
    expect(stepUpRateAtLoop(params, 6)).toBe(1.2);
  });

  it("treats negative or fractional counters as completed whole passes", () => {
    expect(stepUpRateAtLoop(DEFAULTS, -3)).toBe(0.5);
    expect(stepUpRateAtLoop(DEFAULTS, 4.9)).toBe(0.55);
  });
});

describe("stepUpProgressAtLoop", () => {
  it("reports the pass position within the current step", () => {
    expect(stepUpProgressAtLoop(DEFAULTS, 0)).toMatchObject({ rate: 0.5, loopInStep: 1, atTarget: false });
    expect(stepUpProgressAtLoop(DEFAULTS, 5)).toMatchObject({ rate: 0.55, loopInStep: 2, atTarget: false });
  });

  it("flags arrival at the target", () => {
    const done = stepUpProgressAtLoop(DEFAULTS, 4 * 10);
    expect(done.atTarget).toBe(true);
    expect(done.rate).toBe(1);
  });

  it("is at target immediately when start equals target", () => {
    const params = normalizeStepUpParams({ ...DEFAULTS, startRate: 1, targetRate: 1 });
    expect(stepUpProgressAtLoop(params, 0).atTarget).toBe(true);
  });
});

describe("normalizeStepUpSequence", () => {
  it("passes a sane sequence through", () => {
    const stages: StepUpStage[] = [
      { loops: 2, rate: 0.6 },
      { loops: 3, rate: 0.75 },
    ];
    expect(normalizeStepUpSequence(stages)).toEqual(stages);
  });

  it("clamps rates into bounds and rounds loops to whole passes", () => {
    const stages = normalizeStepUpSequence(
      [{ loops: 2.6, rate: 0.3 }, { loops: 0, rate: 2 }],
      { minRate: 0.5, maxRate: 1.5 }
    );
    expect(stages).toEqual([
      { loops: 3, rate: 0.5 },
      { loops: 1, rate: 1.5 },
    ]);
  });

  it("falls back to the default sequence when everything is junk", () => {
    expect(normalizeStepUpSequence([])).toEqual(STEP_UP_DEFAULT_SEQUENCE);
    expect(normalizeStepUpSequence([{ loops: 2, rate: NaN }])).toEqual(STEP_UP_DEFAULT_SEQUENCE);
  });

  it("caps the stage count", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({ loops: 1, rate: 0.5 + index * 0.01 }));
    expect(normalizeStepUpSequence(many)).toHaveLength(MAX_STEP_UP_STAGES);
  });

  it("allows non-monotonic rates — a recovery slow pass is legal", () => {
    const stages: StepUpStage[] = [
      { loops: 2, rate: 0.9 },
      { loops: 1, rate: 0.6 },
      { loops: 2, rate: 1 },
    ];
    expect(normalizeStepUpSequence(stages)).toEqual(stages);
  });
});

describe("stepUpSequenceProgressAtLoop", () => {
  // The founder's example: 2 passes at n, 2 at n+x, then 3 at n+2x.
  const SEQUENCE: StepUpStage[] = [
    { loops: 2, rate: 0.6 },
    { loops: 2, rate: 0.7 },
    { loops: 3, rate: 0.8 },
  ];

  it("walks the stages pass by pass", () => {
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 0)).toMatchObject({
      rate: 0.6, stageIndex: 0, loopInStage: 1, stageLoops: 2, atEnd: false,
    });
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 1)).toMatchObject({ rate: 0.6, loopInStage: 2 });
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 2)).toMatchObject({
      rate: 0.7, stageIndex: 1, loopInStage: 1,
    });
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 4)).toMatchObject({
      rate: 0.8, stageIndex: 2, loopInStage: 1, stageLoops: 3,
    });
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 6)).toMatchObject({ rate: 0.8, loopInStage: 3, atEnd: false });
  });

  it("counts passes across the whole plan for the progress line", () => {
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 0)).toMatchObject({
      completedLoops: 0, totalLoops: 7, passNumber: 1,
    });
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 4)).toMatchObject({
      completedLoops: 4, totalLoops: 7, passNumber: 5,
    });
    // Past the end the counter rests at the total rather than running on forever.
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 7).passNumber).toBe(7);
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 99).passNumber).toBe(7);
  });

  it("holds the last rate once every stage is done", () => {
    const done = stepUpSequenceProgressAtLoop(SEQUENCE, 7);
    expect(done).toMatchObject({ rate: 0.8, atEnd: true, stageIndex: 2 });
    expect(stepUpSequenceProgressAtLoop(SEQUENCE, 500).rate).toBe(0.8);
  });

  it("counts the total passes before settling", () => {
    expect(stepUpSequenceTotalLoops(SEQUENCE)).toBe(7);
  });
});

describe("STEP_UP_BUILTIN_PRESETS", () => {
  it("every preset is already normal within the practice-speed range and ends at baseline", () => {
    const speedBounds = { minRate: 0.5, maxRate: 1.5 };
    for (const preset of STEP_UP_BUILTIN_PRESETS) {
      expect(normalizeStepUpSequence(preset.stages, speedBounds)).toEqual(preset.stages);
      expect(preset.stages[preset.stages.length - 1].rate).toBe(1);
      expect(preset.stages.length).toBeLessThanOrEqual(MAX_STEP_UP_STAGES);
    }
  });

  it("slowBuild climbs a nudge every single pass from half speed", () => {
    const slowBuild = STEP_UP_BUILTIN_PRESETS.find((preset) => preset.id === "slowBuild")!;
    expect(slowBuild.stages[0]).toEqual({ loops: 1, rate: 0.5 });
    expect(slowBuild.stages).toHaveLength(11);
    expect(slowBuild.stages.every((stage) => stage.loops === 1)).toBe(true);
  });

  it("polish stays just under baseline", () => {
    const polish = STEP_UP_BUILTIN_PRESETS.find((preset) => preset.id === "polish")!;
    expect(polish.stages[0].rate).toBe(0.85);
  });
});

describe("matchStepUpPreset", () => {
  const CANDIDATES = STEP_UP_BUILTIN_PRESETS.map((preset) => ({
    key: preset.id,
    stages: preset.stages,
  }));

  it("names the built-in a plan came from", () => {
    const slowBuild = STEP_UP_BUILTIN_PRESETS.find((preset) => preset.id === "slowBuild")!;
    expect(matchStepUpPreset(slowBuild.stages, CANDIDATES)).toBe("slowBuild");
    expect(matchStepUpPreset(STEP_UP_DEFAULT_SEQUENCE, CANDIDATES)).toBe("steadyClimb");
  });

  it("returns null once the musician edits the plan", () => {
    const edited: StepUpStage[] = [...STEP_UP_DEFAULT_SEQUENCE.slice(0, -1), { loops: 3, rate: 1 }];
    expect(matchStepUpPreset(edited, CANDIDATES)).toBeNull();
  });

  it("compares through the same bounds a session would clamp with", () => {
    const polish = STEP_UP_BUILTIN_PRESETS.find((preset) => preset.id === "polish")!;
    // Clamped into a 0.9-1x window the polish plan collapses onto those rates; a plan
    // stored at the clamped values must still be recognised as that preset.
    const bounds = { minRate: 0.9, maxRate: 1 };
    const clamped = normalizeStepUpSequence(polish.stages, bounds);
    expect(matchStepUpPreset(clamped, CANDIDATES, bounds)).toBe("polish");
    expect(matchStepUpPreset(clamped, CANDIDATES)).toBeNull();
  });

  it("is null against an empty candidate list", () => {
    expect(matchStepUpPreset(STEP_UP_DEFAULT_SEQUENCE, [])).toBeNull();
  });
});

describe("stepUpSequencesEqual", () => {
  it("compares stage by stage", () => {
    const a: StepUpStage[] = [{ loops: 2, rate: 0.6 }];
    expect(stepUpSequencesEqual(a, [{ loops: 2, rate: 0.6 }])).toBe(true);
    expect(stepUpSequencesEqual(a, [{ loops: 3, rate: 0.6 }])).toBe(false);
    expect(stepUpSequencesEqual(a, [])).toBe(false);
  });
});

describe("stagesFromLadder", () => {
  it("compiles the default ladder into stages that match the ladder's own rates", () => {
    const stages = stagesFromLadder(STEP_UP_DEFAULTS);
    expect(stages[0]).toEqual({ loops: 4, rate: 0.5 });
    expect(stages[stages.length - 1].rate).toBe(1);
    // Every pass agrees between the two formulations.
    const total = stepUpSequenceTotalLoops(stages);
    for (let loops = 0; loops < total; loops += 1) {
      expect(stepUpSequenceProgressAtLoop(stages, loops).rate).toBe(
        stepUpRateAtLoop(STEP_UP_DEFAULTS, loops)
      );
    }
  });
});

describe("clickRateBounds", () => {
  const GRID: PlaybackClickGrid = {
    bpm: 120,
    meterId: "4/4",
    firstDownbeatMs: 0,
    tempoMap: undefined,
    gridValidToMs: undefined,
  };

  it("is null without a trustworthy grid — nothing to protect", () => {
    expect(clickRateBounds(null)).toBeNull();
    expect(clickRateBounds({ ...GRID, firstDownbeatMs: null })).toBeNull();
  });

  it("derives the engine's 40-240 window for a single-tempo grid", () => {
    const bounds = clickRateBounds(GRID)!;
    // 120bpm: 40/120 = 0.334 (snapped up), 240/120 = 2.
    expect(bounds.minRate).toBeCloseTo(0.34, 10);
    expect(bounds.maxRate).toBe(2);
  });

  it("every lattice rate inside the bounds survives clickEngineParamsAt", () => {
    const bounds = clickRateBounds(GRID)!;
    for (let rate = bounds.minRate; rate <= bounds.maxRate + 1e-9; rate += 0.01) {
      expect(clickEngineParamsAt({ grid: GRID, positionMs: 0, rate })).not.toBeNull();
    }
    expect(clickEngineParamsAt({ grid: GRID, positionMs: 0, rate: bounds.maxRate + 0.51 })).toBeNull();
  });

  it("takes the strictest window across tempo-map segments", () => {
    const grid: PlaybackClickGrid = {
      ...GRID,
      tempoMap: {
        schemaVersion: 1,
        segments: [
          { atBar: 1, bpm: 60, meterId: "4/4" },
          { atBar: 9, bpm: 200, meterId: "4/4" },
        ],
      },
    };
    const bounds = clickRateBounds(grid)!;
    // Slow segment caps the floor (40/60), fast segment caps the ceiling (240/200).
    expect(bounds.minRate).toBeCloseTo(0.67, 10);
    expect(bounds.maxRate).toBeCloseTo(1.2, 10);
  });
});

describe("intersectRateBounds", () => {
  const SPEED = { minRate: 0.5, maxRate: 1.5 };

  it("passes the base range through when there is no click constraint", () => {
    expect(intersectRateBounds(SPEED, null)).toEqual(SPEED);
  });

  it("narrows to the overlap", () => {
    expect(intersectRateBounds(SPEED, { minRate: 0.67, maxRate: 1.2 })).toEqual({
      minRate: 0.67,
      maxRate: 1.2,
    });
  });

  it("is null when the ranges never meet", () => {
    expect(intersectRateBounds(SPEED, { minRate: 2, maxRate: 3 })).toBeNull();
  });

  it("clamps the default ladder to a click-constrained window end to end", () => {
    const grid: PlaybackClickGrid = {
      bpm: 100,
      meterId: "4/4",
      firstDownbeatMs: 0,
      tempoMap: undefined,
      gridValidToMs: undefined,
    };
    const bounds = intersectRateBounds(SPEED, clickRateBounds(grid))!;
    const params = normalizeStepUpParams(DEFAULTS, bounds);
    // 100bpm: click floor is 0.4 — below the speed floor, so the ladder is untouched.
    expect(params.startRate).toBe(0.5);
    // A 200bpm take pulls the ceiling to 240/200 = 1.2; its floor (0.2) stays below the speed floor.
    const fastBounds = intersectRateBounds(SPEED, clickRateBounds({ ...grid, bpm: 200 }))!;
    const fastParams = normalizeStepUpParams({ ...DEFAULTS, targetRate: 1.5 }, fastBounds);
    expect(fastParams.startRate).toBe(0.5);
    expect(fastParams.targetRate).toBe(1.2);
  });
});
