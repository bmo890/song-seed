/**
 * A full disk mid-take used to truncate the take silently: the native writers dropped
 * every buffer after the disk filled (iOS) or ended capture with a log line (Android),
 * the clock kept counting, and Save "succeeded" with the shorter file (audit 2026-11-02,
 * 09-H2, 10-M1). The take now stops where it is, keeps what was captured, and says so.
 *
 * Two ways in: the patched native recorders report a failed write as a "storageFull"
 * interruption (next store build), and this watch polls free space while a take rolls,
 * so the take stops cleanly BEFORE the disk is full on any build.
 */

/** Stop under this much free space. A mono 44.1 kHz take writes ~88 KB/s, so one poll
 *  interval is ~1.3 MB; the margin leaves room for the save itself. */
export const TAKE_STORAGE_FLOOR_BYTES = 24 * 1024 * 1024;
export const TAKE_STORAGE_POLL_MS = 15_000;

/** The interruption reason the patched recorders send when a write fails. */
export const STORAGE_FULL_REASON = "storageFull";

type WatchDeps = {
  readFreeBytes: () => Promise<number>;
  /** True while capture is rolling (not paused, not settled). */
  isCapturing: () => boolean;
  /** True while the take holds the recorder; the watch ends with it. */
  isHeld: () => boolean;
  onLow: () => void;
  setTimer?: (run: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
  floorBytes?: number;
  intervalMs?: number;
};

export function createTakeStorageWatch(deps: WatchDeps) {
  const setTimer = deps.setTimer ?? ((run, ms) => setTimeout(run, ms));
  const clearTimer = deps.clearTimer ?? ((handle) => clearTimeout(handle));
  const floor = deps.floorBytes ?? TAKE_STORAGE_FLOOR_BYTES;
  const interval = deps.intervalMs ?? TAKE_STORAGE_POLL_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    if (timer) clearTimer(timer);
    timer = null;
  }

  async function check() {
    timer = null;
    if (!deps.isHeld()) return;
    if (deps.isCapturing()) {
      let free: number | null = null;
      try {
        free = await deps.readFreeBytes();
      } catch {
        // A failed probe never stops a take; the native write check is the backstop.
      }
      if (free !== null && Number.isFinite(free) && free >= 0 && free < floor && deps.isHeld() && deps.isCapturing()) {
        deps.onLow();
      }
    }
    if (deps.isHeld() && !timer) timer = setTimer(() => void check(), interval);
  }

  return {
    /** Idempotent: one poll loop per take. */
    start() {
      if (timer) return;
      timer = setTimer(() => void check(), interval);
    },
    stop,
    isRunning: () => timer !== null,
  };
}

/**
 * One announcement per take: the poll and the native write failure can both report the
 * same full disk.
 */
export function createStorageFullAnnouncer(announce: () => void) {
  let announced = false;
  return {
    reset() {
      announced = false;
    },
    announce() {
      if (announced) return false;
      announced = true;
      announce();
      return true;
    },
  };
}
