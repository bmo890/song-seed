# The full player — audit before the facelift

Walked in the iOS simulator on 2026-07-31, every state I could reach: player mode,
practice mode, play-along, each tool popover, both edit dialogs, the section picker,
the overflow sheet, the queue sheet, the help sheet, and the reel in collapsed,
expanded, markers-on and markers-off. Screenshots in `audit-full-player/`.

Not audited, because no clip in the sample library has the data: overdub layers
(`OverdubLayerCard`, 652 lines) and the stem alignment overlay (`StemAlignmentOverlay`,
380 lines). Those need a recorded layer before they can be judged.

---

## The one-sentence verdict

The full player is the only screen in SongNook that still reads like a **settings
form bolted under a waveform**. Every other surface we've redone — collection, sketch,
recording — says one thing at a time. This one presents four card idioms, five button
shapes, eight non-token colors and eleven controls at once, and then ships a help sheet
to explain itself. A screen that needs a manual has an IA problem, not a copy problem.

---

## A. Defects — things that are broken, not just ugly

These are ranked. The first three cost the user function.

### A1. The speed slider is unreachable

`settingPopover` is `position: absolute` (`PlayerScreen/styles.ts:677`), so it
contributes nothing to the ScrollView's content height. The panel scrolls; the popover
does not scroll with it. Measured:

- reel collapsed, loop off → slider's bottom half sits under the transport hairline
- reel collapsed, loop **on** → slider entirely off-screen
- reel **expanded** → the pill row is cut mid-`1.5×`; slider gone

I tried to scroll to it four ways (fast swipe, slow eased drag, from three different
start points). It cannot be reached. The same mechanism clips the pitch popover's
"Original" chip. Fine speed control between the presets is effectively dead.

### A2. `player.version` is printed to the screen

`PlayerSupportSections.tsx:453` calls `t("player.version", { count })`. There is no
`player.version` key — the real one is `lyrics.version` with a `{{number}}` param
(`translations.ts:707`). So the lyrics block renders the literal string
`player.version · 25/07/2026, 20:52:55`. Visible in `02-player-mode.png`. Same bug class
I fixed in the recording screen last week; the player copy was missed.

### A3. The main reel draws no waveform while the minimap does

On the "Native" clip the reel is an empty ruled grid — bar lines, section bands, pins,
no audio (`01-practice-panel-populated.png`). The minimap directly below it draws the
peaks fine (`02-player-mode.png`). So coarse peaks exist and the detailed canvas has
nothing, and the screen says nothing about it: no skeleton, no "still preparing", no
retry. The user reads it as "my recording is gone."

### A4. Adding a marker at the playhead when the playhead is at the end

Playhead at `00:38 / 00:38` → "+" on Sections created a section spanning `00:38–00:38`.
Zero width, invisible on the reel, silently counted as "1 part". Pins do the same, and
the pin's badge lands under the expand button in the reel's top-right corner where it's
half-hidden. Either snap to a sensible default span or refuse with a reason.

### A5. Destructive actions have no confirm and no undo

The trash in "Edit section" / "Edit pin" deletes immediately. No dialog, no undo toast.
Everywhere else in the app destruction is confirmed.

### A6. The popover eats the first tap

With Speed open, tapping Pitch dismisses the popover instead of switching to Pitch —
the full-screen backdrop swallows it. Every tool switch costs two taps. Same for the
"+" buttons.

### A7. Mode swaps a control out from under the user

`PlayerFooterSection.tsx:62` — the leading transport slot is the **queue** in player
mode and **repeat** in practice mode. So: no repeat in player mode, no queue in practice
mode, and the icon under the user's thumb changes meaning when they open Tools. This is
exactly the silent-capability-loss the redesign guardrail names.

### A8. Scrolled content passes behind the toolbar unmasked

The "Hide markers / Tools" row is fixed; panel content slides under it with a hard edge,
slicing "Sections" in half mid-word. Reads as a rendering bug.

### A9. The zoom control hides itself after 2.8 s

`AudioReel.tsx:598`. The zoom pill collapses back to a puck on a timer, so it can vanish
between deciding to zoom and reaching for it. Zoom is a deliberate action; it shouldn't
be on a countdown.

---

## B. Where the design has drifted from the standard

Cited against `CLAUDE.md` / `docs/design-system.md`.

### B1. Stadium pills, everywhere, on text buttons

The button language locked 2026-07-24: stadium `round`(999) is **retired** on text
buttons; round survives only for circular icon buttons. The full player never got the
memo. `toolsPill` is `borderRadius: radii.round` (`PlayerScreen/styles.ts:36`), and so
are: Hide markers · Play along · Tools · Notes · Done · every speed chip · every
count-in and click chip · Original · Save · all seven section presets. That's the single
biggest reason the screen looks like a different app.

### B2. Eight saturated hues that aren't in the token file

`domain/playerSections.ts:29-38` — teal `#3F9C82`, amber `#C98A3C`, orange `#D6743F`,
red `#C8463A`, blue `#5775A6`, purple `#9B6FB2`, slate `#6F7E8C`, magenta `#B0568A`.
The comment above them argues for "bolder, multi-hue … so sections read clearly." That
argument lost when we wrote "color is scarce" and shipped `STAGE_INK`. Consequences
visible in the screenshots:

- the section picker is a **rainbow of eight swatches** (`03-add-section-sheet.png`)
- "Edit section" offers a **full-spectrum hue slider** — the loudest possible control
  in an app whose north star is a quiet place to work
- on the reel, the Chorus band is a red wash that reads as an error state, and both
  bands are opaque enough to compete with the audio underneath

Sections need to be *distinguishable*, which is not the same as *multi-hue*. Tint
strength, label, and one accent will do it.

### B3. Solid `colors.primary` is spent four times on one screen

Reserved for "the single highest-stakes commit". Present simultaneously: the two "+"
circles, the Tools pill, the active speed chip, "Save", "Original", "Done" — plus the
transport's play button, which is the one element that has actually earned it.

### B4. Circles that aren't the record FAB or a close ✕

The two terracotta "+" circles in Sections and Pins are FAB-shaped and FAB-colored,
sitting in a list row. They read as the primary action of the screen; they are two of
eleven controls.

### B5. Copy budgets

- `Record a layer from 00:25` — 6 words on a button; budget is 2
- `No sections yet — tap the + to map the song.` — narrates the UI, and calls a clip
  "the song"
- `No pins yet — tap the + to drop one at the playhead.` — same
- `Turn Loop on to set a practice region.` — an entire expanded card whose only content
  is "flip the switch above"
- the "Practice tools" help sheet is seven paragraphs of manual inside the product

### B6. Vocabulary

- **Sections** header, **"2 parts"** value, **"No sections to loop"**, help sheet says
  "by part" — pick one
- **"Add overdub"** in the overflow vs **"Record a layer"** in the panel — same action,
  two names, one of them jargon
- header subtitle is a machine timestamp (`29/07/2026, 7:39:41`) where the rest of the
  app says "Jul 23"
- times render `00:38`; every card in the app renders `0:38`

### B7. Four different input idioms for four adjacent tiles

Speed = chips + slider. Pitch = −/+ steppers + a chip. Count-in = chips. Click = chips.
And speed has a *fifth* form in play-along mode: a −/+ stepper reading `0.50×`. Two
different controls for one setting, in one screen, with different granularity.

---

## C. Where the flow itself is wrong

### C1. Tools is a mode, but it behaves like a panel

Opening Tools silently: collapses the header (title shrinks, subtitle disappears),
removes the minimap, removes "Play along", and re-purposes the transport's queue button.
Four unannounced changes from one tap. Either it's a mode — and it should announce
itself and keep the transport stable — or it's a panel, and it should stop rewriting
the rest of the screen.

### C2. The panel is a flat list of eleven equals

Detect tempo · Sections · Pins · Loop · Speed · Pitch · Count-in · Click · Record a
layer — presented as one column of same-weight rows and tiles, with no grouping and no
sense of what a musician reaches for first. In practice there are three distinct jobs:

1. **shape the clip** (sections, pins) — authoring, done once
2. **drill it** (loop, speed, pitch) — the actual practice loop, used constantly
3. **play to it** (count-in, click, record a layer) — needs the beat grid

They should not look like one list. Right now the two you touch every session (loop,
speed) are the ones buried between the two you touch once (sections, pins) and the
ones that are often unavailable (click, count-in show `—` on any clip without a grid).

### C3. Every state says nothing

First open on a fresh clip: `None`, `None`, `Off`, `1×`, `0`, `Off`, `—`. Seven fields
of nothing, and the one thing a player wants to know — *what is on right now* — takes
reading all seven. Nothing is ever summarized.

### C4. The screen doesn't earn its height

In player mode the reel occupies ~22% and roughly a third of the screen below the Notes
pill is empty (`02-player-mode.png`). Meanwhile in practice mode the same screen
overflows and clips its own controls. The reel should take the space that's going
unused, and the tools should live somewhere that isn't fighting the transport.

### C5. Zoom and mode interact badly

Player mode runs uncontrolled zoom, practice mode is parent-controlled at a different
multiple. Switching modes changes the zoom under you: `02-player-mode.png` opens at bars
5–7 while practice mode showed bars 1–21. And the tempo-change label `4/4 · 102` is
overlapped by the expand button in the top-right.

### C6. The panel tells you one tempo for a two-tempo clip

The "Native" clip is 92 in 3/4 until bar 9, then 102 in 4/4. The reel draws this
correctly. The panel says `92 BPM · recording grid`, flat, no hint that it changes —
while the reel two inches above says `4/4 · 102`. Not a contradiction in the data, but
the panel is summarizing a tempo *map* as a single number and the user sees two numbers
disagreeing.

---

## D. What I'd do

Roughly in order of payoff.

1. **Retire the stadium pills** across the player and rebuild the toolbar as one row of
   soft keys, with `Tools` as a single selected-state control. Cheapest change with the
   largest visual return.
2. **Re-tint sections from the token palette.** One family, varying weight, plus the
   label doing the identifying work. Delete the hue slider; the picker becomes a plain
   list of names. This alone fixes the picker, the edit dialog and the reel.
3. **Restructure the practice panel into three named groups** (shape / drill / play to
   it), with the drill group open by default and the play-to-it group only present when
   the clip has a grid. Kill the four-tile row: speed and pitch belong in the drill
   group as inline controls, not as popovers.
4. **Kill the absolute popover.** Whatever a tool needs, it discloses inline inside its
   own group and pushes the content below it. That removes A1 and A6 at the root rather
   than patching the overflow.
5. **Give the panel one summary line** when collapsed — "0.75× · loop 0:12–0:24 · click
   on" — so the state is legible without opening anything, and so the help sheet has
   less to explain.
6. **Stabilize the transport.** Same five controls in every mode; repeat and queue both
   present, or repeat moves into the panel where it belongs with loop.
7. Fix A2 (`player.version`), A4 (zero-length markers), A5 (confirm destruction),
   A3 (say something when the waveform isn't there yet), A8 (mask the scroll edge),
   A9 (stop auto-hiding zoom).
8. Copy pass against the budgets, and settle **section** vs **part**, **layer** vs
   **overdub**, once, in `docs/design-system.md`.

Open question worth deciding before any of this is built: **should practice tools live
on this screen at all**, or become a sheet the player presents? Point 3 assumes they
stay. A sheet would solve C1 and C4 outright but costs the at-a-glance relationship
between the reel and the loop region, which is the one thing the current layout gets
right.
