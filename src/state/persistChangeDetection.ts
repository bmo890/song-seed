/**
 * Zustand's persist middleware calls setItem on EVERY set() — including pure playback
 * ticks (player position flowing into the store several times a second), which change
 * nothing persisted. Without this check, the persist debounce's max-wait forces a
 * full-library stringify + SQLite write every few seconds for the entire duration of
 * playback; with a real library (100+ clips) each of those is a visible JS-thread
 * stall. All persisted slices update immutably, so a shallow reference compare of the
 * snapshot's fields is an exact "did anything persisted change" test.
 */
let lastScheduledSnapshot: Record<string, unknown> | null = null;

export function persistedSnapshotChanged(value: unknown): boolean {
    const nextState = (value as { state?: Record<string, unknown> } | null)?.state;
    if (!nextState || typeof nextState !== "object") return true;
    const previous = lastScheduledSnapshot;
    lastScheduledSnapshot = nextState;
    if (!previous) return true;
    for (const key of Object.keys(nextState)) {
        if (previous[key] !== nextState[key]) return true;
    }
    for (const key of Object.keys(previous)) {
        if (!(key in nextState)) return true;
    }
    return false;
}

/** Test hook — clears the memory of the last scheduled snapshot. */
export function resetPersistChangeDetection() {
    lastScheduledSnapshot = null;
}
