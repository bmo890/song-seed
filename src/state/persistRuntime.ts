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
