# 12H: Send service, web pages, and the app's send/receive surfaces

Sweep H, 2026-11-02. Read-only. Scope: `server/songnook-send/**` (routes, lib, pages, migrations, wrangler.toml) and, in the app, `sendTransfer.ts`, `shareLink.ts`, `shareLinkFlow.ts`, `receiveTransfer.ts`, `sendSeal.ts`, `sendIdentity.ts`, `useSendJobStore.ts`, `useSendSheetStore.ts`, `useSentLinksStore.ts`, `sentLinks.ts`, `sendProgress.ts`, and the screens that drive them: `SendLinkSheet.tsx` (sheet, pill, job sheet), `SettingsSharingView.tsx` (Sent links), `SettingsComputerView.tsx` (pairing), `SentLinkChip.tsx`, `TransferReceiveScreen/index.tsx`, `useParcelPreview.ts`.

No live server was called. Evidence comes from:
- reading every file listed at the end;
- the server's own tests: `node --experimental-strip-types --test src/lib/__tests__/*.test.ts`, 41/41 pass;
- a scratch harness that runs the real Hono `api` and `download` routes and `sweepExpired` against an in-memory SQLite stand-in for D1 (the real migrations) and a Map stand-in for R2 (7 probes, in the session scratchpad, not the repo);
- scratch jest tests under `src/__audit_scratch_H__/` (5 tests, deleted afterwards).

Already reported elsewhere, so not repeated here: 04-M4 (a failed re-receive deletes earlier kept compilations), 04-H1/H2 (Keep / edits inside received parcels), 06 #4/#6/#7/#8 (parcel validation, parcel writes into own spaces, slot swap, token and key storage), 06 #9 (Play App Signing fingerprint), 06 #13 (stray `wrangler.jsonc`), 05-E11 (iOS seal autorelease), 07-L3 (outbox pruned by the phone's clock), 02-G11 (send prefs not in the satellite list).

## Summary

| ID | Sev | Finding | Confidence |
|---|---|---|---|
| H-1 | **HIGH** | A sealed parcel holding an .opus, .wma, .mid or .midi file (all importable, all kept with their extension) or, from the web, any `audio/*` file with another extension: the sender is told "Link ready", and the recipient's app refuses the **whole** parcel. "Try again" loops. | verified by scratch test |
| M-1 | MEDIUM | Finalize has no retry, and the 8 s JSON timeout covers a finalize whose server work grows with item count. The app says "Couldn't reach SongNook Send" while the link may be live. The key and upload token are dropped: unshareable, undeletable, and counted against the free links once enforced. The web page says "Nothing was sent". | verified (code); latency plausible |
| M-2 | MEDIUM | Missing-media warnings are dropped at both ends. The sender gets "Link ready" when takes were left out of the archive. The recipient gets "Saved" plus the success haptic when the archive lacked audio. Settings export/import do show these warnings. | verified by reading |
| M-3 | MEDIUM | A web parcel mixing a .songnook with real loose audio: the app keeps only the .songnook, and the browser page hides the .songnook. Each side silently drops part of what was sent. | verified by scratch test |
| M-4 | MEDIUM | The upload has an absolute 15-minute ceiling, so a parcel over about 250–300 MB fails every time on a 2–3 Mbps uplink, and "Try again" fails the same way. | verified by reading |
| M-5 | MEDIUM | A kill during a loose-audio receive leaves an empty received package stamped with the transferId. The link then says "Already saved", and the audio already copied into `songnook/audio` is unreferenced. | plausible |
| L-1 | LOW | Cancel during "Sealing…" (finalize in flight): the pill goes as if cancelled, but the link goes live and lands in Sent links. | verified by scratch test |
| L-2 | LOW | Receive "Stop" isn't honoured during the import step. It saves anyway, toasts "Saved", and navigates away, while the copy says "What's downloaded so far is discarded". | verified by reading |
| L-3 | LOW | "Remove from list" doesn't say that it throws away the only copy of the link's key and the ability to delete the link. | verified by reading |
| L-4 | LOW | The server checks the free-link allowance at create but counts it at finalize: parallel drafts overshoot, and concurrent finalizes double-count. | verified by harness |
| L-5 | LOW | DELETE during an in-flight presigned PUT leaves an R2 object with no row. The sweep walks D1 only, so it is never removed, and there is no R2 lifecycle backstop. | verified by harness |
| L-6 | LOW | Web sender failure paths: raw JSON in the message, stale ✓/% marks under "Nothing was sent", no up-front 200-file / 1 GB check, no leave-page guard, whole-file sealing in memory. | verified by reading |
| L-7 | LOW | Web "Unpair this browser" stays live mid-send. It hides the panel, and the finished link (the only place its key exists) renders hidden. | verified by reading |
| L-8 | LOW | A sealed preview and Save of the same item share cache paths, so Save can fail. The native open writes in place, which gives a narrow window for a truncated import. | plausible / speculative |
| L-9 | LOW | A second Send link opened while a receive is saving resets the guards on the same mounted screen. The first save runs on invisibly and can wipe the second's downloads. | plausible |
| L-10 | LOW | "Try again" re-sends the snapshot captured when the sheet opened, ignoring later edits. | verified by reading |
| L-11 | LOW | A clipboard failure still toasts "Link copied" (job, chip, web). The Sent-links copy has an unhandled rejection. | verified by reading |
| L-12 | LOW | Smaller honesty gaps: pairing errors other than 404 read as "offline"; a receive save failure is titled "Couldn't open the transfer"; on iOS, leaving the app for more than 30 s mid-receive cancels on return; a sealed file under 1 GB that seals to over 1 GB reads "refused (413)"; preview copies stay in cache; the Send sheet's note is dropped on swipe-dismiss; the first-use send-key race. | verified by reading / speculative |

Nothing here is CRITICAL. No path loses the sender's own library content: Send only reads the library, and every receive failure path rolls back (`TransferReceiveScreen/index.tsx:378-398`). The risks are dishonest outcomes ("ready" or "saved" when it isn't, or "failed" when it went live), links that can't be reached, and silent omissions.

---

## HIGH

### H-1. A sealed parcel with a file outside the receiver's audio list: the sender is told "Link ready", and the recipient's app refuses all of it

- **Where:**
  - The server can't see sealed names. It only checks `N.sealed` (`server/songnook-send/src/routes/api.ts:181-182`):
    ```ts
    if (transfer.sealed === 1) {
      if (!isSealedItemName(fileName)) return errorResponse(415, "a sealed parcel takes only sealed items");
    ```
  - The recipient app validates every real name from the envelope against a fixed list, and throws for the whole parcel (`src/services/receiveTransfer.ts:56, 235-237`):
    ```ts
    const AUDIO_EXTS = new Set(["m4a", "mp3", "wav", "aac", "flac", "ogg", "oga", "aif", "aiff", "caf"]);
    ...
    if (!isSupportedTransferItem(fileName, mimeType)) {
      throw new SendTransferError(`Transfer item "${fileName}" is not supported.`, undefined, "unsupportedItem");
    ```
  - Validation runs **before** `withoutBrowserCopies` (`receiveTransfer.ts:281`). A sketch, setlist or collection parcel is refused even when the odd file is only a browser copy that the app would have discarded.
  - The app's library can hold these extensions:
    - Share intake accepts `opus`, `wma`, `mid`, `midi` (`src/services/shareImport.ts:5-19`).
    - `managedMedia` keeps the source extension (`audioStorage.ts:375-377, 629, 644`; only video and AIFF are converted).
    - `clipFiles` names the upload by that extension (`clipShareLink.ts:21`).
    - `losslessAudioToEncode` re-encodes only lossless takes, so opus/wma pass through untouched.
  - The web sender admits any file whose MIME type starts with `audio/`, whatever its extension (`server/songnook-send/src/pages/sender.ts:211-217`): .opus, .webm, .mp4, .m4b, .weba.
- **Steps:**
  1. A bandmate's WhatsApp voice note (.opus) is shared into SongNook, or a voice memo is exported as .mp4 audio and dropped on the web page.
  2. Send it, alone or inside a sketch or set (each take rides as a browser copy, `parcelShare.ts:80,131`).
  3. The sender sees "Link ready, copied".
  4. The recipient taps the link in the app and gets "Couldn't open the transfer" with **Try again**. `unsupportedItem` isn't in `isFinalOpenError`, so it is retryable, and every retry fails.
  - In an old unsealed build the server rejected this at registration (415) and the sender heard about it. Sealing moved the check past the point where anyone tells the sender.
- **Evidence:** scratch tests `sealed sketch: archive + an .opus browser copy -> whole parcel refused` and `sealed loose clips with one .mid file -> whole parcel refused` both pass.
- **Fix:**
  - Before sealing, check each real name against the receiver's list. Re-encode .opus/.wma to AAC the way lossless takes are, or refuse with a sentence.
  - On receive, run `withoutBrowserCopies` before validating, skip unsupported loose files with a count instead of failing the parcel, and add `unsupportedItem` to the final (no Try again) codes.
  - Align the web page's `allowed()` with the extension list.

---

## MEDIUM

### M-1. Finalize: one attempt, an 8 s budget, and a dropped key on any failure

- **Where:**
  - Every JSON call shares one timeout (`src/services/sendTransfer.ts:63`): `const JSON_TIMEOUT_MS = 8000;`.
  - `finalizeTransfer` is a single `postJson` (`:216-226`).
  - `createShareLink` and `uploadFiles` call finalize once and only record the link after it returns (`shareLink.ts:196-211, 324-337`). The `uploadToken` and the `ParcelSealer` key live only in memory.
  - Server finalize runs sequentially: per item a `BUCKET.head`, plus for a sealed item a ranged `BUCKET.get` (`api.ts:253-293`). Then the D1 update and `recordSend` run as separate statements (`:302-304`).
  - Every sealed app parcel has N+1 items, because each take also rides as a browser copy.
- **What happens:**
  - A 30–40-song setlist sent far from the R2/D1 region needs 60–80 sequential R2 round trips plus D1. That can pass 8 s, and the app reports `unreachable`. Either:
    - (a) the Worker finished: the link is live for 7 days, in nobody's outbox, its key is gone, and Delete link is impossible; or
    - (b) the Worker was cut off: Try again re-packs and re-uploads everything, and can time out again.
  - Same result when `recordSend` throws after `finalizeTransfer` succeeded (server 500, link live), or the response is lost on a flaky network.
  - The server's finalize **is** idempotent: already-finalized returns the `shareUrl` (`api.ts:238-240`). The client never uses that.
  - The web sender has the same hole. A lost finalize response shows "Sorry — … Nothing was sent; try again" (`sender.ts:405-408`), and the retry mints a new key and a second live parcel.
- **Evidence:**
  - Scratch test `finalize times out client-side: nothing recorded, upload token gone` passes.
  - The finalize cost is from code. The latency is unmeasured, so (a) versus (b) and the item count where it breaks are plausible, not measured.
- **Fix:**
  - Give finalize its own timeout (60 s) and retry it, with the same token, on timeout/5xx before failing.
  - Record a "pending" outbox entry (transferId, token, key) before finalize, and clear or confirm it after.
  - On the server, run the HEAD/GET checks in parallel and put `finalize` + `recordSend` in one `DB.batch`.
  - On the web, retry finalize before saying "Nothing was sent".

### M-2. Missing-media warnings are thrown away on both ends

- **Where:**
  - `prepareLibraryExportArchive` returns `warnings` (`libraryExport.ts:318`): `missingClipAudio`, `missingPrimaryTake`, `missingOverdubStem` (`:797, 884, 953, 983, 1260`). `createShareLink` reads only `archiveUri`/`archiveTitle` (`shareLink.ts:114-128`), and `useSendJobStore` then announces success (`useSendJobStore.ts:94-97`).
  - On receive, `importLibraryArchiveIntoLibrary` returns `warnings` (`actions.ts`, `warnings: merge.warnings`), including `missingArchivedAudio` / `missingArchivedOverdubStem` (`libraryImport.ts:274, 352, 371`). `TransferReceiveScreen` ignores them (`index.tsx:239-256`), then fires `haptic.success()` and "Chart book saved" / "Saved to Received" (`:348-376`).
  - By contrast, Settings export (`useLibraryExportFlow.ts:345`) and import (`useLibraryImportFlow.ts:81-85`) show them.
- **Steps:**
  1. A take's file is missing on the sender's phone (an orphan, an interrupted restore, a 03-class loss).
  2. Send the sketch. The sender sees "Link ready".
  3. The recipient sees "Saved", and the sketch arrives with a silent take.
  - Neither person is told.
- **Fix:** carry `prepared.warnings` into the job: a ready state with a one-line "1 take couldn't be included" and the `warning` haptic. On receive, show the same summary Settings import uses before navigating.

### M-3. A mixed web parcel loses half its contents, a different half on each side

- **Where:**
  - App side (`receiveTransfer.ts:287-291`):
    ```ts
    export function withoutBrowserCopies(transfer: TransferPayload): TransferPayload {
      const archives = transfer.items.filter(isArchiveItem);
      if (archives.length === 0 || archives.length === transfer.items.length) return transfer;
      return { ...transfer, items: archives };
    ```
  - The rule assumes every loose file beside an archive is an app-made copy. But the web sender takes any mix, and its own copy invites it: "Drop in a folder of bounces, a few sketches, or a SongNook file" (`sender.ts:65`).
  - The browser recipient page hides the .songnook whenever audio exists (`recipient.ts:87-89`, and sealed `:228-230`).
- **Steps:**
  1. From the web, drop a .songnook setlist plus three new bounces and send.
  2. App recipient: the parcel lists one item, and Save imports only the setlist. The bounces are never shown.
  3. Browser recipient: only the bounces are downloadable.
- **Evidence:** scratch test `web parcel: one .songnook + three genuine bounces -> app keeps only the archive` passes.
- **Fix:** mark browser copies explicitly. Add a `copyOf` flag in the sealed envelope (and a name pattern for unsealed parcels), and drop only flagged items. Or refuse mixes on the web page with one line.

### M-4. A 15-minute absolute upload ceiling defeats large parcels on slow uplinks

- **Where:** `sendTransfer.ts:186-196`:
  ```ts
  const UPLOAD_CEILING_MS = 15 * 60 * 1000;
  ... ceiling = setTimeout(() => { void task.cancelAsync()...; reject(new Error("upload timed out")); }, UPLOAD_CEILING_MS);
  ```
  The cap is 1 GB (`config/sendService.ts`).
- **What happens:**
  - The ceiling ignores progress. At 2.5 Mbps (0.3 MB/s) anything over about 270 MB is cancelled at 15:00 with "The upload didn't finish. Try again." Try again fails identically.
  - Workspaces and collections pack as one file, so a modest workspace sent on cellular hits this.
  - The receive side already does it right: a 30 s **stall** watch, not a ceiling (`receiveTransfer.ts:323-340`).
- **Fix:** replace the ceiling with a stall watchdog (no bytes for 60 s cancels). Keep a far ceiling only as a backstop sized from the file (e.g. size ÷ 100 kB/s).

### M-5. A kill mid-receive leaves an empty package that blocks re-receiving, and media no clip points at

- **Where:** `TransferReceiveScreen/index.tsx:262-295`.
  - `addReceivedFilesPackage(...)` persists a workspace with `received.transferId` **first**.
  - Then come `enrichImportedAudioAsset` for every file and `importAudioAssets` (which copies every file into `songnook/audio`).
  - Only then does `batcher.add` / `flush` attach the clips.
  - On the next open, `alreadyReceived` matches that transferId (`:140-143`) and shows "Already saved".
- **Steps:**
  1. Receive a 40-clip parcel.
  2. During the copy step (seconds for a large parcel), swipe the app away, or the OS kills it.
  3. Received holds an empty package named after the parcel.
  4. Reopening the link says "Already saved · This transfer is in your library".
  5. The copied files sit in `songnook/audio` unreferenced, against the 2026-10-19 media law. Only the manual orphan scan finds them, and without names.
- **Fix:** import and attach first, and create the package in the same commit (or stamp `received.pending` and sweep pending packages and their files at launch). Make `alreadyReceived` ignore empty or pending packages.

---

## LOW

- **L-1. Cancel during finalize still makes a live, recorded link.**
  - `shareLink.ts:194-211`: `throwIfSendCancelled` runs before finalize, never after, so `recordLink` runs. The store has already cleared the job (`useSendJobStore.ts:140-148`).
  - The sender saw it cancel, but the link is live, counted, and listed in Sent links (not copied, no toast).
  - Scratch test `cancel tapped while finalize is in flight` passes.
  - **Fix:** after finalize, if the signal is aborted, call `deleteTransfer` and skip `recordLink`. Or disable Cancel in the "Sealing" phase.
- **L-2. Stop during import doesn't stop.**
  - `abortRef` is only read after each download (`index.tsx:235`).
  - Confirming **Stop** (body: "What's downloaded so far is discarded.") while `importLibraryArchiveIntoLibrary` or `importAudioAssets` is awaited lets the save finish. It toasts "Saved", and `returnHome` pulls the user to Library or Received after they already left.
  - **Fix:** check `abortRef` after each await, and roll back as in the catch block.
- **L-3. "Remove from list" undersells its scope.**
  - The body reads `"The link keeps working until it expires."` (`en.ts:651`).
  - The outbox entry is the only copy of a sealed link's key and of the upload token (`SettingsSharingView.tsx:68-75`). After Remove, the link can't be shared again or deleted.
  - **Fix:** add "You won't be able to copy or delete it." (within the 20-word alert budget).
- **L-4. Allowance race (billing, not data).**
  - `senderForCreate` checks `freeLeft` at create (`api.ts:93-97`), and `recordSend` counts at finalize (`:304`).
  - The harness confirms it:
    - three parallel drafts with one free link left all finalize (send_log 2→5);
    - two concurrent finalizes of one draft write two `send_log` rows.
  - Only reachable via a script or two web tabs. Takes effect once `PRO_FOR_ALL=false`.
  - **Fix:** re-check at finalize, and make the `status='draft'→'finalized'` update conditional (`WHERE status='draft'`), recording only when `changes=1`.
- **L-5. R2 objects with no row are never swept.**
  - Harness: DELETE a draft, let the presigned PUT land afterwards, run the sweep, and one object remains.
  - The sweep only deletes keys it finds in D1 (`sweep.ts:30-37`).
  - Not reachable from the app or web UI (both upload sequentially and never delete drafts). Reachable through the raw API with a valid token.
  - **Fix:** add an R2 lifecycle rule (expire objects after 8 days) as a backstop.
- **L-6. Web sender failure surfaces.**
  - Raw server bodies are shown: `throw new Error(await reg.text())` → `Sorry — {"error":"file type \".x\" …"}` (`sender.ts:380, 395`).
  - The catch doesn't `render()`, so per-row "✓ 3.2 MB" and "57%" stay under "Nothing was sent", and the bar stays visible.
  - There is no up-front check against the 200-item / 1 GB caps. A big folder fails at item 201 or at the size cap only after uploading everything before it.
  - No `beforeunload` guard while uploading.
  - `Seal.sealBlob` holds the whole sealed file in memory (`sealJs.ts:56-68, 110`). A 1 GB file can crash the tab and lose the arranged order. The files themselves stay on disk.
- **L-7. Unpair mid-send.**
  - `#unpair` isn't disabled while `sealing` (`sender.ts:197-199`). It hides the send panel and starts pairing while uploads continue.
  - The finished link renders into the hidden panel, and that panel is the only place the key exists. It shows again only after re-pairing in the same tab.
- **L-8. Preview vs Save on a sealed item.**
  - `useParcelPreview` downloads a sealed item with `downloadTransferItem(item)` and no signal (`useParcelPreview.ts:82-89`), to the same `${itemId}-${name}` target and `.sealed` temp that Save uses (`receiveTransfer.ts:314-317`).
  - `save()` stops the player but not that download.
  - On Android the first one to finish deletes the other's `.sealed`, and Save fails with "Something went wrong" (an honest failure; retry works).
  - The native open writes the destination in place (`SongNookSeal.swift:164-172`, `SongNookSeal.kt:144`). So if the preview's open runs while Save copies the same `target` into the library, a truncated copy is possible. That window is narrow (speculative).
  - **Fix:** give preview its own cache subfolder and abort it in `preview.stop()`.
- **L-9. A second link on a mounted receive screen.**
  - The params-change effect resets `startedRef`/`abortRef` (`index.tsx:150-151`) while save A runs on.
  - A's progress `setPhase` calls overwrite B's view. A's `cleanupReceiveCache()` can delete B's downloads mid-save, so B fails and rolls back. A's completion navigates away from B.
  - **Fix:** while saving, ignore param changes (or queue the second link), and use a per-parcel cache folder.
- **L-10. Try again uses the old snapshot.**
  - Every `create` closes over the entity and `workspaces` captured when the sheet opened, e.g. `useSetlistModel.ts:294` and `SongScreenProvider.tsx:122`.
  - A retry after edits sends the pre-edit lyrics and titles. A retry after deleting a take fails, or sends without it.
  - **Fix:** have `create` re-read the entity by id from the store at run time.
- **L-11. "Copied" when it wasn't.**
  - `useSendJobStore.ts:94` swallows the clipboard failure and still toasts and shows "Link ready, copied".
  - `SentLinkChip.tsx:30-31` does the same.
  - `SettingsSharingView.tsx:64` doesn't catch at all (unhandled rejection, no toast).
  - The web Copy button sets "Copied" without awaiting `writeText` (`sender.ts:411-414`).
- **L-12. Smaller honesty gaps.**
  - Pairing claim maps every non-404 failure (429 rate limit, 401 "update") to "Couldn't reach SongNook Send" (`SettingsComputerView.tsx:63-68`).
  - A receive save failure shows the title "Couldn't open the transfer" (`index.tsx:523`).
  - On iOS, leaving the app for more than 30 s during a receive means the stall watch fires on resume and the save rolls back.
  - A file just under 1 GB passes `assertWithinCaps` on its plain size, but its sealed size is over the cap. The server then answers 413, shown as "refused (413)" rather than "too large".
  - Decrypted preview copies stay in `songnook-receive` if the person leaves without saving.
  - The Send sheet's typed note is discarded on swipe-down or Android back with no ask (`SendLinkSheet.tsx:76-79, 100`).
  - Two concurrent first calls to `getSendKey` can mint two keys, the last write winning (`sendIdentity.ts:26-37`; speculative).

## What holds up (verified)

- **Partial uploads never become visible.**
  - A draft is unfetchable (`transferUsable`), and any failure before finalize leaves a draft that the sweep removes within 24 h.
  - The sweep finds every registered object through its item row.
  - The item and byte caps are atomic (`insertItemWithinCaps`).
  - A presigned PUT is length-bound.
  - Finalize checks every object (HEAD, SNS1 magic, zip magic) and deletes the whole draft on a mismatch.
- **Finalize is idempotent server-side** (already-finalized → same `shareUrl`). **Delete is idempotent** (already gone → 204).
- **Delete or expiry racing a download is honest.**
  - Harness: a ranged resume after Delete returns 404.
  - The app's size check and status check turn that into `downloadFailed` and roll back.
  - Try again re-fetches the metadata and lands on "This link has expired".
- **Receive never half-saves silently.**
  - Any failure, or a user Stop between downloads, deletes the package(s) and compilations stamped with the transferId. That rollback is correct for this attempt; 04-M4 covers its overreach onto earlier kept compilations.
  - A partial audio import fails the whole parcel with a count, and the downloaded-size check catches truncation.
- **The web page keeps the picked files on every failure**, including a 401 (expired pairing, then re-pair, then the list is still there) and a 402. The pairing cookie or session expiring mid-send doesn't matter, because only create checks the session; items and finalize use the upload token.
- **The envelope ↔ item order is safe:** both senders register sequentially, and `sort_order` is the live count.
- **The Send sheet → job hand-off** blocks a second seal while one runs (`openSendSheet`), and a stale job can't write over a newer one (the id check in `run`).
- **The Sent-links Delete** asks first, names the real scope ("stops working for everyone, and its files are deleted"), and fires `error` on failure via `AppAlert.error`.

---

## Interaction inventory

Abbreviations: **SLS** = `SendLinkSheet.tsx`, **SJS** = `useSendJobStore.ts`, **SL** = `shareLink.ts`, **ST** = `sendTransfer.ts`, **RT** = `receiveTransfer.ts`, **TRS** = `TransferReceiveScreen/index.tsx`, **SSV** = `SettingsSharingView.tsx`, **SCV** = `SettingsComputerView.tsx`, **WS** = web `sender.ts`, **WR** = web `recipient.ts`.

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 1 | Any "Get a link" row › `openSendSheet` | Pro gate on the local `recentSendCount`. If a job is running: toast "One parcel at a time" and expand it. If a job is ready or failed: `dismiss()` it. Then opens the sheet | Gate shows the upsell | OK |
| 2 | Send sheet › Sort A–Z | `sortParcelItemsAz` on local `items` state | n/a | OK |
| 3 | Send sheet › item ▲ / ▼ | `moveParcelItem` on local state; key = `item.key` | Disabled at the ends | OK |
| 4 | Send sheet › item parts (Takes/Lyrics/Chart/Notes/Marks/Layers) | Toggles `leaveOut[item.key]` | n/a | OK |
| 5 | Send sheet › sketch's shared parts | Toggles `sharedLeaveOut` | n/a | OK |
| 6 | Send sheet › Title input | Local; trimmed and clipped to 200; empty → `request.title` | n/a | OK |
| 7 | Send sheet › From input | Local; saved to `useSendPrefsStore` only on seal | n/a | OK |
| 8 | Send sheet › Note input | Local; clipped to 1000 | Lost on dismiss | L-12 |
| 9 | Send sheet › Cancel | `dismiss()`; nothing created | n/a | OK |
| 10 | Send sheet › swipe-down / scrim / Android back | Same as Cancel | Typed note dropped silently | L-12 |
| 11 | Send sheet › Get link | `startJob` → `request.create` → SL `createShareLink`/`createFilesShareLink` (create → pack/encode → seal → register+PUT → finalize → `recordLink`) | Errors go to the job's error state with `haptic.error`. A double tap aborts the first job and leaves one swept draft | H-1, M-1, M-2, M-4 |
| 12 | Job › auto on success | Clipboard copy, `haptic.success`, toast "Link copied", status `ready` | Clipboard failure swallowed, toast still shown | L-11 |
| 13 | Job › keep-awake | Held while running; released after | n/a | OK |
| 14 | Pill › tap | `setExpanded(true)` | n/a | OK |
| 15 | Job sheet (running) › Cancel | Folds, then `cancel()`: aborts the controller, job cleared | During "Sealing…" the link still goes live and is recorded | L-1 |
| 16 | Job sheet (running) › Hide / swipe-down | `setExpanded(false)` | n/a | OK |
| 17 | Job sheet (ready) › Copy | Clipboard + toast + `light` | Failure swallowed, toast still shown | L-11 |
| 18 | Job sheet (ready) › Share | `Share.share` with the keyed URL | Caught | OK |
| 19 | Job sheet (ready) › Done | `dismiss()`; the link stays in Sent links | n/a | OK |
| 20 | Job sheet (error) › Dismiss | `dismiss()`; the orphan draft is swept server-side | n/a | OK |
| 21 | Job sheet (error) › Try again | `retry()` re-runs `request.create(parcel)` with the captured snapshot | A new draft each time; old ones swept | L-10, M-1, M-4 |
| 22 | Send › app backgrounded | iOS background upload session continues; JS resumes | If the app is killed, the job vanishes without a word (transient); the draft is swept | OK (by design) |
| 23 | Send › app killed between finalize and `recordLink` | Link live, not recorded | None | M-1 (same root) |
| 24 | Sent links › mount | `prune()` drops entries more than 3 days past expiry | n/a | OK (07-L3 for the clock) |
| 25 | Sent links › row Copy glyph | `Clipboard.setStringAsync` then toast | Unhandled rejection | L-11 |
| 26 | Sent links › "…" | `AppAlert.menu`: Remove from list; Delete link only when there is a token and the link is unexpired | n/a | OK |
| 27 | Sent links › Remove from list › confirm Remove | `forgetLink`: drops the only copy of the key and token | Wording omits this | L-3 |
| 28 | Sent links › Remove › Cancel / scrim | Nothing | n/a | OK |
| 29 | Sent links › Delete link › confirm Delete | `deleteTransfer` (DELETE, x-upload-token). On success: `forgetLink`, dismiss a matching job pill, toast | `AppAlert.error` (error haptic). Server delete is idempotent. Response lost → retry gets 204 | OK |
| 30 | Sent links › Delete › Cancel / scrim | Nothing | n/a | OK |
| 31 | Sent links › Help ? / sheet | Read-only | n/a | OK |
| 32 | SentLinkChip › Copy | Clipboard + toast | Failure swallowed, toast still shown | L-11 |
| 33 | Settings › Send from a computer › mount | `listPairedBrowsers` (send key headers) | "Couldn't load paired browsers." | OK |
| 34 | ... › code input / keyboard Go | `normalize` to 6 characters; Go → `pair()` | n/a | OK |
| 35 | ... › Pair | `claimBrowserPairing`; guarded by `pairing` against double taps | 404 → bad code; anything else → "offline" | L-12 |
| 36 | ... › paired browser × | `removePairedBrowser` (idempotent); a web send in flight still finishes (token based) | `AppAlert.error` | OK |
| 37 | Receive › mount | `alreadyReceived` (workspaces only) then `fetchTransfer` (8 s; sealed: open the envelope with `#k=`) | gone / final error / retryable error | H-1 (validation refuses the whole parcel) |
| 38 | Receive › ▶ preview (unsealed) | Streams `downloadUrl` via expo-audio; nothing written; pauses the dock; never during recording | Load failure leaves the spinner state | OK |
| 39 | Receive › ▶ preview (sealed) | `downloadTransferItem(item)` with no signal, into the receive cache, then plays | Collides with Save on the same paths | L-8, L-12 |
| 40 | Receive › Save / Save all (< 150 MB) | `save()`: per item download (stall watch, size check, open), then archive import or loose audio → `addReceivedFilesPackage` → copy → batcher; playlist/setlist built; `cleanupReceiveCache`; success haptic + toast + navigate | Catch: rollback by transferId, `haptic.error`, error phase. Warnings ignored | M-2, M-5, 04-M4 |
| 41 | Receive › Save › big-parcel confirm › Save / Cancel | Same as 40 / nothing | n/a | OK |
| 42 | Receive › double-tap Save | `startedRef` guard | n/a | OK |
| 43 | Receive › back / swipe / Android back while saving | `beforeRemove` → "Stop saving?" › Stop: abort and leave (rollback in the catch); › Cancel: stay | Not honoured during the import step | L-2 |
| 44 | Receive › back when not saving | Leaves; nothing written | n/a | OK |
| 45 | Receive › error › Try again | Resets `startedRef`, re-fetches metadata (a gone link becomes "expired") | Hidden for `final` codes; `unsupportedItem` isn't final | H-1 |
| 46 | Receive › Already saved › Open Received | `returnHome` to Received | A false positive after a kill | M-5 |
| 47 | Receive › gone | Read-only | n/a | OK |
| 48 | Receive › second link while mounted | Params swap and reset the guards | Concurrent saves | L-9 |
| 49 | Receive › app backgrounded mid-save | Android continues. iOS suspends, the stall fires on resume, the save rolls back | Honest error | L-12 |
| 50 | Receive › parcel deleted or expired mid-download | Next request 404/410 → `downloadFailed` → rollback → Try again → "expired" | Honest | OK (harness) |
| 51 | Web sender › load | `GET /api/session`: paired → send panel; pending code → show it; else POST `/api/pairings` | Network failure reads as unpaired and asks for a new code | OK (cosmetic) |
| 52 | Web › "New code" | `startPairing()` | 429 message | OK |
| 53 | Web › 2 s pairing poll | `GET /api/session` completes the pairing → session cookie (30 days) | Expiry → "This code ran out" | OK |
| 54 | Web › Unpair this browser | `DELETE /api/session` (removes the browser row) → pairing | Live during a send | L-7 |
| 55 | Web › drop zone click / Enter / Space | Opens the picker | n/a | OK |
| 56 | Web › choose files | `addFiles`; skips non-audio and dotfiles with a notice | Admits any `audio/*` MIME with any extension | H-1 |
| 57 | Web › choose a folder | Same; sorted by name; fills Title if empty | n/a | OK |
| 58 | Web › drag-drop files or folder | Walks entries → `addFiles` | Read errors resolve to [] (skipped silently) | OK |
| 59 | Web › row ✕ | Splices from `files` (blocked while sealing) | n/a | OK |
| 60 | Web › row ▲ / ▼ | `move` (blocked while sealing) | n/a | OK |
| 61 | Web › row drag-reorder | `move` (blocked while sealing) | n/a | OK |
| 62 | Web › Sort A→Z | `files.sort(byName)` | n/a | OK |
| 63 | Web › Clear | `files = []`, no confirm (files remain on disk) | n/a | OK |
| 64 | Web › Files / Playlist / Setlist | `kind` (blocked while sealing) | n/a | OK |
| 65 | Web › From | `localStorage` on change (try/catch) | n/a | OK |
| 66 | Web › Title / Note | Read at seal time | n/a | OK |
| 67 | Web › Seal & get the link | Seal envelope → POST create → per file: seal blob, register, XHR PUT → finalize → show URL + `#k=` | Catch keeps the files and says "Nothing was sent" | M-1, M-3, L-6 |
| 68 | Web › Seal › 401 on create | Re-pair; file list kept | n/a | OK |
| 69 | Web › Seal › 402 on create | Notice; file list kept | n/a | OK |
| 70 | Web › Seal › failure mid-parcel | Draft left (swept within 24 h) | Raw JSON, stale marks, no up-front cap check | L-6 |
| 71 | Web › Seal › double click | `sealing` + disabled set synchronously | n/a | OK |
| 72 | Web › Copy | `navigator.clipboard.writeText` | Says "Copied" regardless | L-11 |
| 73 | Web › close or reload mid-upload | Draft swept; no warning | No `beforeunload` | L-6 |
| 74 | Web recipient (unsealed) › Open in SongNook (mobile) | Store link (TestFlight / Play with referrer) | n/a | OK |
| 75 | Web recipient › QR (desktop) | Encodes the page URL; sealed: `location.href` including the key | n/a | OK |
| 76 | Web recipient › "Prefer the raw files?" | Disclosure | Hides .songnook beside audio | M-3 |
| 77 | Web recipient (unsealed) › Download | Anchor to the ranged `/t/:id/dl/:item` | Browser download UI | OK |
| 78 | Web recipient (sealed) › no `#k=` | "This link is missing its key." | n/a | OK |
| 79 | Web recipient (sealed) › wrong key | "This link's key doesn't fit." | n/a | OK |
| 80 | Web recipient (sealed) › Download | fetch → blob → `openBlob` → anchor download; button shows "Opening…" | "Try again" on failure. Whole file in memory twice | L-6 (memory) |
| 81 | Web recipient › Download all / Play | **Not present** on either page (the gallery is a static mock-up) | n/a | n/a |
| 82 | Web recipient › gallery swipe | Scroll only | n/a | OK |
| 83 | Web › link gone page | 404 (draft or missing) / 410 (expired) | n/a | OK |
| 84 | Web › Report › Email a report | `mailto:` | n/a | OK |
| 85 | Server › POST /api/transfers | Origin check, rate limit, sender/pairing, allowance check; inserts a draft with the token hash | JSON errors | L-4 |
| 86 | Server › POST /transfers/:id/items | Token, type allowlist (sealed: `N.sealed` only), atomic caps; returns a presigned PUT (length-bound, 1 h) | 401/413/415/429 | H-1 (server can't see sealed names) |
| 87 | Client › presigned PUT | Bytes to R2 | Non-2xx → `uploadRejected`; 15-minute ceiling | M-4 |
| 88 | Server › POST /finalize | Token; idempotent if already finalized; HEAD + magic check per item; a mismatch deletes the whole draft; finalize then `recordSend` | Separate statements; sequential I/O | M-1, L-4 |
| 89 | Server › DELETE /transfers/:id | Token; R2 delete then D1 delete; already gone → 204 | R2 objects landing later are orphaned | L-5 |
| 90 | Server › GET /api/transfers/:id | Finalized and unexpired only | 404 draft / 410 expired | OK |
| 91 | Server › GET /t/:id/dl/:item | Gate, Range (start ≥ size returns 200 in full, not 416), count | 404/410 after delete or expiry | OK |
| 92 | Server › pairing endpoints (POST /pairings, GET/DELETE /session, POST /pairings/claim, GET/DELETE /browsers) | Hashed secrets; single-claim UPDATE guard; pending row listed and removable | n/a | OK |
| 93 | Server › nightly sweep | Expired, plus drafts older than 24 h: R2 keys from item rows, then rows; pages through batches; per-transfer try/catch; then senders/pairings/send_log | Logged and retried the next night | L-5 (no lifecycle backstop) |

93 rows.

## Files read

Server:
- `server/songnook-send/src/index.ts`, `env.ts`
- `routes/api.ts`, `download.ts`, `pairing.ts`, `wellknown.ts`
- `lib/db.ts`, `sweep.ts`, `senders.ts`, `access.ts`, `contentPolicy.ts`, `guard.ts`, `r2presign.ts`, `uploadToken.ts`, `serialize.ts`, `http.ts`, `ids.ts`, `shareKind.ts`, `qr.ts`
- `pages/recipient.ts`, `sender.ts`, `sealJs.ts`, `shell.ts` (page/htmlPage/CSP), `legal.ts`; `appPreviewGallery.ts` (interactions only)
- `migrations/0001`–`0005`, `wrangler.toml`, `r2-cors.json`, `package.json`, `.gitignore`, `README.md` (head)
- `lib/__tests__/*` (run)

App:
- `src/services/sendTransfer.ts`, `shareLink.ts`, `shareLinkFlow.ts`, `receiveTransfer.ts`, `sendSeal.ts`, `sendIdentity.ts`, `clipShareLink.ts`
- `src/services/setlistShare.ts` (creator shape), `parcelShare.ts` (browser copies), `shareImport.ts` (extension list)
- `src/services/audioStorage.ts` (extension and mime helpers), `clipImportBatcher.ts`, `freeMonthClock.ts` (durable read/write)
- `src/services/libraryExport.ts` / `libraryImport.ts` (warnings plumbing)
- `src/config/sendService.ts`
- `src/state/useSendJobStore.ts`, `useSendSheetStore.ts`, `useSentLinksStore.ts`; `dataSlice.ts` (`addReceivedFilesPackage`, `deleteWorkspace`); `actions.ts` (`importLibraryArchiveIntoLibrary` return)
- `src/domain/sentLinks.ts`, `sendProgress.ts`
- `src/components/common/SendLinkSheet.tsx`, `SentLinkChip.tsx`, `AppAlert.tsx` (error haptic)
- `src/components/SettingsScreen/views/SettingsSharingView.tsx`, `SettingsComputerView.tsx`
- `src/components/TransferReceiveScreen/index.tsx`, `src/hooks/useParcelPreview.ts`, `src/i18n/userFacingError.ts`
- `src/i18n/locales/en.ts` (sharing, sendSheet, shareLink, transferReceive, sendComputer)
- `App.tsx` (linking for `t/:transferId`)
- `modules/songnook-file-io` seal open/seal write paths (iOS and Android)
- All `create:` call sites (grep)
