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
