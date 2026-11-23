import { decideAutoSound } from "../autoSound";
import { toggleToneFlag, toneBandPosition, toneBandToggle } from "../overdub";

const db = (value: number) => Math.pow(10, value / 20);

/** An analysis of `windows` windows at `levelDb`, with rumble and hiss as shares of
 *  the window's power, and quiet gaps at `gapDb` every fifth window. */
function take({
  levelDb,
  windows = 100,
  rumble = 0.02,
  high = 0.05,
  peakDb = levelDb + 12,
  gapDb,
  gapHigh = high,
}: {
  levelDb: number;
  windows?: number;
  rumble?: number;
  high?: number;
  peakDb?: number;
  gapDb?: number;
  gapHigh?: number;
}) {
  const rms: number[] = [];
  const sub: number[] = [];
  const hi: number[] = [];
  for (let i = 0; i < windows; i++) {
    const gap = gapDb !== undefined && i % 5 === 0;
    const level = db(gap ? gapDb! : levelDb);
    rms.push(level);
    sub.push(level * Math.sqrt(gap ? 0.01 : rumble));
    hi.push(level * Math.sqrt(gap ? gapHigh : high));
  }
  return { windowMs: 400, rms, sub, high: hi, peak: db(peakDb) };
}

describe("Auto in the Sound drawer", () => {
  it("brings a quiet take up toward a comfortable level", () => {
    expect(decideAutoSound(take({ levelDb: -30 }))).toEqual({ gainDb: 12, tonePreset: "neutral", heard: ["quiet"] });
    expect(decideAutoSound(take({ levelDb: -26 }))).toEqual({ gainDb: 8, tonePreset: "neutral", heard: ["quiet"] });
  });

  it("leaves a take that already sits right alone", () => {
    expect(decideAutoSound(take({ levelDb: -18.5 }))).toEqual({ gainDb: 0, tonePreset: "neutral", heard: [] });
  });

  it("brings a too-loud take down", () => {
    expect(decideAutoSound(take({ levelDb: -10, peakDb: -0.1 }))?.gainDb).toBe(-8);
  });

  it("never lets the limiter take more than a few dB off a loud drum hit", () => {
    // Quiet playing (-30) with peaks at -3: the lift stops at -1 - (-3) + 6 = 8 dB.
    expect(decideAutoSound(take({ levelDb: -30, peakDb: -3 }))?.gainDb).toBe(8);
  });

  it("measures the playing, not the gaps between songs", () => {
    const withGaps = decideAutoSound(take({ levelDb: -24, gapDb: -55 }));
    expect(withGaps?.gainDb).toBe(6);
  });

  it("cuts the lows when the room booms or the table thumps", () => {
    expect(decideAutoSound(take({ levelDb: -20, rumble: 0.4 }))?.tonePreset).toBe("low-cut");
  });

  it("keeps an ordinary bass line", () => {
    expect(decideAutoSound(take({ levelDb: -20, rumble: 0.1 }))?.tonePreset).toBe("neutral");
  });

  it("cuts the highs on a harsh rehearsal (cymbals close to the phone)", () => {
    expect(decideAutoSound(take({ levelDb: -20, high: 0.35 }))?.tonePreset).toBe("hi-cut");
  });

  it("cuts the highs when the quiet parts are hiss you'll hear once it's louder", () => {
    expect(decideAutoSound(take({ levelDb: -30, gapDb: -50, gapHigh: 0.8 }))?.tonePreset).toBe("hi-cut");
  });

  it("leaves faint hiss that stays below hearing", () => {
    expect(decideAutoSound(take({ levelDb: -18, gapDb: -75, gapHigh: 0.8 }))?.tonePreset).toBe("neutral");
  });

  it("does both on a boomy, harsh rehearsal", () => {
    expect(decideAutoSound(take({ levelDb: -22, rumble: 0.3, high: 0.3 }))?.tonePreset).toBe("low-cut+hi-cut");
  });

  it("evens out a rehearsal whose drum hits stand far above the playing", () => {
    expect(decideAutoSound(take({ levelDb: -26, peakDb: -2 }))?.tonePreset).toBe("even");
  });

  it("evens out playing that swings between quiet verses and loud choruses", () => {
    const quietLoud = take({ levelDb: -14, gapDb: -32 });
    expect(decideAutoSound(quietLoud)?.tonePreset).toBe("even");
  });

  it("leaves a steady voice memo uncompressed", () => {
    expect(decideAutoSound(take({ levelDb: -24, peakDb: -10 }))?.tonePreset).toBe("neutral");
  });

  it("brightens a dull take (a phone in a pocket) that has no hiss to lift", () => {
    expect(decideAutoSound(take({ levelDb: -24, high: 0.0004 }))?.tonePreset).toBe("hi-boost");
  });

  it("keeps its hands off an ordinary take: a soft voice, a strummed guitar", () => {
    // A hummed melody has little above 6 kHz by nature; a strummed guitar's peaks stand
    // about 20 dB over it. Neither is a fault, so the tone and Even stay off.
    expect(decideAutoSound(take({ levelDb: -18, high: 0.002 }))?.tonePreset).toBe("neutral");
    expect(decideAutoSound(take({ levelDb: -22, peakDb: -1 }))?.tonePreset).toBe("neutral");
  });

  it("says what it heard, in the order it is shown", () => {
    const rehearsal = decideAutoSound(take({ levelDb: -28, rumble: 0.3, high: 0.3, peakDb: -3 }));
    expect(rehearsal?.heard).toEqual(["quiet", "rumble", "harsh", "uneven"]);
    expect(decideAutoSound(take({ levelDb: -10, peakDb: -0.1 }))?.heard).toEqual(["loud"]);
    expect(decideAutoSound(take({ levelDb: -24, high: 0.0004 }))?.heard).toEqual(["quiet", "dull"]);
  });

  it("never brightens and darkens at once", () => {
    // Dull while playing, but the gaps are hiss: Hi cut wins.
    expect(decideAutoSound(take({ levelDb: -30, high: 0.001, gapDb: -50, gapHigh: 0.8 }))?.tonePreset).toBe("hi-cut");
  });

  it("says nothing about a silent clip", () => {
    expect(decideAutoSound(take({ levelDb: -80 }))).toBeNull();
  });
});


describe("the high band's two directions", () => {
  it("lighting Hi boost puts out Hi cut, and the other way round", () => {
    expect(toggleToneFlag("low-cut+hi-cut", "hi-boost")).toBe("low-cut+hi-boost");
    expect(toggleToneFlag("hi-boost+even", "hi-cut")).toBe("hi-cut+even");
  });

  it("a band reads as cut, flat or boost, and moves with one toggle", () => {
    expect(toneBandPosition("low-cut+hi-boost+even", "low")).toBe("cut");
    expect(toneBandPosition("low-cut+hi-boost+even", "mid")).toBe("flat");
    expect(toneBandPosition("low-cut+hi-boost+even", "high")).toBe("boost");
    // Already there: nothing to toggle.
    expect(toneBandToggle("low-cut", "low", "cut")).toBeNull();
    // Flat puts out whichever direction is lit.
    expect(toneBandToggle("low-cut", "low", "flat")).toBe("low-cut");
    expect(toneBandToggle("hi-boost", "high", "flat")).toBe("hi-boost");
    // Straight across: lighting the other direction puts this one out.
    const flag = toneBandToggle("mid-boost", "mid", "cut");
    expect(flag).toBe("mid-cut");
    expect(toggleToneFlag("mid-boost", flag!)).toBe("mid-cut");
  });

  it("the middle has both directions too, and they exclude each other", () => {
    expect(toggleToneFlag("low-cut+mid-boost", "mid-cut")).toBe("low-cut+mid-cut");
    expect(toggleToneFlag("mid-cut", "mid-boost")).toBe("mid-boost");
  });
});
