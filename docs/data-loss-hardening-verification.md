# Data-Loss Hardening — On-Device Verification Checklist

Automated unit tests cover the pure logic (integrity scanner, managed-path helpers, media
rebasing — run `npm test`). The items below exercise the **native + on-device** behavior that
can only be validated on a real build, because `expo-sqlite`, `expo-crypto`, and the
filesystem are involved.

> **Prerequisite:** build a dev/preview client (`npx expo run:ios` / `run:android` or an EAS
> build). The backup/restore and SQLite features will NOT work in an older installed binary —
> they require the new native modules.

## 1. Exact backup round-trip (the core guarantee)
1. Create a library with variety: a project with several takes, an **overdub** (stems + a
   rendered mix), tags, a practice marker, an edited region, lyrics with history, a playlist,
   and a hidden day.
2. Settings → **Back Up Now** → save to Files/Drive. Expect "Backup ready" (not "incomplete").
3. Delete the app (or use a second device) and reinstall.
4. Settings → **Restore from Backup** → pick the file → confirm → restart when prompted.
5. **Assert:** identical workspace/idea/clip counts; every clip plays; overdub stems + mix,
   tags, markers, lyrics history, playlist, and hidden day all survived.

## 2. Incomplete-backup honesty
1. Remove one clip's audio file from device storage (or use a library with a known missing file).
2. **Back Up Now**. **Assert:** result reports **"incomplete"** and names the missing recording —
   never a silent "success".

## 3. Restore integrity gate
1. Corrupt a backup zip (flip a byte) and attempt **Restore**.
2. **Assert:** restore aborts with an integrity error and the **current library is untouched**.

## 4. Seamless SQLite migration (existing users)
1. Install the previous build (AsyncStorage blob), create data.
2. Upgrade to the new build in place (see §6).
3. **Assert:** all data appears; `songseed.db` now exists under the app's `SQLite/` dir; the old
   AsyncStorage blob is retained (fallback).

## 5. iOS relative-path healing
1. On iOS, back up, delete app, reinstall, restore (or restore from an iCloud device backup).
2. **Assert:** every clip still plays — audio URIs were rebased to the new container on launch
   (no "file not found").

## 6. In-place upgrade (Phase 0 gate — do on BOTH platforms)
1. Build v1 (version N), add real recordings.
2. Build v2 (version N+1, **same** applicationId/bundleId **and signing key**).
3. Android: `adb install -r v2.apk`. iOS: install over via Xcode/TestFlight.
4. **Assert:** library + audio fully survive the update. (This is the literal "updates never
   erase data" promise — it cannot be assumed, only observed.)

## 7. Trash-on-delete
1. Delete a clip/idea. Inspect `…/songseed/trash/` (Settings → Storage → advanced shows paths).
2. **Assert:** the audio file is in `trash/`, not gone. It is purged automatically after 14 days.

## 8. Crash-during-delete (best effort)
1. With a debugger, force-kill the app immediately after confirming a delete.
2. Relaunch. **Assert:** no persisted clip points at a missing file; the deleted audio is in
   `trash/` (recoverable), not lost.

## 9. Recording orphan fix
1. Start recording into a project, then (via a second path/automation) delete that project, then
   stop+save the recording.
2. **Assert:** you see "Recording kept for recovery"; on next launch the take is offered for
   recovery — it is NOT silently discarded.

## 10. Integrity scanner
1. Settings → Storage → **Check integrity** on a healthy library → "passed".
2. Seed a problem (e.g. an orphan file in `songseed/audio/`) → re-run → it is reported, and
   overdub stems/mixes are NOT misreported as orphans.

## 11. Recovery-mode prompt
1. Simulate catastrophic hydration: clear the SQLite `kv` row / AsyncStorage blob while the
   shadow manifest still holds data, then relaunch.
2. **Assert:** a "Restore your library?" prompt appears instead of a silent empty library.

## Corruption guard (optional, destructive)
- A bulk delete of >40% of a large library should persist normally (it is authorized).
- An *unauthorized* large drop (simulated) should be **blocked** and logged by `[PersistGuard]`,
  leaving the prior data intact until restart.
