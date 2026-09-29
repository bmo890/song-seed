import {
  buildQueueRowKeys,
  queueScrollTargetIndex,
  shouldFollowQueueIndex,
  visibleQueueRows,
} from "../queueListing";

describe("buildQueueRowKeys", () => {
  it("keys rows by idea and clip", () => {
    expect(buildQueueRowKeys([{ ideaId: "a", clipId: "1" }, { ideaId: "b", clipId: "2" }])).toEqual([
      "a:1",
      "b:2",
    ]);
  });

  it("keeps repeated clips apart", () => {
    const queue = [
      { ideaId: "a", clipId: "1" },
      { ideaId: "a", clipId: "1" },
      { ideaId: "b", clipId: "2" },
      { ideaId: "a", clipId: "1" },
    ];
    const keys = buildQueueRowKeys(queue);
    expect(keys).toEqual(["a:1", "a:1#1", "b:2", "a:1#2"]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("queueScrollTargetIndex", () => {
  it("rests one row above the playing row", () => {
    expect(queueScrollTargetIndex(17, 323)).toBe(16);
  });

  it("stays at the top for the first two rows", () => {
    expect(queueScrollTargetIndex(0, 10)).toBe(0);
    expect(queueScrollTargetIndex(1, 10)).toBe(0);
  });

  it("clamps an index past the end and tolerates an empty queue", () => {
    expect(queueScrollTargetIndex(50, 10)).toBe(8);
    expect(queueScrollTargetIndex(3, 0)).toBe(0);
  });
});

describe("visibleQueueRows", () => {
  it("reports the rows on screen for a 6-row viewport", () => {
    expect(visibleQueueRows(0, 264, 323, 44)).toEqual({ first: 0, last: 5 });
    expect(visibleQueueRows(44 * 16, 264, 323, 44)).toEqual({ first: 16, last: 21 });
  });

  it("counts a partly shown row as visible", () => {
    expect(visibleQueueRows(20, 264, 323, 44)).toEqual({ first: 0, last: 6 });
  });

  it("clamps to the end of the queue", () => {
    expect(visibleQueueRows(44 * 320, 264, 323, 44)).toEqual({ first: 320, last: 322 });
    expect(visibleQueueRows(0, 0, 323, 44)).toEqual({ first: 0, last: -1 });
  });
});

describe("shouldFollowQueueIndex", () => {
  const visible = { first: 16, last: 21 };

  it("follows the next track when the playing row scrolls out of view", () => {
    expect(shouldFollowQueueIndex({ previousIndex: 21, nextIndex: 22, visible })).toBe(true);
  });

  it("stays put when the next row is already on screen", () => {
    expect(shouldFollowQueueIndex({ previousIndex: 17, nextIndex: 18, visible })).toBe(false);
  });

  it("leaves a list the listener scrolled elsewhere alone", () => {
    expect(shouldFollowQueueIndex({ previousIndex: 3, nextIndex: 4, visible })).toBe(false);
  });

  it("ignores a no-op index change", () => {
    expect(shouldFollowQueueIndex({ previousIndex: 17, nextIndex: 17, visible })).toBe(false);
  });
});
