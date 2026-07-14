import {
  resolveBrowseRootBackAction,
  type BrowseRootBackAction,
} from "../hooks/useBrowseRootBackHandler";

// Guards the fix for "back unexpectedly closes the app". The resolver decides
// what a back press does on a browse-root screen (Settings, Tuner, Metronome,
// Library, Activity, Browse, Revisit). The contract: it must NEVER resolve to an
// outcome that closes the app — every path either closes an open drawer, unwinds
// a screen sub-state, or delegates to React Navigation / the OS (which returns to
// the previous screen or backgrounds the app, but never hard-closes it).

describe("resolveBrowseRootBackAction", () => {
  it("closes an open drawer first, regardless of onBack", () => {
    expect(resolveBrowseRootBackAction({ drawerOpen: true, hasOnBack: false })).toBe(
      "close-drawer"
    );
    expect(resolveBrowseRootBackAction({ drawerOpen: true, hasOnBack: true })).toBe(
      "close-drawer"
    );
  });

  it("runs the screen's onBack sub-state handler when the drawer is closed", () => {
    expect(resolveBrowseRootBackAction({ drawerOpen: false, hasOnBack: true })).toBe(
      "run-on-back"
    );
  });

  it("delegates to the OS/navigator when there is nothing to intercept", () => {
    expect(resolveBrowseRootBackAction({ drawerOpen: false, hasOnBack: false })).toBe(
      "delegate"
    );
  });

  it("never resolves to closing the app for ANY input combination", () => {
    const allowed: BrowseRootBackAction[] = ["close-drawer", "run-on-back", "delegate"];
    for (const drawerOpen of [true, false]) {
      for (const hasOnBack of [true, false]) {
        const action = resolveBrowseRootBackAction({ drawerOpen, hasOnBack });
        expect(allowed).toContain(action);
        // The whole point of the fix: no input can produce an app-closing outcome.
        expect(action).not.toBe("exit-app");
      }
    }
  });
});
