# Performance Audit — why the app "doesn't feel strong"

Date: 2026-07-07 · Branch: `claude/perf-audit`

Scope: traced the three reported symptoms (clip-card play delay, page-open delay, full-player
reel load/resize) through the actual code paths, plus a structural sweep for bloat.
Fixes marked ✅ landed on this branch; the rest are ranked recommendations.

---

## The honest headline: dev builds are a big chunk of the "amateur feel"

Everything is being judged in a Metro dev build. Dev mode runs unminified JS with dev-mode
React (extra validation on every render), and **every `console.log` serializes across the
bridge to Metro** — this app logs heavily (`[timing]`, `[playback]`, `[pitch]`,
`[waveform]`), often in bursts exactly during the interactions being judged. A release
build is typically 2–5× snappier on the JS thread with zero code changes.

**Action:** judge feel on a release build (`npx expo run:android --variant release`)
before optimizing further. ✅ Release builds now strip `console.log/debug` via babel
(`transform-remove-console`, keeping error/warn), so shipping builds never pay for the
diagnostic logging.

---

## Fixed on this branch

### 1. ✅ Clip-card play felt dead for a beat
`toggleInlinePlayback` awaited `onBeforePlayNew()` (pause the full player — a native
roundtrip) **before** setting the optimistic "playing" UI state. The card didn't react
until another player had finished pausing. Reordered: UI flips on the same tick as the
tap; the pause + source load overlap behind it. (`src/hooks/useInlinePlayer.ts`)

Remaining tap→sound gap is the native source load (file open + codec init), which is
inherent; what matters for feel is that the UI now responds instantly.

### 2. ✅ First full-player open of a fresh clip decoded the whole file
The reel's detail waveform (2048-point sidecar) was generated **on first open** — a full
native decode of the entire audio, visible as "the reel takes a moment to load." Sidecars
are now warmed in the background at recording-save time (regular takes and layer stems);
editor exports already did this. (`useRecordingScreenModel.ts` save callback)

### 3. ✅ Passive persistence could starve during playback
Playback position ticks into the store every ~100ms reset the 800ms trailing persist
debounce forever — a long listen deferred the passive snapshot write indefinitely. Added
a 4s max-wait cap. (`src/state/useStore.ts`)

---

## Ranked recommendations (not yet done)

### A. Move live playback position out of the main zustand store (medium effort, big win)
`setPlayerPlaybackState` / `setInlinePlaybackState` write `positionMs` into the **main
persisted store** at ~10Hz during any playback. Every write runs the persist middleware's
partialize, the manifest subscriber's snapshot build, notifies every store subscriber
(selector re-evaluation), and reschedules the persist debounce. None of that state is
persisted — it's pure runtime UI state. Move position/duration ticks to a separate
lightweight store (or shared values, like the reel already uses); keep only
target/isPlaying in the main store. This removes ~10 full store-notification cycles per
second during every playback session, app-wide.

### B. Defer heavy screen-model work past the navigation transition (medium, felt on every push)
Screen models (23 hooks subscribe to the whole `workspaces` array) compute their full
derived state synchronously during mount — i.e., during the native push animation, which
is exactly when jank is most visible. Standard fix: gate the heavy derivations behind
`InteractionManager.runAfterInteractions` (or `useDeferredValue`) and render the cheap
shell first. Highest-value targets: CollectionScreen, PlayerScreen, ActivityScreen.

### C. Narrow the `GlobalMediaDock` subscription (small)
The dock is mounted app-wide and subscribes to `s.workspaces` — it re-renders (and
re-derives its queue entry lookups) on **every** library edit anywhere, even while
invisible. It only needs the active queue target's idea/clip; select those.

### D. Batch-selector audit (small, mechanical)
A few components run `useStore` selectors that allocate (`.includes`, `.find` in the
selector body — e.g. `IdeaListItem`'s `selectedListIdeaIds.includes(...)` per card).
Fine at rest, multiplied in long lists during selection mode. Convert to set-membership
maps computed once per list.

### E. Reel thumbnail→detail swap (cosmetic)
When the 2048-point sidecar lands, the reel redraws from the 256-point thumbnail — a
visible "pop" on first open of older clips (fresh clips are now pre-warmed at save).
Options: crossfade the swap, or persist a one-time backfill pass that generates sidecars
for existing clips in idle time.

### F. What was already healthy (no action)
- Collection lists are FlatList-virtualized; per-card playback progress is isolated to
  the active card (a dedicated subcomponent subscribes to position ticks).
- Audio-session activation is cached (no redundant native `setAudioModeAsync` calls).
- The store's `partialize` snapshot is shallow (references, not clones).
- The earlier fixes (debounced persistence, background mix renders, no transport lock)
  removed the biggest whole-app stalls; this audit is the next layer down.

---

## Suggested order
1. Judge a **release build** first — recalibrate which of the above still feel bad.
2. A (position out of store) — biggest structural win.
3. B (defer mount work) on the 2–3 heaviest screens.
4. C/D/E as polish.
