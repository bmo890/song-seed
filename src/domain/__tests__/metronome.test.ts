import {
  METRONOME_COUNT_IN_BAR_OPTIONS,
  METRONOME_METER_PRESETS,
  buildAccentPattern,
  clampMetronomeCountInBars,
  clampMetronomeSubdivision,
  deriveTapTempoBpm,
  getGroupGapIndices,
  getMetronomeAccentPattern,
  getTempoMarking,
  isMetronomeClickVoice,
  isValidGrouping,
} from "../metronome";

describe("meter presets", () => {
  it("offers the eight standard meters in two rows of four", () => {
    expect(METRONOME_METER_PRESETS.map((preset) => preset.id)).toEqual([
      "2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8",
    ]);
  });

  it.each(METRONOME_METER_PRESETS.map((preset) => [preset.id, preset] as const))(
    "%s keeps its accent pattern and groupings on the pulse count",
    (_id, preset) => {
      expect(preset.accentPattern).toHaveLength(preset.pulsesPerBar);
      expect(preset.accentPattern[0]).toBe(1);
      expect(preset.groupings[0]).toEqual(preset.defaultGrouping);
      for (const grouping of preset.groupings) {
        expect(isValidGrouping(preset.id, grouping)).toBe(true);
        expect(grouping.reduce((sum, n) => sum + n, 0)).toBe(preset.pulsesPerBar);
      }
    }
  );

  it("derives a three-tier pattern for a custom grouping and keeps the preset for the default", () => {
    expect(getMetronomeAccentPattern("7/8")).toEqual(
      METRONOME_METER_PRESETS.find((preset) => preset.id === "7/8")!.accentPattern
    );
    expect(buildAccentPattern([3, 2, 2])).toEqual([1, 0.44, 0.44, 0.78, 0.44, 0.78, 0.44]);
    expect(getGroupGapIndices([3, 3, 3, 3])).toEqual([3, 6, 9]);
    expect(getGroupGapIndices([2, 2])).toEqual([]);
  });
});

describe("count-in", () => {
  it("accepts four bars — the sheet offers it and the help copy promises it", () => {
    expect(METRONOME_COUNT_IN_BAR_OPTIONS).toEqual([0, 1, 2, 4]);
    expect(clampMetronomeCountInBars(4)).toBe(4);
    expect(clampMetronomeCountInBars(9)).toBe(4);
    expect(clampMetronomeCountInBars(-1)).toBe(0);
  });
});

describe("subdivision and voice", () => {
  it("clamps subdivision into 1–4 and rejects junk", () => {
    expect(clampMetronomeSubdivision(3)).toBe(3);
    expect(clampMetronomeSubdivision(0)).toBe(1);
    expect(clampMetronomeSubdivision(9)).toBe(4);
    expect(clampMetronomeSubdivision("2")).toBe(1);
    expect(clampMetronomeSubdivision(Number.NaN)).toBe(1);
  });

  it("recognises only the two voices", () => {
    expect(isMetronomeClickVoice("click")).toBe(true);
    expect(isMetronomeClickVoice("wood")).toBe(true);
    expect(isMetronomeClickVoice("cowbell")).toBe(false);
  });
});

describe("tempo marking", () => {
  it("steps through the classical bands at their boundaries", () => {
    expect(getTempoMarking(40)).toBe("largo");
    expect(getTempoMarking(59)).toBe("largo");
    expect(getTempoMarking(60)).toBe("adagio");
    expect(getTempoMarking(76)).toBe("andante");
    expect(getTempoMarking(92)).toBe("andante");
    expect(getTempoMarking(108)).toBe("moderato");
    expect(getTempoMarking(120)).toBe("allegro");
    expect(getTempoMarking(168)).toBe("presto");
    expect(getTempoMarking(200)).toBe("prestissimo");
    expect(getTempoMarking(240)).toBe("prestissimo");
  });
});

describe("tap tempo", () => {
  it("needs three taps and then settles on the tapped interval", () => {
    expect(deriveTapTempoBpm([0, 500])).toBeNull();
    expect(deriveTapTempoBpm([0, 500, 1000, 1500])).toBe(120);
  });
});
