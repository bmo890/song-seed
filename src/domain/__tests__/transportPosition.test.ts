import {
  resolveSourcePositionHold,
  resolveClockPosition,
  type SourcePositionHold,
  type PendingDisplaySeek,
} from "../transportPosition";

const TOLERANCE = 320;

function hold(overrides: Partial<SourcePositionHold> = {}): SourcePositionHold {
  return { targetMs: 30_000, until: 10_000, accepted: false, ...overrides };
}

describe("resolveSourcePositionHold", () => {
  it("passes the engine's own report through when nothing is held", () => {
    expect(resolveSourcePositionHold(4321, null, 0, TOLERANCE)).toEqual({
      positionMs: 4321,
      shouldAccept: false,
    });
  });

  it("shows the target while the engine is still reporting the outgoing clip", () => {
    // Opened a clip at 30s; the engine still says 2s from the clip we came from.
    expect(resolveSourcePositionHold(2_000, hold(), 5_000, TOLERANCE)).toEqual({
      positionMs: 30_000,
      shouldAccept: false,
    });
  });

  it("accepts the engine once its report reaches the target", () => {
    expect(resolveSourcePositionHold(29_800, hold(), 5_000, TOLERANCE)).toEqual({
      positionMs: 29_800,
      shouldAccept: true,
    });
  });

  it("treats the tolerance as inclusive at its edge", () => {
    const atEdge = resolveSourcePositionHold(30_000 + TOLERANCE, hold(), 5_000, TOLERANCE);
    expect(atEdge.shouldAccept).toBe(true);
    const pastEdge = resolveSourcePositionHold(30_000 + TOLERANCE + 1, hold(), 5_000, TOLERANCE);
    expect(pastEdge.shouldAccept).toBe(false);
    expect(pastEdge.positionMs).toBe(30_000);
  });

  it("gives up and believes the engine once the deadline passes", () => {
    // The engine never arrived, but we cannot sit on the target forever.
    expect(resolveSourcePositionHold(2_000, hold(), 10_000, TOLERANCE)).toEqual({
      positionMs: 2_000,
      shouldAccept: true,
    });
  });

  it("stops interfering once the hold has been accepted", () => {
    expect(
      resolveSourcePositionHold(2_000, hold({ accepted: true }), 5_000, TOLERANCE)
    ).toEqual({ positionMs: 2_000, shouldAccept: false });
  });
});

describe("resolveClockPosition", () => {
  const base = {
    isPlaying: true,
    resetPositionMs: 0,
    resetHoldUntil: 0,
    pendingSeek: null as PendingDisplaySeek | null,
    playbackRate: 1,
    nowMs: 1_000,
  };

  it("writes a plain report through", () => {
    expect(resolveClockPosition({ ...base, positionMs: 4_000 })).toEqual({
      shouldWrite: true,
      positionMs: 4_000,
      clearResetHold: false,
      clearPendingSeek: false,
      recordAsNativePosition: true,
    });
  });

  describe("reset hold", () => {
    it("swallows the outgoing clip's position while a paused source settles", () => {
      // New clip opened (parks at 0), engine still reporting 42s from the old one.
      const result = resolveClockPosition({
        ...base,
        positionMs: 42_000,
        isPlaying: false,
        resetHoldUntil: 2_000,
      });
      expect(result.shouldWrite).toBe(false);
      // A report we refuse to display is not the engine's latest position either.
      expect(result.recordAsNativePosition).toBe(false);
    });

    it("releases the hold once the source reports the reset position", () => {
      const result = resolveClockPosition({
        ...base,
        positionMs: 50,
        isPlaying: false,
        resetHoldUntil: 2_000,
      });
      expect(result.shouldWrite).toBe(true);
      expect(result.clearResetHold).toBe(true);
    });

    it("does not swallow anything once playback has started", () => {
      // Playing means the position is this clip's, however far along it is.
      const result = resolveClockPosition({
        ...base,
        positionMs: 42_000,
        isPlaying: true,
        resetHoldUntil: 2_000,
      });
      expect(result.shouldWrite).toBe(true);
      expect(result.clearResetHold).toBe(false);
    });

    it("stops swallowing once the hold expires", () => {
      const result = resolveClockPosition({
        ...base,
        positionMs: 42_000,
        isPlaying: false,
        resetHoldUntil: 2_000,
        nowMs: 2_000,
      });
      expect(result.shouldWrite).toBe(true);
    });
  });

  describe("pending seek", () => {
    const seek: PendingDisplaySeek = { sourceMs: 10_000, targetMs: 60_000, until: 5_000 };

    it("swallows reports that still read as where the seek came from", () => {
      const result = resolveClockPosition({ ...base, positionMs: 10_020, pendingSeek: seek });
      expect(result.shouldWrite).toBe(false);
      expect(result.clearPendingSeek).toBe(false);
      // Still the engine's latest known position, even though we won't display it.
      expect(result.recordAsNativePosition).toBe(true);
    });

    it("writes and clears once the engine reaches the target", () => {
      const result = resolveClockPosition({ ...base, positionMs: 59_950, pendingSeek: seek });
      expect(result.shouldWrite).toBe(true);
      expect(result.clearPendingSeek).toBe(true);
    });

    it("writes a position that is neither the source nor the target", () => {
      // Mid-flight or an unrelated jump — no reason to hold it back.
      const result = resolveClockPosition({ ...base, positionMs: 35_000, pendingSeek: seek });
      expect(result.shouldWrite).toBe(true);
      expect(result.clearPendingSeek).toBe(true);
    });

    it("gives up waiting once the seek deadline passes", () => {
      const result = resolveClockPosition({
        ...base,
        positionMs: 10_020,
        pendingSeek: seek,
        nowMs: 5_000,
      });
      expect(result.shouldWrite).toBe(true);
      expect(result.clearPendingSeek).toBe(true);
    });

    it("widens its tolerance with the playback rate", () => {
      // At 2x the engine covers more ground between reports, so "still at the source"
      // has to mean a wider window or the seek looks landed when it hasn't moved.
      const nearSource = { ...base, positionMs: 10_200, pendingSeek: seek };
      expect(resolveClockPosition({ ...nearSource, playbackRate: 1 }).shouldWrite).toBe(true);
      expect(resolveClockPosition({ ...nearSource, playbackRate: 2 }).shouldWrite).toBe(false);
    });

    it("does not let a seek escape a reset hold", () => {
      // Both vetoes active: the reset hold wins and nothing is displayed.
      const result = resolveClockPosition({
        ...base,
        positionMs: 10_020,
        isPlaying: false,
        resetHoldUntil: 2_000,
        pendingSeek: seek,
      });
      expect(result.shouldWrite).toBe(false);
      expect(result.recordAsNativePosition).toBe(false);
    });
  });
});
