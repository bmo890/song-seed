import {
    REVIEW_MIN_DAYS_SINCE_INSTALL,
    REVIEW_MIN_SAVED_CLIPS,
    REVIEW_REASK_COOLDOWN_DAYS,
    shouldRequestReview,
} from "../firstRun";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("shouldRequestReview", () => {
    const base = {
        savedClipCount: REVIEW_MIN_SAVED_CLIPS,
        firstLaunchAt: NOW - (REVIEW_MIN_DAYS_SINCE_INSTALL + 1) * DAY,
        reviewPromptShownAt: null,
        now: NOW,
    };

    it("asks after enough clips + enough days, never asked before", () => {
        expect(shouldRequestReview(base)).toBe(true);
    });

    it("does not ask below the saved-clip threshold", () => {
        expect(shouldRequestReview({ ...base, savedClipCount: REVIEW_MIN_SAVED_CLIPS - 1 })).toBe(false);
    });

    it("does not ask a brand-new install (under the day threshold)", () => {
        expect(
            shouldRequestReview({ ...base, firstLaunchAt: NOW - (REVIEW_MIN_DAYS_SINCE_INSTALL - 1) * DAY })
        ).toBe(false);
    });

    it("does not ask before firstLaunchAt is recorded", () => {
        expect(shouldRequestReview({ ...base, firstLaunchAt: null })).toBe(false);
    });

    it("does not re-ask within the cooldown window", () => {
        expect(
            shouldRequestReview({ ...base, reviewPromptShownAt: NOW - (REVIEW_REASK_COOLDOWN_DAYS - 1) * DAY })
        ).toBe(false);
    });

    it("asks again after the cooldown window passes", () => {
        expect(
            shouldRequestReview({ ...base, reviewPromptShownAt: NOW - (REVIEW_REASK_COOLDOWN_DAYS + 1) * DAY })
        ).toBe(true);
    });
});
