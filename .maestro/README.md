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
2. **Metro running**: `npx expo start --dev-client --scheme songnook-dev --port 8081`
   (the dev client loads its JS bundle from Metro; a JS-only change just needs an app
   relaunch, not a rebuild).
3. `maestro` on PATH (`brew install mobile-dev-inc/tap/maestro`).

## Run

```bash
# all flows that keep the library (the normal run)
maestro test --exclude-tags clears-state .maestro/flows/

# one flow
maestro test .maestro/flows/03-paywall.yaml

# the clip-interaction suite (needs Documents/dev-samples — see clip-flows/README.md)
maestro test .maestro/clip-flows/
```

**Why `--exclude-tags clears-state`:** `01-first-run-welcome` launches with
`clearState: true`, which wipes the app's data container (the whole library, the
dev samples) and moves it to a new UUID. The simulator usually carries a large test
library that other work depends on, so that flow is tagged `clears-state` and left
out of the normal run. Run it only on a throwaway simulator, on purpose. Every other
flow launches with `stopApp: true` and cleans up after itself (it creates its own
"Maestro …" sketches/pages/collections/workspaces and deletes them), so the suite is
safe on a real library. A flow that aborts midway can leave its "Maestro …" item
behind; the next run of that flow may then see two matches — delete the leftover.

Debug artifacts (screenshots + hierarchy) for a failure land in `~/.maestro/tests/<ts>/`.

## Shared subflows (`.maestro/subflows/`)

| Subflow | Purpose |
|---|---|
| open-library | cold-launch → dismiss backup dialog + LogBox → wait for the library |
| open-ideas | open-library, then drawer → Collections → the primary "Ideas" collection |
| dismiss-logbox | dismiss the dev LogBox banner (call before any bottom-anchored tap) |
| new-sketch | collection "…" → New sketch → name `${TITLE}` → save → back to the list |
| delete-idea | long-press `${TITLE}` → selection Delete → confirm → gone |
| delete-collection | Collections page → delete `collection-card-${SLUG}` (no-op if absent) |
| clip-* | the clip suite's scratch-collection setup/cleanup (see clip-flows/README.md) |

On a collection screen use `collection-search` as the landmark: the sketch page also
carries `fab-record`, so that id no longer proves you're back on a list.

## Selector gotchas (learned the hard way)

- Maestro matches **accessibility labels**, which on React Native often differ from the
  visible text. The drawer rows read as `", Lyric Pad"`, the welcome Skip button is
  `"Skip the intro"`, etc. **Always use `.*substring.*` regexes**, and run
  `maestro hierarchy` (with the screen up) to see the real labels.
- The **dev-only LogBox "Open debugger to view warnings." banner** overlaps bottom-pinned
  UI (e.g. the drawer's Settings row) and reappears on every relaunch — flows dismiss it
  with a guarded `tapOn` at ~92%,93%. It does not exist in release builds.
- Add `waitForAnimationToEnd` after opening the drawer/a sheet before tapping inside it,
  or taps fire against stale coordinates mid-animation.
- Prefer testIDs: `header-menu` (hamburger), `nav-row-<label>` (drawer places),
  `nav-tool-<route>` (Lyric Spark / Tuner / Metronome in the tool tray), `nav-collections`
  (the drawer's "Collections · n" door), `settings-card-<title-slug>` (Settings rows),
  `collection-card-<title-slug>`, `transport-play` / `transport-close` (the player's
  footer — the scrim and grabber are also labelled "Close player", and cards behind the
  sheet are also labelled "Play", so text taps mis-target there).
- Maestro's `text:` matcher also matches accessibility labels, and `selected: true` reads
  `accessibilityState.selected` (ink tabs, the stage row) — use it to assert which
  option is chosen.
