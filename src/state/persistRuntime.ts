/**
 * Runtime-only persistence guards. These values intentionally live outside
 * the zustand store so manifest syncing can observe hydration/persist state
 * without importing the store module and creating a require cycle.
 */

let hydrationComplete = false;
let lastPersistedIdeaCount = -1;
let persistBlocked = false;

/**
 * How this session's hydration read actually went. "data"/"empty" mean the
 * authoritative store was successfully read (and either held a library or was a
 * confirmed fresh install); "failed" means the read errored and the in-memory
 * state was NOT derived from disk — nothing derived from it may overwrite the
 * on-disk library. "none" is the pre-read default.
 */
export type HydrationReadOutcome = "none" | "data" | "empty" | "failed";

let hydrationReadOutcome: HydrationReadOutcome = "none";

export function getHydrationReadOutcome(): HydrationReadOutcome {
    return hydrationReadOutcome;
}

export function setHydrationReadOutcome(outcome: HydrationReadOutcome) {
    hydrationReadOutcome = outcome;
}

/** True when this session's in-memory state is trustworthy as "what disk held at boot". */
export function isHydrationReadAuthoritative() {
    return hydrationReadOutcome === "data" || hydrationReadOutcome === "empty";
}

export function isHydrationComplete() {
    return hydrationComplete;
}

export function setHydrationComplete(value: boolean) {
    hydrationComplete = value;
}

export function getLastPersistedIdeaCount() {
    return lastPersistedIdeaCount;
}

export function setLastPersistedIdeaCount(value: number) {
    lastPersistedIdeaCount = value;
}

export function isPersistBlocked() {
    return persistBlocked;
}

export function setPersistBlocked(value: boolean) {
    persistBlocked = value;
}

/**
 * Sustained write-failure signal. Every library write lands in SQLite or, degraded,
 * in AsyncStorage — but when BOTH stores refuse, the user is editing a library that
 * exists only in memory. That must never stay invisible (2026-08-26 audit F5): after
 * a few consecutive dual failures the app shows a persistent "can't save" banner,
 * cleared by the next write that lands anywhere durable.
 */
const PERSIST_FAILURE_THRESHOLD = 3;
let consecutivePersistWriteFailures = 0;
let persistFailing = false;
const persistFailingListeners = new Set<(failing: boolean) => void>();

function setPersistFailing(next: boolean) {
    if (persistFailing === next) return;
    persistFailing = next;
    [...persistFailingListeners].forEach((listener) => listener(next));
}

export function reportPersistWriteFailure() {
    consecutivePersistWriteFailures += 1;
    if (consecutivePersistWriteFailures >= PERSIST_FAILURE_THRESHOLD) {
        setPersistFailing(true);
    }
}

export function reportPersistWriteSuccess() {
    consecutivePersistWriteFailures = 0;
    setPersistFailing(false);
}

export function isPersistFailing() {
    return persistFailing;
}

/** Subscribe to the failing flag; the current value is replayed immediately. */
export function onPersistFailingChange(listener: (failing: boolean) => void): () => void {
    persistFailingListeners.add(listener);
    listener(persistFailing);
    return () => {
        persistFailingListeners.delete(listener);
    };
}

/**
 * Workspace ids the hydrate could NOT load (row corrupt — bytes quarantined — or
 * missing). Empty on a clean boot. App reads this after hydration to tell the user
 * a workspace was set aside instead of letting the library silently shrink.
 */
let hydrationDegradedWorkspaceIds: string[] = [];

export function getHydrationDegradedWorkspaceIds(): string[] {
    return hydrationDegradedWorkspaceIds;
}

export function setHydrationDegradedWorkspaceIds(ids: string[]) {
    hydrationDegradedWorkspaceIds = ids;
}
