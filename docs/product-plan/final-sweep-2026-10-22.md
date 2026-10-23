# Final sweep before store submission — 2026-10-22

Tree audited: `main` @ `b4a7268` (includes the layer-recorder commit). Ten read-only
reviewers covered the app page by page (state & persistence, audio engine & native modules,
full player & reel, recorder & editor, library & navigation, lyric tools & word services,
backup/import/Send incl. the Send server, settings/instruments/onboarding/shared UI & Pro seam,
cross-cutting dead code/deps/config, feature inventory). Every finding was traced from a real
caller; nothing was run on a device, so "high confidence" means the code path is unambiguous.
The per-area reports with every finding, file:line and fix are in
[`final-sweep-2026-10-22/`](final-sweep-2026-10-22/).

Baseline: `npx tsc --noEmit` clean (only after `patch-package` — the expo-audio patch is
load-bearing for types), `npx jest` 188 suites / 1 563 tests green, zero TODO/FIXME in src,
no secrets in tracked files, no raw `Alert.alert`, no `__DEV__`-less dev surfaces.

## Verdict

**Nothing found blocks App Review of the all-free v1.0 build.** No P0. The persistence,
backup, trash and restore stack is in good shape and was verified end to end (see "Verified
OK" lists in the area reports — don't re-audit those). The real risks are:

1. A handful of P1 logic bugs on recurring user paths (count-in after Redo, dock queue
   removal leaves audio playing, received-package bulk actions, Magpie second spark).
2. Two native-thread races in the metronome engines that can hard-crash (small window).
3. Monetization plumbing that would gate the wrong things and burn every v1.0 user's free
   month before the paywall exists — decisions needed **now**, code before the flip.
4. Store-listing drift: the questionnaire answers predate SongNook Send.

Totals across the ten reports: **P0 0 · P1 15 · P2 ~60 · P3 ~100**, of which 14 small wins
were applied in this pass (next section) and the rest are listed below by priority.

---

## Applied in this pass (safe small wins, all typechecked + tests green)

| # | Change | Why |
|---|---|---|
| 1 | `services/managedMedia.ts` — launch trash sweep stats only files whose name is in the trash | Was one awaited native stat per library file on every launch for 14 days after any delete (O(library) → O(trash)); matching was already by filename so behaviour is identical |
| 2 | `services/receiveTransfer.ts` — item/transfer caps now come from `config/sendService` | Receive side still said 512 MB per item while sender + server allow 1 GB: a 700 MB parcel sealed fine and was refused on arrival |
| 3 | `services/workspaceArchive.ts` — restore target rejects `..`, `.`, `\`, NUL segments | Prefix check alone let a crafted offloaded-package manifest write outside managed storage (DR restore already had this guard) |
| 4 | `services/shareLink.ts` — packed `.songnook` deleted in `finally` after a link upload | Up to 1 GB lingered in `songnook/share` until the next cold launch's 24 h sweep; the share-sheet path already cleaned up |
| 5 | `App.tsx` + deleted `components/dev/SyncProbe.tsx`, `dev/renderCensus.ts`, `common/SectionHeader.tsx` | "TEMPORARY DIAGNOSTIC" Skia probe was statically imported into the release bundle; the other two had zero importers |
| 6 | `App.tsx` boot spinners use `colors.primary` | Three `#B87D6B` literals |
| 7 | `IdeaListScreen/components/CollectionScreenContent.tsx` | The one `fontWeight` without `fontFamily` in src (rendered the system font) |
| 8 | `SettingsScreen/views/SettingsOverviewView.tsx` — plan line hidden while `!isPaywallLive()` | "SongNook Beta · Pro unlocked" was rendered to every user; Apple rejects shipping apps that call themselves beta (Guideline 2.2). It returns with the real plan when Pro can be bought |
| 9 | `SettingsScreen/components/SettingsShared.tsx` — removed `LIBRARY_DEEP`, `SegmentedField`, `FormatOptionRow`, `AccordionSection` | ~130 lines of retired pre-ValueRow UI with zero call sites (verified repo-wide) |
| 10 | `domain/wordLadder.ts` — removed six dead exports | Hard-coded English copy ("Verbs", "e.g. doctor") outside `t()`, never imported |
| 11 | `NotepadScreen/hooks/useNotepadScreenModel.ts` — close reads the live store | A new Lyric Pad page typed and closed within the 500 ms idle window was deleted (stale `notes` closure after the editor's synchronous flush) |
| 12 | `MagpieScreen/hooks/useMagpieScreenModel.ts` — auto-load guard + status reset per spark | Drawer screen is reused for every spark: the second Borrowed Words spark of a session never fetched a page and inherited the previous spark's error |
| 13 | `common/ProUpsellSheet.tsx` — legal URLs imported from `config/legalLinks` | Duplicated constants; one source for the About page and the paywall |
| 14 | Seven "go to the hub" navigations gain `pop: true` (`WorkspaceList`, side-menu row in `App.tsx`, Search workspace result, Playlist/Setlist/Songbook "start collecting", `SongScreenContent` fallback) | RN7 `navigate` reuses a route only when it is current or `pop` is set; these pushed a second `Browse` over an open collection, so back from workspace B's hub landed on workspace A's collection. The helper `openWorkspaceBrowseRoot` already did this right |

Not applied on purpose (needs a device pass or a founder decision): everything below.

---

## P1 — fix before submission (or before the Pro flip where marked)

### Recorder & audio
- **Count-in after Redo completes instantly** (`useRecordingScreenModel.ts:1876-2026`, `useMetronome.ts:118,530`). The completion token only increments and the effect depends on `recording`, a fresh object every render; after one count-in take, the next arm fires the completion body before the count-in starts → no head trim, null downbeat grid, click killed, layer unaligned. Fix (~6 lines): capture the token at arm time and compare, or reset the token in `startCountIn`. Verify on device with: count-in take → Redo → count-in take.
- **Native metronome engines race across threads** (iOS `SongNookMetronomeEngine.swift:81,694-760` force-unwraps `mapSegments!` on the 8 ms poll queue while `configure/clearTempoMap` nil it from Expo's queue; Android `.kt:742-769` reads `playbackHeadPosition` on a track `stop()` can release → uncaught `IllegalStateException`). Hit on seek/drift-resync with the playback click on. Fix: serialize every public entry on the engine's own queue/handler.
- **A kept-for-recovery take can be orphaned** (`useRecording.ts cancelPreparedRecording`): cancelling/minimizing during the *next* take's count-in clears the pending marker unconditionally. Only clear the marker this take wrote. Related P2: the same cancel discards the record-through WAV's `fileUri` without deleting it (~10 MB/min orphan per cancelled count-in; `discardRecording` does delete it).
- **iOS practice/pitch engine ignores interruptions and route changes** (`SongNookPitchShiftPracticeEngine.swift`): after a call or headphone unplug it reports playing with a frozen position; the editor preview stays stuck "playing". ~25 lines mirroring expo-audio's observer.

### Player
- **Removing the only queued clip from the dock's queue panel leaves audio playing with no UI** (`QueuePanel.tsx:296-306`, `playerSlice.ts:118-124`): `requestPlayerClose` no-ops in exactly the state the removal produces while docked. Small fix: close the player directly when the queue empties, or let the guard pass when the engine still has a target.

### Library & navigation
- **Bulk actions in a visited received package act on the active workspace** (`CollectionFloatingActions.tsx:255-441`, `actions.ts:3070`, `IdeaSelectionBar.tsx:98`): Delete confirms then no-ops, New sketch writes an orphan into the active workspace, Copy/Move starts empty, bar reads "0 ideas". Fix: resolve the workspace from the page's route, or block selection on received packages (founder call: packages read-only?).

### Lyric tools
- **Undo history / armed word leak across sparks** (Cut-Up `boardHistory`, Word Ladder `armedWord` + `pairingHistory`, Magpie `fragmentHistory`): Undo on spark B writes spark A's data into B. Same root cause as the fixed Magpie auto-load (reused drawer screen). Fix: clear on `sparkId` change, or `key={sparkId}` on the screen content.

### Send / backup
- **Server rate limit is a non-atomic KV read-modify-write** (`server/songnook-send/src/lib/guard.ts:43-46`) plus TOCTOU on draft caps (`routes/api.ts:124-147`): parallel bursts bypass the only anti-abuse control; drafts can exceed 1 GB for 24 h. Use the Workers Rate Limiting binding or a Durable Object counter; make the size bump a conditional `UPDATE`.

### Monetization plumbing (before the flip; one decision now)
- **The free-month clock starts in v1.0 with the paywall off** (`FreeMonthNotices.tsx:23`, `freeMonthClock.ts:86-99`): every v1.0 user's 30 days are spent before the update that enables Pro, which then opens to "Your free month has ended" + the paywall. Decide now: key the month off the first paywall launch (`paywallSinceAt`), or set `APP_STORE_RELEASE_AT` to the paywall build so every pre-flip install is founding. Recommendation: the first (matches the doc's intent, costs nothing).
- **Founding access rides the restorable backup** (`persistedSnapshot.ts:51 firstLaunchAt`): restoring a tester's archive grants permanent Pro; erase-all drops a real tester's status. Store founding once in the secure store.
- **Half the founder's Pro split has no gate** (workspaces > 2, full editor, charts/transpose/capo/chart books/setlists/stage reader, Lyric Spark tools + full Word Finder, Send, setlist/chart-book PDFs), while the backup **reminder** and archive offload *are* gated against "never lock backup". See the pricing section for the recommended split; the §6.3 gate pass must land before `ALL_FEATURES_FREE` flips.

### Store listing / review
- `store-listing.md` still answers "No user-generated content shared between users" and "Data Not Collected" without mentioning Send. The privacy policy already describes Send (files to a Cloudflare-hosted server, IP used briefly for rate limits, 7-day deletion). Update the questionnaire answers: UGC sharing = yes (links, no accounts, abuse report funnel exists), and keep "Data Not Collected" only if you are comfortable that Send uploads are user-initiated transfers rather than collection (Apple's definition hinges on whether *you* retain/use it; a 7-day opaque store with no account is defensible — say so in review notes).
- Confirm from a phone that `https://songnook.app/privacy` and `/terms` resolve (unverifiable from the sandbox); the About page and paywall link them.
- First-launch pasteboard read (`clipboardTransferCheck.ts`) shows the iOS "pasted from…" banner to every new user whose clipboard holds any text. One-shot per install, guarded by `hasStringAsync`. Either defer behind an explicit "Opened a link before installing? Paste it" affordance, or justify it in review notes.
- Store description promises loop/slow/pitch and layers with no IAP mention — fine for v1.0 all-free; must be updated at the flip (phase-6 §6.7).

---

## P2 — fix soon (grouped; details and line numbers in the area reports)

**Data / storage**
- Library-archive import has no free-space guard and orphans extracted audio on failure (`libraryImport.ts:195`); every other long write guards.
- "Also delete original" in the editor never frees the file: derived clips carry `sourceAudioUri` which counts as a live reference (`useEditorExportFlow.ts:215`, `managedMedia.ts:28`). Founder call: keep the source (then fix the copy) or drop `sourceAudioUri` on Replace.
- Multi-part extract failing mid-loop orphans already-imported parts (`useEditorExportFlow.ts:391-449`).
- The "catastrophic partial-loss" persist guard is dead: `partialize` stores the new idea count before the debounced guard compares (`useStore.ts:497-505`); only the 0-ideas branch is live. Fix + unit test + one device pass before arming.
- Songbooks/setlists never pruned on idea delete (ghost "Unavailable song" rows forever).
- 15 s `stopRecording` timeout can leave the native recorder capturing unattended.

**Performance / battery**
- `PlayerTimeline`'s memo is defeated by the inline `layerLanesFooter` element (`PlayerScreen/index.tsx:1585`): every playback commit re-renders the reel and the 2 177-line visualizer. Memoise the element [small].
- Two Reanimated frame callbacks per reel run every vsync while the player is open and **paused** (`PlaybackTapeVisualizer.tsx:1205-1486, 1678-1738`); gate on a "needsFrames" shared value.
- iOS practice engine never calls `engine.pause()` while paused (audio I/O stays open) [small]; Android practice ticker keeps posting 10 events/s after a focus-loss pause [small].
- Layer-take recorder: guide status at 250 ms + beats + clock re-render the whole 2 820-line model and unmemoised children (`useRecording`/`useMetronome` return fresh objects); use the throttled status hook and `useMemo` the returns.
- Playback position still writes into the main store (~7 Hz full player, ~1 Hz inline): persist/SQLite/manifest are insulated by the change detector now, but every mounted selector (415 call sites) runs per tick. Post-launch: a separate non-persisted clock store.
- `OverdubLayerLanes` draws up to 480 Views per lane; `StemAlignmentOverlay` re-renders the layer sheet on JS per gesture frame; Cut-Up board rebuilds gestures per scrap per render with an O(n²) size map and no size cap on the live path.
- Bluetooth calibration drives whole-screen re-renders at 30 Hz for ~11 s per pass (bounded).

**Correctness**
- Step-up drill rate leaks into the clip's remembered speed and sticks after the drill ends (`useStepUpLoop.ts:84-92`, `usePerClipPractice.ts:41-49`).
- Pause inside the practice loop, then play → jumps to loop start (`usePracticeLoopController.ts:531-568`; `shouldStartInsideLoop` computed but unused there) — confirm intent.
- Lanes-mode pin hitboxes use estimated widths while the canvas uses measured widths → touch target can be a row away.
- Kept loop never clamped to duration after a trim [small].
- New `TakeRegister` reads the 12 s live-tape ring while the guide reel shows ≥ 20 s windows: the take vanishes 12 s behind the playhead — the exact "cut off" look the commit meant to fix (`recordingTakeSession.ts:201`). Give the register its own long-lived coarse bucket array.
- Editor reel drag of a held part ignores neighbour parts (overlaps allowed).
- Waveform decoders bin by buffer timestamp, not sample: comb-shaped sidecars for imported clips < ~6 min at high zoom (~6 lines each side).
- Android limiter look-ahead never drained: rendered mixes 5 ms late and lose their last 5 ms; Android playback ignores `AUDIO_BECOMING_NOISY` (no pause on unplug).
- Android back on a Compilations detail leaves the page instead of closing the detail.
- Receive "Stop" doesn't cancel the in-flight download; rollback leaves compilations created by earlier items.
- Free month extendable by moving the clock back (persist a high-water `lastSeenAt`).
- Erase-all auth failure refuses silently (haptic only) [small]; metronome `start()` rejections unhandled and silent.
- Magpie Hebrew worker has no rate limit at all (25 taps/min exhausts the shared Ben-Yehuda key for everyone); its index rebuild runs in a request `waitUntil` with one final write; edge cache is inert on `*.workers.dev` (also hits word-proxy when it goes live in 2027).
- Empty word-lookup results cached forever client + server; request timeouts cover headers, not body reads [small].
- Two sheets write the whole spark to the store per keystroke (`CutUpBoard.tsx:473`, `MagpieBuildStep.tsx:323`) [small].

**i18n / copy (Hebrew users see English)**
- Import warnings, `SendTransferError` bodies, storage "limitations", integrity-check summaries, welcome "Imported" collection + "N recordings" pill (also breaks the terminology law), "Unavailable song", "New collection from import", chord-sheet `Section n` labels, the recording notification title "Recording…", the ~35-word hardcoded duplicate-paste warning (also over the ≤ 20-word alert budget), and an empty-body "Copy here" confirm.
- Hebrew file names in `Content-Disposition` on the Send download (needs `filename*=UTF-8''`).
- "Coming soon" reachable in Word Finder (Hebrew word after picking a sound tool).

**Design-system debt (not blockers, user-visible)**
- 286 hex literals outside tokens (worst: `PlayerScreen/styles.ts` 31, `styles/base.ts` 22, `domain/hierarchy.ts` 14 cold slates), `shadows.drawer` at 0.12 (only token above 0.08), `TransportBar` with six hexes, cold-slate `#475569/#64748b` on the activity-range banner, motion literals in `PlayerSheet` (300/240), dock/reel fades, `SelectionDock` full-height slide (vocabulary says fade or ≤ 6 px), `RecordingBeatBreath` imports `expo-haptics` directly outside the documented carve-out, `CollectionMoveModal` on the deprecated card shell.

---

## P3 and dead code (do in one sweep, post-launch)

- **Dead files/exports** (all verified by import graph + repo-wide grep): `common/Knob.tsx` (348 lines) and `LitKey.tsx` (113) built ahead for the Sound room — keep only if it ships this cycle; `useLegacyMetronomeImpl` (~430 lines, only without the native module); the whole Cut-Up chunk-mode subsystem; `PlayerScreen/styles.ts` 161 of 240 keys unused, `practiceDrawerStyles.ts` 24 of 94; `classicReel` persisted flag with no setter and three constant-false reader branches (incl. the dark reel palette, never used); ~200 lines of navigation-state sanitiser in `App.tsx` that can never run (state is never persisted); the selection-slice clipboard stubs ("Stub to be implemented") shadowed by `appActions`; `deleteSelectedIdeasFromList`; `media_inventory` table created every boot and never used; 34 never-referenced exports listed in the dead-code report; 198 never-referenced translation keys (33 vetted in the lyric-tools scope).
- **Dependencies**: `@react-native-community/slider` has zero imports but still autolinks natively (doc says remove at zero) — remove + rebuild; `react-dom`, `react-native-web`, root `wrangler@4` and the `web/deploy/preview` scripts are a dead web chain (no root `wrangler.toml`, no web impls for file-io/SQLite/audio-studio) — remove or document "no web"; `jest`, `jest-expo`, `@types/jest` belong in devDependencies; `babel.config.js` registers the worklets plugin twice (preset auto-adds it; drop the line per SDK 54 guidance).
- **Build config**: `plugins/withSongNookAndroidVariants.js` anchors Gradle injections on template whitespace and silently no-ops on drift (an Expo bump could ship a debug-signed release) — add anchor assertions; CI/EAS must run `postinstall` (tsc depends on the expo-audio patch); re-test the `expo-file-system` publication-block removal and the `xcode` null-guard on the next SDK bump.
- **Perf nits**: per-row `.includes` on selection arrays (`IdeaListItem.tsx:169`, `ClipCard.tsx:142`), `selectAnySketch` scanning every idea per store notification while the player is open, `useOriginLabel` subscribing every header to the whole `workspaces` array, `computeIdeaSearchMeta` run twice per idea, Revisit's clock frozen at mount (daily rotation never rolls over without a cold start), bulk collection delete persisting N snapshots, `useRef(buildGesture()).current` rebuilding gestures per render, `MiniProgress` PanResponder memo never hitting, Stepper hold-repeat firing after the bound.
- **Hygiene**: 176 `console.warn` / 5 `console.error` survive release, all on failure branches (zero in the visualizers, reel, lanes, status-tick hooks) — fine; `[renameThread]` warn with object payloads in `useSongClipEditing.ts` is leftover scaffolding; `scripts/push-dev-samples.sh` defaults to a personal path.

---

## Security summary

- **App**: zip import, DR restore and receive all reject traversal, compressed/ZIP64/encrypted entries and oversize entries; ids are remapped on import; merge restore never drops the user's items; erase-all is two dialogs + device auth; "remove original" only ever touches the picker cache; link ids are 128-bit; no secrets ship (only the public Send origin); D1 queries parameterised; SSR pages escape user strings with CSP/`frame-ancestors 'none'`; PDF HTML escapes user text in content context only. The one gap (workspace-archive restore path check) was fixed in this pass; the manifest entry cap of 128 MB should drop to ~16 MB for `manifest.json` to avoid a Hermes OOM on a hostile file.
- **Send server**: see the P1 rate-limit item; also remove the legacy no-hash upload-token bypass (`uploadToken.ts:54`), add `nosniff`, loop the nightly sweep past 500 rows and continue past per-row errors, handle a `null` JSON body on create, fix README drift (512 MB vs 1 GB).
- **Word workers**: `word-he` is in good shape (validation, per-IP + global caps, generic errors); `magpie-benyehuda` needs the same rate limit; `word-proxy` (2027) needs rate limiting, value-length validation and must not pass upstream error bodies through.
- **Privacy**: crash log and persist journal are local-only; the only network calls are Word Finder, Magpie pages and an explicit Send. Hidden ideas travel in collection/sketch shares (`includeHiddenItems: true`) — product call, flagged.

---

## Feature inventory, positioning and marketing

The complete as-built tree (25 areas, page → sub-view → sheet → action, with the gate status of
every feature) is in [`final-sweep-2026-10-22/feature-inventory.md`](final-sweep-2026-10-22/feature-inventory.md).
Use it as the single source for screenshots, the description, App Review notes and the paywall rows.

### The sentence

Pick one and apply it everywhere (store subtitle, welcome pane 1, landing page, paywall subhead):

- **"Where voice memos become finished songs."** (recommended — names the person, the problem and the promise; matches the wedge in the competitive doc)
- Alt: "Record the idea. Finish the song."

Subtitle (30 chars): `Voice memos → finished songs` (28) or keep `Catch song ideas, grow them`.

### What to lead with (in this order)

1. **Capture that respects the moment** — one tap, count-in, click never recorded, keeps recording with the screen locked, pins while the tape rolls. (Voice Memos can't; Samply can't record at all.)
2. **Takes that remember where they came from** — versions stacked under a take, the Evolution view, a primary take. This is the "version stacking" Samply users praise, plus the tree it lacks.
3. **Words on the tape** — lyrics with per-take stamps, chords over lyrics, chart sheet, follow-the-tape reader, stage reader with key/capo. No neighbour keeps lyrics + chords + audio together.
4. **Practice without touching the recording** — loop a section, Step up, speed and pitch, click over playback.
5. **Layers that stay honest** — up to eight overdubs on an untouched take, one reel, one playhead.
6. **Nothing is lost, nothing leaves** — no account, nothing uploaded automatically, 14-day trash, verified backups you control. Lead the privacy card with "No ads, no AI training" (already on the paywall).
7. **Share without accounts** — a 7-day link anyone can open; parcels land in Received, never mixed with your work.
8. **Writing games** — Word Ladder, Cut-Up, Borrowed Words from real books, a word finder with Sound/Meaning/Imagery.
9. **Hebrew, properly** and **Android ships** (two things Samply and Dubnote don't have).

Keep the voice of the app in the listing: label, don't narrate; no exclamation marks.

### Screenshot story (7)

Recording with count-in → a collection of ideas (day groups, waveforms) → the sketch's Evolution view → full player with sections, pins and the practice loop → layers under the reel with Solo → lyrics following the tape (or the stage reader with capo) → the privacy card ("Yours, and only yours"). Seed a demo library first; the layer recorder was reworked in the last five commits, so capture after a device pass.

### Keywords (App Store, 99 chars, unchanged)

`songwriting,voice memo,song idea,riff,demo,recorder,practice,looper,lyrics,chords,melody,rhyme,tuner`

Rotate in `metronome`, `overdub`, `setlist` later from Search Ads data.

### Spread (what brings new users)

- **Send links are the growth loop.** Every parcel page is a landing page: recipient sees the sender's name, the title, plays the takes in the browser, and gets the store button. Keep sending free (see below) — it is the only feature that puts the app in front of a non-user. Add a one-line "Made with SongNook" footer on the recipient page and a referral-free "Open in SongNook" that deep-links into Received.
- **The Shelf/Revisit story** ("hundreds of New Recording 47s") is the content hook for Reddit r/Songwriting, r/WeAreTheMusicMakers, TikTok/Shorts: a 20-second "import your voice memos, find the one you forgot" clip.
- **Voice Memos import on first run** is the activation step — welcome pane 5 does it; make sure it is the screenshot/preview that shows up first in the "What's New".
- **Hebrew market**: a near-empty niche; the Hebrew word tools, Ben-Yehuda pages and RTL polish are a press angle on their own.
- Store reviews: the review prompt is already conservative (≥ 10 clips, ≥ 5 days, 120-day cooldown). Reply to Play reviews publicly.

---

## Monetization — recommended free / Pro split and pricing

Founder decisions of 2026-10-19 stand (free month, founding price, lifetime). What follows is
the recommended **content** of the split, judged by one rule: *free must be enough to form the
habit and to spread; Pro is what you reach for once the habit exists.* The code today gates
only overdub layers > 1, the practice suite, sparks > 5 per tool, chord PDF, the backup reminder
and archive offload (`domain/proGating.ts`, `entitlements.ts`).

### Free forever (never gate — these are the habit and the spread)

- Recording, every mode incl. count-in and the click, background recording, pins while recording.
- The library: workspaces (**raise the cap from 2 to 3** — the seeded "My Songs" plus two is the floor a hobbyist needs; a cap of 2 reads as stingy on day one), collections, sketches, takes, versions, Evolution view, tags, Shelf, Revisit, Activity, Search.
- Player with marks (sections + pins), **one practice loop** (loop a section, no Step up), speed 0.5–1.5× (listening to yourself slowed down is a capture feature, not a pro tool), trim editor Keep/Remove.
- **One overdub layer** per take (the taste that sells the rest).
- Lyrics versions, chords over lyrics, chord sheet (**editing** stays free; export is Pro).
- Lyric Pad, Word Finder basic modes (Rhymes, Near, Similar), **three saved sparks per tool**.
- Tuner, metronome.
- Backup, export, restore, Storage & repair, **and the backup reminder** (drop the `auto-backup` gate — data safety behind a paywall reads as a dark pattern in review and in reviews).
- Receiving through Send **and sending clips** (loose audio, up to e.g. 3 files / 100 MB). Sending is the growth loop; gate the *big* parcels, not the act.

### Pro (SongNook Pro — "Finish more songs")

- Workspaces beyond 3.
- Layers beyond the first (up to 8), layer tone/level, merge/combine.
- Practice suite: Step up, pitch shift, count-in over playback, click over playback, tempo detection, take level & tone, "Keep settings".
- Full editor: Speed & pitch bake, multi-part extract.
- Stage tools: transpose/capo, chart books, setlists, stage reader with pitched reference audio.
- Lyric Spark: unlimited saved sparks, Word Finder advanced modes (Sound, Meaning, Imagery groups), Borrowed Words whole-library and Hebrew sources.
- Send: whole sketches, collections, workspaces, setlists (the packed parcels), and the 1 GB cap.
- PDF export (charts, chart books, setlists).
- Archive offload to Files (already gated; fine as Pro since it is a power-user storage feature, not backup).

Everything already made with Pro tools keeps opening and playing after the month ends (the
invariant in `proGating.ts`); gates stop *creating new*, never reading.

### Pricing (confirm against RevenueCat data after 60 days)

Keep the founding ladder exactly as decided: **$11.99/yr ("$1 a month")**, $1.99/mo, lifetime
$29.99, no store trial on top of the free month. Rationale from the market doc: a low price does
not raise the share who pay (~1.4 % vs ~2.8 %), it lowers value per payer; the step from free to
paying is the barrier. Two refinements:

- Make **yearly the default selection** on the sheet and show monthly as "or $1.99 a month" — the annual is where the margin is and the "$1 a month" framing only works for the annual.
- Keep **lifetime** visible but third; musician communities are subscription-hostile and lifetime converts holdouts, but at $29.99 it undercuts the annual after year three. Consider $39.99 at the price rise.
- At the later rise for new subscribers (~$24.99/yr, $3.99/mo, ~$79.99 lifetime), grandfather founding subscribers for as long as they stay subscribed (already decided) and run it as a RevenueCat experiment, not a flag day.

### Mechanics that must be right before the flip (all P1 above)

1. Free month keyed off the first paywall launch, not first launch.
2. Founding status in the secure store, not in the restorable snapshot; `APP_STORE_RELEASE_AT` set in the release commit.
3. The gate pass (§6.3) for every row the paywall advertises; the six paywall rows and the gates must agree, because App Review tests what the paywall promises.
4. Clock-rollback guard on the free month.
5. Store description, privacy labels (RevenueCat sees purchases) and review notes updated with the IAP.

---

## Device-pass checklist (what this sweep could not do)

Run on a real iPhone and a mid-tier Android before the build:

- Count-in take → Redo → count-in take (P1 recorder bug).
- Seek while playing with the playback click on, several times fast (metronome race).
- Play one clip → dock → queue → remove it (audio must stop).
- Received parcel → Look first → long-press → Delete / New sketch / Copy.
- Open a second Borrowed Words / Cut-Up spark in one session; use Undo.
- Phone call during practice-mode playback; unplug headphones on Android during playback.
- Layer take longer than 20 s: watch the lower register behind the playhead.
- Hebrew UI: Cut-Up table drag, Send download of a Hebrew-titled clip.
- Fresh install with text on the clipboard (the paste banner).
- `https://songnook.app/privacy` and `/terms` from the About page; a `send.songnook.app/t/…` link cold-starting the production build.
