/**
 * Runtime-only persistence guards. These values intentionally live outside
 * the zustand store so manifest syncing can observe hydration/persist state
 * without importing the store module and creating a require cycle.
 */

let hydrationComplete = false;
let lastPersistedIdeaCount = -1;
let persistBlocked = false;

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
