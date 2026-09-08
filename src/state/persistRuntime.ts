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
 * Persistence health, as the user must see it. Every library write lands in SQLite
 * or, degraded, in AsyncStorage — and when BOTH refuse, or a safety gate refuses the
 * write outright, the user is editing a library that exists only in memory. None of
 * that may stay invisible (2026-08-26 audit F5; 2026-09-07 field report — a session
 * whose writes silently stopped landing lost a take, its title, and its sketch):
 *
 * - "failing":  several consecutive writes landed nowhere (banner: can't save)
 * - "degraded": several consecutive writes landed only in the AsyncStorage fallback
 *               (banner: saving in backup mode — replayed into SQLite when it recovers)
 * - "blocked":  a gate refuses every write for the rest of the session (guard lock,
 *               write-authority refusal) — banner: saving is paused, back up + restart
 *
 * Failing/degraded clear on the next write that lands in SQLite; blocked is sticky.
 */
export type PersistHealth = "ok" | "degraded" | "failing" | "blocked";

const PERSIST_FAILURE_THRESHOLD = 3;
let consecutivePersistWriteFailures = 0;
let consecutivePersistWriteFallbacks = 0;
let persistFailing = false;
let persistDegraded = false;
let persistBlockedReason: string | null = null;
const persistHealthListeners = new Set<(health: PersistHealth) => void>();
let lastNotifiedHealth: PersistHealth = "ok";

export function getPersistHealth(): PersistHealth {
    if (persistBlockedReason) return "blocked";
    if (persistFailing) return "failing";
    if (persistDegraded) return "degraded";
    return "ok";
}

function notifyPersistHealth() {
    const next = getPersistHealth();
    if (next === lastNotifiedHealth) return;
    lastNotifiedHealth = next;
    [...persistHealthListeners].forEach((listener) => listener(next));
}

/** Both stores refused the write. */
export function reportPersistWriteFailure() {
    consecutivePersistWriteFailures += 1;
    if (consecutivePersistWriteFailures >= PERSIST_FAILURE_THRESHOLD) {
        persistFailing = true;
    }
    notifyPersistHealth();
}

/** SQLite refused; the write landed only in the AsyncStorage fallback. */
export function reportPersistWriteFallback() {
    consecutivePersistWriteFailures = 0;
    persistFailing = false;
    consecutivePersistWriteFallbacks += 1;
    if (consecutivePersistWriteFallbacks >= PERSIST_FAILURE_THRESHOLD) {
        persistDegraded = true;
    }
    notifyPersistHealth();
}

/** The write landed in SQLite. */
export function reportPersistWriteSuccess() {
    consecutivePersistWriteFailures = 0;
    consecutivePersistWriteFallbacks = 0;
    persistFailing = false;
    persistDegraded = false;
    notifyPersistHealth();
}

/** A gate is refusing every write for the rest of the session. Sticky. */
export function reportPersistBlocked(reason: string) {
    persistBlockedReason = reason;
    notifyPersistHealth();
}

/** Only the deliberate unblock paths (restore prompt answered, wipe) clear it. */
export function clearPersistBlockedSignal() {
    persistBlockedReason = null;
    notifyPersistHealth();
}

export function isPersistFailing() {
    return persistFailing;
}

/** Subscribe to the failing flag; the current value is replayed immediately. */
export function onPersistFailingChange(listener: (failing: boolean) => void): () => void {
    return onPersistHealthChange((health) => listener(health === "failing"));
}

/** Subscribe to the health signal; the current value is replayed immediately. */
export function onPersistHealthChange(listener: (health: PersistHealth) => void): () => void {
    persistHealthListeners.add(listener);
    listener(getPersistHealth());
    return () => {
        persistHealthListeners.delete(listener);
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
