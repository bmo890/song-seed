# Songstead QA Checklist — master index

**430 interaction flows** mapped from the codebase (not guessed), covering every screen
and its combinations, empty states, error paths, cancel paths, destructive-action confirms,
and navigation "where does back go" expectations. Built to replace bug-hunting-by-poking
with systematic, repeatable coverage — especially after code changes.

Read this order: skim the section files for your area, then check each flow. Every flow row
has an **Expected result** (what MUST happen) and an **automation designation**.

## Automation designations

| Tag | Meaning | Who runs it |
|---|---|---|
| **AUTO** (273) | Fully drivable by Maestro on iOS Sim **and** Android emulator — taps/swipes/text/assertions on visible UI; the expectation is verifiable without real audio/mic/files. | Claude, after any change. Owner re-checks on device. |
| **AUTO-A** (54) | Automatable on **Android only** (incl. physical Android via adb) — usually because iOS routes through system UI (share sheet, Files) that Maestro can't drive on Sim. | Claude on Android emulator; owner on iOS device. |
| **PARTIAL** (50) | Maestro drives the UI steps (catches crashes / UI regressions), but the **core truth** — audible audio, timing feel, haptics — needs a human ear/hand. | Claude runs the UI half; owner confirms the sensory half on device. |
| **HUMAN** (53) | Device-only truth: real mic / Bluetooth / phone-call interruption / lock-screen / background audio / share-from-another-app / Files app / storage pressure / haptics feel. | Owner, on a physical iPhone **and** Android device. |

**~273 of 430 flows are automatable today.** The Maestro suite in `.maestro/flows/` is the
growing home for those (3 flows live so far — see `.maestro/README.md`). The rest of the AUTO
flows are written and ready to encode as more Maestro flows over time; HUMAN/PARTIAL are your
device pass.

## Priorities

- **P1** — core promise (capture, playback) or data safety (backup/restore/import). Must never break.
- **P2** — important feature.
- **P3** — polish / edge case.

## Sections

| Area | Flows | AUTO | AUTO-A | PARTIAL | HUMAN |
|---|---|---|---|---|---|
| [Recording](flows/recording.md) | 64 | 40 | 3 | 8 | 13 |
| [Player · Dock · Practice](flows/player.md) | 61 | 41 | 4 | 12 | 4 |
| [Library & Navigation](flows/library-nav.md) | 84 | 68 | 3 | 7 | 6 |
| [Trim Editor](flows/editor.md) | 50 | 32 | 2 | 6 | 10 |
| [Lyrics & Word Tools](flows/lyrics-words.md) | 60 | 48 | 5 | 5 | 2 |
| [Backup · Restore · Import · Settings](flows/data-safety.md) | 60 | 20 | 32 | 4 | 4 |
| [App Shell & Misc](flows/shell-misc.md) | 51 | 24 | 5 | 8 | 14 |

## Running the automated flows

See [`.maestro/README.md`](../../.maestro/README.md). TL;DR: boot a sim/emulator with the
dev-client build, start Metro, then `maestro test .maestro/flows/`.

## How to use this after a code change

1. `npx tsc --noEmit && npx jest` (logic).
2. `maestro test .maestro/flows/` on the iOS Sim (interaction regressions Claude can catch).
3. Owner: walk the **P1 HUMAN/PARTIAL** rows on a real iPhone + Android device (the audio truths).
4. File any failure with its flow ID (e.g. "DS-04 fails on iOS").

> Found by this harness on its first run: **paywall CTA / Restore were dead-end taps on iOS**
> — `AppAlert` (a Modal) can't present over the paywall sheet (also a Modal), so the notice
> never showed. Fixed to render inline. Exactly the class of bug random poking misses.
