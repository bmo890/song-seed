let intentionalEmptyStateDeadlineMs = 0;
let intentionalEmptyStateRemaining = 0;

const INTENTIONAL_EMPTY_STATE_WINDOW_MS = 60_000;

/**
 * Legitimate bulk deletes (and a deliberate last-item delete) are the one safe path
 * that can take the store from a healthy library to a much smaller or empty one.
 * Persist and manifest guards share this short-lived authorization so they still
 * block accidental drops. `steps` is how many guarded writes the grant covers — the
 * persist guard and the manifest mirror each consume one — inside the window; the
 * window alone used to be the grant and consuming never consumed (2026-10-22 sweep).
 */
export function authorizeIntentionalEmptyStateWrite(steps = 4) {
    intentionalEmptyStateDeadlineMs = Date.now() + INTENTIONAL_EMPTY_STATE_WINDOW_MS;
    intentionalEmptyStateRemaining = Math.max(0, Math.floor(steps));
}

export function consumeIntentionalEmptyStateWrite() {
    if (Date.now() > intentionalEmptyStateDeadlineMs) {
        intentionalEmptyStateDeadlineMs = 0;
        intentionalEmptyStateRemaining = 0;
        return false;
    }
    if (intentionalEmptyStateRemaining <= 0) return false;
    intentionalEmptyStateRemaining -= 1;
    return true;
}
