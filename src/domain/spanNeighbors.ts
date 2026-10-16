type Span = { id: string; startMs: number; endMs: number };

/** The spans either side of `self`: the latest end before it and the earliest
 *  start after it, for the inspector's "Prev end" / "Next start" snap. Shared by
 *  the player's sections and the clip editor's parts. */
export function spanNeighbors(spans: readonly Span[], self: Span) {
  let prevEndMs: number | null = null;
  let nextStartMs: number | null = null;
  for (const other of spans) {
    if (other.id === self.id) continue;
    if (other.startMs < self.startMs) prevEndMs = Math.max(prevEndMs ?? 0, other.endMs);
    if (other.startMs > self.startMs) {
      nextStartMs = nextStartMs == null ? other.startMs : Math.min(nextStartMs, other.startMs);
    }
  }
  return { prevEndMs, nextStartMs };
}
