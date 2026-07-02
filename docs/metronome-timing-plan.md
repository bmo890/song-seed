# Metronome & Recording Timing — Implementation Plan

Companion to `docs/metronome-timing-audit.md` (read that first — findings
F1–F15 referenced below are defined there). This document turns the audit into
an ordered, verifiable sequence of work. Same conventions as
`docs/audio-architecture-plan.md`: each phase ships independently, has its own
verification checklist, and later phases assume earlier ones are verified.

> **Ordering logic:** memory before measurement, measurement before machinery.
> Phases 1–3 are JS-heavy, low-risk, and deliver most of the day-to-day trust
> win. Phases 4–6 are the native timing work that makes alignment exact.
> Phase 7 is optional consolidation. Every native change lands as a
> Swift + Kotlin pair — no platform ships ahead of the other.

**Effort key:** S = a focused session, M = a few sessions, L = a real project.

---

## Phase 0 — Baseline & guardrails (S)

Do once before starting:

- [ ] `npx tsc --noEmit` clean.
- [ ] Manual smoke: plain record, record with count-in, record with click
      through take, overdub with count-in, pause/resume, save, discard —
      on one iOS and one Android device. Note (video if possible) the current
      count-in→record gap so improvements are demonstrable.
- [ ] Confirm `libraryArchiveRoundTrip.test.ts` passes — Phase 1 extends the
      archived clip shape and this test is the safety net.

---

## Phase 1 — Tempo memory: `recordingGrid` on clips (M) — fixes F4

**Goal:** the app never forgets what tempo/meter a take was recorded against,
and that metadata travels with the clip. Pure JS/TS; no timing behavior
changes.

1. **Types** (`src/types.ts`):
   ```ts
   export type RecordingGridSource = "metronome" | "detected" | "manual";
   export type RecordingGrid = {
     bpm: number;
     meterId: MetronomeMeterId;
     countInBars: number;
     clickThroughTake: boolean;
     /** ms from file t=0 to the first downbeat. null = unknown (legacy /
      *  pre-Phase-5 takes). Becomes 0 by construction after Phase 5 trims. */
     firstDownbeatMs: number | null;
     source: RecordingGridSource;
   };
   ```
   Add `recordingGrid?: RecordingGrid` to `ClipVersion` **and**
   `ClipOverdubStem`. Optional everywhere — old data loads untouched.
2. **Capture at save time.** In `useRecordingScreenModel`, snapshot
   `{bpm, meterId, countInBars, clickThroughTake}` from the metronome state at
   the moment recording *starts* (not at save — the user can fiddle after),
   hold it in a ref, and attach it to the `onRecorded` payload in both the
   clip path and `attachRecordedOverdubStem` (`src/state/actions.ts`). Only
   attach when the take actually used the metronome or count-in;
   `firstDownbeatMs: null` for now.
3. **Restore on entry.** When opening the Recording screen for an overdub (or
   re-record of a clip with a grid), preset the metronome store from
   `clip.recordingGrid` (bpm + meter; count-in stays the user's global
   preference). The global metronome settings remain the default for fresh
   takes — the clip's grid wins only when present. Fallback: a confirmed
   `analysis.bpm` with high steadiness may seed `source: "detected"`.
4. **Persistence & sharing.** Verify the grid survives: Zustand persist
   (`persistedSnapshot.ts` snapshots workspaces wholesale — confirm), library
   archive export/import (extend `libraryArchiveRoundTrip.test.ts` with a
   gridded clip), and clip duplication/lineage copies.
5. **Surface it.** Small read-only chip in the Recording screen header and
   clip detail ("92 BPM · 4/4"). No editing UI yet (that's "manual" source,
   later).

**Verify:** record with metronome at 92 → clip shows 92/4-4 → change global
metronome to 140 → open overdub on that clip → metronome presets back to
92/4-4 → archive round-trip preserves it → `tsc` + Jest clean.

---

## Phase 2 — Calibration sharpening (S–M) — fixes F13, F15

**Goal:** the Bluetooth monitoring offset stops including the player's start
latency, and seeds from the OS-reported route latency.

1. **F13 (JS-only, do first):** in `BluetoothCalibrationScreen`, stop
   anchoring the tap grid to `Date.now()` at play-request. Subscribe to the
   calibration player's status; on the first tick where `playing` is true,
   compute `trueAudioStart = Date.now() - currentTime*1000` and build the
   expected-beat grid from that. Everything downstream (residuals, median,
   MAD) is unchanged.
2. **F15 (native, both platforms):** extend `songseed-metronome` with
   `getCurrentAudioRouteLatencyMs(): { outputMs: number | null }`:
   - iOS: `AVAudioSession.sharedInstance().outputLatency * 1000`.
   - Android: derive from `AudioTrack.getTimestamp()` drift vs
     `elapsedRealtimeNanos` on a short internal track, or
     `AudioManager` route info where available; return `null` when the device
     can't say (callers must handle null — Android reporting is OEM-variable).
3. **Use the seed.** Calibration screen shows "Reported route latency: ~N ms"
   and pre-fills the estimate; the tap pass refines it. Keep the manual
   ±10/±25 tweaks and the per-route saved list exactly as they are.

**Verify:** on BT headphones, run calibration 5×: spread of results should
tighten vs. today (the F13 fix removes a per-run variable). Reported-latency
row appears on iOS; Android shows it or gracefully omits. Recording flows
consume the saved offset unchanged.

---

## Phase 3 — Manual overdub alignment: stem nudge UI (M) — mitigates F3 now

**Goal:** the user can rescue any misaligned overdub today, and keeps a
permanent escape hatch after the automatic fixes land. Pure JS; the schema
(`ClipOverdubStem.offsetMs`) already exists.

1. **Entry point:** "Align" action on a stem in the overdub layers UI.
2. **Interaction:** guide waveform on top, stem waveform below; drag for
   coarse placement; ±5/±10 ms buttons for fine (same pattern as the
   calibration tweaks); loop-audition toggle playing a short window (default:
   around the first downbeat if `recordingGrid` exists, else the first 2 s).
3. **Preview without re-render:** two live players (guide + raw stem) started
   with the trial offset — do NOT rebuild the rendered mix per nudge. Commit
   writes `offsetMs` and triggers one mix re-render (existing pipeline in
   `attachRecordedOverdubStem` / overdub state actions).
4. **Waveform honesty:** stored peaks are 256/2048 bins (~88 ms/bin on long
   takes) — render them for orientation, but do not pretend visual precision;
   the loop-audition is the precision tool. (A zoom-window re-decode is a
   nice-to-have, not required for v1.)
5. **Grid overlay (cheap, if Phase 1 landed):** draw beat lines from
   `recordingGrid` over both waveforms.
6. **Future hooks:** "Reset to measured" button appears once Phase 6 stores a
   measured offset; auto-suggest via click-bleed onset detection is an
   opportunistic later add.

**Verify:** deliberately record a late overdub → nudge it tight by ear → save
→ rendered mix reflects the offset → reopening shows the persisted offset →
nudging is smooth (no mix re-render during preview).

---

## Phase 4 — Engine hardening (M, native ×2) — fixes F5, F9, F10, F11, prepares F1/F2

**Goal:** the metronome engine becomes a stable, queryable grid instead of an
event firehose that resets on any touch. All changes land in both
`SongseedMetronomeEngine.swift` and `.kt` together.

1. **Split `configure()`** into live params (clickVolume → `player.volume` /
   `track.setVolume`, no restart) and structural params (bpm, meter, accent
   pattern → rebuild). JS side: send volume changes immediately (drop them
   from the 280 ms debounced full-sync), and **lock structural changes while
   a take is active** (Recording screen disables bpm/meter edits mid-take).
2. **Bresenham pulse framing:** distribute the per-pulse rounding error across
   the bar so bar length is sample-exact for the nominal BPM (kills the
   slow drift vs. external tools, F9).
3. **Grid anchor API:** `getGridAnchor()` → `{ anchorSystemTimeMs, // shared
   clock: mach hostTime→ms on iOS, elapsedRealtime on Android
   pulseIndexAtAnchor, msPerPulse, pulsesPerBar, isCountIn }`, updated on
   start/restart. Count-in pulses are indices `−N…−1` on the same grid;
   pulse 0 **is** the take downbeat. Keep the existing beat events for
   compatibility, but they stop being the source of truth.
4. **Anchor-driven UI cues:** count-in dots / pulse animation run off a
   Reanimated clock seeded from the anchor (same pattern as the planned
   Step-3 playhead in `audio-architecture-plan.md`) instead of per-beat
   bridge events. Haptics can stay event-driven (jitter matters less than
   visuals).
5. **Honest fallback (F11):** when the native module is unavailable (Expo
   Go / web), hide count-in and click-through-take options in the Recording
   screen instead of offering the untrustworthy JS-loop version.

**Verify:** volume nudge mid-click does not reset the phase (listen for the
downbeat staying put); bpm slider still restarts cleanly when idle; count-in
dots look locked to the click on both platforms; 10-minute click vs. a DAW at
the same BPM stays phase-tight; Expo Go shows the reduced recording options.

---

## Phase 5 — Deterministic downbeat (L, the core fix) — fixes F1, F2, F6, F7, F8

**Goal:** file `t=0` is the downbeat, every take, by measurement — the
count-in stops being a race.

**Decision gate (before starting):** capture timestamps must come from the
recorder. Two options:
- **(a) Patch/extend `@siteed/audio-studio`** to report capture start on the
  shared clock — iOS: session input latency + first render hostTime; Android:
  `AudioRecord.getTimestamp()`. Repo already maintains `patches/`; upstream PR
  if welcome.
- **(b) Pull capture into our own module** (front-loads part of Phase 7).
Choose (a) unless the patch turns out invasive; (b) is the fallback and the
long-term direction anyway.

1. **Reorder the arm sequence** in `useRecordingScreenModel.handleStartRecording`:
   prepare → **start capture** → confirm capture rolling → start count-in.
   The recorder is recording during the count-in (audio later trimmed).
2. **Compute the offset natively:** `firstDownbeatMs =
   (gridAnchor + countInBars·barMs) − captureStartTime`, both on the shared
   clock from Phase 4.3. Target accuracy: ±5 ms iOS, ±10 ms Android; if the
   platform can't provide a capture timestamp, fall back to today's behavior
   and record `firstDownbeatMs: null` (never guess).
3. **Trim on save:** cut the file at the downbeat sample during the managed
   import step (`importRecordedAudioAsset` path); write
   `recordingGrid.firstDownbeatMs = 0`. Optional "keep pickup" setting keeps
   one bar of pre-roll and stores the real offset instead. **Recovery
   invariant:** the untrimmed recorder temp file and pending-session marker
   are kept until the trimmed attach succeeds (mirror the existing
   `saveRecording` cleanup discipline).
4. **Waveform correctness:** live-capture analysis points now include count-in
   audio — trim the same leading span from `analysisData` before building
   `waveformPeaks` and the detail sidecar, or the stored waveform is shifted
   relative to the trimmed file.
5. **Same treatment for the click-through-take path** (F8): metronome start is
   the anchor; capture is already rolling; no count-in term.
6. **Pause/resume & interruption policy (F6, F7):** v1 = honest metadata: the
   grid is marked valid only to the first pause/interruption (add
   `gridValidToMs?: number`). Re-anchored resume segments are a later
   enhancement, not a blocker.

**Verify (this is audit acceptance-criterion 1):** record with count-in 20×
at 60/92/240 BPM: measure the first click/onset position in the saved file —
downbeat at `t=0` within ±5 ms (iOS) / ±10 ms (Android) every take. Recovery:
kill the app mid-take → relaunch salvages the untrimmed audio. Overdub
auto-stop, save, discard flows unchanged.

---

## Phase 6 — Overdub timestamped alignment (L) — fixes F3, uses F12 honestly

**Goal:** overdub stems land on the guide within ±10 ms without manual
nudging.

1. **Guide playback moves into the native module** as a player node/track next
   to the click (this also removes the expo-audio `waitForGuideMixPlaybackStart`
   poll). The module reports the guide's actual audio-start on the shared
   clock. (This front-loads more of Phase 7 — expected.)
2. **Stem offset is computed, not assumed:** `stemOffsetMs = captureStart −
   guideAudioStart − routeOutputLatency + captureInputLatency`, written to the
   stem instead of the hard-coded `0` (`actions.ts:1156`). The Phase-3 nudge
   UI's "reset to measured" now has a value to reset to.
3. **Loopback auto-calibration (speaker path):** play the existing calibration
   click (`ensureCalibrationClickTrackFile`) through the speaker, record via
   mic, cross-correlate → device round-trip latency, stored per route. One-off
   per route, automatic, no tapping. BT headphones keep the tap flow (mic
   can't hear them).
4. **Bluetooth microphone honesty:** when the *input* is BT, show a warning
   that tight overdubs aren't achievable on BT mics (variable input latency no
   offset can fix) and suggest built-in/wired.
5. **Monitoring compensation simplifies:** the BT calibration offset now only
   shifts *cues* (`cueDelayMs`/`outputLatencyMs` paths); it no longer gates
   file alignment via `waitForMonitoringCompensation` before recorder start —
   delete that coupling.

**Verify (audit acceptance-criterion 2):** overdub a click-track guide 10× on
the built-in mic/speaker and wired headphones: recorded click lands on the
guide grid within ±10 ms without nudging. BT-mic path shows the warning.
Monitoring still *feels* right on calibrated BT headphones.

---

## Phase 7 — Optional: unified `songseed-recording-engine` (L)

Consolidate click + guide + capture into one native graph (iOS: one
`AVAudioEngine` with input tap; Android: Oboe/AAudio duplex). One graph = one
sample clock = offsets exact by construction; enables future in-ear click
monitoring without mic bleed. After Phases 4–6 this is a consolidation, not a
rewrite — do it when (or if) the timestamp approach's residual error or the
two-pipeline session juggling (F12) actually hurts in practice. Recording
stays out of the Plan-B playback `AudioService` either way.

---

## Dependency graph

```
Phase 0 ─→ Phase 1 ─→ Phase 3 (grid overlay optional)
       └─→ Phase 2                    │
       └─→ Phase 4 ─→ Phase 5 ─→ Phase 6 ─→ (Phase 7)
```
Phases 1, 2, 3 are independent of 4–6 and of each other (except 3's optional
grid overlay wanting 1). Recommended order: 1 → 2 → 3 → 4 → 5 → 6.

## Risk register

| Risk | Phase | Mitigation |
|---|---|---|
| Android timestamp quality varies by OEM | 5, 6 | Treat as capability: measured path when available, current behavior + `firstDownbeatMs: null` when not. Never guess. |
| `@siteed/audio-studio` patch too invasive | 5 | Decision gate up front; fallback = in-house capture (part of Phase 7 early). |
| Trim step breaks recovery guarantees | 5 | Keep untrimmed temp + pending-session marker until trimmed attach succeeds; extend recovery tests. |
| Schema change breaks old archives | 1 | `recordingGrid` optional everywhere; round-trip test extended before shipping. |
| Structural-config lock annoys users mid-take | 4 | Volume/haptic stay live; only bpm/meter lock, with a toast explaining why. |
| Guide playback migration regresses overdub UX | 6 | Keep expo-audio path behind a flag until parity verified on both platforms. |

## Definition of done

The acceptance criteria in `metronome-timing-audit.md` §6, plus: every native
change exists and is verified on both iOS and Android before its phase is
called complete; `npx tsc --noEmit` and Jest stay clean throughout.

---

## 📋 Copy-paste continuation prompt (for a fresh session)

```
We're implementing the metronome/recording timing plan. Read
docs/metronome-timing-audit.md (findings F1–F15) and
docs/metronome-timing-plan.md (phases 0–7) first.

STATUS: <fill in — which phases are done/verified>

Key ground rules:
- Every native change lands as a Swift + Kotlin pair; no platform ships ahead.
- Timing relationships must be measured sample/timestamp offsets in one native
  timeline — never the emergent result of JS call ordering.
- recordingGrid metadata is optional everywhere; old clips/archives must load.
- Phase 5's trim must preserve the existing recording-recovery guarantees
  (untrimmed temp + pending-session marker until the trimmed attach succeeds).
- Verify each phase with its checklist (and the audit §6 acceptance criteria
  for phases 5–6) before starting the next.

NEXT: implement Phase <N> per the plan. Work with me and ask before any
decision that changes UX.
```
