# 11 — Versions, migrations, compatibility, entitlement state (second pass, 2026-11-02)

Scope: every persisted data-shape change and rename, backups and exports across app versions
and platforms, new JS on old native binaries (OTA), entitlements as stored state, and i18n
strings acting as data. Read-only review. Reference points:

- First store binary: iOS build 4 = commit `37d6f0ba` (2026-09-09). It stayed the only build in
  TestFlight "Beta Production" until build 12. All store binaries share `runtimeVersion` 1.0.0
  (`app.json:13-15`, policy `appVersion`), so every production OTA reaches all of them.
- The probes ran as a throwaway jest suite (`src/__audit_scratch3__/`, since deleted) against
  the real `mergeRestoredLibrary`, `normalizeWorkspaces` and `decideFounding`.

Severity: CRITICAL = realistic silent loss/stranding or content held hostage · HIGH · MEDIUM · LOW.

**Bottom line.** No CRITICAL. Every rename and the storage move happened before the first
store build, and new native calls are guarded well. The real risks are elsewhere:

- **The founding-member flag can be written as "0" for good** for a tester. On iOS that "0"
  sits in the Keychain, where no reinstall and no restore can undo it.
- **The "newer backup / newer data" safety net has never been armed.** It does not protect
  anything today.

---

## Summary

| # | Sev | Finding | Confidence |
|---|-----|---------|------------|
| H1 | **HIGH** | Founding is decided late, per device, from `firstLaunchAt`. An empty boot, a reinstall or a new phone stores "0" in the Keychain for good. | verified (code + probe) |
| M1 | MEDIUM | `STORE_VERSION` frozen at 12 since 2026-07-10 across ~13 persisted-shape changes: the "backup from a newer app" refusal can never fire, and older JS (expo-updates fallback, embedded bundle, rollback) silently strips newer data on its next write | verified (code + git) |
| M2 | MEDIUM | Cross-platform codec gap beyond AIFF: CAF (iOS-only) and Ogg/Opus (Android-only) are accepted and travel in backups and Send, then won't play on the other OS | plausible (platform codec support; not device-tested) |
| M3 | MEDIUM | Opening your **own** chart book in the reader is Pro-gated: after the free month, or before RevenueCat answers, every song tap opens the upsell | verified (code) |
| L1 | LOW | Export/Send schema version is write-only, and v7 gained three fields with no bump (including the layer `recordedOffsetMs`) | verified (code + git) |
| L2 | LOW | Pro is in memory only and starts false each launch; a word-game try is spent if the tap lands first | verified (code) |
| L3 | LOW | Sealed Send can't be opened by any binary older than the 2026-11-01 native build; old JS reports a generic "invalid" | verified (code) |
| L4 | LOW | i18n strings used as identifiers: "Recovered", "Files", untitled-spark detection | verified (code), cosmetic |
| — | (confirm) | 08-R4 (merge brings a lost idea back into a collection that moved to another workspace) is reproduced, along with the restored-only-workspace variant | verified (probe) |

---

## HIGH

### H1. A founding tester can be stored as "not founding" for good, on a device whose Keychain outlives every reinstall

**Where**
- `services/freeMonthClock.ts:162-163`:
  ```ts
  const decision = flag.errored ? { founding: false, store: null } : decideFounding(flag.value, firstLaunchAt);
  if (decision.store) await writeRaw(FOUNDING_KEY, decision.store);
  ```
- `domain/freeMonth.ts:85-86` and `:115`: once a release date is set, a missing
  `firstLaunchAt` means `isFoundingInstall` returns false, so "0" is stored:
  ```ts
  if (releaseAt == null || firstLaunchAt == null || !Number.isFinite(firstLaunchAt) || firstLaunchAt <= 0) return false;
  ```
- `components/common/FreeMonthNotices.tsx:23`: `syncFreeMonth(useStore.getState().firstLaunchAt)`.
  It mounts the moment hydration completes (`App.tsx:1533`), before the boot effect calls
  `markFirstLaunch` (`App.tsx:1352/1393/1399`, after several awaits).
- The flag is read from the Keychain first. A stored "0" is final (`decideFounding("0", …)` →
  `{founding:false, store:null}`), and the Keychain survives app deletion and "Erase
  everything" (`freeMonthClock.ts:19-24`). That is good for "1" and fatal for a wrong "0".

**Scenarios (each is dormant until `APP_STORE_RELEASE_AT` is set)**
1. **Empty or corrupt-meta boot** (01-H1, or any boot that brings up the "Restore your
   library?" prompt). `firstLaunchAt` lives in the meta row, so it hydrates as `null`.
   `FreeMonthNotices` runs at once, `decideFounding(null, null, release)` returns `{store:"0"}`,
   and "0" is written to the Keychain. The person then restores the library, and
   `firstLaunchAt` comes back from September, but the stored "0" wins. *Probe confirmed both
   steps.*
2. **New phone or reinstall after release.** The first launch stamps `firstLaunchAt = now`
   (after release), and "0" is stored before the SongNook backup is restored. The 2026-10-22
   sweep chose this on purpose (P1-2: "a restored backup cannot carry it"). The effect is
   still that every founding tester who changes phones loses Pro.
3. **Tester deletes the TestFlight app and installs the App Store build** before the release
   OTA has run on the old install. If the store binary ships with the release date set, or
   the OTA is already live, the decision happens on the fresh install, and the answer is
   "0". Deleting the beta before installing the store version is common. The release switch
   is planned as an OTA (launch checklist item 4), and an OTA needs two launches to apply, so
   infrequent users never got their "1" written.

**Effect.** No content is held hostage (gates only block creating new things; see "Solid").
But the cohort the founder promised "Pro forever" gets Pro gates, and nothing in the app can
fix it on that device. The only remedy is a RevenueCat promotional entitlement granted by
hand, and the RevenueCat user is anonymous.

**Fix.** Write founding "1" now, while the tester is still on a pre-release binary. Detect
that with a build-time flag or the iOS sandbox receipt, not a null release date, so
day-one App Store installs aren't marked. Never write "0" from a `firstLaunchAt` that is null
or that this session just stamped.

---

## MEDIUM

### M1. The version gate has never been armed, so older JS silently strips newer data

**Where**
- `state/persistedSnapshot.ts:11`: `export const STORE_VERSION = 12;`, unchanged since
  `8f4f7302` (2026-07-10).
- Persisted-shape changes since the first store build, none of which bumped it:
  - `05cc8792` grid `accentPattern`
  - `1afc4743` `received`/`openedAt`
  - `0fc7adb7` setlist `description`
  - `1a8b8fbd`/`8c4cfa93` playlist `received` + ShareKinds
  - `291d5529` `draftFromClipIdea`
  - `b27d96d3` word-ladder step `"nouns"`
  - `710e6751` spark `finishedAt`
  - `7bcebd02` BT `tapTiming`
  - `2109ae32` `keptPractice`
  - `4ce1a92e` stem `recordedOffsetMs`
  - `12d2a2f8` `keptPractice` reshaped flat → `{sound, loop:{countIn, region}}`
  - `ed89e9fe`/`ec39bae6`/`894b471d` Magpie language es/de/pt
- `services/disasterRecoveryValidation.ts:132`: `if (storeVersion > supportedStoreVersion)`
  is the only "made by a newer app" refusal for backups. Every shipped build writes 12, so it
  can never fire. The Merge refusal for other store versions (`disasterRecoveryRestore.ts:214`)
  can't fire either. This corrects report 02's "Versioning" bullet under *Solid*.
- zustand calls `migrate` whenever the stored version differs **in either direction**
  (`node_modules/zustand/esm/middleware.mjs:390`). Here `migrate` and `merge` are both
  `sanitizePersistedState`. Even with bumps, an older bundle would "migrate" newer data and
  then write it back.

**When older JS reads newer data**
- **expo-updates error recovery.** When a new OTA crashes at launch, expo-updates falls back
  to the previous update or the embedded bundle on its own.
- **A fresh store install.** The first launch runs the embedded bundle. A Replace restore of a
  backup made on newer JS can then be hydrated by that bundle, if the OTA hasn't applied by
  the restart.
- **A manual `eas update` rollback** (01-L3).

**What the older code does to newer data.** Each of these is written back on the next
change.
- **Kept practice settings reset to neutral.** The 2026-10-21 `normalizeKeptPractice` (in
  `git show 2109ae32`) reads the 10-24 nested shape as flat. It finds no `pitchSemitones`, so
  it returns `{pitchSemitones:0, playbackRate:1, countIn:"off"}`.
- **A whole take grid is dropped** when the meter is unknown. `normalizeRecordingGrid`
  (`dataSlice.ts:719-721`) returns `undefined` for an unrecognized `meterId`, which loses bpm,
  tempo map and downbeat. The meter set is unchanged since build 4, so this is the next
  meter that gets added.
- **Fields are dropped by whitelists:** setlist entries (`dataSlice.ts:1335-1350`), chord-sheet
  sections (`chordSheet.ts:146-162`), pins (`normalizePracticeMarkers`), sparks, archive state,
  and the top-level snapshot (`useStore.ts:103-299`).
- **Values are rewritten:** a Magpie spark's language becomes `"en"` on a pre-pt bundle
  (`magpie.ts:632`), and a word ladder's `"nouns"` step becomes `"setup"`.

Today's exposure is small. `src/types.ts` hasn't changed since iOS build 13 (`44aea222`). The
mechanism is unguarded for the next change, though.

**Fix.** Bump `STORE_VERSION` on every persisted-shape change, and add a test that pins the
snapshot's key set to the version. When the stored version is greater than `STORE_VERSION`,
hydrate read-only (never write back) and show "Update SongNook". Spread unknown keys through
at every level instead of whitelisting.

### M2. Some formats play on only one OS but travel freely between them

**Where**
- `services/audioImportFormat.ts` header. The AIFF decision states the principle:
  > "one platform accepting a file the other refuses would be a worse surprise than neither"

  But only AIFF (and WebM/MKV video) is handled.
- `services/audioStorage.ts:636`: only `isAiffExtension` gets converted. Every other
  extension is kept as-is (`${targetId}.${extension}`).
- `services/shareImport.ts:5-19`: share intake accepts `opus, ogg, oga, wma, mid, midi` (and
  any `audio/*`).
- `services/receiveTransfer.ts:56`: Send accepts `ogg, oga, caf`. The picker accepts `audio/*`
  (`audioStorage.ts:445`).

**Scenarios**
- **Android → iPhone** (backup restore or Send): Ogg Vorbis/Opus clips (WhatsApp voice notes
  are `.opus`, a common way songwriters capture ideas) can't be decoded by AVFoundation.
- **iPhone → Android:** `.caf` files kept from iOS imports have no media3 extractor.

The backup reports them as restored, the files are present, and playback and waveform fail on
the new phone. Nothing is lost on disk, but the "new phone" migration silently leaves those
ideas unplayable.

**Fix.** Convert at import, as AIFF already is. iOS: CAF → M4A with the existing converter.
Android: Opus/Ogg → M4A through the native decode/extract path. Until then, refuse these
types with the AIFF message.

### M3. Your own chart book's reader is Pro-gated

**Where**
- `components/LibraryScreen/hooks/useSongbookModel.ts:105`:
  ```ts
  if (!ensurePro("stage-tools", hasProAccess("stage-tools") || activeSongbook.received != null)) return;
  ```
- That gate covers "Open book" (`views/SongbookDetailView.tsx:96`) and **every song row tap**
  (`:231`).
- It contradicts `domain/entitlements.ts`, which says "NEVER gate … opening existing work",
  and the catalog row in `proCatalog.ts`: "reading existing charts, books and sets stay free".

**Scenarios**
- **After the free month:** a free user who built a gig book in the free month can no longer
  read it as a book.
- **A paying user whose Pro hasn't been recognized yet** (L2), or who is on a new phone and
  hasn't tapped Restore, is blocked at the moment of performing.

The lyrics and charts stay reachable through each sketch, so this is not strict hostage. But
the book (order, chosen versions) is the user's work and can only be read through the upsell.

**Fix.** Gate creating books and the stage-only extras (capo, transpose), never opening an
existing book in the reader.

---

## LOW

- **L1. The export/Send archive version is never read, and v7 grew three fields without a
  bump.**
  - `libraryExport.ts:421` writes `schemaVersion: 7`.
  - `libraryImport.ts:413-423` checks only `format`.
  - Added under v7 since `85ea180e`: `keptPractice` (`2109ae32`), `playlists` (`1a8b8fbd`) and
    stem `recordedOffsetMs` (`4ce1a92e`).
  - An older importer drops them silently. Losing `recordedOffsetMs` re-introduces the
    ~45 ms layer lateness that the 10-22 alignment fixed.
  - Receivers are mostly on OTA'd JS, hence LOW.
  - **Fix:** bump on every manifest addition, and say "made by a newer SongNook — some details
    may not come across" when the version is higher.
- **L2. Pro starts false every launch.**
  - `entitlements.ts`: `let isProState = false`. It turns true only after `initBilling` →
    `getCustomerInfo` (`billing.ts:126-139`).
  - In that window, or if RevenueCat errors, a subscriber hits gates.
  - `useNotepadScreenModel.ts:215-219` (`if (!isPro) spendSparkTry(game)`) spends a permanent
    word-game try. Harmless while subscribed, but counted if Pro lapses.
  - **Fix:** keep a last-known entitlement hint (with an expiry) in secure store, and don't
    spend tries before billing has answered.
- **L3. Sealed Send can't be opened by older binaries.**
  - Sealing is on whenever the sender can seal (`sendSeal.ts:26-28`).
  - Any receiver binary from before 2026-11-01 (iOS ≤ build 13, Android ≤ v11 closed test)
    gets "needs update" (`receiveTransfer.ts:220`). The link dies after 7 days.
  - JS from before `22db566b` (an OTA not yet applied) rejects the `N.sealed` names as an
    invalid parcel with a generic error.
  - No loss: the sender keeps the originals, and the web page still works.
- **L4. i18n strings used as identifiers.**
  - `actions.ts:3404` matches the recovery collection by current-language title or
    `"Recovered"`. After a language switch, recovery in a third language opens a second
    collection.
  - The `"Files"` checks (`ReceivedScreen/index.tsx:102`, `ReceivedParcelSheet.tsx:84`) match
    English only.
  - `NotepadScreenContent.tsx:305` detects an untitled spark by the current language's
    string.
  - All cosmetic; nothing is lost or duplicated.
- **Confirmation of 08-R4 (merge brings a lost idea back into a moved collection).**
  - Probe: backup has collection C with ideas i1 and i2 in workspace A. Now C (with i1) lives
    in workspace B, and i2 was deleted.
  - Merge returns i2 into A with `collectionId: "C"`, which A doesn't have.
  - `normalizeWorkspaces` leaves it there at hydration. It stays invisible and is excluded
    from collection-scoped export.
  - The restored-only-workspace branch (`libraryMergeRestore.ts:129-135`) drops moved
    collections but keeps their ideas in the same way.

---

## OTA on old native binaries: inventory since build 4 (`37d6f0ba`)

| Native addition | JS guard |
|---|---|
| `songnook-file-io` iOS module (whole module new; Android existed) | `requireOptionalNativeModule` (`SongNookFileIOModule.ts:50`); callers check `isSongNookFileIOAvailable` |
| zip writer/extract (`zip*Async`, `extractRangeAsync`) | `isNativeZipAvailable()` checks each function (`songnook-file-io/index.ts`); JS path kept |
| SNS1 seal (`seal*/openSealed*`) | `isSealAvailable()`; unsealed send / "needs update" on receive |
| pitch-shift `setSound`, `setPlayAlongClick`, `decodeToWav`, `extractAudioTrack` | `nativeModule.setSound &&` (`useNativePitchTransport.ts:575`), `?.setPlayAlongClick` (`usePlaybackClick.ts:655`), `typeof … === "function"` (`dawExport.ts:59`, `audioStorage.ts:434`) |
| metronome `supportsPrimedMapStream` | `?.supportsPrimedMapStream?.()` (`usePlaybackClick.ts:50`) |
| `expo-secure-store` | `requireOptionalNativeModule("ExpoSecureStore")` before `require` (`freeMonthClock.ts:51`); AsyncStorage fallback |
| `react-native-purchases` | `NativeModules.RNPurchases` check before `require` (`billing.ts:57-66`) |
| `expo-image-picker` | lazy `require` in try/catch + extractor check (`audioStorage.ts:431-485`) |
| expo-audio patch (lock-screen prev/next) | `updateLockScreenOptions` already existed in build 4's patch; call wrapped in try |
| @siteed patch `captureStartTimeEpochMs` | optional field; fallback timing |
| Existing native functions | all take a request map (`AsyncFunction("x") { request: Map }`), so new keys are ignored, not arity errors |

Verdict: **solid.** No unguarded new native call was found. The residual effects are only
behavioural. On older binaries, layer gain/tone in a rendered mix and the in-stream click are
missing. Nothing is written wrongly.

---

## Solid (checked)

**Renames and migrations**
- Every rename predates the first store build:
  - `song-seed-store` → `songstead-store` (`ea01e19c`, 07-11) → `songnook-store` (`1f6fd22b`,
    07-19), together with the satellite keys.
  - `songseed/` → `songnook/` directories, and `songnook.db`.
  - The bundle id became `com.bmostudio.songnook` in the same 07-19 commit, so an older
    install is a different app, not stranded data.
- In-place migrations still hold:
  - `semi` → `stem` (`dataSlice.ts:1028`)
  - `isFavorite` → `isBookmarked`
  - flat → nested `keptPractice` (`keptPractice.ts:46-48`)
  - legacy word-ladder steps
  - legacy archive id `song-nook-archive` (`libraryImport.ts:417-420`)
  - legacy AsyncStorage blob → SQLite (`db/storage.ts:288-303`)
  - monolithic → sharded rows
  - SQLite `MIGRATIONS` is empty (schema v1).
- Since build 4 no stored enum value has been removed: meter ids, activity sources,
  `IdeasFilter` and `IdeaStatus` are unchanged. Unknown section kinds become "custom", and an
  unknown parcel kind becomes "clips" (`receiveTransfer.ts:68-71`).

**Files across platforms**
- Managed media names are `${genId}.${lowercase ext}` (`audioStorage.ts:644`, `utils.ts:302`):
  ASCII, lowercase and short. So there are no case-insensitive collisions (APFS vs ext4), no
  NFC/NFD Hebrew mismatches and no path-length or illegal-character issues across platforms.
- Paths are stored relative and rebased (report 02).

**Entitlements**
- Content is never held hostage, apart from M3. Backup is `pro:false`. Restore, export,
  unarchive, receiving and opening received parcels are ungated. Count gates fire only on
  create (`canAddWorkspace`, `canAddOverdubLayer`, `canAddEditorPart`, `canSendLink`).
  Archive offload is gated only on offloading, not on bringing a workspace back.
- Free-month dates and founding are never in a backup. The Keychain high-water clock blocks
  date-rollback. A Keychain read error defers the founding decision instead of writing "0"
  (`freeMonthClock.ts:108-120`).
- Send's 30-day stamps ignore future-dated stamps (`sentLinks.ts:36`), so a wrong clock can't
  lock Send for months.
- RevenueCat keys live in code, so OTAs carry them. Restore purchases sits on the Pro sheet.

**i18n**
- Starter names are created once in the language of the moment, and never renamed or
  re-created on a language switch.
- Clip tags and stages are stored as keys and translated at display time.
