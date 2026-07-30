# Reel jitter — handoff to a session that can see the screen

Paste this whole file as your opening message to a local Claude Code session running
against a simulator/device. It is written to be read cold.

---

## What you are looking at

SongNook (repo folder `song-seed`). Read `CLAUDE.md` and `docs/design-system.md` before
any UI change — the design rules there are hard rules, not suggestions.

Work in progress lives on branch **`claude/reel-smoothness-jitter-nmrq75`** (5 commits
ahead of `main`, all pushed). Everything below was done by a REMOTE session with no
simulator and no device — every claim about how it *looks* is unverified reasoning. Treat
it as a set of hypotheses to test, not as established fact. Some of it is probably wrong;
that is why you exist.

The "reel" is the scrolling audio tape: `src/components/common/AudioReel.tsx` wrapping
`src/components/visualizers/PlaybackTapeVisualizer.tsx` (playback) and
`src/components/visualizers/LiveTapeVisualizer.tsx` (live recording).

## The founder's original complaint

> The reel doesn't feel completely smooth. In live recording the waveform looks
> disconnected and slightly to the LEFT of the playhead, and doesn't move smoothly
> leftward — more noticeable when recording WITHOUT a metronome. In playback it's
> generally smooth, but things on the reel that aren't the waveform — pins, section
> markings, bpm markings — visibly jump from pixel to pixel as they travel right to left.
> It needs to look like a premium application, not like an app with bad plumbing.

## What the remote session changed (and why)

Five commits. Read them with `git log -p main..HEAD` if you want the full reasoning; each
message is long and explains itself.

1. **`a6be753` The tape keeps its own velocity** — Playback re-anchored its motion ramp to
   the last *painted* position on every position report (~20/s), so the scroll restarted
   from near-zero velocity 20×/second. Replaced with an α-β tracking filter in
   `src/domain/motionTracking.ts` (unit-tested, 8 tests). Also removed a duration-relative
   dead band (froze long clips) and converted a scrub-settle window from FRAMES to
   milliseconds (it ran half as long on 120Hz displays). Live recording was rebuilt to
   anchor on capture time rather than the take's elapsed clock, and its scroll moved off
   the JS thread onto a UI-thread transform.
2. **`d01d513`** — docs only (Kotlin metronome review, unrelated).
3. **`45a3612` Three vestiges of an older reel** — removed dead state.
4. **`d8a0d4b` The pause anchor was a latch, not a window** — fixed three real defects
   found by audit, notably: seek-while-paused did not move the playhead, because a pause
   anchor that was meant to expire after 220ms never did (`pauseHoldUntil` was written and
   never read).
5. **`aa0aa4a` Glue the overlays to the tape** — the attempted fix for the current
   problem. See below.

## Current status: STILL JITTERY after all of the above

The founder pulled `aa0aa4a` and reports it is **still jittery**. Latest description,
which is the most valuable evidence in this document:

> It feels a bit MORE jittery now. I'm noticing it on things that are another layer — not
> on the measure marks on the reel, but on the NUMBER of the measure mark. Not on the pin,
> but on the icon circle / title of the pin, and on the label of the section. It goes left
> with the reel but constantly jumps back slightly to the right, then back to where it
> should be, the whole time while the reel is moving. Nothing feels 'glued in place' to
> the reel.
>
> Also on the waveform, but only slightly — it feels staggered just enough that it looks
> blurry to my eyes, or hard to follow.

Note "MORE jittery". A plausible reading: the Skia layer genuinely got smoother, which
removed the camouflage that was hiding a pre-existing overlay desync. Do not assume this;
test it.

## The fault line (this is the strongest clue)

Every layer the founder names as jittering is a **React Native view**. Every layer he
names as steady is drawn inside the **Skia canvas**.

| Steady (Skia primitives)              | Jittering (RN views)                        |
|---------------------------------------|---------------------------------------------|
| bar/measure hairlines                 | bar NUMBER labels (`GridRulerLabels.tsx`)   |
| pin vertical line                     | pin badge circle + title (`PracticePinBadges.tsx`) |
| section band fill                     | section label (`SectionLabelBadges.tsx`)    |
| the waveform itself                   | —                                           |

All the RN overlays ride the same shared value, `timelineTranslateX`, which the Skia canvas
also consumes through a Skia `Group` transform. Same input, two different renderers.

## What commit `aa0aa4a` did about it, and what it did NOT fix

Fixed (all real, all confirmed by reading the code — but none visually verified):
- All three overlay components ran **one `useAnimatedStyle` per label**, so following the
  tape cost N independent view-prop commits per frame. Grid labels and section labels now
  lay out once in content space inside ONE translating `Animated.View`.
- `SectionLabelBadges` animated **`maxWidth`**, a LAYOUT property, every frame per badge.
  Clipping is now a static clip box.
- `PracticePinBadges` called **`withSpring` from inside `useAnimatedStyle`**, which
  re-evaluates every frame because it reads the scrolling translateX — re-seeding the lift
  spring 60×/second per pin. It now starts on the drag transitions only.

Deliberately NOT changed:
- `PracticePinBadges` still has one animated view per pin (it needs per-pin drag gestures
  and edge-anchor flipping). It also still writes `zIndex` — a non-transform prop — from
  inside its animated style every frame. **This is a live suspect.**
- `src/components/common/OverdubLayerLanes.tsx` has the same per-lane shape, untouched.

## The leading hypothesis, and how to kill or confirm it

On Android, RN Skia's canvas is a **`SkiaTextureView`** — verified by reading
`node_modules/@shopify/react-native-skia/android/src/main/java/com/shopify/reactnative/skia/SkiaBaseView.java`
line 21, which constructs a `SkiaTextureView`; it only switches to `SkiaSurfaceView` when
`opaque` is set, which this reel cannot use (it needs transparency for the pending-line
cross-fade in `AudioReel.tsx`).

A TextureView publishes frames through a different path from the regular view hierarchy.
So the Skia canvas and sibling RN views can legitimately sit one frame apart on Android,
and no amount of JS tuning fixes that.

**The single most valuable thing you can do first: run this on iOS as well as Android.**

- Jitter on Android but NOT iOS → it is the TextureView/compositing split. The only real
  fix is to stop splitting the moving scene across two renderers (see below).
- Jitter on BOTH → the remote diagnosis is incomplete. Suspect something shared: Reanimated
  4.1.6 + Fabric prop-commit timing (`newArchEnabled: true` in `app.json`), or the mapper
  chain in `PlaybackTapeVisualizer` where a `useDerivedValue` *writes* `translateX` as a
  side effect (search for "Dynamic bounded rules") — a value written inside a mapper and
  read by another mapper can land a frame late.

Relevant versions: Expo 54.0.33, RN 0.81.5, Reanimated 4.1.6, RN Skia 2.4.21, Fabric ON.

## Suggested investigation order

1. **iOS vs Android.** As above. This one answer changes everything downstream.
2. **Record slow motion.** Phone slow-mo of the reel scrolling during playback, then step
   through frames. Determine whether the labels LAG the tape (appear to the right of where
   they belong, since motion is leftward) or LEAD it, and whether the offset is constant or
   alternating. Constant offset = a fixed pipeline delay, fixable by compensation.
   Alternating = a race, not fixable by compensation.
3. **Isolate the renderer.** Temporarily hard-code `timelineTranslateX` to a constant and
   drive the scroll ONLY from the Skia side, then only from the RN side, and see which one
   stutters on its own. This separates "the value is jittery" from "the two consumers
   disagree".
4. **Check the actual frame rate.** Android dev menu → Perf Monitor, or
   `adb shell dumpsys gfxinfo <package> framestats`. If the app is dropping frames or the
   display is running at a variable refresh rate, everything above is downstream of that.
5. **Test with pins and sections absent.** A clip with no pins, no sections, no grid should
   show only the Skia canvas moving. If THAT still looks staggered, the problem is in the
   canvas/motion model, not the overlays.

## The definitive fix, if it comes to that — needs the founder's yes

Draw the reel's text INSIDE the Skia canvas, so one renderer owns the whole moving scene.
Glued by construction, on both platforms. It is a real architectural commitment and it has
design costs the founder must approve first (`CLAUDE.md` redesign guardrail — a restyle may
never silently degrade anything):

- Skia's basic `Text` has no `letterSpacing` and no tabular figures. Both are in these
  labels today (`GridRulerLabels.tsx` uses `letterSpacing: 0.4` and
  `fontVariant: ["tabular-nums"]`).
- Section and pin titles are USER text, which can be Hebrew. Skia's basic `Text` does not
  shape complex scripts — that needs the Paragraph API. The app is fully RTL-capable and
  remaps fonts to Heebo for Hebrew (see `App.tsx`), so this is not a corner case.
- Fonts would load via `useFont` against the `@expo-google-fonts/plus-jakarta-sans` assets,
  with the same RTL remapping App.tsx does.

A cheaper experiment worth trying BEFORE committing to that: if slow-motion shows a
CONSTANT one-frame lag, add a one-frame lead to the overlays' transform (extrapolate
`translateX` forward using the tape velocity, which `PlaybackTapeVisualizer` already
computes as `progressVelocity`). ~30 lines, reversible, no design cost. It only works if
the offset is constant — it will not help a genuine race.

## Ground rules

- `npx tsc --noEmit` and `npx jest` must stay green (currently 645/645).
- Design tokens only, no new hex or fontFamily literals, motion via `src/design/motion.ts`,
  haptics via `src/design/haptics.ts`. See `CLAUDE.md`.
- Verify in the simulator with screenshots/video before claiming anything works. The whole
  reason this document exists is that the previous session could not.
