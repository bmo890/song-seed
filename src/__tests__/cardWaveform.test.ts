import { computeStripBarAmps, STRIP_STRETCH_MIN_CEILING } from "../domain/cardWaveform";

// A real phone-recorded sketch on the stored dB-linear curve: room tone ≈ 0.13,
// normal playing ≈ 0.54, the loudest strum ≈ 0.77.
const real = [
  ...Array(20).fill(0.13),
  ...Array(60).fill(0.54),
  ...Array(20).fill(0.77),
  ...Array(60).fill(0.5),
  ...Array(20).fill(0.13),
];

describe("computeStripBarAmps", () => {
  it("stretches a real clip so its loudest bar fills the strip and its floor sits at zero", () => {
    const amps = computeStripBarAmps(real, 36, false);
    expect(Math.max(...amps)).toBeCloseTo(1, 5);
    expect(Math.min(...amps)).toBe(0);
    // The bars that were ~1px apart on the raw curve now span most of the height.
    expect(amps[18] - amps[10]).toBeGreaterThan(0.3);
  });

  it("leaves synthetic peaks alone — seeded jitter must not become a fake performance", () => {
    const placeholder = Array.from({ length: 256 }, (_, i) => 0.24 + ((i * 7919) % 100) / 100 * 0.16);
    const amps = computeStripBarAmps(placeholder, 36, true);
    expect(Math.max(...amps)).toBeLessThanOrEqual(0.4);
    expect(Math.min(...amps)).toBeGreaterThanOrEqual(0.24);
  });

  it("leaves room tone alone — a clip whose loudest bar is still silence must not expand into full-height noise", () => {
    const roomTone = Array.from({ length: 256 }, (_, i) => 0.08 + ((i * 31) % 10) / 100);
    const amps = computeStripBarAmps(roomTone, 36, false);
    expect(Math.max(...amps)).toBeLessThan(STRIP_STRETCH_MIN_CEILING);
  });

  it("leaves a flat clip alone — a held drone has no shape to reveal", () => {
    const drone = Array(256).fill(0.6);
    const amps = computeStripBarAmps(drone, 36, false);
    expect(amps.every((a) => Math.abs(a - 0.6) < 1e-9)).toBe(true);
  });

  it("uses the bucket mean, not its max, so a single loud bin does not fill its bar", () => {
    const peaks = Array(256).fill(0.3);
    peaks[100] = 0.9;
    const amps = computeStripBarAmps(peaks, 36, true);
    const bar = amps[Math.floor(100 / (256 / 36))];
    expect(bar).toBeLessThan(0.5);
    expect(bar).toBeGreaterThan(0.3);
  });
});
