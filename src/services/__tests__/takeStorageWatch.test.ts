import { createStorageFullAnnouncer, createTakeStorageWatch } from "../takeStorageWatch";

/**
 * Audit 2026-11-02, 09-H2 / 10-M1: a full disk mid-take truncated the take silently.
 * The watch stops the take before the disk fills, once, and only while it rolls.
 */
function harness(freeBytes: number[]) {
  const timers: Array<() => void> = [];
  const state = { capturing: true, held: true };
  const onLow = jest.fn();
  const watch = createTakeStorageWatch({
    readFreeBytes: async () => freeBytes.shift() ?? 10 * 1024 * 1024 * 1024,
    isCapturing: () => state.capturing,
    isHeld: () => state.held,
    onLow,
    setTimer: (run) => {
      timers.push(run);
      return timers.length as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimer: () => {},
  });
  const tick = async () => {
    timers.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { watch, state, onLow, tick, timers };
}

const MB = 1024 * 1024;

describe("take storage watch", () => {
  it("stops the take when free space runs low", async () => {
    const h = harness([900 * MB, 300 * MB, 20 * MB]);
    h.watch.start();
    await h.tick();
    await h.tick();
    expect(h.onLow).not.toHaveBeenCalled();
    await h.tick();
    expect(h.onLow).toHaveBeenCalledTimes(1);
  });

  it("does not poll a paused take, and ends with the take", async () => {
    const h = harness([10 * MB]);
    h.watch.start();
    h.state.capturing = false;
    await h.tick();
    expect(h.onLow).not.toHaveBeenCalled();
    h.state.held = false;
    await h.tick();
    expect(h.timers).toHaveLength(0);
  });

  it("never stops a take on a failed probe", async () => {
    const onLow = jest.fn();
    const runs: Array<() => void> = [];
    const watch = createTakeStorageWatch({
      readFreeBytes: async () => {
        throw new Error("probe failed");
      },
      isCapturing: () => true,
      isHeld: () => true,
      onLow,
      setTimer: (run) => {
        runs.push(run);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      clearTimer: () => {},
    });
    watch.start();
    runs.shift()?.();
    await new Promise((resolve) => setImmediate(resolve));
    expect(onLow).not.toHaveBeenCalled();
  });

  it("announces a full disk once per take, however many reports arrive", () => {
    const say = jest.fn();
    const announcer = createStorageFullAnnouncer(say);
    expect(announcer.announce()).toBe(true);
    expect(announcer.announce()).toBe(false);
    announcer.reset();
    announcer.announce();
    expect(say).toHaveBeenCalledTimes(2);
  });
});
