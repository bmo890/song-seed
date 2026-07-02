# Metronome & Recording Timing — Audit

This document is a deep dive into why the metronome/count-in/recording system
feels inconsistent, what exactly is broken (with file references), and what the
architectural fix looks like. No code changes accompany this audit.

> **TL;DR of the diagnosis:** the native click engines themselves are solid —
> hardware-looped buffers that do not drift. Everything *around* them is
> untimed. Recording start, guide-mix start, and the metronome grid are three
> independent audio pipelines coordinated only by JS `await` chains and
> `setTimeout`s, so the offset between "file starts" and "the beat grid" is a
> different random number on every take (~50–500 ms of jitter). And nothing
> about the tempo is ever saved to the clip, so even a perfect take can't be
> reproduced later, shared, or overdubbed against reliably. The fix is
> (1) persist tempo metadata on the clip, and (2) make the downbeat↔file
> alignment a *measured sample offset in one native timeline* instead of a
> race between JS calls.

---

## 1. How the system is built today

| Piece | Where | Clock/timeline |
|---|---|---|
| Native metronome engine | `modules/songseed-metronome` (Swift `SongseedMetronomeEngine.swift`, Kotlin `SongseedMetronomeEngine.kt`) | iOS: `AVAudioPlayerNode` sample position (or `ProcessInfo.systemUptime` when click disabled). Android: `AudioTrack.playbackHeadPosition` (or `SystemClock.elapsedRealtime`). |
| Recorder | `@siteed/audio-studio` via `src/hooks/useRecording.ts` | Its own capture pipeline; JS only sees `Date.now()` and status callbacks. |
| Guide mix (overdub playback) | `expo-audio` player in `useRecordingScreenModel.ts` | Its own playback pipeline; JS polls `playing`/`isBuffering`. |
| Orchestration | `src/components/RecordingScreen/hooks/useRecordingScreenModel.ts` | React effects, `await` chains, `setTimeout`. |
| Beat/count-in events | Native poll timer (8 ms) → RN bridge → React state | Bridge + JS scheduling jitter. |
| Tempo settings | Zustand store: one global `metronomeBpm` / `metronomeMeterId` / `metronomeCountInBars` (`src/state/dataSlice.ts`) | Persisted app-wide; not per clip. |

Three audio pipelines, four clocks, and the only thing tying them together is
JavaScript running whenever the event loop gets to it. That is the root cause.

---

## 2. Findings

### P0 — the causes of "it's a gamble"

**F1. Recording start is never aligned to the beat grid — it's a JS race.**
The count-in completion path (`useRecordingScreenModel.ts`, the
`countInCompletionToken` effect, ~line 688) does:

```
native onCountInComplete → RN bridge → React effect →
  (overdub) guideMixPlayer.seekTo(0) + play() + poll up to 1200ms →
  setTimeout(monitoring compensation) →
  recorder.startRecording()  (async native call, unmeasured latency)
```

Every arrow adds unmeasured, load-dependent latency. The file's `t=0`
therefore lands at a random point relative to the metronome grid — different
per take, per device, per CPU load. This is *exactly* the "noticeable gamble
between the count-in and when the track records" you described. Nothing
measures where the downbeat actually fell inside the recorded file, and
nothing stores it.

**F2. `onCountInComplete` fires on the *last count-in click*, not the downbeat.**
In both engines (`SongseedMetronomeEngine.swift:267`,
`SongseedMetronomeEngine.kt:274`), `countInPulsesRemaining` hits zero while
emitting the final count-in beat, so the completion event fires one full beat
interval *before* the musical "one". The JS chain in F1 then races that beat:
at 60 BPM it starts recording ~1 s early (capturing the count-in tail at a
random offset); at 240 BPM the window is 250 ms and the chain (especially the
guide-mix start poll, up to 1200 ms) can *overrun the downbeat entirely*.
Neither "start at the one" nor "start exactly one beat early" is actually
achieved — it's "start whenever the awaits finish".

**F3. Overdub alignment is assumed, never measured.**
A recorded overdub stem is attached with `offsetMs: 0`
(`src/state/actions.ts:1156`). But the real offset between guide audio and
captured audio is:

```
(guide output latency + play() start latency) − (capture input latency + start latency)
```

None of these are measured. The only compensation that exists is the manual
Bluetooth *monitoring* calibration, applied by delaying the recorder start
with a JS `setTimeout` (`waitForMonitoringCompensation`) — which shifts the
average but adds its own jitter and does nothing for the built-in
speaker/wired path. Result: every overdub lands at a slightly different,
uncorrectable offset from the guide. This compounds: overdub an overdub mix
and errors stack.

**F4. No tempo metadata is ever saved with a clip.**
`ClipVersion` (`src/types.ts:307`) has no BPM/meter/grid fields. The only
tempo-adjacent data is `analysis` — *post-hoc detected* BPM (rounded, with a
steadiness score), not the metronome settings the take was actually recorded
against. Meanwhile the metronome settings are one global, persisted app value:
record a song at 92 today, tap-tempo something else tomorrow, come back to
overdub — the app has no memory of what the take was recorded at. This kills
all three of your requirements: reproducibility for yourself, shareability to
a friend, and trustworthy overdubs. Even if F1–F3 were fixed, the grid would
still be unrecoverable after the session ends.

### P1 — grid-integrity bugs during a take

**F5. Any config change restarts the metronome and resets its phase.**
`configure()` on a running engine is a full restart — beat position resets to
pulse 0, the click buffer rebuilds (`SongseedMetronomeEngine.swift:63-78`,
`.kt:65-86`). The JS side debounces config syncs by 280 ms
(`useMetronome.ts:210-232`) and re-syncs on *any* of bpm / meter / beep level /
beep toggle. So nudging the click volume mid-take audibly restarts the click
on a new, unrelated phase ~280 ms later. Grid continuity within a take is not
protected.

**F6. Pause/resume abandons the grid.**
Pausing stops the metronome; resuming starts a fresh one (optionally with a
fresh count-in) with a brand-new phase — while the recorder concatenates the
new audio directly onto the old file. A paused-and-resumed take *cannot* have
one consistent beat grid, and nothing records that it doesn't.

**F7. Interruptions silently break alignment.**
The recorder is configured with `autoResumeAfterInterruption: true`
(`useRecording.ts:323`), but the interruption effect in the screen model stops
the metronome. After a phone call, capture resumes into the same file with the
click gone and the grid lost.

**F8. The "click through the take, no count-in" path has the same race as F1.**
`handleStartRecording` (metronome-enabled branch, ~line 838): start metronome
→ start guide → compensation wait → start recorder. Also, if the metronome was
already running as a preview, its *existing* phase is reused ("alreadyPreviewing"),
so recording starts at an arbitrary point mid-bar of the preview loop.

### P2 — accuracy and trust erosion

**F9. BPM quantization.** `framesPerPulse` is rounded to an integer
(`round(44100 · 60 / bpm)`), so the true click tempo is `44100·60/framesPerPulse`,
not the nominal BPM — up to ~11 µs/beat of error. Alone it's inaudible, but over
a 5-minute take it accumulates to several ms against an *external* metronome or
DAW set to the same nominal BPM. For the "friend sets 92 BPM in their DAW"
scenario this is a slow phase drift. Fixable by distributing the rounding error
across the bar (Bresenham-style pulse lengths).

**F10. Visual/haptic cues jitter relative to the audio.** Beats are detected by
an 8 ms native poll, cross the bridge, and fire haptics/pulse animations from
JS. The count-in you *watch* wobbles ±10–50 ms around what you hear. This
doesn't corrupt any recording, but it is a large part of why the system *feels*
untrustworthy — the user-visible count-in is the jitteriest component in the
chain. (The `outputLatencyMs` / `cueDelayMs` compensation only shifts cues
later for Bluetooth; it can't remove jitter.)

**F11. The legacy fallback metronome is far worse.** When the native module is
absent (Expo Go, web), `useLegacyMetronomeImpl` drives beats by polling an
`expo-audio` loop's `currentTime` at ~16 ms with loop-wrap heuristics, meter is
hard-coded 4/4, and `startCountIn` is literally `start` (no count-in at all).
Any session on this path is fundamentally untrustworthy for recording.

**F12. Audio-session mode switching around the count-in.** Recording claims the
audio session at `prepareRecording` (before the count-in) — good ordering — but
the metronome, guide player, and recorder each negotiate the session through
`src/services/audioSession.ts` owner stack. Category flips
(`PlayAndRecord`/`Measurement`, `mixWithOthers`) can restart audio I/O and
change route latency *between* preview, count-in, and take, which is another
reason a one-time latency constant can't fix alignment — it has to be measured
per take.

### What's already good (foundations to build on)

- The native click loops themselves are **drift-free**: iOS
  `scheduleBuffer(.loops)` and Android `MODE_STATIC` + `setLoopPoints` are
  hardware-looped; once started, the grid is rock solid.
- The **prepare/arm split** already exists (`prepareRecording` before the
  count-in) — the right shape for a scheduled start.
- **Calibration infrastructure exists**: the Bluetooth calibration screen and
  `ensureCalibrationClickTrackFile` (WAV click-track generator) are exactly the
  building blocks a round-trip latency measurement needs.
- **Tempo detection** (`ClipAnalysis.bpm` + steadiness) exists as a fallback
  metadata source for imported/legacy clips.
- The team already writes custom native audio code (this module) and patches
  native deps (`patches/`), so extending native capability is realistic.

---

## 3. The architectural fix

### Principle

**One timeline, sample-domain, measured — never raced.** Every timing-critical
relationship (count-in → downbeat → file position → guide position) must be a
number computed inside one native timeline, not the emergent result of JS call
ordering. JS/React should *declare* the session ("92 BPM, 4/4, 1 bar count-in,
click through take, this guide file") and *receive* the results ("file at URI,
first downbeat at 1,412.3 ms, grid BPM 92.0003"). React must never sit between
two clocks.

### Target data model (Phase 1 — do this first, it's cheap)

Add to `ClipVersion` (and overdub stems):

```ts
/** The beat grid a take was recorded against. Travels with the clip. */
recordingGrid?: {
  bpm: number;                 // nominal BPM the user set
  meterId: MetronomeMeterId;   // "4/4" etc.
  countInBars: number;         // what was used, for re-record parity
  clickThroughTake: boolean;
  /** ms from file t=0 to the first downbeat of the grid. 0 once Phase 2
   *  guarantees alignment; measured value in the interim. null = unknown/legacy. */
  firstDownbeatMs: number | null;
  source: "metronome" | "detected" | "manual";
};
```

- Written at save time in `useRecordingScreenModel`'s `onRecorded` payload
  whenever the take used the metronome or count-in.
- Restored into the metronome (BPM, meter) automatically when the user opens
  overdub / re-record / practice on that clip — the global metronome store
  stays the *default*, the clip grid wins when present.
- Included in the share/archive format (the library archive already round-trips
  clip metadata) so your friend's Song Seed shows the same grid.
- For plain audio-file sharing outside the app, Phase 2's "t=0 == downbeat"
  guarantee is what makes "they set the same BPM and it just works" true, since
  bare m4a can't carry the metadata reliably.

This phase fixes nothing about timing but immediately fixes *memory*: the app
finally knows what tempo a take belongs to, overdub sessions preset correctly,
and inconsistency stops compounding across sessions.

### Deterministic start (Phase 2 — kills the gamble)

Invert the problem. Instead of trying to *start recording at* the downbeat
(impossible to do exactly from JS), **record through the count-in and measure
where the downbeat landed**:

1. Arm and *start* the recorder first (it's already prepared before the
   count-in today). Capture is rolling before any click sounds.
2. Start the count-in. The native metronome engine stamps its grid anchor
   (pulse 0) on a shared system clock — iOS `mach_absolute_time` via
   `AVAudioTime.hostTime`, Android `AudioTimestamp` /
   `elapsedRealtimeNanos` — and exposes it (`getGridAnchor()`), instead of
   only emitting polled beat events.
3. The recorder reports its capture-start timestamp on the same clock. (This
   requires extending `@siteed/audio-studio` — patch or fork — *or* moving
   capture into our own module, see Phase 4. Both platforms natively provide
   capture timestamps: `AVAudioSession` input latency + node render time on
   iOS, `AudioRecord.getTimestamp()` on Android.)
4. `firstDownbeatMs = (anchorTime + countInBars · barDuration − captureStart)`
   — a subtraction, accurate to ~1 ms, instead of a 50–500 ms race.
5. On save, either trim the file at the downbeat sample (so `t=0` **is** the
   "one" — the property that makes shared files portable), or keep the pickup
   audio and store `firstDownbeatMs`. Recommended: trim to the downbeat by
   default, keep one bar of pre-roll only if a "keep pickup" setting is on.

The count-in stops being a race and becomes bookkeeping. Recording "starts"
(as far as the user and the file are concerned) exactly on the one, every
take, deterministically.

### Overdub round-trip compensation (Phase 3 — kills overdub drift)

Overdubs additionally need output→input latency handled:

1. Timestamp the guide player's actual audio start on the same shared clock
   (expo-audio can't do this — the guide player moves into the native module,
   which grows a second player node; see Phase 4).
2. `stemOffsetMs = captureStart − guideAudioStart − measuredRoundTripLatency`,
   stored on the stem instead of the current hard-coded `0`.
3. Add automatic loopback calibration for the speaker/mic path: play the
   existing calibration click track, record it, cross-correlate to find the
   device's round-trip latency once per route. The Bluetooth calibration
   screen already establishes the UX pattern; this makes it automatic for the
   common case. (For Bluetooth *input*, warn instead — BT mics have variable
   latency that no offset can fix; that's a hardware truth every DAW hits.)

### Engine hardening (parallel, small)

- **Split `configure()` into live vs. structural params.** Volume applies live
  (`player.volume` / `track.setVolume`) with no restart; only BPM/meter changes
  rebuild — and during an active take, BPM/meter should be locked anyway (F5).
- **Count-in as part of one grid**: count-in pulses are just pulses −N…−1 on
  the same timeline as the take; "take starts at pulse 0" is a native fact,
  not a JS event handler.
- **Bresenham the pulse lengths** so the bar length is sample-exact for the
  nominal BPM and long-take drift vs. external tools disappears (F9).
- **Pause/resume policy**: either resume with a count-in that re-anchors to a
  *new* grid segment recorded in metadata, or (simpler, honest) mark the grid
  as valid only up to the first pause.
- **Drive UI cues from an anchor, not events**: expose the grid anchor to JS
  once; a Reanimated clock renders the count-in dots/pulse locally at 60 fps
  (same pattern as the planned Step-3 playhead work in
  `audio-architecture-plan.md`). Bridge jitter stops being visible (F10).
- **Gate recording UX on the native module** (F11): on the legacy fallback,
  hide count-in/click-through-take options rather than offering an
  untrustworthy version of them.

### Phase 4 (optional, DAW-grade): one native audio graph

The end-state that removes the whole class of problems: grow
`songseed-metronome` into a `songseed-recording-engine` that owns **click +
guide playback + capture in a single native graph** (iOS: one `AVAudioEngine`
with player nodes + input tap; Android: Oboe/AAudio duplex stream, or
AudioTrack+AudioRecord sharing `AudioTimestamp`s). One graph = one sample
clock = every offset is exact by construction; scheduled sample-accurate
recording starts become possible; monitoring the click into headphones during
a take without mic bleed becomes possible later. This is the biggest lift
(two platforms, route changes, interruptions) — Phases 1–3 deliver ~95 % of
the trust win without it, and Phase 3 already moves guide playback into the
module, so Phase 4 becomes an incremental consolidation rather than a rewrite.

Recording stays out of the Plan-B playback `AudioService` — that plan already
(correctly) scopes recording out; this engine is the recording-side sibling.

---

## 4. Trade-offs (CPU / memory / battery / risk)

**CPU** — negligible for Phases 1–3. Click synthesis is a few sine muls per
sample on one mono channel; that already runs. Recording through a count-in
adds seconds of capture that is already running afterwards anyway. The
downbeat trim on save is one pass over a WAV (the recorder's native format) —
tens of ms. Loopback calibration is a one-off cross-correlation (an FFT over a
few seconds of mono audio, run once per output route, not per take). Phase 4's
duplex stream costs roughly what playback + recording already cost today,
consolidated: ~1–3 % CPU on a mid-range phone.

**Memory** — negligible. Loop buffers are < 1 MB (one bar of mono float).
Count-in pre-roll at 44.1 kHz mono 16-bit is ~88 KB/s → a 2-bar count-in at
60 BPM is ~700 KB of temporary audio, deleted at trim. Metadata is a handful
of numbers per clip.

**Battery** — the mic and audio I/O are already hot during recording; starting
capture a few seconds earlier (during the count-in) is unmeasurable. The 8 ms
poll timers already run today; moving UI cues to an anchor-driven clock
actually *reduces* bridge traffic.

**Storage** — trimming at save means final files are the same size or smaller
than today. Keeping optional pickup audio adds ≤ one bar per take.

**Latency/UX** — improves: today the user waits on an unpredictable JS chain
after the count-in; with a rolling recorder and a measured downbeat there is
*nothing* to wait for at the transition.

**The real cost is engineering risk, not device resources:**

- Native work on two platforms (Swift + Kotlin), the historically fiddly parts
  of mobile audio: route changes mid-take, interruptions, BT quirks. Mitigated
  by phasing — each phase ships and is verifiable on its own.
- Phase 2 needs capture timestamps out of `@siteed/audio-studio`: a patch (the
  repo already maintains `patches/`), an upstream PR, or pulling capture
  in-house (which front-loads part of Phase 4). This is the main fork in the
  road and should be decided before Phase 2 starts.
- Trimming rewrites the take before attach — the save path must keep its
  current recovery guarantees (keep the untrimmed temp file until the trimmed
  attach succeeds; the existing pending-session recovery machinery already has
  the right shape for this).
- Schema change (`recordingGrid`) must be optional/backfillable so old clips
  and archives keep loading; detected-BPM (`analysis`) becomes the fallback
  `source: "detected"`.

**What phones can't fix regardless (set expectations in UX):**
Bluetooth *microphones* have variable input latency — no offset makes BT-mic
overdubs tight; warn and suggest wired/built-in. Bluetooth *speakers/headphones*
are fine for monitoring once compensated (already the calibration screen's
job) and don't affect recorded alignment once offsets are measured, because
alignment stops depending on "when the user heard it".

---

## 5. Addendum — Bluetooth calibration review & manual alignment

*(Added after review of `src/components/BluetoothCalibrationScreen/index.tsx` and
`src/bluetoothMonitoring.ts`.)*

### What the tap calibration actually measures today

The design is pragmatically sound (12-beat click track at 90 BPM, per-beat tap
residuals, median + MAD outlier gating, 10 ms rounding, manual ±10/±25 tweak).
But the number it produces is a *bundle*:

**F13. The tap-grid baseline is stamped before audio actually starts.**
`phaseStartAtRef.current = Date.now()` is set and *then* `startAudioPlayback()`
is called (`BluetoothCalibrationScreen/index.tsx:316-326`), so the expo-audio
player's own start latency (20–150 ms, variable per run) is baked into every
measurement. This is the largest fixable error source and it is JS-only:
anchor the beat grid to the player's actual reported position once it is
playing, and back-compute the true audio start.

**F14. Tap timestamps ride the touch stack.** `Pressable` → bridge →
`Date.now()` adds 30–80 ms of touchscreen/bridge latency — partially cancelled
by negative mean asynchrony (humans tapping along to a beat tap ~20–50 ms
*early*). Two opposing biases roughly net out, which is why results are usable
but fuzzy. Not worth chasing further than F13; the statistics already handle
the noise.

**F15. The OS already knows most of the answer and is never asked.**
iOS `AVAudioSession.outputLatency` reports the active route's output latency
(including a Bluetooth codec-buffer estimate, decently accurate). Android
`AudioTrack.getTimestamp()` on many devices folds in the A2DP sink's reported
delay. The metronome module already exposes `getCurrentAudioOutputRoute()` —
the natural place to also return reported latency. The calibration flow should
*seed* from the reported value and use the tap test as a verification/
fine-tune pass, not measure from zero.

**Scope note that lowers the stakes:** once Phase-2/3 timestamping (this doc,
§3) lands, calibration affects only *what the performer hears while tracking*
— never what is saved. Today a wrong calibration produces a permanently
misaligned overdub file; after, it produces slightly-off monitoring cues.
Decoupling "BT feel" from "file correctness" is the structural win; the
calibration accuracy work above is comfort, not correctness.

### Manual overdub alignment (nudge UI) — endorsed as a permanent tool

A manual stem-nudge tool is the right get-by *and* worth keeping forever (full
DAWs keep manual nudge because no measurement covers every routing). The data
model is already shaped for it: stems carry `offsetMs`, waveform peaks are
stored, and the rendered mix rebuilds from stems — this is UI work, not a
schema change. Design constraints from the codebase:

- **Coarse by eye, fine by ear.** Stored waveforms are 256 peaks
  (`MANAGED_WAVEFORM_PEAK_COUNT`) / 2048 detail bins (`WAVEFORM_DETAIL_BINS`)
  — ~88 ms/bin on a 3-minute take, too coarse to *see* a 15 ms misalignment.
  Drag the stem waveform against the guide for coarse placement; fine-tune
  with ±5/±10 ms buttons and an instant loop-audition of a short window
  (first downbeat). Ears resolve 5–10 ms flams; eyes at this zoom cannot.
  (Same interaction pattern as the calibration screen's tweak buttons.)
- **Preview cheaply, render once.** Don't re-render the overdub mix per
  nudge; audition with two live players at the trial offset and re-render
  only on commit.
- **The metronome is a free visual anchor.** Once record-through-count-in
  lands, takes usually contain acoustic bleed of the count-in clicks. Drawing
  grid lines over the stem waveform lets the click transients visibly snap to
  them — and an onset-detection/cross-correlation pass in that window can
  auto-suggest the offset. Opportunistic (little bleed with headphones), but
  free alignment when it fires.

---

## 6. Acceptance criteria ("what consistent means")

1. Record with count-in at any BPM/meter, 20 times: file `t=0` is the downbeat
   within ±5 ms, every take (verify by recording the click acoustically and
   measuring the first click's sample position).
2. Overdub on that take with count-in: recorded stem aligns to the guide
   within ±10 ms on the built-in mic, without manual nudging, every take.
3. The saved clip carries `recordingGrid`; reopening overdub/re-record presets
   the metronome to it automatically.
4. Share the clip (app archive): recipient sees the same BPM/meter and their
   metronome/count-in aligns with the file with no per-file fiddling. Share
   the bare audio: setting any external metronome/DAW to the stored BPM starting
   at file `t=0` stays phase-tight for at least 5 minutes.
5. Changing click volume mid-take does not audibly reset the click phase.
6. During a take, the beat grid never resets except by explicit user action
   (pause), and that action's effect on grid validity is recorded.
