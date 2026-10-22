# Audit — Recorder & Clip Editor (read-only)

Tree: main `b4a7268` ("Layer recorder: one reel, the take written under the song"). Scope: `src/components/RecordingScreen/**` (incl. the new `TakeRegister.tsx`, `__tests__/takeBars.test.ts`), `src/hooks/useRecording.ts` + `useRecordingDisplayElapsed.ts` (read because every recorder question routes through them), `src/services/recordingTakeSession.ts`, `src/components/EditorScreen/**`, `src/components/common/{ClipInlinePlayer,WaveformStrip,LiveTimeReadout,LevelToneStrip,TimeEntryModal,TimeRangeSelector}.tsx`, `common/clip/**`, the listed `src/domain/*`, `src/hooks/{useClipWaveform,useEditHistory,useDraftText}.ts`, `services/{audioTrim,operationPacing,interactionGate}.ts`, `state/mediaCleanup.ts`, the 3-line `AudioReel.tsx` change, plus `docs/product-plan/clip-editor-audit.md` and `docs/qa/clip-editor-qa.md`.

Every finding below was traced from a real caller / user action. Nothing was run on a device; "high" confidence means the code path is unambiguous, not that I watched it fail.

Counts: **P0 0 · P1 1 · P2 6 · P3 14** (plus dead-code list). SMALL-WINs tagged.

---

## P1

### R1 — Second count-in take after Redo (and after a count-in resume) completes instantly [high]
`src/components/RecordingScreen/hooks/useRecordingScreenModel.ts:1876-2026` + `src/hooks/useMetronome.ts:118,530`

The count-in completion effect fires when `countInPendingRef.current && metronome.countInCompletionToken !== 0`. `countInCompletionToken` is `useState(0)` inside the `useMetronome` instance and only ever increments (`onCountInComplete` → `+1`); it is never reset. The effect's dependency list includes `recording`, which `useRecording` returns as a fresh object literal every render (`useRecording.ts:1158`), so the effect re-runs on every render of the model.

Sequence: take 1 with count-in → token becomes 1. Dock Discard → **Redo** (`redoTake`, stays mounted; also `redoOverdubRecording`). Take 2 with count-in: `handleStartRecording` sets `countInPendingRef.current = true` (line 2178) and then `await metronome.startCountIn(...)`. Inside `startCountIn` (`useMetronome.ts:586-602`) `setNativeState(nextState)` / `setBeatCount(0)` re-render the model **before** `SongNookMetronomeModule.startCountIn` has even been called → effect runs → `countInPendingRef` is true, token is 1 → the completion body executes: `getGridAnchor` reports not running → `downbeatEpochMs = null` → `commitHeadTrim(0)` (pre-roll kept), no `liveTakeGrid`, `setIsArmingRecording(false)`, `metronome.setCountInBarsValue(0)`, and when the click is not meant to run through the take, `stopRecordingMetronome()` kills the count-in that was just starting. The real completion later increments the token but `countInPendingRef` is already false, so it is ignored. For an overdub the phase-locked guide schedule is never awaited (its promise is still null) so the guide starts via the fallback path immediately.

Net: every count-in take after a Redo in the same recorder session has no count-in (or a truncated one), keeps its pre-roll, carries a grid with `firstDownbeatMs: null`, and a layer lands unaligned. The same mechanism makes the "resume with count-in" branch (`handleResumeRecording`, line 2550) fire at once, although that branch is effectively unreachable today (see D3).

Fix (~6 lines): capture the token when arming — `countInTokenAtArmRef.current = metronome.countInCompletionToken` next to `countInPendingRef.current = true` (both arm sites) — and change the guard to `metronome.countInCompletionToken === countInTokenAtArmRef.current → return`. Alternatively reset the token in `startCountIn`. Also worth memoising `useRecording`'s return (see P3-perf) so this effect stops re-running every render.

---

## P2

### R2 — Cancelling a count-in (Redo/Discard during the count, arming failure, interruption) leaves the record-through WAV on disk [high] [SMALL-WIN]
`src/hooks/useRecording.ts:826-847` (`cancelPreparedRecording`), callers `useRecordingScreenModel.ts:1185-1195, 1221-1224, 1987-1990, 2270-2277, 2652-2656`; `src/services/recordingRecovery.ts:105` (`clearPendingRecordingSession` only removes the AsyncStorage key).

Since the 2026-10-17 record-through change, capture is already rolling during the count-in (`startPreparedRecording` at line 2174) while `isArmingRecording` is still true. The dock's Discard is deliberately live during a count-in ("REC-25"); Redo there → `redoTake` → `cancelPendingRecordingStart` → `recording.cancelPreparedRecording()`, which calls `recorder.stopRecording()` and **discards the returned `fileUri`**. `discardRecording` (line 1125) deletes that file; `cancelPreparedRecording` does not, and no sweeper covers the @siteed recorder output directory (`audioRecovery.findOrphanedAudioFiles` scans `SONG_NOOK_AUDIO_DIR` only). One orphan WAV (44.1 kHz float32 mono, i.e. ~10 MB/min) per cancelled count-in, forever. Violates the Data law in spirit (media the library cannot reach).
Fix: in `cancelPreparedRecording`, keep the `stopRecording()` result and `FileSystem.deleteAsync(result.fileUri, { idempotent: true })` exactly as `discardRecording` does.

### R3 — New `TakeRegister` can only draw the last 12 s of the take; the song above keeps scrolling [high]
`src/components/RecordingScreen/components/TakeRegister.tsx:84-104` reads `useTakeLiveWaveform(...).dataPoints`; `src/services/recordingTakeSession.ts:201` `windowDurationMs: 12000`; `src/domain/liveWaveform.ts:144-147` drops every point older than the window.

The register places bars by age behind the playhead ("the take written under the song, on the same timeline"), but its source is the live tape's 12-second ring. The guide reel opens at `initialZoomMultiple = durationMs / 20000` snapped to `ZOOM_LEVELS` 1–16 (`AudioReel.tsx:38,353`), so the visible window is ≥ 20 s for any song longer than ~16 s, and up to `duration/16` (a 5-minute song at max zoom shows 19 s; at zoom 1 the whole song). Everything older than 12 s simply disappears from the lower register while the song above still shows it — the take looks cut off behind the playhead, which is the exact complaint the commit set out to fix. Not visible in the unit test (it feeds points directly).
Fix options: give the register its own long-lived, coarser bucket array (e.g. one max per `msPerBar` bucket appended from `appendAudioStream`, capped at a few thousand entries) rather than the 12 s tape ring; or raise `windowDurationMs` for layer takes (memory is tiny: 25 points/s). Either way the register must not read the ring.

### E1 — Extract with several parts: a failure mid-loop orphans the parts already rendered [high]
`src/components/EditorScreen/hooks/useEditorExportFlow.ts:391-449` (`exportExtract`).
Each region is rendered and **imported into managed storage** (`importRenderedFileToManaged` → `importAudioAsset`) inside the loop; `commitExportedClips` runs only after the loop. If region 3 of 4 throws (native `renderTrim` and the @siteed fallback both reject, or `importAudioAsset` fails on disk space), the catch shows the error alert and returns — the managed files and sidecars of regions 1–2 are never attached and never trashed. Same shape, smaller window, in `exportSplice`/`exportTransform` if `commitExportedClips` throws after import.
Fix: collect `metadata.audioUri` per iteration and `deleteManagedAudioUris(...)` them in the catch (and the native render temp `result.uri` if `importRenderedFileToManaged` failed).

### E2 — "Also delete original" never deletes the original's audio file [high — mechanism; founder call on intent]
`useEditorExportFlow.ts:215` sets `sourceAudioUri: sourceClip.sourceAudioUri ?? sourceClip.audioUri` on every derived clip; `src/services/managedMedia.ts:28` counts `clip.sourceAudioUri` as a live reference; `state/mediaCleanup.ts:28` `trashFilesNoLongerUsed` therefore filters the original out, so `trashFilesOfDroppedClips([sourceClip], "Editor replace")` (lines 290, 332) is a no-op for the take itself.
Result: Replace removes the clip from the library and the sheet says "Replace" in danger red, but the full original WAV stays on disk for good (and is packed into every library export as the clip's source, `libraryExport.ts:716`). Nothing in the app reads `sourceAudioUri` for playback or re-editing (`editRegions` are write-only too). If the intent is "keep the source for a future non-destructive re-edit", the switch's copy ("Delete original") is a lie; if the intent is deletion, drop `sourceAudioUri` from the derived clip when `removeOriginalAfterExport` is on (or exclude it from `collectManagedClipUris` for trash decisions).

### R4 — Overdub guide status at 250 ms + beat events re-render the entire 2820-line model and every child [med]
`useRecordingScreenModel.ts:244-245` (`useAudioPlayer(..., { updateInterval: 250 })` + `useAudioPlayerStatus`), `useMetronome` `setBeatCount` per pulse, `useRecordingDisplayElapsed` 1 Hz commit.
During a layer take with the click on, the model re-renders ≈ 4 (guide status) + 2–4 (beats) + 1 (clock) times per second. Each render rebuilds ~40 closures, a new `recording` object (`useRecording.ts:1158`), a new `metronome` object, and re-runs every `useEffect` whose deps contain those objects (`[recording, ...]` at 2016, `[metronome, takeGridSourceClip]` at 1860), and none of `RecordingHeader/Body/Meta/BottomDock/MetronomeSheet/BeatBreath` is memoised. The tape/register leaves are isolated (good), but the guide reel's `renderBelowSurface`/`renderOverlay` lambdas are recreated per render so `AudioReel` re-renders at the same rate. Not a correctness bug; it is the biggest battery cost in the room. Fix: `useThrottledAudioPlayerStatus` (already used by the editor) or a longer `updateInterval` for the guide, `useMemo` the return objects of `useRecording`/`useMetronome`, `React.memo` on the body/dock.

### E3 — Reel drag of the held part ignores neighbouring parts; overlaps are allowed [med]
`src/components/EditorScreen/index.tsx:676-709` passes `regions={[heldPart]}` to `MultiTimeRangeSelector`, so `minBoundMs/maxBoundMs` (`TimeRangeSelector.tsx:459-460`) are `0`/`durationMs`. The inspector (`spanNeighbors`) clamps correctly, the reel drag does not: a held part can be dragged across another part. `buildSpanRuns` merges overlaps so the render survives, but the list then shows two parts whose spans overlap, the extract titles count them separately, and the save sheet lists both. Fix: pass the neighbour bounds into the selector (or clamp in `onRegionChange` via `spanNeighbors`).

---

## P3

### R5 — Double-tap on Save in the same frame runs two saves [low likelihood, high mechanism] [SMALL-WIN]
`RecordingScreen/index.tsx:41-55` guards with React state `isSavingClip` (closure value), `QuickNameModal` disables its button from the `saving` prop — both render-gated. `useRecording.saveRecording` (line 866) sets `saveInFlightRef` but never checks it. A second `recorder.stopRecording()` on a stopped recorder lands in the catch → "kept for recovery" alert and `unrecoveredTakeThisSession = true`, which triggers a spurious recovery on the next take. Fix: `if (saveInFlightRef.current) return false;` at the top of `saveRecording`.

### R6 — Elapsed clock can only drift forward [med]
`src/hooks/useRecordingDisplayElapsed.ts:66-72, 100-104`: the display is `max(lastDisplay, nativeDuration, anchor + wall)` and re-anchors only when native is **ahead** by 48 ms; a native recorder that stalls (Android audio thread preemption, a BT route renegotiation) lets the wall-clock run ahead and the display never comes back, and on pause it settles at the larger value. Bounded by the actual drift, so cosmetic unless the recorder genuinely drops time — but then the readout lies in the direction that hides the drop. Consider a symmetric re-anchor when native is behind by more than one segment.

### R7 — Mic-permission and prepare failures do not fire `haptic.error()` [high] [SMALL-WIN]
`useRecording.ts:318-342` (`requestMicrophonePermission`), `:459` (`showRecordingFailure`). CLAUDE.md: "Failures MUST fire `error`". Both show a canon `AppAlert` (no raw `Alert.alert`, good) but no haptic; `startRecording`'s disk-full branch does fire it. Permission-denied path otherwise behaves: `prepareRecordingNow` → false → `handleStartRecording` returns before `setIsArmingRecording(true)`, so nothing is stuck.

### R8 — Auto-name uniqueness is computed against the active workspace, not the chosen destination [high]
`useRecordingScreenModel.ts:1545-1552, 1581-1588`: the suggested title is made unique against `activeWorkspaceId`'s clip ideas, then `relocateIdeaToCollection` moves the idea to `saveDestinationOverride.workspaceId`. Two quick records in the same minute saved into another workspace collide there.

### R9 — Recording notification title is hard-coded English [high] [SMALL-WIN]
`useRecording.ts:225` `const recordingNotificationTitle = "Recording…";` while the channel strings next to it go through `t()`. Hebrew users get an English Live Activity / notification line.

### R10 — Metronome sheet: moving a programmed change onto a bar that already has one silently drops one [high]
`RecordingMetronomeSheet.tsx:189-195, 361-370` (`updateChange` with a new `atBar`) and `tempoMap.ts:157-168` (`normalizeTempoMap` keys by bar, last wins). Draft keeps both rows with duplicate React keys (`key={segment.atBar}`, warning in dev), the persisted plan keeps one. Fix: refuse a step onto an occupied bar (`canIncrement/canDecrement`).

### R11 — Idle/placeholder cleanup is implemented twice [med] [dead/duplication]
`useRecordingScreenModel.ts:1286-1295` (unmount effect via `takeInFlightRef` → `appActions.discardEmptyRecordingIdea`) and `:2727-2775` (`abandonedPlaceholderCleanupRef` unmount effect doing the same removal by hand with `authorizeIntentionalEmptyStateWrite(6)`). Both run on unmount; the first wins, the second then finds nothing (idempotent) — harmless but two code paths for one rule. Keep one.

### R12 — `recordingSaveRequestToken` is handled on first mount even if it was raised before the screen existed [low, probably intended]
`useRecordingScreenModel.ts:1600-1605`: `handledSaveRequestRef` starts `null`, so a dock Save (`GlobalMediaDock.tsx:352` raises the token then opens the recorder) triggers `requestSaveRecording()` on mount — that is the dock flow and it works. Note only that a token raised in an earlier session of the screen that never consumed it (e.g. the screen was already unmounting) will also auto-save on the *next* open; harmless because `requestSaveRecording` bails unless a take is live.

### E4 — `TimeRangeSelector` visual branch is dead; it still animates invisible views and keeps `#000` shadows [high] [dead]
Both call sites pass `showVisuals={false}` (`EditorScreen/index.tsx:689`, `PlayerTimeline.tsx:549`). The handle lines, grab pills, wash, their `withSpring` worklets (`TimeRangeSelector.tsx:330-378`), and the `shadowColor: "#000", shadowOpacity: 0.3/0.25` styles (`:496-517`, the exact B2 item from the 2026-08-01 audit) are never visible but still evaluated per frame. Delete the visuals or gate the animated styles on `showVisuals`.

### E5 — `editSnap.snapToGrid` ignores `gridValidToMs`; a second `snapToGrid` already exists [high] [duplicate helper]
`src/domain/editSnap.ts:44-88` vs `src/domain/gridRuler.ts:83-130` (which honours `gridValidToMs` and a 40 % dead-zone). The editor snaps edges onto bar lines past the point the grid stopped being trustworthy (a take with a mid-take route change). Fold the editor's zoom-aware resolution choice into one helper.

### E6 — `useEditorPreviewTransport` memo is defeated every render [med]
`EditorScreen/index.tsx:197-200` passes an inline `seekSourceTo` lambda; `useEditorPreviewTransport.ts:44-61` memoises `source` on it, so `source` is new each render and `useNativePitchTransport`'s `source`-keyed effects (`useNativePitchTransport.ts:598-707`) re-evaluate on every 200 ms status tick. Wrap `seekSourceTo` in `useCallback([player])`.

### E7 — Save sheet can be dismissed mid-export; the export continues and pops two screens later [med]
`EditorSaveSheet` has no cancel while `saving`, but `BottomSheet onClose` (drag away) calls `closeExportModal`, which only pauses preview. The export finishes and `finishExport` → `StackActions.pop(2)` fires from wherever the user has navigated to by then. Low frequency; guard `onClose` while `isExporting`.

### E8 — Replace on a loose clip with no older versions mints a new idea id [med, unverified downstream]
`useEditorExportFlow.ts:243-290`: `kind === "clip"` + remove-original + no stack → the source idea is filtered out and a new idea (new id) inserted. Songbook/setlist/playlist/queue entries that referenced the old idea id are not rewritten here; `docs/qa/clip-editor-qa.md` item 9 already lists this path as never exercised. I did not trace the store's reference pruning on `updateIdeas` — flagging, not asserting.

### R13 — `rgba(192,69,59,0.45)` colour literal [high] [SMALL-WIN]
`RecordingMeta.tsx:101` (idle playhead tint) — off-token; use `hexToRgba(colors.record, 0.45)` as elsewhere.

### R14 — Count-in resume branch is unreachable [high] [dead]
`useRecordingScreenModel.ts:2547-2572`: needs `metronome.countInBars > 0` while paused. The completion effect zeroes `countInBars` after every count-in, and the metronome sheet cannot be opened once a take exists (`metroCustomize` is disabled by `metronomeLockedForTake`, `handleStartRecording` closes it). So `countInModeRef = "resume"` never runs in production — ~25 lines of untested path that R1 would also break if it ever did.

---

## Dead code / unused (all verified by grep)

- `useEditorExportFlow.ts`: `useEffect` import (line 1); `previewWasPlayingRef`, `previewPausePromiseRef` (107-108); `keepRegionIdsKey` (121); `resetPreviewScrubSession` (134-137); args `playheadTimeMs`, `player`, `setCurrentTime` and the `MinimalPlayer` type (31-35, 74-81, 97-104) — `index.tsx:430-441` builds a `player` adapter purely to feed this. [SMALL-WIN]
- `useEditorTransformState.resetTransforms` — no caller.
- `ClipVersion.editRegions` is accumulated on every derived clip (`useEditorExportFlow.ts:222`) and only ever copied/exported; nothing reads it (grep: export/import/activity only).
- `useEditHistory` is not used by the clip editor at all (only `LyricsVersionScreen`); the clip editor has no undo/redo. `useEditHistory` itself is sound: capacity 200, `shift()` keeps `indexRef` consistent, timers cleared on unmount, debounce flushed before undo.
- `RecordingMeta.pinButton` (line 164) is now built on every render but only mounted for plain clips; fine, but `liveTakeGrid`/`livePins` are still threaded into `RecordingMeta` for the layer case where it draws nothing (`RecordingBody.tsx:181-184`).
- `StartFlag` (`RecordingOverdubGuide.tsx:322`) and the `startMs > 0` rect in `TakeRegister.tsx:141` draw the same flag twice (song register + take register) — possibly intended as one line through both; worth a look.
- `operationPacing.ts`, `interactionGate.ts`: no dead exports; `formatDurationEstimate` returns English copy ("under a minute") but its callers are outside this scope.

## Checked and found sound (so nobody re-audits them)

- Live waveform memory: 12 s ring (`liveWaveform.ts:144`), onset envelope capped at 600 k bins (`onsetEnvelope.ts:41`), `observeDuration` freezes after 50 samples. Long takes do not grow unbounded in JS.
- Discard: `discardRecording` deletes the temp file, clears the marker, releases the session, queued behind `discardCleanup` so the next prepare waits. Redo restores the one-shot count-in. Save failure keeps file + marker for next-launch recovery; `unrecoveredTakeThisSession` recovers before a new take overwrites the marker.
- Pause/resume: `holdTakeWhileAsking` pauses the take behind "Discard take?" and resumes via `resumeRecordingRef` (latest closure). Resume re-claims the audio session before the click, phases the click from the measured grid (`resolveResumeClickPhase`, unit-tested), reseeks the guide to `punchInMs + elapsed` and reloads a dead iOS player.
- Minimise-and-continue: per-take facts live in the app-wide `recordingTakeSession`; the remount resyncs the guide once (`guideResyncedRef`). The dock's Save raises a token the model consumes on mount.
- Interruption: handled once per token, pending head trim dropped, session owner released, prewarm released on background.
- `clipEditRemap`: span algebra, seam analysis, pin/section/grid remaps and the `free`/`preserve` policies match the documented semantics and are covered by `clipEditRemap.test.ts`; `complementSpans` is shared with `audioTrim` so audio and metadata cannot disagree. `remapClipForRate` bounds bpm and reports drift honestly.
- `trashFilesOfDroppedClips` flushes before deleting (Data law) — the problem in E2 is what counts as a reference, not the ordering.
- `useClipWaveform`: cold read and generation effects both cancel on change, decode is aborted when deferred; derived-in-render contract respected.
- `TakeRegister` / `RecordingOverdubGuide` / `RecordingBody` (new): hooks are unconditional, `useAnimatedReaction` is self-cleaning, all strings go through `t()`, colours come from tokens (`REEL_SURFACE_COLOR` re-exported from the reel palette). `onLayout` measurers set rounded ints so layout → state does not loop. Only R3 (window) and the duplicated flag above.
- No raw `Alert.alert`, no `__DEV__`-less dev surfaces, no `expo-haptics` direct use in scope. `console.log` is heavy in the model (41 calls, `[timing]` diagnostics) — stripped by babel in release; `console.warn` survives but is error-path only.

## Feature inventory (what a user can do in this scope)

- Recorder (Home → quick record / sketch "Record" / take "New version" / take "Layer" → Recording screen)
  - Record · Pause · Resume · Save (name sheet or auto-name when "Name each recording" is off) · Discard → "Redo / Discard / Keep recording" · Minimise (take keeps rolling, dock shows clock, pause/resume, save)
  - Drop a pin mid-take (pin key on the tape / take register), name pins on the save sheet
  - Metronome: toggle click-through-take, Listen (audition), tempo (nudge/type/tap), meter + feel/accent pattern/subdivision, count-in 0–N bars (one-shot), cues (beep/visual/haptic + levels), click voice, programmed tempo/meter changes for a sketch (bar, bpm, meter rows)
  - Live beat ruler on the tape; beat-breath page edge; count-in big number + dots
  - Input picker (settings "…"): choose mic incl. Bluetooth with warning, refresh; monitoring output shown
  - Timing warnings: uncalibrated/stale/pre-fix Bluetooth calibration → Calibrate; BT mic; mid-take route change; swipe to dismiss
  - Layer recording: guide reel with sections/pins/existing layers, drag the start point (bar-snapped), Listen from start, "From top", headphones hint, take written under the song (TakeRegister), auto-stop at the song's end with "N s left", review lock → "Redo layer / Keep take", punch-in run-up shown as pre-roll
  - Save sheet: name, "Make primary take" (sketch), destination picker (loose clips only, own workspaces), pins list
  - Lyrics: collapsed/expanded perform mode, autoscroll follow/manual, speed multiplier, chord lines
  - Help sheet
- Clip editor (Player → "Edit clip" → Editor)
  - Tabs Keep / Remove / Speed & pitch; reel with ghosted sections and pins, zoom overlay, scrub, to-start/to-end, play-from-part auto-stop
  - Parts: Add at playhead / Split here, hold a part (inspector: edge chips cue, slide, nudge, use playhead, time entry), drag edges/move on reel with grid snap (bar vs beat by zoom), "Keep to grid" toggle, rename kept parts inline, delete part
  - Outcome line: "Grid kept / kept to … / No grid"; footer "Save clips" / "Save copy" / "Nothing left"
  - Save sheet: numbered receipt of clips, splice/transform name, "Delete original" switch → red Replace, spinner key while rendering; toast + pop on success
  - Speed & pitch dials with live preview (native pitch when available), bake into a new clip with scaled pins/sections/grid
  - Overdub gate: "Save combined copy" flattens a layered take and reopens the editor on it
  - Help sheet
