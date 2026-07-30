# Reel smoothness — what the measurements say

Measured 2026-07-29 on the iOS simulator (iPhone 17, iOS 26.2, dev build, ProMotion
display), by recording the screen with `xcrun simctl io … recordVideo` at device
resolution and tracking features frame by frame. Every number below comes from pixels on
screen, not from reasoning about the code.

Method: the bar-number labels (React Native views) and the bar hairlines they name (drawn
inside the Skia canvas) both fall in the same horizontal band of the same video frame. The
number is a rigid offset from its line by construction, so any variation in that offset is
the RN overlay letting go of the Skia tape. Each label is followed across its own screen
crossing and de-meaned against itself, so nothing depends on cumulative tracking.

## 1. It reproduces on iOS

The Android `SkiaTextureView` compositing theory is not the cause. On iOS, at 2× zoom
during playback, the label-to-its-own-bar-line offset has **sd 2.3 px (0.8 pt)** and
**22% of frames sit more than 2 px off**.

## 2. It is a race, not a lag — so lead compensation cannot work

Both layers travel at the same mean speed (−3.58 vs −3.59 px/step over 253 steps). There is
no fixed pipeline delay to compensate for. Extrapolating the overlays forward by one frame
would not have helped.

## 3. The shape of the fault: a dropped frame in one renderer

The offset is not a wobble. It is **exact** — ±0.1 px, the measurement noise floor — for
long stretches, broken by short bursts where it jumps **3.5 to 9 px** and comes back. At
this zoom the tape travels ~3.7 px per frame, so every excursion is one or two frames of
travel. The label is not drifting; it is missing a frame the canvas caught, or vice versa.

This is exactly the reported symptom: "goes left with the reel but constantly jumps back
slightly to the right, then back to where it should be."

## 4. The two renderers are perfectly glued until something commits

`src/components/dev/SyncProbe.tsx` is a dev-only instrument built for this: one shared
value animated by a single linear `withTiming`, driving a Skia `Group` transform and an RN
`useAnimatedStyle` transform side by side — the same arrangement the reel uses, with
nothing else in play.

| Probe condition | RN-vs-Skia drift | steps where one layer stalled against the other |
| --- | --- | --- |
| no React re-render | sd **0.34 px** | **0** of 664 |
| re-render at 5 Hz (the app's own throttle cadence) | sd **4.74 px** | **694** of 3001 (23%) |
| re-render at 20 Hz | sd **5.74 px** | **331** of 1444 (23%) |

Nothing changes between rows but a `setState` on an interval. So Skia and RN hold lockstep
on their own, and a React commit landing mid-animation is enough to break it. The rate
barely matters — 5 Hz is as damaging as 20 Hz. The 23% disagreement rate in the probe
matches the 22% measured in the real reel.

## 5. The reel re-renders ~4–5×/second during playback

Instrumented `AudioReel` with a render counter and a prop-identity diff. During playback it
renders 4–5 times a second, and the props whose identity changes are:

`renderOverlay`, `renderBelowSurface` (inline render-props rebuilt by `PlayerTimeline` on
every one of its renders), and `onSeek`, `onTogglePlay`, `onSeekToStart`, `onSeekToEnd`.

`PlayerTimeline` is already `React.memo`'d, so the commits are reaching it from above and
then being forwarded into the reel through those unstable references.

## 6. The per-tick commit is the reel's own position feed

The chain, confirmed end to end:

```
expo-audio status listener (20 Hz)
  → useThrottledAudioPlayerStatus setState (throttled to 5 Hz)
  → useFullPlayer.playerPosition
  → PlayerScreen re-renders (it renders the mm:ss readout six lines above the reel)
  → PlayerTimeline re-renders, rebuilding renderOverlay / renderBelowSurface
  → AudioReel re-renders
  → one of the two renderers drops a frame, and the labels come off the tape
```

`useFullPlayer` passes `positionIntervalMs: 200` at the call site, which is why changing the
hook's *default* earlier appeared to disprove the theory — the default was always overridden.

The important part: **that re-render is load-bearing.** `useTransportClock` writes
`sharedCurrentTimeMs` from a React effect keyed on the `positionMs` prop
(`src/hooks/useTransportClock.ts:95`), so the reel's position correction and the React
commit are the same event. Silencing the commits parks the tape at 0:00. Memoising the
`AudioReel` boundary — the obvious-looking fix — would have broken the reel, not fixed it.

## 7. Validated: taking React out of the position path removes the detachment

Measured by free-running the tape from its own frame callback (looping, ignoring position
reports) with position commits silenced, so the tape scrolls with **zero** React
involvement. Scroll speed matched the baseline to within 0.5% (3.63 vs 3.65 px/frame), so
the comparison is like-for-like.

| | baseline (5 Hz React position feed) | free-run (no React) |
| --- | --- | --- |
| sd of label-to-bar-line offset | 2.25 px | **1.67 px** |
| max excursion | 10.0 px (≈2.7 frames of travel) | **3.99 px (≈1.1 frames)** |
| frames off by >3 px | 18.6% | **1.4%** |

Multi-frame detachment — the visible kind — essentially disappears. What remains is at most
a single-frame slip, 1.4% of the time. (The >1 px count rises, from 24% to 73%, because the
free-run tape lands on a new sub-pixel position every frame instead of stalling on repeats,
so the centroid estimate wobbles; a constant sub-pixel offset is not what the eye reports.)

## 8. Isolating the reel is NOT sufficient — any commit anywhere does it

The obvious-looking fix is to memoise the reel so React commits don't re-render it. Tested
with the probe by moving the churn into a *sibling* component, leaving the animated layers
memoised so they never re-render:

| Probe: where the commit lands | RN-vs-Skia drift | steps where one layer stalled |
| --- | --- | --- |
| nowhere | sd 0.34 px | 0 of 664 |
| same component as the layers | sd 4.74 px | 23% |
| **a sibling; layers memoised** | **sd 3.54 px** | **32% of 2916** |

A commit costs the UI thread a frame wherever it happens, and the two renderers come back
in different frames. So the achievable goal is to REDUCE the number of commits during
playback; only having one renderer own the moving scene is structurally immune.

## 9. What was built, and what it bought

- `src/domain/transportPosition.ts` — the position gates as pure functions, plus
  `createTransportPositionChannel`: the path position takes from the audio engine to the
  reel with no React in between. 17 tests.
- `useThrottledAudioPlayerStatus` — gained `onRawStatus` (every native event, unthrottled,
  no setState). Its commit rule no longer fires for position at all: transitions commit
  immediately, and a plain tick commits only when the displayed SECOND changes, which is
  all any mm:ss readout can show. One commit per second instead of five. 11 tests.
- `useFullPlayer` — publishes the gated position from the raw listener; the render path is
  now read-only against the source-position hold, so the two cannot disagree about when the
  engine arrived. `playerPositionRef` is fed from the raw event, so imperative readers
  (seekBy, punch-in) are fresher than before rather than staler.
- `useTransportClock` — subscribes to the channel and runs the same gates there.
  `channelDriven` is false when practice mode's native pitch engine owns the transport, or
  when the engine is not yet loaded with the clip on screen, and position then arrives as a
  prop exactly as before.

Measured on the reel, same clip, same 2× zoom, same script as the baseline:

| | before | after |
| --- | --- | --- |
| sd of label-to-bar-line offset | 2.25 px | **1.65 px** |
| p95 | 6.47 px | **3.27 px** |
| frames off by >3 px | 18.6% | **8.3%** |

sd and p95 now sit at the free-run ideal. The >3 px count does not (ideal was 1.4%), and
the residual is consistent with the ~1 commit/second that remains: the probe measured 23%
at 5 Hz, which scales to roughly 5% at 1 Hz.

Verified by hand in the simulator: play, pause (playhead held to 0.00 px over 5 s), scrub
while paused (landed and held, no flick-back), scrub while playing (landed and continued
forward), switching clips (new clip started at 0:00 with no stale position), autoplay on
open, end-of-clip clamp.

## What follows from this

Two options, and they are not exclusive.

**A — feed the reel's position without going through React.** BUILT, see §9. Roughly halved
the visible detachment and left the residual at the ~1 commit/second the mm:ss readout
still needs.

**A2 — the last commit. DO NOT BUILD THIS.** Tested by silencing the last position commit
entirely (readout frozen): sd 1.672 px, p95 3.268 px, >3 px 7.8% — statistically identical
to the shipped 1.645 / 3.267 / 8.3%. The residual is NOT the readout commit, so the
typography risk of animated text buys nothing.

## 12. Bar numbers moved into the canvas — detachment gone

`GridRulerLabels` (RN views) is deleted. The bar numbers and tempo/meter change labels are
now Skia `Text` drawn inside `PlaybackTapeVisualizer`'s canvas, under the tape's own
translate transform (and outside the scale transform, so positions follow the zoom while
the glyphs keep their shape). They are part of the same picture as the bar lines they name,
so nothing can pull them apart.

| | >3 px detachment | max | sd |
| --- | --- | --- | --- |
| original baseline | 18.6% | 10.0 px | 2.25 px |
| position off React (§9) | 8.3% | 8.6 px | 1.65 px |
| **numbers drawn in Skia** | **0.0%** | **1.23 px** | **0.246 px** |

0.246 px sd against the rigid-by-construction control's 0.257 px — they are now as glued as
two features in the same draw call, because that is what they are.

None of the feared costs applied here: both label kinds are ASCII (`"4/4 · 120"`), so no
Paragraph API and no RTL shaping. Compared at 3× magnification against the RN rendering,
the 8.5 pt Skia text is visually indistinguishable. The only thing dropped is
`letterSpacing: 0.4`, which Skia's basic `Text` has no equivalent for and which is not
perceptible on one- and two-digit numbers.

**Still RN, still exposed:** `SectionLabelBadges` and `PracticePinBadges`. Those carry USER
text that can be Hebrew, so they need the Paragraph API, and the pin badges carry gestures.
They will still show roughly the §9 numbers.

## 10. The residual is real, and it is the two-renderer cost

Control: measure two features that CANNOT come apart — two bar hairlines, both Skia
primitives inside the same transform — with the identical pipeline.

| | p95 | frames off by >3 px |
| --- | --- | --- |
| Skia hairline vs Skia hairline (rigid by construction) | **0.257 px** | **0.1%** |
| RN label vs its Skia hairline (after the fix) | 3.267 px | 8.3% |

The metric's noise floor is essentially zero, so the remaining 8.3% is genuine detachment —
an order of magnitude above what the measurement itself contributes. Since it survives with
zero commits, it is not React's doing: it is the intrinsic cost of painting one moving scene
with two renderers. **Only option B removes it.** (The control's own max is contaminated by
tracking failures where the tape jumps more than the matcher's 16 px window; read the p95,
not the max.)

## 13. Live recording — fixed

The live tape fed its α-β tracker the **raw staircase** of audio deliveries, while playback
feeds an extrapolated **ramp**. That is precisely what `motionTracking.ts` was written to
avoid ("painting the staircase … makes the tape accelerate from a near-standstill several
times a second"); playback got that fix in a6be753 and the live tape never did.

It now stamps each delivery against the UI clock and extrapolates it forward at real time —
capture advances one ms per ms — capped at 80 ms so a stalled capture settles instead of
running away.

| steps that moved >2× the median (a lurch) | |
| --- | --- |
| before | **13.4%** |
| after | **0.7%**, and 1.0% late in a 40 s take |
| playback tape, for scale | 0.0% |

The "disconnected" look is also better: the newest candle's offset from the playhead used to
**oscillate across an 11 px swing** (median −5 px, p90 +6 px); it is now stable at +5 px.
A steady ~1.7 pt offset remains and is worth an eyeball, but the instability is gone.

Bounding the path rebuild (§11) was **not** the cause — it changed nothing measurable
(13.4% → 12.9%). It is kept anyway as defence against unbounded growth on long takes.

### 13b. The "tugging left" after the first ramp fix

Founder feedback on the ramp fix: no longer jittery, but a rhythmic leftward tug. Frequency
analysis of the tape's speed found a clean **4.27 Hz** peak — one tug every ~235 ms. That
matched the code exactly: dev builds stream audio every 120 ms
(`LIVE_STREAM_INTERVAL_MS = __DEV__ ? 120 : 40`, arriving in ~235 ms pairs), while the
ramp's extrapolation window assumed deliveries every ~50 ms and froze at an 80 ms cap. Each
cycle: ramp 80 ms, freeze, tape sags into the frozen target, next delivery yanks it forward.
A fixed window shorter than the real gap re-creates the staircase at a lower frequency.

Fix: the window now adapts to the **measured** inter-delivery gap (EMA, ×1.5, clamped
60–500 ms), so it only bites when capture genuinely stalls, whatever the cadence.

| same screen, same clip, 24 s each | lurching steps | step-size spread (IQR/median) |
| --- | --- | --- |
| 80 ms fixed cap | 12.4%, 4.27 Hz peak | 0.98 |
| adaptive window | **1.3%**, no comparable peak | **0.15** |

Note the production stream interval is 40 ms, so this tug was mostly a dev-build artifact —
but dev builds are what the founder tests, and the adaptive window is the right shape
regardless.

### 13c. "Built just left of the playhead" — the final shape of the live tape

Founder feedback continued: the wave visibly assembles left of the playhead and catches up,
and a paused take shows a clear hole between the wave's end and the playhead. Both were
real, and the second was introduced by the ramp itself: the playhead ran at REAL time while
the newest candle can only ever be one delivery old, so the playhead led the drawn wave by
up to a delivery gap — ~9 pt at the dev cadence.

Three changes close it, and together they *simplify* the model:

1. **The dev stream throttle is gone** (`LIVE_STREAM_INTERVAL_MS` 120 → 40, matching
   production). It dated from March, when every delivery cost a re-render plus an unbounded
   path rebuild; both costs are fixed, and the throttle itself had become the visible
   problem. What the founder tests is now what ships. This is the answer to "what are all
   the voice-memo apps doing?" — they deliver audio every 10–40 ms, so nothing clever is
   needed on top.
2. **A one-delivery display buffer** (the adaptive window from §13b, now used as a delay):
   the tape renders audio one delivery-window behind real time, so the playhead only ever
   sweeps audio that has already arrived. Continuous through every delivery by
   construction; on pause the ramp cap and the delay cancel exactly, parking the playhead
   ON the final candle. This is a jitter buffer — bog-standard for chunked real-time data.
3. **The wave is revealed at the playhead** (a Skia clip at the tape clock): candles are
   drawn only up to the playhead line, so the wave is "written" at the line the way every
   recorder people know does it — never assembling ahead, never trailing.

Measured: paused gap −26 px → **+5 px** (the final candle's own ink straddling the line);
during recording the wave end sits at the playhead, median −1.7 pt / p90 +1.7 pt (wider p10
tail is silence-detection noise in the sim mic). Smoothness held: 3.3% lurching at the
production cadence vs 12.4% at the original tug.

The playhead itself is dead center by construction — `playheadX = canvasWidth / 2`.

## 11. Live recording — how it was found

The other half of the original report ("the waveform looks disconnected and slightly to the
left of the playhead, and doesn't move smoothly leftward") had never been measured. It is a
different problem from the playback one:

- `LiveTapeVisualizer` draws **everything inside one Skia canvas** — wave, ruler, playhead,
  all under a single `tapeTransform`. There are no RN overlays, so nothing can detach. The
  label-tearing class of bug does not exist here.
- But the tape lurches. Over an 841-frame clean run its travel strays from the straight line
  it should follow by **sd 5.4 frames of motion, worst 16.5 frames**.
- Cause, by reading `LiveTapeVisualizer.tsx`: the whole wave path is rebuilt from scratch on
  every data point, ~20×/second, and `dataPoints` grows for the entire take — plus a ruler
  loop over every second recorded so far. A five-minute take means ~6000 segments rebuilt
  twenty times a second on the JS thread while the tape is meant to be scrolling. The
  prediction that follows is testable: **it should get worse the longer you record.**
- The fix is to build the wave path incrementally (append the new chunks, keep the rest) and
  to feed `targetDataMs` from outside React the way playback's position now is. No design
  cost. Not attempted yet.

## 14. Android

Built and ran on an emulator (Medium_Phone_API_36.1) with every change in place. The app
launches, the player opens, the reel canvas renders, and there are **no font, Skia or
typeface errors in logcat and no fatals** — which is the Android-specific risk worth
checking, since `useFont` resolves a `require`d `.ttf` and that is the part most likely to
behave differently there.

A like-for-like smoothness measurement was **not** achievable: the emulator throws repeated
system-level ANRs under a debug bundle, so any frame timing measured on it says more about
the emulator than about the app. Numbers on a physical Android device are still outstanding.

Worth noting: the §12 change also makes the `SkiaTextureView` concern from §1 moot **for the
bar numbers specifically** — they are no longer RN views, so there is no longer a second
renderer to fall out of step with. Section labels and pin badges remain exposed to it.

Two build gotchas for next time: `ANDROID_HOME` must be exported for `expo run:android`, and
its install step picks the ambiguous `app:installDebug` task in this flavoured project — the
APK builds fine, so install it directly with
`adb install -r android/app/build/outputs/apk/development/debug/app-development-debug.apk`.
`scripts/push-dev-samples.sh` is iOS-only; on Android push into the sandbox with
`adb push` to `/data/local/tmp` then `adb shell run-as com.bmostudio.songnook.dev cp … files/dev-samples/`.

**B — one renderer owns the moving scene**, i.e. the reel's text is drawn inside the Skia
canvas. Then a commit can still cost a frame, but the tape and its labels lose it
*together* and nothing detaches. Structurally immune on both platforms. Costs, which need
the founder's yes under the CLAUDE.md redesign guardrail: Skia's basic `Text` has no
`letterSpacing` and no tabular figures (both are in `GridRulerLabels` today), and section
and pin titles are user text that can be Hebrew, which needs the Paragraph API for shaping.

A does not make B unnecessary and B does not make A pointless — B removes the detachment,
A removes the frame drops that also make the waveform itself look staggered.

## Reproducing the measurement

The analysis scripts are throwaway; the technique is not. Record with
`xcrun simctl io <udid> recordVideo --codec h264 out.mov`, crop the reel's label band with
`ffmpeg -i out.mov -vf "crop=W:H:X:Y,format=gray" -fps_mode passthrough -f rawvideo …`,
then find dark blobs per row-band and track them. Two cautions learned the hard way:
`ffmpeg` will resample a variable-rate capture unless you pass `-fps_mode passthrough`, and
video frames identical to their predecessor are capture duplicates and must be dropped
before computing per-frame displacement.
