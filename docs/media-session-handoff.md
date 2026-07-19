# Background Playback + Media Session — Handoff

> **START HERE**: This is a NATIVE feature — it needs config changes, possibly a
> patch to `expo-audio`, a full native rebuild (`npx patch-package` FIRST if any
> patches are added, then rebuild), and real-device verification with Bluetooth
> hardware. Nothing here can be verified in JS-only sessions.

## Goal

Make playlist/queue playback behave like a real media player app:

1. **Audio survives backgrounding** — screen lock, app switch, and Android back
   at a browse root (which calls `BackHandler.exitApp()`) must NOT stop playback.
2. **Lock screen / notification controls** — play/pause/next/prev with track
   title, on both platforms.
3. **Bluetooth (AVRCP) transport** — car/headphone next/prev/play/pause drive the
   queue exactly like the dock buttons.

## Current state (July 2026)

- Playback engine: **expo-audio** (`useAudioPlayer` in `src/hooks/useFullPlayer.ts`;
  activation via `src/services/transportPlayback.ts`).
- Queue: `playerSlice` (`playerQueue`, `advancePlayerQueue`, auto-advance driven by
  `FullPlayerProvider` when the Player screen is NOT mounted — i.e. dock mode).
- **No background audio configured**: `app.json` `ios.infoPlist` has NO
  `UIBackgroundModes`; Android has no foreground service. Locking the screen or
  exiting kills audio.
- The mini dock (`GlobalMediaDock`) + `QueueSheet` are the in-app transport UI.

## Work plan

### 1. iOS background audio (smallest step, big win)
- `app.json` → `ios.infoPlist.UIBackgroundModes: ["audio"]`.
- Ensure the audio session category is `playback` while the queue is active
  (expo-audio `setAudioModeAsync({ playsInSilentMode: true, interruptionMode: ... })`
  — verify what transportPlayback already sets; recording paths use different modes,
  so switching between record and playback modes must stay correct).

### 2. Remote commands / media session
Options, in preference order:
- **(a) expo-audio remote-control support** — check the SDK version's docs first;
  if it has lock-screen/now-playing APIs by the time this is built, use them.
- **(b) Patch layer**: small native module exposing
  `MPRemoteCommandCenter`/`MPNowPlayingInfoCenter` (iOS) and
  `MediaSessionCompat` + `MediaStyle` notification via a foreground service
  (Android). The app already patches native deps (see `patches/`), and already
  ships custom Kotlin (`SongNookPitchShiftRenderer.kt` uses media3) — media3's
  `MediaSessionService` is the natural Android fit.
- JS bridge surface needed (either way):
  - `updateNowPlaying({ title, artist, durationMs, positionMs, isPlaying })` —
    call from `FullPlayerProvider` whenever `playerTarget`/status changes.
  - Events: `remotePlay`, `remotePause`, `remoteNext`, `remotePrevious`,
    `remoteSeek(ms)` → map to `fullPlayer.playPlayer()/pausePlayer()`,
    `advancePlayerQueue("next"/"previous", true)`, `seekTo`.
- AVRCP (Bluetooth) buttons arrive through the same remote-command APIs on both
  platforms — no separate BT work needed once the media session exists.

### 3. Android foreground service
- Required for reliable playback past ~1 min in background and for the media
  notification. media3 `MediaSessionService` handles both if we adopt it; else a
  plain foreground service with `mediaPlayback` type + notification.
- `android.permissions`: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`
  (API 34+).

### 4. Back-button behavior (after background audio works)
- `useBrowseRootBackHandler` currently calls `BackHandler.exitApp()` at browse
  roots. Once audio survives backgrounding this is correct Android media-app
  behavior (back → home, music keeps playing). Verify exitApp only backgrounds
  (doesn't kill the process) with the foreground service running; if the process
  dies, swap to a `moveTaskToBack` native call while the queue is active.

### 5. Interruptions & routing
- Phone call / other app audio: pause on interruption, resume-if-was-playing on
  end (`interruptionMode` config + status listeners).
- Becoming-noisy (unplugging headphones / BT drop): pause. Android sends
  `ACTION_AUDIO_BECOMING_NOISY`; iOS route-change notifications.

## Verify on device (checklist)

- [ ] Start a playlist → lock screen → audio continues; lock screen shows
      title + working play/pause/next/prev.
- [ ] Android: back out of the app at a browse root → audio continues;
      media notification present; reopening the app restores dock + queue state.
- [ ] Bluetooth (car or headphones): next/prev skip queue tracks; pause/play work;
      metadata shows on the car display.
- [ ] Auto-advance keeps working in background (FullPlayerProvider drives it —
      confirm JS timers/status updates still fire in background on both platforms;
      if not, advance must move into the native layer or use remote events).
- [ ] Phone call mid-track → pauses; resumes after call.
- [ ] Unplug/disconnect headphones → pauses.
- [ ] Recording flows still work after audio-mode changes (record → play → record).

## Explicitly out of scope here
- The in-app dock/queue UI (done: `GlobalMediaDock`, `QueueSheet`).
- Playlist page + collect-mode add flow (done).
- Scrubbing from the lock screen (nice-to-have; add `remoteSeek` if cheap).
