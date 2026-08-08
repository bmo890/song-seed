import {
  formatToneFlags,
  hasToneFlag,
  parseToneFlags,
  sanitizeTonePreset,
  toggleToneFlag,
} from "../overdub";

describe("overdub tone flags", () => {
  it("parses legacy single values and canonical combinations", () => {
    expect(parseToneFlags("neutral")).toEqual([]);
    expect(parseToneFlags("low-cut")).toEqual(["low-cut"]);
    expect(parseToneFlags("low-cut+hi-cut")).toEqual(["low-cut", "hi-cut"]);
    expect(parseToneFlags("mid-boost+low-cut")).toEqual(["low-cut", "mid-boost"]);
    expect(parseToneFlags(undefined)).toEqual([]);
    expect(parseToneFlags("warm")).toEqual([]);
  });

  it("formats canonically: fixed order, neutral for none", () => {
    expect(formatToneFlags([])).toBe("neutral");
    expect(formatToneFlags(["mid-boost", "low-cut"])).toBe("low-cut+mid-boost");
    expect(formatToneFlags(["hi-cut", "low-cut", "mid-boost"])).toBe("low-cut+hi-cut+mid-boost");
  });

  it("toggles flags independently", () => {
    expect(toggleToneFlag("neutral", "low-cut")).toBe("low-cut");
    expect(toggleToneFlag("low-cut", "hi-cut")).toBe("low-cut+hi-cut");
    expect(toggleToneFlag("low-cut+hi-cut", "low-cut")).toBe("hi-cut");
    expect(toggleToneFlag("low-cut", "low-cut")).toBe("neutral");
    // Legacy "warm" carries no flags — toggling replaces it, it is not preserved.
    expect(toggleToneFlag("warm", "mid-boost")).toBe("mid-boost");
  });

  it("answers per-flag membership", () => {
    expect(hasToneFlag("low-cut+mid-boost", "mid-boost")).toBe(true);
    expect(hasToneFlag("low-cut+mid-boost", "hi-cut")).toBe(false);
    expect(hasToneFlag(undefined, "low-cut")).toBe(false);
  });

  it("sanitizes persisted values without disturbing valid ones", () => {
    expect(sanitizeTonePreset("neutral")).toBe("neutral");
    expect(sanitizeTonePreset("low-cut")).toBe("low-cut");
    expect(sanitizeTonePreset("warm")).toBe("warm");
    expect(sanitizeTonePreset("bright")).toBe("bright");
    expect(sanitizeTonePreset("hi-cut+low-cut")).toBe("low-cut+hi-cut");
    expect(sanitizeTonePreset("low-cut+garbage")).toBe("low-cut");
    expect(sanitizeTonePreset("garbage")).toBe("neutral");
    expect(sanitizeTonePreset(42)).toBe("neutral");
    expect(sanitizeTonePreset(undefined)).toBe("neutral");
    expect(sanitizeTonePreset("")).toBe("neutral");
  });
});
