/**
 * One ordered line for every library write, end to end (audit 2026-11-02, 01-M1).
 *
 * The SQLite queue in db/storage.ts serializes commits, but a sharded write plans before
 * it commits, and its first write of a session awaits disk reads (authority check,
 * orphan listing) before it plans. A later write — a take's durable flush, or a
 * restore's raw commit — could enqueue its commit first, and the older snapshot then
 * landed over the newer one. Every top-level writer (the sharded adapter's write and
 * the raw snapshot commit) runs its whole plan → commit inside this chain, so commits
 * land in the order the writes were asked for.
 *
 * Only top-level writers enter the chain: work inside it must never enter it again.
 */

/** A writer that never settles must not wedge persistence for the session. */
const ORDERED_WRITE_DEADLINE_MS = 45_000;

let chain: Promise<unknown> = Promise.resolve();

function withDeadline<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error(`ordered persist write did not settle within ${ORDERED_WRITE_DEADLINE_MS}ms`)),
            ORDERED_WRITE_DEADLINE_MS
        );
    });
    return Promise.race([work, deadline]).finally(() => {
        if (timer) clearTimeout(timer);
    }) as Promise<T>;
}

export function runInPersistOrder<T>(work: () => Promise<T>): Promise<T> {
    const run = () => withDeadline(work());
    const result = chain.then(run, run);
    chain = result.catch(() => undefined);
    return result;
}

/** Resolves once every ordered write asked for so far has settled. */
export function waitForPersistOrderIdle(): Promise<void> {
    return chain.then(
        () => undefined,
        () => undefined
    );
}
