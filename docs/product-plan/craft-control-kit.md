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

### To build, in order

| Control | Replaces | Spec |
|---|---|---|
| `Switch` | Stock `Switch` (4 files) and the hand-made `switchShell`/`switchKnob` in `PlayerScreen/styles.ts` (loop, step-up). | 46×28 shell, 22 pt knob, knob slides with `withTiming(durations.base)`, shell tints `surfaceHigh` → `primary`. Haptic: `light` on flip (small state flip). Knob is the same paper knob as the Slider thumb. |
| `Stepper` | The nudge carets in `MarkInspector`, speed and pitch steps in `SpeedPitchDials`, tempo steps in `MetronomeBlocks`. | Two 28 pt round glyph keys on `surface`. Haptic: `tick` per step. Long-press repeats with the same tick per step. Disabled at the bound. |
| `Chip` | `edgeChip`, `inkOption`, `partInk`, `toolChip`. One chip with `active` and `tone`. | Height 34, `radii.lg`. Active = `primarySurface` fill + `primaryDeep` text, never a border. Uses `Press`. |
| `Row` | `pd.row`, `toolBodyRow`, settings rows. Label · value · control. | Min height 46, horizontal 10 inside cards and 16 on pages, hairline below, never a border. Label `text.body` semibold, value `text.supporting` tabular. |
| `Spinner` | `ActivityIndicator` (14 files). | A hairline arc in `primary` rotating at `durations.slow`; or, where progress is known, a thin bar. Never the platform spinner. |
| `IconButton` | Keep the component; make it a `Press feel="glyph"` so the dip is the one language. | No visual change beyond the shared dip. |

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

Exceptions to leave alone: `Pressable` inside gesture hosts that need raw
responder control (`AudioReel`, `TimeRangeSelector`, `ListScrubber`, the
drag-sort lists); `withTiming` inside the reel's UI-thread worklets where
the value is tied to audio time, not to a UI tempo; `dev/` files.

Order of files: the player's practice drawers first (founder is looking
there), then the recorder's metronome sheet, then settings, then the rest.

## Move 3: guardrails

Add to the eslint config (or a `scripts/craft-lint.sh` run in CI and in the
pre-commit hook if eslint rules are awkward). Each rule fails the build.

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

## State at handoff

Branch `craft/control-kit` at 1388c70e, pushed. Commits:

| Commit | What |
|---|---|
| 90070b47 | Slider, Press, MarkInspector on both, drawer handler haptics removed |
| 0fe3a723 | Slider track reads on the terracotta wash |
| 8ed5d021 | `haptic.tick`, light impact on Android |
| 1388c70e | Plan note: reel loop handles set aside |

Preview android updates from this branch: 2e84979d, 967db10b. `tsc` clean,
jest 135 suites / 1208 tests at 8ed5d021.

Next action: build `Switch` and `Stepper`, land them in the loop and marks
drawers, screenshot before and after, then the lint rules, then the migration
in the order above.
