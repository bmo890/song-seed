# Grid truth — the check that decides whether recording can be trusted

**Instrument:** `scripts/grid-truth.py` · **Requires:** `ffmpeg`, `numpy`

Recording and playback are the spine of SongNook. Everything downstream — overdubs,
sharing, opening a take in Logic at the same BPM — inherits the beat grid's timestamps. This
is the check that says, in milliseconds, whether that grid is telling the truth.

It exists because the app's own truth-check turned out to be blind (see
[What it found the first time](#what-it-found-the-first-time)), and because five rounds of
plausible reasoning about this code had already made things worse before anyone measured
pixels. **Do not tune a timing constant without running this first and after.**

---

## Running it

```bash
python3 scripts/grid-truth.py
```

Every click take in the booted simulator's library, one line each:

```
take                      bpm  beats  contrast     error    ±p90  drift/min  verdict
────────────────────────────────────────────────────────────────────────────────────
clip-1785234938327         92     48     30.34   -89.5ms     0.7       +1ms  OFF
```

| Column | Means |
| --- | --- |
| `contrast` | How far the clicks stand above everything else. Under ~1.5 there is no click to measure and every other column is meaningless. |
| `error` | **`grid_line_time − click_time`, in ms.** Positive: the grid line sits AFTER the recorded click (grid late, beat appears to the left of the line). Negative: grid early. |
| `±p90` | Spread of the per-beat errors. Small means the offset is a real constant; large means the take's clicks are not resolvable beat by beat and the median is soft. |
| `drift/min` | Slope of error against time. Non-zero means the stored **BPM** is wrong, not just the downbeat. |

Other forms:

```bash
python3 scripts/grid-truth.py --clip clip-1785234938327          # one take
python3 scripts/grid-truth.py --audio take.m4a --bpm 92 --downbeat 15
python3 scripts/grid-truth.py --json                             # for diffing runs
```

## Why it can be believed

It shares nothing with the code it is checking. It does not read the app's waveform sidecar,
call app code, or trust any timestamp the app wrote. It decodes the **saved audio file** to
samples with `ffmpeg` (which honours the container edit list, so it sees the same `t=0` a DAW
would), high-passes, builds a positive-flux onset envelope at 1 ms, combs it at the stored
BPM, then matches each predicted beat to its own onset with sub-frame interpolation.

**Its noise floor is measured, not assumed.** Synthesize clicks at a known phase, with
sustained low-frequency "music" on top that must not fool the detector:

```
control.wav   92   46   1361.68   +0.1ms   0.2   +0ms   ON THE GRID
```

Truth was 137 ms; it read 137.1 ms. So an error of ±1 ms is instrument noise and anything
above ~5 ms is the app.

## The procedure

1. Record a take with the metronome audible and the click running through the take. Play or
   tap along — real material matters, a bare metronome hides the hard case.
2. Save it, then **open the player and press play immediately** — that is the natural
   gesture, and it is the one that used to preempt the background decode and silently skip
   self-alignment.
3. Run the harness.
4. `ON THE GRID` (|error| ≤ 10 ms, |drift| ≤ 20 ms/min) is the bar. Watch `contrast` first:
   a low-contrast row is a failed measurement, not a passing grid.
5. Keep the numbers in `docs/qa/RUN-LOG.md` with the commit they came from.

Cross-check the verdict against the app's own logging for the same take — `[timing] latency
profile:`, `[timing] head trim committed:`, `[timing] click self-align:`. When the harness
and the log disagree, the harness is right.

---

## What it found the first time

Measured 2026-07-30 on the iOS simulator against five click takes already in the library.
All five had `firstDownbeatMs: 0`, i.e. **not one of them had ever been corrected by
self-alignment.**

**1. The grid was 89.5 ms EARLY on the cleanest take** (contrast 30.3, ±p90 0.7 ms, drift
+1 ms/min — a rock-solid constant offset). Consistent with the two known biases stacking:
the head trim deliberately cuts `HEAD_TRIM_SAFETY_EARLY_MS` (15 ms) before the musical start
and used to stamp `firstDownbeatMs: 0` anyway, plus ~75 ms of round-trip latency that the
simulator does not report, so the trim was placed in the render domain
(`[timing] OUTPUT LATENCY UNKNOWN — trim stays render-domain`).

Note the sign: the grid line lands *before* the click, so the transient sits to the RIGHT of
the line. Worth confirming against what you see on screen, because it is the opposite of
"the recorded beat sits just before the grid marker."

**2. Self-alignment cannot see the click at all on a real take.** This is the important one.
Fed the same take's real sidecar, the app's own comb returns:

```
estimate: { phaseMs: 256.9, contrast: 1.07, msPerBin: 15.13 }
halves:   [303, 82]          ← the two halves disagree by 221ms
RESULT:   unchanged (contrast 1.07)
```

The harness reads contrast **30.3** on the same audio. The app is not being conservative —
it is blind, and it declines honestly. The cause is the signal, not the gates:

- The sidecar is a **loudness envelope built for drawing waveforms**: 2048 RMS bins over the
  whole file (15.1 ms per bin here), log-compressed to dB, normalized, 8-bit quantized.
- A click's transient is a couple of ms of mostly high-frequency energy. Averaged into a
  15 ms RMS bin it is diluted several-fold; dB compression flattens what is left.
- Real takes are *full* of sustained musical content — only 3% of bins sat meaningfully
  above the median — so the click never stands out.
- Measured on the same file: the broadband RMS envelope has a peak-to-median ratio of 4.6,
  and a high-passed envelope 6.1. High-passing is what separates a click from music, and the
  sidecar does none of it.

The sidecar comb's best score was **0.0230 against a mean of 0.0213**. There is nothing to
find. It succeeds only on near-silent metronome-only takes, which is exactly why grids
"sometimes correct themselves and sometimes don't."

**So raising or lowering the gates is not the fix.** Self-alignment needs a real onset
envelope — high-passed, ~1 ms resolution, derived in the same native decode pass that already
builds the sidecar. Until it has one, a click take's grid rests on OS-reported latency, which
the simulator (and Bluetooth, and Android) does not report.

This is what the harness is for: it cancelled a planned gate-tuning change before it shipped,
which would have been another fix aimed at the wrong thing.

---

## Validating the fix against the same take

`domain/onsetEnvelope.ts` builds the right signal while recording: the samples are
first-differenced, summed into ~1ms bins, and read as a rising edge. To check it without
waiting for a new recording, the take above was decoded and pushed through the **real app
code** in the recorder's own 40ms delivery chunks:

```
ONSET  phase=89.9ms  contrast=30.40  binMs=0.9977
RESULT corrected by +90ms → firstDownbeatMs 90   (onset signal, contrast 30.4)
```

| | contrast | says the click is at | verdict |
| --- | --- | --- | --- |
| sidecar (old) | **1.07** | — | declines |
| onset envelope (new) | **30.40** | 89.9 ms | corrects by +90 ms |
| grid-truth harness (independent) | 30.34 | 89.5 ms | — |

The app and a completely independent Python instrument agree to **0.4 ms** on real recorded
audio with real click bleed and real room noise. Note `binMs = 0.9977`, not 1: at 44100Hz a
1ms bin is 44 frames, and reporting the nominal figure instead of the real one put ~9ms of
drift-induced bias into the phase.

Reproducing it (needs a take whose audio you have on disk):

```bash
ffmpeg -v error -i take.m4a -ac 1 -ar 44100 -f f32le - > take.f32
```

then feed `take.f32` through `appendOnsetSamples` in 40ms chunks and call
`alignGridToRecordedClicks`. Compare its correction against
`python3 scripts/grid-truth.py --audio take.m4a --bpm <bpm> --downbeat <stored>`.
