# 05 · Sharing, your data, Settings, and Pro itself

Read from code on main (2442cd38), 2026-11-13. Every row is something a person can reach in the app today, or something the app does for them. "Where" is the main file, short path from the repo root (`src/` unless it starts with `server/`, `App.tsx`, `plugins/` or `app.json`).

Status words: **Free** (no gate in code), **Pro** (the Pro page opens for a free user), **Free up to N, then Pro**.

## Read this first: how the 3 free Send links really work today

- **The count is taken on the phone.** Each link made on this phone is time-stamped in the app's own storage (`state/useSentLinksStore.ts`, `sentAt`). The gate asks "fewer than 3 stamps in the last 30 days?" before the Send sheet opens (`state/useSendSheetStore.ts:76`).
- **Rolling 30 days**, not a calendar month. A link made on the 5th stops counting on the 5th of next month.
- **Deleting a link gives nothing back.** Neither does removing it from the list, or the link expiring.
- **A send that fails at the very last step still uses one** (the stamp is written before the server confirms). A send cancelled or failed earlier does not.
- **Per device.** The stamps ride a backup, but Erase everything or an Android reinstall clears them.
- **Pro, the free month and founding members all pass the app's gate** with no limit.
- **The server enforces none of this today.** In `server/songnook-send/wrangler.toml`: `PRO_FOR_ALL = "true"` (the server treats every sender as Pro) and `APP_SEND_ENFORCED = "false"` (the server does not check the app's sends at all). So today the limit exists only inside the app. A browser paired through "Send from a computer" is unlimited for everyone, because the browser's only check is the server's.
- **When the flags are flipped** (`PRO_FOR_ALL=false`, `APP_SEND_ENFORCED=true`, plus the RevenueCat secret key): the server counts 3 links per rolling 30 days per install, phone and paired browsers together, and asks RevenueCat who has Pro. It honours the free month (the app tells it when the month ends; the server caps that at 31 days after it first saw the install). **It does not know about founding members**: a founding member would be refused after 3 links by the server while the app tells them they have Pro. The pricing record says the founder waived this on 2026-11-11 ("no real testers"). Confirmed in code: nothing founding-related is sent (`services/sendIdentity.ts`).

### Server switches as written in the repo (not features; whether the live server matches was not checked)

| Switch | Value in `wrangler.toml` | What it does |
|---|---|---|
| `PRO_FOR_ALL` | `"true"` | Server treats every sender as Pro. Flip to `"false"` to start checking. |
| `APP_SEND_ENFORCED` | `"false"` | Server ignores who the app is. `"true"` makes the app name itself and applies Pro or the 3 links. |
| `WEB_SEND_REQUIRES_PAIRING` | `"true"` | The web page sends only from a browser paired with the app. |
| `SEAL_WEB_SENDS` | `"true"` | The web page encrypts files in the browser before upload. |
| `MAX_TRANSFER_BYTES` / `MAX_ITEM_BYTES` | 1 GB / 1 GB | Size cap per link and per file. |
| `EXPIRY_DAYS` | `7` | A link lives 7 days. |
| `DRAFT_EXPIRY_HOURS` | `24` | An upload never finished is deleted after a day. |
| `PRO_ENTITLEMENT_ID` | `songnook_pro` | The RevenueCat entitlement that means Pro. |
| `REVENUECAT_SECRET_KEY` | secret, not in the repo | Needed once `PRO_FOR_ALL` is false, or every subscriber reads as free. |
| `IOS_APP_STORE_URL` | App Store listing | Where "Open in SongNook" sends an iPhone without the app. |
| Rate limits | 5 new links a minute, 240 files a minute, 10 pairing tries a minute, 3 feedback notes a minute, each per internet address | Abuse brakes. |

---

## SongNook Send: sending

### Where a link can be made (one gate, one shared count)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Send the take that is playing | Full player, Share, SongNook Send: a link for this one take. | Free up to 3 links per 30 days, then Pro | `components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts` |
| Send selected cards from a collection | Clips, sketches or a mix, picked in selection mode, as one link. | Free up to 3 links per 30 days, then Pro | `components/IdeaListScreen/components/IdeaSelectionBar.tsx` |
| Send takes picked inside a sketch | Chosen takes go as one link, with the sketch's lyrics, chart and notes if wanted. | Free up to 3 links per 30 days, then Pro | `components/IdeaDetailScreen/components/SelectionBars.tsx` |
| Send a whole sketch | Sketch page, Share, SongNook Send: every take, lyric version, chart, notes and marks. | Free up to 3 links per 30 days, then Pro | `components/IdeaDetailScreen/provider/SongScreenProvider.tsx` |
| Send a whole collection | Collection menu, Share, SongNook Send: everything in it, nested collections too. | Free up to 3 links per 30 days, then Pro | `components/IdeaListScreen/hooks/useCollectionManagement.ts` |
| Send a collection from the workspace page | Select one collection on the workspace page and send it without opening it. | Free up to 3 links per 30 days, then Pro | `components/WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts` |
| Send a whole workspace | Workspace card, Share, SongNook Send: the entire workspace as one link. | Free up to 3 links per 30 days, then Pro | `components/WorkspaceListScreen/hooks/useWorkspaceListScreenModel.ts` |
| Send a playlist | One clip per row, in the playlist's order. | Free up to 3 links per 30 days, then Pro | `components/LibraryScreen/hooks/useLibraryScreenModel.ts` |
| Send a setlist | The chosen takes and charts of each song, in set order. | Free up to 3 links per 30 days, then Pro | `components/LibraryScreen/hooks/useSetlistModel.ts` |
| Send a chart book | The book's charts only, no audio (a very small link). | Free up to 3 links per 30 days, then Pro | `components/LibraryScreen/hooks/useSongbookModel.ts` |
| Free links allowance | 3 links per rolling 30 days on this phone; deleting a link gives none back. | Free up to 3 links per 30 days, then Pro | `state/useSentLinksStore.ts`, `domain/proGating.ts` |

### The Send sheet

| Feature | What it does | Status | Where |
|---|---|---|---|
| Title | Name of the parcel, prefilled with the thing's own name (200 characters). | Free | `components/common/SendLinkSheet.tsx` |
| From | Your name as the receiver sees it (80 characters), remembered for next time. | Free | `components/common/SendLinkSheet.tsx`, `state/useSendPrefsStore.ts` |
| A note | An optional message for the receiver (1,000 characters). | Free | `components/common/SendLinkSheet.tsx` |
| Running order | With several items, arrows move each one up or down before sending. | Free | `components/common/SendLinkSheet.tsx`, `domain/parcelOrder.ts` |
| Sort A–Z | One tap puts the items in alphabetical order. | Free | `components/common/SendLinkSheet.tsx` |
| What travels with each item | Per item, switch Takes, Lyrics, Chart, Notes, Marks, Layers in or out. Audio always goes. | Free | `domain/parcelContents.ts` |
| The sketch's own line | Sending takes from a sketch: one line switches the sketch's lyrics, chart and notes in or out. | Free | `components/common/SendLinkSheet.tsx` |
| "Audio only" label | An item with nothing extra to carry says so. | Free | `components/common/SendLinkSheet.tsx` |
| Privacy line | "Only people with the link can open it, not even SongNook." Shown only where the build encrypts. | Free | `components/common/SendLinkSheet.tsx`, `services/sendSeal.ts` |
| Get link / Cancel | One key starts the send and closes the sheet. | Free | `components/common/SendLinkSheet.tsx` |

### While it sends, and when it is ready

| Feature | What it does | Status | Where |
|---|---|---|---|
| Sends in the background | A pill above the player shows the send while you keep using the app. | Free | `state/useSendJobStore.ts`, `components/common/SendLinkSheet.tsx` |
| Progress detail | Packing n of m, Uploading with size sent and time left, Sealing, a percent bar. | Free | `components/common/SendLinkSheet.tsx`, `domain/sendProgress.ts` |
| Hide | Folds the progress sheet back into the pill. | Free | `components/common/SendLinkSheet.tsx` |
| Cancel a send | Stops the send; nothing goes live. | Free | `state/useSendJobStore.ts` |
| Screen stays on | The phone does not sleep while a send is packing or uploading. | Free | `components/common/SendLinkSheet.tsx` |
| One parcel at a time | Asking for a second link while one runs opens the running one instead. | Free | `state/useSendSheetStore.ts` |
| Link copied automatically | When ready, the link is already on the clipboard and a toast says so. | Free | `state/useSendJobStore.ts` |
| Copy / Share / Done | The ready sheet shows the link, days left, Copy, and the phone's share sheet. | Free | `components/common/SendLinkSheet.tsx` |
| Try again | A failed send says why in one sentence and offers Try again or Dismiss. | Free | `services/shareLinkFlow.ts`, `state/useSendJobStore.ts` |
| "Takes left out" warning | If a take's file is missing on this phone, the ready sheet says how many were left out. | Free | `services/shareLink.ts` |

### What a link is

| Feature | What it does | Status | Where |
|---|---|---|---|
| Sealed parcels (end-to-end encrypted) | Files, title, name and note are encrypted on the phone; the key rides only in the link. | Free | `services/sendSeal.ts`, `modules/songnook-file-io` |
| Smaller audio for links | Lossless takes are converted to AAC for the link only; the library keeps the original. | Free | `services/linkAudioEncoder.ts`, `domain/linkAudio.ts` |
| Unplayable files caught first | A file no receiver could open is converted, or the send stops before uploading. | Free | `services/shareLink.ts`, `domain/sendFormats.ts` |
| Plain audio beside a package | Card and take links also carry plain audio copies for someone without the app. | Free | `services/parcelShare.ts` |
| Size limit | 1 GB per link and per file, checked on the phone before any upload ("Too large to link"). | Free | `config/sendService.ts`, `server/songnook-send/wrangler.toml` |
| File count limit | At most 200 files in one link (server rule). | Free | `server/songnook-send/src/routes/api.ts` |
| Seven-day life | A link works for 7 days, then its files are deleted by a nightly sweep. | Free | `server/songnook-send/src/lib/sweep.ts` |
| Whole places travel whole | Sketch, collection and workspace links carry every take, lyrics, charts, notes, marks, tags and layers. | Free | `services/placeShare.ts`, `services/sketchShare.ts` |
| Compilations ride along | Setlists, chart books and playlists that sit entirely inside a sent collection or workspace go with it. | Free | `domain/scopedCompilations.ts` |
| A link is a snapshot | Later edits never change a link already sent; a new link is a new snapshot. | Free | `services/shareLink.ts` |

### Sent links (Settings › Data & storage › Sent links)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Sent links list | Every link made on this phone: kind, title, days left, item count. | Free | `components/SettingsScreen/views/SettingsSharingView.tsx` |
| Copy a link again | One tap copies a live link. | Free | `components/SettingsScreen/views/SettingsSharingView.tsx` |
| Remove from list | Hides the link here; it keeps working until it expires. | Free | `components/SettingsScreen/views/SettingsSharingView.tsx` |
| Delete link | The link stops for everyone at once and its files are deleted from the server. | Free | `components/SettingsScreen/views/SettingsSharingView.tsx`, `server/songnook-send/src/routes/api.ts` |
| Expired links fade, then go | An expired link greys out and leaves the list 3 days later. | Free | `domain/sentLinks.ts` |
| Unconfirmed link stays listed | If the last step's answer never arrived, the link stays here so it can still be deleted. | Free | `services/shareLink.ts` |
| Send help sheet | The "?" explains: who can open a link, seven days, delete anytime. | Free | `components/common/helpContent.ts` |
| "Link active" chip | A collection, playlist, setlist or chart book page shows its live link, days left, and Copy. | Free | `components/common/SentLinkChip.tsx` |
| Sent links travel in a backup | The list and the 30-day count are part of a backup. | Free | `services/satelliteSnapshot.ts` |

### Send from a computer (Settings › Data & storage › Send from a computer)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Pair a browser | Type the 6-character code shown at send.songnook.app; the code lasts 10 minutes. | Free | `components/SettingsScreen/views/SettingsComputerView.tsx`, `server/songnook-send/src/routes/pairing.ts` |
| Paired browsers list | Each paired browser ("Chrome on Mac") with the date it was paired. | Free | `components/SettingsScreen/views/SettingsComputerView.tsx` |
| Remove a browser | One tap unpairs a browser from the phone. | Free | `components/SettingsScreen/views/SettingsComputerView.tsx` |
| Pairing lasts 30 days | After 30 days the browser must be paired again. | Free | `server/songnook-send/src/lib/senders.ts` |
| Web page: drop files or a folder | Drag in audio or a SongNook file, or pick files or a whole folder (1 GB). | Free up to 3 links per 30 days, then Pro (today unlimited: the server is not checking) | `server/songnook-send/src/pages/sender.ts` |
| Web page: order the files | Drag rows, use arrows, Sort A→Z, remove one, or Clear. | Free | `server/songnook-send/src/pages/sender.ts` |
| Web page: "What is this?" | Files, Playlist or Setlist: decides how it lands in the receiver's app. | Free | `server/songnook-send/src/pages/sender.ts` |
| Web page: From, Title, Note | The same three lines as the phone; the From name is remembered in that browser. | Free | `server/songnook-send/src/pages/sender.ts` |
| Web page: sealed in the browser | Files are encrypted in the browser before they leave. | Free | `server/songnook-send/src/pages/sealJs.ts` |
| Web page: copy the link | "Sealed. Your link is ready" with a Copy button. | Free | `server/songnook-send/src/pages/sender.ts` |
| Web page: free links left | A free sender sees "n of 3 free links left this month" (once the server checks). | Free | `server/songnook-send/src/pages/sender.ts` |
| Web page: unpair or new code | "Unpair this browser" and "New code" on the page itself. | Free | `server/songnook-send/src/pages/sender.ts` |
| Web page: file rules | Audio (m4a, mp3, wav, aac, flac, ogg, oga, aif, aiff, caf) or a SongNook file on its own. | Free | `domain/sendFormats.ts` |

---

## SongNook Send: receiving

### Opening a link in the app

| Feature | What it does | Status | Where |
|---|---|---|---|
| A link opens the app | Tapping a send.songnook.app link (or songnook://t/…) opens the parcel page in SongNook. | Free | `App.tsx` (linking), `app.json` |
| Parcel page | Shows title, who sent it, the note, number of files, and days left. | Free | `components/TransferReceiveScreen/index.tsx` |
| Listen before saving | Each audio file plays straight from the link before anything is saved. | Free | `hooks/useParcelPreview.ts` |
| Save / Save all | Downloads the parcel with a percent per file. | Free | `components/TransferReceiveScreen/index.tsx` |
| Says where it will land | Above the Save key: Received, or Compilations › Playlists, Setlists or Chart books. | Free | `components/TransferReceiveScreen/index.tsx` |
| Big parcel asks first | Over 150 MB it shows the size and says "Best on Wi‑Fi" before downloading. | Free | `components/TransferReceiveScreen/index.tsx` |
| Stop saving | Leaving mid-download asks; a yes discards what was downloaded. | Free | `components/TransferReceiveScreen/index.tsx` |
| Failed save leaves nothing half-made | A failed save removes its partial copy and offers Try again. | Free | `components/TransferReceiveScreen/index.tsx`, `domain/receiveRollback.ts` |
| Already saved | A link you saved before says so and offers Open Received. | Free | `components/TransferReceiveScreen/index.tsx` |
| Expired link message | "This link has expired. Ask the sender for a fresh link." | Free | `components/TransferReceiveScreen/index.tsx` |
| Key problems explained | A link missing its key, a key that does not fit, or an old app each get their own sentence. | Free | `services/sendTransfer.ts`, `services/receiveTransfer.ts` |
| "Saved, with gaps" | If some files could not be opened, a notice lists what was left out. | Free | `components/TransferReceiveScreen/index.tsx` |
| Playlist arrives as a playlist | A playlist link becomes a playlist in Compilations, in the sender's order. | Free | `components/TransferReceiveScreen/index.tsx` |
| Setlist arrives as a setlist | A setlist link becomes a setlist; the sender's note becomes the setlist's note. | Free | `components/TransferReceiveScreen/index.tsx` |
| Chart book arrives as a chart book | A chart book link lands in Compilations › Chart books. | Free | `services/receiveTransfer.ts`, `state/actions.ts` |
| Everything else lands in Received | Clips, sketches, collections and workspaces become a parcel in Received, apart from your work. | Free | `components/TransferReceiveScreen/index.tsx` |
| Sender's order kept | Loose clips arrive in the order the sender set. | Free | `components/TransferReceiveScreen/index.tsx` |
| Open a SongNook file from another app | A .songnook file shared in (AirDrop, Files, mail) lands as a parcel in Received. | Free | `components/ShareImportScreen/hooks/useShareImportScreenModel.ts` |
| Full backup recognised | A full backup opened this way is not imported; you are pointed to Restore. | Free | `services/archiveKind.ts` |

### Received (side menu)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Received page | One row per parcel: kind, who sent it, date, item count; a count of parcels and new ones. | Free | `components/ReceivedScreen/index.tsx` |
| "New" dot and count | An unopened parcel wears a dot; the side menu shows how many are new. | Free | `components/ReceivedScreen/index.tsx`, `components/SideNav.tsx` |
| Parcel sheet | Tapping a parcel shows what it is, who sent it, and up to 6 lines of what is inside. | Free | `components/common/ReceivedParcelSheet.tsx` |
| Keep | One key moves the parcel into your own work and lands you on it. | Free | `components/common/ReceivedParcelSheet.tsx`, `domain/receivedParcel.ts` |
| Look first | Opens the parcel as it is, read-only, without keeping it. | Free | `components/common/ReceivedParcelSheet.tsx` |
| Somewhere else | Choose where it goes: its own workspace, a workspace's top level, or under a collection. | Free | `components/common/ReceivedPackageMoveModal.tsx` |
| Keep as its own workspace | The parcel becomes one of your workspaces. Not counted against the 3 free workspaces. | Free | `components/common/ReceivedPackageMoveModal.tsx` |
| Report a parcel | Opens an email to SongNook with the parcel's link code, so a bad link can be removed. | Free | `components/common/ReceivedParcelSheet.tsx` |
| Select several parcels | Long-press, Select all, then Keep or Delete them together. | Free | `components/ReceivedScreen/index.tsx` |
| Delete a parcel | Goes to Recently deleted for 30 days, with Undo. | Free | `components/ReceivedScreen/index.tsx` |
| Collections listed under a workspace parcel | A workspace parcel shows its collections as rows you can open directly. | Free | `components/ReceivedScreen/index.tsx` |
| Read-only until kept | A parcel plays, reads and can be sent on; editing waits for Keep ("Keep to edit"). | Free | `hooks/useReadOnly.ts` |
| Pro tools free on received items | Transpose, capo, the stage reader and practice tools work free on anything received. | Free | `components/common/proUpsell.ts` (`ensureProFor`) |
| "Links you sent" | A link at the foot of Received opens the Sent links list. | Free | `components/ReceivedScreen/index.tsx` |
| Received stays apart | Parcels never mix into your workspaces on their own. | Free | `domain/workspaceVisibility.ts` |

### The web page a receiver sees without the app

| Feature | What it does | Status | Where |
|---|---|---|---|
| Link page | "Name sent you Title", the note, what it holds, days left. | Free | `server/songnook-send/src/pages/recipient.ts` |
| Open in SongNook (phone) | A button to the store; after installing, opening the link again opens the app. | Free | `server/songnook-send/src/pages/recipient.ts` |
| QR code (computer) | Scan with a phone to open the same link there. | Free | `server/songnook-send/src/pages/recipient.ts` |
| Download the raw files | "Prefer the raw files?" lists each file with a Download button. No playing in the page. | Free | `server/songnook-send/src/pages/recipient.ts`, `routes/download.ts` |
| Sealed links open in the browser | The browser uses the key in the link to show names and decrypt downloads. | Free | `server/songnook-send/src/pages/recipient.ts`, `pages/sealJs.ts` |
| "What's SongNook?" | A short description and a swipeable gallery of app screens. | Free | `server/songnook-send/src/pages/appPreviewGallery.ts` |
| Report link | Every link page has a quiet Report link that opens an email to SongNook. | Free | `server/songnook-send/src/index.ts` |
| Link unavailable page | After expiry or deletion: "This link isn't available." | Free | `server/songnook-send/src/index.ts` |
| Resumable downloads | A download interrupted on a weak connection can continue where it stopped. | Free | `server/songnook-send/src/routes/download.ts` |

---

## Sharing and exporting files

### Share menus (the same four ways out, always in this order, each with a one-line hint)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Share audio (one clip) | The raw audio file to the phone's share sheet. From the player, a selection, or a sketch's takes. | Free | `services/audioStorage.ts` (`shareAudioFile`) |
| Share audio (several) | Several clips go as one zip of audio files. | Free | `services/audioStorage.ts` (`shareAudioClips`) |
| Share audio with sketches selected | Sends each sketch's primary take as audio; the hint line says so. | Free | `components/IdeaListScreen/components/IdeaSelectionBar.tsx` |
| Export for DAW | Offered for a take recorded to the click: a WAV that starts on a bar. (Detailed by another agent.) | Free | `services/dawExport.ts` |
| SongNook file: selected cards | The selection as one file with every take, lyrics, charts, notes and marks. | Free | `services/ideasShare.ts` |
| SongNook file: a sketch | The whole sketch as one file that opens in SongNook. | Free | `services/sketchShare.ts` |
| SongNook file: a collection | The whole collection as one file. | Free | `services/placeShare.ts` |
| SongNook file: a workspace | The whole workspace as one file. | Free | `services/placeShare.ts` |
| SongNook file: a playlist | The playlist's clips, in order, as one file. | Free | `services/playlistShare.ts` |
| SongNook file: a setlist | The set's chosen takes and charts as one file. | Free | `services/setlistShare.ts` |
| SongNook file: a chart book | The book's charts as one small file. | Free | `services/songbookShare.ts` |
| Hint lines | Under each Share row, one line says what it carries and who it is for. | Free | `components/common/shareExits.ts` |

### Text and PDF

| Feature | What it does | Status | Where |
|---|---|---|---|
| Chord chart as text | Shares the chart as plain text. | Free | `components/ChordSheetScreen/useChordSheetModel.ts` |
| Lyrics with chords as text | Shares the chart as text plus a ChordPro copy. | Free | `components/LyricsVersionScreen/components/chords/useChordExport.ts` |
| Chart as PDF | Exports a chord chart or lyrics-with-chords page as a PDF. | Pro | `components/ChordSheetScreen/useChordSheetModel.ts:437`, `chords/useChordExport.ts:30` |
| Exports follow the transpose | A chart shown transposed exports transposed. | Free | `components/ChordSheetScreen/useChordSheetModel.ts` |
| Chart book as text | Shares every chart in a book as one text. | Free | `components/LibraryScreen/hooks/useSongbookModel.ts` |
| Lyric Pad pages as text | Shares selected Lyric Pad pages as text. | Free | `components/NotepadScreen/hooks/useNotepadScreenModel.ts` |

### Export an archive (Settings › Data & storage)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Format: SongNook Archive | A file another SongNook can import with everything intact. | Free | `components/SettingsScreen/views/SettingsExportView.tsx` |
| Format: Standard ZIP | Plain folders of audio any computer can open. | Free | `components/SettingsScreen/views/SettingsExportView.tsx` |
| Include (archive) | Switch in or out: Notes, Lyrics, Song history, Full detail, Hidden items. | Free | `components/SettingsScreen/views/SettingsExportView.tsx` |
| Include (ZIP) | Switch in or out: Notes (.txt), Lyrics (.txt), Hidden items. | Free | `components/SettingsScreen/views/SettingsExportView.tsx` |
| Scope | Tick whole workspaces or single collections; leave some out. | Free | `components/SettingsScreen/hooks/useLibraryExportFlow.ts` |
| Count and estimate | Shows how many items are in scope and an estimate before exporting. | Free | `components/SettingsScreen/hooks/useLibraryExportFlow.ts` |
| Save where you choose | Android saves into a folder you pick; iPhone hands the file to the share sheet. | Free | `services/archiveSave.ts` |
| Archived workspace guard | An archived workspace must be unarchived before its audio can be exported. | Free | `components/SettingsScreen/hooks/useLibraryExportFlow.ts` |
| Export keeps working behind you | Export runs under a pill with Minimize and Cancel; warnings are listed at the end. | Free | `components/LibraryProcessHost.tsx` |

### Import an archive (Settings › Data & storage)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Choose file | Pick a SongNook Archive (.zip). | Free | `components/SettingsScreen/views/SettingsImportView.tsx` |
| Preview before importing | Shows its name, export date, workspaces, collections, songs, clips, notes and any warnings. | Free | `components/SettingsScreen/hooks/useLibraryImportFlow.ts` |
| Import as new workspaces | Adds the archive as new workspaces; nothing existing is changed. Not counted against the 3 free workspaces. | Free | `components/SettingsScreen/hooks/useLibraryImportFlow.ts` |
| Another file / Clear | Swap the chosen file or clear it before importing. | Free | `components/SettingsScreen/views/SettingsImportView.tsx` |
| Full backup recognised | Picking a full backup here says so and points to Restore. | Free | `components/SettingsScreen/hooks/useLibraryImportFlow.ts` |

---

## Backup and restore

### Backing up by hand

| Feature | What it does | Status | Where |
|---|---|---|---|
| Back up | Your whole library, exactly, in one .zip you save anywhere. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts`, `services/disasterRecoveryBackup.ts` |
| What a backup holds | Every recording, layer, lyric, chart, note, playlist, setlist, chart book and setting, with checksums. | Free | `services/disasterRecoveryBackup.ts` |
| The small things too | Shelf, transposes, filters, sent links, Step up presets, small preferences and the app language. | Free | `services/satelliteSnapshot.ts` |
| Estimate first | Before starting: number of clips, size and how long it will take. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Minimize and keep working | The backup runs under a pill with steps, time left and Cancel. | Free | `components/LibraryProcessHost.tsx` |
| Choose where to save | A folder on Android; the share sheet on iPhone (Files, iCloud Drive). | Free | `services/archiveSave.ts` |
| Backed out of the picker | "Save this backup?" offers Choose location again or Discard; the work is not redone. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| "Confirm backup saved" (iPhone) | The app cannot see the share sheet's result, so it asks: Saved it or Not saved. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Incomplete backup named | If recordings are missing from storage, the backup saves and lists which ones. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Last backup line | "date · verified" on the Back up row, and the file name below with a copy button. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Space check | A backup refuses to start without room for it, and says how much is needed. | Free | `services/backupOperation.ts` |
| Large libraries | Libraries over 4 GB back up too. | Free | `services/disasterRecoveryBackup.ts` |
| Back up from the crash screen | If the app hits an error screen, Back up is offered right there. | Free | `components/common/AppErrorBoundary.tsx` |

### Automatic backup

| Feature | What it does | Status | Where |
|---|---|---|---|
| Automatic backup | Off, Daily or Weekly: keeps one backup current in a folder you pick once. Off by default. | Free (needs a build with the folder feature) | `services/automaticBackup.ts`, `domain/automaticBackupPrefs.ts` |
| Backup folder | Shows the chosen folder and lets you change it; iCloud Drive keeps it off the phone. | Free | `services/backupFolderPicker.ts` |
| Status line | "Backed up (when)", or why not: folder unavailable, low space, did not finish, clips missing. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Runs when the app is open and idle | Never during recording; steps aside for anything you start; retries an hour after a failure. | Free | `services/automaticBackupRunner.ts`, `hooks/useAutomaticBackupScheduler.ts` |
| Only new recordings are copied | Each run adds what is new; media no longer used stays 30 days, then goes. | Free | `services/automaticBackup.ts` |

### Reminder

| Feature | What it does | Status | Where |
|---|---|---|---|
| Backup reminder | Off, Weekly, Monthly (default) or Every 3 months. Hidden while automatic backup is on. | Free | `domain/backupPreferences.ts`, `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Reminder dialog | At launch when overdue: Turn off, Settings, or Later. Never on day one. | Free | `App.tsx`, `services/backupStatus.ts` |

### Restoring

| Feature | What it does | Status | Where |
|---|---|---|---|
| Restore from a backup file | Pick a .zip backup you saved. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Restore from the backup folder | Bring back the automatic backup from its folder. | Free | `services/automaticBackup.ts` |
| Merge | Brings the backup back and keeps anything newer on the phone. | Free | `services/libraryMergeRestore.ts` |
| Replace everything | The library becomes the backup; a second question compares its date and size with now. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Size and time shown | The restore question says how big the backup is and how long it takes. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Checked before anything changes | Every file is verified; on a failure nothing in the library is touched. | Free | `services/disasterRecoveryRestore.ts` |
| Restore an incomplete backup | A backup that was already missing clips can still restore everything else. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Not while recording | "Finish recording first" protects a take in progress. | Free | `components/SettingsScreen/hooks/useLibraryBackupFlow.ts` |
| Restore complete, restart | A page sums up what came back and restarts the app. | Free | `components/common/RestoreRestartGate.tsx` |
| Plain reasons for a failure | Not a SongNook backup, needs a newer app, damaged, and so on, each in one sentence. | Free | `services/disasterRecoveryErrors.ts` |
| Wrong kind of file caught | A shareable archive picked for Restore is recognised and you are pointed to Import. | Free | `services/archiveKind.ts` |
| Restore on a new phone | The welcome screen's first page offers "Restore backup". | Free | `components/common/WelcomeFlow.tsx` |
| Android phone-to-phone transfer | Android 12+ setup transfer carries the whole library; Google's cloud backup carries nothing. | Free (Android) | `plugins/withSongNookBackupRules.js` |

---

## Storage and archive

### Storage & repair (Settings › Data & storage)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Storage totals | Library storage, archived workspaces and temporary files, one line each. | Free | `components/SettingsScreen/views/SettingsStorageView.tsx`, `services/storageDetails.ts` |
| Check library | Scans for broken links, missing audio and stray files, and reports what it found. | Free | `services/integrityScanner.ts` |
| Recover audio files | Finds audio on the phone the library lost track of and brings it back. | Free | `services/audioRecovery.ts` |
| Support details | A fold-out with the full breakdown and internal locations, for support. | Free | `components/SettingsScreen/views/SettingsStorageView.tsx` |
| Erase everything | Deletes every idea and setting after two confirmations and the phone's own lock. | Free | `components/SettingsScreen/hooks/useEraseAllData.ts`, `services/eraseAllData.ts` |
| Recently deleted | A row with the count; deleted things wait 30 days. (Detailed by another agent.) | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx`, `state/recentlyDeleted.ts` |

### Archiving a workspace (workspace list)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Archive a workspace | Packs its clips into one file on the phone; nothing is deleted. | Free | `components/WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts`, `services/workspaceArchive.ts` |
| Unarchive | Unpacks it and returns it to your active list, exactly as it was. | Free | `components/WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts` |
| Archive or unarchive several | Select workspaces and do it in one pass, with a summary. | Free | `components/WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts` |
| One must stay active | The last active workspace cannot be archived. | Free | `components/WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts` |
| Archived is read-only | An archived workspace cannot be edited or recorded into ("Unarchive to edit"). | Free | `hooks/useReadOnly.ts` |
| Move package to Files | Saves an archived workspace's package off the phone, then frees the space here. | Pro | `components/WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts:179` |
| "Confirm the package saved" (iPhone) | The local copy is deleted only after you confirm the file landed. | Pro | `components/WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts` |
| Bring a moved workspace back | Unarchive asks for the package file and restores from it. | Free | `components/WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts` |
| Interrupted archive finishes itself | An archive or unarchive cut short by a quit is completed at next launch. | Free | `services/workspaceArchiveRecovery.ts` |

### Housekeeping the app does on its own

| Feature | What it does | Status | Where |
|---|---|---|---|
| No stranded audio | When something leaves the library, its files go to a trash for 31 days, then are removed. | Free | `state/mediaCleanup.ts`, `services/managedMedia.ts` |
| Trash safety net | At launch, any file the library still points at is pulled back out of the trash. | Free | `domain/trashRestore.ts`, `App.tsx` |
| Temp files swept | Leftover share, export and backup files are removed at launch. | Free | `App.tsx` |
| Picker copies removed | Copies the file picker made for an import are deleted once used. | Free | `services/pickedCopies.ts` |
| Shared-in copies removed | Copies of files shared into SongNook are deleted after import or after a day. | Free | `services/sharedInCopies.ts` |

---

## Data safety

| Feature | What it does | Status | Where |
|---|---|---|---|
| "SongNook can't save" bar | A red bar while saving fails ("Free up space, then try again"). | Free | `components/PersistFailureBanner.tsx` |
| "Saving in backup mode" bar | Shown when writes land only in the fallback store ("Back up soon"). | Free | `components/PersistFailureBanner.tsx` |
| "Saving is paused" bar | Shown when a safety check stops all writes ("Back up now, then restart"). | Free | `components/PersistFailureBanner.tsx` |
| Library from a newer app | If a newer SongNook saved the library, this one stops saving rather than strip it. | Free | `components/PersistFailureBanner.tsx` |
| "Couldn't open your library" | A retry screen instead of an empty library when the disk read fails. | Free | `App.tsx` |
| "Restore your library?" | If the app opens empty but a copy is on the phone: Restore, Not now, or Start fresh. | Free | `App.tsx` (`askAboutSafetyCopy`) |
| Start fresh is deliberate | Only a confirmed "Start fresh" lets the held copy go; "Not now" asks again next launch. | Free | `App.tsx` |
| "Part of your library didn't load" | A workspace that cannot be read is set aside and you are told. | Free | `App.tsx` |
| "Newer copy found" | If a newer copy than what loaded exists on the phone: Restore or Keep this. | Free | `services/manifestFreshness.ts`, `App.tsx` |
| Second copy of the library | A shadow copy of all titles, notes and lyrics is kept on disk for recovery. | Free | `services/manifestSync.ts` |
| Guard against sudden loss | A write that would shrink the library sharply without your say-so is refused. | Free | `services/stateIntegrity.ts` |
| Clip recovered after a crash | A take cut short by a crash or kill is recovered at next launch and you are told. | Free | `services/recordingRecovery.ts` |
| Unfinished sketch recovered | A sketch left mid-creation by a quit becomes a real sketch, or the clip it was. | Free | `domain/draftRecovery.ts` |
| Crash screen with ways out | Back up, Open Home (skipping the page that failed), or Restart. | Free | `components/common/AppErrorBoundary.tsx`, `services/crashSetAside.ts` |
| One heavy job at a time | Backup, restore, import, archive and recovery never overlap; recording waits for them. | Free | `services/libraryOperationGate.ts` |
| Full disk during a take | The take stops cleanly before the disk fills and keeps what was captured. | Free | `services/takeStorageWatch.ts` |
| Screen stays on for long jobs | The phone does not sleep during a backup, restore or export. | Free | `components/LibraryProcessHost.tsx` |
| Diagnostic log kept on the phone | Crashes and every save outcome are logged locally; nothing is sent anywhere. | Free | `services/crashLog.ts`, `services/persistLog.ts` |
| Pro status never rides a backup | Free-month dates and founding status live in the phone's secure store, not in backups. | Free | `services/freeMonthClock.ts` |

---

## Settings

### Settings home

| Feature | What it does | Status | Where |
|---|---|---|---|
| SongNook Pro row | Shows where you stand (Active, Yours for good, n free days left, Free) and opens the Pro page. | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |
| Preferences | Door to the preferences page. | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |
| Data & storage | Door to backups and storage; shows the last backup date or a running backup's progress. | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |
| Help & about | Door to version, legal pages and credits. | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |
| Feedback and feature requests | Opens the feedback sheet. | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |
| Rate SongNook | Opens the store's write-a-review page. | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |

### Preferences

| Feature | What it does | Status | Where |
|---|---|---|---|
| App language | English, Hebrew, Spanish, German or Portuguese; asks to restart. | Free | `components/SettingsScreen/views/SettingsGeneralView.tsx` |
| Name suggestions | Language of the suggested idea names: Auto or one of the five. | Free | `components/SettingsScreen/views/SettingsGeneralView.tsx` |
| Word tools | Language the word tools search in: Auto or one of the five. | Free | `components/SettingsScreen/views/SettingsGeneralView.tsx`, `domain/wordLanguage.ts` |
| Open to | Start in the Primary workspace or the Last used one (default). | Free | `components/SettingsScreen/views/SettingsGeneralView.tsx` |
| Interface haptics | Turns every vibration in the app on or off (on by default). | Free | `components/SettingsScreen/views/SettingsGeneralView.tsx`, `design/haptics.ts` |
| Name each clip | Ask for a name after each recording, or not (on by default). | Free | `components/SettingsScreen/views/SettingsGeneralView.tsx` |
| Bluetooth calibration | Opens the calibration page; shows how many calibrations are saved. | Free | `components/SettingsScreen/views/SettingsGeneralView.tsx` |

### Data & storage (each row; details in the sections above)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Back up row | Starts a backup; shows progress or the last verified backup. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Restore row | Starts a restore from a file or the backup folder. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Automatic backup row | Off, Daily, Weekly. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Backup folder row | Appears when automatic backup is on. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Reminder row | Off, Weekly, Monthly, Every 3 months. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Copy backup file name | Copies the last backup's file name, to find it in Files. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Export an archive row | Opens the export page. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Import an archive row | Opens the import page. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Sent links row | Opens the list of links you made. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Send from a computer row | Opens browser pairing. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Storage & repair row | Opens storage totals, repair tools and Erase everything. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |
| Recently deleted row | Opens Recently deleted; shows the item count. | Free | `components/SettingsScreen/views/SettingsLibraryView.tsx` |

### Help & about

| Feature | What it does | Status | Where |
|---|---|---|---|
| Version and update | The app version and which update is installed, to quote in a bug report. | Free | `components/SettingsScreen/views/SettingsAboutView.tsx` |
| Feedback and feature requests | The same feedback sheet as on Settings home. | Free | `components/SettingsScreen/views/SettingsAboutView.tsx` |
| Share diagnostic log | Shares the crash log and save journal as one file; Android can also save it to a folder. | Free | `services/diagnosticsBundle.ts` |
| Replay intro | Shows the welcome pages again. | Free | `components/SettingsScreen/views/SettingsAboutView.tsx` |
| Privacy line | "Your library stays on this phone." | Free | `components/SettingsScreen/views/SettingsAboutView.tsx` |
| Privacy policy | Opens songnook.app/privacy. | Free | `config/legalLinks.ts` |
| Terms of use | Opens songnook.app/terms. | Free | `config/legalLinks.ts` |
| Open data credits | Eight sources the word tools and books draw on, each a link. | Free | `config/openData.ts` |

### Dev-only (never in a store build)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Collection menu test rows | Import samples, receive samples, stage a store library, preview the Pro page. Development builds only. | Free (dev builds only) | `components/IdeaListScreen/components/CollectionHeaderMenu.tsx` |
| Force Pro on or off | From the debugger only, for testing gates. No screen for it. | Free (dev builds only) | `domain/entitlements.ts` (`setDevProOverride`) |

No dev-only rows were found inside Settings itself.

---

## Languages

| Feature | What it does | Status | Where |
|---|---|---|---|
| Five app languages | English, Hebrew, Spanish, German, Brazilian Portuguese. | Free | `i18n/languages.ts` |
| Follows the phone at first launch | The app starts in the phone's language when it is one of the five. | Free | `i18n/locale.tsx` |
| Language picker on the welcome page | Change the language before anything else, each named in its own script. | Free | `components/common/LanguageSelect.tsx` |
| Right-to-left layout for Hebrew | The whole layout mirrors; Hebrew fonts replace the Latin ones. | Free | `i18n/locale.tsx`, `App.tsx` |
| Dates and numbers per language | Dates and numbers follow the chosen language's conventions. | Free | `i18n/formatLocale.ts` |
| Text direction per line | A Hebrew title in an English app (and the reverse) reads in its own direction. | Free | `i18n/direction.tsx` |
| Language travels in a backup | A restore on a new phone brings the chosen language back. | Free | `services/satelliteSnapshot.ts` |
| Web pages are English only | The Send web pages, privacy and terms are in English. | Free | `server/songnook-send/src/pages` |

---

## Pro, the free month and founding members

### The Pro page

| Feature | What it does | Status | Where |
|---|---|---|---|
| The Pro page | One full-screen page, opened by every gate and by the Settings row; closes with ✕. | Free | `components/common/ProUpsellSheet.tsx` |
| What Pro adds | Five lines: setlists/transpose/capo, 8 layers, practice tools and editor, word tools, unlimited Send and workspaces. | Free | `domain/proCatalog.ts` (`PAYWALL_ROWS`) |
| Promise line | "Your clips stay on your phone. No ads, no AI training." | Free | `components/common/ProUpsellSheet.tsx` |
| Yearly plan | $24.99 a year, "Billed once a year", tagged "Save 48%" (worked out from store prices). | Pro (the purchase itself) | `components/common/ProUpsellSheet.tsx`, `services/billing.ts` |
| Monthly plan | $3.99 a month, "Cancel anytime". | Pro (the purchase itself) | `components/common/ProUpsellSheet.tsx` |
| Lifetime plan | $59.99 once, "Launch price until (date), then $79.99"; the date is 90 days after release. | Pro (the purchase itself) | `domain/freeMonth.ts` (`lifetimeLaunchEndsAt`) |
| Prices in your currency | The store's own prices replace the printed dollar ones once the store answers. | Free | `services/billing.ts` |
| Get Pro | Buys the chosen plan through the App Store or Google Play. | Free | `services/billing.ts` (`purchasePro`) |
| Restore | Brings back a purchase made on the same store account. | Free | `services/billing.ts` (`restorePurchases`) |
| Renewal note | "Yearly and monthly renew until cancelled. Cancel in your App Store account." | Free | `components/common/ProUpsellSheet.tsx` |
| Terms and Privacy links | Open the legal pages from the Pro page. | Free | `components/common/ProUpsellSheet.tsx` |
| "You have Pro" | A buyer or founding member sees their plan's line instead of prices. | Free | `components/common/ProUpsellSheet.tsx` |
| Renewal or end date | "Renews (date)", "Ends (date)", "Lifetime. Paid once." or "Founding member. Yours for good." | Free | `components/common/ProUpsellSheet.tsx` |
| Manage subscription | Opens the store's own subscription page. | Free | `services/billing.ts` (`manageSubscriptionUrl`) |
| See plans | A subscriber can unfold the prices to change plan; hidden for lifetime owners. | Free | `components/common/ProUpsellSheet.tsx` |
| Purchase messages | "The purchase didn't go through", "Couldn't reach the store", "Nothing to restore yet", said on the page. | Free | `components/common/ProUpsellSheet.tsx` |
| Pro across the same store account | A purchase follows the Apple or Google account, not the phone. No SongNook account exists. | Free | `services/billing.ts` |

### The free month

| Feature | What it does | Status | Where |
|---|---|---|---|
| Free month | Every Pro tool for 30 days from first launch, no card, once per device. | Free | `domain/freeMonth.ts`, `services/freeMonthClock.ts` |
| Days left on the Settings row | "n free days left" beside SongNook Pro. | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |
| Days left on the Pro page | "Free month · n days left", or "Your free month has ended. Everything you made stays yours." | Free | `components/common/ProUpsellSheet.tsx` |
| "A few days left" note | One toast at 5 days or fewer, with a "See Pro" button. | Free | `components/common/FreeMonthNotices.tsx` |
| "Ends today" note | One toast on the last day, with "See Pro". | Free | `components/common/FreeMonthNotices.tsx` |
| After it ends | The Pro page opens once, by itself, the first time the app is opened after the month. | Free | `components/common/FreeMonthNotices.tsx` |
| The month cannot be restarted | Reinstalling (iPhone), restoring a backup or setting the date back does not reopen it. | Free | `services/freeMonthClock.ts` |
| A wrong clock does not end it | One launch with the date far ahead does not end the month for good. | Free | `domain/freeMonth.ts` (`advanceFreeMonthClock`) |

### Founding members

| Feature | What it does | Status | Where |
|---|---|---|---|
| Founding membership | A phone that first launched before 2026-11-11 has Pro for good, no purchase. | Free | `domain/freeMonth.ts` (`decideFounding`) |
| "Yours for good" | The Settings row and Pro page say so; no notices, no buy key. | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |
| Survives a reinstall on iPhone | Kept in the Keychain; an Android reinstall or a new phone loses it. | Free (iPhone keeps it) | `services/freeMonthClock.ts` |
| Not Pro on the Send server | Once the server checks, a founding member gets the free 3 links there. Not in force today. | Free | `server/songnook-send/src/lib/access.ts` |

### What stays free and what happens when Pro ends

| Feature | What it does | Status | Where |
|---|---|---|---|
| Nothing is lost when Pro ends | Work made with Pro tools still opens, plays and edits; only making new Pro things stops. | Free | `domain/proGating.ts` |
| No lock badges | Nothing in the app is marked as Pro; the Pro page appears only when a gated thing is tapped. | Free | whole app (checked by search) |
| One page for every gate | Every gate opens the same Pro page with the same words; no per-feature message. | Free | `components/common/proUpsell.ts` |
| Received items use Pro tools free | See Received above. | Free | `components/common/proUpsell.ts` |
| Purchases on old builds | A build without the purchase code says "Purchases aren't open yet." | Free | `services/billing.ts` |

### Every place the Pro page opens for a free user (complete list from code)

| Feature | What it does | Status | Where |
|---|---|---|---|
| A 4th workspace | The + on the workspace list, with 3 unarchived workspaces already. | Free up to 3 workspaces, then Pro | `components/WorkspaceListScreen/components/WorkspaceListScreenContent.tsx:201` |
| A 2nd layer on a take | Adding a layer when the take already has one (8 at most with Pro). | Free up to 1 layer per take, then Pro | `components/PlayerScreen/index.tsx:1292` |
| Pins, pitch, analysis, Step up | Using one of these practice tools (plain loop and speed are free). | Pro | `components/PlayerScreen/index.tsx:1321` |
| Editor: Speed & pitch tab | Opening the tab in the editor. Trimming and cutting are free. | Pro | `components/EditorScreen/index.tsx:629` |
| Transpose and capo | Changing key or capo on a chart or in the reading sheet. | Pro | `components/common/TransposeChip.tsx`, `components/common/ReadingSheet.tsx` |
| New chart book | Creating a chart book (from Compilations or the chooser sheet). | Pro | `components/LibraryScreen/hooks/useSongbookModel.ts:152`, `components/common/SongbookChooserSheet.tsx` |
| New setlist | Creating a setlist. | Pro | `components/LibraryScreen/hooks/useSetlistModel.ts:172` |
| Chart as PDF | Both PDF export buttons. | Pro | `components/ChordSheetScreen/useChordSheetModel.ts:437` |
| Lyric Spark, 4th try of a game | Starting a spark after 3 tries of that game, counted for good. | Free up to 3 tries per game, then Pro | `components/NotepadScreen/hooks/useNotepadScreenModel.ts:234` |
| Word Finder | Opening the Word Finder from the Lyric Pad or the lyrics editor. | Pro | `components/NotepadScreen/components/NoteEditor.tsx:221`, `components/LyricsVersionScreen/components/LyricsVersionEditor.tsx:73` |
| A 4th Send link in 30 days | Any "SongNook Send" row. | Free up to 3 links per 30 days, then Pro | `state/useSendSheetStore.ts:76` |
| Move package to Files | Moving an archived workspace's package off the phone. | Pro | `components/WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts:179` |
| Settings row | Tapping SongNook Pro in Settings (not a gate, a door). | Free | `components/SettingsScreen/views/SettingsOverviewView.tsx` |
| Free-month notes | "See Pro" on the two toasts, and the one automatic opening after the month ends. | Free | `components/common/FreeMonthNotices.tsx` |

No other gate, limit or lock was found in the app.

---

## Help and feedback

| Feature | What it does | Status | Where |
|---|---|---|---|
| Help sheets ("?") | Short help in the recorder, layers, editor, Step up, takes, chord editor, Shelf, Compilations, word games, Sent links. | Free | `components/common/HelpSheet.tsx`, `components/common/helpContent.ts` |
| Feedback sheet | Type a note (3 to 2,000 characters) and send it without leaving the app. | Free | `components/common/FeedbackSheet.tsx`, `services/feedback.ts` |
| Feedback is anonymous | Sent with app version, system and language only; no name, so no reply is possible. | Free | `server/songnook-send/src/lib/feedback.ts` |
| Draft kept | Words typed stay if the sheet is swiped away, and clear once sent. | Free | `components/common/feedbackSheetStore.ts` |
| Email instead | Opens a mail to SongNook carrying what was typed, for a question that needs a reply. | Free | `components/common/FeedbackSheet.tsx` |
| Rate SongNook | Opens the store's review page (Settings home). | Free | `config/legalLinks.ts` |
| Review prompt | After a saved recording the system may ask for a rating: 10+ clips, 5+ days in, every 120 days. | Free | `services/reviewPrompt.ts`, `domain/firstRun.ts` |
| Welcome intro | First launch shows a short tour; Replay intro in Settings shows it again. | Free | `components/common/WelcomeFlow.tsx` |
| Toasts | Quiet confirmations ("Link copied", "Saved") that fade after 2 seconds. | Free | `components/common/ToastHost.tsx` |
| Undo after delete | A delete shows "In Recently deleted" with Undo for 4 seconds. | Free | `components/common/deleteFeedback.ts` |
| First delete explains itself | The very first delete explains Recently deleted once. | Free | `components/common/deleteFeedback.ts` |
| Haptics | One vocabulary of vibrations for press, drag, success, warning and failure. | Free | `design/haptics.ts` |
| Screen reader labels | Buttons and rows carry spoken labels in every language. No separate accessibility settings. | Free | `i18n/locales/en.ts` (labels throughout) |
| Support page | songnook.app/support, the page the stores link to. | Free | `server/songnook-send/src/pages/legal.ts` |
| Website | songnook.app landing page, with Privacy and Terms. | Free | `server/songnook-send/src/pages/legal.ts` |

---

## What the app does not have, and what needs the internet

| Feature | What it does | Status | Where |
|---|---|---|---|
| No analytics or tracking | No analytics, crash-reporting or advertising code is in the app. | Free | `package.json` (checked) |
| No ads | None. | Free | whole app |
| No account or sign-in | Nothing asks for an email or password. | Free | whole app |
| No push notifications | None are sent. (The lock-screen player and recording card belong to playback.) | Free | `package.json` (no notifications package) |
| No widgets or home-screen shortcuts | None exist. | Free | `app.json` |
| Updates over the air | The app can fetch a newer version of itself at launch; Help & about shows which one runs. | Free | `app.json` (updates), `domain/installedUpdate.ts` |
| Face ID | Used only to confirm Erase everything. | Free | `app.json` |
| Works offline | Recording, playing, editing, lyrics, charts, backup, export and restore need no internet. | Free | whole app |
| Needs internet: Send | Making, opening and deleting links; pairing a browser. | Free | `services/sendTransfer.ts`, `services/receiveTransfer.ts` |
| Needs internet: word tools | Word Finder lookups and Borrowed Words book pages. | Free | `domain/wordTools.ts`, `domain/magpie.ts` |
| Needs internet: purchases | Buying, restoring and reading store prices. | Free | `services/billing.ts` |
| Needs internet: feedback and links | The feedback note, legal pages, open-data links and Rate SongNook. | Free | `services/feedback.ts` |

---

## Built but not reachable

- **Server-side Pro check and the server's 3-link count.** Fully built (`server/songnook-send/src/lib/access.ts`, `lib/senders.ts`), switched off by `PRO_FOR_ALL="true"` and `APP_SEND_ENFORCED="false"`.
- **"This month's 3 free links are used. SongNook Pro sends without limit."** The app's message for a server refusal (`shareLink.sendError.limit`). It can only appear once the server checks.
- **`ProGate` component** (`components/common/ProGate.tsx`): built, used nowhere.
- **`cloud-backup` key** in the catalog: reserved for cloud sync, nothing reads it.
- **`auto-backup` key**: marked free, nothing reads it. (Automatic backup itself is live and has no gate.)
- **`word-sparks-unlimited` key**: retired, nothing reads it.
- **Editor "parts" limit**: the check is still called (`useEditorSelectionState.ts:36`) but has no limit set since 2026-11-13, so it never fires.
- **"Library" parcel kind**: both the app and the server can label a parcel "a SongNook library", but nothing in the app sends one.
- **Unsealed sending** and its hint "Anyone with the link can download for 7 days": only on builds without the encryption code.
- **Android install referrer**: the store link from a Send page carries the link id, but nothing in the app reads it.
- **Download counter**: the server counts downloads per file; no screen shows it.
- **Old Settings strings** with no screen: "SongNook Beta", "Pro unlocked", account "coming later", the Settings count-in rows.
- **Dev-only**: the collection menu's test rows and the debugger overrides for Pro and the free month.

## Worth a decision

1. **The Send limit is enforced only by the app today.** The server flags have not been flipped. Until they are: a free user who pairs a browser sends unlimited links from a computer, and the server accepts unlimited links from the app for anyone who gets past the app's own check. Each link may be 1 GB for 7 days. Rate limits (5 links a minute per address) are the only brake.
2. **Founding members and the Send server.** After the flip, a founding member is refused by the server after 3 links in 30 days, while the app says they have Pro and the Pro page promises "Unlimited Send links". Waived on 2026-11-11; worth a second look before the flip.
3. **"Send from a computer" is open to free users** (inside the same 3 links once the server checks). The pricing record describes it as "paid users send from a computer". Decide: Pro-only, or shared allowance as built.
4. **The 3 free workspaces are easy to exceed.** Only unarchived workspaces count, archiving is free and unarchiving is not checked: archive one, make another, unarchive. Import an archive and "Keep as its own workspace" also add workspaces with no check.
5. **Two Pro features are not on the Pro page.** Chart PDF export and "Move package to Files" are gated but not among the five lines.
6. **"Move package to Files" is Pro; bringing it back is free.** It is the only way to free space while keeping a workspace. Confirm that is the intended line.
7. **Automatic backup is free** (the founder's rule: backup is never locked). It is the kind of feature apps usually sell; confirming the choice.
8. **Pro has no Send ceiling.** Unlimited links of up to 1 GB each. Pennies per link, but nothing caps a heavy sender.
9. **A failed send can use up a free link.** If the last step fails, the phone has already counted it. Small, but a free user could lose one of three to a bad connection.
10. **The free count is per device.** Erase everything or an Android reinstall resets it. On the server (once on) it is per install, which an Android reinstall also resets, along with a fresh free month there.
11. **"A link anyone can play"** (the Share menu's hint for Send). The web page offers downloads, not playback. A sketch, collection, workspace, setlist, playlist or chart book link gives a browser visitor only a SongNook package file they cannot open without the app.
12. **The lifetime price must be changed by hand, and the printed date depends on the time zone.** The launch price ends at midnight UTC on 2027-02-09. The Pro page prints that moment in the phone's own time zone: "February 9" in Europe and Israel, "February 8" in the Americas. Pick the day the store price changes with that in mind.
13. **Wording drift in the repo's own docs.** The working agreement says deleted files wait 14 days. The app says and does 30 days (Recently deleted) and 31 days (file trash).

## Not sure

- **Whether the live Send server matches the repo.** I read `wrangler.toml` only; I did not (and was told not to) query the deployed worker. Its flags, the RevenueCat secret and the iOS store link may differ from the file.
- **Whether the builds people have include automatic backup and sealing.** Both need native code that exists in the repo (`modules/songnook-file-io`); the app hides or downgrades them when it is missing. I did not check which store build carries it.
- **Links opening the app on a real phone.** The app and server are configured for it (`app.json`, `.well-known` files); not tested on a device.
- **Store prices and products.** The printed prices and plan names come from code; what App Store Connect, Play and RevenueCat actually hold cannot be seen from the repo.
- **Screen reader coverage.** Labels are present on the controls I read; I did not audit every screen.
- **Hebrew and right-to-left.** Confirmed in code only, not on screen.
- **Help sheets list.** Taken from a search for the help component; the word games use their own help sheets, which another agent covers.
- **Import an archive and duplicates.** I did not confirm whether importing the same archive twice creates duplicates.
