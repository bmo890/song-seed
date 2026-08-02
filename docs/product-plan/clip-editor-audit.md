# Clip editor ("Audio Editor") — design audit & facelift proposal

*2026-08-01 · audited on-device (iPhone 17 sim, screenshots in `audit-clip-editor/`) +
full code read of `src/components/EditorScreen/`. Companion to `full-player-audit.md`.*

The editor is the last major screen still wearing the pre-facelift skin. It is reached
from the player's overflow ("Edit clip") and does three jobs: extract parts as new
clips, cut parts out of a clip, and bake a speed/pitch change into a new clip.
The bones are decent — global keep/cut intent, non-destructive saves — but the surface
is off-standard everywhere, three color systems fight on one screen, and the save flow
re-asks everything in a centered modal.

Screens captured:

| # | file | state |
|---|------|-------|
| 01 | `01-trim-empty.png` | Trim tab, no regions |
| 02 | `02-trim-one-region.png` | one region (blue!) |
| 03 | `03-trim-two-regions.png` | two regions, Extract intent |
| 04 | `04-cut-intent.png` | same regions, Cut intent (red) |
| 05 | `05-export-modal-splice.png` | "Export Clips" modal, cut variant ("Save Splice") |
| 06 | `06-export-modal-extract.png` | extract variant, per-clip cards w/ mini players |
| 07 | `07-transform-tab.png` | Speed & pitch tab |
| 08 | `08-transform-export-modal.png` | "Save Transform" modal |
| 09 | `09-help-sheet.png` | help sheet |
| 10 | `10-tall-reel.png` | expanded reel — regions list crushed off-screen |

Not captured: overdub flatten gate (no clip with layers in the library; audited from
code, `index.tsx:422`), loading state, "No file available" fallback.

---

## A. Defects

**A1 — Three color systems for one concept.** On the reel, keep-regions are Tailwind
blue (`rgba(59,130,246)`) and cut-regions Tailwind red (`rgba(239,68,68)`) —
`TimeRangeSelector.tsx:326-380`. In the intent segment and region list, keep is green
`#3E8E6B` and cut is brick `#B5564A` (`helpers.ts:10-11`). So "keep" is
simultaneously blue and green, "cut" two different reds, and none of the five colors
exists in `tokens.ts`. The blue especially is the coldest pixel in the entire app
(shots 02/03 vs 04).

**A2 — Region placement is opaque.** "+ Add at playhead" is the only creation
gesture. If the playhead sits inside an existing region the tap silently *splits* it
(observed: region 1 became 0:00–4.64 + 4.64–9.29); if it sits at a region edge the
new region is appended after it. Nothing on screen explains either outcome. Tapping
the reel to move the playhead first did not visibly seek.

**A3 — Ambiguous timecode pills.** Two identical pills, `00:00.00` and `00:37.18`,
sit above the reel. Left is the playhead, right is the duration — but side by side
they read as an editable start/end range (exactly what a trim screen would have).
Centisecond format appears nowhere else in the app.

**A4 — Expanded reel breaks the layout.** The ⤢ toggle grows the reel but the page
doesn't reflow: the REGIONS header ends up as a sliver crushed against the footer and
the list itself is unreachable (shot 10).

**A5 — Destructive option is a casual checkbox.** "Delete the original full recording
after export" sits in both save modals as a plain checkbox with a 20-word explainer
that changes as you toggle it. No confirm, no danger styling on the consequence.

**A6 — Mini transports inside a modal.** The extract modal nests a play button +
scrubber *per region card*, playing audio over a dimmed editor that has its own
transport (shot 06). Duration disagrees with itself on one card: "5 sec" in the
header, 00:04 in the scrubber (4.64s rounded two ways).

**A7 — The save flow lies about its name.** Footer says "Save trimmed clip" → modal
titled "Export Clips" → CTA "Save Splice." Three names, one action, and "splice" is
jargon that appears nowhere else in the product.

**A8 — Vocabulary soup.** "1 new clip — one per **highlight**" / "**REGIONS**" /
help sheet "**Keep or remove**" / segments "**Extract / Cut**". Four name-pairs for
the same two concepts on one screen.

**A9 — Dead UI in the export modal.** The extract-vs-splice segmented row renders
only when keep *and* cut regions both exist (`EditorExportModal.tsx:77`) — but
`setIntent` recolors every region to one type (`useEditorSelectionState.ts:100`), so
that state is unreachable. The row, `exportOperation` switching, and its strings are
dead weight.

**A10 — Narrating copy over budget.** "No regions yet — tap 'Add at playhead', then
drag the handles to fit." · "Mark a part of the waveform to begin." · "Leave empty to
use the next auto-generated version name." The voice is a tutorial, not a label.

## B. Standard drift

**B1 — The retired button language, wall to wall.** Stadium footer CTA (solid
`colors.primary`, `radii.round`), stadium Extract/Cut control, stadium zoom pill,
stadium Reset, `borderRadius: 999` steppers, stadium play button. The locked 2026-07-24
language (soft keys `radii.lg`, color-not-heft, round only for circular icon buttons)
never reached this screen.

**B2 — Hex literals off-token.** `KEEP_COLOR`/`CUT_COLOR` (`helpers.ts`), the
Tailwind rgba family (`TimeRangeSelector.tsx`), `#FDF5F2` (overdub gate ring),
`shadowColor: "#000"`. All CLAUDE.md violations.

**B3 — Hand-rolled segmented controls.** `EditorTrimIntent` builds its own
icon-segment control three finger-widths below a canon `SegmentedControl` (the
Trim/Speed & pitch tabs). Two segment styles on one screen.

**B4 — Centered `Modal` cards instead of canon sheets.** Export, transform-export,
and progress all use `styles.modalCard` center cards (one with a nested ScrollView at
`maxHeight: 360`). The app's canon for flows this size is `BottomSheet`.

**B5 — A second reel dialect.** The player's reel just got bar/beat ruler, pinch
zoom with transient overlay, section bands, pins, Skia labels. The editor's reel is
`chrome="light"` with a `1x` pill + two magnifier buttons and none of that context —
you cut *blind* relative to the sections and pins you marked in the player.

**B6 — Naming.** Header says "Audio Editor" (generic tool-speak, serif on a
utility screen); the menu that opened it said "Edit clip".

## C. Flow problems

**C1 — The commit happens twice.** The page CTA doesn't commit — it opens a modal
that re-asks everything (names, delete-original, operation). The editor's single
primary action is actually inside a modal the page CTA merely summons.

**C2 — No direct selection gesture.** You cannot drag on the waveform to select a
part — the one gesture every audio tool teaches. Creation is a text link that drops a
duration/8-length region wherever the logic decides (A2).

**C3 — Region editing is drag-handles-only.** No edge selection, no nudge, no
zoom-tied micro-adjust, no "set edge to playhead" — every piece of machinery we just
built for the player's MarkInspector is missing here, where edits are *destructive*.
The row's skip-back/skip-forward icons audition edges but read as transport buttons.

**C4 — Naming is deferred to the wall-of-inputs modal.** Extracting 4 regions means
4 title inputs + 4 mini players in one scrolling modal card.

**C5 — Mode switch feels lossy.** Switching to Speed & pitch hides the region
washes (they're intact, but the reel shows no trace), and the footer swaps to a
different save. Trim and transform cannot combine in one save — two exclusive
sub-tools sharing a screen.

**C6 — Overdub gate is a full-screen takeover.** Legitimate rule (flatten before
editing), presented as a serif explainer replacing the whole screen, with a stadium
CTA that mints a new clip before you've seen the editor at all.

## D. Proposal — "the player's room, with a knife"

North star: the editor should feel like the full player with a selection on it, not a
separate app. One reel language, one color per meaning, one commit.

### D1. One selection ink (kills A1/B2)
Keep = the house language for "kept": `primarySurface` wash, `primaryDeep`
rails/handles. Cut = `dangerSurface` wash, `danger` rails/handles. Same pair on the
reel, the intent control, and the list. Tokens only; delete `KEEP_COLOR`/`CUT_COLOR`
and the Tailwind rgba block.

### D2. Canon controls (kills B1/B3)
- Intent → canon `SegmentedControl` ("Keep parts / Remove parts" or "Extract / Cut" —
  final naming below), no third segmented dialect.
- All text buttons → soft keys (`radii.lg`, ~38px). Footer CTA = tonal terracotta
  wash; solid `colors.primary` moves to the *actual* commit (the save sheet's
  confirm) since that is the highest-stakes press.
- Transport = circular icon buttons (round is correct there); zoom joins the reel
  the way the player does it, retiring the `1x` pill row.

### D3. Region editing = the player's MarkInspector (kills C3)
Extract `MarkInspector` (edge chips that cue the playhead, live drag slider, ‹ ›
nudges tied to reel zoom, "Use playhead") from `PlayerPracticeDrawers` into a shared
component and mount it under the reel when a region is selected. Region rows become
selectable (tap = select + cue), replacing the cryptic skip icons. Same muscle
memory in both rooms; the editor gets precision where it's destructive.

### D4. One commit, in a sheet (kills C1/C4/A5/A6/A7/A9)
- Name(s) move inline: each region row gets its quiet title field (auto-name shown
  as placeholder), so the save step stops being a form.
- Footer CTA commits via one canon `BottomSheet`: outcome summary line, optional
  "Also delete original" row styled as the danger tier it is (confirm on save, not a
  checkbox aside), single confirm button whose label matches the footer's.
- Delete the dead extract/splice branch and the word "splice" everywhere.
- Region preview = play-from-region on the main transport (auto-stop at region end),
  not nested mini players.

### D5. Reel parity (kills B5/A3/A4)
Same reel as the player: bar/beat ruler when a grid exists, section bands and pins
drawn *ghosted* (identity, not editable here) so you cut with context. Timecode
pills → one playhead readout in the standard format. Expanded-reel mode reflows or
goes away (with MarkInspector precision it earns little).

### D6. Copy pass (kills A8/A10/B6)
Title "Edit clip". One term for a marked span — **part** ("Keep parts / Remove
parts", "PARTS", "Add part"), retiring region/highlight/splice/export. Outcome line
within budget: "2 new clips" / "9s removed". Empty state: title ≤6 / body ≤14, no
quoted UI.

### D7. Overdub gate restyle (kills C6)
Same rule, calmer surface: `SurfaceCard` with the standard empty-state recipe, soft
key "Save combined copy", quiet ink link back.

### Capability guardrail (per CLAUDE.md)
Nothing is removed: splitting a region stays (as an explicit action on a selected
part), edge audition stays (edge chips cue the playhead), per-region preview stays
(play-from-part), delete-original stays (demoted to the sheet with a confirm),
extract-many stays. **New** capability to flag: drag-on-reel to create a part
(long-press-drag so it can't collide with scrub) — additive, needs founder yes.

### Open questions for the founder
1. Naming: "Keep / Remove" (outcome words) vs today's "Extract / Cut" (verb words)?
2. Should a trim and a speed/pitch change be combinable into one save, or stay
   exclusive tabs? (Today: exclusive; combining changes the export pipeline.)
3. Long-press-drag to paint a part on the reel — approve as new gesture?
4. Expanded-reel toggle: reflow it properly, or retire it once nudge-precision lands?

### Build order
1. **Phase 1 — skin** (no behavior change): selection ink from tokens, soft keys,
   canon SegmentedControl, copy pass, "Edit clip" title, timecode cleanup, overdub
   gate restyle. Delete dead splice branch.
2. **Phase 2 — precision**: shared MarkInspector extraction, selectable region rows,
   zoom-tied nudge, use-playhead, region play-from.
3. **Phase 3 — commit**: inline naming, BottomSheet save, danger-tier
   delete-original, one label end-to-end.
4. **Phase 4 — reel parity**: ghosted sections/pins, ruler, zoom unification,
   drag-to-create (pending #3).

Each phase: `npx tsc --noEmit`, sim screenshots, §6 gate walk before "done".
