# Data-safety device pass (audit 2026-11-02 fixes)

One section per fix track. Each check names the build it needs: **OTA** (JS only) or
**store build** (native code or the Android manifest changed). A check passes only when
the take plays back whole, at its full length, in the place it was recorded into.

## Recording

Fixes: 03-1, 03-2, 03-3, 10-H1, 09-H2, 10-M1, 12d D-H2, D-M1, D-M3, decision E.

### Killed take, then an update, then reopen (03-1, critical) — store build or OTA

1. iPhone. Record a take of at least 30 s. While it rolls, force-quit SongNook from the app
   switcher.
2. Install a newer build over it before reopening (TestFlight or a fresh Xcode install,
   which moves the app's container), then open SongNook.
3. Expect: "Clip recovered" and the take in the collection, full length, playable.
4. Repeat on Android with an `adb install -r` of a newer build.

### Two takes waiting at once (03-2) — OTA

1. Record take A, force-quit mid-take. Reopen, and before anything else appears, record
   take B and force-quit mid-take again (or reopen into the "Restore library?" or
   "workspace set aside" prompt, which skips recovery, then record B and force-quit).
2. Reopen. Expect both A and B recovered (A first), each full length.

### Font size, display size, fold or language mid-take (10-H1, 03-3) — store build

1. Android. Start a take, minimise it to the dock.
2. In system Settings, change Font size (then Display size; on a foldable, fold or
   unfold; then change the app language in system per-app languages).
3. Return to SongNook. Expect: no "Clip recovered" message, the dock still shows the
   take with its clock running, and Save lands the whole take (before and after the
   change) in the right place.
4. With Developer options › "Don't keep activities" on: start a take, go Home, come back.
   Expect the same: the take is still shown and saves whole.

### Phone storage fills mid-take (09-H2, 10-M1) — OTA for the free-space check; store build for the native write check

1. Fill the phone to under ~200 MB free (large video files).
2. Record; while it rolls, fill the remaining space (copy a big file, or let a download run).
3. Expect: the take pauses by itself, an error haptic, "Phone storage full / Recording
   stopped. What was captured is kept." once. Save keeps everything up to that moment;
   the saved length matches the clock at the pause.
4. Free space, press resume: recording continues into the same take.
5. Store build only: fill the disk faster than 15 s (a second app writing) to hit the
   native write-failure path; same expectation, no silent short take.

### Record while a take is minimised (12d D-H2, D-M1) — OTA

1. Open sketch A, record with the metronome on and a count-in, drop two pins. Minimise.
2. Go to another collection and press its Record button. Expect: the recorder opens on the
   running sketch-A take (header still names A), no new 0:00 card appears in the collection.
3. Repeat from a clip's "+ Version" and from the player's Layer key on another song: each
   opens the same running take, never a new one.
4. Save. Expect: the take lands in sketch A with both pins and its beat grid (bar lines
   in the player), not in the other collection.
5. Layer variant: start a layer on song C, minimise, press Record elsewhere, reopen, save.
   Expect it saved as a layer on C at its punch point.

### Calibration and Tuner during a minimised take (12d D-M3) — OTA

1. Start a take, minimise. Settings › Bluetooth calibration: expect "Finish the take first"
   and the screen does not open. Tuner: expect the same line instead of a reading.
2. Save the take: expect no gap or silence in it.

### iPhone screen locks mid-take (decision E) — store build

1. iPhone, Auto-Lock 30 s. Start a take, put the phone down untouched for 2 minutes.
2. Expect: the screen dims and locks; the take keeps recording (the orange mic indicator
   stays on). Unlock, Save: full length, no gap at the lock.
3. Android unchanged: the screen behaves as before.

## Recently deleted

Decision A (2026-11-02). Everything here ships OTA (no native change). Do it on a phone
with a fresh install first (for the one-time note), then on the founder's library.

### First delete, then Undo — OTA

1. Fresh install. Record a 10 s clip, then delete it from the collection (long-press, Delete).
   Expect: the confirm says "Moves to Recently deleted for 30 days."; after it, a one-time
   note "Kept for 30 days" names Settings › Data & storage. OK closes it.
2. Delete a second clip. Expect: no note now; the undo bar reads "1 clip in Recently deleted".
   Tap Undo: the clip is back in place, plays, keeps its title, bookmark and hidden state.
3. Settings › Data & storage: a "Recently deleted" row with "1 item" under it.

### The page — OTA

1. Delete one of each: a clip, a sketch with lyrics and a chord chart, a collection with a
   child collection, a setlist ("…" › Delete set now asks), a chart book, a playlist, a
   Lyric Pad page, a spark, a received parcel (Received › Delete).
2. Open Settings › Data & storage › Recently deleted. Expect: a large "Recently deleted"
   title, newest first, each row "kind · 30 days left · size" (size only where there is audio),
   a line "N items · size" with Empty beside it.
3. Tap a row: a menu with Restore and Delete permanently (last). Restore each kind and
   check it is back where it was: same collection, same place in its setlist and chart book,
   the sketch's lyrics versions, chart and notes, its Shelf entry, its activity.
4. Long-press a row: selection with All / Cancel; the dock restores or deletes many.
5. Delete permanently: "Delete permanently?" / "This can't be undone." (warning buzz),
   then "Deleted for good" (success). The row is gone and does not come back on relaunch.
6. Empty: "Empty Recently deleted?" with the count and size. After it, the page shows
   "Nothing deleted"; Settings › Storage shows the space back.

### Where things go back to — OTA

1. Delete a clip, then delete its whole workspace. Restore the clip (not the workspace).
   Expect: toast "Restored to <primary workspace>", the clip in its primary collection.
2. Restore the workspace: it returns in its old place in the list, with its collections.
3. In a sketch, delete one take; then delete the sketch. Restore the take: it comes back as
   its own clip, toast says where. Restore the sketch: its other takes are there.

### Deletes that used to be silent — OTA

1. Player › … › Delete clip on a sketch's only take: the confirm says the whole sketch,
   lyrics included, moves to Recently deleted (04-H5). It is on the page afterwards.
2. Sketch › … › Delete sketch › Keep takes: the takes become clips, and the sketch (lyrics,
   chart, notes) is on the page (04-M1); its setlist row is gone from the set until restored.
3. Collection and workspace deletes show a toast with Undo (04-M3).
4. Sketch takes: filter to one tag, long-press, All. Expect only the shown takes selected;
   folded "N older" and a folded group are not (12b B-M3). The confirm reads "Delete 3 takes?".
5. Spark: reopen a spark saved earlier, change a word, Back. Expect: it just leaves (12f F-H3).
   A spark started now, Back › Discard: it is on the page.
6. Cut-Up: write a draft, Back to Arrange, Draft again, Remix › Mixed. Expect it asks first
   (12f F-H4).
7. Send a Word Ladder to the Pad, write more on that page, send again › Replace page. Expect
   the toast's Undo puts your Pad words back; without Undo, the old page is on the page
   (12f F-M1, 12g G-H1).
8. Recorder: record 10 s, Discard (and separately, Redo). Expect the toast; the take is on the
   page and restores as a clip (03-9). A 2 s false start is not kept.

### The 30 days and the files — OTA

1. Delete a clip with a long take; note Settings › Storage. Its size moves from library to
   the page's total. Empty: the space is freed.
2. Set the phone's date 31 days ahead and relaunch: the record and its file are gone.
   Set it back.
3. Back up, then Replace-restore that backup on the same phone: the Recently deleted list is
   as it was in the backup and Restore finds its audio. On another phone the records come
   back but their audio does not travel (backups carry the records, not the trash).
4. Settings › Erase everything: Recently deleted is empty afterwards.

## Editors

Fixes: 04-H3, 04-H4, 04-M2, 12a A-H2, A-H3, A-L2, A-L5, 12c C-H1, C-H2, 12f F-H4, F-M2,
12g G-H1, and two round-1 leftovers (a parcel's layers, a parcel's take notes). All OTA.

### Type lyrics, then kill the app (04-H3) — OTA

1. A sketch › Lyrics › open the latest version › edit. Type a verse; do not Save.
2. Force-quit SongNook from the app switcher. Reopen, go back to the same version.
3. Expect: the page opens in the editor with the verse, and the toast "Unsaved changes
   restored". Save: it lands. Reopen once more: no toast (the draft is gone).
4. Repeat, but tap Cancel › Discard instead of Save: reopening shows the saved words, no
   toast.
5. Same check for the sketch's Notes tab editor, and for a clip's notes sheet (collection
   list › long-press › Edit, and the player's Notes page).

### Edit lyrics in two places (12a A-H3, 04-H3) — OTA

1. Sketch › Lyrics › write with the tape. Type a line, then collapse the player to the dock.
2. In the sketch's lyric editor, fix a line and add a chorus; Save.
3. Expand the player from the dock. Expect: the writer shows the fixed line and the
   chorus. Type a character: nothing is lost (the latest version holds both).
4. Reverse it: open the lyric editor, start typing, and before saving add a line from
   the player's writer (open it from the dock). Save in the editor. Expect: the toast
   "Saved as a new version"; one version holds the player's line, the newest holds the
   editor's words.

### Type a player note, then let the queue advance (12a A-H2, 04-M2) — OTA

1. Play a playlist of short clips in the full player. Open the Notes page on clip 1 and
   write until the clip ends and clip 2 plays under the sheet.
2. Save (or swipe the sheet down). Expect: the note is on clip 1; clip 2's note is unchanged.
3. Writer variant: in a queue of two sketches, write in the lyric writer and tap Next
   within a second of the last key. Expect: sketch 1 has the words, sketch 2's lyrics are
   untouched.
4. Pin variant: hold a pin on the reel to edit it, let the queue advance, rename, Save.
   Expect: the pin on clip 1 is renamed; clip 2 gains no pins.

### Edit clip after notes changed elsewhere (12c C-H1) — OTA

1. Collection list › long-press a clip › Edit. Type note "A", Save.
2. Open the clip in the full player; on the Notes page add a second line, Save.
3. Back on the list, long-press › Edit. Expect: the sheet shows both lines.
4. Change only the title, Save. Expect: the title changes and both lines stay.
5. In the sheet, type something, then tap Cancel. Expect "Discard changes?" with Keep
   editing / Discard; Keep editing keeps the words.

### Edit collection keeps the description (12c C-H2) — OTA

1. Workspace hub › long-press a collection › Edit. Change the title and type a
   description. Save.
2. Expect: the header shows the new description; Edit again pre-fills it.
3. Clear the description, Save: it is gone. A title-only rename elsewhere keeps it.

### Spark sent to the Lyric Pad again (12g G-H1) — OTA

1. Word Ladder › … › Send to Lyric Pad. Open that Pad page and write a verse on it.
2. Revise the ladder and send again. Expect: "You’ve written on that page since…" with
   New page and a red Replace page. New page keeps the Pad verse.
3. Send a third time without touching the Pad page: the plain "Update page" is offered.

### Cut-Up asks before replacing written words (12f F-H4, F-M2) — OTA

1. Cut-Up: write a draft by hand, tap Back to the table, then Draft again. Remix › Mixed.
   Expect the replace question. A second Remix right after one (no typing) does not ask.
2. New Cut-Up: paste a verse as the source, tap From Lyric Pad. Expect "Replace the
   source?" before the picker opens.

### A received parcel's take reads, never edits (decision B) — OTA

1. Received › a parcel's sketch with layers and take notes › play a take.
2. Expect: the lanes show Solo only (no Mute), a lane tap opens nothing, no Merge/Combine
   foot. Solo still solos.
3. The take's note: on the sketch page tap the note line, and on the player tap the notes
   tile. Expect the whole note in a sheet with Done only (no fields, no Save).
4. Keep the parcel: all layer controls and note editing come back.

## Recording format and media

Fixes: decision F, 03-6 / 05-E12, 11-M2, 05-E11, 05-E13, 06-3 (remainder).

**Format, measured from the code (decision F).** A take is 16-bit PCM WAV, 44.1 kHz mono:
**5.29 MB a minute** (318 MB an hour), before and after this pass. The audit's "32-bit
float, 10.6 MB a minute" read a placeholder analysis object; both recorders already
defaulted to 16-bit, and the config now asks for it by name. Count-in takes and every
edited clip were already AAC (the trim render): Android 256 kbps (1.92 MB a minute), iOS
Apple's M4A preset. AAC for every take is **not** turned on: its timing is unproven on
Android (see the AAC follow-up below).

### Layer and grid timing after the format change — OTA

The format did not change, so this is a regression check that naming it changed nothing.

1. Each phone. Metronome 91 bpm 4/4, one bar count-in, speaker on; record 30 s of clicks
   with the click bleeding in. Save. Then record a layer over it, also with bleed.
2. Export both (Share › file) and run `python3 scripts/grid-truth.py --audio take.m4a
   --bpm 91 --downbeat <stored>` and `python3 scripts/layer-truth.py --base take.m4a
   --layer layer.m4a --offset <stored>`.
3. Pass: first click within ±3 ms of the stored downbeat, both decoders within 2 ms;
   layer `residual` ≤ 3 ms with both halves agreeing.
4. A take recorded with no count-in: exported it is a `.wav`; `afinfo` (Mac) reads
   16-bit, 44100 Hz, 1 channel, and its size is ~5.3 MB per minute.

### A long take on a nearly full phone (03-6) — OTA

1. Fill the phone until free space is about 1.2x what a 20-minute take needs
   (20 min ≈ 106 MB; leave ~130 MB free).
2. Record 20 minutes with no count-in (no head trim). Save.
3. Expect: it saves (it used to need the size free twice), plays whole, 20:00 long. In
   Settings › Storage the library grew by ~106 MB, not 212.
4. Kill test: start Save on a long take and force-quit the instant the sheet closes.
   Reopen: "Clip recovered" or the clip already in place, never both, never missing.
5. With a count-in: same, expect the clip saved as `.m4a` and the recorder's WAV gone
   afterwards (Files › On My iPhone is not reachable for this; check Storage only grows
   by the m4a's size).

### A .caf on Android, an Opus voice note on iPhone (11-M2) — OTA

1. iPhone: share a Voice Memos `.m4a` and a `.caf` (AirDrop one from a Mac) into SongNook.
   Expect: both import; the `.caf` lands as an `.m4a` clip (Share › file shows `.m4a`), plays,
   same length as the original.
2. iPhone: share a WhatsApp voice note (`.opus`) into SongNook. Expect one of two honest
   outcomes: it imports as an `.m4a` that plays (iOS could decode it), or the dialog
   "OPUS won't play on this phone / Save it as M4A or WAV, then import again." Never a
   clip that imports and won't play.
3. Android: share the same WhatsApp `.opus` and an `.ogg`. Expect `.m4a` clips that play,
   full length. Back up, restore on the iPhone: they play there.
4. Android: import the `.caf`. Expect it converted, or the dialog "CAF won't play on this
   phone …"; never a silent unplayable clip.

### Shared-in copies are cleaned (06-3) — OTA

1. iPhone: share three audio files into SongNook, import them. Then share one more and
   tap Not now.
2. Settings › Storage (or iPhone Settings › General › iPhone Storage › SongNook): the
   space used grows by the three clips once, not twice; the cancelled file is gone.
3. Next day (or set the clock forward a day and relaunch): a share abandoned by
   force-quitting mid-import is gone too.
4. Erase everything: iPhone Storage › SongNook shows only the app itself afterwards.

### Memory while sealing and backing up on iPhone (05-E11) — store build

1. iPhone, a clip of 60+ minutes. Send it (sealed link). Xcode › Debug Navigator ›
   Memory, or watch for a kill: memory stays flat (tens of MB), the Send finishes.
2. Back up the library to Files with that clip in it, then restore. Same: no kill, the
   restore completes and the clip plays.

### Lock-screen buttons after many player opens (05-E13) — store build

1. iPhone. Open and close the full player five times (and record a short take between two
   of them). Play a clip, lock the phone.
2. Lock screen play/pause: one press pauses, the next plays (it used to toggle N times).
   AirPods double-tap or squeeze: same. Next on the lock screen moves one clip, not N.

### AAC for every take: follow-up, not built

Would cut a take from 5.29 to ~0.96 MB a minute (128 kbps mono) and needs one device pass
before it may ship. The plan: after a durable save, re-encode a take through the trim
render (the path count-in takes already take), keep the WAV until the AAC is verified,
then move the AAC in and trash the WAV. Measure first, on both phones:
- Android store build (has `Mp4PrimingEditList`): a count-in take exported; `grid-truth.py`
  with both decoders reads the first click within ±3 ms of 0 and the decoders agree
  within 2 ms (RUN-LOG 2026-10-30 pass bar, not yet run on Android).
- ExoPlayer (in app) vs the WAV of the same take: a layer recorded over each sits at the
  same `residual` (`layer-truth.py`) to within 1 ms.
- `onsetEnvelope`, marks, sections and the beat grid are stored in file ms from the WAV:
  re-measure `firstDownbeatMs` on the AAC (`gridSelfAlignment`) and expect ≤ 1 ms change.
- Waveform sidecar, solo mix (`soloMix.ts`), DAW export (`decodeToWav`, priming skipped)
  and Send all read the AAC; DAW export's WAV starts at the same sample as the WAV take.
If any of these misses, the take stays WAV.

## Long operations and the safety copy

Fixes: 12e E-H1, E-M1, E-M2, 12f F-H2, 10-H2, 10-M2, 04-M6, 12b B-M2, 12g G-M1, G-M3,
G-L3, 03-5, 03-7, 03-8, 02-G3, 02-G4, 01-H1, 01-H2, 01-H3, 01-M1, 01-M2. All OTA (JS only).
"The safety copy" is the on-phone copy of the library (`songnook/manifest.json`, plus
`manifest.previous.json` and, while a question is open, `manifest.held.json`).

### Record during an archive import (E-H1, F-H2, the operation gate) — OTA

1. Make a `.songnook` archive with a few hundred MB of audio (Settings › Export).
2. Settings › Import it. While "Importing…" shows, open the drawer and try to record.
   Expect: the take does not start, an error haptic, toast "Record after the import".
3. Start a take first, minimise it, then try the import. Expect the toast "Finish the take
   first"; nothing imports. Save the take.
4. Start the import again; while it runs, write a line on a Lyric Pad page and rename an
   idea. When it finishes: the imported workspace is there, and the line and the rename
   are too.
5. While the import runs, try Archive on a workspace and Settings › Back up now. Expect
   "Wait for the import" for each; nothing starts.
6. Automatic backup on: start a take while it runs (Settings shows "Backing up"). Expect
   the take starts at once and the backup stops quietly (it resumes next time).

### Restore while working (02-G3, 10-H2) — OTA

1. Settings › Restore › a backup file › Replace everything. Expect, before any progress:
   "Replace with this backup?" naming the backup's date, its idea count and yours.
   Cancel: nothing changed.
2. Go again and confirm. The takeover reads "Changes made now are replaced when it
   lands." (not "Minimize to keep working"). Try to record: "Record after the restore".
3. Merge ("Keep newer"): the takeover still invites minimising; edits made meanwhile
   survive the merge.

### Dismiss the restore prompt, then relaunch (01-H2) — OTA

1. On a test phone with a library, simulate an empty boot (Xcode: delete the app's
   `SQLite/` folder from the container but keep `Documents/songnook/`; Android: `adb shell
   run-as … rm databases/*`), then open SongNook.
2. Expect "Restore your library?" with "A copy from {date} holds N ideas…" and three
   choices: Not now, Restore, Start fresh. Tap outside the dialog (Android: back).
3. Make one new idea. Force-quit. Reopen. Expect the same question again, same date and
   count. `manifest.held.json` exists in the container.
4. Restore. Expect toast "Library restored": every idea is back AND the new idea from
   step 3 is still there. Relaunch: no question.
5. Repeat 1–2, choose Start fresh: expect a red confirm "Start fresh? The copy from
   {date} is deleted." Cancel leaves it held (asked next launch); confirm removes it.

### Damaged or partial boot offers the copy (01-H1, 01-H3, 03-8) — OTA

1. Damaged meta row: with SQLite, overwrite the `songnook-store` row's value with `{`.
   Launch. Expect no welcome intro, the "Restore your library?" question, and Restore
   bringing the library back; saving works afterwards (no "Saving is paused" bar after
   restoring). Not now leaves the bar showing "Saving is paused", and the question
   returns next launch.
2. Missing workspace row: delete one `songnook-store::ws::<id>` row. Launch. Expect "Part
   of your library didn't load" with the copy's date and Restore; Restore brings that
   workspace back without touching the others.
3. After a Replace restore, damage one workspace row before the first relaunch. Expect
   the restored audio under `songnook/audio/restored-*` is still on disk after that launch.

### Kill during a restore (02-G4, 01-M1) — OTA

1. Start a Replace restore of a large backup; force-quit during "Restoring clips".
   Reopen: the library is the one from before, unchanged; no restored items appear.
2. Start again; force-quit during "Finishing" (committing). Reopen: either the backup's
   library (restore landed) or the old one (it didn't), never a mix, and never the
   backup's titles with missing audio.
3. Record a take, and within a second tap Save then background the app and force-quit.
   Reopen: the take is there (writes land in order).

### Archive and unarchive (03-5, 03-7, 10-M2) — OTA

1. Copy an idea from workspace A to B. Archive A. Unarchive A with the phone nearly full
   (or after corrupting the package: rename a byte in `workspace-archives/…zip`).
   Expect the unarchive fails with its error, and B's copied idea still plays.
2. Archive a workspace: expect it takes a little longer than before (the package is read
   back). Unarchive: everything plays.

### Undo and text drafts (04-M6, B-M2, G-M1, G-L3) — OTA

1. Select two clips › Make sketch; on the sketch page record a take; go back and tap Undo
   on the toast within 5 s. Expect the two clips back as clips, and the sketch still there
   holding only the new take.
2. Chord chart, edit mode: type a section note and within half a second tap the ghost
   "+" bar. Expect both the note and the new bar after a pause.
3. Lyric Pad page: type a word and tap Undo within half a second. Expect the word goes
   and the page is otherwise as it was; tap Undo again for the step before.
4. Borrowed Words: remove a word, collect another, then tap Undo on the toast. Expect the
   removed word back in place and the newly collected one kept.
