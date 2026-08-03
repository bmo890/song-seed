# Clip editor — QA checklist

*2026-08-02, for the facelift shipped in `0a423b2 … 6d8dbd2`.*

What I verified and what I couldn't, so this list is honest about where the risk is.

**Verified in the iOS simulator:** every screen state, the keep/remove inks, snapping
(unit-tested + the inspector), the save sheets, a real extract and a real interior cut
end to end, an extracted child drawing its own bar ruler, and the timeline surviving the
new seam fade (39s − 9s → 0:30).

**Not verified at all:** anything audible, anything on Android, anything on a physical
device, haptics, RTL, and every path that deletes the original.

---

## A · Musical correctness — the point of the whole effort

The editor now claims to carry a take's metronome grid through an edit. These check
whether that claim is true *by ear*, which is the only test that counts.

1. **The click stays in time across a cut.** Take a clip with a grid, leave "Keep to
   grid" ON, remove a chunk from the middle, save. Open the child, turn on the playback
   click, and play from the start and again from past the seam. The click must stay
   locked to the audio on both sides. *If it drifts after the seam, the grid remap is
   wrong and matters more than anything else on this page.*
2. **An extract that starts mid-bar.** Extract a part that begins on beat 2 or 3. The
   child should show a bar ruler, and its click should land with the music — the first
   bar line will sit slightly into the clip, which is correct.
3. **The toggle actually changes the outcome.** Turn "Keep to grid" OFF, make a
   deliberately off-grid cut through the middle of a bar, save. The sheet should say
   "No grid" and the child should have no ruler and no click — not a click that dies
   halfway.
4. **Pins land on the right moment.** Pin a specific hit in a clip, extract a span
   containing it, and check the pin still marks that same hit in the child.
5. **Sections survive, clipped.** On a clip with sections, extract a span that overlaps
   one; the section should appear in the child, trimmed to what survived.
6. **A speed change scales everything.** Save a 0.5× copy of a clip with a pin at 0:10;
   the pin should be at 0:20 in the copy, and the copy's grid line should read sensibly.

## B · Destructive paths — never exercised end to end

7. **"Also delete original" on a sketch's primary take that has children.** Primary
   status should hand off to the new clip and the children should re-parent — nothing
   orphaned, nothing left without a primary.
8. **"Also delete original" on a loose clip.** The source idea should disappear and the
   new clips remain in the same collection.
9. **Delete-original while that clip is playing in the dock or sitting in the queue.**
   I flagged this as untested in the flows doc; watch for a stuck dock or a queue entry
   pointing at a clip that no longer exists.
10. **A real multi-part extract.** Mark 4–6 parts, name two and leave the rest blank,
    save. Every clip should land, named ones keeping their name, blank ones taking the
    suggestion.

## C · Audio quality — needs ears, cannot be automated

11. **The seam.** Cut through a loud sustained note mid-waveform and listen at the join.
    It should not click. It also should not sound like a dropout — if you hear a dip,
    4ms is too long (`trimSeamFadeSeconds` in
    `modules/songnook-pitch-shift/ios/SongNookPitchShiftRenderer.swift`).
12. **Clip edges.** Extract a part that starts and ends mid-note; starting and stopping
    playback should not click.

## D · Platform and locale

13. **Android.** Everything above. Note the Android seam **will still click** — the fade
    is iOS-only for now (tracked separately), so judge it on the JS behaviour, not the
    audio joins.
14. **Hebrew / RTL.** Switch language and open the editor. The reel, the part rows and
    the inspector's edge chips should keep their left-to-right time order; labels and
    the surrounding layout should mirror.
15. **A physical device.** Haptics on snap and on selecting a part, plus reel smoothness
    while dragging — the simulator flatters both.

## E · Regressions in shared surfaces

16. **The player's practice drawers.** `MarkInspector` is now one shared component and
    the player's local copy was deleted — check pin editing, section edges and the loop
    still behave in the player.
17. **The reel elsewhere.** Its play button changed shape and is editor-only in theory;
    confirm the recording screen and the player are untouched.

## Known-open, not bugs to find

- Android seam fade is unimplemented (`task_12a48e34`).
- Flattening an overdub clip drops its grid, so a flattened clip edits without one
  (`task_b38f2f52`) — needs a device check that the mix preserves the take's start.
- Drag-on-reel to create a part was declined; "Add part" / "Split here" is the only
  creation route.

---

## Addendum — overdub findings, 2026-08-03

Two layers were recorded onto a gridded take ("Click test") to exercise the overdub
paths, which nothing had touched before.

**Fixed while there.** The Layers sheet printed the raw key `player.layerCount` instead
of "2 layers" — the key lives under `navigation`, not `player`. Same class as the
`player.version` leak the full-player audit found; worth a sweep for others.

**Fixed: flattening no longer discards the take's grid.** `saveCombinedClipAsNewClip`
carried tags, pins, sections and analysis but not `recordingGrid`, so every flattened
clip lost its click and bar ruler — on the exact path the editor forces layered clips
through. Confirmed on screen: the flattened "Click test Mix" opened in the editor with
no ruler and no "Keep to grid" toggle, while its 0:33 length matched the root exactly.
The premise for carrying it is now proven rather than assumed: the native mixer
schedules a positive offset ahead and, for a negative one, *drops* that much of the
layer's head instead of extending the mix (`scheduleSegment` path in
`SongNookPitchShiftRenderer.swift`), so the mix always keeps the root's timeline.
**Still to confirm by eye: flatten a layered gridded take and check the result now
draws a bar ruler.** The change is a one-line carry and typechecks, but I could not
re-run the flatten through the UI after the edit.

**Not fixed — worth your call.**
- Layer colours come from a free hue slider (`computeWorkspaceTheme(color)`), which is
  the same unbounded-hue approach we retired from sections in favour of eight
  harmonised role inks. Layer 2's mint green sits outside the palette entirely.
- The layer lanes under the reel are flat colour slabs with a label — no waveform —
  while everything else in the app draws its audio.
- Layer 2's lane visibly overflows the reel's right edge.
- Layer 2 recorded ~14s from 00:23 but reports 00:10, i.e. it looks clamped to the
  root's end. Intended or not, the number and the recording disagree.
- The player overflow is now 8 rows; the design standard caps action sheets at ~6.
- The save dialog for a layer is titled "Save take as" — a layer is not a take.

---

## Addendum — Hebrew / RTL pass, 2026-08-03

Walked the editor in Hebrew against the house law: **notation stays put, language
mirrors**. Two real bugs found and fixed; one of them was app-wide.

**Fixed: the reel's transport row was mirroring.** Skip-to-start ended up on the right
while the start of the audio sat at the left of the reel directly above it — the one
place mirroring makes the UI wrong rather than native. The row is now pinned LTR, and
`ltrRow` moved from `MarkInspector` to `src/i18n/direction.tsx`, where the other
direction helpers live, since it is a direction rule rather than an inspector detail.

**Fixed: the SegmentedControl thumb sat one segment past the end of its track in RTL** —
clipped by the screen edge, so the active segment had no thumb at all. This is the canon
control, so it affected every segmented control in the app in Hebrew, not just the
editor. The thumb's anchor edge resolves to the physical right under RTL while
`translateX` stays physical, so the offset is now counted from whichever edge segment 0
sits against — the index with a flipped sign — instead of from the physical left.
Verified in both directions: Hebrew thumbs land under the active segment and slide the
right way; English is unchanged.

**Verified correct, no change needed.** Header, meta line, tabs, intent control, outcome
row and its "Keep to grid" ink, PARTS header, part rows (the `00:00.00 – 00:05.17` range
keeps its order — digits are LTR by Unicode bidi), the MarkInspector's start→end chips
and nudge carets (already pinned LTR), the snap hint, and the footer CTA. The reel
itself stays left-to-right with the playhead advancing leftwards-to-rightwards, which is
the whole point of the law. Speed and pitch steppers mirror, which is right — a value
control reads with the language.

**Not a bug, checked and dismissed:** a long pin label on the reel renders anchored with
an ellipsis and looks displaced, but pin badges are Skia geometry and do not mirror.

**Still unverified in RTL:** the save sheet (`EditorSaveSheet`). Its content is all
language rows with no time-axis ordering, so the risk is low, but it has not been seen
in Hebrew.
