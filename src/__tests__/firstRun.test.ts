import {
    REVIEW_MIN_DAYS_SINCE_INSTALL,
    REVIEW_MIN_SAVED_CLIPS,
    REVIEW_REASK_COOLDOWN_DAYS,
    shouldRequestReview,
    shouldSeedStarterLibrary,
} from "../firstRun";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("shouldSeedStarterLibrary", () => {
    it("seeds only when there are no workspaces AND no recoverable backup", () => {
        expect(shouldSeedStarterLibrary(0, 0)).toBe(true);
    });

    it("does NOT seed when a backup with items exists (offer restore instead)", () => {
        expect(shouldSeedStarterLibrary(0, 12)).toBe(false);
    });

    it("does NOT seed when a workspace already exists (even if empty)", () => {
        expect(shouldSeedStarterLibrary(1, 0)).toBe(false);
        expect(shouldSeedStarterLibrary(3, 5)).toBe(false);
    });
});

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
