# Audio Architecture — Roadmap (Plan A done · B & scrubbing pending)

This document tracks the staged refactor of SongNook's audio playback system.
It exists because playback bugs (player not persisting on minimize, laggy/imprecise
scrubbing, "insecure"-feeling waveform) trace back to **architecture**, not to
isolated bugs.

> **TL;DR of the diagnosis:** audio engines were bound to component lifecycles and
> coordinated loosely through Zustand store tokens. Navigating away released the
> engine and orphaned the controls. Plan A fixed the full player. Plan B centralizes
> user-facing playback under one root service while preserving two UX concepts:
> dock/full-player sessions and clip-card miniplayer auditions. The scrubbing pass
> (step 3) fixes the UI↔native-audio sync that makes the playhead/waveform feel
> imprecise.

---

## Background: how audio is built today

There is **no single audio engine**. There are many, all built on expo-audio's
`useAudioPlayer`, each historically bound to a component:

| Engine | Instantiated in | Notes |
|---|---|---|
| `useFullPlayer` | **`FullPlayerProvider`** (root, since Plan A) | The dedicated Player screen + mini dock |
| `useInlinePlayer` | **5+ screens**: `CollectionScreenProvider`, `ClipList`, `ClipLineageScreen`, `RevisitScreen`, `ActivityScreen` — each creates **its own** engine | Clip-card "preview" playback |
| Editor preview, layer preview | their own screens | local, out of scope |

They coordinate through:
- **Zustand store** (`src/state/playerSlice.ts`) — the *state*: `playerTarget`,
  `playerQueue`, position/duration/isPlaying, `inlineTarget`, etc.
- **Request tokens** — `requestPlayerToggle`, `requestInlineStop`,
  `requestInlineSeek`, … = "someone mounted please do X".
- **A module-level singleton** in `useInlinePlayer.ts` (`activeInlinePlayerSession`,
  `inlinePlayerOwnerIdCounter`) so only one inline engine plays at a time.

The store holds *intent + serializable state*; the mounted component holds the
*actual sound*. That split is the root cause of the whole bug class.

---

## ✅ Plan A — DONE: lift the full player to the root

**What was built**
- `src/hooks/FullPlayerProvider.tsx` — calls `useFullPlayer()` **once**, exposes it
  via context (`useFullPlayerContext()`).
- `App.tsx` — `FullPlayerProvider` wraps `<NavigationContainer>` (which contains both
  `PlayerScreen` and `GlobalMediaDock`). Engine now lives **above** the navigator.
- `PlayerScreen/index.tsx` — `useFullPlayer()` → `useFullPlayerContext()` (one line;
  all practice/clock/scrub layering on top is unchanged).
- `GlobalMediaDock.tsx` — controls the **live** engine via context, branched by kind:
  - play/pause → `fullPlayer.playPlayer()` / `pausePlayer()`
  - scrub → `fullPlayer.seekTo()`
  - stop → `fullPlayer.closePlayer()` + `clearPlayerQueue()`
  - (`kind: "inline"` still uses tokens — Plan B territory)
- Reverted the earlier `playerMinimizedPositionMs` workaround — unnecessary now that
  the engine never unloads.

**Interim cross-engine coordination (added after the fact — DELETE in Plan B):**
Because the full engine now persists, it can play *simultaneously* with an inline
clip-card engine (two sounds at once). Until Plan B unifies them, `FullPlayerProvider`
bridges the two:
- It handles `playerCloseRequestToken` at the root, so when inline (or anything)
  calls `requestPlayerClose()`, the persistent full engine stops even while the
  Player screen is unmounted. (Previously only `usePlayerScreenLifecycle` handled it.)
- It passes `onBeforePlayNew: () => requestInlineStop()` to `useFullPlayer`, so opening
  a new clip in the full player stops any inline playback.
This glue exists *only* because there are independent engines with no root coordinator.
When Plan B moves both dock/full-player and miniplayer engines under one root service,
remove both bridges — focus control becomes a direct service method call (and the
close/stop tokens go away too).

**Other changes that landed alongside Plan A** (context — mostly not Plan B concerns):
- **Exit behavior** (`usePlayerScreenLifecycle`): a `beforeRemove` navigation listener
  now runs the stop + `clearPlayerQueue` cleanup on *every* exit (on-screen Back,
  hardware/gesture back) **except** minimize, which sets a one-shot `isMinimizingRef`
  flag to skip it. `handleBack` is now just `navigation.goBack()`. → So the only
  "keep playing" exit is the minimize chevron.
- **Dock scrubber** (`GlobalMediaDock`): the dock progress bar now reuses the
  `MiniProgress` component (same draggable dot as the clip card) via a new `hideTimes`
  prop; `onSeek` branches `fullPlayer.seekTo()` (player) vs `requestInlineSeek()`
  (inline). The old tap-only track was removed.
- **Visual playhead on remount** (`useTransportClock`): seeds `initialPositionMs` from
  the live `positionMs` and starts with no reset-hold, so returning to the full player
  while paused shows the correct position immediately (was pinned at 0 until play).
- **Open animation** (`App.tsx`): Player `<Stack.Screen>` uses
  `animation: "slide_from_bottom"`, `animationDuration: 260` so expanding from the dock
  feels like the now-playing bar growing up. (Pure UX; unrelated to Plan B.)
- **No minimize in practice mode** (`PlayerHeaderSection`): the minimize chevron renders
  only when `mode === "player"`. Practice mode's engine is the pitch-shift module in
  `usePlayerPracticePitchTransport` (screen-local; its unmount unloads the module), so it
  *cannot* persist across navigation like the base engine — minimizing would tear down the
  loop/pitch. Practice is a focused on-screen mode; its only exit is Back (clean stop via
  the `beforeRemove` listener). **Plan-B-stable:** even after the engines unify, the
  pitch/loop system stays screen-local, so "no minimize in practice" remains correct —
  do NOT remove this rule.

**Why it works:** minimize is just `navigation.goBack()` with the `isMinimizingRef`
flag set. The engine is in the provider, so it keeps playing; cleanup only runs from the
`beforeRemove` listener (non-minimize exits) and the close-token path — neither fires on
a minimize. Re-opening early-returns in the open-on-focus effect (source still loaded),
so position is preserved for free.

**⚠️ Verify Plan A is correct before building on it** (manual, on device):
1. Song → open full player on a clip → play to ~0:05 → tap the header chevron-down.
   - Expect: audio **keeps playing**; mini dock shows the clip with position
     advancing in real time (not stuck, not 0:00).
2. On the mini dock: play/pause toggles the same audio; **drag the dot** to scrub and
   tap-to-seek both move the same audio; stop clears it and hides the dock.
3. Tap the dock card → full player re-opens **at the current position** (shown
   immediately, even while paused), still playing, no "Loading player" flash.
4. **On-screen Back AND hardware/gesture back** both stop audio + clear queue + hide
   dock. **Only the minimize chevron keeps it playing.**
5. Cross-engine: minimize (dock playing) → play a clip card → the dock/full engine
   **stops** (no two clips at once). And opening the full player stops inline.
6. Lock screen controls still work while the full player is open.
7. Regression: clip-card inline playback + its dock still behave as before.
8. `npx tsc --noEmit` clean.

If any of 1–5 fail, do **not** start Plan B — fix A first (likely culprits: a stray
`closePlayer`/`clearPlayerQueue` on blur, the provider mounted below the navigator, or
the `beforeRemove`/`isMinimizingRef` flag logic).

---

## ⏳ Plan B — root AudioService with dock + miniplayer sessions

### Current build (the problem)
Inline playback is **N engines fighting over a singleton**. Each screen that lists
clips spins up its own `useInlinePlayer` → its own `useAudioPlayer`. Only one is
"owner" at a time via the module singleton. Symptoms this causes:
- Inline audio stops when you navigate away from the owning screen (same root cause
  Plan A just fixed for the full player — the inline dock has the **same latent bug**).
- Ownership races, double-fires, controls that no-op because no engine is mounted.
- Two parallel state channels (`inline*` vs `player*` in the store) that must be kept
  in sync, plus the `activeInlinePlayerSession` singleton as a third source of truth.

### Product model (settled policy)
Do **not** collapse the clip-card miniplayer into the media dock UI. The two playback
surfaces have different jobs:
- **Dock/full-player session:** durable playback surface for a queue, playlist, song
  queue, or a single clip opened in the full player. The media dock is just the
  minimized view of this session.
- **Clip-card miniplayer session:** lightweight audition/play-through surface tied to
  the current browsing screen/card list. It lets users quickly check a clip or continue
  manually through visible collection/song/timeline items without building a queue.

Only one session may be audible at a time:
- Starting a clip-card miniplayer pauses the dock/full-player session but keeps the
  dock session available.
- Pressing play/resume on the dock/full player stops the miniplayer and resumes the
  dock/full-player session from its preserved position.
- If miniplayer playback finishes, it resets to start and the dock session stays paused
  until the user resumes it.
- The dock should keep showing the paused dock session while the miniplayer is active;
  it should not be replaced by miniplayer UI.
- The dock needs an explicit close/`X` action to throw away the current dock queue/session.

Navigation/background policy:
- Miniplayer playback stops on in-app navigation away from the owning browsing surface.
- Miniplayer playback may continue through phone lock and app minimization.
- Lock screen controls control whichever session is currently audible.
- Opening Recording, Editor, Practice, Tuner, Metronome, Bluetooth calibration, or other
  focused audio tasks should stop both dock and miniplayer playback unless that flow
  explicitly owns a separate guide/preview engine.

Queue/context policy:
- Miniplayer next/previous is manual only. It does **not** autoplay after a clip ends.
- Collection/Revisit/Activity miniplayer next/previous follows the current visible result
  order.
- Song Timeline miniplayer next/previous follows visible playable song clips.
- Song Evolution miniplayer next/previous uses individual clips plus lineage heads
  (the newest/head clip of a lineage), not middle versions.
- Clip lineage history can traverse lineage versions because that screen explicitly
  represents version history.
- Miniplayer sessions are not savable as queues. If the user wants a durable queue,
  they use the dock/full-player queue actions.

Out of scope for Plan B:
- Recording guide/overdub playback stays separate for now. Recording has stricter
  monitoring, routing, and latency requirements than casual playback.
- Practice mode stays separate and screen-local; it remains non-minimizable and is the
  only place where speed manipulation belongs.
- Editor preview, layer preview, metronome, tuner, Bluetooth calibration, and recording
  recovery/test tones remain local engines unless a later focused plan changes them.

### What to change & why
**Goal:** one root-owned audio service and direct controls, not screen-local inline
engines or store-token commands. The service preserves two logical sessions:
`dockSession` and `miniSession`.

Recommended under-the-hood shape:
- `AudioServiceProvider` replaces/generalizes `FullPlayerProvider`.
- Internally, use **two root-owned playback engines**:
  - dock/full-player engine, based on current `useFullPlayer`
  - miniplayer/audition engine, based on the useful parts of `useInlinePlayer`
- The service centrally enforces audio focus so only one root-owned engine is audible at
  a time.
- This intentionally avoids the current bug class while preserving instant dock resume:
  the dock engine can stay loaded/paused while the miniplayer auditions another clip.

Why two root engines instead of one physical engine:
- A single physical engine makes double audio impossible, but switching from dock queue
  to miniplayer would unload the dock source and make resume slower or more fragile.
- Two **screen-local** engines are the current problem. Two **root-owned** engines under
  one coordinator are acceptable because there is one owner, one focus policy, and no
  request-token race.

Implementation steps:
1. **Create `AudioServiceProvider` at the root.**
   - Keep the current dock/full-player engine behavior intact.
   - Add a root miniplayer engine that replaces all screen-local `useInlinePlayer`
     instances.
   - Expose stable command methods, not a frequently changing giant context value.
2. **Model sessions explicitly.**
   - `dockSession`: queue/single-clip target, queue index, preserved position, playback
     state, lock-screen metadata.
   - `miniSession`: audition target, context list for manual next/previous, owning
     surface key, playback state.
   - `audibleSession`: `"dock" | "mini" | null`.
3. **Replace token commands with direct service calls.**
   - Clip cards call miniplayer methods directly.
   - Dock/full player call dock-session methods directly.
   - Keep compatibility fields temporarily if needed, but do not add new token paths.
4. **Migrate `useInlinePlayer` call sites one surface at a time.**
   - CollectionScreenProvider / collection cards
   - Song ClipList / Takes
   - ClipLineageScreen
   - RevisitScreen
   - ActivityScreen
5. **Keep UI concepts separate.**
   - `GlobalMediaDock` shows/controls only `dockSession`.
   - Clip cards show/control only `miniSession`.
   - Full Player is the maximized view of `dockSession`.
6. **Remove Plan-A interim glue after migration.**
   - Delete `FullPlayerProvider` close-token handler once `requestPlayerClose` is gone.
   - Delete `onBeforePlayNew: requestInlineStop` once miniplayer focus is direct.
7. **Delete old inline infrastructure last.**
   - `useInlinePlayer`
   - `activeInlinePlayerSession`
   - `inlinePlayerOwnerIdCounter`
   - `requestInlineToggle` / `requestInlineSeek` / `requestInlineStop`
   - `inline*RequestToken`
   - `inlinePlayerMounted`
   - dock `kind: "inline"` token branches

### Expected results
- Miniplayer stops on in-app navigation away but can keep playing through lock/app
  minimization.
- Dock/full-player queues stay paused and resumable while users audition clips.
- No ownership races, no orphaned-token no-ops, far less coordination code (net
  deletion).
- Lower control latency for miniplayer and dock controls (direct calls vs
  `store → token → effect → native`).
- Lock screen controls operate on the currently audible session with explicit metadata.
- Screen-local inline engine lifecycle bugs disappear.
- Step 3 gets a single active audible position source from the service, even though the
  service owns two engines.

### Risk / sequencing
Touches all 5 inline call sites + the store + dock/full-player boundaries. Do it as its
own PR, behind manual testing of each clip-list surface (Collection, ClipList/Takes,
Lineage, Revisit, Activity). Land **after** Plan A is verified, **before** step 3.

Stability constraints:
- Do not merge recording guide playback into this service in Plan B.
- Do not merge practice mode into this service in Plan B.
- Do not publish high-frequency position ticks through a broad context that rerenders
  the whole app; expose narrow state and stable commands.
- Do not delete old inline store fields/tokens until all call sites are migrated and
  `rg "useInlinePlayer|requestInline|inlineTarget|inlinePlayerMounted"` is clean or
  intentionally compatibility-only.
- Preserve current Plan A behavior: dock minimize survives navigation, hardware/back
  stops dock playback, and practice cannot minimize.

### Implementation checklist
Use this order to keep the app stable:

1. **Baseline verification**
   - Run the Plan A manual checklist above.
   - Run `npx tsc --noEmit`.
   - Smoke-test recording/import because the Plan A commit touched nearby flows.
2. **Introduce service without deleting old paths**
   - Add `AudioServiceProvider` at the root.
   - Keep existing dock/full-player behavior working through the service.
   - Add root miniplayer engine and methods, but leave old `useInlinePlayer` call sites
     intact until each surface is migrated.
3. **Define service state and commands**
   - Stable commands: `playDockQueue`, `playDockClip`, `pauseDock`, `resumeDock`,
     `stopDock`, `closeDockSession`, `seekDock`, `playMini`, `pauseMini`, `resumeMini`,
     `stopMini`, `seekMini`, `miniNext`, `miniPrevious`.
   - State reads should be narrow: dock session state, mini session state, and active
     audible session. Avoid broad context rerenders on every status tick.
4. **Migrate miniplayer surfaces one at a time**
   - Collection
   - Song ClipList/Takes
   - ClipLineage
   - Revisit
   - Activity
   - After each surface, verify play/pause/seek/stop, next/previous context, lock
     screen behavior, navigation-away behavior, and dock pause/resume interaction.
5. **Convert dock/full player to service API**
   - `GlobalMediaDock` controls only dockSession.
   - `PlayerScreen` remains the maximized dockSession view.
   - Dock close/`X` clears the dock session/queue.
6. **Delete old infrastructure last**
   - Remove old inline tokens/singleton/useInlinePlayer only after the app no longer
     depends on them.
   - Remove Plan-A bridge glue only after miniplayer focus control is direct.
7. **Performance pass**
   - Check that inactive cards do not rerender on every progress update.
   - Check that store writes are throttled and not app-wide.
   - Remove noisy inline debug logs that are no longer needed.

### Plan B verification checklist
- Full player minimize keeps dock session playing.
- Full player back/hardware/gesture back stops dock session and clears dock.
- Dock play/pause/seek/close control the dock session directly.
- Clip-card miniplayer starts immediately and pauses any active dock session.
- Dock remains visible and paused while miniplayer is audible.
- Pressing dock play stops miniplayer and resumes the dock session from its old position.
- Miniplayer finishing resets miniplayer to start and does not resume dock automatically.
- Miniplayer stops on in-app navigation away from its owning surface.
- Miniplayer can continue through phone lock/app minimization.
- Lock screen controls target whichever session is currently audible.
- Collection/Revisit/Activity miniplayer next/previous follows visible result order.
- Song Timeline miniplayer next/previous follows visible playable clips.
- Song Evolution miniplayer next/previous uses lineage heads only.
- ClipLineage miniplayer next/previous follows lineage versions.
- Recording, Editor, Practice, Tuner, Metronome, and Bluetooth calibration stop both
  dock and miniplayer playback on entry.
- Practice mode still cannot minimize and remains the only speed-manipulation flow.
- `npx tsc --noEmit` stays clean.

---

## ⏳ Step 3 — scrubbing & waveform "feel" (the actual jank fix)

> Plan B does **not** automatically fix this. It's a separate problem — UI↔native
> sync — that Plan B makes *tractable* by giving you one clean position source.

### Current build (why it feels imprecise)
The playhead is driven by polled native status pushed through the store:
```
native engine → status tick (~50ms)
            → store publish (THROTTLED to 150–250ms; see useFullPlayer.ts)
            → view reads store → playhead animates
```
So the dot can be **up to ~250ms behind** the real audio and only moves ~4–7×/sec.
Then scrubbing fights the async engine: `useTransportScrubbing.ts` does
pause → seek → `wait(90ms)` → resume, and `useFullPlayer.ts` has **~18 references**
to a `sourcePositionGate` — code whose entire job is to *mask* the native engine
reporting stale positions right after a seek. The system is fighting itself.

### What to change & why
1. **Drive the playhead from a UI-thread clock.** Keep a Reanimated shared value
   `audioProgress`. On each native tick, set an anchor `{positionMs, atTimestamp,
   isPlaying, rate}`. A `useFrameCallback`/`requestAnimationFrame` loop interpolates
   `position = anchor.positionMs + (now - anchor.atTimestamp) * rate` while playing,
   and snaps to the anchor when paused/seeked.
   - *Why:* the dot moves at 60fps and is never more than one native tick stale.
     Native only needs to report occasionally; the UI no longer waits on it.
2. **Gesture owns the visual position during a scrub.** While dragging, the playhead
   follows the finger off the shared value only; **do not** seek native every frame.
   Commit a single `seekTo` on release, then re-anchor the clock to that position.
   - *Why:* removes the pause→seek→wait→resume round-trip flicker; scrubbing is
     instant and smooth.
3. **Delete the gate/override hacks.** With the clock as the source of truth between
   ticks, `sourcePositionGate`, `holdSourcePositionAt`, position overrides, and the
   90ms settle wait can go.
   - *Why:* they only existed to paper over the polled-status lag this approach removes.
4. **Waveform reel:** render the static peaks once (already cached via
   `MANAGED_WAVEFORM_PEAK_COUNT`); the progress overlay reads the same `audioProgress`
   shared value, so the reel and the playhead are perfectly in lockstep.

### Expected results
- Playhead and waveform progress move at 60fps, visually exact, no drift, no jump.
- Scrubbing is instant and "sticky" to the finger; release lands precisely.
- Net code deletion (gate logic, settle waits, override plumbing all gone).
- This is the change that makes playback feel "secure."

### Dependency
Do this **after** Plan B. The service must provide one active audible position source
for whichever root-owned engine is currently audible. Attempting it on the current
screen-local multi-engine token system means fighting the gate logic instead of deleting
it.

---

## 📋 Copy-paste continuation prompt (for a fresh session)

```
We're continuing the SongNook audio architecture refactor. Read
docs/audio-architecture-plan.md for full context first.

STATUS: Plan A (lift the full player to a root FullPlayerProvider) is implemented and
working. Files involved:
- src/hooks/FullPlayerProvider.tsx — holds the single useFullPlayer() engine; ALSO
  contains INTERIM cross-engine glue to delete in Plan B: a root playerCloseRequestToken
  handler + onBeforePlayNew:requestInlineStop bridge (stops two clips playing at once).
- App.tsx — FullPlayerProvider wraps <NavigationContainer>; Player <Stack.Screen> uses
  animation:"slide_from_bottom", animationDuration:260.
- src/components/PlayerScreen/index.tsx — uses useFullPlayerContext().
- src/components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts — beforeRemove listener
  stops audio on every exit except minimize (isMinimizingRef flag); handleBack is just
  goBack().
- src/components/GlobalMediaDock.tsx — controls the live engine via context, branched by
  kind ("player" = direct calls, "inline" = tokens); progress bar reuses MiniProgress.
- src/hooks/useTransportClock.ts — seeds visual playhead from live position on mount.

FIRST: verify Plan A before building on it — run the "Verify Plan A is correct" checklist
in the doc (minimize keeps playing; dock play/pause + drag-scrub drive the same audio;
re-open shows correct position even while paused; on-screen AND hardware/gesture back BOTH
stop audio; playing a clip card stops the dock engine — no double audio). Confirm
`npx tsc --noEmit` is clean. If anything fails, fix A first.

THEN: implement Plan B (root AudioService with dock/full-player and clip-card
miniplayer sessions). In short:
- Generalize FullPlayerProvider into AudioServiceProvider.
- Keep two root-owned playback engines under one coordinator: dock/full-player session
  and clip-card miniplayer/audition session.
- Preserve the UX distinction: GlobalMediaDock + Full Player control dockSession only;
  clip cards control miniSession only.
- Enforce focus directly: starting miniplayer pauses dockSession; resuming dockSession
  stops miniplayer; only one session is audible.
- Replace the 5 screen-local useInlinePlayer call sites (CollectionScreenProvider,
  ClipList, ClipLineageScreen, RevisitScreen, ActivityScreen) with miniplayer reads and
  controls from the service.
- Keep recording guide, practice, editor preview, metronome, tuner, and calibration out
  of Plan B.
- Delete request tokens and the activeInlinePlayerSession / inlinePlayerOwnerIdCounter
  ownership singleton only after all call sites are migrated.
- REMOVE the Plan-A interim glue after migration: the FullPlayerProvider close-token
  handler + the onBeforePlayNew:requestInlineStop bridge. Keep MiniProgress + hideTimes.
Reasoning + expected results are in the doc's "Plan B" section. Work with me and ask
before any decision that changes UX.

Do NOT start the step-3 scrubbing rewrite until Plan B is landed and verified — it
depends on having one active audible position source from the root service.
```
