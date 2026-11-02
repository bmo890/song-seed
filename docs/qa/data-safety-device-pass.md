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
