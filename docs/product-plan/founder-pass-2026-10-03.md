# Founder pass — 2026-10-03 brain dump

Thirteen items from the founder's first week on the Android build, triaged
into: ship-now fixes, two medium builds, four decisions that need the
founder's answer, and one deferral. Everything below is code-verified
(file:line) so a different model can pick it up cold.

## Handoff rules (read first)

- Standing constraints: the production hold was LIFTED by the founder on
  2026-10-05 — everything through 52104038 is on production (Android c181cc35,
  iOS 96d26995). New work goes to preview first again until the founder says
  otherwise. Publish with
  `eas update --channel preview --platform android -m "<msg>"` (never
  `--platform all`; expo-sqlite web breaks the bundle). JS-only changes reach
  the installed APK (build 5ad14560, runtime 1.0.0) on the second cold launch.
  Native changes need `eas build -p android --profile preview` and a new APK.
- Do not touch: recording while backgrounded/locked (`useRecording`,
  `useRecordingDisplayElapsed`), the reel (`PlaybackTapeVisualizer`), the
  practice loop/step-up, or the background CPU work from 2026-10-02
  (`useAppForeground.ts`, `backgroundPosition.ts`, the worklets/expo-audio
  patches). Read `docs/product-plan/reel-and-grid-postmortem.md` before any
  change near the reel.
- CLAUDE.md applies: tokens only (no hex/rgba literals), copy via `t()` (EN +
  HE), haptics via `src/design/haptics.ts`, motion via `src/design/motion.ts`,
  one commit per item, `npx tsc --noEmit` + `npx jest` green, UI verified in
  the iOS simulator with screenshots. Terminology: idea / clip / take / sketch
  / song.
- Android cannot be verified from this Mac (no device attached, emulator
  unusable). Say so in the handoff; the founder tests on the phone.

## Batch 1 — ship now (JS only, one preview OTA)

### 1. "Updated" sort treats import time as activity

**Report:** bulk import on Sept 23 → the whole library sorts as "updated Sept 23".

**Cause:** ideas have no `updatedAt`; the sort reads `lastActivityAt`
(`src/domain/ideaSort.ts:83-101`, `getIdeaUpdatedAt` = max of createdAt,
clip createdAt, lyrics version times, `lastActivityAt`). All three import
paths stamp `lastActivityAt: importedAt` (import time):
`src/state/actions.ts:920` (`importClipToCollection`), `:1010`
(`importClipsToCollection`, the batch path), `:1119`
(`importProjectToCollection`). Orphan recovery already does it right
(`src/services/audioRecovery.ts:382-384`: `lastActivityAt: createdAt`).

**Fix:**
1. The three import sites set `lastActivityAt: createdAt` (the chosen date —
   source date or import date — becomes both "created" and "updated").
2. Repair the founder's existing library: in `normalizeIdea`
   (`src/state/dataSlice.ts:954-964` clips, `:1007-1010` projects) add the
   idempotent rule `if (idea.importedAt != null && idea.lastActivityAt ===
   idea.importedAt) lastActivityAt = getIdeaCreatedTimestamp(idea)`. Imports
   write both fields from the same `importedAt` constant, and every later edit
   via `updateIdeas` stamps `Date.now()` (ms), so equality is a reliable
   "never edited since import" signal. Runs on every hydrate; no snapshot
   version bump.
3. Tests: `src/domain/__tests__/ideaSort*.test.ts` (or new) — imported idea
   with source date sorts by source date; an idea edited after import sorts
   by the edit; normalizeIdea rule is idempotent.

**Known gap to flag, not fix here:** `updateIdeas` stamps only `kind ===
"project"` (`dataSlice.ts:2826-2829`); renaming a *clip* idea never bumps
"updated". Ask the founder whether rename/tag on a clip should count (likely
yes → stamp clip-kind in `updateIdeas` for title changes).

### 2. Sketch page ⋯ menu does not close on outside tap

**Cause:** `src/components/IdeaDetailScreen/components/IdeaHeader.tsx:183-307`
renders the menu + backdrop inside the header `View` (~36 pt tall); the
backdrop is `absoluteFillObject` of *that* box (`src/styles/ideas.ts:434-453`),
so taps anywhere below the nav row never hit it. On Android, rows hanging below
the header's bounds may not even receive taps. The collection page does it
right: `CollectionHeaderMenu.tsx` is the last child of the screen's
SafeAreaView (`CollectionScreenContent.tsx:155`), state in the screen model
(`useCollectionScreenModel.ts:98-107`), anchored at `insets.top +
HEADER_ROW_HEIGHT`.

**Fix:** lift `headerMenuOpen` into `SongScreenProvider`; new
`SongHeaderMenu` rendered as the last child of `SongScreenContent`'s
SafeAreaView (`SongScreenContent.tsx:56-62`) using the same
`ideasHeaderMenuLayer` / `ideasHeaderMenuBackdrop` / `ideasHeaderOverflowMenu`
styles and `insets.top + HEADER_ROW_HEIGHT` anchor; `IdeaHeader` keeps only
the toggle. Remove the literal `"#a89a96"` at `IdeaHeader.tsx:303` while
there (token). Verify: open menu → tap takes list → menu closes; row taps
work; compare with collection page.

### 3. Card scrub steals the scroll

**Report:** with a card's mini player live, trying to scroll the list starts a
scrub instead.

**Cause:** `src/components/common/useHeldScrubGesture.ts:51-61` calls
`manager.activate()` in `onTouchesDown` — any touch landing on the 18 pt strip
(+10 pt slop) is a scrub before the finger has shown intent, so a vertical
flick that starts on the strip never reaches the list.

**Fix (intent before grab, hold still keeps "drag anywhere"):** keep
`manualActivation(true)`, but decide in `onTouchesMove`/time:
- record the touch-down point and time in shared values;
- `onTouchesMove`: `dx, dy` from the down point. If `|dy| ≥ 10 && |dy| > |dx|`
  before activation → `manager.fail()` (list scrolls). If `|dx| ≥ 6 && |dx| ≥
  |dy|` → `manager.activate()`.
- hold-to-grab: if the finger has moved < 6 pt for ≥ 150 ms → activate
  (press, pause, then drag anywhere still works — the founder's 10-02 ask).
  Implement the timer on the UI thread via a `useFrameCallback` or on JS via
  `setTimeout` + `runOnUI`; RNGH has no built-in hold-then-pan, so a small
  timer in `onTouchesDown` cancelled in `onTouchesUp`/`onFinalize` is fine.
- tap (lift with < 6 pt movement, before activation) stays a seek via the
  existing `onTouchesUp` path.
Once active, behaviour is unchanged (holds wherever the thumb goes). Verify
in the sim with `touch_path`: vertical flick on a live strip scrolls;
horizontal drag scrubs; press-hold-then-drag-down scrubs; tap seeks. Update
the header comment in the hook and the memory note. Android check by founder.

### 4. Mini-player play while in selection mode

**Cause:** `src/components/IdeaListScreen/components/IdeaListItem.tsx:348-354`
— in `listSelectionMode` the lead (play) press toggles selection instead of
playing. The sketch page already keeps playback alive while selecting
(`ClipCard.tsx:230-232`, "Playback survives selection mode"), so the collection
is the odd one out.

**Fix:** in `IdeaListItem` the lead press always toggles the inline preview
(leave the `collecting` / `pickingSongTarget` branches as they are); the card
body still toggles selection; long-press on the lead stays a no-op while
selecting (`:366-369`). Check `IdeaCard`'s `sessionLead` mirror path
(`IdeaCard.tsx:274-280`) still works while selected. Verify: enter selection →
tap a card's play → it plays and the card is not (de)selected; tap body →
selection toggles.

### 5. The "Sketch" action should read as *creating*

**Today:** four sites, two glyphs. Collection multi-select dock
`IdeaSelectionBar.tsx:117-126` (`disc-outline`, label "Sketch"); clip header
menu `IdeaHeader.tsx:238-252` (`albums-outline`, "Make sketch"); player door
and overflow (`PlayerArtifactDoors.tsx:129-164`, `usePlayerScreenLifecycle.ts:553-561`,
`disc-outline`, "Make sketch").

**Fix:** one shared glyph for "make a sketch": `disc-outline` with a small
plus badge at the top-right (new `CreateGlyph`/`badge="new"` prop on the icon
component used in the dock and menu rows — terracotta dot with a 1 px page-
coloured ring, drawn from tokens; no literals). Apply at all four sites;
`albums-outline` goes away. Dock label "Sketch" → "New sketch" (2 words, within
budget; `brand.sketch` stays for other uses — add `actions.newSketch`). Verify
with a screenshot of the dock and the header menu.

### 6. The sounding card stands out more

**Today:** a live inline preview changes the glyph to pause, the strip goes
live, the footer becomes a time caption — but the card shell is unchanged
(`IdeaCard.tsx`; no border/elevation change, `ideasList.ts:59-63`). Only a dock
session gets the `ideasListCardNowPlaying` border (`ideasList.ts:78-82`) and
the terracotta title.

**Fix:** a card that is *sounding* (inline live OR dock session) gets one
shared treatment: terracotta border at the existing now-playing strength,
`surface` → `surfaceHigh` background (tonal lift), shadow opacity to the 0.08
cap, title in `primary`. Replace the rgba literals in
`ideasListCardNowPlaying` / `ideaDenseRowNowPlaying` (`ideas.ts:788`) with
tokens (`colors.primarySurface` for the wash; a new `colors.primaryBorder` if
no alpha border token exists). Dense rows get the same wash. This also
pre-empts item 11: whatever is sounding looks the same way. Verify with
screenshots of a previewing card and a dock-session card, both densities.

## Batch 2 — medium builds

### 7. Mini waveforms never appear until the full player opens

**Report:** card strips stay placeholder unless the clip was opened in the
full player; founder wants waveforms built "when the app is minimized and not
playing anything".

**Causes (`src/services/backgroundWaveformHydration.ts`):**
1. Results are buffered 48 at a time (`HYDRATION_WRITE_FLUSH_SIZE = 48`,
   `:84-92`) — computed peaks sit in memory and never reach the card until 48
   clips finish or the queue drains. The player-open repair writes immediately
   (`usePlayerScreenLifecycle.ts:233-300`), hence the symptom.
2. Each job runs **two** full native decodes: 256 peaks for the card
   (`audioStorage.ts:314`) and the 2048-bin sidecar for the reel
   (`ensureWaveformSidecar`, `:179`).
3. Plain FIFO over the whole library, no priority for what is on screen
   (`:316-370`).
4. Any playback (inline or dock) makes the queue stand down in 15 s cycles
   (`BUSY_BACKOFF_MS`, `:40,240-246`) — fine per the founder ("not actively
   playing"), but it means a listening session makes zero progress.
5. Compact density shows no strip at rest by design (`IdeaCard.tsx:565`).

**Honest limit:** "while minimized" is not available. iOS gives a suspended
app no CPU unless it is playing audio (and we spent yesterday making sure we
do nothing then); Android pauses JS timers in the background
(`JavaTimerManager.onHostPause`). A real background task (BGProcessingTask /
WorkManager) would be native work and is not worth it for waveforms. The
achievable goal: **every visible card has its waveform within seconds of the
app being open and quiet, and the whole library within one idle session.**

**Fix:**
- Flush per job (or every 8 jobs / 2 s, whichever first) instead of 48.
- One decode per clip: decode at 2048 bins once, write the sidecar, and derive
  the 256 card peaks by max-downsampling (8:1). Check `computeStripBarAmps`
  (`src/domain/cardWaveform.ts:31`) is happy with derived peaks (it buckets to
  56 bars anyway). Halves the work.
- Visible-first: export `prioritizeClipHydration(clipIds)` that moves those
  jobs to the front; call it from the collection's viewability handler (the
  one that already drives the sticky day chip) with the visible rows' play
  clips. Debounce 300 ms.
- Keep the busy gate and recording gate as they are (recording must never be
  slowed — see 09-21 audit).
- Tests: `src/services/__tests__/backgroundWaveformHydration*.test.ts` —
  flush cadence, priority reorder, derived peaks length 256 and max-preserving.
- Verify in the sim: fresh dev-sample import (`docs/qa` seeding) → cards fill
  in top-down within seconds while idle; start a preview → queue pauses; stop
  → resumes.

### 12. Write lyrics while listening, from the sketch's Lyrics tab

**Today:** the full player's writer (`PlayerScreen/components/PlayerLyricsWriter.tsx`)
sits under the slim reel + footer transport. The sketch's Lyrics tab
(`IdeaDetailScreen/sections/SongLyricsSection.tsx` → `LyricsVersionsPanel`) is a
version list; editing navigates to the `LyricsVersion` screen
(`LyricsVersionScreen/components/LyricsVersionEditor.tsx`). Neither has any
playback control. The two editors are separate components sharing only the
save path (`saveProjectLyrics`).

**Fix (recommended):** a pinned transport row for the sketch's primary take on
both the Lyrics tab and the `LyricsVersion` editor screen (where the typing
actually happens): play glyph + the shared `ClipInlinePlayer` row
(`src/components/common/ClipInlinePlayer.tsx`) driven by
`useMiniPlayerContext().toggleInlinePlayback(ideaId, primaryClip)`, exactly as
`ClipList.tsx:16` does. Inline engine → no practice loop; that is acceptable
for a first pass (the full player keeps the loop). Place it below the tab bar
/ above the editor, `SurfaceCard` shell, Jakarta time captions. Keyboard: the
row stays pinned above the keyboard-avoiding editor. Copy: none new beyond
`accessibilityLabel`s via `t()`.

Alternative if the founder prefers one place to write: a store intent
`playerOpenIntent: "write"` consumed by `usePlayerScreenUi` so the tab's
"Write with the tape" link opens the full player straight into writing. Cheaper
but replaces the tab instead of adding to it. Decide with the founder (Q5).

## Batch 3 — needs the founder's answers

### 2 (brain dump). Primary clip in a thread; combine a selection into a thread

**Facts:** linking a clip as a version of another exists only inside one
sketch (select → More → Thread… → "Link as version of…",
`SelectionBars.tsx:437-461`, `useSongParentPicking.ts`). The primary is refused
by a deliberate "for now" guard (`useSongParentPicking.ts:96-99`, message
`songDetail.primaryUnavailable*`, `translations.ts:1066-1067`) and never
offered as a target (`:57`, `:167`), because the takes list renders the primary
as its own depth-0 entry (`useSongClipListData.ts:108-124`). The thread view
already tolerates a primary that is not the head (`EvolutionThread.tsx:199-201`).
Versions order by `parentAssignedAt ?? createdAt` (`src/domain/clipGraph.ts:64-69`),
v1 = oldest (`EvolutionThread.tsx:286-290`). Collection multi-select "Sketch"
(`CollectionFloatingActions.tsx:315-410`) makes a *draft* project of N
separate takes, newest first, newest = primary, no `parentClipId`. Title
planning for a thread exists: `buildLineageTitlePlan`
(`src/domain/clipLineageTitles.ts:35-85`) → `base`, `base v2`, `base v3`.

**Build:**
1. Remove the primary guard and the target exclusions; `useSongClipListData`
   renders the primary inside its lineage (PrimaryInk marks it wherever it
   sits). Audit `clipGraph` consumers for assumptions that the primary is a
   root (grep `isPrimary` in `src/domain/clipGraph.ts`, `useSongClipListData`,
   `EvolutionThread`, `ClipLineageScreen`). Delete the two translation keys.
2. Collection multi-select of ≥ 2 clips: "New sketch" asks **"As a thread" /
   "As separate takes"** (one `SelectionActionSheet`, two rows), or threads by
   default — see Q1. Thread mode: sort oldest → newest, chain `parentClipId`,
   `parentAssignedAt = createdAt`, oldest = v1, newest = head and primary.
3. Naming: the draft project already opens for naming; after the title is
   committed, apply `buildLineageTitlePlan(title)` so the versions read
   `Title`, `Title v2`, … (the existing rename prompt
   `clipLineageRenamePrompt.ts` can be reused as the "rename the versions too?"
   step).
4. Tests on the domain pieces (chain building, title plan).

**Q1.** When several clips are selected and you tap "New sketch": always one
thread (oldest = v1), or ask thread vs separate takes each time?
**Q2.** Should the *newest* clip be the primary take of the new sketch (my
default), or the oldest?

### 7 (brain dump). Tags on collection items

**Facts:** there are no idea-level tags. Clips already carry tags
(`ClipVersion.tags`, built-ins riff/verse/prechorus/chorus/intro/outro/interlude
at `songClipControls.ts:6`, custom tags via `globalCustomClipTags` + `ClipTagPicker`),
but they are only filterable inside a sketch's takes list (`useSongClipListData.ts:75-83`,
`SongClipFilterMenu.tsx`). The collection filter popover (`FilterSortBar.tsx:129-232`)
offers Type + stage inks; stage filter is not persisted; `primaryFilter` in
the store is a dead, persisted slot.

**Recommended build (no new data model):** a clip idea's tags are its play
clip's tags. Collection filter popover gains a "Tags" editorial-ink multi-select
(same word-with-leading-dot pattern as stages; custom tags listed after
built-ins; "Untagged" last). Set tags from the card overflow ("Tag…") and from
the selection More sheet (bulk, `setClipTags` per idea's play clip). Persist
the selected tag filter per collection next to the sort (reuse/replace the dead
`primaryFilter` slot; also persist the stage filter while there). Shelf and
Search stay tag-blind for now.

**Q3.** Tags on clips only (reuse what exists), or also on sketches/songs
(needs a new idea-level field and a second filter path)?

### 11 (brain dump). Friction between the media dock and the card mini player

**Facts:** two separate audio engines by design (`FullPlayerProvider.tsx:30-50`):
the inline preview (`useInlinePlayer`) and the dock/full-player session
(`useFullPlayer`). Exclusivity: a card preview *pauses* the dock but leaves it
visible, dimmed, subtitled "Preview playing" (`GlobalMediaDock.tsx:127,380-381,457`);
any dock playback stops the preview. A preview never shows in the dock or on
the lock screen as a session, and the previewing card does not get the
now-playing look (`IdeaListItem.tsx:155-159`). So the user can see: a dimmed
dock naming clip X, a card for Y with a pause glyph, and card X still marked
"now playing" — three signals for one sound. That is the friction.

**Options:**
- **A — keep two concepts, make them legible (small):** item 6's shared
  "sounding" look; when a preview starts the dock *collapses to a hairline*
  (or hides) instead of sitting dimmed, and returns paused when the preview
  ends; card X drops its now-playing mark while paused behind a preview.
- **B — one session (big, right):** a card's play starts a dock session for
  that clip (queue = the visible list in current sort, like tapping a track in
  a playlist; or a one-clip queue — Q4), and the card's live strip mirrors the
  dock's clock (`sessionLead` already mirrors the session when the card's
  clip is the session clip, `IdeaListItem.tsx:148-153`). The inline engine is
  retired surface by surface (Collection, ClipList, Activity, Revisit, Shelf,
  Lineage, Songbook, Received). One transport, one lock-screen card, loops and
  the reel available for anything you started from a card. Note the 2026-07-23
  interaction law already says "the clip card's play button drives the
  mediadock/full-player flow".

**Recommendation:** A now (ships with batch 1/2), B as its own phased project
after the Android confirmation — B touches every list surface and the lock
screen and must not be rushed under the no-breakage rule.

**Q4.** For B: when you press play on a card, should the queue be just that
clip, or the list you are looking at (in its current sort) so next/previous
walk the collection?

### 12 (brain dump) — **Q5.** Lyrics while listening: a transport row inside
the sketch's Lyrics tab and editor (recommended), or a link that opens the
full player straight into writing?

## Deferred

### 4 (brain dump). Dark mode

**Facts:** the app is light-only (`app.json:16 userInterfaceStyle: "light"`,
no `useColorScheme` anywhere). `colors` is a static `as const` object (~43
keys); 233 files import it, ~2,265 references; 155 modules freeze colors in
module-scope `StyleSheet.create`; `src/styles.ts` merges 13 style files into
one static sheet; ~981 hex + ~109 rgba literals in 94 files bypass tokens;
the Skia visualizers hold module-level colour constants; workspace hues are
computed with fixed light lightness (`workspaceTheme.ts`); section inks are
tuned to 4.5:1 on the light page.

**Cost:** a live theme is a multi-day refactor touching most of the codebase
(theme-aware style factories + tokenizing ~1,090 literals + dark variants for
inks, shadows, workspace hues, Skia). A startup-chosen palette (mutable
`colors` set from `Appearance` at boot; restart to switch) avoids the 155-file
structural change but still needs the literal cleanup and a full dark palette.

**Recommendation:** not before launch; the literal cleanup is worth doing on
its own as debt reduction and makes either route cheaper later.
**Q6.** Is dark mode a launch requirement for you, or a post-launch item?

## Founder's answers (2026-10-03)

- Q1: ~~always one thread~~ → **2026-10-04 reversed**: a new sketch keeps its clips as separate takes; threads are combined explicitly inside the sketch (select ≥ 2 → Thread… → Combine into thread).
- Q2: not decided by the founder; default = **newest clip is the primary take**
  (the version you would play). Flip in one line if asked.
- Q3: tags on **clips only** — reuse the existing clip tags in the collection.
- Q4: dock vs card is a bigger issue — **set aside** for its own exploration
  later. Item 6 (sounding card) still ships; option A's dock changes do NOT.
- Q5: **full player**, opened straight into writing from the sketch's Lyrics
  tab — but only as an opt-in for someone who wants to hear the audio; the tab
  itself stays as it is. "Make sure it looks good."
- Q6: dark mode is **post-launch** — set aside.
- Clip rename counts as editing → stamp `lastActivityAt` for clip-kind title
  changes too.

## Order of work

1. Batch 1 (items 1–6 above, plus clip-rename stamping in item 1), one
   commit each, one preview OTA, memory note.
2. Batch 2: 7 (waveforms), 12 (Lyrics tab → full player into writing, via a
   store intent consumed by `usePlayerScreenUi`; the tab gains one quiet
   "Write with the tape" ink link — not a transport row).
3. Batch 3: threads (primary allowed; multi-select always threads, newest =
   primary), then tags (clips only).
4. Set aside: dock vs card unification (Q4), dark mode (Q6).

## Verification checklist per item

`npx tsc --noEmit` · `npx jest <touched suites>` · iOS sim screenshots of the
before/after state · `git commit` (one per item) · `eas update --channel
preview --platform android` once per batch · update
`docs/product-plan/founder-pass-2026-10-03.md` status lines below.

## Status

- [x] 1 Updated sort ignores import time (b6b2caf3)
- [x] 2 Sketch ⋯ menu dismisses on outside tap (1e40c688)
- [x] 3 Scrub needs horizontal intent or a hold (4883c186)
- [x] 4 Play works in selection mode (9110e535; + blank-strip-after-preview fix 39b5d21e)
- [x] 5 "New sketch" glyph + label (b5e2233b)
- [x] 6 Sounding card stands out (0a5c6cfe) — batch 1 preview OTA c3bac93c, Android unverified
- [x] 7 Waveforms: per-job flush, one decode, visible-first (c6066bbc)
- [x] 12 Lyrics tab → full player into writing (c1803d93) — batch 2 preview OTA, Android unverified
- [x] Threads: primary allowed (709084f8); auto-thread on New sketch REVERTED 2026-10-04 (6334de04) — takes arrive separate, "Combine into thread" inside the sketch; edit sheet Save/Discard only + stranded-draft recovery (2c7eead7), OTA 130e5d9a
- [x] Tags in the collection (7cc1195f) — batch 3 preview OTA, Android unverified
- [ ] Dock vs card — SET ASIDE by the founder (Q4)
- [ ] Dark mode — SET ASIDE, post-launch (Q6)
- [x] 2026-10-05 follow-ups: "Take out of thread" for a multi-select (2ecc001d); queue go-to lands on the card and flashes it (a5386ae8: `registerRootNavigation` for the player sheet's shim, rAF after minimize, geometry scroll + highlight after settle) — production OTAs 32002e6c / b1e6f872

## Compilations pass (founder, 2026-10-11)

**Report:** ✕ while adding to a playlist left you in the collection; back and
hardware back wandered (the session was a drawer switch with no spine; Android
`backBehavior="initialRoute"`); the session outlived the flow; no way to pick
from another workspace; three different add flows (setlist had its own
builder); "Songbook" confused.

**Decisions:** a setlist takes anything (a lyrics-only sketch is a valid
entry) and gets its own description; Songbook → **Charts** tab / **chart book**
object.

- [x] A. Session spine (01519a62): Add and ✕ both return to the compilation;
  hub shows a back chevron (no menu — tasks don't carry it), drawer swipe off
  while picking; `LIBRARY_COLLECTOR_ROUTES` in App.tsx ends a session that
  lands anywhere but Browse/CollectionDetail; basket lives on
  `libraryCollector.picks` ({workspaceId, ideaId}) — accumulates across
  collections and workspaces, hub footer offers "Add N"; identity block →
  `WorkspacePickSheet` ("PICKING FROM ▾"); workspace stack pops to the hub
  after the session; `resolveCollectorPicks` (domain/libraryCollectorPicks.ts).
- [x] B. Setlist on the shared picker (0fc7adb7): Add Song = `startCollecting`;
  `SetlistEntryBuilderView` only repacks an entry (edit mode → row);
  `Setlist.description` via `renameSetlist(id, title, description)`, "Set
  details" sheet, shown under the meta, carried in the shared archive.
- [x] C. Rename (9d37a859): label-only, EN+HE; data kind stays `songbook`.
- [x] D. Hub polish (1f661a7d): tab captions → header `?` (HelpSheet, 4 rows);
  "From others" toggle → `CompilationListControls` (Show All · Mine ·
  Received / Sort by Updated · Name · Created, persisted in
  `useReceivedPrefsStore` v2, `listCompilations` in domain/compilationListing.ts;
  funnel hidden on Playlists); the three "New …" soft keys → `CreateFab`.
  Founder: reuse the collection's row, not a new look → rebuilt on
  `FilterSortControls` with the tonal search field; search is per tab and
  looks inside (title · note · song titles, `domain/compilationSearch.ts`).
- [x] E. AIFF import: iOS converts to M4A via `renderTrim` over the full range
  (`convertAiffToM4a` in audioStorage.ts); Android refuses with
  `UnsupportedAudioFormatError` and one alert (`reportUnsupportedImports`,
  `collectionImport.unsupportedFormat*`). Founder's Logic bounces: use WAV.

## Send & receive pass (founder, 2026-10-11)

**Report:** can't drop a folder on the sender page; no reorder; a set
arrived shuffled in the app; the receive screen is a one-off (own rows,
stadium button, "where did it go" only in a footnote); Received package page
uses a non-canon card and can't feed a playlist/setlist. **Decisions:** the
sender decides what a parcel is (Files · Playlist · Setlist); a parcel with
an entity lands on it in Compilations, loose files land inside their package
in Received; received packages open as the real collection page.

- [x] B. Order bug (d90a3371): clips added by parcel index after the batch,
  stamped `receivedAt + index`; Received package lists oldest-stamp first.
- [x] A. Sender page (e8e6165b, worker 54efa019): folder drop
  (`webkitGetAsEntry` walk) + "choose a folder" (`webkitdirectory`), dotfiles
  skipped, folder → title, drag/▲▼/A→Z/Clear, XHR per-file progress, inline
  errors, "From" remembered, frozen receipt. `.claude/launch.json` runs the
  worker from its own folder (the app-root `wrangler.jsonc` gotcha).
- [x] C. Receive screen on canon: SurfaceCard rows with a streaming play
  lead (`useParcelPreview`, yields to the dock, never during a recording),
  meta line FROM · N FILES · SIZE · DAYS LEFT, "Saves to Received › title"
  above one soft key (Save / Save all), >150 MB asks first, back mid-save asks
  and aborts cleanly, Save lands INSIDE the package; file names lose their
  extension; the pasteboard offer goes through t(). Tokens only.
- [x] D. (799f68f2) Received package opens as a CollectionVisit (back
  "Received", up-link → Received, no record key, overflow gains Move to my
  workspaces / Delete package, New sketch + Import hidden); the package's
  collection wears the parcel's name (legacy "Files" renamed on open) and
  reads oldest-first (`ideasSort` forced for `origin === "received"`);
  `WorkspacePickSheet` lists packages under Received (picked by route param
  only — never the active workspace). Picker group verified by code only.
- [x] E. Parcel kind: sender page segmented Files · Playlist · Setlist →
  `kind` on create → `transfers.share_kind` (migration 0003, applied remote)
  → payload `kind` → recipient page "N songs · a setlist, in order" → app
  builds a Setlist (one take per entry) or Playlist from the package in
  parcel order and lands on it. `ShareKind` gains "playlist". Verified in the
  sim with a setlist-kind parcel.
- [x] E2: in-app playlist send — `domain/playlistExport.ts` +
  `services/playlistShare.ts` (mirror of setlist), manifest/export/import
  carry `playlists`, `Playlist.received`, receiveRouting kind "playlist",
  Share playlist / Get a link on the playlist overflow, SentLinkChip.
  Verified: the app sealed t_6O81iomlJLHwdppCPeeZA0 ("Playlist 1") via Get a
  link. NOT yet verified: opening that link on the receiving side (usage
  limit hit) — next session: open the link in the sim, expect "Saves to your
  Compilations", Save → Playlist 1 in Compilations, "Playlist imported".
- Production OTAs android/ios + preview android published 2026-10-11 (see
  memory for ids). Not verified on a real device; cross-workspace picking
  verified by test only (the sim has one workspace).

## Founder follow-ups (2026-10-11, batch 2)

- [x] E2 receive side verified (Playlist 1 arrived in order, "Playlist imported").
- [x] Parcel key pinned under a scrolling list; archive rows named after the
  parcel; empty sender → "someone" (081dc03e).
- [x] Web pages show names without extensions, wire unchanged (c2fbd5e8).
- [x] Picker: ring only when picked; count · All · Clear in the toolbar row
  via SelectionTopBar + `setLibraryCollectorPicks` (caf2f3ba).
- [x] Section/pin arrows step 1–5 s scaled to the clip; preview runs through
  `resolveSectionEdit` so a pushed neighbour visibly moves (0da485af).
- [x] Received: "Keep this…" InkLink on the package page (identity block now
  box-none), ⋯ keeps only Delete; `ReceivedPackageMoveModal` (own workspace ·
  workspace top level · under a collection) backed by
  `adoptReceivedPackageInto` = moveCollection + deleteWorkspace; list
  long-press multi-select with Keep… / Delete (61421ae0). The collection keeps
  the parcel's name (founder suggested "Collection 1"; parcel name chosen).
- [x] Playlist… in the collection and sketch selection More sheets, Save on
  the queue header, all through `PlaylistChooserSheet`; the dock's queue is
  the full player's expandable BottomSheet (c9b6208c).

## Live scrub readout (founder, 2026-10-11)

Founder: while dragging the reel, the header's mm:ss only caught up on
release. Cause: the readout rendered React state, which moves only when the
engine reports; the tape moves on the UI thread through `timelineAudioProgress`
and commits one seek at release. Fix (d10f5017): `LiveTimeReadout` — a
non-editable text input whose text is an animated prop derived from the same
shared progress × `sharedDurationMs`, `fmtDuration` made a worklet. No React
render per frame (the reel-overlay desync rule holds). Sim-verified: mid-hold
screenshot shows the readout at the dragged time while playback is paused for
the scrub; release resumes from there and the readout keeps ticking.

## Sketch door folds after the first sketch (founder, 2026-10-12)

Founder: "Grow this into a sketch" on every clip's full player is right for a
new user and busy afterwards; how long should it stay? Decision: not a clock.
The door folds the moment the library holds its first sketch — the exact
moment the lesson landed — using the `anySketch` check that already gated the
terracotta wash, so no new persisted state. Before: the full card (Lora title,
one-line body, link). After: the canon empty-door line the Lyrics and Chart
doors use — SKETCH · No sketch yet · Make sketch ›. The slot keeps its shape
(a clip honestly shows it has no sketch) and nothing is lost: Make sketch also
lives in the player's overflow. Sim-verified the folded state on a standalone
clip; the full card is unchanged code.

## Updated means work (founder, 2026-10-12)

Founder added sections and pins to a standalone clip and it did not move under
the Updated sort; asked what should count. Audit found two rules that disagreed:
a clip counted only rename / notes / tags; a sketch counted almost any write,
including layers-bench knob turns, the background mix re-render after them and
even playback healing a missing mix file, while a title-only rename, pins,
sections, bookmarks and groups did not.

Decision: one rule for both kinds. "Updated" moves when the idea's CONTENT
changed — something a listener or reader would notice, something you'd lose if
the edit were undone. Practising, organising and housekeeping don't count.

| Counts | Does not count |
|---|---|
| Rename, notes, tags | Bookmark, hide, move to another collection / workspace |
| Sections added / moved / renamed / deleted | Groups created / renamed / collapsed |
| Pins added / moved / renamed / annotated | Loop, speed, pitch, step-up, transpose, metronome |
| Lyrics, chords, chart | Tempo detection |
| Take recorded / imported / trimmed / deleted / set primary / threaded | Mix re-render, playback healing a mix, grid self-align |
| Layer recorded / deleted / nudged / gain / tone, base-take gain / tone | Layer colour, name, mute |
| Stage change | Importing a library (already excluded) |

Built: `domain/ideaActivity.ts` `ideaWorkChanged(prev, next)` — a value diff of
the fields that count, used by `updateIdeas` for both kinds (replaces the
clip-words rule and the sketch "anything stamps" rule). Section and pin
setters, `renameIdea` (was `renameIdeaPreservingActivity`), take deletion and
paste-into-a-sketch stamp explicitly because they bypass `updateIdeas`. No
migration: existing timestamps stay. Table-driven test in
`state/__tests__/updateIdeasIdentity.test.ts` walks the table for both kinds.
