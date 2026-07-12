/**
 * First-run decisions — pure so they can be unit-tested without the store or the
 * app shell. The welcome intro, starter-library seeding, and the store-review
 * prompt all key off a couple of persisted fields plus a timestamp passed in.
 */

/** Milliseconds in a day, for the review-prompt maturity window. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Only seed a starter workspace on a genuinely fresh install: no live workspaces
 *  AND no recoverable backup (a manifest with items means "offer restore instead").
 *  Seeding over a recoverable backup would bury the user's real library. */
export function shouldSeedStarterLibrary(workspaceCount: number, manifestIdeaCount: number): boolean {
    return workspaceCount === 0 && manifestIdeaCount === 0;
}

export type ReviewPromptInputs = {
    /** Total saved clips across the library. */
    savedClipCount: number;
    /** Epoch of first launch (null before it's ever recorded → not yet eligible). */
    firstLaunchAt: number | null;
    /** Epoch the prompt was last shown (null if never). */
    reviewPromptShownAt: number | null;
    now: number;
};

/** Minimum saved clips before we'd ask — a positive-moment gate, not day one. */
export const REVIEW_MIN_SAVED_CLIPS = 10;
/** Minimum days since first launch, so we never ask a brand-new user. */
export const REVIEW_MIN_DAYS_SINCE_INSTALL = 5;
/** Don't re-request within this window even if the OS ignored the last ask. */
export const REVIEW_REASK_COOLDOWN_DAYS = 120;

/**
 * Whether to call StoreReview.requestReview() now. The OS ultimately decides
 * whether a dialog appears; this just gates WHEN we ask so it lands after a
 * positive moment (10th+ saved clip) and never for a fresh install or an error.
 */
export function shouldRequestReview({
    savedClipCount,
    firstLaunchAt,
    reviewPromptShownAt,
    now,
}: ReviewPromptInputs): boolean {
    if (savedClipCount < REVIEW_MIN_SAVED_CLIPS) return false;
    if (firstLaunchAt == null) return false;
    if (now - firstLaunchAt < REVIEW_MIN_DAYS_SINCE_INSTALL * DAY_MS) return false;
    if (
        reviewPromptShownAt != null &&
        now - reviewPromptShownAt < REVIEW_REASK_COOLDOWN_DAYS * DAY_MS
    ) {
        return false;
    }
    return true;
}
