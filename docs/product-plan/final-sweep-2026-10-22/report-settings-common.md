# Audit — Settings, Instruments, Onboarding, Shared UI & Pro seam

Scope: `src/components/SettingsScreen/**`, `TunerScreen/**`, `MetronomeScreen/**`, `BluetoothCalibrationScreen/**`, `common/**` (shared widgets, dialogs, toasts, Pro sheet, welcome flow, help), `src/design/**`, `src/styles/**`, `src/domain/{entitlements,freeMonth,proGating,firstRun,installedUpdate,backupPreferences,bluetoothMonitoring,motionTracking,stepLabels,timeEntry}.ts`, `src/services/{billing,freeMonthClock,reviewPrompt,crashLog,diagnosticsBundle}.ts`, `src/dev/**`, `src/components/dev/**`, `src/config/**`, `src/utils.ts`, `src/context/**`.

Method: read every file named above end to end or by traced path; grep scripts in the scratchpad (`compliance.sh`, `unused-exports.js`). Read-only. No network (the proxy refuses songnook.app, so the legal URLs are unverified from here).

Counts: **P0 0 · P1 3 · P2 9 · P3 12**. Verdict for the submission build: nothing in this scope blocks App Review. The three P1s are decisions/code that must land *before the Pro flag flips*, and one of them (the free-month clock already ticking) has to be decided now because v1.0 writes the date.

---

## P1 — fix before launch / before the flip

### P1-1 The free-month clock starts in v1.0 while the paywall is off, so every v1.0 user's month is already spent when the flag flips
- Confidence: high · `src/components/common/FreeMonthNotices.tsx:23`, `src/services/freeMonthClock.ts:86-99`, `src/domain/entitlements.ts:16`, `src/domain/freeMonth.ts:21`
- What happens: `FreeMonthNotices` mounts after hydration on every launch and calls `syncFreeMonth`, which writes `songnook.freeMonth.startedAt` to Keychain + AsyncStorage on first launch regardless of `ALL_FEATURES_FREE`. A user who installs v1.0 from the App Store on day 0 and receives the update that sets `ALL_FEATURES_FREE = false` on day 60 opens that update to `freeMonthOpen() === false`: `noticeDue` returns `"ended"` and `openProUpsell()` fires on the first launch of the update with "Your free month has ended" — they never experienced a free month with a paywall in sight. They are not founding either: `isFoundingInstall` needs `firstLaunchAt < APP_STORE_RELEASE_AT`, and a v1.0 App Store install's `firstLaunchAt` is *after* release. This contradicts phase-6 §6.6 ("an in-app notice 2 weeks ahead" at minimum) and the founder's "the free month makes it gentle".
- Also: the founder block at the top of `docs/product-plan/phase-6-monetization.md` says "Launch with Pro in v1", but the build ships `ALL_FEATURES_FREE = true` and `billing.ts` is a stub returning `unavailable`. That is a deliberate state (RevenueCat not set up), just make sure it is the intended one for the submission.
- Minimal fix (decide now, implement at the flip): either (a) key the month off the *flip*, not first launch — store a `paywallSinceAt` written the first time a build with the paywall runs and use `max(startedAt, paywallSinceAt)` as the start; or (b) set `APP_STORE_RELEASE_AT` to the date of the *paywall* build rather than the v1.0 build so every pre-flip install is founding. (a) matches the doc's intent; (b) is one constant. Either way, do not ship the flip with the current `syncFreeMonth` as-is.

### P1-2 A restored backup carries founding-member access (once `APP_STORE_RELEASE_AT` is set)
- Confidence: high · `src/state/persistedSnapshot.ts:51`, `src/state/useStore.ts:272-275`, `src/services/freeMonthClock.ts:98`, `src/domain/freeMonth.ts:60-63`
- What happens: `firstLaunchAt` is part of the persisted snapshot and therefore of every backup archive; restore (`sanitizePersistedState`) adopts it. After release, anyone who restores a founding tester's archive (or their own TestFlight-era archive on a new phone) gets `isFoundingInstall(...) === true` and permanent Pro with no purchase. `freeMonthClock.ts` header explicitly says "a backup must never carry access" — the free-month *start* honours that (it lives outside the snapshot), the *founding* input does not.
- Conversely, `eraseAllAppData` (`src/services/eraseAllData.ts`) wipes AsyncStorage and the store, so a genuine founding tester who uses "Erase everything" loses founding status (new `firstLaunchAt`), while the Keychain free-month date survives and may already be expired → they land on "ended".
- Minimal fix: write founding status once to the secure store next to the free-month start (e.g. `songnook.founding = 1` when `firstLaunchAt < APP_STORE_RELEASE_AT` is first observed) and read *that* in `syncFreeMonth`; stop deriving it from the restorable `firstLaunchAt`. Treat erase-all the same as reinstall (keychain survives both).

### P1-3 Roughly half of the founder-confirmed Pro split has no gate, no feature key, and no gated UX
- Confidence: high · `src/domain/entitlements.ts:19-26`, call sites listed below, `docs/product-plan/phase-6-monetization.md` founder block ("Free/Pro split (founder confirmed 2026-10-19)")
- Gated today (every call site that consults the seam):
  | Feature key | Call site | Gate |
  |---|---|---|
  | `overdub-layers` | `PlayerScreen/index.tsx:1237` | `canAddOverdubLayer(layerCount, hasProAccess(...))` → `openProUpsell` |
  | `practice-suite` | `PlayerScreen/index.tsx:1263` | `isPracticeToolPro(tool) && !ensurePro(...)` (loop/pins/speed/pitch/analysis) |
  | `word-sparks-unlimited` | `NotepadScreen/hooks/useNotepadScreenModel.ts:212,221,230` | `canSaveWordSpark(count, hasProAccess(...))` per tool, 5 free |
  | `pdf-export` | `LyricsVersionScreen/.../useChordExport.ts:30`, `ChordSheetScreen/useChordSheetModel.ts:405` | `ensurePro` |
  | `auto-backup` | `SettingsScreen/views/SettingsLibraryView.tsx:75` | `ensurePro` on changing the backup **reminder** frequency to anything but Off |
  | `archive-offload` | `WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts:175` | `ensurePro` |
  | `cloud-backup` | — | key exists, no call site (future feature, fine) |
  `ProGate` (`common/ProGate.tsx`) and `useIsPro` are built and unused (documented as intentional).
- Named in the founder split with **no gate and no `ProFeature` key**: workspaces beyond 2; the full editor (parts, speed & pitch in the editor — `practice-suite` covers only the player's practice tools); charts / transpose / capo / songbooks / setlists / stage reader; Lyric Spark as a whole and the full word finder (only *saving* > 5 sparks per tool is gated — the doc's own "3 of 5 saved" counter, `remainingFreeSparks`, is exported and used only by a test); sending through Send.
- Mismatches with the split: the `auto-backup` gate sits on the backup *reminder* frequency. The founder list says backup/export/restore are free and "Never lock … backup". A free user who picks "Weekly" after the month ends gets the paywall; that is a data-safety feature behind a paywall and will read as a dark pattern in review. Recommend dropping that gate (it is one line) — nothing else uses the key.
- The Pro sheet's six feature rows (`translations.ts pro.features.0-5`: charts & setlists, layers, practice tools, full editor, Lyric Spark, Send + more workspaces) promise exactly the ungated set. Apple will test what the paywall advertises.
- Minimal fix: none needed for v1.0 (everything is free and the sheet is unreachable — see P2-1). Before the flip: extend `ProFeature`, gate the listed entry points with `ensurePro`, and reconcile the reminder gate. This is the §6.3 pass the doc says must be complete before `ALL_FEATURES_FREE` flips.

---

## P2 — should fix soon

### P2-1 Settings says "SongNook Beta" in the App Store build
- Confidence: high · `src/components/SettingsScreen/views/SettingsOverviewView.tsx:47-48`, `translations.ts:457,2049` (`settingsAccount.betaPlan`), `:421,2013` (`settings.proUnlocked`)
- The overview's plan line renders `"SongNook Beta" · "Pro unlocked"` unconditionally. App Review rejects builds that present themselves as beta (Guideline 2.2). [SMALL-WIN] Change the copy to something version-neutral ("SongNook" / "Everything included") or hide the line while `!isPaywallLive()`.
- For the record: the Pro sheet itself is **not** reachable in production — `openProUpsell` is called only from `ensurePro` (never fails while free), `FreeMonthNotices` (returns early when `!isPaywallLive()`), and a `__DEV__`-only menu row (`CollectionHeaderMenu.tsx:161-205`). So no stub purchase flow is visible to reviewers. Good.

### P2-2 Free month can be extended indefinitely by moving the clock back
- Confidence: high · `src/services/freeMonthClock.ts:88-97`, `src/domain/entitlements.ts:52-54`
- `syncFreeMonth` only resets the start when `startedAt > now`; `freeMonthOpen` compares `Date.now()` to the stored end. Set the device date back a month, open the app, and the month is live again. Nothing is charged, so this is a leak, not a loss, but it is also the only entitlement that doesn't ride the store account. Minimal mitigation: persist a high-water `lastSeenAt` beside the start and treat `now < lastSeenAt - 1 day` as "ended" (or simply advance the effective `now` to `max(now, lastSeenAt)`).

### P2-3 Erase-all: an auth error refuses silently
- Confidence: high · `src/components/SettingsScreen/hooks/useEraseAllData.ts:38-53`
- When a lock is enrolled and `authenticateAsync` rejects or returns `success:false` (Face ID failing twice, passcode cancel, the system sheet dismissed), the only feedback is `haptic.error()`; no toast, the row just sits there after two confirmations. Also, `disableDeviceFallback: false` is correct (passcode fallback), and the no-biometrics path (`SecurityLevel.NONE`) correctly skips auth and erases — matches the founder's "two dialogs are the floor". [SMALL-WIN] Add `toast(t("eraseAll.authFailed"))` (new key, ≤5 words) on the `!ok` branch.

### P2-4 Dead UI components shipped in the bundle
- Confidence: high · verified with `unused-exports.js` plus `grep -rlw` including tests
- Whole files with zero importers: `src/components/common/Knob.tsx` (348 lines), `LitKey.tsx` (113), `SectionHeader.tsx` (22). Dead exports in live files: `SegmentedThumb` (`SegmentedControl.tsx`), `SegmentedField`/`FormatOptionRow`/`AccordionSection`/`SelectionMark`/`LIBRARY_DEEP` (`SettingsScreen/components/SettingsShared.tsx`, 664 lines of which these are a good part), `chooseImportSource` (`importSource.ts`, the only non-type export), `BarStrip` and `HAPTIC_STRENGTH_PRESETS`/`nearestHapticStrengthId` (`metronome/MetronomeBlocks.tsx`), `warmModalStyles` (`WarmModal.tsx`), `TransportScroll`, `DockMergeBoxIcon`, `getLineageDepth` (`utils.ts`), `getBackupReminderIntervalMs`, `clampBluetoothMonitoringOffsetMs`. Also `useLegacyMetronomeImpl` (`src/hooks/useMetronome.ts:748-1170`, ~420 lines) only runs when the native module is absent, which no store build is. CLAUDE.md names `LitKey` in the canon list but nothing renders it. [SMALL-WIN] per file; the metronome fallback is a bigger decision.

### P2-5 Storage & repair surfaces untranslated English
- Confidence: high · `src/services/integrityScanner.ts:193-213` (`summarizeIntegrityReport`), `src/services/storageDetails.ts:187-201` (`limitations`), `src/components/SettingsScreen/hooks/useStorageDiagnostics.ts:33-37` (`storageError = error.message`), `src/components/SettingsScreen/views/SettingsStorageView.tsx:77,208`
- "Check library" shows its result in an `AppAlert.info` body and in the row's meta line built by `summarizeIntegrityReport` — English template strings, pluralised by hand. The "Reporting notes" fold prints three hard-coded English paragraphs. Hebrew users see English in a dialog. Fix: move the nine issue labels and the three notes to `t()` keys; cap the alert body (CLAUDE.md: ≤ 20 words — "No problems found across 12 items and 40 clips." is fine, but the issue list can run long).

### P2-6 Welcome import names things in English and breaks the terminology law
- Confidence: high · `src/services/welcomeImport.ts:15,99`
- `WELCOME_IMPORT_COLLECTION_TITLE = "Imported"` creates a collection literally titled "Imported" in a Hebrew UI (and the pane copy interpolates it). The import pill label is `` `${n} recordings` `` — not through `t()`, and "recordings" is a banned object name ("clip"). [SMALL-WIN] for the label (`t("welcome.nClips", {count})`); the collection title needs a key plus a locale-insensitive lookup on replay (match by a stored id or by both titles).

### P2-7 Terms and Privacy links — unverified live
- Confidence: low (network blocked here) · `src/components/common/ProUpsellSheet.tsx:16-17`, `src/config/legalLinks.ts`, `SettingsAboutView.tsx:146-147`
- Both the About page and the Pro sheet link `https://songnook.app/privacy` and `/terms`. The proxy refused the CONNECT so I could not confirm they resolve. Apple opens the About links during review; please confirm from a phone. The About page handles a failed open with a toast — correct. (`ProUpsellSheet` duplicates the two URLs instead of importing `legalLinks.ts` — [SMALL-WIN].)

### P2-8 Shared `shadows.drawer` breaks the "whisper" rule and canon widgets paint off-token
- Confidence: high · `src/design/tokens.ts:203-207` (`shadowOpacity: 0.12`), `src/components/common/TransportBar.tsx:96,141,185,256,266,292`, `SourceFilterRow.tsx:114,191,203,206,219`, `NavRow.tsx:100`, `SurfaceCard.tsx:85`, `CloseButton.tsx:68`, `LoopMoveHandle.tsx:157` (`#0f172a`, a cold slate), `AudioReel.tsx:81-109` (a local dark palette)
- Debt, user-visible but not a blocker. The drawer shadow is the only token above 0.08. `TransportBar` is a canon component with six hard-coded hexes. Full counts below.

### P2-9 Metronome `start()` rejections are unhandled and silent
- Confidence: med · `src/hooks/useMetronome.ts:627-634` (`toggleRunning` → `void start()`), `:536-576` (rethrows after releasing the session)
- If `activateMetronomeAudioSession` or `SongNookMetronomeModule.start()` throws (another owner holds an exclusive session, route negotiation), the promise rejects into the void: no toast, no `haptic.error`, the button stays "Start". `isPreparing` in the native impl only covers the loop-file load. Not reproduced on device; the failure branch exists and nothing consumes it. Minimal fix: catch in `toggleRunning`, `haptic.error()` + a ≤5-word toast.

---

## P3 — nice

1. **Tuner closures are stale by design** · `useTunerScreenModel.ts:117-133,311-335` — `startListening`/`stopListening` are plain functions captured by `[]`-dep effects, so after a language switch the `t()` in error paths is the first render's. Harmless today (language switch restarts the app). The focus/blur and AppState handling is otherwise right: blur → `stop()`, background → `stop()`, unmount → `stop()`; the native module emits a frame every hop even in silence (checked `PitchyModuleImpl.kt:189-198`, `Pitchy.mm:171-175`), so the 1.6 s health-check does not restart in a quiet room.
2. **Tuner health-check interval runs while unfocused** · `:148-186` — it early-returns on `!isFocusedRef`, so it costs one closure call per 1.6 s on every mounted Tuner; fine.
3. **Calibration progress interval at 33 ms drives `setPhaseElapsedMs` → whole-screen re-render ×30/s for ~11 s per pass** · `BluetoothCalibrationScreen/index.tsx:463,551` — bounded and the screen is small; a Reanimated progress or 100 ms tick would halve the JS work during the very measurement that cares about tap-thread latency (taps are stamped on the UI thread via `Gesture.Manual`, so accuracy is unaffected). Timers/intervals are all cleared on unmount and on Stop (`:254-262,271-277`); the exclusive playback session is released on unmount (`:182-184`); the native engine is stopped on unmount (`:265`); `runIdRef` guards every async step of the click pass. Math in `calibrationAnalysis.ts` is sound (dedupe, lead-in skip, MAD gate, lag search over `[-160, +MAX]` with the gap-pattern fingerprint, plausibility floor 40 ms) and tested (`src/components/__tests__/calibrationAnalysis.test.ts`). `buildResultWarning` carries untranslated fallback strings but every call site passes `t` (`:761`).
4. **No AppState handling mid-calibration** · if the phone locks during a pass, iOS throttles the JS timers; the finish timer fires late and the analysis runs on a truncated tap train → "inconsistent" and a retry. Acceptable; a keep-awake for the ~11 s pass would remove it.
5. **Metronome keeps ticking in the background** · `useMetronomeScreenModel.ts:35-45` stops only on blur. Intentional (music stand), and keep-awake is released on stop and on blur. OK.
6. **`ProUpsellSheet` plan rows and feature rows use `fontFamily` literals** · `:214-275` — tokens would be `textTokens.*`; cosmetic. The sheet already has restore / terms / privacy / "Not now" and no dark patterns; the inline `notice` for "Purchases aren't open yet." is the right shape for when billing lands (sheet is a Modal, dialogs can't stack).
7. **`ToastHost`/`toastStore` single-listener** · fine; the action press dismisses before running (`ToastHost.tsx:93-97`).
8. **`AppDialog` keys buttons by label** · `AppDialog.tsx:96,121` — two buttons with the same label collide; no current caller does.
9. **Review prompt** · `reviewPrompt.ts` + `firstRun.ts`: fires only from the recorder's save paths (`useRecordingScreenModel.ts:1578,1685`), needs ≥10 clips, ≥5 days since first launch, 120-day cooldown, marks before asking, loads `expo-store-review` lazily, swallows everything. Within Apple's 3/365 budget. Nothing to fix.
10. **`crashLog.ts` / `diagnosticsBundle.ts`** · local-only, capped at 20 entries, serialized writes, no telemetry. The bundle includes the persist journal; nothing identifying beyond file paths. OK.
11. **`SettingsAboutView` hard-codes a personal Gmail** · `:19` `bmostudio.dev@gmail.com` — fine if intended as the support address; it is also what the stores will see in review mail.
12. **`FreeMonthNotices` re-runs its effect on `t` identity** · `[t]` dep; harmless double `syncFreeMonth`.

---

## Production hygiene — verified

- `src/dev/jsStallMonitor.ts`, `src/dev/commitProfiler.tsx`: required lazily inside `if (__DEV__)` (`App.tsx:153-159`); the profiler is a pass-through in release. `renderCensus.ts` has **no call sites at all** — dead file (its header says "call sites are not meant to ship"). [SMALL-WIN] delete.
- `src/components/dev/SyncProbe.tsx`: imported **unconditionally** at `App.tsx:132` and rendered under `{__DEV__ && SHOW_SYNC_PROBE ? … : null}` (`:1571`, flag `false`). Not reachable, but the module (Skia canvas + Reanimated) is in the release bundle. The file header says "TEMPORARY DIAGNOSTIC — delete once the reel work lands". [SMALL-WIN] delete the file and the import/flag.
- The dev sample/Pro-preview menu rows in `CollectionHeaderMenu.tsx:161-205` sit inside `__DEV__ ? … : null`. `setDevProOverride`/`setDevFreeMonthStart` are `__DEV__` no-ops.
- `babel.config.js` strips `console.log/debug` in production and keeps `warn/error`. There are 79 `console.log` (stripped) and the `warn`s in scope are all on failure branches (tuner start, metronome session, storage diagnostics, restore, `utils.ts:455` file-size probe). No per-frame or per-tick `warn`/`error` in scope. (`useFullPlayer`/`useRecording` warns are also failure-branch; out of scope.)
- `src/config/*`: only public URLs; `SEND_SERVICE_BASE_URL` falls back to localhost under `__DEV__` and `isSendServiceConfigured()` hides Send UI then. No secrets.
- `freeMonthClock.ts` SecureStore use: `requireOptionalNativeModule` probe before `require`, `getItemAsync` without auth flags (correct: it runs on every foreground, must not prompt), writes mirrored to AsyncStorage, one-time copy-up for pre-secure-store installs. Sound apart from P2-2.
- `app.json` carries `NSFaceIDUsageDescription` and the `expo-local-authentication` plugin string for the erase-all gate.

## Design-system compliance spot check (whole `src/`, script in scratchpad)

| Rule | Count | Worst offenders |
|---|---|---|
| Hex literals outside `tokens.ts`/`workspaceTheme.ts` | **286** lines | `PlayerScreen/styles.ts` 31 · `styles/base.ts` 22 · `styles/player.ts` 21 · `styles/songDetail.ts` 16 · `styles/ideas.ts` 15 · `IdeaDetailScreen/songClipControls.ts` 15 · `domain/hierarchy.ts` 14 (cold slate `#475569/#0f172a/#64748b` as hierarchy inks) · `common/AudioReel.tsx` 11 · `common/TransportBar.tsx` 6 |
| Raw `Alert.alert` | **0** | — |
| `expo-haptics` direct import | **3** files: `design/haptics.ts` (the vocabulary), `hooks/useMetronome.ts` (the sanctioned beat engine), **`RecordingScreen/components/RecordingBeatBreath.tsx`** (claims the same carve-out in a comment; not in CLAUDE.md's exception) | |
| Numeric `duration:`/spring literals outside `motion.ts` | **1** real (`common/BottomSheet.tsx:106,113` keyboard-follow `250`), plus `SyncProbe.tsx` (dev) | |
| `fontWeight` outside tokens | **3** lines: `ChordToken.tsx:229` (documented monospace exception, has fontFamily) · **`IdeaListScreen/components/CollectionScreenContent.tsx:97`** (`fontWeight:"600"` with no fontFamily → system font; [SMALL-WIN]) | |
| `fontFamily:` literals outside tokens | 732 | pervasive; debt |
| `borderRadius: 999` | 20 | `styles/player.ts` 5 · `styles/ideas.ts` 3 · `AudioReel.styles.ts` 3 — pills in legacy style files |
| `Playfair` | 0 · `songseed` in code | 0 (one comment) |

Shadows: every token ≤ 0.08 except `shadows.drawer` 0.12 (P2-8).

## Welcome flow — verified
- Gate: `WelcomeGate` renders `WelcomeFlow` while `!hasSeenWelcome`; sanitize defaults the flag to `true` for any pre-existing snapshot and `false` for a fresh one (`useStore.ts:267-268`), so upgrades never see it. Skip and Start both call `setHasSeenWelcome(true)` (persisted). Replay from About flips it back. The restore-library dialog path sets it first so the intro never covers a data-loss prompt (`App.tsx:1323-1337`).
- Re-entrancy: `handlePick` guards on `importBusy`; `runWelcomeImport` runs detached (unmount mid-import is safe; the global import pill continues); duplicates are skipped silently; the job is removed 2.5 s after completion. Errors render inline (`welcome.importError`), never a dialog. OK apart from P2-6.

## Erase-all — verified
Two destructive dialogs (haptic `warning` fired by the host) → device lock only if enrolled → `eraseAllAppData` freezes writers, sweeps the sharded store and satellites, drains the SQLite queue before deleting the DB, deletes every owned directory, reloads. Keychain free-month date intentionally survives. See P2-3 and P1-2 for the two gaps.

---

## Feature inventory (what a user can do in this scope)

**Settings** (drawer place, large Lora title)
- Overview → plan line (SongNook Beta · Pro unlocked) · Preferences · Data & storage (shows last backup / progress) · Help & about
- Preferences → App language (English/עברית, restart dialog) · Name language (auto/en/he) · Open to (primary / last used) · Interface haptics toggle · Recording: name each clip toggle · Bluetooth calibration (→ pushed tool)
- Data & storage → Back up (progress, last verified, copy file name) · Restore (zip picker; replace/merge; incomplete-backup "restore anyway" dialog) · Reminder (Off/Weekly/Monthly/Every 3 months value row; non-Off is Pro-gated) · Export an archive (→ export view) · Import an archive (→ import view) · Sent links (→ sharing view) · Storage & repair (→ storage view)
- Sharing → list of Send links with days-left/expired · Copy link · Forget (confirm) · help sheet (Send)
- Storage & repair → library size, archived size, temp size · Check library (integrity scan → dialog) · Recover audio files (orphan/manifest recovery → dialog) · Support details fold (per-area bytes, internal paths, notes) · Erase everything (2 dialogs + device lock → wipe + reload)
- Help & about → version + OTA update id · Send feedback (mailto) · Share diagnostic log (iOS share sheet; Android: save to phone / share file) · Replay intro · Privacy line · Privacy policy · Terms of use (external links)

**Metronome** (drawer tool, compact header)
- Tempo stepper (±1) · drag the BPM · Tap tempo (count shown) · Start/Stop transport (keeps screen awake while beating; stops on leaving the page) · Meter fold → sheet (meter presets, feel/subdivision, custom beat pattern: tap a beat to cycle accent/click/rest) · Sound fold → sheet (beep on/volume, click voice click/wood, visual pulse, haptic on/strength) · visual halo pulse on the beat

**Tuner** (drawer tool)
- Auto-starts listening on focus, stops on blur/background · needle in cents, note + octave, Hz · flat/sharp badges · in-tune success haptic once per lock · mic permission denied → inline message with Try again / Open Settings

**Bluetooth calibration** (pushed from Preferences)
- Current output route + OS-reported latency · Start → 3-2-1 countdown → music pass (tap along 16 beats with random silent beats) → click pass (metronome engine) → result (music ms, click ms, fine-tune steppers, warnings) · Save (toast, back) · Retry · Stop mid-pass · Use reported ms (seed) · Saved calibrations list → "…" (Fine-tune saved / Calibrate again / Remove with confirm) · abort on route change

**Shared / onboarding**
- Welcome flow (first run + replay): 5 panes, swipe/dots/Next, Skip from any pane, pane 5 imports audio files into an "Imported" collection with live progress and a done summary
- Pro sheet (hidden until the paywall is live): what Pro adds (6 rows), free-month line, Yearly $11.99 (founding) / Monthly $1.99 / Lifetime $29.99 rows, Get Pro, Restore · Terms · Privacy · Not now
- Free-month notes (hidden until live): toast at ≤5 days, toast on the last day, Pro sheet once after it ends
- App-wide: toast host (one at a time, optional action), dialog host (nested inside sheets), action-menu host, root error boundary with Restart, store-review ask after the 10th saved clip (≥5 days in, ≤ once per 120 days)
