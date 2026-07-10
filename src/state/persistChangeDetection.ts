/**
 * Zustand's persist middleware (and any other whole-store subscriber, like the
 * manifest sync) reacts to EVERY set() — including pure playback ticks (player
 * position flowing into the store several times a second), which change nothing
 * persisted. Without this check, those consumers either do a full-library
 * stringify + disk write on a cadence (persist max-wait) or have their trailing
 * debounce reset forever and STARVE (manifest). All persisted slices update
 * immutably, so a shallow reference compare of the snapshot's fields is an exact
 * "did anything persisted change" test.
 *
 * Each consumer needs its own detector instance — they observe independently.
 */
export type SnapshotChangeDetector = (value: unknown) => boolean;

export function createSnapshotChangeDetector(): SnapshotChangeDetector {
    let lastSnapshot: Record<string, unknown> | null = null;

    return (value: unknown): boolean => {
        const nextState = (value as { state?: Record<string, unknown> } | null)?.state;
        if (!nextState || typeof nextState !== "object") return true;
        const previous = lastSnapshot;
        lastSnapshot = nextState;
        if (!previous) return true;
        for (const key of Object.keys(nextState)) {
            if (previous[key] !== nextState[key]) return true;
        }
        for (const key of Object.keys(previous)) {
            if (!(key in nextState)) return true;
        }
        return false;
    };
}

// The persist middleware's own detector (one persist pipeline per app).
let persistDetector = createSnapshotChangeDetector();

export function persistedSnapshotChanged(value: unknown): boolean {
    return persistDetector(value);
}

/** Test hook — clears the memory of the last scheduled snapshot. */
export function resetPersistChangeDetection() {
    persistDetector = createSnapshotChangeDetector();
}
