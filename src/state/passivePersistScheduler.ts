import { runAfterInteractionsWithDeadline } from "../services/interactionGate";

export type PassiveWrite = () => unknown;

type SchedulerOptions = {
    /** Trailing debounce: a burst of set() calls coalesces into one write. */
    debounceMs: number;
    /** A continuous stream of set() calls can postpone the write at most this long. */
    maxWaitMs: number;
    /** Executes a write (owns error handling). */
    run: (write: PassiveWrite) => void;
    /** Defers the fired write past the gesture in flight. Injectable for tests. */
    gate?: (work: () => void) => void;
};

/**
 * The passive persist scheduler. zustand's persist middleware hands us a write on every
 * set(); each one serialises the whole library, so they are coalesced to a trailing
 * write, capped by a max wait, and — once the timer fires — deferred past any gesture in
 * flight (deadline-capped) so a scroll never hitches on the serialisation.
 *
 * Ordering invariant: a write STAYS pending until it actually runs. Its snapshot was
 * captured at set() time, so a direct flush built from newer state must still be able to
 * take it off (`take`), and a newer passive write scheduled meanwhile must replace it.
 * Whatever the gate finds when it fires is the latest — a stale snapshot can never land
 * after a newer one.
 */
export function createPassivePersistScheduler(options: SchedulerOptions) {
    const gate = options.gate ?? runAfterInteractionsWithDeadline;
    let pending: PassiveWrite | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let firstScheduledAt: number | null = null;

    /** Take the pending write off the timer without running it. */
    function take(): PassiveWrite | null {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        firstScheduledAt = null;
        const write = pending;
        pending = null;
        return write;
    }

    function schedule(write: PassiveWrite) {
        pending = write;
        const now = Date.now();
        if (firstScheduledAt == null) firstScheduledAt = now;
        if (timer) clearTimeout(timer);
        const maxWaitRemainingMs = Math.max(0, firstScheduledAt + options.maxWaitMs - now);
        timer = setTimeout(() => {
            timer = null;
            firstScheduledAt = null;
            gate(() => {
                const latest = take();
                if (latest) options.run(latest);
            });
        }, Math.min(options.debounceMs, maxWaitRemainingMs));
    }

    /** Run the pending write NOW, bypassing the gate (app leaving the foreground). */
    function flushNow() {
        const write = take();
        if (write) options.run(write);
    }

    function hasPending() {
        return pending != null;
    }

    return { schedule, take, flushNow, hasPending };
}
