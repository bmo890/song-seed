# Metronome, Grid & Transport — master plan

Status: **Phases A–E + G DONE 2026-07-29** (iOS rebuilt and sim-verified through
the whole chain: programmed change → native map-engine count-in/record → head
trim → ruler; playback click runs the native map path across boundaries).
Remaining: F (shared transport, rides the next audio-engine opening), plus the
DEVICE listening tests and an Android build — see the checklist notes.
Owner intent: turn the metronome from a well-engineered sibling feature into the
app's musical timebase — DAW-trustworthy, grid-tied recording *and* playback,
pre-programmable tempo/meter changes, bars on the reel.

This document is written to be executable by a fresh session with no chat
context. Read `CLAUDE.md` and `docs/design-system.md` before any UI phase.

---

## 0a. Owed at the machine (next working session)

Everything here needs hardware or a live desktop — none of it can run remotely,
and none of it blocks further code work.

1. **Android compile check** — the Kotlin map engine (`startMapRun`,
   `writeMapChunks`, `renderMapChunk`, `pollMapBeatProgress`) has NEVER been
   compiled. Highest risk item on the list: unverified new native code.
   `android/gradlew` exists; `ANDROID_HOME` was unset in this shell, so point it
   at `~/Library/Android/sdk` first. A `:app:compileDebugKotlin` is enough —
   no emulator, no device needed.
2. **Simulator soak** — run the click ~10 minutes on a programmed-changes take
   and watch the `[timing] click drift` logs. Retires the last engine risk that
   doesn't need ears (the iOS 32-pulse scheduling window has only seen ~50s
   runs). Needs a Mac that stays awake; a closed laptop kills the simulator.
3. **Device listening pass** (physical iPhone, the only ears test):
   - is the phase-started click actually aligned to the take?
   - are native map boundaries seamless, or is there an audible seam?
   - does the count-in hand off cleanly into playback?
   - how does the new slide-to-move gesture FEEL — magnet too strong / weak?
   - click voice quality: per-click renderer (map mode) vs the loop buffer.
4. Also riding this rebuild: waveform probe, lock-screen, tuner (older
   pending-rebuild items from other efforts).

---

## 0. Ground truth (verified in code, 2026-07-28)

What exists and works:

- **Native metronome engines** (`modules/songnook-metronome/`): iOS
  `SongNookMetronomeEngine.swift` (AVAudioEngine + AVAudioPlayerNode, looping
  one-bar PCM buffer, Bresenham sample-exact bar math, 8ms poll off the audio
  render clock) and Android `SongNookMetronomeEngine.kt` (AudioTrack, same
  contract). JS falls back to a legacy expo-audio WAV-loop implementation
  (`src/hooks/useMetronome.ts` `useLegacyMetronomeImpl`) when the module is
  absent (web / old binaries).
- **Grid anchor**: `getGridAnchor()` — epoch of pulse 0 + exact pulse spacing.
  The JS visual scheduler and haptic scheduling hang off it.
- **Latency model** (`src/services/latencyModel.ts`): single source of truth.
  Route output latency (OS / calibration / default), input latency, per-modality
  cue leads (audible/haptic/visual), BT ear calibrations + drift, and the
  record-trim correction. Nothing outside that file may invent latency numbers.
- **Record-through count-in** (`src/components/RecordingScreen/hooks/`
  `useRecordingScreenModel.ts` ~line 1130): capture rolls before the count-in;
  on count-in completion the downbeat epoch is computed from the grid anchor,
  latency-corrected, and committed as a head trim. No start race exists.
- **RecordingGrid** (`src/types.ts` ~394): per-take snapshot {bpm, meterId,
  countInBars, clickThroughTake, firstDownbeatMs, gridValidToMs?, source}.
  Stamped on clips and overdub stems, travels through share/archive, presets
  the metronome for overdub/re-record.
- **Reel** (`src/components/common/AudioReel.tsx` + `PlaybackTapeVisualizer`):
  scrolling tape with zoom levels, section bands (`SectionBand` from
  `src/domain/playerSections.ts`) that scroll with the waveform.

What does NOT exist (the gaps this plan closes):

- No playback metronome. The practice panel's count-in option
  (`usePlayerScreenUi.ts` `countInOption`) is **display-only — wired to
  nothing**.
- No tempo map. One constant bpm/meter per engine run; tempo change = full
  engine restart with phase reset (`configure()` treats bpm as structural).
- No bars/beats on any reel or timeline.
- No shared clock: metronome, player (expo-audio), and recorder
  (`useSharedAudioRecorder` + `trimAudioRanges`) are separate engines
  reconciled through epoch-ms math.

---

## 1. Product frame

North star unchanged: *a quiet place to finish creative work*. This is not a
DAW pivot. The grid is manuscript paper under the sketch — visible, trustworthy,
never loud. Guardrails:

- Default experience stays: pick a tempo, count in, record. Everything new is
  progressive disclosure behind one quiet affordance.
- The engine becomes fully capable (tempo maps, subdivisions, accents); the UI
  surfaces a curated subset. Capability lives in data (the song's grid), not in
  a settings jungle.
- Terminology (needs founder sign-off, see §9): user-facing word is **grid**
  ("beat grid" on first mention). Internal type names: `TempoMap`,
  `TempoSegment`, `Transport`. Never "click track", never "project tempo".

---

## 2. Data model — `TempoMap` (Phase A)

New file `src/domain/tempoMap.ts` (pure TS, no RN imports — fully unit-testable).

```ts
/** One constant-tempo stretch. Changes anchor at BAR BOUNDARIES only (v1). */
export type TempoSegment = {
  /** 1-based bar at which this segment takes effect. First segment must be bar 1. */
  atBar: number;
  bpm: number;
  meterId: MetronomeMeterId;
};

export type TempoMap = {
  schemaVersion: 1;
  segments: TempoSegment[]; // sorted by atBar, unique atBar, first at bar 1
};
```

Core math (all pure, all property-tested):

- `barStartMs(map, bar)` / `beatAtMs(map, ms)` / `msAtBeat(map, {bar, beat})`
  — the bidirectional musical-time ↔ clock-time conversion. Everything else
  (reel ticks, playback click phase, count-in length, punch snapping) derives
  from these two functions and `firstDownbeatMs`.
- `normalizeTempoMap()` — sort, dedupe, clamp bpm 40–240, drop no-op segments.
- `singleSegmentMap(bpm, meterId)` — bridge from every existing `RecordingGrid`.

Decisions locked for v1 (revisit later, do not build now):

- **Step changes only.** No ramps/ritardando in the data model v1 — but the
  `TempoSegment` shape must not preclude adding `rampToBpm?` later.
- **Bar-anchored only.** No mid-bar changes, no time-anchored changes. Musically
  intuitive, keeps beatAtMs monotonic and trivially invertible.
- **Pickup/anacrusis deferred** (§9 open decisions).

### RecordingGrid v2

Extend, never replace: `RecordingGrid` gains optional `tempoMap?: TempoMap`.
Absent ⇒ single-segment map from its own bpm/meterId (helper
`gridTempoMap(grid)`). `bpm`/`meterId` stay REQUIRED and mirror segment 1, so
**every old reader keeps working untouched** — old binaries reading new clips
see a normal grid; new binaries reading old clips synthesize the map.

### Sketch-level Song Grid

New optional field on the sketch (workspace) entity: `songGrid?: TempoMap` plus
`songGridUpdatedAt`. This is the *plan* you program before recording; each
take still snapshots its own frozen `recordingGrid` at record start (existing
principle — a take's grid never changes retroactively). Store in
`dataSlice`/persisted snapshot with the usual schema-version discipline.

### Share/archive round-trip

- `libraryArchiveManifest.ts` / `libraryExport.ts` / `libraryImport.ts`: carry
  `tempoMap` + `songGrid` through. Import must tolerate their absence AND
  tolerate unknown future fields (verify current parsers ignore unknowns —
  if they strip fields, fix that first).
- Extend `src/services/__tests__/libraryArchiveRoundTrip.test.ts` with
  map-bearing fixtures, including an old-format archive (no map).
- Received songs "maybe with metronome metadata": `TempoMap` **is** the
  interchange format. A received song's manifest may carry a full map; the
  practice player follows it.

**Acceptance**: `npx tsc --noEmit` clean; new `tempoMap.test.ts` covers
round-trip ms↔beat identities across multi-segment maps (property test: for
random maps, `beatAtMs(msAtBeat(x)) === x`), meter changes, and boundary bars;
archive round-trip green. Zero UI change; safe to ship silently.

---

## 3. Reel grid visuals (Phase B — pure rendering, biggest visible win per risk)

Draw the grid on the tape. Purely derived from `recordingGrid` (or
`songGrid` during recording) via Phase A math — no timing risk, no native work.

Concept (final visual language belongs to the design pass, after the in-flight
metronome UI redesign lands — keep these as principles, not pixels):

- **Bar lines**: faint vertical rules under the waveform, manuscript-paper
  quiet. Ink at low opacity from tokens; never terracotta. Beat ticks (shorter,
  fainter) appear only past a zoom threshold — reuse the reel's existing
  zoom-density philosophy (`ZOOM_LEVELS`, bar-pitch constants).
- **Bar numbers**: sparse (every 4/8 bars depending on zoom), tabular Jakarta,
  metadata-line size.
- **Meter/tempo change markers**: a small inline label at the bar line where a
  segment starts ("6/8 · 70"), scrolling with the tape exactly like section
  bands — same layer, same motion. Sections and grid markers must not collide:
  grid markers sit on the ruler line, sections keep their band.
- **Count-in pre-roll**: if the file retains pre-roll (head trim committed 0),
  shade the region before `firstDownbeatMs` as "before the one".
- **Trust honesty**: past `gridValidToMs`, fade the ruler out. The data already
  records where the grid stopped being trustworthy — show it, quietly.
- **Live recording reel**: same ruler scrolls during record-through (grid comes
  from the take's snapshot, anchor = measured downbeat).
- **Scrub snap**: optional snap-to-bar while scrubbing when a grid exists —
  haptic `tap` on bar crossing (cite vocabulary row when implementing). Snap is
  assistive, never forced; fine scrub still works.

Implementation shape: a `GridRuler` sublayer inside the tape visualizer taking
`{tempoMap, firstDownbeatMs, gridValidToMs, pxPerMs, windowStartMs}`; math via
Phase A helpers. Clips with no grid: no ruler (not an empty ruler).

**Acceptance**: screenshots at multiple zooms in the iOS simulator; RTL check;
a 90-bpm clip's bar lines land exactly on audible beats when playing (manual
verify with Phase C click once it exists). No layout shift when grid
absent→present (layout-stability rule).

---

## 4. Playback click + real count-in (Phase C)

Make the practice player's grid audible. Works against the **current** engines
with one small additive native API; gets free upgrades later from Phase E/F.

### Native addition (both platforms, additive, capability-gated)

`startAtPhase({ offsetMs })`: start the click loop at frame
`round(offsetMs/1000 * sampleRate) % totalFrames` instead of frame 0 (iOS:
schedule the buffer starting mid-buffer then loop; Android: set playback head
position before play). Capability probe `supportsPhaseStart()` following the
existing `supportsScheduledCues` pattern — **old binaries must keep working
with the feature simply absent.**

### JS orchestration (new hook `usePlaybackClick`)

- Resolve the clip's grid: `recordingGrid` → else `ClipAnalysis.bpm` when
  `isTempoSteady` (source `"detected"`, `firstDownbeatMs` unknown → beat-phase
  from analysis onset if available, else offer tap-to-set-the-one; until set,
  detected-tempo click is OFFERED not auto-enabled) → else no click available
  (control disabled with quiet hint).
- On play from position `p`: compute phase `((p − firstDownbeatMs) mod barMs)`
  via tempo-map math, configure engine to the segment containing `p`, start
  with `startAtPhase`. On **each segment boundary** during playback, restart
  the engine at the new tempo phase-aligned (acceptable seam pre-Phase E; the
  scheduled engine removes the restart entirely).
- **Count-in (wire `countInOption` at last)**: press play → engine counts one/
  two bars *in the tempo of the segment at the playhead* → player starts on
  the downbeat, scheduled the same way the guide start is today (aim at
  `downbeatEpoch − playerStartLatency`, reuse `latencyModel`'s
  `guideStartAdvanceMs` knowledge).
- **Practice speed**: click bpm scales with playback rate (`bpm × rate`,
  clamped; if the scaled bpm leaves 40–240, halve/double the click subdivision
  rather than refusing). Phase math uses *content* ms (position in file), which
  is rate-invariant — convert with rate only when scheduling wall-clock starts.
- Follow scrub/pause/loop: pause stops the click instantly (release audio
  session ownership per `audioSession.ts` owner rules); practice-loop wrap =
  same path as scrub-then-play.

### Edge cases checklist

- Scrub during count-in → cancel count-in, re-arm.
- Route change mid-play → both click and player shift together (both are
  output audio); refresh cue leads on route-change event as the recorder does.
- Haptic/visual-only click during playback must work (silent click at the
  library, tap in the hand) — outputs come from the same metronome outputs
  model.
- Clip played from Songbook/setlist context: same hook, grid from the song's
  stored map.
- `gridValidToMs`: click stops (fades) at the boundary — never click a lie.
- Legacy JS metronome fallback (no native module): playback click is simply
  unavailable — gate on `isNativeAvailable`.

**Acceptance**: on-device — scrub anywhere in a metronome-recorded take, hit
play, click lands on the recorded hits at 1× and 0.75×; count-in leads into
the downbeat; `[timing]` log reports click-vs-player phase error (log it —
this becomes the Phase F success metric). Maestro flow for the control wiring.

---

## 5. Grid programming UX (Phase D — conceptual until the metronome UI redesign lands)

**Dependency note**: the general metronome UI is being redesigned in a parallel
effort (in flight 2026-07-28). Build Phase D concepts on paper/mock level now;
bind to real components only after that lands. Nothing in A–C depends on D.

Concept — *the grid belongs to the sketch, not to the settings*:

- **Where**: the sketch's grid is set up wherever the metronome is configured
  pre-record (today `RecordingMetronomeSheet`) and reviewable from the sketch
  page. One quiet row: current grid summary ("92 · 4/4"), and under it a single
  progressive-disclosure affordance: **"Add a change"**.
- **Editor concept — an editorial list, not a timeline**: each row reads like a
  sentence in studio-notebook voice: `Bar 17 — 6/8 · 70`. Add = pick a bar,
  tempo (type/tap), meter. Rows sorted by bar; swipe/overflow to delete.
  No drag-on-canvas DAW editor in v1. Preview = play the map on the metronome
  (count through the change).
- Tap-tempo works per segment (existing `deriveTapTempoBpm`).
- The reel (Phase B) is the visualization of this plan during record/playback —
  the editor list and the tape markers are two views of one `songGrid`.
- **Copy budgets apply** (buttons ≤ 2 words; the affordance is "Add change" or
  similar — final copy through `t()` with RTL check).

Edge cases / rules:

- Editing the sketch grid **after takes exist**: existing takes keep their
  frozen `recordingGrid` (never rewrite). If the new plan diverges from the
  take a user is about to overdub against, show a quiet notice and default to
  **the take's grid** (grid follows the audio that exists, not the plan).
- A change at bar 1 is just editing the base tempo, not a "change" row.
- Count-in always uses segment 1's tempo/meter when starting from the top;
  when punching in mid-song, the count-in uses the segment at the punch bar.
- Deleting all rows returns to the simple single-tempo state with zero residue.

---

## 6. Scheduled-click engine rebuild (Phase E — iOS + Android)

Replace "looping one-bar buffer" with "clicks scheduled at explicit sample
times", the mechanism real DAWs use. This is the enabling work for tempo maps
without seams, live tempo changes without phase resets, and subdivision
support.

### iOS (`SongNookMetronomeEngine.swift`)

- Keep AVAudioEngine + AVAudioPlayerNode. Instead of one looping buffer,
  pre-render per-click buffers (downbeat voice / beat voice — reuse the
  existing synthesis) and `scheduleBuffer(at: AVAudioTime(sampleTime:))` a
  rolling window of the next ~2 bars; top up from the existing 8ms poll.
  (Alternative: `AVAudioSourceNode` render callback — more control, more risk;
  window-scheduling on the player node is the conservative first cut.)
- Click times come from the tempo map in the **sample domain**:
  `sampleForPulse(k)` accumulated per segment with the same Bresenham rounding
  (bar-exact, no drift) — extend the current math per segment.
- `configure()` semantic change: bpm/meter/map edits become **live** — future
  clicks reschedule from the next unplayed pulse; phase never resets. Only
  engine-level structure (sample rate, click voices) restarts.
- Count-in = pulses before grid zero (negative pulse indices), same scheduler.
- `getGridAnchor()` generalizes to `getTransportSnapshot()`: {isRunning,
  anchorEpochMs of grid zero, tempoMap, currentPulse, isCountIn…}. Keep
  `getGridAnchor` returning segment-local values for old JS.

### Android (`SongNookMetronomeEngine.kt`)

- Same contract on AudioTrack: streaming-mode track, writer thread renders
  click samples into the buffer at map-computed sample offsets (this replaces
  the static looping buffer). Beat events from the playback-head frame
  position, as today. If the current engine is already streaming-mode, this is
  an evolution of its writer; if static-mode, switch to streaming.
- OEM variance (Samsung etc. per past device logs) affects *latency*, not
  sample math — the latency model keeps owning that; engine stays exact.

### Contract & safety

- Module API is **additive**: new `setTempoMap`, `getTransportSnapshot`,
  capability `supportsTempoMap()`. `useMetronome` prefers the new path, keeps
  every existing fallback tier (new JS + old binary, old JS + new binary must
  both work — this discipline already exists; preserve it).
- The JS visual scheduler and native haptic scheduling generalize: leads apply
  per-pulse from the map instead of a constant `msPerPulse` (haptic lead of
  "next beat interval" must read the *next* pulse's interval at a boundary).
- Record-through head-trim math (`useRecordingScreenModel`) switches from
  `anchor + countInPulses × msPerPulse` to `msAtBeat(map, bar 1 beat 1)`
  via the transport snapshot — same epochs, map-aware.
- **Parity harness**: a debug screen/dev menu action that runs the engine 60s
  and logs pulse-time deltas vs. the map's ideal (`[timing]` convention);
  acceptance = max |delta| < 1ms on iOS, < 3ms Android, zero cumulative drift.
  Plus JS contract tests against a mocked module for the hook logic.

**Rollout**: ship dark (native present, JS still on old path) → flip
`useMetronome` to the new path behind a dev toggle → default on after device
verification (add rows to `docs/product-plan/device-verification-checklist.md`).
Native changes require a rebuild — coordinate with the other pending native
work (waveform probe, lock-screen, tuner patches all wait on rebuilds too).

---

## 7. Shared transport (Phase F — the destination)

Goal: click, guide, playback, and recording positioned by **one sample clock**
so sync is true by construction and all epoch-bridging code (guide phase-lock,
head-trim epoch math, playback-click reconciliation) collapses into identities.

Reality check: playback today is expo-audio (patched) and recording is
`useSharedAudioRecorder`; folding those into one graph is the largest lift in
this plan and should ride on the next major audio-engine opening (the in-house
engine migration line of work), not be forced early. Until then, Phase C's
logged click-vs-player phase error is the KPI: if it stays single-digit ms in
the field, Phase F is about *robustness*, not audible improvement — deprioritize
accordingly.

Shape when it happens: a native `Transport` owning position/rate/map; the
metronome becomes a node fed by it; the player node and recorder tap share its
clock; `latencyModel` remains the human-side correction layer (ears/eyes/hands
still lag the render clock — that layer never goes away).

Interim keep-warm rule for A–E: **no new epoch-based couplings** outside the
existing reconciliation points; everything new derives from map math + the one
anchor, so Phase F deletes code instead of fighting it.

---

## 8. Overdub & Bluetooth implications (cross-phase)

Overdub:

- Master's map presets the whole grid for overdubs (exists for bpm/meter;
  extends to maps via `gridTempoMap`).
- Punch-in gains **snap to bar** (Phase B/C math); punch position can be
  displayed as `Bar 17 · beat 2` alongside time. The bar-length fallback
  lead-in (`getRecordingGridBarMs`) becomes map-aware (bar length at the punch
  position, not global).
- `StemAlignmentOverlay` gains the same ruler as the reel; Align becomes the
  fix-up tool for grid-less material rather than a routine step. A stem whose
  own grid ≠ master grid (imported stems) shows a quiet "off-grid" tag.

Bluetooth (honesty over promises):

- Saved-audio alignment over BT is *good with a fresh calibration* (~±10–20ms)
  and the system already refuses to guess — keep that stance.
- Add (small, Phase G): when arming a take on an uncalibrated BT route, one
  quiet nudge toward the existing calibration flow (once per route, dismissible
  — no nagging); prefer-haptic-reference note in help content. Copy through
  budgets; failure haptics per vocabulary.
- Live monitoring feel over BT is physics; the app's answer is the haptic
  reference (already natively scheduled with signed leads) — surface it, don't
  fight BT.

---

## 9. Founder decisions (log)

1. **DECIDED 2026-07-29: the word is "grid".** Use it in future user-facing
   copy (he: רשת/רשת קצב per context). Existing copy stays until touched.
2. **OPEN — detected-tempo clips.** Founder distrusts analysis on raw phone
   clips (fair: `bpmSteadiness` gates help but phone takes drift); DAW imports
   are the credible case. Standing proposal: click stays metronome-grid-only
   for now; a later "Set the one" flow (steady analysis + user taps the
   downbeat to confirm) upgrades imports — nothing auto-on, ever.
3. **Pickup bars**: still deferred (data model can carry it later).
4. **DECIDED 2026-07-29: snap-to-grid approved and BUILT** — reel scrub
   settles onto a near bar line (12pt visual magnet, capped at 250ms and 40%
   of the line spacing; haptic `tap` detent), and overdub layers gained
   **slide-to-move** on the Align overlay (long-press-drag, live preview,
   commit snapped to the master grid's nearest BEAT within 60ms; `grab` on
   lift, `tap` on snap; nudge buttons remain the precision tool). Device
   feel-pass pending.
5. **OPEN — editor location**: Changes editor lives on the recording
   metronome sheet (fresh sketch takes only); founder reviewing (§5 of the
   plan describes it; also demonstrated in-sim 2026-07-28).

---

## 10. Execution order, sizing, and handover rules

Order (each phase shippable, revertible, and safe to stop after):

| Phase | What | Depends on | Native rebuild? | Size |
|---|---|---|---|---|
| A | TempoMap domain + RecordingGrid v2 + sketch songGrid + archive round-trip | — | no | S–M |
| B | Reel grid ruler + markers + trust shading | A | no | M |
| C | Playback click + wired count-in + `startAtPhase` | A (B helps verify) | yes (small, additive) | M |
| D | Grid programming UX | A + new metronome UI landing | no | M |
| E | Scheduled-click engines (iOS+Android) + live map changes | A; C's orchestration benefits | yes | L |
| F | Shared transport | E + audio-engine opening | yes | XL (separate effort) |
| G | BT calibration nudge + help copy | any time after C | no | S |

Handover rules for whichever model continues this (Fable 5 or Opus 5):

- Work phase by phase; do not interleave native and UI phases in one change.
- Every phase ends with: `npx tsc --noEmit` clean, relevant tests green,
  simulator screenshots for UI phases, `[timing]` device logs for engine
  phases, and an update to THIS file's status line + the phase's checkbox
  below. Never mark device-dependent work verified without a device/simulator
  run — use "UNVERIFIED pending rebuild" statuses like the rest of the repo.
- All prior invariants hold: first-frame rule (derive in render, no
  effect-assignments), design tokens only, haptics vocabulary citations,
  motion tokens, copy budgets, `t()` + RTL, additive native APIs with
  capability probes, latency numbers only from `latencyModel.ts`.
- The frozen-take principle is inviolable: a saved take's `recordingGrid` is
  never rewritten by later edits to the sketch grid.

Phase status:

- [x] A — TempoMap model (2026-07-28: `src/domain/tempoMap.ts` + tests;
      `RecordingGrid.tempoMap` + `SongIdea.songGrid`/`songGridUpdatedAt`;
      `setSongGrid` action; `normalizeRecordingGrid` sanitizes the map and
      enforces bpm/meterId ⇄ segment-1 mirroring; archive manifest/export/import
      carry both fields in all fidelities; round-trip tests extended.
      tsc clean, 609/609 jest green.)
- [x] B — Reel grid ruler (2026-07-28: `src/domain/gridRuler.ts` model + 7 tests
      (density steps, honesty gates, tempo-change positions); Skia
      `GridRulerOverlay` in PlaybackTapeVisualizer (bar hairlines, bottom beat
      ticks, change-marker lines, pre-roll shade; SUPPRESSES the seconds tick
      ruler when a grid exists — bars are the ruler); `GridRulerLabels` RN
      overlay (bar numbers + "meter · bpm" change labels, token fonts, top
      edge — sections keep the bottom); AudioReel `grid` prop builds the model
      (minimap deliberately excluded — noise at that scale); wired
      PlayerTimeline ← PlayerScreen `playerClip.recordingGrid`.
      Verified on iPhone 17 sim (RTL locale): metronome take (92 · 3/4, 1-bar
      count-in) shows bars 1-4 + numbers + beat ticks at the follow-window
      zoom with bar 1 exactly at t=0 (head trim held); grid-less clip
      unchanged. Deferred to later phases: ruler on the LIVE recording tape
      (Phase C/E surface) and scrub snap-to-bar (open decision §9.5).
      tsc clean, 616/616 jest green.)
- [x] C — Playback click + count-in (2026-07-28, BUILT; audible-alignment
      verification pending native rebuild + device listening test):
      `src/domain/playbackClick.ts` (+8 tests: rate-scaled engine params,
      wall/content conversion, boundary + gridValidToMs stops, range refusal);
      native `startAtPhase(offsetMs)` + `supportsPhaseStart()` on BOTH engines
      (iOS: sample-exact tail-slice-then-loop schedule + `phaseOffsetFrames`
      through poll/anchor; Android: static-track head preset, refactored
      `startInternal`); `src/hooks/usePlaybackClick.ts` — direct-module hook
      (NEVER through useMetronome/store: that would clobber the user's saved
      metronome settings), sync on play/seek/rate, next-bar JS fallback on old
      binaries, segment-boundary + validTo timers, 10s drift check vs grid
      anchor (logged — the Phase F KPI), count-in→play handoff; UI: practice
      panel Click tile (On/Off, hint "Recorded without the metronome." when no
      grid — avoids the un-decided user-facing word for "grid"), count-in
      gated on the same availability, `countInOption` FINALLY consumed via
      `handleTogglePlayWithCountIn` (tap during count-in = cancel), all seeks
      route through `handleSeekWithClick`. Sim-verified on current binary:
      Click/count-in tiles + availability gates, count-in delays play then
      playback starts, cancel-on-tap. v1 limits (accepted): scaled bpm outside
      40–240 = click unavailable at that rate (no subdivision fallback);
      count-in from mid-bar restarts click at position phase (small seam);
      loop-wrap resync rides the drift check, not notifySeek.
      tsc clean, 624/624 jest green.
      NOTE: during sim verification a JS reload once booted an empty library
      and the disaster-recovery restore recovered everything (spawned
      investigation task) — watch for recurrence.
- [x] D — Grid programming UX (2026-07-28, after the metronome UI redesign
      landed; sim-verified end-to-end: programmed a bar-9 change, recorded with
      count-in, ruler showed "4/4 · 102" at bar 9 with correct bar widths):
      • D1 grouping joins the grid — `RecordingGrid.grouping` (feel snapshot,
        validated in `normalizeRecordingGrid`), take snapshot stores custom
        groupings, overdub restore replays them (`metronome.setGrouping`),
        playback click accents from the take's grouping (segment sharing the
        take's meter; others use meter defaults).
      • D2 take tempo map + boundary scheduler — take snapshot builds
        `tempoMap` (sketch `songGrid` with segment 1 = live sheet settings;
        overdub = master's map ONLY while the sheet still matches its segment
        1); JS scheduler fires partial `configure()` at each boundary off the
        measured downbeat anchor (engine restart = boundary downbeat; both
        engines keep absent config keys, `clickVolume` now optional in the TS
        type to match); every stop path clears timers and stamps
        `gridValidToMs` at the earliest unfired change (inert past file end).
        v1 limits: multi-segment maps stamp only on count-in takes; pause kills
        remaining changes (validTo stamped); boundary seam = JS-timer class
        until Phase E.
      • D3 Changes editor on the metronome sheet — "Changes" disclosure
        between Meter and Cues (only for fresh sketch takes; overdubs inherit
        the master's frozen grid): editorial rows "Bar N · meter · bpm",
        inline bar/bpm steppers + reused MeterChips, add/delete, count summary.
        Rows live in LOCAL DRAFT state — a fresh change equals the current
        tempo and the persisted map rightly normalizes it away; the draft
        keeps it visible while it's shaped (adjust-state-in-render on open).
        i18n en+he. Polish item deferred: with the editor expanded the sheet
        can outgrow the screen and push its title row off — BottomSheet max
        height + inner scroll wants a look.
- [x] E — Scheduled-click engines (2026-07-29): map mode ALONGSIDE loop mode on
      both engines — `configureTempoMap`/`clearTempoMap`/`supportsTempoMap`.
      iOS: per-click `scheduleBuffer(at:)` from a cumulative segment table
      (Bresenham per segment), cached click voices, rolling ~32-pulse window
      topped up from the poll; count-in = pulses before grid zero at segment
      1's tempo; `startAtPhase` offset becomes a WHOLE-GRID position in map
      mode; map-aware poll/beat-meta/grid-anchor (anchor stays "run pulse 0 +
      current spacing" so existing consumers self-heal per bar). Android:
      streaming AudioTrack writer, clicks rendered at map frames, ~150ms
      ahead. Structural `configure()` clears the map (single-tempo world);
      `stop()` paths also `clearTempoMap` so the standalone metronome can
      never start in a stale map. JS: `nativeTempoMapSegments()` (grouping-
      aware, rate-scaled, same range-refusal), `useMetronome` start options
      install the map AFTER the map-clearing config sync, recording model
      passes it (JS boundary scheduler stays as old-binary fallback),
      usePlaybackClick prefers the map path (no boundary timers; drift check
      skipped past a multi-segment map's first boundary where its modular
      math stops meaning anything). iOS SIM-VERIFIED end-to-end on a rebuilt
      binary: map count-in → completion → head trim (bar 1 at t=0), stamped
      map ruler exact through the change (bar 17 at 34.5s), playback click
      across the boundary without restart. NOT yet verified: audible click
      quality/alignment (needs ears + device), Android engine (needs an
      Android build — Kotlin compile included), long-run scheduling (only
      ~50s runs exercised; the 32-pulse window logic wants a soak).
- [ ] F — Shared transport (long-horizon; Phase C/E landed the `[timing]`
      click-drift KPI that decides its urgency)
- [x] G — Bluetooth trust polish (2026-07-29: largely already shipped by the
      recording redesign — `RecordingTimingWarnings` quiet banners for
      uncalibrated/stale BT, BT mic, mid-take route change, with a Calibrate
      action. Added: haptic-as-wireless-immune-reference line in the
      Bluetooth help item + a "Tempo changes" help item for discoverability.)
