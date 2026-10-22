# Audit — FULL PLAYER / REEL / DOCK / QUEUE

Scope: `src/components/PlayerScreen/**`, `PlayerSheet.tsx`, `playerSheetVisibility.ts`, `GlobalMediaDock.tsx`,
`QueuePanel.tsx`, `MiniProgress.tsx`, `common/AudioReel*.ts(x)`, `common/{OverdubLayerLanes,TransportBar,
TransportLayout,ScrubBar,Slider,Stepper,Knob,SpeedPitchDials,MarkInspector,SpanInspector,LoopMoveHandle,
useHeldScrubGesture}`, `visualizers/**`, `hooks/PlayerSheetPositionProvider.tsx`, `domain/{playerSections,
practicePinLayout,livePins,reelLanes,stepUpLoop,keptPractice,markPhase,markSliderWindow,transportPosition,
queueListing,queueShuffle,playlistPlayback,setlistPlayback}`, plus `state/playerSlice.ts` where the queue
logic actually lives. Every file was read in full; `PlaybackTapeVisualizer.tsx` (2177 lines) end to end.
In-scope jest suites (11 suites / 151 tests) pass. Read-only; no repo files touched.

Counts: **P1 × 1 · P2 × 8 · P3 × 14** (plus a dead-code inventory). Confidence noted per finding.

---

## P1

### 1. Removing the only queued clip from the DOCK's queue panel leaves the audio playing with no UI to stop it
- **Severity P1 · confidence high (static trace, not run on device)**
- `src/components/QueuePanel.tsx:296-306` (`removeAt`), `src/state/playerSlice.ts:118-124`
  (`requestPlayerClose` guard) and `:190-225` (`removeFromPlayerQueue`), `src/hooks/FullPlayerProvider.tsx:166-180`.
- Path: play one clip → collapse to the dock → dock's list button → Edit → remove the row.
  `removeFromPlayerQueue` empties the queue and nulls `playerTarget` (and writes `playerIsPlaying:false` to the
  store), then `removeAt` calls `requestPlayerClose()`. That setter is a deliberate no-op when
  `playerTarget == null && playerQueue.length === 0 && !isPlayerScreenMounted` — exactly the state the removal
  just produced while docked — so `playerCloseRequestToken` never bumps, the root provider's close effect never
  runs, and `closePlayer()` is never called. Nothing in `useFullPlayer.ts` watches the store target going null.
  Result: the dock unmounts (queue empty), the sheet unmounts (`present` false), the expo-audio player keeps
  playing. Only recovery is starting another clip (which pauses it via `onBeforePlayNew`). Inside the expanded
  player the same action works because `isPlayerScreenMounted` is true.
- Fix (small): in `removeAt`, when `before <= 1`, call `useFullPlayerControls().closePlayer()` (or have
  `removeFromPlayerQueue`'s empty branch bump `playerCloseRequestToken`, and let `requestPlayerClose`'s guard
  also pass when the engine still has a target — `FullPlayerProvider` already handles the token when unmounted).

---

## P2

### 2. `PlayerTimeline`'s `React.memo` is defeated by an inline `layerLanesFooter` element → the whole reel re-renders on every playback commit
- **P2 · high** · `src/components/PlayerScreen/index.tsx:1585-1591`, `components/PlayerTimeline.tsx:638`.
- `layerLanesFooter={<LayerLanesFoot … onMerge={() => …} />}` creates a new element every render of
  `PlayerScreenInner`, which re-renders on each throttled status commit (`useThrottledAudioPlayerStatus`:
  once per displayed second while playing, plus every position-dependent state change). Shallow-compare fails →
  `PlayerTimeline` → `AudioReel` (not memoized, new `theme` object + new `handleSeekCommit`) →
  `PlaybackTapeVisualizer` re-renders: rebuilds the pan/pinch/markerDrag gestures (`Gesture.Pan()` etc. are
  not memoized at :1468-1660), re-attaches `GestureDetector`, reconciles every Skia node; `PracticePinBadges`
  rebuilds a Pan+Tap per pin; `OverdubLayerLanes` re-renders every bar `View`. The comment at index.tsx:1026
  ("what lets PlayerTimeline's memo hold across the once-a-second status commit") no longer holds since the
  lanes footer landed 2026-10-22. docs/product-plan/reel-smoothness-findings.md says any commit under the
  reel costs a UI-thread frame.
- Fix [SMALL-WIN]: `useMemo` the footer element on `[data.overdubStemEntries.length]` with the two ref-based
  callbacks hoisted to `useCallback(..., [])` (they only touch `layerSheetRef`).

### 3. Step-up drill rate leaks into the clip's remembered speed (and sticks after the drill ends)
- **P2 · medium-high** · `hooks/useStepUpLoop.ts:84-92`, `hooks/usePerClipPractice.ts:41-49`, `index.tsx:641-663`.
- Start a drill (rate → 0.6×), then advance to the next clip or close Tools / switch the loop off. The step-up
  effect sets `session=null` but never restores the playback rate, so the transport stays at the drill's
  intermediate speed, and `usePerClipPractice` snapshots `current.playbackRate` (the drill rate) as what the
  musician "set" on the clip being left — coming back restores 0.6× as a chosen speed. `keptNow` (Keep switch)
  explicitly guards against this ("what is kept is the speed the musician set"); the per-clip session memory
  does not.
- Fix: in the session-ending paths of `useStepUpLoop` (clip change, loop off, `cancelStepUp`/`toggleStepUp`
  off) restore the pre-drill rate (remember it when the session starts); or feed `usePerClipPractice` the
  musician-set rate the way `keptNow` does.

### 4. Pause inside the loop, then play → playback jumps back to the loop start
- **P2 · medium (confirm intent)** · `hooks/usePracticeLoopController.ts:531-568`.
- `handleTransportToggle` on pause calls `cancelPendingPracticeSeek()` (state → idle). On play, with the loop
  on: `!manualPracticeJumpRef.current && |pos − start| > 20` → `handleLoopAwareSeek(range.start)`. A plain
  pause/resume mid-loop therefore restarts the loop; `shouldStartInsideLoop` is computed but only consulted
  in the else-branch, which suggests the intent was to resume in place. Also applies to the lock-screen play.
- Fix: treat "paused inside the loop" like a manual position (`if (shouldStartInsideLoop) setLoopState("looping")`
  before the seek branch).

### 5. Lane pin hitboxes and the drawn pins can disagree about row/anchor in lanes mode
- **P2 · medium** · `PlayerScreen/PracticePinBadges.tsx:276-287`, `visualizers/PlaybackTapeVisualizer.tsx:1835-1860`.
- The canvas lays pins out with `layoutPinLane(..., (m) => measured.get(m.id)?.width ?? 0)` (Skia-measured
  widths); the RN hitbox layer calls `layoutPinLane(markers, pixelsPerMs, labelScale, durationMs, laneDensity)`
  with the default `estimatePinNameWidth` (6 px/char). When estimate and measurement straddle a clearance
  threshold, one layer puts a name on row 0 and the other on row 1 (or hides it), so the touch target sits a
  row away from the drawn pin. The classic layer explicitly fixed this ("MUST be the same width the caller
  will draw with", practicePinLayout.ts:78); the lanes path regressed it.
- Fix: pass the measured widths down (AudioReel `renderOverlay` args) or measure with the same font in
  `PracticePinBadges`.

### 6. Two Reanimated frame callbacks per reel keep running every frame while the player is open and PAUSED
- **P2 · medium** · `visualizers/PlaybackTapeVisualizer.tsx:1205-1486 and :1678-1738`, `hooks/useAppForeground.ts:44-52`.
- `useForegroundFrameCallback` only stands down in the background or when the sheet is docked
  (`ReelStageVisibleContext`). With the full player open and paused, both callbacks run on every vsync, read
  ~10 shared values, and write `trackingSuspended`/`progressVelocity`/`translateX` each frame — the UI thread
  never idles, so the display can't drop to its idle refresh rate. The recorder's `LiveTapeVisualizer` has
  the same loop but returns early when parked (`parked && |gap| < 0.05`).
- Fix: gate the loops on `isPlayingShared || isDragging || scrubSettle/pauseHold windows` (one derived
  "needsFrames" shared value) or `setActive(false)` while paused and settled.

### 7. `StemAlignmentOverlay` slide-to-move re-renders the layer sheet on the JS thread every gesture frame
- **P2 · medium** · `components/StemAlignmentOverlay.tsx:178-195`, `components/PlayerLayersBench.tsx:172-176`.
- `onUpdate` → `runOnJS(onSlide)` → `setSlidePreviewMs` → bench + overlay re-render; `bars` memo depends on
  `offsetMs` so every frame re-samples `displayBars` (~70–100) peaks for both master and stem, then lays out
  ~100 `View`s. Visible stutter on a 60-fps drag on mid-range Android; the reel's drag is UI-thread for the
  same reason.
- Fix: drive the stem row's `translateX` from a shared value during the drag; commit once on release.

### 8. `OverdubLayerLanes` draws each lane as up to 480 `View`s, rebuilt on every zoom detent
- **P2 · medium** · `common/OverdubLayerLanes.tsx:84-108`.
- `laneBarCount(widthPx)` caps at `MAX_BARS = 480`; eight layers (`MAX_LAYERS_PER_TAKE`) at 16× zoom is
  ~3.8k host views, re-created whenever `zoomStep` crosses a half-octave or `pixelsPerMs` changes (every
  AudioReel resample). The reel next to it draws its wave as one Skia path.
- Fix: one Skia `Path` per lane (or a `<Canvas>` for the whole stack) sharing the reel's transform.

### 9. Kept loop (Keep switch) is never clamped to the clip's duration
- **P2 · medium** · `hooks/usePracticeLoopController.ts:216-236`, `domain/keptPractice.ts:13-37`.
- On a clip switch the kept `{start,end}` is adopted as-is (`saved?.range ?? buildDefaultLoopRegion`); the
  "no longer fits" check only runs when `durationMs` changes afterwards. A take trimmed in the Editor after
  Keep (or a stale duration) can carry `end > durationMs`: the wrap is scheduled past the end, the clip just
  finishes (Repeat/queue logic takes over) and the loop never loops; `LoopMoveHandle` then clamps the start to
  0 with `end` beyond the tape. `normalizeKeptPractice` cannot clamp (no duration).
- Fix [SMALL-WIN]: clamp the adopted range with the same rule used in the duration branch
  (`end <= durationMs + 50 ? range : buildDefaultLoopRegion`).

---

## P3

### 10. `bodyDismissGesture = useRef(buildDismissGesture()).current` builds and discards a Pan gesture (4 worklets) every render
- **P3 · high · [SMALL-WIN]** · `index.tsx:1187`. The comment three lines above explains why the other two
  gestures moved to `useState(() => build())`; this one was missed. Same pattern in
  `GlobalMediaDock.tsx:147-176` (`useRef(Gesture.Pan()…).current`).

### 11. `reorderPlayerQueue` resolves the playing row by `ideaId:clipId` → wrong index when a clip is queued twice
- **P3 · high** · `state/playerSlice.ts:177-189`. A setlist that repeats a song, or a clip added twice, has two
  rows with the same key; a drag-reorder in the queue panel re-points `playerQueueIndex` at the FIRST
  occurrence, so "now playing" jumps rows (and next/previous go from the wrong place). `buildQueueRowKeys`
  already disambiguates by occurrence; reorder should match by that key (or by object identity — the row
  objects are the live queue items).

### 12. Full-player queue button is disabled for a one-item queue; the dock's is not
- **P3 · high** · `components/PlayerFooterSection.tsx:68-71` vs `GlobalMediaDock.tsx:112-116` and the
  comment in `PlayerSupportSections.tsx:36` ("never a dead tap"). From the expanded player with a single clip
  you cannot open the queue, so "Save as playlist" / remove are unreachable there. Pick one rule.

### 13. Motion literals outside `design/motion.ts`
- **P3 · high · [SMALL-WIN]** · `PlayerSheet.tsx:20-21` (`OPEN_DURATION = 300`, `CLOSE_DURATION = 240`),
  `GlobalMediaDock.tsx:292-293,410` (`FadeInDown.duration(200)`, `FadeOut.duration(150)`),
  `AudioReel.tsx:946-947,989-990` (`FadeIn.duration(140)`/`FadeOut.duration(120)`), `AudioReel.tsx:675`
  (`setTimeout(…, 2800)`). House rule: "No numeric duration/spring literals".

### 14. Colour literals outside `design/tokens.ts` in live (non-legacy-stylesheet) code
- **P3 · high** · `TransportBar.tsx` (`#c4b5b2`, `#6b5a55`, `#d3c1ba`, `#F4ECE9`, `#EAE5DF`),
  `GlobalMediaDock.tsx:321,398` (`#8b4f3b`, `rgba(253,251,247,0.82)`), `QueuePanel.tsx:114,467`
  (`#B4574A`, `#8b4f3b`), `LoopMoveHandle.tsx:25,146` (`LOOP_ACCENT`, `shadowColor "#0f172a"` — pure-black
  family shadow), `LiveTapeVisualizer.tsx:437` (`#B5483A`), `MinimapVisualizer.tsx:391` (`#1e293b`).
  The reel palettes (`AudioReel.tsx:76-110`) are the one deliberate exception, but see #22.

### 15. `MiniProgress` recreates its `PanResponder` every render and can get stuck showing the drag position
- **P3 · medium** · `MiniProgress.tsx:99-118, 51-57`. `useMemo` deps include `beginDrag`/`commitSeek`/
  `updateDragPosition`, all new closures each render → memo never hits. After a release, `dragMs` is only
  cleared once `currentMs` lands within 160 ms of it; a seek the host rounds/clamps further away (e.g. a
  near-end seek, or a source that never reports) leaves the dot parked at the finger position until the
  next drag. Only caller is `ClipInlinePlayer` (card preview).

### 16. `Stepper` hold-repeat keeps firing after the key hits its bound
- **P3 · medium** · `common/Stepper.tsx:63-80`. `setInterval(step)` is only cleared on `onPressOut`; when
  `enabled` flips false mid-hold (pitch reaches ±12) the interval keeps calling `onStep` (each caller clamps,
  so no wrong value, but a `tick` haptic buzzes at the stop every 110 ms until the finger lifts).

### 17. `PlayerPracticeDrawers` is unmemoized and receives `playheadMs`; every Tools render rebuilds all rows and five modals
- **P3 · medium** · `index.tsx:1965-2060`. Once-a-second while playing (plus every inline-arrow prop), the
  marks list (rows + `SpanInspector`), three `PinDetailModal`/`SectionDetailModal`s, the step-up sheet and
  help sheet all reconcile. Acceptable at 1 Hz; memoising `renderMarkRow` per entry would remove it.

### 18. Reel fling can commit a seek after the reel's clip changed
- **P3 · low** · `PlaybackTapeVisualizer.tsx:1527-1546`. `withDecay` on `audioProgress` (a shared value
  owned by `index.tsx`) is only cancelled by the next gesture/reset effect; its completion callback runs
  `runOnJS(onSeek)` with the `onSeek` closure captured when the gesture was built. A queue advance that lands
  during a long fling would seek the new clip to the old clip's fraction. Rare (needs a fling to span the
  clip change).

### 19. `ScrubBar` writes a shared value during render
- **P3 · low** · `common/ScrubBar.tsx:48`: `detents.value = durationMs / 1000;` in the render body.
  Reanimated's strict mode flags render-time access; move to an effect or pass the number into the gesture.

### 20. `classicReel` is a persisted feature flag with no way to set it
- **P3 · high (dead flag)** · `state/dataSlice.ts:133,1504,1782` has `setClassicReel`, no component calls it.
  The classic drawing branches (`PinBadgeChipsOverlay`, `PinMarkerOverlay`, `SectionBandOverlay`, the classic
  loop look, `CLASSIC_PRACTICE_REEL_HEIGHT`, the classic minimap marks, PracticePinBadges' badge twin) are
  unreachable in a fresh install; only a device whose persisted snapshot still holds `classicReel: true`
  from an older build would draw them. Either re-expose the switch in Settings or retire the branch and
  the flag (with a migration that drops the key).

### 21. `requestPlayerClose` guard contradicts the dock's "always-enabled" queue button (root cause of #1)
- Listed with #1; worth a unit test in `playerSlice.test.ts` ("removing the last item while docked still
  requests a close").

### 22. The reel's dark palette is dead
- **P3 · high** · `AudioReel.tsx:96-110` `DARK_REEL_PALETTE` (+ `MinimapVisualizer.tsx:109-118` dark branch,
  `styles.container.backgroundColor "#1e293b"`). Every `AudioReel` caller passes `chrome="light"`
  (PlayerTimeline, EditorScreen, RecordingOverdubGuide); the default `"dark"` is never used.

### 23. `Dimensions.get("window").height` captured at module load
- **P3 · low** · `PlayerSheetPositionProvider.tsx:7`, `index.tsx:92`. Fine for this portrait-only, phone-only
  build (`app.json`: `orientation: portrait`, `supportsTablet: false`); would break on Android window
  resizes (split screen / foldable) if either ever flips.

---

## Dead code inventory (verified by grep; none referenced outside their own file unless noted)

- `PlayerScreen/styles.ts` — **161 of 240 keys unused** (whole retired UIs: `toolsPill*`, `speedPopover*`,
  `practice*`, `toggle*`, `optionChip*`, `practicePitch*`, `categorySegment*`, `toolSelector/toolTab*`,
  `settings*/settingChip*`, `pin*` tray/row/note (29 keys), `section*` tray/adjuster/ibeam (≈40 keys),
  `recordLayer*`, `analysis*` (7), `toolCard/toolHeader/toolBody/toolChip*/toolLoop*/toolPitch*` (≈25),
  `loopSection*`, `dismissSpacer`, `bareGlyphButton`, `marksInk`, `layerKey`, `notesInlineText`, `inspector`).
  Full list: run `/tmp/claude-0/-home-user-song-seed/e1371001-6203-5155-bb17-330302ea49ab/scratchpad/deadkeys.js`.
- `components/practiceDrawerStyles.ts` — 24 of 94 unused: `inspector, edgesRow, edgeChip, edgeChipActive,
  edgeChipLabel, edgeChipLabelActive, edgeChipTime, edgeArrow, usePlayheadBtn, usePlayheadText, dragRow,
  dragSlider, nudgeBtn, inspectorHint` (moved into `MarkInspector`'s own sheet), `rowInCard,
  stepUpSwitchDisabled, stepUpValueRow, stepUpPlanName, stepUpClimb, inkOptionRow, ghostRow, recordLayerRow,
  recordLayerDot, recordLayerText`.
- `common/Knob.tsx` — no importer anywhere (the Sound room uses `LevelToneStrip`/`Slider`). Whole file dead.
- `common/TransportBar.tsx` — `speedBadge`, `speedActive`, `onSpeedPress` props and `speedBadge*` styles: no caller.
- `components/StemAlignmentOverlay.tsx` — `sharedPlayheadMs`, `playheadColor`, `followMs` props and the
  `StripPlayhead` component: no caller passes them (the bench deliberately "holds still").
- `MiniProgress.tsx` — `showTopDivider`, `extraBottomMargin`, `captureWholeLane`, `hideTimes`, `accentColor`
  never passed (only `compact`/`flankTimes` are).
- `components/PlayerPracticeDrawers.tsx` — unused imports `formatBpmLabel`, `hasAnalysisResult`,
  `isTempoSteady`; props `analysis`, `recordingGridBpm`, `isAnalyzing`, `analysisError`, `onDetectAnalysis`
  are accepted and never rendered (the Detect row was hidden 2026-10-13, comment at :935-942). Upstream,
  `hooks/useClipAnalysis.ts` and `index.tsx:928-933` exist only to feed them.
- `hooks/usePlayerPins.ts` — `expandedPinId`, `pinNoteDraft`, `setPinNoteDraft`, `togglePinExpanded`,
  `commitPinNote` are destructured in `index.tsx:885-889` and never used.
- `hooks/usePlayerSections.ts` — `editingSectionId`, `draftLabel`, `setDraftLabel`, `handleToggleEdit`,
  `handleChangeSectionKind`, `handleCommitRename` have no consumer.
- `hooks/usePracticeLoopController.ts` — `resetPracticeLoopRange`, `movePracticeLoopToPlayhead`, `isPinDragging`
  destructured in `index.tsx:751-754` and unused (plus `buildLoopRegionPreservingSpan`, only reachable from them).
- `components/PlayerTimeline.tsx` — props `practiceLoopEnabled`, `onRequestAddPin` accepted, never read;
  `onTogglePlay`/`onSeekToStart`/`onSeekToEnd` are forwarded only to `AudioReel`'s `@deprecated` ignored props
  (also still passed by `RecordingOverdubGuide.tsx:183,240-242`).
- `common/SpeedPitchDials.tsx` — styles `dialUnit`, `dialUnitChanged` unused.
- `PlayerScreen/helpers.ts` — `getNoteSummary` has no caller.
- `components/StepUpSequenceSheet.tsx` — `SAVED_SEQUENCES_ENABLED = false` parks a whole saved-presets UI +
  `useStepUpPresetsStore.userPresets/saveUserPreset/removeUserPreset` (documented as parked 2026-08-01).
- Stale comments: `index.tsx:1113-1116` and `:2179` say the status hook re-renders "at 20Hz"; it commits once
  per displayed second (`useThrottledAudioPlayerStatus.ts:81`).

## Checked and found sound (so the caller doesn't re-audit)

- Reel hot path: position reaches the tape through `createTransportPositionChannel` → shared values with no
  React commit; `PlaybackTapeVisualizer` subscribes to NO store selector (only `AudioReel` reads
  `classicReel`); `PlayerTimeline` passes `currentTimeMs={0}`; the React tree commits ~1 Hz while playing.
  Wave/ruler paths are memoised on peaks/width; `playedClip` rebuilds only a plain rect object per frame;
  pinch reports go through `runOnJS` per pinch frame but `handlePinchZoomUpdate` early-returns until a
  detent crosses. Overlays use `useDerivedValue`/`useAnimatedStyle`, no per-frame JS reads.
- `advanceTracker` α-β filter and the pause/scrub/seek-landed gating are consistent with their tests.
- Queue: end-of-clip advance is single-owner (sheet when active, root provider when docked; token consumed
  exactly once); `shuffleQueue`/`unshuffleQueue` handle grouped setlist parts, removals and additions
  correctly (tests pass); `removeFromPlayerQueue` index math is right; `buildPlaylistQueue`/`buildSetlistQueue`
  skip unavailable rows and fall back to index 0.
- Dock/sheet: one `dragY` shared between dock swipe-up and header drag-down; sheet is hidden (not unmounted)
  under obscuring routes; selection-toolbar lift rules are pure and tested; Android back collapses the sheet;
  safe areas handled (`edges` left/right/bottom + dock `insets.bottom`); `PlayerLyricsWriter` uses
  `KeyboardAvoidingView` and flushes its autosave on blur/unmount.
- Haptics all go through `design/haptics.ts`; every user string is `t()`; no raw `Alert.alert`; `console.warn`
  only on genuine failure paths; `__DEV__` used once, correctly (Send link in dev builds).
- Timers/subscriptions in scope all clean up (`zoomCollapseTimer`, wrap timer, solo-mix settle timer,
  lyrics autoscroll interval, position-channel subscriptions, AppState listeners).

---

## Feature inventory (what a user can do here)

- Dock (any page, session active): tap title → open full player · swipe up → open · prev (restart past 3 s,
  else previous) · play/pause · next · queue list (n/n) → queue sheet · ✕ end session · recording dock:
  pause/resume take, stop & save, tap → recorder.
- Queue sheet (dock and full player): tap row → jump · Shuffle (keeps playing item, restores order) ·
  Save as playlist → playlist chooser · Edit → drag-reorder, remove · "view in collection" per row ·
  follows the playing row.
- Full player sheet: grabber/drag-down/scrim tap/Android back → collapse (session persists) · ⋯ overflow:
  Trim audio (editor) / Save combined as new, Save combined & edit (layered takes), Make sketch (standalone
  clip), Set aside (Shelf), Share… (audio file / SongNook Send link), Delete clip (or whole song if last).
- Reel: scrub, fling, tap-seek, pinch-zoom, −/+/fit zoom puck, minimap scrub, section rule tap → jump,
  pin tap → jump · Marks toggle · Layer key → record a layer at the playhead (Pro past the free layer, max 8)
  · Tools toggle.
- Transport footer: prev / play-pause (with count-in: 3 s run-up, 1 or 2 bars) / next · queue or Repeat ·
  ✕ end session.
- Listening page: Lyrics tile/slot → read or write against the tape · Chart tile/slot → read or build chart ·
  Notes page (clip or take notes) · Sketch door (first clip) → grow into a sketch.
- Reading: Follow (playhead-synced scroll, Resync), follow speed −/+, Aa sheet (size, chords on/off, key,
  capo), edit pencil (lyrics writer / chart builder), full view (thread scrubber), take's page vs latest page.
- Writing (lyrics against the tape): autosave, Loop chip, loop-a-part picker, new version (from current /
  blank), play/pause in the bar.
- Tools › Marks: add section (presets / custom name+ink) · add pin (named on the spot, note) · select a mark:
  edge chips, windowed slider, zoom-scaled nudges, use-playhead, snap to neighbour, hold-to-type time ·
  play-from glyph · undo/redo · reel: hold-drag pins/sections (push neighbours).
- Tools › Loop: loop on/off, start/end editing, loop a section, loop move handle, Step up (3 built-in drills,
  custom stages, restart, finish toast), Count-in (3 s / 1 bar / 2 bars).
- Tools › Sound: Click on/off + volume + haptic (gridded takes), speed 0.5–1.5× (presets, slider, heard live),
  pitch ±12 semitones (native engine), take level/tone strip · Keep settings switch (saved with the take) ·
  Reset all.
- Layers (lanes under the reel): collapse/expand, fold all, Solo (any number; main transport plays a solo mix),
  Mute, tap lane → layer sheet: play from a bit before the layer, Solo, alignment strip (slide, zoom, beat
  snap), ±5/±25 ms nudges, Original, level/tone, rename, remove · Merge layers (pick ≥2, name) ·
  Combine (save copy / replace take).
