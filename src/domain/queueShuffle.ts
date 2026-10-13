import type { PlaybackQueueItem } from "../types";

/**
 * Shuffle for the playback queue — the industry-standard model (Spotify,
 * Apple Music):
 *
 * - Turning shuffle on keeps the playing item playing and puts it first;
 *   everything else follows in a random order, so the whole queue still plays.
 * - Turning it off restores the order the queue had before, and playback
 *   carries on from the same item in that order.
 * - Edits made while shuffled survive the restore: removed items stay gone,
 *   added items keep their place at the end.
 *
 * Items that share a `groupId` (the parts of one setlist song: a mix and an
 * isolated bass part) move as one unit, in their own order — shuffle mixes
 * songs, never the parts of a song.
 */

export type ShuffleRandom = () => number;

/** Contiguous runs of items: one per item, or one per run sharing a groupId. */
function queueUnits(queue: readonly PlaybackQueueItem[]): PlaybackQueueItem[][] {
  const units: PlaybackQueueItem[][] = [];
  for (const item of queue) {
    const last = units[units.length - 1];
    const lastGroup = last?.[0]?.groupId;
    if (last && item.groupId != null && lastGroup === item.groupId) {
      last.push(item);
    } else {
      units.push([item]);
    }
  }
  return units;
}

/** Fisher–Yates, in place. `random` is injectable so tests are deterministic. */
function shuffleInPlace<T>(values: T[], random: ShuffleRandom): T[] {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

/**
 * The shuffled queue: the playing item's unit first (the item itself stays
 * the one playing), every other unit after it in random order.
 */
export function shuffleQueue(
  queue: readonly PlaybackQueueItem[],
  currentIndex: number,
  random: ShuffleRandom = Math.random
): { queue: PlaybackQueueItem[]; index: number } {
  if (queue.length === 0) return { queue: [], index: 0 };
  const current = Math.max(0, Math.min(currentIndex, queue.length - 1));
  const units = queueUnits(queue);

  let seen = 0;
  let currentUnit = 0;
  let offsetInUnit = 0;
  for (let u = 0; u < units.length; u += 1) {
    if (current < seen + units[u].length) {
      currentUnit = u;
      offsetInUnit = current - seen;
      break;
    }
    seen += units[u].length;
  }

  const rest = shuffleInPlace(
    units.filter((_, u) => u !== currentUnit),
    random
  );
  return { queue: [...units[currentUnit], ...rest.flat()], index: offsetInUnit };
}

/** A random starting point for "shuffle play": any item that opens a unit. */
export function randomQueueStart(
  queue: readonly PlaybackQueueItem[],
  random: ShuffleRandom = Math.random
): number {
  if (queue.length === 0) return 0;
  const units = queueUnits(queue);
  const pick = Math.floor(random() * units.length);
  let index = 0;
  for (let u = 0; u < pick; u += 1) index += units[u].length;
  return index;
}

const itemKey = (item: PlaybackQueueItem) => `${item.ideaId}:${item.clipId}`;

/**
 * The queue back in its pre-shuffle order, reconciled with the live queue:
 * only items still queued come back (a removal while shuffled stays removed),
 * and anything queued since lands at the end in its current order. The
 * playing item keeps playing — matched by occurrence when a clip repeats.
 */
export function unshuffleQueue(
  original: readonly PlaybackQueueItem[],
  live: readonly PlaybackQueueItem[],
  liveIndex: number
): { queue: PlaybackQueueItem[]; index: number } {
  if (live.length === 0) return { queue: [], index: 0 };

  // How many of each item the live queue still holds.
  const remaining = new Map<string, PlaybackQueueItem[]>();
  for (const item of live) {
    const key = itemKey(item);
    const bucket = remaining.get(key);
    if (bucket) bucket.push(item);
    else remaining.set(key, [item]);
  }

  const restored: PlaybackQueueItem[] = [];
  for (const item of original) {
    const bucket = remaining.get(itemKey(item));
    // Take the live object (not the stored one) so later edits stay in step.
    const taken = bucket?.shift();
    if (taken) restored.push(taken);
  }
  // Added while shuffled: append in the order they sit in the live queue.
  for (const item of live) {
    const bucket = remaining.get(itemKey(item));
    if (bucket && bucket[0] === item) {
      bucket.shift();
      restored.push(item);
    }
  }

  const current = live[Math.max(0, Math.min(liveIndex, live.length - 1))];
  const currentKey = itemKey(current);
  let occurrence = 0;
  for (let i = 0; i < liveIndex && i < live.length; i += 1) {
    if (itemKey(live[i]) === currentKey) occurrence += 1;
  }
  let index = 0;
  let found = 0;
  for (let i = 0; i < restored.length; i += 1) {
    if (itemKey(restored[i]) !== currentKey) continue;
    index = i;
    if (found === occurrence) break;
    found += 1;
  }
  return { queue: restored, index };
}
