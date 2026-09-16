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

describe("feels (click on)", () => {
  const {
    getMetronomeFeels,
    getMetronomeFeelParams,
    resolveMetronomeFeelId,
    buildRestPattern,
    cyclePulseWeight,
    feelIdForGrid,
    METRONOME_FEEL_CUSTOM,
    METRONOME_FEEL_IN_GROUPS,
  } = require("../metronome");

  it("offers the player's choices per meter, Custom last", () => {
    expect(getMetronomeFeels("4/4").map((f: { id: string }) => f.id)).toEqual([
      "beats", "eighths", "triplets", "sixteenths", "custom",
    ]);
    expect(getMetronomeFeels("5/4").map((f: { id: string }) => f.id)).toEqual(["group:3+2", "group:2+3", "eighths", "custom"]);
    expect(getMetronomeFeels("7/8").map((f: { id: string }) => f.id)).toEqual([
      "group:2+2+3", "group:3+2+2", "group:2+3+2", "custom",
    ]);
    expect(getMetronomeFeels("6/8").map((f: { id: string }) => f.id)).toEqual([METRONOME_FEEL_IN_GROUPS, "eighths", "custom"]);
    // Without rest support the dotted-beat feel is withheld rather than lying.
    expect(getMetronomeFeels("6/8", false).map((f: { id: string }) => f.id)).toEqual(["eighths", "custom"]);
  });

  it("maps simple feels onto sub-clicks over the preset accents", () => {
    const eighths = getMetronomeFeelParams("4/4", "eighths");
    expect(eighths.subdivision).toBe(2);
    expect(eighths.accentPattern).toEqual([1, 0.46, 0.72, 0.46]);
    expect(eighths.explicitPattern).toBe(false);
  });

  it("felt in two rests between the group starts", () => {
    expect(buildRestPattern([3, 3])).toEqual([1, 0, 0, 0.78, 0, 0]);
    const inTwo = getMetronomeFeelParams("6/8", METRONOME_FEEL_IN_GROUPS);
    expect(inTwo.accentPattern).toEqual([1, 0, 0, 0.78, 0, 0]);
    expect(inTwo.explicitPattern).toBe(true);
  });

  it("5/4 eighths keeps whichever grouping was chosen", () => {
    expect(getMetronomeFeelParams("5/4", "eighths", { currentGrouping: [3, 2] }).grouping).toEqual([3, 2]);
    expect(getMetronomeFeelParams("5/4", "group:3+2").accentPattern).toEqual(buildAccentPattern([3, 2]));
  });

  it("custom uses the stored pattern only when it fits the meter", () => {
    expect(getMetronomeFeelParams("3/4", METRONOME_FEEL_CUSTOM, { customPattern: [1, 0, 0.44] }).accentPattern).toEqual([1, 0, 0.44]);
    expect(getMetronomeFeelParams("3/4", METRONOME_FEEL_CUSTOM, { customPattern: [1, 0] }).accentPattern).toEqual([1, 0.48, 0.48]);
  });

  it("reads legacy subdivision + grouping back into a feel", () => {
    expect(resolveMetronomeFeelId("4/4", undefined, { subdivision: 3 })).toBe("triplets");
    expect(resolveMetronomeFeelId("5/4", undefined, { subdivision: 1, grouping: [3, 2] })).toBe("group:3+2");
    expect(resolveMetronomeFeelId("6/8", undefined, { subdivision: 2 })).toBe("eighths");
    expect(resolveMetronomeFeelId("4/4", "bogus", { subdivision: 1 })).toBe("beats");
    expect(resolveMetronomeFeelId("7/8", "group:3+2+2", { subdivision: 1 })).toBe("group:3+2+2");
  });

  it("cycles a tapped pulse accent → click → rest, skipping rest without support", () => {
    expect(cyclePulseWeight(1)).toBe(0.44);
    expect(cyclePulseWeight(0.44)).toBe(0);
    expect(cyclePulseWeight(0)).toBe(1);
    expect(cyclePulseWeight(0.44, false)).toBe(1);
  });

  it("names the feel a saved grid describes", () => {
    expect(feelIdForGrid("6/8", undefined, [1, 0, 0, 0.78, 0, 0])).toBe(METRONOME_FEEL_IN_GROUPS);
    expect(feelIdForGrid("4/4", undefined, [1, 0, 1, 0])).toBe(METRONOME_FEEL_CUSTOM);
    expect(feelIdForGrid("5/4", [3, 2])).toBe("group:3+2");
    expect(feelIdForGrid("4/4")).toBe("beats");
  });
});
