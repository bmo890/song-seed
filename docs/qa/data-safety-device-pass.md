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
