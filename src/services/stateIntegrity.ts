let intentionalEmptyStateDeadlineMs = 0;

const INTENTIONAL_EMPTY_STATE_WINDOW_MS = 60_000;

/**
 * Legitimate last-item deletes are the one safe path that can take the store
 * from a healthy non-empty library to zero ideas. Persist and manifest guards
 * share this short-lived authorization so they still block accidental empty writes.
 */
export function authorizeIntentionalEmptyStateWrite(_steps = 4) {
    intentionalEmptyStateDeadlineMs = Date.now() + INTENTIONAL_EMPTY_STATE_WINDOW_MS;
}

export function consumeIntentionalEmptyStateWrite() {
    if (Date.now() > intentionalEmptyStateDeadlineMs) {
        intentionalEmptyStateDeadlineMs = 0;
        return false;
    }

    return intentionalEmptyStateDeadlineMs > 0;
}
