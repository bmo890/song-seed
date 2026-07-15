import { aggregateTempo, detectKeyFromChroma } from "../domain/clipAnalysis";

// Krumhansl major/minor profiles (mirror of the analyzer's internal constants) used to
// synthesise an unambiguous chromagram for a given key.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function chromaForKey(tonic: number, profile: number[]): number[] {
  // Rotate the profile so its tonic lands on `tonic` (inverse of the analyzer's rotation).
  return profile.map((_, i) => profile[(i - tonic + 12) % 12]);
}

describe("detectKeyFromChroma", () => {
  it("identifies C major from a C-major-shaped chromagram", () => {
    const estimate = detectKeyFromChroma(chromaForKey(0, MAJOR));
    expect(estimate).not.toBeNull();
    expect(estimate?.keyIndex).toBe(0);
    expect(estimate?.mode).toBe("major");
  });

  it("identifies G major (tonic index 7)", () => {
    const estimate = detectKeyFromChroma(chromaForKey(7, MAJOR));
    expect(estimate?.keyIndex).toBe(7);
    expect(estimate?.mode).toBe("major");
  });

  it("identifies A minor (tonic index 9)", () => {
    const estimate = detectKeyFromChroma(chromaForKey(9, MINOR));
    expect(estimate?.keyIndex).toBe(9);
    expect(estimate?.mode).toBe("minor");
  });

  it("returns null for an empty/short chromagram", () => {
    expect(detectKeyFromChroma([])).toBeNull();
    expect(detectKeyFromChroma([1, 2, 3])).toBeNull();
  });
});

describe("aggregateTempo", () => {
  it("returns a steady score for tightly-clustered tempos", () => {
    const { bpm, steadiness } = aggregateTempo([120, 121, 119, 120, 120]);
    expect(bpm).toBe(120);
    expect(steadiness).toBeGreaterThan(0.9);
  });

  it("returns a low steadiness for wandering tempos", () => {
    const { steadiness } = aggregateTempo([80, 130, 95, 150, 70]);
    expect(steadiness).toBeLessThan(0.5);
  });

  it("ignores out-of-range tempos and reports null when none are valid", () => {
    expect(aggregateTempo([0, 12, 999]).bpm).toBeNull();
  });
});
