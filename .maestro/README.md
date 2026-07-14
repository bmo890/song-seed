# Maestro UI flow tests

Automated tap/swipe/assert flows that drive the real app on a simulator/emulator — the
"does this interaction actually work" layer above the Jest unit tests. Run these after
code changes to catch UI/navigation/interaction regressions before they reach a device.

## What runs here vs. on a device

`docs/qa/CHECKLIST.md` is the full flow inventory. Each flow is tagged:
- **AUTO** — a Maestro flow lives (or should live) here; runs on iOS Sim + Android emulator.
- **PARTIAL** — Maestro drives the UI (catches crashes/regressions) but the core truth
  (audible audio, mic capture, timing feel, haptics) needs a human ear/hand.
- **HUMAN** — device-only: real mic/Bluetooth/phone-call interruption/lock-screen/
  background audio/share-sheet-from-another-app/Files app/storage pressure/haptics.

## Prerequisites

1. A booted iOS simulator **or** Android emulator with the **dev-client** build installed.
2. **Metro running**: `npx expo start --dev-client --scheme songstead-dev --port 8081`
   (the dev client loads its JS bundle from Metro; a JS-only change just needs an app
   relaunch, not a rebuild).
3. `maestro` on PATH (`brew install mobile-dev-inc/tap/maestro`).

## Run

```bash
# all flows
maestro test .maestro/flows/

# one flow
maestro test .maestro/flows/03-paywall.yaml
```

Debug artifacts (screenshots + hierarchy) for a failure land in `~/.maestro/tests/<ts>/`.

## Selector gotchas (learned the hard way)

- Maestro matches **accessibility labels**, which on React Native often differ from the
  visible text. The drawer rows read as `", Lyrics Pad"`, the welcome Skip button is
  `"Skip the intro"`, etc. **Always use `.*substring.*` regexes**, and run
  `maestro hierarchy` (with the screen up) to see the real labels.
- The **dev-only LogBox "Open debugger to view warnings." banner** overlaps bottom-pinned
  UI (e.g. the drawer's Settings row) and reappears on every relaunch — flows dismiss it
  with a guarded `tapOn` at ~92%,93%. It does not exist in release builds.
- Add `waitForAnimationToEnd` after opening the drawer/a sheet before tapping inside it,
  or taps fire against stale coordinates mid-animation.
- The hamburger and other icon-only buttons have **no testID yet** — flows coordinate-tap
  them (8%,10%). Adding `testID`s to key controls would make flows far more robust; worth
  doing incrementally.
