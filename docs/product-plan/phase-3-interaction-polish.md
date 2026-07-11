# Phase 3 — Interaction Polish (Haptics, Animation, Feedback)

**Effort:** ~1 week · **Dependencies:** none hard; nicer after Phase 2 · **Requires:** physical device — haptics don't exist in emulators

## Purpose

Close the gap between the app's best-feeling surfaces and its dead ones. The audit measured haptic/animation coverage per component: the media dock, transport bar, and bottom sheets are excellent; the edit flow, audio reel, tuner, and overdub cards give zero physical or motion feedback. A premium music app *feels* mechanical-tactile — this phase adds that vocabulary consistently, not maximally.

## Background you need

- **Haptics utility:** `src/design/haptics.ts` — the app's wrapper (respects the persisted `hapticsEnabled` preference from the store; never call `expo-haptics` directly in components). 58 files already import it. Read it first to learn the available verbs (e.g. `haptic.tap()` and whatever tiers exist) before inventing new ones.
- **Motion utility:** `src/design/motion.ts` — check for existing duration/easing constants before hardcoding.
- **Animation stack:** `react-native-reanimated` v4 (39 files) and core `Animated` (45 files) both in use. Design rule from `docs/design-system.md`: **fades and subtle vertical slides only** — no bouncy springs, no scale-pops.
- **Reference implementations (the good ones):** `GlobalMediaDock.tsx` (9 haptic refs, 7 animation refs), `common/TransportBar.tsx` (6 haptics), `common/BottomSheet.tsx` (fully animated), `PlayerSheet.tsx` (9 animation refs). Match their intensity choices.
- **Measured dead zones (2026-07-11):** `EditorScreen/index.tsx` 0 haptics, `EditorTransformSection` 0, `OverdubLayerCard` 0 haptics + 0 animations, `PlayerScreen/index.tsx` 0 (transport bar inside it covers some), `PlayerSheet` 0 haptics, `common/AudioReel.tsx` 0 haptics, `TunerScreen` 0 haptics, `PlayerPracticePanel` 0 animations (has 4 haptic refs), `modals/ClipActionsSheet` rides BottomSheet's animation (fine).

## Work items

### 3.1 Write the haptic vocabulary (do this first, ~half a day)

Create `docs/haptics-vocabulary.md` mapping intent → verb → where it fires. Suggested tiers (adapt to what `haptics.ts` actually exposes; extend it if needed):

| Intent | Feel | Examples |
|---|---|---|
| **tick** | lightest | scrub detents, zoom snap, slider steps, segmented-control change |
| **tap** | light | button presses, chip toggles, accordion open/close |
| **select** | medium | selecting a clip/region, picking an option, drag pickup/drop |
| **confirm** | success notification | save completed, export done, recording saved, in-tune lock |
| **warn** | warning notification | destructive confirm shown, recording auto-stopped, error surfaced |

Every haptic added in this phase cites a row. This doc keeps intensity choices consistent when multiple people touch the app later.

### 3.2 Edit-clip flow haptics (`src/components/EditorScreen/`)

Zero today. Add: **tap** on trim/transform mode switch (SegmentedControl — consider adding it inside `common/SegmentedControl.tsx` so every usage app-wide benefits); **select** on "+ Add at playhead" region add and on region delete; **tap** on keep/remove intent switch (`EditorTrimIntent`); **tick** on the speed/pitch slider detents in `EditorTransformSection` (step boundaries only — not continuous); **confirm** when an export/save completes (`useEditorExportFlow` success paths); **warn** alongside destructive dialogs.

### 3.3 AudioReel scrub feel (`src/components/common/AudioReel.tsx`)

The most tactile-looking surface in the app gives no physical feedback. Add: **tick** on scrub begin and end (the `onScrubStateChange` transitions); **tick** on zoom snap if the reel has zoom detents; optional (test on device for annoyance): a subtle tick when the playhead crosses second-boundaries *during manual scrub only* — never during playback. Throttle any repeating tick to ≥80ms intervals; wire through `haptics.ts` so the user preference gates everything. This component is shared by the editor, player, and recording review — one change upgrades all three.

### 3.4 Tuner in-tune feedback (`src/components/TunerScreen/`)

Zero haptics today — and "buzz when I hit the note" is the canonical tuner delight. In the tuner model (`hooks/useTunerScreenModel.ts`), detect the transition into the in-tune band (it already computes cents-off; find the existing threshold) and fire **confirm** once on entry (not continuously while held — debounce, re-arm after leaving the band for >300ms). Consider a **tick** at ±band edges. Pair with a visual state if one doesn't exist (the in-tune moment should also glow terracotta).

### 3.5 Accordion animation wrapper (overdubs + practice panel)

`OverdubLayerCard` (mix/align sections) and `PlayerPracticePanel` (tool expansion) accordion-toggle with **no transition** — content pops in. Build one reusable `AnimatedCollapse` (suggest `src/components/common/AnimatedCollapse.tsx`) using Reanimated `Layout`/`entering`/`exiting` or measured-height + `withTiming` (~180–220ms, fade + slight vertical settle per the design rules). Apply to: overdub layer section disclosure, practice panel tool expansion, and any Settings accordions that pop (check `SettingsShared.tsx`). Add **tap** haptic on toggle while you're in there.

### 3.6 PlayerSheet gesture punctuation

The expand/collapse pan gesture (`PlayerSheet.tsx` + `PlayerSheetPositionProvider`) is animated but silent. Add **tap** when the sheet settles into either terminal state (expanded/collapsed) — on settle, not during drag. Same for the dock→sheet open tap in `GlobalMediaDock` if not already covered (it has 9 haptic refs — audit them against the vocabulary rather than adding blindly).

### 3.7 Toast primitive for quiet confirmations

**Current:** no lightweight non-blocking confirmation exists — flows either open a dialog or say nothing (e.g. "Copied", "Added to playlist", "Pin added", "Saved"). Bespoke banners exist (`ImportProgressBanner`, `ClipboardBanner`, `PlaylistCollectorBanner`) but they're process-specific.
**Target:** `src/components/common/Toast.tsx` + a module-level `toast.show(message, { icon? })` API mirroring the `dialogStore` pattern (`common/dialogStore.ts`) so it's callable from anywhere without prop-drilling; host it near `AppDialogHost` in `App.tsx`. Design: small pill, `colors.surface` on paper with faint border (SurfaceCard language), PlusJakartaSans_500Medium 13px, slides up ~8px + fades in, auto-dismisses ~2s, safe-area aware, sits **above** the media dock but below dialogs. One at a time (replace, don't queue).
**Wire into (initial set):** clip copy/duplicate actions in `ClipActionsSheet` flows, "added to playlist/songbook/setlist" (`LibraryScreen` collectors), practice pin added (`PlayerPracticePanel`), lyric version saved, backup completed (`SettingsScreen` — where a dialog currently over-interrupts, judge case-by-case). Each toast pairs with a **confirm** haptic.

### 3.8 Press-state audit (cheap, do alongside)

The codebase has a `styles.pressDown` press-state pattern. Grep `Pressable`/`TouchableOpacity` usages in the flows above for missing pressed feedback (no style change on press) and add `pressDown` or an opacity state. Don't sweep the whole app — just the screens this phase already touches.

## Verification

- [ ] Every added haptic cites a vocabulary row; intensities consistent on device (test with `hapticsEnabled` on **and off** — off must fully silence everything new)
- [ ] Accordions animate at 60fps on a mid-tier Android device (Reanimated runs on UI thread — verify no JS-thread jank with heavy libraries loaded)
- [ ] Toast renders above dock, below dialog; survives navigation mid-display; VoiceOver/TalkBack announces it (`accessibilityLiveRegion="polite"` / `AccessibilityInfo.announceForAccessibility`)
- [ ] `npx tsc --noEmit` + `npx jest` green; add a unit test for the toast store
- [ ] Editor, reel, tuner, overdub, player-sheet flows hand-tested on both platforms (iOS haptics differ — Taptic Engine is crisper; confirm nothing feels buzzy on Android or mushy on iOS)

## Out of scope

Sound effects (no UI sounds in a recording app — they'd bleed into takes); redesigning any layout; onboarding animations (Phase 4).
