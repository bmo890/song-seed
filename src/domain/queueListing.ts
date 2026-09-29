import type { PlaybackQueueItem } from "../types";

/**
 * Pure layout math for the queue panel's row list.
 *
 * Every row is the same fixed height so the list can place any row without
 * measuring it first: no reflow when rows mount in batches, no shift when
 * edit mode swaps the row's controls, and "scroll to the playing clip" is a
 * plain multiplication.
 */
export const QUEUE_ROW_HEIGHT = 44;

/**
 * Stable per-row keys. A clip may sit in the queue twice (added twice, or a
 * setlist that repeats a song); the drag list tracks rows by key, so repeats
 * get an occurrence suffix instead of colliding.
 */
export function buildQueueRowKeys(queue: readonly PlaybackQueueItem[]): string[] {
  const seen = new Map<string, number>();
  return queue.map((item) => {
    const base = `${item.ideaId}:${item.clipId}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  });
}

/**
 * Where the list should rest so the playing row is in view: the row itself
 * sits at the top with one row of history above it (what Spotify does), and
 * the end of the queue never leaves blank space beneath the last row.
 */
export function queueScrollTargetIndex(currentIndex: number, length: number): number {
  if (length <= 0) return 0;
  const clamped = Math.max(0, Math.min(currentIndex, length - 1));
  return Math.max(0, clamped - 1);
}

export type VisibleRowRange = { first: number; last: number };

/** The rows fully or partly on screen for a given scroll offset. */
export function visibleQueueRows(
  scrollOffset: number,
  viewportHeight: number,
  length: number,
  rowHeight: number = QUEUE_ROW_HEIGHT
): VisibleRowRange {
  if (length <= 0 || viewportHeight <= 0) return { first: 0, last: -1 };
  const first = Math.max(0, Math.floor(scrollOffset / rowHeight));
  const last = Math.min(length - 1, Math.ceil((scrollOffset + viewportHeight) / rowHeight) - 1);
  return { first, last: Math.max(first, last) };
}

/**
 * Follow the playing row when the track changes ONLY if the listener was
 * watching it: the previous row was on screen and the new one is not. A row
 * that is already visible (a tap on a nearby row, the natural next track)
 * stays put, and a list the user scrolled elsewhere is left alone.
 */
export function shouldFollowQueueIndex(params: {
  previousIndex: number;
  nextIndex: number;
  visible: VisibleRowRange;
}): boolean {
  const { previousIndex, nextIndex, visible } = params;
  if (previousIndex === nextIndex) return false;
  const inView = (index: number) => index >= visible.first && index <= visible.last;
  if (inView(nextIndex)) return false;
  return inView(previousIndex);
}
