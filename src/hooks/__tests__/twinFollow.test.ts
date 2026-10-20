import { classifyTwinMove } from "../twinFollow";

describe("classifyTwinMove", () => {
  const base = { previousMs: 10_000, previousAt: 1_000, at: 1_200, rate: 1 };

  it("a twin keeping time with the engine is left alone", () => {
    expect(classifyTwinMove({ ...base, positionMs: 10_200, engineMs: 10_180 })).toBe("none");
  });

  it("a lock-screen scrub moves the engine", () => {
    expect(classifyTwinMove({ ...base, positionMs: 40_000, engineMs: 10_200 })).toBe("scrub");
  });

  it("slow drift pulls the twin back instead of making the engine skip", () => {
    // Twin at 1x, engine at 0.75x for a while: the twin has crept ahead.
    expect(classifyTwinMove({ ...base, positionMs: 10_200, engineMs: 8_400 })).toBe("drift");
  });

  it("a stalled engine never drags what you hear forward", () => {
    expect(classifyTwinMove({ ...base, positionMs: 13_000, previousMs: 12_800, engineMs: 10_000 })).toBe(
      "drift"
    );
  });

  it("a long gap between reports is not mistaken for a scrub", () => {
    // Android reports once a second in the background.
    expect(
      classifyTwinMove({ previousMs: 10_000, previousAt: 0, at: 1_000, rate: 1, positionMs: 11_000, engineMs: 11_050 })
    ).toBe("none");
  });

  it("a scrub while paused still counts", () => {
    expect(
      classifyTwinMove({ ...base, rate: 0, previousMs: 10_000, positionMs: 25_000, engineMs: 10_000 })
    ).toBe("scrub");
  });
});
