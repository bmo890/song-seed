# Audit — Lyric tools & word services

Scope: Lyric Pad / Lyric Spark page (`NotepadScreen/**`), Word Ladder, Cut-Up, Magpie (Borrowed Words), Word Finder sheet, spark frame/send/text-scale, Reading sheet/SongReading/TitleInput, domain `wordTools/wordLadder/wordLadderIdeas/cutUp/magpie*/notepad/lyrics`, `wordLookupCache`, spark/magpie prefs stores, `i18n/**`, `useDraftText`, and the three Cloudflare workers (`server/word-proxy`, `server/word-he`, `server/magpie-benyehuda`).

Method: every file in scope read end to end; call paths traced from the screens to the store/workers; three scratchpad scripts run (`i18n-audit.js` catalog <-> `t()` cross-check for en+he, `dead-exports.js` export-usage scan, `hardcoded.js` literal-string scan). Nothing was run in a simulator; findings marked "unverified" say so.

Counts: **P0 0 · P1 2 · P2 9 · P3 10** (+ dead-code and i18n inventories).

---

## P1 — should fix before launch

### 1. Second Magpie opened in a session never draws its page (and inherits the previous spark's error)
- **Severity P1 · confidence high (code-traced; drawer config verified; not run)**
- `src/components/MagpieScreen/hooks/useMagpieScreenModel.ts:50-54, 118-126`; root cause `App.tsx:185-190, 776-781` + `src/components/MagpieScreen/index.tsx` (no `key`).
- What happens: `WordLadderHome`, `CutUpHome`, `MagpieHome` are **drawer screens with `freezeOnBlur`** — mounted once, then reused for every spark via `navigate("MagpieHome", { sparkId })`. `autoLoadedRef` is set to `true` on the first spark and never reset, so when the writer opens a *new* Magpie later in the session (`book: null, pageText: ""`), the mount effect returns early: no page is fetched. The page card shows the empty scroll, the book line says "Finding a book…" forever (no spinner, no error — `busy` is false). The only way out is opening the book sheet and tapping "New page". `status` (L50) is also per-component: an offline error left on spark A renders `ErrorState` over spark B's perfectly loaded page until Retry.
- Fix: reset per spark — `useEffect(() => { autoLoadedRef.current = false; setStatus({ loading: false, error: null }); }, [sparkId])` (placed before the auto-load effect), or render `<MagpieScreenContent key={sparkId} />`. **[SMALL-WIN]**

### 2. Undo/redo and "armed word" leak across sparks and can write one spark's data into another
- **Severity P1 · confidence high on mechanism, medium on how it reads on screen (not run)**
- `src/components/CutUpScreen/hooks/useCutUpScreenModel.ts:314-350` (`boardHistory`), `src/components/WordLadderScreen/hooks/useWordLadderScreenModel.ts:50` (`armedWord`) and `:101` (`pairingHistory`), `src/components/MagpieScreen/hooks/useMagpieScreenModel.ts:165` (`fragmentHistory`). Same root cause as #1 (screen instance reused).
- What happens: arrange spark A's table → back → open spark B → the Undo glyph is enabled with A's snapshots; one tap runs `apply({ boardItems: <A's items> })` on B: scraps whose `chunkId`s don't exist in B render as empty cards (dropped only on the next cold load by `sanitizeBoardItems`). Word Ladder: tap a verb in exercise A, leave, open exercise B, tap a noun → `createPairing(A.wordId, B.wordId)` (L245) — a pairing with a foreign word id that `pairCount`/`canLeavePairs` count but the board can't show. Magpie: Undo on B restores A's fragments.
- Fix: clear on spark change — `useEffect(() => { clearBoardHistory(); setArmedWord(null); pairingHistory.clear(); fragmentHistory.clear(); }, [sparkId])` in each model (the cut-seam history already does this on `sourceKey`, L227-231), or the `key={sparkId}` remount from #1 which fixes #1 and #2 at once (also resets `CutUpSourceStep`'s `unlocked` and `MagpiePageStep`'s `selected`). **[SMALL-WIN]**

---

## P2 — fix soon

### 3. Lyric Pad: a brand-new page typed and closed within half a second is deleted
- **P2 · confidence high (code-traced)**
- `src/components/NotepadScreen/hooks/useNotepadScreenModel.ts:282-290` + `src/components/NotepadScreen/components/NoteEditor.tsx:97-104`.
- `handleBack` flushes the drafts (synchronous Zustand write) and calls `onBack` in the same tick; `handleCloseNote` reads `notes` captured by the previous render, sees `title === "" && body === ""` for the just-committed page and calls `deleteNote`. Repro: + → type "hello" → tap the back chevron within 500 ms of the last keystroke (before the idle commit) → page and text are gone. Only the first commit of a new page is exposed.
- Fix: `const note = useStore.getState().notes.find(...)` inside `handleCloseNote`. **[SMALL-WIN]**

### 4. Cut-Up has no size cap on the live path; Cut and Arrange steps scale linearly in views and quadratically in work
- **P2 · confidence medium (no device profiling)**
- `src/domain/cutUp.ts:15-16` (`MAX_SOURCE_LEN`, `MAX_CHUNKS` only guard `sliceSource`, which is reached solely by the dead chunk-mode actions, see Dead code), `:201` `tokenizeWords`, `:345` `generateChunksFromSeams`; `src/components/CutUpScreen/components/CutUpSourceStep.tsx:75-84` (`UserTextInput` has no `maxLength`); `CutUpLineSelectSheet` "Select all" imports a whole page.
- Cut step `CutUpChunkEditor.tsx:43-61` mounts one `Text` + one `Pressable` per word in a plain `ScrollView`; Arrange `CutUpBoard.tsx:160/318` rebuilds a `Gesture.Race(pan, tap)` for every scrap on every render (so `memo(Scrap)` never short-circuits), `:101` copies the whole size map into a Reanimated shared value on every scrap layout (O(n²) and a UI-thread serialization per scrap), `:72` `textById` is a linear `find` per scrap per render; `useCutUpScreenModel.ts:223` re-tokenizes and re-seeds seams on every render while `cutSeams` is undefined. Paste a few thousand words (an album) and the Cut/Arrange steps become multi-second renders with hundreds of gesture handlers.
- Fix: enforce `MAX_SOURCE_LEN` in `commitSource`/`pickSourceNote` (+ `maxLength` on the field, cap `tokenizeWords` to `MAX_CHUNKS`); memoize gestures per id (map keyed on id/x/band) and update `sharedSizes` with `.modify` for one id.

### 5. Two sheets write the whole spark to the store on every keystroke
- **P2 · confidence high**
- `src/components/CutUpScreen/components/CutUpBoard.tsx:473` (`model.editStripText`) and `src/components/MagpieScreen/components/MagpieBuildStep.tsx:323` (`model.editFragment`).
- Both models document the "commit on a pause, not per keystroke" rule (`useDraftText`) because a per-character spark write notifies every mounted selector and re-arms persistence; these two inputs bypass it.
- Fix: local draft state + commit on blur/close (reuse `useDraftText`). **[SMALL-WIN]**

### 6. Magpie Hebrew worker has no rate limit at all
- **P2 · confidence high**
- `server/magpie-benyehuda/worker.js:107-131` (`handleRandom`), `:140-178` (`fetchWork` = 2 upstream calls per miss), `:181-205` (`liveFallbackDraw` = up to 3 searches + 2 fetches).
- Ben-Yehuda allows 50 req/min per key. Twenty-five "New page" taps a minute from one person — or any script hitting the public URL — exhausts the shared key and every user gets `502 text fetch failed` ("That page wouldn't open"). The sibling `word-he` worker already has the KV fixed-window `bumpCounter` pattern (per-IP + global breaker).
- Fix: port `bumpCounter`/`json429` and guard both `fetchWork` and `liveFallbackDraw`; the app already maps non-OK to a friendly state.

### 7. Magpie index rebuild runs inside a request's `waitUntil` and only writes at the end
- **P2 · confidence medium (Cloudflare limits not verified live)**
- `server/magpie-benyehuda/worker.js:101, 116, 209-250`.
- A full rebuild is ~4 genres × ≤60 pages × 1.5 s sleep ≈ 6 min; the pool is written once at the end (`:249`). A fetch handler's `waitUntil` budget is far shorter than that, so the cold-start rebuild is likely killed before it stores anything; the lock then holds for 300 s and every cold request falls back to live search (slow, low variety, upstream-hungry). The weekly cron (15-min budget) is the only path that can finish.
- Fix: write the pool incrementally per genre (and/or per page), and let the cron be the builder; keep the request path read-only.

### 8. Edge cache is a no-op on the deployed hostnames
- **P2 · confidence medium**
- `src/domain/wordTools.ts:19` and `src/config/magpieService.ts:12` point at `*.workers.dev`; `server/word-proxy/worker.js:48-61`, `server/magpie-benyehuda/worker.js:142-171`, `server/word-he/worker.js:283-304` use `caches.default`. Cloudflare's Cache API has no effect on `*.workers.dev` subdomains, so: word-he still works (KV tier), magpie re-fetches every work's full text from Ben-Yehuda on every draw of that work, and word-proxy (when cut over for the 2027 key) would forward every lookup to Datamuse and burn the daily quota.
- Fix: route the workers through a custom domain, or add a KV tier for magpie text (as word-he does).

### 9. Empty lookup results are cached forever (client and server)
- **P2 · confidence high**
- Client: `src/domain/wordTools.ts:440-441, 602-603, 636-637, 717-718` persist `[]` to SQLite; `getCachedWordSuggestions` returns `[]` as a hit (`stored !== null`). Server: `server/word-he/worker.js:299` stores whatever the LLM returned (`{words: []}` included) in KV with no TTL + 1-year edge.
- A transient bad answer (model hiccup, Charuzit outage returning an empty stream) makes that word permanently "No matches" on that device, and for everyone until `PROMPT_VERSION` is bumped.
- Fix: don't persist empty arrays client-side (memory only); on the server give empties a short `expirationTtl`. **[SMALL-WIN]** (client)

### 10. Request timeouts cover the headers, not the body
- **P2 · confidence medium-high**
- `src/domain/wordTools.ts:323-342, 449-474` (timer cleared in `finally` before `response.json()`), `src/domain/magpie.ts:40-52, 110` (`res.text()`), `src/domain/magpieBenYehuda.ts:14-21, 53-57` (`res.json()`), `fetchRandomLibraryBook` `res.json()`.
- Every call has an 8 s `AbortController` (good), but a connection that returns headers and then stalls (captive portal, one-bar mobile) hangs in the body read. Word Finder is rescued by its external abort (re-query/close); Magpie has no external abort, so the page spinner stays until the OS drops the socket.
- Fix: clear the timeout after the body is parsed (move `clearTimeout` after `await response.json()`), or `AbortSignal.timeout`. **[SMALL-WIN]**

### 11. Cut-Up table in the Hebrew UI: scrap position vs. drag-clone position (unverified)
- **P2 · confidence low (needs the simulator in Hebrew)**
- `src/components/CutUpScreen/components/CutUpBoard.tsx` Scrap: `rtl ? { right: offset } : { left: offset }`; clone: physical `translateX`. `src/i18n/direction.tsx:35-45` documents that RN swaps `left`/`right` globally in the Hebrew app and a `direction: "ltr"` subtree does **not** opt out; it offers `physicalEdge()` for exactly this — the board doesn't use it. If that doctrine holds, in the Hebrew UI every scrap draws on the mirrored edge while the lifted clone computes from the physical edge (the scrap jumps on lift and lands elsewhere). The 2026-10-20 note verified a Hebrew table, presumably in the English UI.
- Test: Hebrew UI → Cut-Up with Hebrew source → Arrange → drag a scrap. Fix if it reproduces: `[physicalEdge(rtl ? "right" : "left")]: offset`.

---

## P3 — nice to have

12. **Dates ignore the app locale** — `NoteEditor.tsx:42-48` and `NotepadScreenContent.tsx:49` call `toLocaleDateString(undefined, …)`; a Hebrew UI on an English device shows English month names. `currentFormatLocale()` exists (`src/i18n/formatLocale.ts`). **[SMALL-WIN]**
13. **Hex literals** — `NotepadScreenContent.tsx:807-810` `matchText` uses `#f0d4cc` / `#5c2d1e` (tokens-only rule). **[SMALL-WIN]**
14. **Magpie source link / cover** — `MagpiePageStep.tsx:503` `Linking.openURL` without `.catch` (unhandled rejection when no handler); `:328` `<Image>` has no `onError` fallback to the initials tile, so whole-library draws with no cover show a blank grey tile. **[SMALL-WIN]**
15. **"Coming soon" is reachable** — `WordFinderSheet.tsx:178-181, 569-578` (`wordFinderUi.soundSoon`): pick Consonance / Sounds like with an English word, then type a Hebrew word. Placeholder copy in a shipping app; map `hebrewSound` to `unsupported` instead.
16. **Side effect inside a state updater** — `useCutUpScreenModel.ts:332-350` `undoBoard/redoBoard` call `apply(...)` inside `setBoardHistory(h => …)`; StrictMode double-invokes updaters (double apply in dev). The shared `useUndoHistory` (`common/useUndoHistory.tsx:24-38`) explicitly avoids this; use it for the table too. **[SMALL-WIN]**
17. **Hebrew content in the English UI renders in the system fallback face** — fonts remap by UI language only (`App.tsx:862-871`), so a Ben-Yehuda page or Hebrew Word Finder results in the English app aren't in FrankRuhl/Heebo. Design call; noting only.
18. **`· שורש` literal in domain** — `wordTools.ts:748` builds a Hebrew-only suffix outside `t()`. Acceptable, but it is the one user-facing string in scope not in the catalog.
19. **Gutenberg fallback downloads whole books** — `magpie.ts:60-75, 110-113`: when a server ignores `Range` (200), `probeTotalBytes` triggers a full-body download it never reads and `fetchPassage` reads the whole text (1–5 MB, uncompressed because of `Accept-Encoding: identity`). Known/mitigated path (2026-10-17 note), still worth a `Content-Length` sanity cap.
20. **Magpie remove → toast Undo restores a snapshot** — `useMagpieScreenModel.ts:178-195` `apply(before)` discards anything pocketed between the remove and the Undo tap.
21. **Lyric-sheet drafts have no recovery** — `LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx:138-150` keeps the draft in React state with an explicit Save and a discard guard; an app kill mid-edit loses the draft (the Lyric Pad and the player's writer autosave). Outside my file list; recorded because the brief asked.

---

## Answers to the particular questions

**Offline / airplane mode.** Every network call in scope has an 8 s `AbortController` timeout: `fetchWordServiceJson`, `postWordHeJson` (wordTools.ts), `safeFetch` (magpie.ts), `fetchWithTimeout` (magpieBenYehuda.ts). None lacks one. The gap is the body-read phase (#10) and Magpie's lack of an external abort on navigation (harmless: `load` captures `sparkId`, so a late result lands on the right spark). Failures are friendly: Word Finder → `offline` / `busy` (429) / `error` states, all `t()` copy; Magpie → `ErrorState` keyed on `MagpieFetchError.kind` (the English `message` strings are never shown); Datamuse/worker non-200 → generic error state. No infinite spinner in the normal paths; the stuck-spinner case is #10. `userFacingMessage` (`i18n/userFacingError.ts`) keeps raw messages out of dialogs except in `__DEV__`.

**Hebrew / RTL.** Font remap is global by UI language (`App.tsx:862-871`): Lora→FrankRuhl, Jakarta→Heebo in the Hebrew app; Hebrew content in the English app falls back to the system face (#17). Direction: paragraphs use `UserText align="content"` (Magpie page, note previews), inputs use `UserTextInput` (resolves per content, iOS edge fix); chip rows in the Word Finder and cut rows use `contentRow("rtl")`. Cut-up board reading order is content-derived (`canvasRtl`) — correct in the English UI; the Hebrew-UI edge swap is #11. Hebrew word tools: rhymes/near via Charuzit (readings picker, syllables derived from nikud), meaning modes via the LLM worker behind an explicit tap, definition via long-press; sound modes without a backend are hidden from the tool list (#15 is the one leak). `sanitizeThemeWords` and `extractWordRange` handle Hebrew joiners (geresh/gershayim/maqaf).

**Lyrics versions.** `saveProjectLyrics` (`state/actions.ts:1909-1949`) edits the latest version in place; a new version is only ever created explicitly (`saveProjectLyricsAsNewVersion`). The lyric sheet editor saves on a button with a `beforeRemove` discard guard — no autosave race, but no draft recovery on kill (#21). The player's `PlayerLyricsWriter` autosaves on a 700 ms pause and flushes on blur/unmount with a one-way binding — a version can't be lost, but it is last-writer-wins over edits made elsewhere while open, and it logs an activity event per pause (`logIdeaActivity(…, "lyrics-save")`) — check that Activity coalesces (outside scope, unverified). Lyric Pad pages: `useDraftText` commits after 500 ms idle, on background and on unmount, so a kill loses ≤ 0.5 s of typing; the one loss path is #3.

**Cut-up board.** Gesture model is sound (pan blocks the scroll, tap opens the sheet, drag sentence haptics via `grab/tick/light`), but scales poorly with many tiles (#4); undo history leaks across sparks (#2); memory per saved spark is small (chunks + board items with x/y; `sanitizeBoardItems` drops orphans on load).

**Magpie.** Gutenberg is Range-fetched (3 000 B windows from the middle band, probe + window = 2 requests per page; Gutendex page for whole-library draws ≈ 50 KB) — not whole books, except the 200-fallback (#19). Hebrew pages come pre-cut (≤ 3 600 chars) from the worker. Parsing (`tokenizePageIntoParagraphs`) is a regex pass over ≤ 4 KB, memoised per `pageText`; rendering is per-paragraph memo with `selKey` — cheap. Caching: nothing client-side (every "New page" is a network call), server-side only via an edge cache that is inert on workers.dev (#8).

---

## Server workers — security review

**word-proxy (not deployed; app calls Datamuse directly until 2027-01-01).** Key stays server-side and is stripped from the cache key (`worker.js:48`, leaves a trailing `&` — harmless). Allow-listed params. Gaps when it goes live: no rate limit; no value-length validation; upstream error bodies and headers are passed through verbatim (`:54-56`); an upstream `fetch` throw is unhandled (1101 page); edge cache inert on workers.dev (#8). CORS `*` is fine (no credentials).

**word-he.** Good shape: Hebrew-only regex validation (≤ 30 chars), themes ≤ 5 × 30, per-IP 40/h + global 1 500/day on billable misses, Charuzit 240/h, `max_tokens` cap, structured outputs, generic error bodies (`lookup failed` / `rate limited`), key never leaves the worker, 429 → in-app "busy". Residual: `request.json()` with no size check (`:261`; CF caps at 100 MB, so a large body is CPU, not memory), KV counters race (documented, fail-open), empties cached forever (#9), `x-forwarded-for` fallback is spoofable but unreachable behind Cloudflare. Prompt-injection surface is Hebrew letters constrained by a JSON schema — negligible.

**magpie-benyehuda.** Key server-side, `genres` validated, generic errors, random responses uncached (correct). Gaps: no rate limit (#6), rebuild in `waitUntil` with a single final write (#7), inert edge cache (#8), unbounded `txtRes.text()` (`:159`; Ben-Yehuda works are small — fine), live fallback can spend 5 upstream calls per cold request.

---

## i18n audit (script: `scratchpad/i18n-audit.js`)
- Catalog: 3 026 leaf keys en, 3 026 he; **en<->he parity 0 missing either way** (also enforced by `src/__tests__/translations.test.ts`).
- `t()` literal keys used repo-wide: 2 427; **keys referenced but absent from the catalog: 0** (the 4 `recording|overdub|editor|send.thesis` hits are a prefixed wrapper in `common/helpContent.ts` — false positive).
- Dynamic templates in scope (`wordSparks.${step}`, `wordFinderUi.${mode}/${mode}Desc/${group}`, `cutUp.${flavor}(Desc)`, `magpie.genre.${genre}`): all 47 derived keys exist in en and he (step names are mapped before lookup).
- Hardcoded user-facing strings in scope components: none found by the scanner; the only non-`t()` strings are the dead constants below and #18.
- **Unused keys in scope** (en+he, 33): `magpie.openingPage, pocketCount, buildDraft, page, book, genreSettings, textSize, pourInOrder, nothingBody, rebuildTitle, rebuildBody, rebuild, yourDraft, rebuildFromWords` · `wordLadder.draftPlaceholder` · `wordLadderHelp.setupTitle, setupBody, oddPairs, nameTitle, nameBody, listTitle, listBody, tapTitle, tapBody` · `notepad.lyrics, notepad.sparks` · `lyrics.editing, current, versions, expand` · `reading.key, reading.original` · `brand.lyricsSpark`. Repo-wide the scan lists 198 never-referenced keys (full list in the script output; outside my scope, not vetted).

## Dead code (script: `scratchpad/dead-exports.js`, each verified by grep)
- **Cut-Up chunk-mode subsystem is dead end to end**: `useCutUpScreenModel.ts` `setChunkMode / recut / toggleChunk / split / merge` are returned but no component calls them; so `cutUp.ts` `CHUNK_MODE_OPTIONS` (English labels), `sliceSource`, `generateChunks`, `toggleChunkIncluded`, `splitChunk`, `mergeChunkWithNext`, `MAX_SOURCE_LEN`, `MAX_CHUNKS` (and the `chunkMode` field's "custom" branch) are unreachable in the app. Also unused: `unitIndexByWord`, `composeLines`/`composeDraftText` (only `composeShuffledTexts` is used), the exported `LINE_STEP`, the `_rtl`/`rtl` parameter threaded through `canvasLines → assembleDraftFromCanvas / canvasScrapTexts / cutUpText` (ignored since the 2026-10-20 reading-order fix). `shuffleBoard, reorderBoard, resetBoardOrder, assembleDraftText, dealCanvas` are test-only.
- `src/domain/wordLadder.ts:13-26` `COLUMN_A_LABEL, COLUMN_B_LABEL, ROLE_SEED_PLACEHOLDER, PLACE_SEED_PLACEHOLDER, getColumnAPlaceholder, getColumnBPlaceholder` — hardcoded English, never imported.
- `src/domain/wordTools.ts`: `WORD_LOOKUP_MODES[*].label/description` and `EXTENDED_WORD_MODE_GROUPS[*].title` English literals are never displayed (the sheet translates by key; `title` is only lower-cased into a key); `PART_OF_SPEECH_LABELS`/`partOfSpeechLabel` duplicate the sheet's own map (`WordFinderSheet.tsx:112-115`); `clearWordLookupCache` is test-only; `WORD_HE_SERVICE_BASE_URL` export has no external importer.
- `src/domain/magpie.ts` `cleanPassage`, `pickBook`, `MagpiePage` and `src/domain/magpieBooks.ts` `toMagpieBook`, `CURATED_BOOKS`, `CuratedBook` are exported but only used inside their modules; `src/domain/lyrics.ts` `getLyricsPreview` has no caller at all.
- `WordLadderScreenContent.styles.ts` `columnsRow`; `useSparkPrefsStore` `SPARK_ZOOM_MIN/MAX` exports; `CutUpBoard.tsx` `void h;` and an unused `e` in `onStart`.
- Console noise in scope: only `userFacingError.ts:19` `console.warn("[failure]")` (survives release by design — fine). No raw `Alert.alert`, no `__DEV__`-less dev surfaces.

---

## Feature inventory (what a user can do in this scope)

- Lyric Pad (drawer) → list grouped Pinned / Today / Yesterday / Earlier this week / Earlier, search (title+body with highlighted snippet), + new page.
- Lyric Pad → page editor → title + body (autosave on pause), undo/redo, Word Finder (book glyph), "…" → text direction (auto/ltr/rtl), pin, delete; Android hardware back.
- Lyric Pad → long-press → selection mode → Add to song (target picker → workspaces), pin/unpin, delete, "…" → duplicate, share (system sheet, pages joined with a rule).
- Lyric Spark (drawer) → saved sparks list (method glyph, meta, step/"In pad"/"Finished"), search, + → New spark sheet → Word Ladder / Cut-Up / Borrowed Words (free tier limited per tool → Pro upsell); long-press selection → send one spark to pad, delete.
- Word Finder sheet (from the pad, the lyric sheet, elsewhere) → Rhymes / Near / Similar / Related / More (Sound: homophones, consonance, sounds-like; Meaning: opposites, synonyms; Imagery: describing, kinds, parts) → theme words (≤5 pills) → tap word to insert (with flash), long-press → definition → Use / Explore (drill with back), syllable grouping, "+ n more", "Try near" on empty rhymes; Hebrew: readings picker (nikud), LLM "Find" trigger for meaning modes, Dicta credit line; cached offline forever on-device.
- Word Ladder → steps Verbs (job seed, Surprise me, add/edit/reorder/remove words, Suggest) → Nouns (place seed, slots to match verbs) → Pair (tap-to-pair, lock, shuffle, undo/redo) → Draft (spark palette with used ticks, free text) → Revise (draft reference, copy, revision text) → Finish; "…" → text size, how it works (help per step), send to pad (new page / update page), delete.
- Cut-Up → Source (paste or From pad → page picker → line/verse picker; locked after first cut with Edit source) → Cut (tap seams to cut/mend, Recut, undo/redo) → Arrange (ruled table: drag scraps with snap-to-rule, tap → edit text / cut strip / lock / duplicate / set aside; Shuffle, Source order, set all aside, bring all up, undo/redo) → Draft (Remix: board order / short / mixed / long lines; free edit) → Finish; frame menu as above.
- Borrowed Words (Magpie) → Page (random Gutenberg page from a curated shelf or the whole library; Hebrew via Ben-Yehuda with genre multi-select; tap words to mark, long-press a run to pull apart, Pocket; collected strip with remove+Undo; book line → source sheet: new page, language, scope, genres, new book, credit link) → Build (draft with caret-insert from the scrap palette, See all, Add all when blank, long-press scrap → edit / split / merge / mark used / remove; undo/redo) → Finish / send to pad.
- Reading sheet (Aa) → lyric size slider, capo stepper (per song, when chords), chords on/off; SongReading: lyrics with/without chords, chart sections, transpose bar, playback-pitch capo switch.
- Title input → sanitised 2-line/80-char title, random name, clear.
