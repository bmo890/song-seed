# The reel and the grid — what was wrong, and how it was found

**Written:** 2026-07-30 · **Branch:** `claude/reel-smoothness-jitter-nmrq75`
**Companion:** [reel-smoothness-findings.md](reel-smoothness-findings.md) is the lab notebook —
every measurement, every ruled-out theory, with numbers. This document is the story: what was
actually broken, what we believed along the way, and what the fixes were.

Read this before touching the reel, the live tape, or anything that stamps a beat grid.

---

## Where it started

Two complaints, both about feel rather than function:

1. **Playback.** "Things on the reel that aren't the waveform — pins, section markings, bpm
   markings — visibly jump from pixel to pixel as they travel right to left. It needs to look
   like a premium application, not like an app with bad plumbing."
2. **Recording.** "The waveform looks disconnected and slightly to the LEFT of the playhead,
   and doesn't move smoothly leftward."

A previous session had already attempted a fix, with no simulator and no device. It produced
five commits of plausible reasoning, and the founder's verdict on it was: *"it feels a bit
MORE jittery now."* That is the important starting fact. **Every hypothesis in that handoff
turned out to be wrong or irrelevant**, and none of them could have been falsified by reading
code. What follows only became knowable by measuring pixels.

---

## The method (the transferable part)

If you remember nothing else from this document, remember this loop. It turned four vague
feelings into four specific defects.

1. **Record the screen at device resolution.** `xcrun simctl io <udid> recordVideo out.mov`.
2. **Track features frame by frame.** Crop a horizontal band, threshold it, find dark blobs,
   follow them across frames. A bar line, a digit, a ruler tick — each is a measurable object
   with a sub-pixel centroid.
3. **Measure a RELATIONSHIP, not a position.** The killer metric was the distance between a
   label and the bar line it names, both read from the same video frame. That offset is rigid
   by construction, so any variation is the bug and nothing else. Absolute positions drift for
   boring reasons; relationships don't.
4. **Build a control.** Measure two things that *cannot* come apart (two Skia lines in the
   same transform). Whatever that reports is your noise floor. Ours was p95 0.257px — which is
   how we knew an 8.3% residual was real and not measurement error.
5. **Isolate with a probe.** `src/components/dev/SyncProbe.tsx` — one shared value driving a
   Skia layer and an RN layer side by side, with a React commit injectable in the same
   component, a sibling, or nowhere. It answered "is this the renderers or is this us?" in one
   recording. Every architectural decision in this branch rests on it.

Two hard-won gotchas: `ffmpeg` silently resamples a variable-rate capture unless you pass
`-fps_mode passthrough`, and frames identical to their predecessor are capture duplicates that
must be dropped before computing per-frame displacement.

**And the single most valuable input was the founder's vocabulary.** "Jittery" → "tugging left
every time" → "built just left of the playhead" were three *different mechanisms*, and each
phrase was precise enough to find. When something feels wrong, describing the texture of the
wrongness is worth more than any guess about the cause.

---

## Issue 1 — Reel overlays slipping against the tape

**Symptom.** Bar numbers, pin badges and section labels rode the scrolling tape but slipped
against it — worst while scrubbing.

**What we believed.** The handoff blamed Android's `SkiaTextureView` compositing split, and
proposed one-frame lead compensation as a cheap fix.

**What it actually was.** Both wrong, and provably:

- It reproduces on **iOS**, so a platform-specific compositing split can't be the cause.
- Both layers travel at *identical mean velocity* (−3.58 vs −3.59 px/step), so there is no
  fixed lag to compensate for. Lead compensation would have done nothing.

The probe found the real mechanism: Skia and RN stay glued to **sd 0.34 px** on their own, and
**any React commit landing mid-animation** breaks them apart — same component, a sibling, any
rate. A commit costs the UI thread a frame, and the two renderers come back in different ones.

Then the trap. The obvious fix — memoise the reel so commits don't reach it — **would have
broken the reel**, because `useTransportClock` wrote the reel's position *from a React effect*.
The position correction and the commit were the same event. Silencing commits parked the tape
at 0:00. We only found that by trying it.

**The fixes, in order.**

1. **Position stops travelling through React.** It now goes engine → `createTransportPositionChannel`
   → shared value, with no render in between. The seek/reset/stale-source gates that lived in
   the render path became pure functions (`domain/transportPosition`, 17 tests) run identically
   from the channel. The status hook commits only on transitions plus when the displayed
   *second* changes — one commit/sec instead of five (11 tests).
   Result: frames off by >3px **18.6% → 8.3%**.

2. **The residual was measured, not assumed.** Silencing the last commit entirely changed
   nothing (7.8% vs 8.3%) — so the planned "animated text readout" work was **cancelled before
   it was built**, saving a real typography risk on a small metadata line. Against the
   rigid-by-construction control (p95 0.257px), the residual was 10× the noise floor: real, and
   the intrinsic cost of two renderers painting one moving scene.

3. **The labels stopped being a second renderer.** Bar numbers, then section chips and pin
   badges, moved *inside* the Skia canvas under the tape's own transform.
   Result: **0.0% of frames off by >3px, sd 0.246px** — the noise floor, because the labels now
   *are* the tape.

None of the feared costs materialised for bar numbers (both label kinds are ASCII, so no
Paragraph API and no RTL), and at 3× magnification the 8.5pt Skia text is indistinguishable
from the RN rendering. Section chips *do* use Paragraph, because section names are user text
that can be Hebrew. Pin badges split visual from touch: the canvas draws them, invisible RN
views keep the gestures, and mid-drag the canvas twin hides so the badge under the finger is
the RN one — the only place a one-frame slip cannot be seen.

---

## Issue 2 — The live recording tape

Three separate mechanisms, found one at a time, each from a different founder phrase.

**"Doesn't move smoothly."** The live tape fed its α-β tracker the **raw staircase** of audio
deliveries, while playback fed an extrapolated **ramp**. This is precisely the case
`domain/motionTracking.ts` was written for — playback got that fix months ago in `a6be753`; the
live tape never did. Extrapolating the last delivery forward at real time took lurching (steps
>2× the median) from **13.4% → 0.7%**.

Worth noting: the first theory here — that an unbounded waveform path rebuild was the cause —
was **wrong**. Bounding it changed nothing measurable (13.4% → 12.9%). It was kept anyway as
defence against long takes, but it was not the bug. Measuring saved us from shipping a fix and
declaring victory.

**"Tugging left every time."** A rhythm has a frequency, so we measured one: an FFT of the
tape's speed found a clean **4.27 Hz** peak — one tug per ~235ms. That matched the code exactly:
dev builds streamed audio every 120ms while the new ramp's extrapolation window assumed ~50ms
and froze at an 80ms cap. Ramp, freeze, sag, yank. **A fixed extrapolation window shorter than
the real report gap re-creates the staircase at a lower frequency.** The window now sizes itself
from the measured delivery cadence.

**"Built just left of the playhead."** Two causes. The dev stream throttle (120ms, added in
March when each delivery cost a re-render *plus* an unbounded path rebuild — both since fixed)
meant the newest candle was always a whole chunk behind a real-time playhead. And the ramp fix
itself had made the playhead run at real time while drawn audio can only ever be one delivery
old. Three changes closed it, and *simplified* the model:

- Dev now streams at the production 40ms — what the founder tests is what ships.
- The adaptive window doubles as a **one-delivery display buffer** (a jitter buffer, standard
  for chunked real-time data), so the playhead only sweeps audio that has already arrived and
  parks *on* the final candle at pause.
- The wave is **revealed at the playhead** by a Skia clip at the tape clock — written at the
  line, the way every recorder people know does it.

Paused gap: **−26px → +5px** (the final candle's own ink straddling the line).

---

## Issue 3 — The beat grid was not telling the truth

This one came from the founder recording *nothing but the metronome* and seeing the clicks sit
a fraction of a beat off the grid lines. It is the most serious defect in this document,
because everything downstream — snapping, overdub placement, shared BPM placement — inherits
the grid's timestamps.

**Two defects.**

1. **An anchor race.** A single 120ms wait before querying the metronome engine's grid anchor.
   When it lost, the take saved with a **null downbeat** and a silently dead grid — the player
   drew no bar lines at all. Hit twice in three takes while reproducing. Now polls up to 8×
   and logs loudly when it still fails.

2. **Scheduled ≠ perceived.** The grid was stamped from when clicks were *scheduled*. The click
   the performer hears — and plays to, and the mic records — lands output+input latency later.
   The latency model corrects this *when the OS reports latency*, and it frequently doesn't
   (Android, Bluetooth). Measured in the simulator: **+230ms, 0.35 beats at 92bpm.**

**The fix, and its principle.** The recorded click bleed is ground truth by definition — it *is*
the beat as the performer experienced it. So at save, the grid now aligns itself to the clicks
the microphone actually captured (`domain/clickGridAlignment` + `services/gridSelfAlignment`):
a comb filter over the waveform sidecar measures the click phase, and the grid shifts onto it.

**The gates are the interesting part.** Signal strength alone is *not* sufficient — real music
scores high on a comb filter at any tempo, because rhythm is periodic. Validated against actual
recordings in the library, songs scored 2.0+ contrast while their two halves disagreed on phase
by hundreds of milliseconds. So the discriminator is **phase lock**: both halves of the take
must agree within 45ms. Corrections cap at 0.45 beat so bar phase can never flip, and a null
downbeat gets *stamped* from the audio rather than left dead. 10 tests on the decision logic.

**And the recording ruler now means something.** When a metronome grid is measured for the take,
the live tape draws that grid's bars and beats — the same lines playback will draw — instead of
decorative second ticks. Recording and playback finally agree about where the music is.

---

## Where the grid stands now, honestly

| Surface | State |
| --- | --- |
| Solo take, constant tempo, click through take | Stamped from measured epochs, then truth-checked against the recorded audio. Strongest it has been. |
| Count-in takes | Trimmed from measured epochs with latency correction; self-align verifies after. Good. |
| **Tempo-mapped takes** | Stamped the same measured way, but self-align **skips them** — one comb phase cannot describe a tempo change. Still depends on OS-reported latency. **Real gap.** |
| **Overdub stems** | Aligned via the guide's *measured* start epoch (stronger than scheduled time), but the save path returns before the self-align hook, and headphone overdubs have no click bleed to measure. **Not independently truth-checked.** |
| Imports | No grid claimed — honest null. Correct by design. |
| Sharing | Carries whatever was stamped. Post-fix grids travel correctly; **takes recorded before this fix may carry the old offset baked in.** |

The model the previous branch built — file-ms anchoring, tempo maps sanitised at the store
boundary, `gridValidToMs`, "never draw a guessed downbeat" — is sound and was not disturbed.
What was missing was **verification against the audio**. The grid was locked down by
construction but never checked against reality, and that is exactly the gap where both defects
lived.

---

## What is still open

1. **Device pass.** Everything here was measured on the iOS simulator with a dev build.
   `[timing] latency profile:` and `[timing] click self-align:` now log what was measured and
   what was corrected, per take — one evening of real recording says whether the gates are
   tuned right on real hardware.
2. **Self-align for tempo-mapped takes** — per-segment comb, same gates. Closes the table row
   that matters most for DAW-like work.
3. **A repeatable grid-truth QA procedure** in `docs/qa/` — record metronome, extract click
   phase from the saved file, compare to the stored grid. Turns "we locked it down" into a
   check that runs in minutes.
4. **`OverdubLayerLanes`** is the last RN overlay riding the tape (below the reel, least
   exposed). Same treatment as the section chips when it becomes visible.
5. **Physical Android.** Builds and runs clean with all of this, and no font/Skia errors, but
   the emulator ANRs too much to time anything.
6. **`src/components/dev/SyncProbe.tsx`** stays until the above lands, then gets deleted.

---

## Lessons worth keeping

- **A feeling is data.** "Tugging every time" has a frequency; measure it. "Built left of the
  playhead" is an offset; measure it. Both pointed straight at their causes.
- **Build the control before believing the metric.** The rigid-pair control is what separated
  a real 8.3% residual from measurement noise, and it is what proved the labels were finally
  glued at the end.
- **Test the fix you're about to build, before you build it.** Two planned pieces of work were
  cancelled by a measurement that took ten minutes — the animated-text readout, and the
  path-rebuild bound as a smoothness fix.
- **A wrong fix that improves the number is still wrong.** Bounding the path rebuild was
  sensible engineering that fixed nothing. Only the measurement said so.
- **Never trust a schedule over what the microphone recorded**, and never let a statistic touch
  user data without a stability gate.
