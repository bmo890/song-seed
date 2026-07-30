import { resolvePreviousAction, PREVIOUS_RESTART_MS } from "../transportPrevious";

describe("resolvePreviousAction", () => {
  it("restarts the clip once you are into it", () => {
    expect(
      resolvePreviousAction({ positionMs: PREVIOUS_RESTART_MS + 1, hasPreviousItem: true })
    ).toBe("restart");
  });

  it("leaves for the previous item when you are still near the top", () => {
    expect(resolvePreviousAction({ positionMs: 0, hasPreviousItem: true })).toBe("previousItem");
    expect(
      resolvePreviousAction({ positionMs: PREVIOUS_RESTART_MS, hasPreviousItem: true })
    ).toBe("previousItem");
  });

  // The dock used to do nothing at all here — no previous item, so the button was inert
  // and there was no way back to the top of a take from the dock.
  it("restarts rather than doing nothing when there is nowhere to go back to", () => {
    expect(resolvePreviousAction({ positionMs: 0, hasPreviousItem: false })).toBe("restart");
    expect(resolvePreviousAction({ positionMs: 90_000, hasPreviousItem: false })).toBe("restart");
  });
});
