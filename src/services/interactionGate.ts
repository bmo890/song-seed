/**
 * Run background JS work once the user has stopped touching the screen — but
 * never later than `deadlineMs`. Serialising a workspace shard, flushing waveform
 * hydration, or writing the manifest mid-scroll is what turned a smooth drag into a
 * hitch; deferring it a moment costs nothing. The deadline keeps the durability
 * story: a scroll that never ends cannot postpone a write indefinitely.
 *
 * The gate is app-owned. React Native's `InteractionManager` is a stub on this
 * version (its `runAfterInteractions` is `setImmediate`, and even the legacy manager
 * never saw native scrolls, gesture-handler gestures or screen transitions), so the
 * surfaces that matter report their own activity here: list drags and momentum,
 * navigator transitions, and the player sheet's motion. Activity ends with a short
 * tail so a flick followed by another flick reads as one busy stretch.
 */
const ACTIVITY_TAIL_MS = 250;
const POLL_MS = 100;

const activeKinds = new Map<string, number>();
let busyUntil = 0;

/** A continuous interaction has started (a drag, a transition, a sheet in motion). */
export function beginUiActivity(kind: string): void {
    activeKinds.set(kind, (activeKinds.get(kind) ?? 0) + 1);
}

/** The matching end; the gate stays closed for a short tail afterwards. */
export function endUiActivity(kind: string, tailMs: number = ACTIVITY_TAIL_MS): void {
    const remaining = (activeKinds.get(kind) ?? 1) - 1;
    if (remaining <= 0) activeKinds.delete(kind);
    else activeKinds.set(kind, remaining);
    busyUntil = Math.max(busyUntil, Date.now() + tailMs);
}

/** A momentary interaction (a tap that animates something) — busy for the tail only. */
export function noteUiActivity(tailMs: number = ACTIVITY_TAIL_MS): void {
    busyUntil = Math.max(busyUntil, Date.now() + tailMs);
}

export function isUiBusy(now: number = Date.now()): boolean {
    return activeKinds.size > 0 || now < busyUntil;
}

export function runAfterInteractionsWithDeadline(work: () => void, deadlineMs = 2000): void {
    const startedAt = Date.now();
    let done = false;
    const runOnce = () => {
        if (done) return;
        done = true;
        work();
    };
    const check = () => {
        if (done) return;
        const now = Date.now();
        if (!isUiBusy(now) || now - startedAt >= deadlineMs) {
            runOnce();
            return;
        }
        setTimeout(check, Math.min(POLL_MS, Math.max(0, startedAt + deadlineMs - now)));
    };
    // Always asynchronous, so a caller inside a store notification never runs the
    // work re-entrantly.
    setTimeout(check, 0);
}

/** Promise form for async pipelines (waveform hydration). */
export function waitForIdleInteractions(deadlineMs = 2000): Promise<void> {
    return new Promise((resolve) => runAfterInteractionsWithDeadline(resolve, deadlineMs));
}

/** Test hook: forget every activity. */
export function resetUiActivityForTests(): void {
    activeKinds.clear();
    busyUntil = 0;
}
