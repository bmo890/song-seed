// The docked player sheet is a FULL-HEIGHT view whose top hides behind the media dock.
// When a selection toolbar appears it lifts the dock off the screen bottom — and the
// sheet cannot follow, because moving a full-height view up doesn't shorten it: its
// body still covers the toolbar, and its own header pokes out below the dock (that was
// the first attempted fix, and it looked worse). Hiding the docked sheet is the fix,
// and these pin the branches that make it safe.

import {
    shouldLiftDockAboveSelectionBar,
    shouldObscurePlayerSheet,
} from "../playerSheetVisibility";

const base = {
    activeRouteName: "Home",
    isDrawerOpen: false,
    selectionBarActive: false,
    expanded: false,
    inMotion: false,
};

describe("shouldObscurePlayerSheet", () => {
    it("docked with no toolbar: visible (it hides behind the dock and must be ready to drag)", () => {
        expect(shouldObscurePlayerSheet(base)).toBe(false);
    });

    it("docked + selection toolbar: HIDDEN — this is the bug, the sheet was covering the actions", () => {
        expect(shouldObscurePlayerSheet({ ...base, selectionBarActive: true })).toBe(true);
    });

    it("mid-drag from the dock with a toolbar up: VISIBLE — the swipe-up must not vanish", () => {
        // `expanded` only flips when the drag ENDS, so `inMotion` is the signal that
        // keeps the sheet on screen while the finger is pulling it up.
        expect(
            shouldObscurePlayerSheet({ ...base, selectionBarActive: true, inMotion: true })
        ).toBe(false);
    });

    it("expanded with a toolbar up: VISIBLE — the user is in the player, not the list", () => {
        expect(
            shouldObscurePlayerSheet({ ...base, selectionBarActive: true, expanded: true })
        ).toBe(false);
    });

    it("an obscuring route hides it even while expanded and mid-motion", () => {
        expect(
            shouldObscurePlayerSheet({
                ...base,
                activeRouteName: "Recording",
                expanded: true,
                inMotion: true,
            })
        ).toBe(true);
    });

    it("the drawer hides it", () => {
        expect(shouldObscurePlayerSheet({ ...base, isDrawerOpen: true, expanded: true })).toBe(true);
    });
});

// The media dock lifts above a selection toolbar so both are visible. But it must drop
// back the moment the sheet starts rising: the sheet covers the toolbar itself, and a
// lifted dock would hang mid-screen with sheet visible below it — a terracotta band
// painted straight across the player's reel.
describe("shouldLiftDockAboveSelectionBar", () => {
    const docked = { selectionDockHeight: 120, sheetInMotion: false, sheetExpanded: false };

    it("no toolbar: the dock hugs the bottom", () => {
        expect(shouldLiftDockAboveSelectionBar({ ...docked, selectionDockHeight: 0 })).toBe(false);
    });

    it("toolbar up, sheet docked: LIFT — both stay visible", () => {
        expect(shouldLiftDockAboveSelectionBar(docked)).toBe(true);
    });

    it("sheet rising: do NOT lift — otherwise the dock cuts the rising reel in half", () => {
        expect(shouldLiftDockAboveSelectionBar({ ...docked, sheetInMotion: true })).toBe(false);
    });

    it("sheet expanded: do NOT lift", () => {
        expect(shouldLiftDockAboveSelectionBar({ ...docked, sheetExpanded: true })).toBe(false);
    });
});
