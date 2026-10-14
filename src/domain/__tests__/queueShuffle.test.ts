import { randomQueueStart, shuffleQueue, unshuffleQueue } from "../queueShuffle";
import type { PlaybackQueueItem } from "../../types";

const q = (n: number, groupId?: string): PlaybackQueueItem =>
  groupId ? { ideaId: `idea-${n}`, clipId: `clip-${n}`, groupId } : { ideaId: `idea-${n}`, clipId: `clip-${n}` };
const ids = (queue: PlaybackQueueItem[]) => queue.map((item) => item.clipId);

/** A seeded generator so shuffles are reproducible. */
function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

describe("shuffleQueue", () => {
  const queue = [q(1), q(2), q(3), q(4), q(5), q(6)];

  it("puts the playing item first and keeps every item exactly once", () => {
    const result = shuffleQueue(queue, 3, seeded(7));
    expect(result.index).toBe(0);
    expect(result.queue[0]).toBe(queue[3]);
    expect(ids(result.queue).sort()).toEqual(ids(queue).sort());
  });

  it("actually reorders (not the identity for a long queue)", () => {
    const long = Array.from({ length: 20 }, (_, i) => q(i));
    const result = shuffleQueue(long, 0, seeded(42));
    expect(ids(result.queue)).not.toEqual(ids(long));
  });

  it("keeps a setlist song's parts together and in order", () => {
    const setlist = [q(1, "a"), q(2, "a"), q(3, "b"), q(4, "c"), q(5, "c"), q(6, "c")];
    for (let seed = 1; seed < 30; seed += 1) {
      const result = shuffleQueue(setlist, 4, seeded(seed));
      // Playing part 2 of song c: song c leads, its part 1 sits behind the playhead.
      expect(ids(result.queue).slice(0, 3)).toEqual(["clip-4", "clip-5", "clip-6"]);
      expect(result.index).toBe(1);
      const flat = ids(result.queue).join(",");
      expect(flat).toContain("clip-1,clip-2");
    }
  });

  it("handles an empty or single-item queue", () => {
    expect(shuffleQueue([], 0)).toEqual({ queue: [], index: 0 });
    const one = [q(1)];
    expect(shuffleQueue(one, 0)).toEqual({ queue: one, index: 0 });
  });
});

describe("randomQueueStart", () => {
  it("only lands on the first part of a song", () => {
    const setlist = [q(1, "a"), q(2, "a"), q(3, "b")];
    for (let seed = 1; seed < 30; seed += 1) {
      expect([0, 2]).toContain(randomQueueStart(setlist, seeded(seed)));
    }
  });
});

describe("unshuffleQueue", () => {
  const original = [q(1), q(2), q(3), q(4), q(5)];

  it("restores the original order around the playing item", () => {
    const shuffled = shuffleQueue(original, 1, seeded(3));
    // Listened on: now playing the third shuffled item.
    const playing = shuffled.queue[2];
    const restored = unshuffleQueue(original, shuffled.queue, 2);
    expect(ids(restored.queue)).toEqual(ids(original));
    expect(restored.queue[restored.index]).toBe(playing);
  });

  it("keeps removals and puts additions at the end", () => {
    const live = [q(3), q(5), q(1), q(9), q(4)]; // 2 removed, 9 added while shuffled
    const restored = unshuffleQueue(original, live, 3);
    expect(ids(restored.queue)).toEqual(["clip-1", "clip-3", "clip-4", "clip-5", "clip-9"]);
    expect(restored.queue[restored.index].clipId).toBe("clip-9");
  });

  it("matches a repeated clip by occurrence", () => {
    const withRepeat = [q(1), q(2), q(1), q(3)];
    const live = [q(1), q(3), q(1), q(2)];
    const restored = unshuffleQueue(withRepeat, live, 2); // the second clip-1
    expect(ids(restored.queue)).toEqual(["clip-1", "clip-2", "clip-1", "clip-3"]);
    expect(restored.index).toBe(2);
  });
});
