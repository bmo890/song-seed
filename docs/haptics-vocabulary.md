# Haptics vocabulary — what fires where

The verbs live in `src/design/haptics.ts` (all gated by the Settings haptics toggle —
never call `expo-haptics` directly). Motion counterparts live in `src/design/motion.ts`.
This doc is the intent → verb map so intensity choices stay consistent as surfaces are
added. When adding a haptic, cite a row; when adding a row, justify why no existing verb fits.

| Verb | Feel (impl) | Intent | Canonical sites |
|---|---|---|---|
| `tap` | selection tick | Any acknowledged press: buttons, rows, tabs, toggles, chips, accordion open/close, **scrub begin/end** | Buttons, SegmentedControl, dock controls, metronome controls, reel scrub |
| `light` | light impact | Small state flips the user should *feel* land: favorite, chip select, **slider detent/step boundary**, pin added marker | Speed/pitch step boundaries, mute/solo flips |
| `grab` | medium impact | Picking something up / entering a heavier mode: drag lift, long-press into selection, record state changes, **sheet settles into a terminal position** | Record button, drag handles, PlayerSheet expand/collapse settle |
| `success` | success notification | A meaningful completion the user waited for: save landed, export finished, **in-tune lock on the tuner**, backup completed | Editor export/save, tuner in-tune entry, toast-worthy completions |
| `warning` | warning notification | About to do something destructive (confirm dialog opening), recording auto-stopped | Destructive AppAlert openings |
| `error` | error notification | Something failed | Failed saves/exports/imports |

Rules of thumb:
- **Terminal states, not motion**: gestures get a haptic when they *settle* (sheet lands,
  drag drops), never continuously during the drag.
- **Repeating ticks throttle at ≥80ms** and only during *manual* interaction (scrubbing),
  never during playback.
- **Once per transition**: state-entry haptics (tuner in-tune) debounce — fire on entering
  the state, re-arm only after leaving it for ~300ms.
- Every `success` on a background-completed action should pair with a Toast
  (`src/components/common/toastStore.ts`) rather than a dialog.
