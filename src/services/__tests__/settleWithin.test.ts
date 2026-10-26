import { settleWithin } from "../settleWithin";

describe("settleWithin", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("answers true as soon as the call settles", async () => {
    await expect(settleWithin(Promise.resolve(), 1500)).resolves.toBe(true);
  });

  it("treats a failed call as settled, never throws", async () => {
    await expect(settleWithin(Promise.reject(new Error("released")), 1500)).resolves.toBe(true);
  });

  it("stops waiting on a call that never answers", async () => {
    // The guide's seek after a saved take on iOS: it never resolved.
    const waiting = settleWithin(new Promise(() => {}), 1500);
    jest.advanceTimersByTime(1500);
    await expect(waiting).resolves.toBe(false);
  });

  it("takes a plain value (a sync player call) as settled", async () => {
    await expect(settleWithin(undefined, 1500)).resolves.toBe(true);
  });
});
