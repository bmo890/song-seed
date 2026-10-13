# Craft pass: the control kit (started 2026-10-13)

The founder's observation: next to rivals the app does not feel premium.
Not a call for motion or sleek chrome. Certain controls look like basic
components and feel thrown together. "A simple JS app by an indie dev rather
than a quiet place to finish work." Past facelifts helped and did not hold.

This document is the handoff. It is written so a different model can pick
the work up cold. Read it top to bottom before touching anything.

## Handoff rules (read first)

- Branch: `craft/control-kit`, off `main`. Every change on this branch, one
  commit per change, pushed. Do not merge to `main` without the founder's yes.
- Publishing: preview android only, from the branch, when the founder wants
  to feel something on the phone:
  `eas update --channel preview --platform android -m "<msg>" --non-interactive`
  Never `--platform all`. Never production from this branch. Production is
  `main` only and needs the founder's explicit yes.
- CLAUDE.md applies in full: tokens only, `t()` for every string EN + HE,
  haptics only via `src/design/haptics.ts` with the vocabulary row cited in a
  comment, motion only via `src/design/motion.ts`, copy budgets, canon
  components, `npx tsc --noEmit` and `npx jest` green, UI verified in the iOS
  simulator with screenshots.
- ON MAIN AND PRODUCTION (2026-10-13, founder: "get everything on to
  remote/production so I can check"): `craft/control-kit` was fast-forwarded
  into `main` at 9eb36867 and published to production android 0f4c48aa,
  production ios c604bac7, preview android 560f3ac4, preview ios 1e7ebce1.
  `main`, `craft/control-kit` and `preview/craft-plus-send` are the same
  commit. Further craft work: branch from main (or keep using
  `craft/control-kit`), and keep `preview/craft-plus-send` equal to whatever
  is published to preview, because a remote session publishes from it. Every
  fix still goes to production android + production ios + preview android,
  one platform per command. The Send worker is deployed with
  `npx wrangler deploy --config wrangler.toml` from `server/songnook-send`
  (never without `--config`); skip it when `git diff <last deployed commit>
  -- server` is empty (last deployed: 64464c4c, version 84f48e29).
- Send's sheet (`SendLinkSheet.tsx`) is on Press and Spinner. Three menu rows
  that arrived with Send (`SongHeaderMenu`, `CollectionHeaderMenu`,
  `ReceivedScreen`) copy their unconverted neighbours and wait for the hand
  pass with them; the baseline rose by exactly those three (pressable_raw
  422 to 425, press_adhoc 250 to 253).
- Do not touch: recording while backgrounded (`useRecording`), the reel
  (`PlaybackTapeVisualizer`, `AudioReel` internals), the practice loop and
  step-up engines, the background CPU work. The reel's loop handles are the
  LAST migration target, after everything else has settled.
- Commit attribution line: `Co-Authored-By: <model name> <noreply@anthropic.com>`
  as the system reminder in the session states it.

## The bar, in the founder's words

Minimalist and intuitive. Calm and beautiful. Smooth like Apple Voice Memos.
Haptics that match the interaction. Quick small interaction animations. Not
wordy, not busy, not over-explaining: the app does not talk.

Reference apps and what each contributes:

| App | Contributes |
|---|---|
| Apple Voice Memos | The reel feel. Waveform as interface, scrub inertia, no chrome, no layout shift. |
| Flighty | Information hierarchy. Dense data, one reading order, tabular numerals, colour once per screen. |
| Things 3 | Interaction choreography. Every gesture has a short specific animation and a matching haptic. Nothing bounces. |
| Halide | Physical controls. Dials with haptic detents at each stop. The model for loop edges, nudges, sliders, the tempo wheel. |

As checkable standards:

| Founder's words | Per control |
|---|---|
| Smooth | No layout shift on state change. Drags track the finger in the same frame. Lists never jump. |
| Haptics match | A tick at every discrete boundary. Nothing on continuous motion. |
| Quick small animations | Under 200 ms. Fade or a slide of 6 px or less. Thumbs slide, counts tick, nothing bounces. |
| Minimalist, intuitive | One primary action per screen. Icons only where unambiguous. Controls look like what they do. |
| Calm, beautiful | Hairlines and tonal layers instead of borders. Shared baselines. Scarce colour. |

## Why it feels thrown together (measured 2026-10-13, `src/`)

| Rule | Measured |
|---|---|
| Haptics only via `haptics.ts` | Held. Direct `expo-haptics` only in `haptics.ts` and `useMetronome.ts` (allowed). |
| A haptic where things are tapped | 109 of 166 files with a Pressable. 57 have none. |
| One press language | 45 of 166 tappable files skip `pressDown`. `IconButton` has its own dip. The practice panel header has another. Three languages. |
| Motion only via `motion.ts` | 24 duration literals in 15 files, 16 inline springs. `{ damping: 20, stiffness: 300 }` pasted eight times. |
| Colours only from tokens | 794 hex literals, almost all in `src/styles/*` (legacy palette, a second source of truth). |
| No stock RN widgets | Community `Slider` in 9 files. Stock `Switch` in 4. `ActivityIndicator` in 14. |

Reading: the vocabulary is respected where used, used in two thirds of
places, and nothing stops a screen from making its own small decisions.
Facelifts repaint the result. The cause stays.

## The method, four moves

1. **The kit.** A finite list of controls, each built once with every state.
2. **Migrate by grep.** Replace every stock widget, bespoke pressed style and
   inline spring with the kit. Done when the greps read zero.
3. **Guardrails.** Lint rules that fail the build when the kit is bypassed.
   This is the part no facelift had.
4. **Compose.** One short layout grammar, then a pass per screen, before and
   after, founder judges.

A states sheet in Claude Design (every control, every state, one artboard,
drawn from the real tokens) is the reference for moves 1 and 4. Draw it
after Switch and Stepper exist so it does not drift from code on day one.

## Move 1: the kit

Location: `src/components/common/`. One file per control. Each file's
header comment says what it replaces and cites its haptic rows.

### Built

| Control | File | Commit | Notes |
|---|---|---|---|
| `Slider` | `Slider.tsx` | 90070b47, 0fe3a723, 8ed5d021 | Drawn hairline track (`borderMuted`, reads on the wash) and 18 pt paper thumb with `shadows.control`. RNGH pan, manual activation on touch-down, UI-thread value. Thumb to 1.2× on grab with `springs.handle`, border to `primary`. Props: `value min max step detent fill inverted disabled`. Haptics: `grab` on land, `tick` per `detent` crossed, `light` on lift. |
| `Press` | `Press.tsx` | 90070b47 | The one press language. `feel="surface"` dips 1.5% at opacity 0.9; `feel="glyph"` dims to 0.5 and dips to 0.9. Owns the `tap` (`haptic` prop: tap, light, grab, none). Disabled = opacity 0.35. |
| `haptic.tick` | `src/design/haptics.ts` | 8ed5d021 | New verb: a detent crossed mid-gesture. Selection on iOS, light impact on Android (selection is too faint under a moving thumb there; founder felt lift and release but not the drag). |

First room using both: `MarkInspector.tsx` (edge chips, nudge carets,
use-playhead, neighbour snap). The drawers' own `haptic.tap()` in `onNudge`,
`onUsePlayhead`, `onUseNeighbor` were removed so the control owns the tick.

Founder verdict on the register (2026-10-13): "Feels good."

| Control | File | Commit | Notes |
|---|---|---|---|
| `Switch` | `Switch.tsx` | 11fa41c9 | 46×28 shell, 22 pt paper knob (same as the Slider thumb). Knob and shell animate over `durations.base` from a `useDerivedValue` of the prop. `tone="danger"` for a destructive toggle. Haptic: `light` on flip, owned here. Replaced the stock Switch in `SourceFilterRow`, `EditorSaveSheet`, `RevisitCustomizeSheet`, `RecordingMetronomeSheet` and the hand-made `switchShell` on the loop, step-up, click and click-haptic rows. `useStepUpLoop.toggleStepUp` no longer fires its own tap. |
| `Stepper` | `Stepper.tsx` | 11fa41c9 | Two 28 pt round keys on `surface`, `children` rendered between them (the slider). `tick` per step, hold repeats every 110 ms after 400 ms, a key at its bound is disabled. `glyphs="chevrons"` (time, never mirrored) or `"plusMinus"` (value). In `MarkInspector` around the Slider. |
| `Press feel="still"` | `Press.tsx` | 11fa41c9 | No dip, for a control that animates its own state (the Switch). |

The hand-made `switchShell`/`switchKnob` styles in `PlayerScreen/styles.ts`
are now unreferenced and can be deleted.

| Control | File | Notes |
|---|---|---|
| `InkOption` | `InkOption.tsx` | Editorial ink: a word led by a dot, hollow to terracotta. Built 2026-10-13 for the player's "Marks" toggle. `Press`, `light` on flip. Migration list is in "Under the reel". |

### To build, in order

| Control | Replaces | Spec |
|---|---|---|
| `Chip` | `edgeChip` (MarkInspector), `toolChip` (practice primitives, Magpie, chord picker). One chip with `active`. | Height 34, `radii.lg`. On the page: active = `primarySurface` fill + `primaryDeep` text. On the terracotta wash: active = `surface`, idle = translucent. Never a border. Uses `Press`. This one changes how things look, so build it in one room and show the founder before migrating. |
| `Row` | `pd.row`, `toolBodyRow`, settings rows. Label · value · control. | Min height 46, horizontal 10 inside cards and 16 on pages, hairline below, never a border. Label `text.body` semibold, value `text.supporting` tabular. |
| `Spinner` | `ActivityIndicator` (14 files, 20 uses). | A hairline arc in `primary` rotating at `durations.slow`; or, where progress is known, a thin bar. Never the platform spinner. |

DONE: `IconButton` is a `Press feel="glyph"` (6da03d6c). Its 26 users share
the one press language with no visual change.

Existing canon that stays: `SegmentedControl`, `Button`, `IdeaCard`,
`SurfaceCard`, `BottomSheet`, `AppDialog`, `EmptyState`, `ToastHost`.

## Move 2: migrate by grep

Each line below is one or more commits. Run the grep, fix the files, run the
grep again. The move is done when every grep prints nothing.

```bash
# stock widgets
grep -rl "react-native-community/slider" src --include='*.tsx' --include='*.ts' | grep -v __tests__
grep -rl "<Switch" src --include='*.tsx' | grep -v __tests__
grep -rl "<ActivityIndicator" src --include='*.tsx' | grep -v __tests__

# press languages
grep -rl "styles.pressDown\|appStyles.pressDown\|pressDownStrong" src --include='*.tsx'
grep -rn "pressed ? 0\.\|pressed && .*opacity" src --include='*.tsx'
grep -rlE "<(Pressable|TouchableOpacity)" src --include='*.tsx'   # becomes Press, except gesture hosts

# motion literals
grep -rnE "duration: ?[0-9]{2,4}\b" src --include='*.ts' --include='*.tsx' | grep -v "design/motion.ts" | grep -vE "durationMs|__tests__"
grep -rnE "with(Timing|Spring)\([^)]*\{ ?(duration|damping|stiffness): ?[0-9]" src --include='*.ts' --include='*.tsx' | grep -v "design/motion.ts"

# fonts
for f in $(grep -rl "fontWeight" src --include='*.ts' --include='*.tsx'); do grep -q fontFamily "$f" || echo "$f"; done

# colours (slow lane; retire src/styles/* file by file)
grep -rnoE "\"#[0-9a-fA-F]{3,8}\"" src --include='*.ts' --include='*.tsx' | grep -vE "design/tokens.ts|domain/workspaceTheme.ts|__tests__|i18n/" | cut -d: -f1 | sort | uniq -c | sort -rn
```

### The Press codemod (safe lane, run 2026-10-13)

`scripts/craft-codemod-press.py` converts a file only when EVERY `<Pressable>`
in it uses the shared `pressDown` style and none has a `disabled` attribute.
`Press feel="surface"` is exactly `pressDown`, so the look does not change.
Behaviour is preserved too: a leading `haptic.tap();` is dropped in favour of
Press's own tap; every other converted press gets `haptic="none"`.

First run: 88 presses in 54 files. Re-running prints 0, so it is idempotent.
It will pick up more files as hand edits make them uniform.

`haptic="none"` is now a lint count (`press_haptic_none`, 82). Each is a
press owed a decision: `tap`, `light`, or silent because it navigates
(CLAUDE.md: navigation is silent). Burn that count down by hand, a screen
at a time. Do not bulk-replace it.

What the codemod will NOT touch, and why (the hand pass, 422 raw Pressables):
- files where some Pressable has its own pressed style (`toolHeaderPressed`,
  an opacity literal, `overflowButtonPressed`): pick `feel` per control;
- files with a `disabled` Pressable: remove the call site's own dim
  (`btnDisabled`, an inline opacity) when moving to Press, or it doubles;
- Pressables with a static style and no feedback: many are scrims and
  backdrops, which must NOT dip. Use `feel="still"` for those.

Exceptions to leave alone: `Pressable` inside gesture hosts that need raw
responder control (`AudioReel`, `TimeRangeSelector`, `ListScrubber`, the
drag-sort lists); `withTiming` inside the reel's UI-thread worklets where
the value is tied to audio time, not to a UI tempo; `dev/` files.

Order of files: the player's practice drawers first (founder is looking
there), then the recorder's metronome sheet, then settings, then the rest.

## Move 3: guardrails

BUILT: `scripts/craft-lint.sh`, run as `npm run lint:craft`. There is no
eslint config in this repo, so the guard is a shell script with a baseline.

- `scripts/craft-lint.baseline` records each rule's current count of
  matching lines in `src/` (tests and `dev/` excluded).
- The check FAILS (exit 1) when any count rises: new drift.
- It prints `lower` when a count falls: tighten the baseline by running
  `sh scripts/craft-lint.sh --write-baseline` and committing the file with
  the change that lowered it. Never write the baseline to hide a rise.
- Proven on 2026-10-13: a planted `expo-haptics` import failed the check;
  removing it passed.

Baseline at 11fa41c9: haptics_direct 0 · slider_stock 8 · switch_stock 0 ·
spinner_stock 20 · alert_native 0 · pressable_raw 530 · press_adhoc 345 ·
motion_duration 23 · motion_spring 17 · font_weight_bare 1 · color_literal
876. The migration (move 2) is done when every line but the allowlisted ones
reads 0.

Run it before every commit on this branch. Add it to CI alongside `tsc` and
`jest` when the branch merges.

The rules, as intended (the script is the source of truth):

| Rule | Allowed only in |
|---|---|
| `import ... from "expo-haptics"` | `src/design/haptics.ts`, `src/hooks/useMetronome.ts` |
| `import Slider from "@react-native-community/slider"` | nowhere (remove the dependency when the grep is zero) |
| `<Switch` from react-native, `<ActivityIndicator` | nowhere |
| Hex or `rgba(` literal | `src/design/tokens.ts`, `src/domain/workspaceTheme.ts` |
| `duration:` numeric literal, `damping:`/`stiffness:` numeric literal | `src/design/motion.ts` |
| `fontWeight` without `fontFamily` in the same style object | nowhere |
| `<Pressable` / `<TouchableOpacity` | the gesture-host allowlist above, plus `Press.tsx` and `IconButton.tsx` |

The `src/styles/*` palette is grandfathered with an allowlist that shrinks as
files retire; the lint fails on any NEW literal.

## Move 4: compose

The grammar, short enough to hold in the head:

- One page gutter: 16. Inside a card: 10.
- One row: min height 46, label left, value right in tabular numerals, the
  control at the end. Hairline below. No borders.
- One label style per role: `text.sectionTitle` for a group, `text.annotation`
  for an eyebrow, `text.body` semibold for a row label, `text.supporting` for
  a value or hint.
- Icons: one set (Ionicons), one size per role (22 header, 16 row, 13 inline).
  A glyph sits on the label's cap height, not its line box.
- Colour: terracotta once per screen for THE action or the active state.
  Section inks only on marks. Record red only while recording.
- Nothing explains itself in a sentence. A hint row exists only when it has
  something to say.

Then per screen: screenshot before, pass against the grammar, screenshot
after, founder judges. Start with the full player's practice drawers, the
recorder, the sketch page, the collection page. Deliver each as a before and
after page (see the first one at
https://claude.ai/artifact/VXaGDSA2xSe1TQf3iFD3NZ).

## Verifying in the iOS simulator

Device `iPhone 17`, udid `19A51129-C9CF-451D-91CF-AE5BE8DBD932`, dev app
`com.bmostudio.songnook.dev`. Relaunch with
`xcrun simctl terminate <udid> com.bmostudio.songnook.dev; xcrun simctl launch <udid> com.bmostudio.songnook.dev`.

Gotchas that cost time on 2026-10-13:

- The simulator tool's `tap` takes DEVICE POINTS. The screenshot it returns
  is 1206×2622 pixels displayed at 920×2000. Points = displayed coordinate ×
  1.31 ÷ 3. Sending pixel coordinates lands every tap off screen and the
  frame never changes; it looks like a frozen app.
- The status bar clock is pinned at 0:08 (Maestro override). It is not a
  liveness signal.
- The first tap after a relaunch or a transition often drops. Tap again.
- Sim-tool taps work inside the player sheet. Maestro cannot see inside it.
  Maestro CAN drive the sketch page's edit sheet and `AppDialog`, where
  sim-tool taps silently fail. `timeout` does not exist on macOS.
- Save shots with `xcrun simctl io <udid> screenshot --type=png <file>` and
  crop with `sips -c <h> <w> --cropOffset <y> <x> <file>`. No ImageMagick or
  PIL on this Mac.
- Fast refresh applies edits to the running app at once. Take BEFORE shots
  before editing a file the screen imports.
- The LogBox "Open debugger to view warnings" strip can sit over the dock;
  its close button is at about (282, 619) points.
- To reach the practice drawers: Ideas collection → play on a card → tap the
  card → sketch page → primary take play → full player → Tools → Marks / Loop
  / Sound. A pin cannot be added at a clip's end; skip back first.

## The reel in lanes (2026-10-13, founder's priority 1)

Founder, on a screenshot of a zoomed-out practice reel: crowded and cluttered;
pins look like a standard component; text in pins and sections clunky and off
brand; colours too similar, hard to tell the playhead, worst in the minimap.
After the proposal: "Go ahead and do it all", thinner and more hairline,
especially the pins, and unsure about the flag shape.

Diagnosis: five roles in one terracotta family; seven full-height lines of
similar weight; labels as filled boxes laid over the audio.

Built, default ON, with a comparison switch (Settings, General, Interaction,
"Classic reel"; store pref `classicReel`, default false):

| Thing | Lanes look |
|---|---|
| Pin | A 2 pt head on a 1 px stem at 40% ink, name beside the head in plain ink (Jakarta 500, 10.5). No badge. Names take the top row, stagger DOWN to a second, then give way; a pin with no name drawn keeps its head in a strip above the wave. A note shows as a small trailing dot. |
| Section | A 2 px rule along the reel's bottom edge in the section's ink, name in the same ink sitting on it. No wash over the audio. |
| Loop | 12% terracotta wash, 1 px edges, 5×22 grips centred on the wave. Move bar below is a 28×4 terracotta bar. |
| Playhead | 2 px record-red line under a 9×6 cap. The only red. |
| Wave | Played half goes neutral (`textSecondary`), so terracotta means the loop only. Always on the reel's MIDDLE line (founder, same day: "I would still like the actual waveform to sit in the middle"): the taller lane sets one inset used on both sides. The cost is wave height, about 52 pt tall in the 146 pt practice reel with two name rows. |
| Minimap | Silhouette, a neutral lens for the window, pins as 5 px ticks, sections as a bottom rule, playhead 2 px with a round cap, drawn above the lens. |

Where: geometry in `src/domain/reelLanes.ts` (tested, 11 cases); drawing in
`PlaybackTapeVisualizer.tsx` (`lanes`, `laneDensity`, `theme.markInk`,
`theme.loopInk`; overlays `PinLaneOverlay`, `SectionRuleOverlay`);
`MinimapVisualizer.tsx` (`lanes`); palettes and the switch in `AudioReel.tsx`;
hitboxes in `PracticePinBadges.tsx` laid out from the same geometry;
`PlayerTimeline.tsx` raises the practice reel from 128 to 146 with lanes.

Not touched: the position feed, gestures, the loop engine, recording. The
classic drawing is intact behind the switch; delete it and the pref once the
founder has lived with lanes.

Verified in the simulator on a seeded clip (six pins incl. Hebrew, three
sections, a loop): player and practice views; a tap on a pin's name seeks to
that pin. NOT verified: dragging a pin (the mid-drag twin), the classic switch
flipped back, the clip editor and the overdub guide (they share the reel and
now draw lanes too), the dark palette, RTL, the reading-slim reel, Android.

Dropped from the proposal: "the held pin and the one nearest the playhead
always keep their names". The reel does not know which mark is held, and
re-laying names out as the playhead moves would re-render the canvas during
playback. Names are placed first-come by time.

Screenshot: `docs/product-plan/reel-lanes/practice-centred.png`.

Open with the founder: whether the centred wave is tall enough (the levers are a taller practice reel, one name row instead of two, or letting the wave run behind the name rows); the head shape (now a dot; the flag was disliked),
whether the practice reel's extra 18 pt is welcome, pin names running under
the expand button at the reel's top-right.

## Founder pass on the lanes reel (2026-10-13, after production)

- **"I can't drag a pin on the reel at all."** It did drag, but only from
  the 4 pt head and its name; the line, which is most of the pin, did nothing.
  Now: hold a pin's LINE anywhere along its height (300 ms), then drag. Built
  as a manually activated Pan on the tape (`markerDrag` in
  `PlaybackTapeVisualizer`, raced with pinch and scrub): it fails on touch-down
  unless the finger is within 14 px of a pin, and fails if the finger travels
  before the hold is up, so scrubbing is unchanged everywhere, including on a
  pin. A hold released without moving opens the pin's actions. The canvas pin
  itself follows the finger (`sharedDraggingMarkerX`), so there is no RN twin
  in lanes. Practice mode only, as before. A LongPress gesture was tried first
  and lost its touch to the re-render the drag's state change causes; do not
  go back to it. Head/name hit target raised to 30 pt tall. Haptic: `grab` on
  lift (was `tap`).
- **Type a time.** Hold the At / Start / End box: `TimeEntryModal` (a
  `WarmModal`, so it centres itself above the keyboard) with the figure in the
  dials' serif on a ruled line, the legal range beneath, Cancel and Set. The
  figure fills from the right like a timer (`domain/timeEntry`, tested):
  "123" is 1:23, a dot adds tenths. It opens showing the current time in
  resting ink and the first key replaces it. The keys land in an invisible
  field over the figure whose text is never rewritten, so fast typing cannot
  race a reformat (the first, controlled version did). Marks and loop both.
- **Compilation lists ran off the bottom.** `DraggableFlatList` in the
  playlist, setlist and chart book detail views had no bounded height, so the
  list was taller than the screen and its end sat under the bottom edge.
  `containerStyle={styles.flexFill}` on all three. Seen in the sim on a
  30-item playlist: before, row 30 at the very edge with its padding cut off;
  after, row 30 clear with room beneath.

Verified in the simulator: line drag moved a pin 9 s to 10 s and scrub still
works from a pin's line when the finger moves at once; typed 9.5 set a pin to
0:09.5; the playlist end. NOT verified: the hold-without-moving path opening
pin actions, typed times on a section and on the loop, setlist and chart book
ends (same one-line fix), the software number pad (the sim uses a hardware
keyboard, and there the first tap on Set only dismissed the keyboard; check
on a phone that one tap sets), Android.

## Tools room tidy-up (2026-10-13, founder list)

- **Reel while Tools is open:** 112 pt (was 146), and an expanded reel folds
  back when Tools or the bench opens (`usePlayerScreenUi.setMode`). At that
  height the lanes keep ONE row of pin names: new density `compact`
  (`laneDensityForHeight` in `domain/reelLanes`, used by the canvas and the
  hitboxes alike; full ≥ 130, compact ≥ 96, slim below).
- **Minimap:** 30 pt (was 40), 18 in compact; compact now also while Tools is
  open.
- **Record a layer** left the drawers (it was a full row above the tabs). It is
  the "Layer" key, record dot + one word, beside Tools in the reel toolbar,
  shown only while Tools is open. Same handler, at the playhead.
- **Step up row:** the plan name is gone from the row; "?" sits level with
  the label. Help is one thesis and one untitled line (`HelpItem.label` is
  optional now): "Loop a part slowly. It speeds up as you repeat."
- **Count-in:** label, the length in words ("3 seconds"), one Switch. The
  length takes the action ink when on. Where the take has a grid the length is
  a key that steps 3 seconds → 1 bar → 2 bars; the switch comes on with the
  last length used.
- **Click row hidden when the take has no grid.** Tempo detection is not
  trustworthy yet, so the "Detect tempo" door is gone for now. The plumbing
  (`onDetectAnalysis`, `analysis`, `analysisError`) is still passed to the
  drawers; restore the row from git history at this commit's parent.
- **Slider:** follows a SIDEWAYS drag only (6 px to engage, lets go after
  10 px of vertical travel), so scrolling the page over it no longer moves the
  value. A tap on the track still sets it. The thumb no longer lifts on
  touch-down, only once the drag engages.
- **Haptic** `tap` on tapping a pin (and a section's name) on the reel to jump.

Screenshot: `docs/product-plan/reel-lanes/tools-room.png`.

Verified in the simulator: the short reel with one name row, the Layer key,
the Loop drawer rows, count-in switching on, the new help thesis, a vertical
swipe over the speed slider leaving it at 1× and a sideways drag moving it.
NOT verified: the Layer key actually starting a layer, the count-in length
key on a take with a grid, the minimap at its new heights (it hides at 1×
zoom), the reel folding back from expanded, Hebrew, Android.

**Dragging a section (founder chose whole-section move, 2026-10-13).** Hold
a section's name or rule on the reel for 300 ms, then drag: the section slides
at its length and stops at its neighbours or the clip's edges. It never pushes
or resizes another section; edges stay on the inspector (drag, nudge, typed
time). Rule: `sectionMoveBounds` / `moveSection` in `domain/playerSections`
(tested, 6 cases). Gesture: a `Pan().activateAfterLongPress(300)` on the
existing `SectionJumpHitbox` in `PlayerTimeline` (the RN rail over each band's
bottom 30 pt, which already owned the tap-to-jump), `Exclusive` with the tap.
It writes two shared values (`draggingSectionId`, `draggingSectionDeltaMs`);
the canvas's `SectionRule` and section name read them, so the mark itself
rides the finger and no React state moves during the drag. The held rule
doubles in thickness. Practice mode only, like pins. Haptic `grab` on lift.
Gotcha met: a `useDerivedValue` given a deps array must list every captured
plain value, or it keeps the old one (the name stayed behind after a move
until `startX` was added).

Verified in the simulator: Chorus dragged right and stopped at the clip's
end, then back, name and rule together, list times following. NOT verified:
stopping against a neighbouring section (rule is unit-tested), zoomed reels,
Android.

**Leaning a section through its neighbour (2026-10-13).** The founder asked
for "lift and quickly drag again to push"; agreed instead on one continuous
gesture guarded by distance, not time. Dragged into a neighbour the section
stops (`tick`). Lean a further 28 px (`SECTION_PUSH_LEAN_PX`) and the
neighbour's touching edge gives way (`grab`) and follows: only that edge, only
until the neighbour is at `MIN_SECTION_LENGTH_MS`, never cascading to a third
section. `sectionPushBounds` and `moveSection(..., { push: true })` in
`domain/playerSections` (tested); the hitbox reports whether the drag ended
in the push zone. The canvas draws the neighbour giving ground from
`sharedPushedSectionId` / `sharedPushedSectionDeltaMs` (signed: positive moves
its start later, negative its end earlier). Undo in the Marks row reverses it.

**Selecting never moves the playhead (2026-10-13).** Founder: tapping a
section to adjust it threw away a playhead parked on the exact spot. Now a tap
on a Marks row only opens or closes its control, and tapping Start / End (marks
and loop) only chooses which edge the slider and nudges act on. Going there is
separate: the play glyph, which now LEADS each row (as on every card) and no
longer opens the control, or a tap on the mark on the reel. Considered and
dropped: "tap the chosen Start/End box again to jump" (the founder questioned
it; the play glyph covers the start, and a hidden second-tap rule was not
worth it). There is no one-tap jump to a section's END from the list.

Verified in the simulator: tapping the Verse row opened its control with the
playhead still at 00:16; leaning Verse into Chorus moved Verse to 6-11 s and
Chorus's start to 11 s with its end and the Intro untouched. NOT verified:
pushing an earlier neighbour's end on screen (unit-tested), the two haptics,
the loop's Start/End no longer seeking, Android.

**The Marks list shows where you are (2026-10-13).** Founder: timestamps
alone did not give the song's shape. Each row now reads against the playhead
(`domain/markPhase`, tested): passed marks recede (medium weight, muted ink,
paler glyph), the one you are in is lit (a `surfaceHigh` wash that fades in
and out over `durations.base`, name a weight up), what is ahead stays plain.
A section is "now" from its start up to its end, so two touching sections are
never both lit; a pin is "now" for one second either side. The held row is
exempt. No colour is used. Convention chosen: a transit line's (passed stops
grey out) over a lyrics view's (everything but the current line dimmed),
because this list is also an editor and must stay readable. It costs no extra
renders: the drawer already re-renders with `playheadMs` for the "at 00:04"
readout. Screenshot: `docs/product-plan/reel-lanes/marks-timeline.png`.
NOT verified: how it reads on a long song with many marks, and at the very
end of a clip, where every row is "past".

**Layer recording, three bugs (founder report, 2026-10-13).**
1. *"Record layer at playhead" recorded over the whole track.* Reproduced: with
   the player paused, jump to a pin; the reel moves but the React position
   (`effectivePlayerPosition`, which the Layer key read) stays at 0, so the
   punch-in was 0. The key now reads the playhead AS DRAWN
   (`getVisiblePlayheadMs` in `PlayerScreen/index.tsx`: the reel's shared
   progress × duration).
   CORRECTION (same day, after a clean-session test): the stale number was a
   SIMULATOR ARTIFACT. `effectivePlayerPosition` is zeroed on purpose whenever
   the engine's loaded target is not the on-screen clip (the stale-position
   invariant), and hot reloading with the player open leaves exactly that
   desync (the known "refresh with the player open kills play" gotcha). In a
   freshly launched app, with a temporary on-screen readout of
   `engineMatchesScreenClip`, `playerPosition` and `effectivePositionMs`: a
   take opened from its card matched and tracked (13000 / 13000), and a jump
   to a pin WHILE PAUSED updated all of it at once (28000 / 28000, readout
   00:28, "at 00:28", Chorus lit in the Marks list). Nothing to fix in the
   transport; do not touch the invariant. What the founder most likely saw as
   "records over the whole track" was item 2. Reading the reel for the Layer
   key stays: it is correct in a normal session and, in a real desync, agrees
   with what is drawn. RULE FOR THIS FILE'S READERS: relaunch the app before
   judging any player position behaviour in the simulator.
2. *The recorder looked like a full-length layer even when punched in.* The
   guide sat at 0:00 until the take started. Before the take it now parks at
   the punch point.
3. *Backing out left the layer waiting in the next recording.* Leaving an
   unrecorded layer now clears the recording context (unmount cleanup in
   `useRecordingScreenModel`), and arming ANY take
   (`setRecordingParentClipId`, which every entry point calls) clears layer
   fields (`recordingArming.test.ts`).
Discard / Redo / Save stay dimmed before anything is recorded; the back
chevron is the way out and now leaves nothing behind.

**One pin glyph (founder, 2026-10-13).** `src/design/markIcons.ts`:
`PIN_ICON` ("pin") and `PIN_ICON_OUTLINE`. The flag is gone from the Marks
list, the recorder's drop-pin key, and the Save sheet's pin rows; the toast
already used the outline. The recorder's live tape draws a pin as the reel
does (dot head on a hairline), not a flag tab. Notepad's "Pin" action is a
different thing (pin a note to the top) and keeps its bookmark.

Verified in the simulator: paused jump to 0:08 then Layer opened "LAYER ·
FROM 00:08" with the guide parked there; back, then the sketch's record
button opened a plain "Recording into" with no guide. NOT verified: an actual
layer take from a punch point, the pin glyph on a phone, Android.

**Pins inside a section are grouped with it (founder, 2026-10-13).** On a
real song a pin at 1:16 inside Verse 1 (0:49 to 1:38) showed as "played"
while Verse 1 was lit. Now (`markGroupPositions`, `markRowTimeline` in
`domain/markPhase`, tested): a pin whose time falls in a section (start ≤ at <
end) is a member of that section's group. The group shares ONE wash while the
section plays, a member is never faded until the whole section has passed,
and it only goes a weight up as the playhead reaches it. A 2 px rail in the
section's own ink runs down the left from the section's row to its last pin
(40% at rest, 20% once passed, full while playing); sections with no pins get
no rail. Pins outside every section keep their own one-second clock. The list
sort puts a section ahead of a pin on the same instant. The rail and wash
bridge the 21 pt between rows (`MARK_ROW_PITCH_GAP`). Screenshot:
`docs/product-plan/reel-lanes/marks-group.png`. NOT verified: a held (open)
row in the middle of a group, where the rail and wash skip that row.

## Under the reel (2026-10-13, founder list)

Founder, with a screenshot of the listening page: the reel should take the
big size by itself when nothing is open; the eye button is not obvious and
reads backwards; "Marks hidden" is the wrong wording; the empty Lyrics and
Chart rows are noisy and wordy; leaving the in-player lyric editor takes two
presses; an open chart needs a way to its editor.

**One reel height per flow.** `reelHeightForFlow` in `src/domain/reelLanes.ts`
is the only place a height is decided (tested).

| Flow | Height | Why |
|---|---|---|
| Listening, nothing open | 184 to 320, whatever the page allows | The reel is the page. `usable height − 472`, where 472 is everything else on a fully filled page (title, minimap, toolbar, two doors, notes shelf, transport), measured on an iPhone 17 (306 there). |
| Tools or the layers bench | 112 | The drawers need the page. |
| Lyrics or chart open, or writing | 64 | The slim tape. |
| Full view | none | Hairline thread only. |

The corner expand button is GONE: it existed to reach the size the reel now
takes on its own, and it sat on top of pin names. `reelExpanded` state, its
style and its two strings were deleted. Nothing else used them.

**"Marks", not an eye.** The eye lit up when the marks were HIDDEN, which is
the opposite of every other toggle in the app. `MarksToggle` is now the word
"Marks" in editorial ink: dot lit while marks are on the reel, hollow while
they are off. Same width both ways. On the slim reading and writing bars
there is no room for a word, so `compact` shows the app's pin glyph (filled
when shown, outline and muted when hidden). `player.marksHidden` deleted.

**`InkOption` is built** (`common/InkOption.tsx`): dot + word, hollow to
terracotta, `light` on flip, `accessibilityRole="switch"`. The word names the
thing, never the state. Used by `MarksToggle` and the chords toggle in the
text-size sheet. STILL TO MIGRATE onto it: `inkOption` / `partInk` in the
practice drawers, the ink dots in `MetronomeBlocks`, `StepUpSequenceSheet`,
`PlayerLayersBench` (`toneInkDot`), the stage filter in `FilterSortBar`.

**Doors and ghost keys** (`PlayerArtifactDoors.tsx`). The grammar under the
reel is now two things only:
- A thing that EXISTS is a card (`SurfaceCard`) whose face is its content:
  the first lyric line, the chord run.
- A thing that does NOT exist is a ghost key: tonal `surfaceContainer`, r8,
  38 tall, a plus and one word ("Lyrics", "Chart"). Keys share one row, half
  the page each; a lone key keeps its half.
"No lyrics yet", "No chart yet" and the visible "Write lyrics" / "Build
chart" labels are gone from the page (the last two remain as accessibility
labels). The folded sketch door on a standalone clip ("Make sketch") became
the same key, so every empty slot on this page looks alike. The full
first-visit sketch card is unchanged.

**The Notes door wears a glyph, not a dot** (`PlayerShelf.tsx`): a dot beside
a word now means on/off on this page, and a door must not look like a switch.

**One press folds the surface.** The bar's chevron called `stopWriting` while
writing, which only dropped to a reader nobody had opened. It now always
calls `closeReading`. The writer still commits pending words on unmount.
Trade: from reader, pencil, write, chevron now lands on the listening page,
not back in the reader. The door reopens the reader in one tap.

**Chart pencil.** The reading bar's pencil used to exist for lyrics only. On
a chart it now minimises the player and opens the sketch's Chart tab already
in its editor: route param `chartEditToken` (a fresh number per request),
seeded into `useChordSheetModel(id, { startEditing })` on a fresh mount and
flipped by an effect in `SongChartSection` on a page already open. The empty
"Chart" key takes the same route.

Screenshots: `docs/product-plan/under-reel/` (listening-empty, -chart-only,
-filled). The empty and chart-only shots were taken at reserve 464 (reel 314);
the shipped reserve is 472 (306).

Simulator-verified after a clean relaunch: all three listening states, the
standalone clip's key, Marks on and off (reel and minimap both clear), one
press out of the writer, chart reader pencil landing in the editor with the
player docked and still playing.
NOT verified: Android; a short phone (the 184 floor is by arithmetic and
test, not by eye); Hebrew labels in the keys and the Marks toggle; the
compact pin toggle's hidden state inside the reading bar on a real lyric
page; whether pins named near the reel's top right now read cleanly on a
founder library.

## Pages above the transport (2026-10-14, supersedes the ghost keys)

Founder, a day after the ghost keys shipped: "The bland sketch/lyrics/chords
buttons do NOT look like a premium app. They're poorly placed." Two directions
were mocked on a canvas (https://claude.ai/artifact/5fV1Bg687Asv8eyMJz1iVM):
A "Pages" and B "Rooms" (one segmented control: Listen, Tools, Lyrics, Chart).
The founder chose **A**. B is not built and would replace the August doors
design; do not start it without a new yes.

Why the keys failed, for the next person tempted by a grey box: grey on grey
(reel, minimap, Tools and keys were one tone); hung from the top of the page
with the bottom unowned; a plus in a box is a form control; four vocabularies
in one small area; and the layout changed shape with content.

**What A is** (`PlayerArtifactDoors.tsx`, `PlayerSupportSections.tsx`):
- The listening page is composed from the thumb up. Under the toolbar: the
  take's note, then air, then the pages on the floor of the body, directly
  above the transport. The air is the only thing that flexes.
- **Lyrics is always on the leading side, Chart on the trailing side.** They
  never trade places or disappear.
- **A written page is a tile**: `SurfaceCard variant="content"` (new variant,
  r12, the IdeaCard radius), 168 tall. Its face is the top of the real page.
  Lyrics: the first lines in Lora 12, one printed line each, never wrapped
  (a wrapped miniature reads as a different poem), stanza breaks kept, the
  lyric's chords as one terracotta line over the fade. Chart: section names
  and two-bar systems, bars always left to right, bar count in the corner.
  The last lines sink into the paper (`PageFade`, an SVG gradient on
  `colors.surface`).
- **An unwritten page is a slot**: dashed `borderMuted` outline, a plus, one
  word. 96 tall when both are empty; beside a tile it stands as tall as the
  tile. Slot and tile carry the same side padding on purpose: Yoga shares a
  row by what is left AFTER padding, so an unpadded slot came out 28 pt
  narrower than its neighbour.
- **Standalone clip**: once any sketch exists in the library it shows the
  same two slots. Tapping either asks "Make sketch" (body: "Lyrics and charts
  live in a sketch. This clip becomes its first take."), then runs the same
  `handleMakeSketch` as the overflow item, which stays. With no sketch
  anywhere yet, the first-visit sketch card still shows. THIS WAS ASSUMED:
  the founder answered "A" and the approved mock showed a clip with the two
  slots, but the question was not answered in words. To revert, render one
  slot labelled `songDetail.makeSong` in the `!canAuthor` branch.
- **The note** replaced the Notes door (`PlayerShelf.tsx` deleted): the
  eyebrow NOTE and the note itself in Lora italic, two lines at most, lined
  up with "Marks". Tap opens the same notes sheet.
- Builders live in `src/domain/pagePreview.ts` (tested): `buildLyricPreview`,
  `buildChartPreview`, `countChartBars`.

**Reel height is now content-aware.** `reelHeightForFlow("listening", usable,
{ pages, note })` in `domain/reelLanes.ts`:

| Below the reel | Reel on an iPhone 17 |
|---|---|
| tiles + note | 260 |
| tiles | 314 |
| slots | 386 |
| nothing | 400 (the ceiling) |

(2026-10-14: the minimap went from 30 to 24 pt, 18 to 16 compact, and the
reserve from 286 to 280, so the reel took the 6 pt. Same day, a real bug: the
minimap's wave path memo did not depend on the strip's height, so after Tools
or reading the wave stayed drawn for the short strip and sat in the top half
of the tall one. `containerHeight` is now a dependency.)

Floor 120. `LISTENING_BASE_RESERVE` 280 was tuned by eye on that one phone:
with a one-line note the air between note and tiles is about 50 pt. Tiles can
shrink (`flexShrink`) if a short phone runs out of room.

Screenshots: `docs/product-plan/under-reel/` pages-filled, pages-mixed,
pages-empty. The ghost-key sections above ("Doors and ghost keys", "The Notes
door wears a glyph") describe code that no longer exists; the rest of that
section (Marks ink, one press to fold, chart pencil, InkOption) still holds.

Simulator-verified after clean relaunches: both tiles, tile beside slot at
equal widths, both slots on a sketch and on a clip, the Make sketch dialog,
a tile opening the reader.
NOT verified: Android (dashed borders with a radius, the SVG fade, Lora
italic); Hebrew lyrics in a tile and the Hebrew dialog copy; a short phone;
a lyric with chords (the terracotta footer line); a chart made only of text
blocks; a long note wrapping to two lines; the first-visit sketch card in its
new bottom position; confirming the Make sketch dialog end to end.

**Sim gotcha (cost a stray idea in the dev library):** never tap blind to
close the LogBox strip. Its close button sits over the record FAB, so a second
tap after the strip is gone starts a quick record. Screenshot, then tap once.

## State at handoff

Branch `craft/control-kit`, pushed. Commits:

| Commit | What |
|---|---|
| 90070b47 | Slider, Press, MarkInspector on both, drawer handler haptics removed |
| 0fe3a723 | Slider track reads on the terracotta wash |
| 8ed5d021 | `haptic.tick`, light impact on Android |
| 1388c70e | Plan note: reel loop handles set aside |
| 5e409548 | This handoff doc |
| 11fa41c9 | Switch and Stepper, under every switch and the mark carets |
| 5f22d1de | craft-lint script and baseline, dead switch styles removed |
| d74e0ee4 | Migrate: speed and pitch dials, metronome sliders |
| aec70350 | Migrate: the last stock sliders (pin and section modals, layer bench, chord sheets) |
| 6da03d6c | Migrate: IconButton and the player's practice drawers onto Press |
| 33edc065 | Press codemod: 88 presses in 54 files, `press_haptic_none` lint rule |
| (next) | Spinner replaces every ActivityIndicator (14 files, 20 uses); `durations.spin` |

Baseline now: haptics_direct 0 · slider_stock 0 · switch_stock 0 ·
spinner_stock 0 · alert_native 0 · pressable_raw 422 · press_adhoc 250 ·
press_haptic_none 82 · motion_duration 23 · motion_spring 17 ·
font_weight_bare 1 · color_literal 876.

Preview android updates from this branch: 2e84979d, 967db10b, 1d4b44f2,
b3a12472, and the one published with the codemod commit. `tsc` clean, jest
135 suites / 1208 tests, `npm run lint:craft` clean.

Simulator-verified: marks, loop and sound drawers on the kit (Switch on and
off, Stepper nudge, slider drag); after the codemod, the sketch page, its
segmented control, the full player and the pin modal all render and respond.
NOT photographed: the pin and section edit modals' sliders, the layer bench,
the chord sheet sliders, and most of the 54 codemod files. They are the same
controls already seen elsewhere, type-checked and lint-checked.

Founder, 2026-10-13, after Slider and Press: "Feels good." Also: "the design
of the whole loop options component is still not there 100%". That is move
4 (compose), after the kit and the migration.

Next action, in order:
1. DONE: `Spinner` (`common/Spinner.tsx`, a hairline arc, one turn per
   `durations.spin` = 900 ms). NOT yet seen on screen: every use is a
   transient busy state. First thing to do is catch one (Settings, Storage
   while it loads; the welcome import; an editor export) and photograph it.
2. `InkOption` is BUILT (see "Under the reel"); migrate the listed ink dots
   onto it, then `Chip` in ONE room with a before and after for the founder.
3. Fold the 17 inline springs and 23 durations into `motion.ts`
   (`springs.handle` already equals the pasted `{ damping: 20, stiffness: 300 }`).
4. The hand pass on raw Pressables, a screen at a time, in the file order
   above, clearing `press_haptic_none` for that screen in the same commit.
5. The states sheet in Claude Design, then move 4 (compose), starting with
   the loop drawer the founder flagged.
Run `npm run lint:craft` before each commit and tighten the baseline as
counts fall.
