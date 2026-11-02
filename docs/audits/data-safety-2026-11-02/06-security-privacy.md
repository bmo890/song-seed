# 06 — Security & privacy audit (2026-11-02)

Scope: can anyone other than the user read, alter or destroy their ideas, and does private data leak.
Read-only code audit of `main` @ 13ed9ddd plus the installed `node_modules`. No live server was called.
"Verified" means read in code; "plausible" means the code path exists but was not exploited on a device.

## Summary

| # | Sev | Finding | Confidence |
|---|-----|---------|------------|
| 1 | **HIGH** | Android share intake writes to `cacheDir/<sender-supplied name>`: path traversal over the library DB/audio by any installed app | verified (code) |
| 2 | MEDIUM | OTA updates are not code-signed: whoever holds the Expo account/token can ship JS that reads the whole library and every parcel key | verified |
| 3 | MEDIUM | Shared-in files are copied and never deleted (iOS App Group, Android cache, `shared-archive-*.zip`); Erase everything misses them, though the privacy policy says it removes everything | verified |
| 4 | MEDIUM | A received package is barely validated (type-checked only at `format` + `workspaces[]`): bad field types are saved and can crash the screens that show them on every launch | plausible |
| 5 | MEDIUM | Privacy promise "neither can … anyone who breaks into our servers" is too strong for the browser path: the server ships the JS that reads `#k=` | verified |
| 6 | LOW | A received package adds its notes to your own Lyric Pad and its Bluetooth calibrations to your device | verified |
| 7 | LOW | Parcel files aren't tied to their slot: the server can swap two same-size files inside one parcel | verified |
| 8 | LOW | Parcel keys + upload tokens sit in plain AsyncStorage and travel inside every full backup; send key also mirrored to AsyncStorage | verified |
| 9 | LOW | No app lock / app-switcher cover; lyrics show in the task switcher | verified |
| 10 | LOW | Android App Links list only the upload-key fingerprint; Play-signed installs won't verify | verified (config) |
| 11 | LOW | Recipient-page CSP allows `'unsafe-inline'` scripts | verified |
| 12 | LOW | `audioRecovery.restoreWorkspaceFromArchive` target check lacks the `..` test its sibling has | verified (local input only) |
| 13 | LOW | Stray root `wrangler.jsonc` would deploy `dist/` as a public Worker named `songnook` | verified |
| 14 | LOW | Clipboard gets the full keyed link automatically; logs carry file names | verified |
| 15 | INFO | iOS data protection is the default (CompleteUntilFirstUserAuthentication); Android `allowBackup=true` | verified |

---

## 1. HIGH: Android share intake path traversal ("Dirty Stream")

`node_modules/expo-share-intent/android/src/main/java/expo/modules/shareintent/ExpoShareIntentModule.kt:298-327` (v5.1.1, no patch in `patches/`):

```kotlin
val fileName = cursor.getString(columnIndex)          // _display_name from the SENDER's ContentProvider
Log.i("FileDirectory", "File name: $fileName")
targetFile = File(context.cacheDir, fileName)          // no basename, no ".." check
...
resolver.openInputStream(uri)?.use { input -> FileOutputStream(targetFile).use { fileOut -> input.copyTo(fileOut) } }
```

This runs inside `handleShareIntent` → `getFileInfo` → `getAbsolutePath`, **as soon as the intent arrives**, before the
ShareImport screen ever asks the user anything. `MainActivity` is `exported="true"` with `ACTION_SEND` filters for
`audio/*`, `application/zip`, `application/octet-stream`, `video/*` (app.json `androidIntentFilters`).

Attack: any installed app (it needs no permissions) sends an explicit `ACTION_SEND` to `com.bmostudio.songnook` with
`EXTRA_STREAM` pointing at its own provider, and that provider returns `_display_name = "../files/SQLite/songnook.db"`.
expo-sqlite keeps the DB at `filesDir/SQLite` (`SQLiteModule.kt:33`), and `DB_NAME = "songnook.db"`
(`src/state/db/database.ts:15`). The copy then overwrites the library database. The same trick reaches the shadow
manifest, the AsyncStorage DB, clip audio under `files/songnook/audio/`, and potentially the expo-updates bundles under
`files/.expo-internal/`, which could mean code running inside the app. A single shared file is enough. The `!!` on
`resolver.query(...)` and `getType(...)` (lines 69, 75) also let a hostile provider crash the app.

iOS is not affected: the extension names its copies `UUID().uuidString + ext` (`ShareExtensionViewController.swift:286`).

**Fix:** use `patch-package` on expo-share-intent so it writes `File(cacheDir, "share-intake/" + UUID + "." + safeExt)`
and checks that `canonicalPath` starts with the canonical cacheDir. Also drop the `Log.i` and replace the `!!`s with
null checks. Report it upstream too.

## 2. MEDIUM: OTA updates without code signing

`app.json` `updates` holds only `url` and has no `codeSigningCertificate` or `codeSigningMetadata`. `eas.json` has the channels
`production`, `preview` and `development`, and the Android manifest says `EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS`.

Scenario: if someone takes over the Expo account (the Google sign-in) or leaks an `EXPO_TOKEN`, they can publish a
bundle that every install runs on its next launch. That bundle can read SQLite, all audio, Sent links (keys) and the
send key, and upload them anywhere. Signing also protects against a compromised Expo CDN. It does not help if the
signing key lives on the same machine as the token. **Fix:** run `npx expo-updates codesigning:generate`, keep the
private key off the build machine (pass it to `eas update --private-key-path` from offline storage), and turn on 2FA
for the Expo account.

## 3. MEDIUM: Shared-in copies never deleted; Erase everything misses them

- iOS: the share extension copies every shared file into the App Group container
  (`ShareExtensionViewController.swift:286-293`, `containerURL(forSecurityApplicationGroupIdentifier:)`).
  `resetShareIntent` only nils the UserDefaults key (`ExpoShareIntentModule.swift:39-41`). Nothing in `src/` ever
  touches the group container (grep: no `appGroup`/`containerURL` in `src`).
- Android: the same module leaves `cacheDir/<name>` copies behind (see #1). `sweepPickerCache` cleans only
  `DocumentPicker`/`ImagePicker` (`src/services/pickedCopies.ts:13`).
- `src/components/ShareImportScreen/hooks/useShareImportScreenModel.ts:124`: `shared-archive-${Date.now()}.zip` in the cache
  root, never deleted. `songnook-seal/` (cache) is also not in `eraseTargets()`.
- `src/services/eraseAllData.ts:50-58` `eraseTargets()` covers `songnook/`, `diagnostics`, `SQLite`, `songnook-receive`,
  `cache/songnook`, and none of the above.

Effect: every clip or video ever shared in (possibly GBs, possibly someone else's private audio) stays on the device after
import, after deletion inside SongNook, and after Erase everything. `docs/privacy-policy.md:39` promises "remove
everything with Settings → Erase everything". **Fix:** after a successful import or cancel, delete the shared source
when it sits inside the group container or the cache. Sweep the group container root and the stray cache files at
launch, and add them (plus `songnook-seal`) to `eraseTargets` (the group container needs a small native helper or
`Paths.appleSharedContainers`).

## 4. MEDIUM: Received package is barely validated, so a hostile one can keep crashing the app

`src/services/libraryImport.ts:413-422`: the whole guard is

```ts
(format === SONG_NOOK_ARCHIVE_FORMAT || format === LEGACY_SONG_NOOK_ARCHIVE_FORMAT) && Array.isArray(candidate.workspaces)
```

Values then pass through unchecked: `title: clipManifest.title` (lines 304, 751), notes `title/body`, tags, sections,
markers. `normalizeClip`/`normalizeIdea` (`src/state/dataSlice.ts:942,1007`) don't coerce titles to strings. A parcel from
a stranger (Send link or a shared `.songnook`) with `title: {}` or `tags: "x"` imports, persists, and then throws in
render or in a selector (`.trim()`, `Objects are not valid as a React child`) wherever Received, Search or Activity
shows it, on every launch. The library's data stays intact, but the user can't get to it without Erase. Each import
needs the user's tap, which keeps this at MEDIUM. Plausible, not reproduced. **Fix:** run the manifest through a strict
coercing schema at the boundary (strings to strings with length caps, arrays to arrays of validated records, drop
unknowns), and give the Received surface its own error boundary that offers to remove the package.

## 5. MEDIUM: "Not even if someone breaks into our servers" is too strong for the web path

`docs/privacy-policy.md:30` says: "We store the encrypted files and cannot open them; neither can Cloudflare, or anyone who breaks into our
servers." For app↔app this holds: the native code opens the parcel, and the app fetches only `/api/transfers/<id>`
(`src/services/receiveTransfer.ts:256`), never the fragment. A browser recipient or sender, though, runs
`SEAL_JS`/`SEALED_JS`, which the Worker serves inline (`server/songnook-send/src/pages/recipient.ts:199`,
`Seal.keyFromHash(location.hash)`). Anyone who can change the Worker, or the Cloudflare account, can serve a page that
posts `location.hash` home. The same goes for #2 on the app side. **Fix:** soften the policy line to "…cannot open them.
Someone who took over our web page could change it, so for the strongest guarantee open links in the app." Or keep
the claim and pin the page with Subresource Integrity plus an app-only open. Don't say "unhackable" (as already
decided).

## 6. LOW: Received package writes into your own spaces

`src/state/actions.ts:3524`: `const nextNotes = [...merge.importedNotes, ...store.notes];` runs whatever the
`origin`. `merge.bluetoothMonitoringCalibrations` (from `manifest.libraryPreferences`) is merged too. A received
package can therefore add pinned Lyric Pad notes outside Received, and can set recording-latency calibrations for any
Bluetooth route you haven't calibrated yet. **Fix:** when `origin === "received"`, drop `notepadNotes` and `libraryPreferences`
(or attach notes to the package).

## 7. LOW: Parcel files aren't tied to their slot

SNS1's AAD is only the 15-byte header (`SongNookSeal.swift:60`, `SongNookSeal.kt:53`, `sealJs.ts:63`), and every file
in a parcel uses the same key. Whoever controls the server can swap `1.sealed` and `2.sealed`. The app checks the opened
size against the envelope (`receiveTransfer.ts:367`), so only same-size swaps go unnoticed. Truncation, reordering
of records and extension are all caught (the nonce carries the index and the last flag, and the layout comes from the file size). **Fix (format v2):** add
the item index to the AAD, or put each item's SHA-256 in the sealed envelope and check it after opening.

## 8. LOW: Where keys rest

- `SentLink.shareUrl` (with `#k=`) and `uploadToken` (`src/domain/sentLinks.ts:16,27`) are kept in AsyncStorage
  (`src/state/useSentLinksStore.ts:73`). They are also carried in DR backups via `satelliteSnapshot.ts:41`, and those
  backups are plain zips the user saves to Drive or iCloud. Each key lives at most 7 days, and whoever holds the backup
  already has the library, so the risk is small.
- `writeRaw` stores the send key in AsyncStorage as well as SecureStore (`src/services/freeMonthClock.ts:76`). That
  makes SecureStore pointless for confidentiality on both platforms (readable on rooted or jailbroken phones, and in
  device backups). A stolen send key lets someone use the victim's free quota or Pro, list or remove their paired
  browsers, and pair new ones. It can't read anything. **Fix:** keep `songnook.send.key` in SecureStore only, with
  AsyncStorage as a fallback only when the native module is missing. Leave backups as they are, or drop `uploadToken` and `#k=` from the snapshot.

## 9. LOW: No app lock

expo-local-authentication is used only to gate Erase (`src/components/SettingsScreen/hooks/useEraseAllData.ts:32-58`,
correctly falling back to passcode). There's no launch lock, no task-switcher blur and no Android `FLAG_SECURE`, so
lyrics are visible in the app switcher and to anyone holding an unlocked phone. That's a product call. If it's wanted:
add an opt-in lock that runs `authenticateAsync` on `AppState` → active after N minutes and shows a paper-colored cover
on `inactive`.

## 10. LOW: Android App Links fingerprint

`server/songnook-send/wrangler.toml:60` lists only the EAS upload-key fingerprint, and the comment itself says Play's
app-signing fingerprint still has to be added. Play installs therefore fail `autoVerify`, and `https://send.songnook.app/t/...#k=` opens
in the browser instead of the app. On Android ≤ 11 the user gets a chooser, where any app claiming the host could
receive the full keyed URL. **Fix:** add the Play App Signing SHA-256 before release.

## 11. LOW: CSP `'unsafe-inline'`

`server/songnook-send/src/pages/shell.ts:271`: `"script-src 'self' 'unsafe-inline'"`. Every untrusted name is written
with `textContent` on the sealed page (`recipient.ts:196-245`), the web sender's list goes through `esc()` (`sender.ts:219,227`),
and the server escapes with `escapeHtml`, so no injection point exists today. It's defense in depth for a page that
holds a decryption key. **Fix:** move the inline scripts to `/static/*.js`, or use per-response nonces.

## 12. LOW: Recovery target guard

`src/services/audioRecovery.ts:50-54` checks only `startsWith(SONG_NOOK_ROOT)`. Unlike `workspaceArchive.ts:76-85`, it
doesn't reject `..` segments, so a manifest `liveUri` of `…/songnook/audio/../../SQLite/songnook.db` passes. The
input comes from the app's own `workspace-archives/` directory, which keeps this LOW. **Fix:** reuse the stricter
guard.

## 13. LOW: Root `wrangler.jsonc` (untracked)

It is `{ name: "songnook", assets: { directory: "dist" }, observability: on }`, which looks like a Cloudflare auto-setup.
`dist/` is an `expo export` (JS bundle and assets, no user data). A stray `wrangler deploy` at the repo root would
publish it on a new public Worker. **Fix:** delete it, or add it to `.gitignore`.

## 14. LOW: Clipboard and logs

- `src/state/useSendJobStore.ts:94` copies the keyed link automatically. Universal Clipboard syncs it to the user's
  other Apple devices, and the clipboard keeps it until overwritten. That's acceptable because the user wants the
  link. Optionally mark it sensitive on Android 13+ (`ClipDescription.EXTRA_IS_SENSITIVE`, needs native) or expire it.
- Release builds strip `console.log` but keep `warn`/`error` (`babel.config.js:9`). Some warnings include file URIs and
  names (`managedMedia.ts` share-temp warnings), and expo-share-intent `Log.i`s every shared name. These end up only
  in device logs.
- Diagnostics (`crashLog.ts`, `persistLog.ts`, `diagnosticsBundle.ts`) stay on the device and leave only when the user
  shares them. Entries are IDs, counts and timings. Error `message`s can carry a clip title or file name (for example
  `Transfer item "${fileName}" is not supported`), which slightly contradicts the policy's "never your recordings or
  lyrics" (titles aren't lyrics). No keys found in any log path.

## 15. INFO: Platform storage

- iOS: no `com.apple.developer.default-data-protection` entitlement and no per-file protection, so everything uses
  CompleteUntilFirstUserAuthentication. That's the right default: background recording and lock-screen playback write
  and read while the phone is locked, which `NSFileProtectionComplete` would break. You could mark finished files
  (DR backups in `songnook/share`) `.complete`, but it's optional.
- Android: everything is in internal CE storage. Public storage is written only through user-chosen SAF or the share
  sheet (`SettingsAboutView.tsx:62-70`). `READ/WRITE_EXTERNAL_STORAGE` come from libraries and aren't used for silent
  writes. `allowBackup="true"` means Google Auto Backup (encrypted by the lock screen on Android 9+, 25 MB cap) holds
  the DB and AsyncStorage (keys, see #8), which the policy discloses.

---

## Solid (verified)

- **SNS1 crypto, all three implementations agree.** AES-256-GCM, 128-bit tag, 12-byte nonce = 7 random bytes per file +
  u32 BE index + last flag. The key is 32 bytes from the CSPRNG (`Crypto.getRandomBytes(32)` / `getRandomValues`). The
  header (record size + prefix) is the AAD, record size is bounded to 1 B..16 MiB, and the layout comes from the file
  size, so truncation at a record boundary fails (that record was sealed `last=0`) and so do appending, reordering and
  bit flips. A 56-bit prefix per file under one key carries negligible collision risk at ≤ 201 seals per key. Openers
  delete partial plaintext on failure (`SongNookSeal.swift:167-171`, `.kt:155-158`). The key is never logged.
- **The `#k=` fragment never reaches the server from the app.** `App.tsx:989-998` moves it into a route param, and
  `fetchTransfer` sends only the id. The web side relies on the fragment never being sent, plus `referrer-policy: no-referrer`.
  Key regexes are strict (`[A-Za-z0-9_-]{43}`).
- **Hostile parcel names can't escape.** Downloads go to `songnook-receive/<itemId>-<name with [^\w.\- ] → _>`
  (`receiveTransfer.ts:313-314`). The download URL is pinned to the service origin and exact path (`:108-125`), sizes
  are checked before and after opening, sealed item names must match `^[1-9][0-9]{0,2}\.sealed$`, the envelope's item
  count must match, and items whose type isn't allowed are refused.
- **Zip import.** Only stored entries are read, `compressed == uncompressed` is enforced, and the archive is capped at
  4 GB, so a zip bomb is impossible. Encrypted entries, data descriptors and ZIP64 are rejected, duplicates refused, the
  manifest entry is size-capped, and CRC is checked for every entry (`storedZipArchive.ts:199-246`). Entry names
  never become paths. Library import writes to `audio/<newId>.<ext>` (`libraryImport.ts:204`). DR restore runs
  `assertSafeBackupMediaPath` (no `/`, `\`, NUL, empty, `.` or `..` segments, prefix allowlist) and refuses to
  overwrite (`disasterRecoveryRestore.ts:357-360`, `overwrite: false`). Workspace restore from a user-picked file
  checks the workspace id and `..`. Symlinks can't be expressed (external attributes ignored). Malformed JSON is
  caught and reported.
- **Nothing imports without a tap.** Deep links map only `home`, `share-import`, and `t/:transferId`. Receive and
  ShareImport both need the user to press Save. Received data lands in Received with fresh ids
  (`libraryImport.ts:545-560`, id maps), so it can't overwrite existing clips.
- **Pairing.** The code has about 29.7 bits (31⁶) and lives 10 min. Per-IP limits are 10/min (binding) and 30/h
  (route). Codes are drawn without modulo bias. Brute-forcing a claim would only give a victim's browser the
  attacker's identity. The secrets come from the server (`pr_`/`bs_`, 24 random bytes) and only their SHA-256 is
  stored. The session is new on completion, so fixation doesn't work. Cookies are
  `HttpOnly; Secure; SameSite=Strict; Path=/api`, and every request re-reads the `browsers` table, so removal revokes
  at once (also a pending browser, `senders.ts:177-187`). The upload token is compared in constant time and stored as
  a hash. IDs are 128-bit.
- **Worker pages** send `nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `form-action 'none'`,
  `no-store`, `noindex`. `.app` is HSTS-preloaded. Content-Disposition follows RFC 6266/5987 and is sanitized. JSON
  data is embedded with `<` escaped.
- **No secrets in the repo, history included.** `appl_…` and `goog_…` in `src/services/billing.ts:26-27` are
  RevenueCat **public** SDK keys, which is fine. The `R2_ACCOUNT_ID`, D1/KV ids and Apple Team ID in `wrangler.toml` are
  not secrets. `.env` (only `EXPO_PUBLIC_SEND_BASE_URL`) and `server/songnook-send/.dev.vars` (local placeholders)
  are gitignored and were never committed. Real secrets (R2 keys, `REVENUECAT_SECRET_KEY`, `ANTHROPIC_API_KEY`,
  `DATAMUSE_KEY`, `BENYEHUDA_KEY`) are `wrangler secret`s only.
- **Third parties match the policy.** Word Finder sends a single word plus the user's theme words, never lyrics
  (`wordTools.ts:772,847,876`). Datamuse, OpenThesaurus and Gutendex/Gutenberg are called straight from the device and
  see its IP. Hebrew goes through our worker to Anthropic and Dicta. RevenueCat is configured with only the public key.
  There's no analytics or crash SDK.

## Side note (minor)

- Pairing phishing: someone can get a victim to type the attacker's code into the app. The attacker's browser then
  sends as the victim (quota, Pro) but can't read anything, and it shows up in the victim's browser list.
- `x-songnook-rc` comes from the client (`senders.ts:67`). Once `PRO_FOR_ALL=false`, anyone who knows a paying user's
  RevenueCat id gets Pro on Send. This is billing integrity, not data. Consider binding the RC id the first time it's
  seen per sender.
