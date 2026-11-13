# 06 — Every place we tell people what SongNook does, what is free, what is paid, or what a limit is

Audited 2026-11-13 against `main` at 2442cd38 ("Cutting a take into parts is free"). Read-only.

## How to read this

**Code truth used for the "matches?" column** (`src/domain/proCatalog.ts`, `src/domain/proGating.ts`, `src/domain/freeMonth.ts`):

- Pro: workspaces beyond 3 · layers beyond 1 per take (8 is the cap for everyone) · pins, pitch, tempo analysis and Step up in the player (plain loop and speed are free) · the editor's Speed & pitch tab (cutting a take into any number of parts is free since today) · transpose, capo, creating chart books and setlists (writing and reading charts is free) · PDF export of charts · the whole Word Finder · Lyric Spark games beyond 3 tries each · Send beyond 3 links per 30 days · offloading an archived workspace to Files.
- Free month: 30 days, no card. Founding installs (first launch before 2026-11-11) keep Pro.
- Prices: Yearly $24.99 · Monthly $3.99 · Lifetime $59.99 until 2027-02-09, then $79.99.

**"How it is changed" codes**

- **APP** — an in-app string. English source is `src/i18n/locales/en.ts`; the same key exists in `es.ts`, `de.ts`, `pt.ts`, `he.ts` and all five must change together. Ships by app update (strings are JS, so an over-the-air update carries them; no store review).
- **DOC** — a document that is only our own record. Edit the file; nothing ships.
- **ASC** — a field in App Store Connect. Description, subtitle, keywords, screenshots and What's New change only with a new app version (review). Promotional text can change at any time without review. In-app purchase names, descriptions and review screenshots are reviewed per product.
- **PLAY** — a field in Play Console. Listing changes go through Play's own listing review.
- **SERVER** — the Send worker in `server/songnook-send`. Edit, run `npm run build:legal` if a legal doc changed, deploy with `--config ./wrangler.toml`. Web pages are English only.

**Three findings that shape everything below**

1. A gate never says why. Every gate calls `ensurePro` / `openProUpsell` (`src/components/common/proUpsell.ts`) and opens the one Pro page. There is no per-feature upsell text, no lock glyph, no "PRO" badge, no "2 tries left", no "1 link left" anywhere in the app. `ProGate.tsx` exists and is unused. So in the app, the free/Pro line is stated in only two places: the Pro page's five lines, and one Send error string.
2. Nothing in the store description, terms, privacy policy or reviewer notes says that multi-part editing is Pro. Today's editor change makes only the Pro page's third line and the old purchase-review screenshot stale.
3. The numbers "3 links" and "3 tries" are written out as digits or words in the terms, the Send error (five languages), and the web sender page (twice), separately from `proCatalog.ts`. The Send server also has its own copy of the limit (`server/songnook-send/src/lib/access.ts:8`, `FREE_LINKS = 3`). Changing `freeLimit` in the catalog changes none of them.

---

## Pro page

Component: `src/components/common/ProUpsellSheet.tsx`. Strings: `pro` group, `src/i18n/locales/en.ts:1656` (es 3611+, de 3469+, pt 3612+, he 1715). The five lines map to `PAYWALL_ROWS` in `src/domain/proCatalog.ts:168`. `src/__tests__/proCatalog.test.ts` fails if a line's keys stop being gated or the line count differs from `PAYWALL_ROWS`.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| `en.ts:1656` `pro.eyebrow` / `headline` / `subhead` | "SongNook Pro" · "Finish more songs" · "Your clips stay on your phone. No ads, no AI training." | Yes. A privacy promise, not a split claim. Safe under any split. | APP |
| `en.ts:1656` `pro.features.0` (keys: `stage-tools`) | "Setlists, transpose and capo" | Yes. Creating setlists, transpose and capo are Pro. Chart books (also Pro to create) are not named. Re-check if `stage-tools` moves. | APP + `PAYWALL_ROWS` |
| `en.ts:1656` `pro.features.1` (keys: `overdub-layers`) | "Up to 8 layers on a take" | Yes. Free gets 1; 8 is `MAX_LAYERS_PER_TAKE` (`src/domain/overdub.ts:147`). Wrong if the free count stops being less than 8 or the cap changes. | APP + `PAYWALL_ROWS` |
| `en.ts:1656` `pro.features.2` (keys: `practice-suite`, `full-editor`) | "Practice tools and the full editor" | **Stale in spirit.** "The full editor" now means only the Speed & pitch tab; cutting into parts became free today. "Practice tools" is loose too: plain loop and speed are free. `pricing-and-marketing.md:258-260` records that the rewording waits on the founder's new order for the page. | APP + `PAYWALL_ROWS` |
| `en.ts:1656` `pro.features.3` (keys: `word-finder-full`, `lyric-spark`) | "Word Finder and every word game" | Yes, loosely. The whole Word Finder is Pro; each game has 3 free tries first, which the line does not say. Re-check if either moves. | APP + `PAYWALL_ROWS` |
| `en.ts:1656` `pro.features.4` (keys: `send`, `workspaces`) | "Unlimited Send links and workspaces" | Yes. Free is 3 links per 30 days and 3 workspaces. Wrong if either limit is removed. | APP + `PAYWALL_ROWS` |
| Pro page, by omission | Nothing about chart PDF export or archive offload | Both are gated (`pdf-export`, `archive-offload`) and advertised nowhere. A free user meets the Pro page from "PDF" or "Move package to Files" with no line that explains it. | APP + `PAYWALL_ROWS` if they should be named |
| `en.ts:1656` `pro.plans.annual` | "Yearly" · "$24.99 / year" · "Billed once a year" · "Save {{percent}}%" | Yes. The printed percent is `PRINTED_SAVING_PERCENT = 48` (`ProUpsellSheet.tsx:46`), a constant that must change with either price. Store prices replace the printed ones when RevenueCat answers. | APP (+ the constant) |
| `en.ts:1656` `pro.plans.monthly` | "Monthly" · "$3.99 / month" · "Cancel anytime" | Yes. | APP |
| `en.ts:1656` `pro.plans.lifetime` | "Lifetime" · "$59.99" · "$79.99" · "Pay once. Launch price until {{date}}, then $79.99." · "Pay once. Launch price, later $79.99." · "Pay once." | Yes. The date is 2027-02-09 (`freeMonth.ts` `APP_STORE_RELEASE_AT` + 90 days). The store price must be raised by hand that day or the line becomes false. | APP (+ the release date constant; + ASC and PLAY price) |
| `en.ts:1656` `pro.freeMonthLeft` / `freeMonthEnded` | "Free month · {{count}} days left" · "Your free month has ended. Everything you made stays yours." | Yes (30 days, `FREE_MONTH_DAYS`). | APP |
| `en.ts:1656` `pro.ownedHeadline` / `ownedFounding` / `ownedLifetime` / `ownedRenews` / `ownedEnds` | "You have Pro" · "Founding member. Yours for good." · "Lifetime. Paid once." · "Renews {{date}}" · "Ends {{date}}" | Yes. | APP |
| `en.ts:1656` `pro.renewNoteIos` / `renewNoteAndroid` | "Yearly and monthly renew until cancelled. Cancel in your App Store account." (Android: "…Google Play account.") | Yes. Required by Apple 3.1.2. Names the two subscription plans; wrong if a plan is dropped or renamed. | APP |
| `en.ts:1656` `pro.getPro` / `restore` / `terms` / `privacy` / `manage` / `seePlans` / `purchaseUnavailable` | "Get Pro" · "Restore" · "Terms" · "Privacy" · "Manage subscription" · "See plans" · "Purchases aren't open yet." | Yes. No split claim. | APP |

## Upsell and limit messages in the app

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| Every gate: `useSendSheetStore.ts:76`, `EditorScreen/index.tsx:629`, `useEditorSelectionState.ts:36`, `PlayerScreen/index.tsx:1292` and `:1321`, `ChordSheetScreen/useChordSheetModel.ts:437`, `chords/useChordExport.ts:30`, `SongbookChooserSheet.tsx:78`, `ReadingSheet.tsx:74`, `TransposeChip.tsx:34`, `NoteEditor.tsx:221`, `LyricsVersionEditor.tsx:73`, `useNotepadScreenModel.ts:235`, `WorkspaceListScreenContent.tsx:201`, `useSongbookModel.ts:152`, `useSetlistModel.ts:172`, `useWorkspaceArchiveActions.ts:179` | No text of its own. Each opens the Pro page. | n/a. Nothing to update when a gate moves, and nothing tells the person which limit they hit. | Code only |
| `FreeMonthNotices.tsx:33-35`; `en.ts:1657` `freeMonth.daysLeft` / `endsToday` / `seePro` | "{{count}} free days left" (toast when 5 or fewer days remain) · "Free month ends today" · "See Pro" | Yes (`FEW_DAYS_LEFT = 5`). After the month ends the Pro page opens once by itself. | APP |
| Settings plan row: `SettingsOverviewView.tsx:110-140`; `en.ts:522-524` | Row "SongNook Pro" with one of "Active" · "Yours for good" · "{{count}} free days left" · "Free" | Yes. States the plan only, no limits. | APP |
| `en.ts:526` `settings.proUnlocked` | "Pro unlocked" | Not shown anywhere: no call site reads it. Left over from the beta plan line. | APP (or delete) |
| `en.ts:1598` `shareLink.sendError.limit`; raised at `src/services/sendTransfer.ts:100` when the server answers 402 | "This month's 3 free links are used. SongNook Pro sends without limit." | Yes today. The "3" is typed into the sentence in all five languages. "This month" is really a rolling 30 days. Rarely seen: the app's own count opens the Pro page first. | APP |
| `en.ts:920` `player.layerLimitTitle` / `layerLimitBody`; `PlayerScreen/index.tsx:1278` | "Eight layers" · "Combine them to keep layering." | Yes. A cap for everyone, not a Pro gate. "Eight" is spelled out in five languages; change with `MAX_LAYERS_PER_TAKE`. | APP |
| `en.ts:1587` `sendSheet.expiryHint` / `sealedHint` | "Anyone with the link can download for 7 days." · "Only people with the link can open it, not even SongNook." | Yes (`EXPIRY_DAYS = "7"` in `wrangler.toml`; sealing on). Not split-dependent. | APP (+ SERVER if the days change) |
| `en.ts:1589` `shareLink.tooLargeBody` | "Links carry up to {{limit}}. Share as a file instead." | Yes. The size is filled in from `SEND_MAX_TRANSFER_BYTES` (1 GB, `src/config/sendService.ts:26`). Safe. | APP |
| `en.ts:1751-1752` `sendComputer.title` / `intro` | "Send from a computer" · "Open send.songnook.app on your computer and type the code it shows." | Yes. No plan claim in the app; the web page states the count (see Website). | APP |
| `en.ts:596` `settingsAbout.privacyLine` | "Your library stays on this phone." | Yes. Not split-dependent. | APP |
| `en.ts:371` `collection.proPreviewDev` | "Pro sheet (dev)" | Dev builds only. Says "sheet" for what is now a page. Never shown to users. | APP |

## Welcome flow

Component: `src/components/common/WelcomeFlow.tsx` and `src/components/welcome/WelcomeScenes.tsx`. Strings: `welcome` group, `en.ts:1511-1574`. The flow never says free, Pro, a price or a limit. Every row below is safe under any split; the note says which paid tool each pane shows, so we know what a new user is being promised during the free month.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| `en.ts:1513` `welcome.tagline` | "A quiet corner to finish songs." | Yes. Same tagline as the store subtitle. | APP |
| `en.ts:1515-1517` sketches pane | "Every idea grows into a song" · "Gather your takes in one sketch. Every version is kept, nothing overwritten." | Yes. All free. | APP |
| `en.ts:1518-1520` words pane | "Lyrics and chords, every draft kept" · "Write the words, keep each version, find the rhyme, chart the chords." | Yes. "find the rhyme" is the Word Finder, which is Pro. Vague enough. | APP |
| `en.ts:1521-1523` practice pane | "Learn it, then layer it" · "Loop the hard part, work it up to speed, then record a harmony over your take." | Yes. Loop, speed and one layer are free; "work it up to speed" reads as Step up, which is Pro. Vague enough. | APP |
| `en.ts:1524-1526` share pane | "Send it to the band" · "Send a clip, a set or a whole collection to anyone. Your notes and marks go with it." | Yes. Free allows 3 links per 30 days; making "a set" is Pro. No number given. | APP |
| `en.ts:1527-1529` Shelf and Revisit pane | "Never lose a gem" · "Shelve ideas for later. Revisit brings back the ones you forgot about." | Yes. All free. | APP |
| `en.ts:1530-1532` organize pane | "Get organized" · "A workspace for each project, collections inside. Bring your voice memos along." | Yes. "A workspace for each project" stops at 3 for free. No number given. | APP |
| `en.ts:1533` `welcome.demo.*` (the drawn sample screens) | "v2 · Slower, with capo" · "Friday at the Blue Room" · "9 songs · Friday" · "Sent · lyrics, chords, 4 pins" · "Harmony here" | Yes as illustration. Shows capo, a setlist and pins, all Pro to make. | APP |
| `en.ts:1537-1549` older pane strings (`captureTitle`, `organizeTitle`, `growTitle`, `writeBody` …) | "Lyric Pad holds loose lines; Lyric Spark knocks new ones loose." and others | Not rendered by the current flow (no call site in `WelcomeFlow.tsx`). No plan claim. | APP (or delete) |

## Help sheets

No help sheet mentions Pro, free, a price or a plan limit. The rows are the sheets that explain a tool that is paid, so a rename or a moved gate can be checked against them.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| `en.ts:1806-1814` `helpContent.editor` | "Edits save as a new clip. The original stays." · "Keep marks become clips of their own. Remove marks are cut out." · "Speed & pitch" · "Bakes the change into the new clip, unlike the practice tools." | Yes. Describes multi-part cutting (free since today) and the Speed & pitch tab (Pro) without saying either is paid. Safe. | APP |
| `en.ts:1795-1805` `helpContent.overdub` | "Layers ride the take. The take stays untouched." · "Combine the layers first. Trimming the take would break their alignment." | Yes. No count stated. Safe. | APP |
| `en.ts:1776-1785` `helpContent.send` | "Anyone with the link can download until it expires or you delete it." · "Only people with the link can open what you send. Not even SongNook can." · "Seven days" · "Links expire on their own, then the files are deleted." · "Delete a link in Sent links. It stops working at once." | Yes. States the 7-day limit, not the 3-link allowance. | APP |
| `en.ts:913` `player.stepUpHelp*`; `PlayerPracticeDrawers.tsx:925` | "Loop a part slowly to practice up to speed. It speeds up as you repeat." · "Speed changes playback, never the pitch." | Yes. Step up is Pro; the sheet does not say so. Safe. | APP |
| `en.ts:854-858` Compilations help | "Three ways to gather finished work." · "Lyric and chord charts, read like a book." · "Songs packed with their takes and charts, to share with the band." | Yes. Making chart books and setlists is Pro; playlists are free. Safe. | APP |
| `en.ts:1448-1452` `cutUpHelp`, `magpieHelp`, `wordLadderHelp` | How each word game works | Yes. None mentions the 3 free tries. Safe. | APP |
| `en.ts:1786-1794` `helpContent.recording` | "Up to four bars of clicks before recording starts." | Yes as far as checked. Free tool, a feature limit. Not split-dependent. | APP |

## App Store listing

The record of what is live is `docs/product-plan/store-truth.md` §6 ("live in both consoles since 2026-10-25", three SHARE lines and eight screenshots saved 2026-11-10). I could not read App Store Connect itself, so "matches" means the recorded text against the code.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| Subtitle · `store-truth.md:174` | "A quiet corner to finish songs" | Yes. No claim. | ASC, new version |
| Promotional text · `store-truth.md:176` | "A quiet corner to finish songs. Catch ideas the moment they hit, find them again, rehearse them until they're done. No account, and your songs stay on your phone." | Yes. Safe. | ASC, no review |
| Keywords · `store-truth.md:177` | "songwriting,songwriter,lyrics,chords,voice memo,recorder,song ideas,setlist,tuner,metronome,demo" | Yes. "setlist" is a Pro-to-create feature; fine as a keyword. | ASC, new version |
| Description, opening · `store-truth.md:186-188` | "SongNook records your song ideas, keeps them organized, and helps you finish them. No account, no ads." · "Your songs stay on your phone. We never see them, and they are never used to train AI." | Yes. Safe. | ASC, new version |
| Description, FINISH THE SONG · `store-truth.md:204-205` | "Record layers over a take and solo any of them" · "Collections and workspaces to keep it all in order" | True of the app. Free gets 1 layer and 3 workspaces; the line gives no count. Safe unless a gate becomes total. | ASC, new version |
| Description, REHEARSE · `store-truth.md:208-212` | "Mark sections, drop pins and add notes on the timeline" · "Change speed without changing pitch, and pitch without changing speed" · "Loop any part" · "Step up - work a hard part up to speed…" · "Count-in, click, tuner and metronome" | True of the app. Pins, pitch and Step up are Pro; loop, speed, tuner and metronome are free. Not marked either way. | ASC, new version |
| Description, WRITE · `store-truth.md:215-217` | "Word Finder - rhymes, near rhymes, synonyms" · "Lyric Spark - games for writer's block" · "Lyric Pad - a home for loose lines" | True of the app. Word Finder is wholly Pro; games have 3 free tries. | ASC, new version |
| Description, SHARE · `store-truth.md:220-227` | "SongNook Send - share clips or a whole sketch… by private link" · "Sealed - only people with the link can open what you send, not even SongNook" · "Playlists, setlists, and chart books with transpose, capo and an autoscrolling stage reader" · "Back up and export to Files, iCloud Drive or wherever you keep things" · "Export for DAW - a WAV that starts on a bar, tempo in its name" · "Send from a computer - pair a browser with a code and send from there" | True of the app. Send is 3 links per 30 days free; making setlists and chart books, transpose and capo are Pro; reader, backup, export and DAW export are free (no gate found). | ASC, new version |
| Description, PRO paragraph · `store-truth.md:229-230` | "Your first month includes every tool, free, no card needed. After that, recording, writing and organizing your songs stay free, and SongNook Pro unlocks the extended tools." | Yes, and vague on purpose. Two soft spots: the Word Finder sits under WRITE but is Pro, and a fourth workspace is "organizing" but is Pro. This is the only sentence in the listing that states the split. | ASC, new version |
| Description, Apple-only paragraph · `store-truth.md:236-238` | "SongNook Pro is available as a yearly or monthly subscription, or a one-time lifetime purchase. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period…" | Yes. Wrong only if a plan is added or dropped. | ASC, new version |
| Screenshot 3 · `store-truth.md:261`; `scripts/store/compose-screenshots.py:35` | "Lyrics and chords, every draft kept / Write, chart and transpose in one place." | True of the app. Transpose is Pro. | ASC, new version (re-cut with the script) |
| Screenshot 4 · `store-truth.md:262`; script `:36` | "Learn it, then layer it / Loop the hard part, slow it down, add a harmony." (the screen shows a pin, a layer, a loop, 0.75× and +2 st) | Caption is all free tools. The picture shows a pin and a pitch shift, both Pro. | ASC, new version |
| Screenshot 5 · `store-truth.md:263`; script `:37` | "Stuck on a line? / Lyric Spark: word games to get past writer's block." | True of the app. 3 free tries per game. | ASC, new version |
| Screenshot 6 · `store-truth.md:264`; script `:38` | "Get organized / Workspaces and collections for every project." | True of the app. "Every project" stops at 3 workspaces for free. | ASC, new version |
| Screenshot 8 · `store-truth.md:266`; script `:40` | "Send the song, not just the audio / Lyrics, chords, notes and marks go with it." | Yes. Receiving is always free. | ASC, new version |
| Screenshots 1, 2, 7 · `store-truth.md:259-260, 265` | "Catch it before it's gone" · "Every idea grows into a song" · "Never lose a gem" | Yes. All free. | ASC, new version |
| What's New, v1.0.0 · `store-listing.md:154` (older draft) | "…grow them with lyrics, chords, and overdub layers, and practice until they're real — all on your device." | Not confirmed as the text in the console. No plan claim. | ASC, new version |
| Support and marketing links · `store-truth.md:179` | support `https://songnook.app/privacy#contact` · marketing `https://songnook.app` | The site now also has `/support` (`server/songnook-send/src/pages/legal.ts:57`); the record still points support at the privacy page. | ASC, new version |
| Translated listings · `store-truth.md:268` | "the Hebrew, Spanish, German and Portuguese listings are still to do" | The store text is English only today, so a split change means one listing, not five. | ASC |

## Play listing

Same full description as Apple, except the backup line names Google Drive and the Apple subscription paragraph is left out (`store-truth.md:181-183`). Rows are only what differs.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| Short description · `store-truth.md:175` | "A quiet corner to finish songs. Record, organize, rehearse, never lose a gem." | Yes. Safe. | PLAY |
| Full description · `store-truth.md:186-231` | Same text as Apple, with "Back up and export to Files, iCloud Drive or Google Drive" and the same PRO paragraph | Same verdicts as the Apple rows. Play has no renewal paragraph in the description. | PLAY |
| Screenshots and the three newer SHARE lines · `store-truth.md:253-255` | Same eight captions | Recorded as "saved as a DRAFT on the default listing, not yet sent for review" on 2026-11-10. I could not confirm whether that draft has gone live. | PLAY |
| Feature graphic · `docs/store-assets/play/feature-graphic-1024x500.png`; `store-truth.md:173` | Carries the tagline "A quiet corner to finish songs." | Yes. No claim. | PLAY (re-render with `npm run brand:render`) |
| Data safety form · `store-truth.md:129-144` | "Financial info → Purchase history: optional (only if Pro is bought)" · "Audio… optional (only when sending)… deleted after 7 days" | Yes. Not split-dependent; depends on Pro existing and Send keeping files 7 days. | PLAY |

## In-app purchase names and descriptions

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| Product ids and group · `pricing-and-marketing.md:15-20`; `store-privacy-answers.md:97-99` | `songnook_pro_yearly`, `songnook_pro_monthly` in the subscription group "SongNook Pro"; `songnook_pro_lifetime`, a non-consumable; RevenueCat entitlement `songnook_pro` | The entitlement id matches `src/services/billing.ts:32`. The product ids live in the RevenueCat dashboard, not in the app code. | ASC / PLAY / RevenueCat (ids cannot be renamed) |
| Display names and descriptions of the three products, and the group's display name | **Not recorded anywhere in the repo.** The only trace is one sentence: "the store description stays "Every Pro tool, pay once."" (`pricing-and-marketing.md:213-215`), which reads like the Lifetime product's description. | Cannot check. "Every Pro tool" is safe under any split. If the yearly or monthly descriptions list features, they need reading in the console. | ASC (reviewed per product) and PLAY |
| Purchase review screenshot · `docs/store-assets/apple/iap-review-pro-sheet.png` (committed 2026-10-27) | The old Pro sheet: "Setlists and the stage — Transpose, capo, songbooks and the stage reader." · "Layers — Record over a take, as many times as you need." · "Practice tools — Change the key, mark the parts, step up the tempo." · "The full editor — Cut into parts, change speed and pitch." · "Word tools — The Word Finder, and every word game as often as you like." · "Send and more workspaces — Unlimited SongNook Send links, more workspaces." · "BEST VALUE" · "About $2 a month, billed yearly" · "Launch price, pay once" · "Not now" | **Stale.** "Cut into parts" is free since today. It also shows a sheet that no longer exists (six rows, "Not now", "BEST VALUE", the per-month figure), says layers are unlimited (the cap is 8), and lists the stage reader (reading is free). Seen by App Review only, not by the public. The repo does not record whether this exact image is the one attached to the three products. | ASC (review screenshot on each product) |
| Store prices · `pricing-and-marketing.md:13-17, 187-188` | Yearly $24.99 · Monthly $3.99 · Lifetime $59.99, to be raised to $79.99 on 2027-02-09 | Matches the printed fallback prices in the app. The raise is a manual console change the Pro page already promises. | ASC and PLAY pricing |

## Reviewer notes

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| App Review notes, purchases · `store-privacy-answers.md:94-102` | "open the side menu (the ☰ at the top left), tap Settings, then tap "SongNook Pro". The same screen opens when a Pro tool is tapped after the free month. It offers three products…" · "A subscriber who opens it sees their renewal date and "Manage subscription"." | Yes. Names the three plans and the path; no feature list. | ASC (App Review Information; no public effect) |
| App Review notes, free month · `store-privacy-answers.md:104-111` | "A new install can use every Pro tool for 30 days. This is the app's own allowance, not an App Store free trial… After it ends the Pro tools ask for Pro. Recording, the library, lyrics, backup and export, and opening what someone sent are never locked, and nothing a person made is lost." | Yes, with one soft spot: "export… never locked" while chart PDF export and archive offload are Pro. Re-check if the never-locked list or the 30 days change. | ASC |
| App Review notes, Send · `store-privacy-answers.md:113-124` | "they select their own clips, tap "Get a link"…" · "every transfer is automatically deleted after 7 days" | Yes. The button is labelled "Get link" in the app (`sendSheet.seal`), a small wording slip. No mention of the 3-link allowance. | ASC |
| App Review notes, privacy · `store-privacy-answers.md:126-130` | "The App Privacy declaration covers Send (User Content, not linked, no tracking) and Pro (Purchase History, kept by RevenueCat under an anonymous ID…)" | Yes. | ASC |
| Status line above the notes · `store-privacy-answers.md:83-88` | "Build 19 still attached, still "Prepare for Submission", not added for review." | Behind: this session's memory index says build 19 and the three purchases were submitted on 2026-11-13. A record, not a claim to users. | DOC |
| Older reviewer note · `store-listing.md:143-148` | "The app never reads the pasteboard on its own. The audio background mode keeps a recording or playback going…" | True, but part of the superseded draft; the pasted notes are the ones above. | DOC |

## Terms of use

Source: `docs/terms-of-use.md` (effective "November 1, 2026"), built into `server/songnook-send/src/pages/legal.generated.ts` and served at `https://songnook.app/terms`. I checked every bullet of the source against the generated file: they match. Whether the deployed worker carries the same build I could not check. Linked from the Pro page and from Settings → About (`src/config/legalLinks.ts`). English only.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| `terms-of-use.md:17` | "SongNook is free to download and use. SongNook Pro adds more tools." | Yes. Safe. | DOC → `npm run build:legal` → SERVER; bump the effective date |
| `terms-of-use.md:19` | "**The free month.** Every Pro tool is open for your first 30 days, with no payment details asked. Once per device. When it ends, nothing you made is lost: work made with Pro tools still opens and plays, and everything free stays free." | Yes. | same |
| `terms-of-use.md:20` | "Pro is sold through the App Store or Google Play as a yearly or monthly subscription, or a one-time lifetime purchase, at the price shown in the app before you buy." | Yes. No prices, so a price change needs no edit. | same |
| `terms-of-use.md:21` | "A lifetime purchase unlocks every Pro tool in the app, including unlimited SongNook Send links, for as long as we offer SongNook… It does not include services that keep your work stored online, such as cloud sync…" | Yes. A promise to lifetime buyers: if Send stops being part of Pro, or becomes metered for Pro, this sentence is broken for people who already paid. | same (and a founder decision first, per `pricing-and-marketing.md` §2) |
| `terms-of-use.md:22` | "Subscriptions renew automatically at the end of each period unless you cancel at least 24 hours before it ends…" | Yes. | same |
| `terms-of-use.md:23` | "Use Restore in the Pro sheet to bring back a purchase…" | Slightly stale: it has been a full-screen page since 2026-11-12. Restore is there. | same |
| `terms-of-use.md:24` | "**What's free.** Recording, your library, lyrics, backup, export and restore, and receiving through Send are never locked. Free use includes three SongNook Send links a month and three tries of each word game; Pro makes both unlimited." | Numbers match (3 links, 3 tries). "A month" is a rolling 30 days. "Export… never locked" sits beside two gated exports (chart PDF, archive offload). It names two of the four count limits and leaves out 3 workspaces and 1 layer. **The most split-sensitive sentence we publish.** | same |
| `terms-of-use.md:25` | "We may change what Pro includes or its price for new purchases." | Yes. This is the clause that lets the split move. | same |
| `terms-of-use.md:13, 31-33` | "at most 7 days after you create it" · "Every transfer is deleted 7 days after it is created." · "Send accepts audio files and SongNook packages only." | Yes. Not split-dependent. | same |

## Privacy policy

Source: `docs/privacy-policy.md` (effective "November 11, 2026"), same build path, served at `https://songnook.app/privacy`. Source and generated file match. English only.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| `privacy-policy.md:5` | "your music stays yours, on your phone. There are no accounts, no ads, no analytics and no tracking." | Yes. Not split-dependent. | DOC → `npm run build:legal` → SERVER; bump the effective date |
| `privacy-policy.md:20` | "If you buy SongNook Pro, the App Store or Google Play handles the payment. We use RevenueCat to check and restore your purchase…" | Yes. | same |
| `privacy-policy.md:21` | "Word Finder lookups send the word you look up… Your lyrics are never sent." | Yes. No plan claim. | same |
| `privacy-policy.md:22` | "the app includes a random key it made for this install, so our server can count your free links and, once you buy Pro, ask RevenueCat whether you have it." · "If you pair a computer's browser… we keep that pairing… for 30 days" | Describes the mechanism truthfully. It exists only because Send has a free allowance; reword if Send becomes fully free or fully Pro. See the Website table for whether the server is counting at all today. | same |
| `privacy-policy.md:57` | "SongNook keeps a small record of when your free month of Pro began, and of how many free tries of each word game you've used, in your phone's secure storage, so that reinstalling doesn't reset them." | Yes (`services/freeMonthClock.ts`, `services/sparkTries.ts`). Reword if the tries gate or the free month goes away, or if another per-device allowance is added. | same |
| `privacy-policy.md:28-36, 41` | "Nothing uploads until you tap **Get a link**." · "every parcel is deleted **7 days** after it is made" · "choose **Delete link**; the files go at once" | Yes. The button reads "Get link" in the app. Not split-dependent. | same |
| `privacy-policy.md:44` | "if you bought SongNook Pro, email us and we will ask RevenueCat to delete the purchase history tied to your anonymous ID." | Yes. | same |

## Website and Send web page

All in `server/songnook-send/src/pages/`. English only. Changed by a worker deploy.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| Landing page, songnook.app · `legal.ts:84-88` | "A quiet place to finish creative work." · "SongNook is a musician's sketchbook — record the idea, keep the takes, write the words, and hand it to the band with a link." · "Coming to the App Store and Google Play." | No plan claim. "Coming to…" is true only until the founder presses Release; iOS build 19 is with App Review now. The headline differs from the store tagline ("A quiet corner to finish songs"). | SERVER |
| Support page, songnook.app/support · `legal.ts:66-73` | "Yearly and monthly plans are managed in your App Store or Google Play account. In the app: Settings → SongNook Pro → Manage subscription." · "Bought Pro and it isn't showing? Open Settings → SongNook Pro and tap Restore." | Yes. Hand-written; names the plans and the Settings path, so a renamed row or plan needs an edit here. | SERVER |
| Web sender, send.songnook.app · `sender.ts:65-69` | "You'll get one clean, private link — no account, nothing to install on the other end. It's sealed in this browser before it leaves: only people with the link can open it, not even SongNook." | Yes (`SEAL_WEB_SENDS = "true"`). | SERVER |
| Web sender · `sender.ts:86` | "files or a whole folder — audio & SongNook files, up to 1 GB" | Yes (`MAX_TRANSFER_BYTES` in `wrangler.toml`). Typed by hand, not read from config. | SERVER |
| Web sender · `sender.ts:121` | "Sealed. Your link is ready — it quietly expires in 7 days." | Yes (`EXPIRY_DAYS = "7"`). Typed by hand. | SERVER |
| Web sender, session line · `sender.ts:170-171` | "Paired with your SongNook app" (Pro) or "1 of 3 free links left this month" / "N of 3 free links left this month" | The "3" is typed into the string, apart from `FREE_LINKS` and from the app's catalog. This is the only place anywhere that tells a free user how many links are left. | SERVER |
| Web sender, refusal · `sender.ts:386` | "This month's 3 free links are used. SongNook Pro sends without limit." | Same sentence as the app's `sendError.limit`; same typed "3". | SERVER |
| Send server rule · `server/songnook-send/src/lib/access.ts:8-9`; `wrangler.toml` `[vars]` | `FREE_LINKS = 3`, `FREE_WINDOW_MS` = 30 days; committed config `PRO_FOR_ALL = "true"`, `APP_SEND_ENFORCED = "false"` | **Mismatch with the app as committed.** The paywall is on in the app, but with these two values the server treats every sender as Pro: the web sender page would say "Paired with your SongNook app" to everyone and never count, and the 3-link limit is held only by the app's own on-device count. `pricing-and-marketing.md:191-197` lists flipping them as release step 4, not done. I could not check what is deployed. | SERVER (config + deploy; a founder decision) |
| Recipient page, send.songnook.app/t/… · `recipient.ts:33-35` | "SongNook is a quiet corner for songwriters and musicians — a place to catch an idea, shape it into a song, and practice it till it's yours, wherever you are." | Yes. Safe. | SERVER |
| Recipient page, app preview captions · `appPreviewGallery.ts:174, 201, 231` | "Play it — loop, speed, sections & pins" · "Sing along — lyrics & chords, timed to the take" · "Drill it — loop the hard part on repeat" (demo card reads "2 layers") | True for the reader: a received parcel practises free, pins included. A person who then installs and tries pins or a second layer on their own clip meets the Pro page after the free month. | SERVER |
| Recipient and sender page chrome · `shell.ts:238-244`; `recipient.ts:108` | "Music, passed along" · "Files are held for a limited time, then quietly let go." · "SongNook — a home for song ideas" · "Open in SongNook" | Yes. Safe. | SERVER |

## Internal records

Not published. Listed so they are corrected in the same pass and nobody pastes from a stale one.

| Where (file:line or store field) | What it says (quote) | Matches the code today? | How it is changed |
|---|---|---|---|
| `docs/product-plan/pricing-and-marketing.md:85-98` (§3) | "Summary as of 2026-11-13: Pro: workspaces beyond 3; layers beyond 1 per take; pitch, pins, analysis and Step up…; the editor's Speed & pitch tab (trimming and cutting a take into any number of parts are free, 2026-11-13)…" | Yes. Updated today. The living record; the header still says "Last reviewed: 2026-11-02". | DOC (must be updated with every founder decision, plus the decision log) |
| `pricing-and-marketing.md:49-80` (§2, promises) | "Never locked: recording, the library, lyrics, backup/export/restore, receiving through Send." · "The free month: every Pro tool for 30 days, no card, once per device." · "The $79.99 raise must really happen on the printed date." | Yes. The checklist for what a split change may not break. | DOC |
| `pricing-and-marketing.md:145-146` | "browser pairing (paid users send from a computer), Pro and the free 3 links checked on the server (dormant until the paywall)" | Loose: the sender page gives a paired free user 3 links too, and "dormant until the paywall" is still the committed server state although the paywall is on in the app. | DOC |
| `pricing-and-marketing.md:189-190` | "`ALL_FEATURES_FREE` is false… No build or update has carried it yet." | Likely behind: build 19 has gone to review since. | DOC |
| `docs/product-plan/store-truth.md:167-266` (§6) | The listing text and screenshot captions quoted above | It is the source for both consoles. Edit here first, then paste. | DOC, then ASC and PLAY |
| `store-truth.md:272-284` (§7) | "`docs/terms-of-use.md` still says SongNook and Send are "free of charge". It needs a SongNook Pro section…" · "Send: free for 3 links a month; unlimited with Pro." · "Word games: three free tries of each game; unlimited with Pro." | A finished to-do: the terms have that section. The two limits it lists match today. | DOC |
| `store-truth.md:29-30, 44-47` (§1) | "RevenueCat starts today even though every feature is still free" · "There is no button to delete a link early; email does it." | Both out of date (the paywall is on in code; Delete link shipped 2026-11-01). | DOC |
| `docs/product-plan/store-listing.md` (whole file) | Older listing draft: subtitle "Catch song ideas, grow them" · "No account, no cloud, no sign-up." · "Detect the tempo of steady clips" · "Layer overdubs: stack a harmony or a second part over a take" · seven-screenshot plan · checklist line "→ "Data Not Collected" holds" | Superseded by `store-truth.md` (which says so). Says nothing about Pro. Risk is someone pasting from it. | DOC |
| `docs/product-plan/store-privacy-answers.md:1-76, 132-196` | The August privacy answers ("Everything else: not collected") | Superseded for the label by `store-truth.md` §4; the reviewer notes at `:90-130` are current. | DOC |
| `docs/product-plan/phase-6-monetization.md:31-35` | "free = unlimited recording, 2 workspaces… Pro = workspaces beyond 2, layers beyond 1, full editor (parts, speed & pitch), practice suite, charts/transpose/capo/songbook/setlists/stage reader, Lyric Spark + full word finder, sending through Send, PDF export." | History (the 2026-10-19 split). Wrong today on workspaces, parts, the stage reader, Lyric Spark and Send. Marked as superseded at the top of the file. | DOC |
| `phase-6-monetization.md:65-71` | "Free forever: … limited word-tool sparks (e.g. 5 saved sparks per tool)." · "Pro: practice suite (loops, pins, speed & pitch, tempo analysis)… auto-backup…" | History. Wrong today on sparks, loop, speed and backup. | DOC |
| `phase-6-monetization.md:100-113` (gate table) | "`full-editor` \| The editor's Speed & pitch tab. No `freeLimit` since 2026-11-13…" · "`stage-tools` \| … the stage reader (`openReader`)" | The editor row was updated today. The `stage-tools` row lists the stage reader as gated and as free in the same line; the code has reading free. | DOC |
| `phase-6-monetization.md:115-119` | "Add a reusable `ProBadge` chip" · "headline ("Grow every idea"), feature list with icons (the six Pro rows)… trial copy" | Never built or since replaced: no badge exists, the headline is "Finish more songs", five rows, no trial copy. | DOC |
| `docs/product-plan/final-sweep-2026-10-22.md`, `final-sweep-2026-10-22/feature-inventory.md:161-229`, `handoff-2026-10-23.md:135-138` | "SongNook Beta · Pro unlocked" · "Saved sparks beyond 5 per tool" · "workspaces > 2" · "six feature rows" | Snapshots from before the paywall. Not maintained. | DOC |
| `docs/product-plan/feature-marketing-language.md` | The feature vocabulary the listing, screenshots and reviewer notes are drawn from | Says nothing about free, Pro, prices or limits, so it survives a split change. Re-check only if a feature is renamed. | DOC |
| `docs/qa/flows/shell-misc.md:24-31`, `data-safety.md:16, 62`, `lyrics-words.md:26, 64`, `player.md:65-66`, `docs/qa/MANUAL-CHECKLIST.md:240` | "Bottom sheet: "Grow every idea", 6 feature rows… "Best value"" · "CTA reads "Start free trial" / "Get Lifetime"" · "Backup reminder Pro gate" · "6th spark upsell… 5 saved sparks" · "tap Loop switch, Pin +, speed preset… Each gated tool opens the Pro upsell" · "Settings → Upgrade to Pro" | Test scripts describing an older sheet and older gates (backup reminder, saved-spark cap, loop and speed as Pro). Would fail if run as written. | DOC |
| `.maestro/flows/03-paywall.yaml:16-36` | Asserts "Finish more songs" and "Get Pro" are visible | Matches today. Breaks if the headline or the key is reworded. | Test file |
| `src/__tests__/proCatalog.test.ts:98-112` | Checks that the Pro page's line count equals `PAYWALL_ROWS` (en and he) and that every advertised key is gated | The guard that forces a Pro page edit when a row is freed. It does not check the wording, the terms, the Send strings or the website. | Test file |
| `docs/qa/screens/pro-sheet-2026-10-23.png` | A picture of the October Pro sheet | Old picture, internal. | DOC |

---

## Stale right now

1. **Pro page, third line, five languages** (`pro.features.2`, `en.ts:1656`): "Practice tools and the full editor". Cutting a take into parts is free since today, so "the full editor" now stands for the Speed & pitch tab alone, and plain loop and speed are free too. Not false, but it implies editing is paid. The reword is waiting on the founder's choice of the page's new order.
2. **Purchase review screenshot** (`docs/store-assets/apple/iap-review-pro-sheet.png`, from 2026-10-27): shows "The full editor — Cut into parts, change speed and pitch." It also shows the retired sheet: six rows, "Record over a take, as many times as you need" (the cap is 8), "the stage reader" (reading is free), "BEST VALUE", "About $2 a month, billed yearly", "Not now". Reviewer-only, but it is the picture Apple judges the three purchases against.
3. **Send server config as committed** (`server/songnook-send/wrangler.toml`): `PRO_FOR_ALL = "true"` and `APP_SEND_ENFORCED = "false"` while the app's paywall is on. As committed, the server counts nobody; the terms, the Send error and the web sender page all describe a 3-link allowance that only the app's own count holds. Release step 4 in `pricing-and-marketing.md` covers it; not done. Live state not checked.
4. **Terms, "Restoring"** (`docs/terms-of-use.md:23`): "Use Restore in the Pro sheet". It is a page since 2026-11-12.
5. **"Export is never locked"** in the terms (`terms-of-use.md:24`) and the reviewer notes (`store-privacy-answers.md:107-109`), while chart PDF export and archive offload are Pro. Older than today, still a mismatch between the sentence and the gates.
6. **Landing page** (`server/songnook-send/src/pages/legal.ts:87`): "Coming to the App Store and Google Play." True today; false the moment the app is released.
7. **"Get a link"** in the privacy policy (`privacy-policy.md:28`) and the reviewer notes (`store-privacy-answers.md:115`); the button reads "Get link".
8. **Unused strings**: `settings.proUnlocked` ("Pro unlocked", `en.ts:526`) and the older welcome pane strings (`en.ts:1537-1549`) have no call site.
9. **Internal records behind the code**: `store-truth.md` §7 (a finished to-do) and §1 ("no button to delete a link early", "every feature is still free"); `store-listing.md` (superseded draft); `phase-6-monetization.md:31-35, 65-71, 106, 115-119`; the QA flow scripts listed above; `pricing-and-marketing.md:9, 145-146, 189-190`; `store-privacy-answers.md:83-88` ("not added for review").

## Will need re-checking after any split change

In the order I would walk them:

1. `src/domain/proCatalog.ts` `PAYWALL_ROWS` and `pro.features.0–4` in all five locale files (the test only checks keys and count, not words).
2. `shareLink.sendError.limit` in all five locale files: the digit 3 and "without limit".
3. `docs/terms-of-use.md:19, 21, 23, 24`: the free month, the lifetime promise ("including unlimited SongNook Send links"), and the "What's free" sentence with its two numbers and its never-locked list. Then `npm run build:legal`, a worker deploy and a new effective date.
4. `docs/privacy-policy.md:22, 57`: "count your free links" and "free tries of each word game". Same build and deploy.
5. Send server: `server/songnook-send/src/lib/access.ts:8-9` (`FREE_LINKS`, window) and the two typed strings in `src/pages/sender.ts:171, 386`; plus the `PRO_FOR_ALL` / `APP_SEND_ENFORCED` decision.
6. Store description PRO paragraph (`store-truth.md:229-230`, then both consoles): "recording, writing and organizing your songs stay free". Re-read it against whatever moves into or out of Pro, especially anything in writing (Word Finder) or organizing (workspaces).
7. Apple-only subscription paragraph and `pro.renewNoteIos` / `renewNoteAndroid`, if a plan is added, dropped or renamed.
8. Reviewer notes (`store-privacy-answers.md:104-111`): the never-locked list and "30 days".
9. The purchase review screenshot, and the three products' display names and descriptions in App Store Connect and Play Console (not recorded in the repo; read them there).
10. Prices, if they move: `pro.plans.*` in five locales, `PRINTED_SAVING_PERCENT` in `ProUpsellSheet.tsx:46`, `LIFETIME_LAUNCH_DAYS` / `APP_STORE_RELEASE_AT` in `src/domain/freeMonth.ts`, `pricing-and-marketing.md` §1, both consoles.
11. Store screenshots 3 to 6 (`scripts/store/compose-screenshots.py:35-38`) and the description's feature bullets, only if a tool they show becomes unavailable to free users altogether; today none of them says free or Pro.
12. `player.layerLimitTitle` ("Eight layers", five locales) and `pro.features.1` ("Up to 8 layers"), if the layer cap or the free layer count changes.
13. Support page (`server/songnook-send/src/pages/legal.ts:66-73`), if the Settings row or plan names change.
14. Internal records in the same pass: `pricing-and-marketing.md` §2, §3 and the decision log; `phase-6-monetization.md` gate table; `store-truth.md` §6 and §7; the QA flow scripts; `.maestro/flows/03-paywall.yaml` if the headline or key is reworded.

Safe under any split (no free, Pro, price or count stated): the welcome flow, every help sheet, the recipient page, the landing page, the store subtitle, promotional text, keywords, the feature bullets of the description, and `feature-marketing-language.md`.
