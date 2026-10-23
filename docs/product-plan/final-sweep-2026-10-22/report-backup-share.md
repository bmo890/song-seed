# Audit — BACKUP / EXPORT / IMPORT / SHARING / SEND (incl. `server/songnook-send`)

Scope as briefed. Read-only. Every finding below was traced from a real caller; items I could
not trace end-to-end are marked **unverified**. Line numbers are from the tree at audit time.

Counts: **P1 × 2 · P2 × 10 · P3 × 14** (+ a "verified OK" list and a dead/duplicate-code list).
`[SMALL-WIN]` = ≤ ~15 lines, no behaviour change beyond the fix.

---

## P1 — should fix before launch

### 1. Receive side refuses any item over 512 MB although sender + server allow 1 GB
- **Severity P1 · confidence high**
- `src/services/receiveTransfer.ts:45` — `const MAX_ITEM_BYTES = 512 * 1024 * 1024;`
  vs `src/config/sendService.ts` (`SEND_MAX_ITEM_BYTES = 1 GB`, "raised from 512 MB 2026-10-14")
  and `server/songnook-send/wrangler.toml:21` (`MAX_ITEM_BYTES = 1 GB`).
- What happens: a collection/workspace parcel that packs to e.g. 700 MB is sealed and the
  sender gets a link; the recipient's app calls `validateTransferPayload` → throws
  `SendTransferError("Transfer item size is invalid.")` → `TransferReceiveScreen` shows the
  generic "couldn't open" state. The web recipient page still works, so the two sides disagree.
- Fix `[SMALL-WIN]`: import `SEND_MAX_ITEM_BYTES` / `SEND_MAX_TRANSFER_BYTES` from
  `../config/sendService` in `receiveTransfer.ts` and delete the two local constants.

### 2. Server per-IP rate limit is a KV read-modify-write — not atomic, eventually consistent
- **Severity P1 (internet-facing abuse control) · confidence high**
- `server/songnook-send/src/lib/guard.ts:43-46` — `RATE.get` then `RATE.put(current+1)`.
  Workers KV is eventually consistent (≈60 s propagation across edges) and the increment is
  not atomic, so N parallel `POST /api/transfers` from one IP all read `0` and all pass. The
  README calls this out as "approximate", but it is the *only* anti-abuse control until
  Turnstile/App Attest (not built). Combined with:
  - `src/routes/api.ts:124-147` TOCTOU on `MAX_ITEMS_PER_TRANSFER` and `size_total` (count and
    sum are read, then `insertItem` + `bumpTransferSize` run later), concurrent item
    registrations exceed the 200-item / 1 GB draft caps. Finalize re-verifies real bytes, so a
    *finalized* transfer cannot exceed caps, but a *draft* can hold far more than 1 GB for the
    24 h until the sweep.
  - Presigned PUTs sign `content-length`, so each object is bounded by its declared size — good —
    but the number of objects per IP is only bounded by this KV counter.
- Fix: use the Workers Rate Limiting binding (`[[unsafe.bindings]] type="ratelimit"`, atomic,
  per-colo) or a Durable Object counter; for the caps, make the item insert conditional in SQL
  (`UPDATE transfers SET size_total = size_total + ? WHERE transfer_id = ? AND size_total + ? <= ?`
  and check `meta.changes`). Not small.

---

## P2 — fix soon (several are small)

### 3. Library-archive import: no free-space guard, and extracted audio is orphaned on failure
- **P2 · high** — `src/services/libraryImport.ts:195` (`extractManagedArchiveAudio` writes
  straight into `SONG_NOOK_AUDIO_DIR`), `materializeSongNookArchiveMerge` (same file, ~l.433).
- Export, backup and DR-restore all call `ensureBackupDiskSpace` before writing
  (`libraryExport.ts:297`, `disasterRecoveryBackup.ts`, `disasterRecoveryRestore.ts`); the
  share/received import path does not. On a nearly-full phone a 1 GB parcel extracts N files,
  then throws a raw native ENOSPC mid-way; nothing deletes the files already written, and the
  store never references them. Reachable from Settings → Import, share-intent, and
  `TransferReceiveScreen` (whose catch only deletes *workspaces*, which don't exist yet at that
  point). Whether the startup integrity scanner later reclaims unreferenced audio: **unverified**.
- Fix: before the loop, sum `parsed.archiveIndex.entries` sizes referenced by the manifest and
  call `ensureBackupDiskSpace(total, "restore")`; wrap the materialize loop in try/catch that
  deletes every URI written so far (collect them in `sourceDestinations` + a `written[]` list).

### 4. Workspace-archive restore: path traversal via a crafted package manifest
- **P2 · high (narrow exposure)** — `src/services/workspaceArchive.ts:353-354`
  `targetUri = rebaseManagedUri(file.liveUri); assertManagedRestoreUri(targetUri)`;
  guard is `storagePaths.ts:26` `isSongNookManagedUri` = `startsWith(root + "/")`.
- `file.liveUri` comes from `manifest.json` inside the zip. A value like
  `file:///…/Documents/songnook/audio/../../SQLite/songnook.db` passes `toRelativeManagedPath`
  (it starts with `songnook/`) and the `startsWith` check, then `extractRangeNative` writes
  through the `..`. Reachable through the user-picked "restore offloaded workspace" path
  (`src/state/actions.ts:3203`, `overrideArchiveUri`); the attacker needs the stub's workspace
  id to pass `verifyArchiveFile`, so this is "malicious replacement of a package the user
  offloaded to their own cloud", not a drive-by — but the DR restore already solved this
  properly (`disasterRecoveryValidation.ts assertSafeBackupMediaPath`).
- Fix `[SMALL-WIN]`: in `restoreWorkspaceFromDevice`, reject `file.liveUri`/`file.archivePath`
  whose segments contain `..`, `.`, `\`, `\0` or an empty segment, and require
  `toRelativeManagedPath(targetUri)` to start with `songnook/audio/` or
  `songnook/preview-audio/` (reuse `assertSafeBackupMediaPath`).

### 5. `createShareLink` never deletes the packed `.songnook` it uploaded
- **P2 · high** — `src/services/shareLink.ts:107-125`: `prepareLibraryExportArchive` writes
  to `SONG_NOOK_SHARE_DIR`; `exportLibrary` (`libraryExport.ts:338`) cleans up in `finally`,
  but the link path returns `prepared` and never calls `cleanupShareTempFile`. A 600 MB parcel
  therefore sits in `songnook/share/` (Settings → Storage counts it as "temporary exports")
  until the next cold launch's 24 h sweep (`App.tsx:1270`). Same for the `TooLargeShareError`
  and cancel branches.
- Fix `[SMALL-WIN]`: wrap steps 3–5 in `try { … } finally { await cleanupShareTempFile(prepared.archiveUri); }`.

### 6. Download `Content-Disposition` with a non-Latin-1 (Hebrew) file name
- **P2 · med** — `server/songnook-send/src/routes/download.ts:47,91`. `sanitizeFilename`
  only strips `\r \n " \\`; the app sends clip titles as file names
  (`clipShareLink.ts` via `sanitizeArchiveSegment`, which keeps Hebrew). HTTP header values
  are ByteStrings: `Headers.set` with code points > 0xFF either throws (→ 500 for that
  download) or ships mojibake, depending on the runtime. Either way a Hebrew-titled clip's
  "Download" on the recipient page is wrong. Not run against workerd — hence med.
- Fix `[SMALL-WIN]`: emit `filename="<ascii-fallback>"; filename*=UTF-8''<encodeURIComponent(name)>`.

### 7. Long library operations stall when the phone auto-locks
- **P2 · med** — `src/components/LibraryProcessHost.tsx` / `SendLinkSheet.tsx` (`SendJobHost`)
  do not activate keep-awake; `expo-keep-awake` is already a dependency and used elsewhere
  (`src/hooks/useKeepAwakeWhileFocused.ts`). Backup/export/restore/receive are JS-driven loops
  (native per-file passes, but the loop and the process UI live in JS). iOS suspends the JS
  thread ~30 s after the screen locks, so a 10-minute backup left on the table sits at N% until
  the user unlocks; a restore that was in "committing" is safe (journal), but uploads already
  use a BACKGROUND URLSession while downloads (`createDownloadResumable`) do not.
  No background task/resume exists (the send job is explicitly transient; "Try again" restarts
  from zero including re-encoding).
- Fix `[SMALL-WIN]`: `useKeepAwake()` (or `activateKeepAwakeAsync` tag) while
  `process.status === "running"` / `job.status === "running"`.

### 8. User-facing English leaks (i18n) on the backup/share paths
- **P2 · high**
  - `src/components/SettingsScreen/hooks/useLibraryImportFlow.ts:84` shows
    `result.warnings.slice(0,6).join("\n")` — strings built in `libraryImport.ts:222` et al.
    ("Missing archived audio for …") and `libraryExport.ts` ("Missing clip audio for …").
  - `src/services/shareLinkFlow.ts:27` shows `err.message` of any `SendTransferError`
    verbatim — these are English sentences from `sendTransfer.ts`/`receiveTransfer.ts`
    ("Couldn't reach the transfer service (…)", "Upload rejected (413)") and raw server error
    bodies ("file type ".opus" is not accepted…").
  - `src/services/storageDetails.ts:187-199` `limitations` are English sentences rendered in
    `SettingsStorageView.tsx:207-210`.
  - `storedZipArchive.ts` `progressMessage ?? "Processing backup"` fallback.
- Fix: route each through `t()` with a code (the DR restore path already does this well via
  `DrRestoreErrorCode`); for `SendTransferError` add a `code` and map in `describeShareLinkError`.

### 9. First-launch pasteboard read shows the iOS "pasted from …" banner to every new user
- **P2 · med (store-review / privacy)** — `src/services/clipboardTransferCheck.ts:37-38`,
  called once at launch from `App.tsx:1436` (not on every foreground — the premise in the
  brief is false; it is iOS-only, one-shot per install, and guarded by `hasStringAsync`).
  But `hasStringAsync` is true whenever *anything* textual is on the pasteboard, so for most
  users the very first launch reads the full clipboard (passwords, messages) and iOS shows
  "SongNook pasted from X". Apple has questioned apps for unexplained clipboard reads.
- Fix: defer the read behind an explicit affordance on the welcome flow ("Opened a link
  before installing? Paste it") or at minimum add the justification to App Review notes.
  Erase-all clears the once-flag (`AsyncStorage.clear()`), so the banner can recur after an
  erase — acceptable, note it.

### 10. Design-rule violations in in-scope components (hard rules in CLAUDE.md)
- **P2 · high · all `[SMALL-WIN]`**
  - `src/components/ImportProgressBanner.tsx:70` `color: "#3F9C82"` — the green "success" tick
    that `LibraryProcessHost.tsx` says was retired; `:145` `shadowColor: "#3D3732"`.
  - `src/components/common/RestoreRestartGate.tsx:129` `rgba(28,28,25,0.55)` scrim literal.
  - `src/components/common/SendLinkSheet.tsx:28` and `ReceivedParcelSheet.tsx:27`
    `SHEET_EXIT_MS = 260` — a numeric motion literal duplicated twice; should be a `durations` token
    (or `BottomSheet` should expose its exit duration / an `onClosed` callback).
  - `src/components/ClipboardBanner.tsx:29` ad-hoc `{ opacity: disabled ? 0.4 : 1 }` and legacy
    `styles.primaryBtn` instead of `Button`.

### 11. Nightly sweep is capped at 500 rows and aborts on the first R2/D1 error
- **P2 · high · `[SMALL-WIN]`** — `server/songnook-send/src/lib/db.ts:132` (`limit = 500`),
  `src/lib/sweep.ts:14`. If more than 500 transfers expire per day (or one `BUCKET.delete`
  throws) the backlog grows indefinitely — expired-but-undeleted objects are still
  unreachable (gated by `expires_at`), so this is cost, not exposure.
- Fix: loop `while (batch.length === limit)`, `try/catch` per transfer, log and continue.

### 12. Receive: "Stop" does not cancel the in-flight download; rollback leaves compilations
- **P2 · med** — `src/components/TransferReceiveScreen/index.tsx:206` and the
  `if (abortRef.current) throw` right after: `downloadTransferItem` takes no signal, so after
  the user confirms "Stop saving" the current item (up to 1 GB) keeps downloading to completion
  before the loop notices. The comment above the audio batch ("Four downloads run at once…") is
  stale — the loop is sequential. On any failure the catch deletes received *workspaces* for
  this `transferId`; a setlist/songbook/playlist created by an earlier `.songnook` item in the
  same parcel is **not** removed (whether `deleteWorkspace` cascades compilation entries:
  **unverified**).
- Fix: accept `signal` in `downloadTransferItem` → `download.cancelAsync()`; delete compilations
  whose `received.transferId` matches in the catch.

---

## P3 — nice / hygiene

13. **Server: `POST /api/transfers` with a JSON body of `null`/primitive → 500**
    (`api.ts:70` uses raw `body.title`; items/finalize correctly use `bodyRecord`). `[SMALL-WIN]`
14. **Server: legacy no-hash token bypass still live** (`uploadToken.ts:54`
    `if (!transfer.upload_token_hash) return true`). Migration 0002 is applied and any
    pre-migration row expired weeks ago; remove the bypass. `[SMALL-WIN]`
15. **Server: no `x-content-type-options: nosniff` on JSON/download responses**
    (`http.ts:15`, `download.ts`). Content types are allow-listed and downloads are
    `attachment`, so low risk. `[SMALL-WIN]`
16. **Server README drift** (`README.md:63` says 512 MB/file; `wrangler.toml:21` is 1 GB;
    `README.md:102` "Still needed from the app team" — both values are already set). `[SMALL-WIN]`
17. **Upload ceiling timer never cleared / task not cancelled on timeout**
    (`sendTransfer.ts:136-141` `Promise.race` with a 15-min `setTimeout`): on success the timer
    lingers 15 min; on timeout the background upload continues while the UI reports failure and
    "Try again" starts a new transfer (old draft swept in 24 h). `[SMALL-WIN]`: `clearTimeout`
    in `finally`, `task.cancelAsync()` on timeout.
18. **Draft + rate-limit slot burned before the parcel is known to be sendable**
    (`shareLink.ts:86-97,125`): `createTransfer` runs first (needed to stamp `transferId`), so
    an empty selection or an over-cap parcel leaves an orphan draft. Run
    `estimateLibraryExportArchive` + `assertWithinCaps` *before* create (rough) and keep the
    exact check after.
19. **`.opus` / `.wma` / `.mid` clips cannot be sent as a link** — `shareImport.ts:11-18`
    accepts them as audio and `audioStorage.ts:629-644` keeps the source extension; the server
    allow-list `contentPolicy.ts:13` (mirrored in `receiveTransfer.ts:49`) lacks them → 415
    with an English body (see #8). Decide: encode these to m4a on link, or add them server-side.
    **med** (not run on device).
20. **Hidden ideas travel in shares** — `ideasShare.ts:20`, `sketchShare.ts:15`,
    `placeShare.ts:33` all set `includeHiddenItems: true` ("a place share is a true snapshot").
    A collection a user curated by hiding half of it arrives at the bandmate with the hidden
    half visible. Product call, flagging only.
21. **Manifest entry cap is 128 MB** (`storedZipArchive.ts:26`, used by
    `libraryImport.ts:396` `JSON.parse(strFromU8(...))`). A hostile `.songnook` with a 100 MB
    `manifest.json` will OOM Hermes before validation. Use a separate ~16 MB cap for
    `manifest.json`/`workspace.json`. `[SMALL-WIN]`
22. **`ArchiveShareDeclaration.appVersion` is never populated** (`libraryArchiveManifest.ts:286`;
    none of the six builders set it, though `transfer-service-brief.md` §5 lists it). `[SMALL-WIN]`
23. **Draft-vs-expired status oracle** — `/t/:id` and `GET /api/transfers/:id` return 404 for
    draft/unknown and 410 for expired; with 128-bit ids this is academic. No change needed; noted.
24. **Download endpoint has no rate limit** (by design: link = capability). Worker request cost
    is the only exposure; note for the Turnstile/attestation milestone.
25. **Stale comment** in `TransferReceiveScreen` ("Four downloads run at once") — see #12.
26. **`isArchiveItem` accepts `.zip`** (`receiveTransfer.ts` ~l.233) but the server refuses
    `.zip` at registration — dead branch. `[SMALL-WIN]`

---

## Verified OK (so nobody re-audits these)

- **Zip import, path traversal**: `storedZipArchive.indexStoredZipArchive` only ever uses entry
  names as `Map` keys; `libraryImport` writes to `${SONG_NOOK_AUDIO_DIR}/${generatedId}.${ext}`
  where `ext` is `[a-zA-Z0-9]+`; `receiveTransfer.downloadTransferItem` sanitizes names and
  validates `itemId`/`transferId` patterns and same-origin `downloadUrl`; DR restore validates
  every media path against safe prefixes and `..`/`\`/`\0` and rejects unexpected zip entries.
  Only the workspace-archive path (#4) lacks the check.
- **Zip bombs**: only STORED entries are accepted (compression → "cannot restore safely"),
  sizes are checked against the archive size, ZIP64/encrypted/data-descriptor/duplicates
  rejected, so extracted bytes ≤ archive bytes ≤ 4 GB. Memory stays bounded (chunked).
- **Manifest id collisions**: `materializeSongNookArchiveMerge` re-ids every workspace,
  collection, idea, clip, stem, group, note, songbook/setlist/playlist and remaps references;
  dangling refs are dropped. `received`/`origin` from the manifest are harmless.
- **Missing files**: import warns and continues (`audioMissing`), DR restore refuses an
  incomplete backup unless the user opts into salvage (`allowIncomplete`), and the salvage
  drops exactly the items whose audio the backup recorded as missing.
- **Merge restore** (`libraryMergeRestore.ts`): current wins on id collision, restored-only
  items appended, moved items not duplicated, returned layers come back muted, lyric versions
  slot by date behind the latest; nothing is dropped or quarantined. Snapshot taken at commit
  time after persistence is blocked.
- **DR restore atomicity**: verify everything → write to token-scoped dirs → SHA-256 verify →
  block persistence → commit snapshot last → journal → forced restart; a kill at any point
  leaves either the old library or the new one, and startup cleanup reconciles the journal.
- **Backup**: read-only w.r.t. the live library; native single pass is self-checked against the
  JS hash on the first file; ZIP32 limits asserted up front; temp dir swept after 24 h.
- **Erase-all**: two destructive dialogs + device biometric/PIN when enrolled; persistence
  frozen first; SQLite write queue drained before the DB is deleted.
- **"Remove original" after import**: `pickedCopies.ts` deletes only files inside the app's
  own picker cache folders and only those tagged `discardSourceAfterImport`; originals in
  Photos/Files are never touched.
- **Clipboard**: iOS only, once per install at launch, `hasStringAsync` before the read, never
  silent (confirm dialog) — see #9 for the residual.
- **Share links — what leaves the device**: the full-fidelity `.songnook` (every take incl.
  pre-edit sources and overdub stems, all lyric versions with chords, chord sheets, notes,
  marks, sections, tags, groups, grids, edit regions, `analysis`, `keptPractice`,
  `received` provenance of nested parcels, `ideasListState`, the `share` block with typed
  sender name, `manifest.scope` ids, `export-report.json` warnings) or, for clips, one AAC
  file per clip. `libraryPreferences` (incl. Bluetooth calibrations with headphone names) is
  **not** included by the share builders (they omit `libraryPreferences`). Transit TLS;
  at rest Cloudflare R2 default encryption — no end-to-end encryption, the operator can read
  parcels; no revoke in v1 (documented).
- **Link entropy**: `t_` + 128-bit CSPRNG base62; items 64-bit scoped to a transfer; metadata
  and downloads are unauthenticated by design and unenumerable in practice.
- **Server secrets**: only `R2_ACCESS_KEY_ID/SECRET` as Worker secrets; `.dev.vars` gitignored;
  the app embeds only `https://send.songnook.app` (dev → localhost, UI gated by
  `isSendServiceConfigured`). Account/DB/KV ids and Apple Team ID in `wrangler.toml` are not secrets.
- **SQL**: every D1 query is parameterised (`db.ts`).
- **XSS**: all user strings pass `escapeHtml` on both SSR pages; CSP with `frame-ancestors 'none'`,
  `referrer-policy: no-referrer`, `X-Frame-Options: DENY`; the inline iOS script embeds only a
  server-generated id. `'unsafe-inline'` scripts are needed by the current structure (noted).
- **Upload auth**: separate `uploadToken` (SHA-256 hashed, constant-time compare) gates
  items/finalize; presigned PUT signs `content-type` + `content-length`, 1 h TTL; finalize HEADs
  every object and magic-checks `.songnook`.
- **CORS**: `*` on cookie-less JSON (by design); write endpoints additionally require an
  allow-listed `Origin` or none.
- **Audio re-encoding for links** runs in the native trim renderer (AVAssetExportSession /
  Media3 Transformer), sequentially, off the JS thread; the JS side only orchestrates.
- **Progress/cancel**: AbortSignal threads through zip, encode, upload, restore; progress
  commits are throttled to ~4 Hz in both stores; the upload task is a background URLSession.

---

## Dead code & duplicated helpers

- `src/domain/linkAudio.ts:23` `clipAudioUris` — exported, no non-test caller.
- `src/services/streamingIntegrity.ts:24` `IncrementalSha256` — only used by
  `IncrementalBase64Sha256` in the same file; export unnecessary.
- `receiveTransfer.ts isArchiveItem` `.zip` branch — unreachable (see #26).
- `ShareArgsOverrides` / `ShareLinkParcel` live in `setlistShare.ts:9-16` and are imported by
  `playlistShare`, `songbookShare`, `sketchShare`, `ideasShare`, `placeShare`, `clipShareLink` —
  wrong home; they belong in `shareLink.ts`.
- The `share:` block literal is hand-written five times (`setlistShare`, `playlistShare`,
  `songbookShare`, `sketchShare`, `ideasShare`); `placeShare.ts:41` already has `shareBlock()`.
- `IDEAS_SHARE_OPTIONS` / `SKETCH_SHARE_OPTIONS` / `PLACE_SHARE_OPTIONS` are byte-identical
  (`ideasShare.ts:20`, `sketchShare.ts:15`, `placeShare.ts:33`).
- `hasSomething` duplicated (`ideasShare.ts:29` vs inline in `sketchShare.ts:28`); the
  synthetic one-collection workspace lift is duplicated (`ideasShare.ts:58`, `sketchShare.ts:37`).
- Seven `createXShareLink` wrappers and seven `shareXFile` wrappers have identical shape — a
  `makeShareFlow(kind, buildArgs)` factory would collapse ~200 lines.
- `SHARE_KINDS` is declared three times (`receiveTransfer.ts:50`, `sentLinks.ts:43`,
  server `shareKind.ts`) with two `normalize*` twins; `AUDIO_EXTS`/`extensionOf`/`isRecord`
  are each defined 2–3 times across `receiveTransfer.ts`, `disasterRecoveryValidation.ts`,
  `archiveKind.ts`, server `contentPolicy.ts`.
- UI: `KIND_ICONS` identical in `ReceivedScreen/index.tsx:27` and `ReceivedParcelSheet.tsx:29`;
  `useSecondTick` in `LibraryProcessHost.tsx:36` and `SendLinkSheet.tsx:202`;
  `formatBytes`/`daysUntil` re-implemented in `TransferReceiveScreen/index.tsx:86,92`,
  `SendLinkSheet.tsx:30`, `SentLinkChip.tsx` while `utils.formatBytes` exists.
- `ClipboardBanner.tsx` is the copy/move selection bar, not pasteboard-related — misleading name
  for anyone grepping the clipboard feature.
- Test coverage is good for the pure/service layer (28 suites in scope incl. round-trips,
  merge restore, DR backup/restore, receiveTransfer, shareLink, zip writer). Gaps:
  `workspaceArchive` traversal (#4), `libraryImport` failure cleanup (#3), server `api.ts`
  routes (only `lib/*` has tests), `TransferReceiveScreen` abort.

---

## Feature inventory (what a user can do in this scope)

- Settings → Backup → **Back up now**: exact checksummed `.songnook-backup.zip` → Files share
  sheet (iOS) / SAF folder (Android); progress takeover with Minimize / Cancel; "Did you save it?" prompt.
- Settings → Backup → **Restore**: pick backup → Replace everything / Merge (keep newer) →
  salvage offer for incomplete backups → forced restart gate.
- Settings → Backup → reminder frequency (nag at launch when overdue).
- Settings → Export library: SongNook Archive (standard / full fidelity, size estimate) or plain
  zip; scope by workspace/collection; notes/lyrics/hidden toggles.
- Settings → Import archive: pick `.zip`/`.songnook` → preview → import (re-id'd merge);
  backup files redirected to Restore.
- Settings → Sharing: list of links you sent (days left, copy, forget), remembered sender name.
- Settings → Storage: storage report, **Erase everything** (2 dialogs + device auth).
- Settings → About: share diagnostics bundle (crash log + persistence journal).
- Collection / workspace / sketch / selection "…" → **Share as file** (`.songnook` via OS sheet)
  or **Get a link** (Send sheet: title, from, note, order for clips → seal pill → link copied,
  Copy / Share / Try again).
- Setlist / Songbook / Playlist "…" → same two actions; on-entity "Link active · N days" chip.
- Clip selection → Get a link (AAC-encoded loose files) / share files.
- Open a `send.songnook.app/t/…` link (universal link, `songnook://t/…`, first-launch
  pasteboard offer) → Transfer screen: preview each file, size warning ≥150 MB, Save → lands as
  a Received parcel or as a playlist/setlist/songbook.
- Share-intent (files shared *to* SongNook): audio/video → choose destination collection /
  new collection / song project, duplicate review, date preference; `.songnook`/zip → Received.
- Welcome flow: bring your recordings → "Imported" collection.
- Received page: parcel rows (unopened dot), parcel sheet (Keep / Look first / Somewhere
  else…), multi-select Move / Delete, link to sent links.
- Web (`send.songnook.app`): drag-drop sender page with ordering, kind (Files/Playlist/Setlist),
  recipient page with QR / store button, raw downloads; `/privacy`, `/terms`, `/report/:id`.
