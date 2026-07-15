// The dock's position and every list's footer spacer derive from these two helpers.
// They're pinned because the failure is silent and user-visible in both directions:
// too small and the last clip hides behind the record button; too large and the user
// scrolls through half a screen of nothing (which is what shipped — a flat 152px
// "scroll past" pad, plus a selection-bar height counted twice).

import {
    getFloatingActionDockBottomOffset,
    getFloatingActionDockContentClearance,
} from "../floatingActionDockLayout";

const RECORD_BUTTON = 62;
const GAP = 24;
const BASE = 12;

describe("getFloatingActionDockBottomOffset", () => {
    it("uses the safe-area inset when nothing else floats", () => {
        expect(getFloatingActionDockBottomOffset(34)).toBe(BASE + 34);
    });

    it("enforces a minimum safe area on devices that report none", () => {
        expect(getFloatingActionDockBottomOffset(0)).toBe(BASE + 16);
    });

    it("rides above the media dock WITHOUT re-adding the safe area — the dock already covers it", () => {
        // Not BASE + inset + dock: that double-count floated the buttons visibly too high.
        expect(getFloatingActionDockBottomOffset(34, { playerDockHeight: 80 })).toBe(80 + BASE);
    });

    it("stacks the import bar on top of whatever the base is", () => {
        expect(getFloatingActionDockBottomOffset(34, { importBannerHeight: 40 })).toBe(BASE + 34 + 40);
        expect(getFloatingActionDockBottomOffset(34, { playerDockHeight: 80, importBannerHeight: 40 })).toBe(
            80 + BASE + 40
        );
    });
});

describe("getFloatingActionDockContentClearance", () => {
    it("is exactly enough to clear the record button plus one gap — no more", () => {
        expect(getFloatingActionDockContentClearance(34)).toBe(BASE + 34 + RECORD_BUTTON + GAP);
    });

    it("tracks the docks, so space is reserved only while they're actually on screen", () => {
        const idle = getFloatingActionDockContentClearance(34);
        const withDock = getFloatingActionDockContentClearance(34, { playerDockHeight: 80 });
        expect(withDock).toBeGreaterThan(idle);
        expect(withDock).toBe(80 + BASE + RECORD_BUTTON + GAP);
    });

    it("stays under ~200px on a typical phone — the regression guard for dead scroll space", () => {
        // The old normal-mode footer came to ~300px (this + 152 + 18) on a 34pt inset:
        // roughly a third of a screen of empty scrolling below the last clip.
        expect(getFloatingActionDockContentClearance(34)).toBeLessThan(200);
    });
});
