# SongNook — feature inventory (as built, main @ b4a7268, 2026-10-22)

Derived from code (`src/navigation.ts`, `App.tsx`, `src/components/**`, `src/i18n/translations.ts`,
`src/domain/proGating.ts`, `src/domain/entitlements.ts`) and cross-checked against
`docs/product-plan/store-listing.md`, `phase-6-monetization.md` (founder block, 2026-10-19),
`competitive-samply-2026-10-12.md`, `docs/design-system.md` §3, `docs/qa/CHECKLIST.md`, `docs/qa/flows/*`.
Vocabulary is the app's own: idea · clip · take · sketch · song · collection · workspace · layer ·
mark (section/pin) · span · spark · parcel · Send.

Legend for the gate column: **FREE** = no gate in code · **PRO:key** = behind `hasProAccess(key)` /
`ensurePro(key)` today (`ALL_FEATURES_FREE = true` still short-circuits everything, so nothing is withheld in
the shipped build) · **PLANNED-PRO** = founder's 2026-10-19 split says Pro, but there is no gate in code yet.

---

## 1. Tree — place / tool → sub-view → sheet → actions

### 1.1 App shell (always present)
- **Root stack** (`App.tsx`): one `Home` drawer; pushed pages: IdeaDetail (sketch), CollectionVisit, Activity (scoped), Recording, BluetoothCalibration, ShareImport, Editor, LyricsVersion, ChordSheet, SongbookReader, SetlistSong, TransferReceive.
- **Side menu** (`SideNav.tsx`): search field → Search; workspace card (name, "Collections · n", Recent collections list, switch-workspace mark) → Workspace hub; Compilations; Received (with new-parcel count); Lyric Pad; Shelf; Revisit; Activity; tool tray: Lyric Spark · Tuner · Metronome; Settings. Pushed places open the same menu through the workspace mark (`SideMenuButton`).
- **Global media dock** (`GlobalMediaDock`): now-playing pill with play/pause, prev/next, queue count "n of m", swipe-up to full player, ✕ ends session; while recording: Recording badge, pause/resume, Save take, tap to reopen recorder; shows inline-preview state.
- **Queue panel** (`QueuePanel`): list, shuffle, edit/reorder/remove, "Playlist" (keep the queue as a playlist), per-row "go to its collection".
- **Full player sheet** (`PlayerSheet`, not a route) — see 1.6.
- **Banners/hosts**: import progress; persist-failure ("SongNook can't save / Saving in backup mode / Saving is paused"); duplicate-review sheet (import dedupe by file hash, "already in your library", import copy / skip); library-process host (backup/export/restore progress, minimize, cancel, ETA); Send-job host (seal pill: Sealing… / Link ready · tap to share / Couldn't send · tap to retry); toast host; Send sheet host; Received-parcel sheet host; Restore-restart gate; Welcome gate; clipboard banner (copy/move items between collections; "Open the parcel?" when a Send link is on the clipboard).
- **Error boundary**: "Something went wrong — your clips and library are safe" + Restart; crash log kept locally (`crashLog`), shareable from Settings → About.
- **Deep links** (`linking`, `app.json`): `songnook://` scheme (`songnook-dev` in dev); universal/app links `https://send.songnook.app/t/<id>` (iOS associatedDomains + Android intent filter) → TransferReceive.
- **Share-sheet import** (`expo-share-intent`, ShareImport screen): receive audio/video files or a SongNook archive from any app → choose destination (current collection / another / new collection / import as sketch with files as takes); unsupported items skipped with a note; cold-start share handled.
- **Store review prompt**: after a saved clip, once the install is mature (`reviewPrompt.ts`, `shouldRequestReview`).
- **Lock screen / media session**: title = take, artist = sketch, album = collection (`lockScreenMetadata.ts`); play/pause/next/prev from lock screen, notification and Bluetooth AVRCP (QA PLYR-56/57; `@siteed/audio-studio` `enableBackgroundAudio`, `iosBackgroundModes.useAudio`).
- **Background recording**: `expo-audio enableBackgroundRecording`; Android foreground-service notification with actions (REC-59/60); "Keeps going" help row.
- **Silent switch**: playback plays in silent mode (PLYR-58).

### 1.2 Welcome flow (`WelcomeFlow.tsx`, first run + Settings → Replay intro)
- Five panes, swipe or Next, Skip from any pane: Capture ("Catch the spark") · Organize (workspace → collections map) · Grow (clip → sketch with four tabs) · Write (lyric versions, Lyric Pad, Lyric Spark) · Bring it with you (import voice memos now; they land in an "Imported" collection; import continues after Start; duplicate/unreadable counts).
- Seeded starter library on fresh install ("My Songs" workspace, "Ideas" collection). Hebrew device → Hebrew UI from first launch.

### 1.3 Workspaces (`WorkspaceListScreen`) — "Your workspaces"
- List of workspace cards (name in Lora, avatar/colour, Collections · Ideas counts, "Last worked" relative date, PRIMARY / WORKING marks); sections: active · Archived · From others.
- Sort popover: Last worked · Least recent · Title A–Z · Z–A.
- `+` → New workspace sheet (`WorkspaceModal`): name, "Suggest a name" (name-language aware), colour hue slider, avatar.
- Card "…" (`SelectionActionSheet`): Edit workspace · Set as primary · Share → Export (SongNook Archive file) / SongNook Send · Archive · Unarchive · Move package to Files (offload) · Delete permanently.
- Archive = packs every clip into one package on-device, library gets lighter, nothing deleted; Unarchive restores exactly; offloaded package restore asks for the file. Must keep ≥1 active workspace. Bulk archive/unarchive/delete via multi-select.
- Startup preference (Settings → Open to: Primary workspace / Last used).

### 1.4 Workspace hub (`WorkspaceBrowseScreen`, drawer "Collections")
- Collection cards (title, idea count, sub-collection count, PRIMARY), nested collections one level deep (a sub-collection cannot hold another).
- Search field (collections and ideas, live), sort (Title A–Z/Z–A, Least recent, Last worked), collapsing header.
- `+` New collection (name sheet). Long-press → multi-select dock: Edit · Primary · Delete · More → Copy · Move (to another workspace / top level / into a collection, with the children-stay-top rule) · Share → Export / SongNook Send.
- Collection card "…" (`CollectionActionsModal`): Rename · Copy · Move · Delete (with item/sub-collection counts in the confirm).

### 1.5 Collection (`IdeaListScreen`; same component as a CollectionVisit)
- Place header (Lora title, origin chip when visited: "Back to Search/Activity/Shelf/Revisit/queue"), nested-collections strip, idea cards (`IdeaCard`: title/duration, waveform strip, meta: time, stage dot, ♪ takes, bookmark; sketches wear the two-paper-edge stack), day groups with collapse/hide, sticky day labels, fast-scroll scrubber, focus-jump highlight from "view in collection".
- Search field: titles, notes, lyrics, chords, clip notes ("Notes match"/"Lyrics match" hints).
- Filters popover: Type (All / Clips / Sketches) · Stage (Early / Rough / Close / Song) · Tags (Riff, Verse, Pre-chorus, Chorus, Intro, Outro, Interlude, custom, Untagged) · Bookmarked · Lyrics with/without · Hidden items. Sort: Created / Updated / Title / Length / Stage × asc/desc. Compact view toggle.
- Header "…" (`CollectionHeaderMenu`): Play all · New sketch · Import (Files: audio or video; Videos from photo library; AIFF converted on iOS, refused on Android; original-file-date vs import-date choice; import as individual clips or as one sketch) · Compact view · View activity (collection-scoped Activity) · Share → Export / SongNook Send · (received package: Keep / Delete package) · dev-only rows behind `__DEV__`.
- Record FAB → Recorder (quick record into this collection).
- Card tap → sketch page or clip player; card play glyph → inline preview (card waveform goes live, drag-to-scrub); long-press → selection.
- Selection dock (`IdeaSelectionBar`): Play (queue) · New sketch from clips · Edit (single) · Delete (undo toast) · More → Tags · Bookmark/Remove bookmark · Add to Shelf · Copy, move, playlist (Copy / Move via clipboard "Paste here" with duplicate guards; Playlist chooser) · Share → Export (whole sketch as SongNook file) / SongNook Send (choose: Whole sketch(es) vs Primary take(s) only) / share audio files via OS sheet · Hide/Unhide.
- Undo banner for bulk delete; "Made 'title'" undo for Make sketch.
- Empty state: "Nothing here yet — Recorded clips land here."

### 1.6 Sketch page (`IdeaDetailScreen`, eyebrow SKETCH; a clip opens the same page as CLIP)
- Header: title (editable), stage ink (Early/Rough/Close/Song set in the edit sheet), tags, bookmark, primary-take strip (play, PRIMARY TAKE label, locate in list), workspace mark opens side menu.
- Header "…" (`SongHeaderMenu`): Play all · Edit sketch / Edit clip (title, stage, tags, notes) · Import audio into sketch (lands as a new take) · Share → Export sketch (SongNook file) / SongNook Send · View in collection · Make sketch (for a clip) · Delete sketch (choice: Keep takes as clips / Delete all) / Delete clip.
- Tabs (`CollapsingTabStage`): **Takes · Lyrics · Chart · Notes**.
- **Takes**: Evolution view (stemmed thread: each take with its versions stacked v1, v2…, "N older ⌄" unfolds, `EvolutionGlyph`) ↔ Timeline (every take by date); sort newest/oldest; filter: tags, Groups, Bookmarked only, Show: Every version / Latest only; Collapse all. Take card: play, bookmark, version key ("Record a new version of…"), clip notes (tap opens, More/Less), tags, "Find in Evolution view". Take selection dock: Play · Edit · Delete · More → Versions (Version of another take → "Tap the take it grew from"; Join as versions; Stand alone → Copy out / Move out) · Make primary · Group (assign/new/rename/take out) · Tags · Playlist · Copy or move (sketch clipboard, paste into any sketch) · Share → audio / Export / SongNook Send. Renaming a take offers "Rename N takes to match". Takes help sheet (Versions · Primary take · Evolution & Timeline · Stand alone).
- **Lyrics**: version list (CURRENT badge, "Edited today", line count, chords indicator), expand/collapse, New version sheet (From current · Blank · From Lyric Pad page picker), "Write with the tape" (opens player with lyrics follow), delete versions (with "used by n takes / chart books / setlists" warning). → Lyrics editor (1.9).
- **Chart**: chord chart preview, "From lyrics" builder, pencil → Chord sheet editor (1.10), Export.
- **Notes**: sketch notes editor (autosave).
- Record FAB: new take / new version of a take / layer over the primary take.

### 1.7 Recorder (`RecordingScreen`, pushed, no side menu)
- Modes: New clip (quick record into a collection) · Recording into sketch (new take) · New version of a take · **Layer** over a take (guide plays in headphones; take is written in record-red into the guide reel's lower register — one reel, same scale/offset, as of b4a7268) · Punch-in ("Layer · from 0:42", guide starts earlier, "Drag the guide to choose the start", From top).
- Transport: Record / Pause / Resume / Redo / Save / Discard (confirm), minimize to dock (keeps recording), hardware-back guard, live waveform, elapsed + "time left" (disk), Ready/Paused/Count-in n/m status, "Guide in 3" countdown for layers, "End of the song" review (Redo layer / Keep layer).
- Count-in: Off / 1–4 bars (Settings default), head trimmed to the downbeat; pre-roll for layers.
- Metronome sheet (`RecordingMetronomeSheet`): on/off ("Clicks while recording", never recorded), tempo (BPM, tap, markings), meter (2/4 3/4 4/4 5/4 6/8 7/8 9/8 12/8), grouping, subdivision + click voice (Click/Wood) when the native engine supports it, tempo changes at bar N (add/remove), Listen preview, locked mid-take; the take remembers its **recording grid** (tempo map) for the player's bars/beats.
- Drop a pin while the tape rolls (live pins, kept as marks).
- Lyrics panel with autoscroll while recording (REC-53/54).
- Input/output modal: input picker (Built-in Mic, Bluetooth, Wired, USB), "Look for inputs", output (Auto / Phone speaker), Bluetooth-mic confirm ("call quality, delay can't be corrected"), locked mid-take.
- Timing warnings: uncalibrated/stale Bluetooth headphones → Calibrate; BT mic warning; mid-take route change.
- Name-each-clip prompt (Settings toggle) → Save-as sheet (title, suggested title, description, Save to collection/sketch, Make primary).
- Safety: crash recovery ("Clip recovered"), disk-full "Take kept for recovery", target deleted mid-session, phone-call interruption, restore-in-progress block.
- Help sheet: Count-in · Click · Keeps going (background/lock screen).

### 1.8 Full player (`PlayerScreen` in `PlayerSheet`)
- Header: clip/take title, sketch, "v2 of 3", collapse (drag-dismiss), "…" overflow (`usePlayerScreenLifecycle`): Combine as new clip / Combine and edit (layered takes) · Trim audio (→ Editor) · Make sketch (for a clip) · Add to Shelf (→ View shelf) · Share → Share audio / SongNook Send · Delete clip / Delete sketch (only take) — audio moves to Trash.
- **Reel** (`AudioReel`): Skia waveform, tap-seek, scrub (grab/tick/light haptics), pinch/step zoom + zoom-to-fit, expand reel + hide markers, minimap, bars/beats grid from the recording grid or detected tempo, sections as coloured spans, pins as badges (tap: play from / edit), loop span with move handle.
- Transport: play/pause, prev/next (queue), repeat, auto-advance, queue sheet, speed readout.
- **Marks** (InkKey "Marks", `MarksToggle`, `MarkInspector`/`SpanInspector`): **Sections** (Intro/Verse/Pre-chorus/Chorus/Bridge/Solo/Outro/custom name + colour "Section ink"; set start/end to playhead, nudge ±1 s, ‹ › ms steps, snap to Prev end / Next start, jump, Loop a section, delete) · **Pins** (add at playhead, name, note, nudge, reposition, delete, "Pin n").
- **Tools** (InkKey "Tools" → practice drawers: Marks · Loop · Sound; dot = has state; Reset all; "Keep settings" with this clip):
  - **Loop**: practice loop on/off, loop what (a section / whole take / custom span), reshape/move, jump to loop start, move loop to playhead; **Step up** (sequence of speeds × passes; presets Slow build / Steady climb / Final polish / Custom; save/remove sequences; restart; "Step up done"), help sheet.
  - **Sound**: **Speed** (slider, reset) · **Pitch** (± semitones, reset; native pitch-shift module, "Unavailable" fallback) · **Count-in** (seconds) · **Click** (on/off, volume, haptic; "Recorded without the metronome" when no grid) · **Detect tempo / Re-detect** (analysis: tempo + "loose" flag, inconclusive message) · take **Level** (dB knob) and **Tone** (Low cut / Low boost / Hi cut / Mid boost) via `LevelToneStrip`.
  - Play-along mode (click over playback, PLYR-40).
- **Layers** (InkKey "Layer" → record layer at playhead; `OverdubLayerLanes` under the reel ARE the layer list): per-lane name, span, **Solo** (switch, any number; main transport plays a rendered solo mix) and **Mute**; tap → layer sheet (`PlayerLayersBench`): Rename · Timing nudge (ms) / Restore original alignment / stem-alignment overlay · Level & tone · Remove; Merge layers (pick, name); Collapse/Expand all; zoom to layer / full clip; "Combine layers" → New clip (take keeps its layers) / Replace take; eight-layer limit ("Combine them to keep layering").
- **Doors** (`PlayerArtifactDoors`): Notes (clip/take notes sheet, write a note) · Lyrics (Write lyrics / Open lyrics; "Lyrics and charts live in a sketch — this clip becomes its first take" for clips) · Chart (Build chart / Open chart, "n bars"). **Reader** (`PlayerArtifactReader` / `PlayerLyricsPanel`): lyrics follow playback (Follow, autoscroll on/off + speed, resync, lyric size, Show chords, take's words v-stamp vs latest words, "Words edited since this take"), chart view, full view, edit lyrics / edit chart, New version (From current / Blank).
- Help sheets: Overdub (Layers ride the take · Level and tone · Timing · Editing a layered clip), Step up.
- Lifecycle: delete-elsewhere forced close; waveform hydration heals "0:00"; rendered-mix self-heal.

### 1.9 Editor ("Edit clip", `EditorScreen`, pushed)
- Tabs: **Keep · Remove · Speed & pitch**.
- Keep/Remove: reel with playhead, Add part / Split here, drag part edges or whole part, neighbour snap, "Keep to grid" (bar-aligned), part names, delete part, To start / To end; each kept part becomes its own clip, removed parts are cut out ("0:12 removed from title").
- Speed & pitch: steppers, audible preview, reset; bakes the change into a new clip.
- Save sheet: Save 1/N clips · Save a copy · "Also delete the original" → Replace (source take/clip goes); grid kept note.
- Layered takes: "Combine the layers first" (editing works on a combined copy).
- Help sheet: Keep or remove · Saving (always a new clip) · Speed & pitch.

### 1.10 Lyrics editor (`LyricsVersionScreen`, pushed) & chord-over-lyrics
- Editing a version: autosave draft, Undo/Redo, Save (overwrites latest) / Save as new (branch), editing an old version forces a new one, discard guard, text direction override (Auto / LTR / RTL), Word finder button, version eyebrow ("Version 3", "Unsaved draft", "Edited …").
- Chords mode (`ChordChartEditor`): tap a word to add a chord (Root · quality · bass note · custom suffix, flat/sharp, recent chords palette "Tap a chord, then a lyric"), drag chords along the line, tap to edit/remove, zoom/reset zoom, help sheet.
- Export sheet (`ChordExportSheet`): Add to chart book · PDF (print-ready chart, **PRO:pdf-export**) · Text (chords over lyrics, OS share) · Copy to clipboard.

### 1.11 Chord sheet editor ("Chord chart", `ChordSheetScreen`, pushed)
- Sections (presets Intro/Verse/Pre-Chorus/Chorus/Bridge/Interlude/Solo/Outro/custom; rename, move up/down, delete) and free-form Text blocks; bars with chords (add before/after, clear, split into separate bars, copy/cut/paste bars, multi-select dock); "From lyrics" builds the chart from chords in the current lyrics version (Replace chart?); Undo/Redo; text size; Full view; Export → PDF (**PRO:pdf-export**) / text share.

### 1.12 Lyric Pad (`NotepadScreen` route NotepadHome)
- Pages grouped Pinned · Today · Yesterday · Earlier this week · Earlier; search; `+` new page; editor with title/body autosave, text direction, delete.
- Page selection dock: Sketch (choose a sketch → page becomes a new lyrics version) · Pin/Unpin · More → Duplicate · Share (text) · Delete.
- Pages feed the lyrics editor ("From Lyric Pad" picker, Pinned/All pages) and Cut-Up ("Cut up a Lyric Pad page").

### 1.13 Lyric Spark (`NotepadScreen` route SparkHome + three tool screens)
- Saved sparks list (Word Ladder "n pairs", Cut-Up "n scraps", Borrowed Words "n words"; finished/unfinished), search, delete selection; New spark sheet: **Word Ladder** (Pair odd words into lines) · **Cut-Up** (Cut a lyric up and rebuild it) · **Borrowed Words** (Magpie — Collect words from a real book). Each is a stepped wizard with "How this works" help (after Jeff Tweedy's *How to Write One Song*), undo/redo, text size, Save as unfinished / Discard on exit, resume at step, Finish → spark kept; **Send to Lyric Pad** (new page / update page).
- **Word Ladder**: Job/role + Room/place (random pick, Suggest words), verbs list, nouns list, count matching, Pair step (tap verb then noun, Shuffle, Lock pair, remove), Draft, Revise.
- **Cut-Up**: Source (paste, or pull lines from a Lyric Pad page — copy, original untouched; tap a line / long-press a verse), Cut (arrives cut at phrases; tap between words to cut, tap gap to join, Recut), Arrange (table: drag scraps, lock, duplicate, set aside tray, shuffle, "scraps on one rule read as one line"), Draft (Compose: As arranged / Short / Mixed / Long; Remix draft; edit).
- **Borrowed Words (Magpie)**: a page from a public-domain book (English: Project Gutenberg via Gutendex; Hebrew: Project Ben-Yehuda via `server/magpie-benyehuda`), language toggle, scope Curated / Library, source genres (Prose, Memoir, Letters, Fables), tap words to Collect, hold to Pull apart/split, New page / New book, text size, Build (collected words one per line, tap to insert at cursor, edit/split/merge/remove/mark used, Rebuild from words). Needs a connection (offline/error states).
- **Word Finder** (`WordFinderSheet`, from the lyrics editor and sparks): word at cursor or typed; tools grouped Sound (Rhymes, Near, Homophones, Consonance, Sounds like) · Meaning (Similar, Synonyms, Opposites, Related) · Imagery (Describing words, Kinds of it, Parts of it); theme words to bias results; syllable groups; part-of-speech; hold for definition; Explore a word (back to previous); insert. English via Datamuse (keyless until 2027; `server/word-proxy` ready); Hebrew meaning tools via an LLM worker (`server/word-he`), Hebrew rhymes "Charuzit by Dicta" credit, "This sound tool isn't available in Hebrew yet". Offline/busy/no-match states. (PLANNED-PRO "full word finder"; no gate in code.)

### 1.14 Shelf (drawer)
- "Set aside" from anywhere (collection selection, Activity, Revisit, player overflow): a pointer, the idea never leaves its collection; stays 7 days; last 48 h = decision card ("Leaving shelf today/tomorrow/in n days") + nav dot; rows: Keep 7 more days · View in collection · Remove; "Recently left the shelf" buffer with Re-shelve ("Back for 7 days"). Empty: "Nothing set aside — Select ideas, then Add to Shelf."

### 1.15 Revisit (drawer)
- Four sources, each with a reason line: **Unfinished** (worked on, then left; "n sessions", "Lyrics started", "Has notes"), **Raw ideas** (recorded once, never developed; "One take", "Raw capture"), **Deep cuts** (older work, shuffled back; "Untouched for n months"), **Around this time** (this date in past years; seasonal snapshot "See snapshot", "A year ago this week"). Card actions: Add to Shelf · Hide from Revisit (restore from Customize). Customize sheet: What to surface (toggle sources), Sources (workspaces), New set each day on/off, Refresh, Restore hidden (n), Reset. Links to Activity. Empty: "Too soon to revisit".

### 1.16 Activity (drawer; also scoped per collection/workspace as a pushed page)
- Year heatmap grid (coloured days; Previous/Next year; Today), tap a day or month or choose a range → results list (Created/Updated/both), idea cards with play + "View in collection" + Add to Shelf; Customize sources (workspaces, "n of m workspaces"); "n more in this period" truncation; "Nothing this month/day".

### 1.17 Search (drawer, from the side-menu field)
- "Anything, by what's inside it": sketches, clips, Lyric Pad pages (pinned flagged), collections, workspaces; matches on title, description, notes, clip title, clip notes, lyrics, chords, body; match-source filters; snippets; "Open in <collection>" (visit); truncation "n more"; empty state hint.

### 1.18 Compilations (`LibraryScreen`, drawer) — Playlists · Charts (chart books) · Setlists
- Common: ink-tab switch, search, Show (All / Mine / Received), Sort (Updated / Name / Created), create FAB, help sheet (Playlists · Charts · Setlists · Received), received compilations appear here with provenance.
- **Playlists** (global, any workspace): detail with play/shuffle, item list (drag-reorder, −remove, unavailable rows skipped), Add items (library picker: browse collections, preview, Add n, pick from another workspace), "…" → Rename · Share → Export (playlist file) / SongNook Send · Delete. Queue → "Keep the queue as a playlist".
- **Chart books** ("Charts"): detail = songs with lyric/chord charts ("n charts", "n with a chart"), Open the book → **Stage reader** (`SongbookReaderScreen`): paged songs (`SongPagerStrip`, prev/next), Lyrics view / Chart view / Grid view, text size cycle (Aa), Key transpose ±semitones with reset, Capo (fret up/down, "Capo n", remove; "Keep the shapes with a capo" vs "Move the chords to the playback key"), reference audio play/pause with pitched playback, click at the song's BPM, close the book. Edit book (add songs, remove, reorder), "…" → Rename book · Share → Export / SongNook Send / Share as text · Delete book. PDF/text from `songbookShare`.
- **Setlists**: ordered songs each packed as a parcel (`SetlistEntryBuilderView`: Everything / Takes & parts (chosen take brings its reel: sections, pins, take notes) / Charts & notes (chord chart, song notes, lyrics version)); detail: Play the whole set, Edit set (drag-reorder, tap row to repack, − removes), Set details, Share set → Export (one ready-to-play SongNook file) / SongNook Send, Delete set. **Setlist song page** (`SetlistSongScreen`): parts list with sections/pins counts, Practice (opens player), Read the lyrics / Read the chart (stage reading with key/capo), Notes.

### 1.19 SongNook Send (sending) & Received
- **Send sheet** (`SendLinkSheet`, one host; rows labelled "SongNook Send" on workspace, collection, selection, sketch, take, player, playlist, chart book, setlist): title, From (name), A note, item order (move up/down, Sort A–Z), Get link → Packing n of m / Uploading (bytes, time left) / Sealing; runs in the background behind a pill; Link ready, copied → Share. Expiry 7 days; size caps (`SEND_MAX_ITEM_BYTES` / `SEND_MAX_TRANSFER_BYTES`, "Too large to link — share as a file instead"); one parcel at a time. Help sheet: The link is the key · Seven days · No taking back. Server: `server/songnook-send` worker + R2. (PLANNED-PRO "sending through Send"; no gate in code.)
- **Sent links** (Settings → Data & storage → Sent links; also "Links you sent" from Received): list with title, n items, "n days left"/Expired, copy link, Forget (list only; link keeps working).
- **Receiving** (`TransferReceiveScreen`, from a link or the clipboard prompt): "A parcel for you — From <name>", n files, n days left, Save / Save all (big parcel Wi-Fi warning, download progress, Stop), per-file play/pause preview, "Saves to Received › …" / Compilations › Playlists / Setlists / Chart books, expired / already saved / failed states, Open Received.
- **Received** (drawer): parcels (Received · kind: Setlist / Playlist / Chart book / Sketch / Collection / Workspace / Clips / Library; "From name", items, n takes, "Not opened yet", new count); parcel sheet (`ReceivedParcelSheet`): Look first (open as a collection; everything plays and practises as usual) · Keep (as its own workspace, or into a collection via `ReceivedPackageMoveModal`; "Keeping moves it into…") · Somewhere else · Delete (audio to Trash). Multi-select: Keep n parcels / Delete. Received never appears in the workspace picker or the recorder's targets; adoption copies it into "my workspaces".

### 1.20 Tuner (drawer tool)
- Chromatic, 27.5 Hz–2 kHz (5-string bass to violin harmonics), note + octave, cents dial, In tune / Tune up / Tune down, signal meter, Waiting/Listening, "Play one string at a time"; mic permission states; native detector (`tunerTracker`).

### 1.21 Metronome (drawer tool)
- BPM (±1, tap tempo, tempo markings Largo…Prestissimo), start/stop, meter (8 meters, two rows), grouping/accent pattern (tap a beat: accent / click / rest), subdivision "Click on" (Beats / Eighths / Triplets / Sixteenths / In two / three / four / custom), Sound: Beep volume, click voice (Click / Wood), Visual pulse, Haptic (Light / Medium / Strong); "Nothing sounds — turn a cue on" warning; settings persist; native engine; yields to playback.

### 1.22 Bluetooth calibration (Settings → Preferences, or from recorder warnings)
- Per-device latency calibration: Music pass (1 of 2, tap with beeps, some silent) and Click pass (2 of 2); result in ms, seeded from reported route latency, warnings (unusual gap / far from reported / near zero / uneven taps); Save, Fine-tune ±10 ms, Calibrate again, Remove; saved calibrations list; stale (>1 month) and uncalibrated warnings in the recorder; HFP (mic on) note.

### 1.23 Settings (`SettingsScreen`, views: overview · general · library · sharing · about · export · import · storage)
- **Overview**: plan line "SongNook Beta · Pro unlocked"; doors: Preferences · Data & storage (last backup meta) · Help & about.
- **Preferences** (general): App language (English / עברית, restart) · Name suggestions language (Auto/English/Hebrew) · Open to (Primary workspace / Last used) · Interface haptics · Recording: Name each clip · Bluetooth calibration (n saved) · (count-in default lives in the recorder's metronome sheet).
- **Data & storage** (library): Backup — Back up (whole library, verified, size/duration estimate, minimizable, "Saved it / Not saved" confirmation on iOS, incomplete-backup list, low-storage/4 GB guards) · Restore (Merge "keeps anything newer" / Replace everything "removed clips wait in trash 14 days"; corrupt/newer-app/integrity/missing-audio errors; blocked while recording; app restarts) · Reminder (Off / Weekly / Monthly / Every 3 months — **PRO:auto-backup** when not Off) · copy last backup file name. Share — Export an archive (wizard: Format SongNook Archive / Standard ZIP; Scope by workspace/collection with inherited/excluded states; Include: Everything or Notes / Lyrics / Song history / Full detail / Hidden items, or for ZIP Notes (.txt) / Lyrics (.txt); archived-workspace guard) · Import an archive (preview: exported date, workspaces, contents, warnings; "adds as new workspaces"; full-backup vs shareable-archive cross-detection) · Sent links. Storage — Storage & repair → **Storage details**: library storage breakdown (active workspaces, audio files, library data, archived workspaces, temp files, all managed storage, internal paths), Refresh, Check integrity ("Last check: no problems"), Recover audio files (orphan scan; manifest restore; workspaces restored from archives), **Erase everything** (two confirms + Face ID / device auth).
- **Help & about**: version + installed update, Send feedback (mailto bmostudio.dev), Share diagnostic log (Save file / Share), Replay intro, Privacy ("Your library stays on this phone."), Privacy policy, Terms of use.
- Pro sheet (`ProUpsellSheet`, opened by any gate or the dev row): "SongNook Pro — Finish more songs — Your clips stay on your phone. No ads, no AI training."; free-month countdown; six feature rows (Charts and setlists · Layers · Practice tools · The full editor · Lyric Spark · Send and more workspaces); plans Yearly $11.99 (Founding price) / Monthly $1.99 / Lifetime $29.99; Get Pro (stub: "Purchases aren't open yet"); Restore (stub); Terms; Privacy; Not now. Free-month notices (`FreeMonthNotices`: "n free days left", "Free month ends today", "ended — everything you made stays yours") only once `isPaywallLive()`.

### 1.24 Data safety (background, no UI except prompts)
- Local-first SQLite/sharded persistence with shadow manifest; hydration retry + "Couldn't open your library" retry screen (never an empty writable library over an unread disk); recovery-mode prompt "SongNook opened empty, but this phone holds a backup with n ideas — Restore?"; "Newer copy found"; degraded load ("n workspaces couldn't be read and were set aside"); persist-failure banner modes.
- Disaster-recovery backup = exact checksummed snapshot (SHA-256, CRC32 streaming), verified on restore ("Restored clips failed verification. Nothing was changed.").
- **Trash**: any clip/take/layer/mix dropped from the library goes to a 14-day trash (`TRASH_RETENTION_MS`), referenced files are pulled back from trash at launch before purge, never drops siblings a person didn't choose (CLAUDE.md data law 2026-10-19).
- Stranded draft sketches recovered; interrupted archive operations resumed; picker copies swept; clip-duration backfill paced behind foreground audio.
- Archive formats: `.songnook`-style SongNook Archive (UTType `com.bmostudio.songnook.archive`) and Standard ZIP; import dedupe by file hash.

### 1.25 Hebrew / RTL
- UI locales en / he (Hebrew device → Hebrew first run; persisted; Settings switch restarts); Hebrew faces Heebo + Frank Ruhl Libre auto-remapped; full `I18nManager.forceRTL` mirroring with time-axis surfaces (reels, scrub bars, chord staves) kept LTR; content direction per string (titles, notes, lyrics, chart lines), lyrics versions persist Auto/LTR/RTL; grapheme-safe chord anchors; directional glyphs flip; 3,377 Hebrew strings reviewed 2026-10-20 (289 fixed); Hebrew Magpie source (Ben-Yehuda), Hebrew meaning word tools (LLM worker), Hebrew rhymes credit Dicta.

---

## 2. Pro gates as built (grep `hasProAccess` / `useHasProAccess` / `ProGate` / `ensurePro` / `proGating.ts`)

`src/domain/entitlements.ts`: `ALL_FEATURES_FREE = true` — every check returns allowed today. Keys in the
`ProFeature` union: `cloud-backup` · `auto-backup` · `practice-suite` · `overdub-layers` ·
`word-sparks-unlimited` · `archive-offload` · `pdf-export`. Free month (30 days, `freeMonth.ts`) and founding
membership (`APP_STORE_RELEASE_AT`, still `null`) are wired; billing (`services/billing.ts`) is a stub
returning `unavailable`. `ProGate.tsx` exists but no call site uses it (all gates are imperative).

| Feature | Gate in code | Key | Where | Founder split 2026-10-19 |
|---|---|---|---|---|
| Recording (all modes), library, collections, player, marks, trim editor Keep/Remove, tuner, metronome, backup/export/restore, receiving via Send, Shelf/Revisit/Activity, Lyric Pad, lyrics versions, chord-over-lyrics editor | none | — | — | Free |
| Practice tools: loop, pins, speed, pitch, tempo analysis | `isPracticeToolPro(tool) && !ensurePro("practice-suite")` | `practice-suite` (per-tool map `PRACTICE_TOOL_IS_PRO`, all true) | `PlayerScreen/index.tsx:1263` | Pro |
| Second+ overdub layer per clip | `canAddOverdubLayer(count, hasProAccess(...))`, `FREE_OVERDUB_LAYERS = 1` | `overdub-layers` | `PlayerScreen/index.tsx:1237` | Pro ("layers beyond 1") |
| Saved sparks beyond 5 per tool | `canSaveWordSpark`, `FREE_SAVED_SPARKS_PER_TOOL = 5` | `word-sparks-unlimited` | `NotepadScreen/hooks/useNotepadScreenModel.ts:212-231` | Pro (founder says all of Lyric Spark is Pro — code only limits saves) |
| Chord PDF export (lyrics editor + chord sheet) | `ensurePro("pdf-export")` | `pdf-export` | `useChordExport.ts:30`, `useChordSheetModel.ts:405` | Pro |
| Backup reminder (any frequency but Off) | `ensurePro("auto-backup")` | `auto-backup` | `SettingsLibraryView.tsx:75` | Not in the founder's list (founder: backup never locked — the reminder gate contradicts "never lock backup/export/restore"; flag) |
| Move workspace package to Files (offload) | `ensurePro("archive-offload")` | `archive-offload` | `useWorkspaceArchiveActions.ts:175` | Not in the founder's list |
| Workspaces beyond 2 | **no gate** | — | — | Pro |
| Editor Speed & pitch tab, parts | **no gate** | — | — | Pro ("full editor") |
| Charts / transpose / capo / chart books / setlists / stage reader | **no gate** (only PDF) | — | — | Pro |
| Lyric Spark tools themselves, full Word Finder | **no gate** (only save count) | — | — | Pro |
| Sending through SongNook Send | **no gate** | — | — | Pro |
| Setlist / chart-book PDF (`setlistShare`, `songbookShare`) | **no gate** (only the chord-chart PDF call sites) | — | — | Pro |
| Cloud backup | key reserved, no feature | `cloud-backup` | — | out of scope |

Dev override: `setDevProOverride(true/false)` from the debugger (QA LYR-22, LYR-60, DS-12, PLYR-60/61, SHELL-27).

---

## 3. Differentiators (vs Voice Memos, GarageBand, BandLab, Samply, [untitled], Dubnote)

1. **Local-first, no account, nothing uploaded automatically** — no auth anywhere in the app; `store-listing.md` answers "Data Not Collected"; crash log is local-only (`crashLog`, shared only by the user); the only network calls are Word Finder, Magpie book pages and an explicit Send. Samply/[untitled]/BandLab need accounts; half of Samply's complaints are "server weather".
2. **Capture first** — one-tap record from any collection, count-in up to 4 bars, click never recorded, pins dropped while the tape rolls, lyrics autoscroll while recording, background/lock-screen recording with notification actions, Bluetooth-latency calibration per device (`BluetoothCalibrationScreen`, `latencyModel.ts`). Samply can't record; Voice Memos has no count-in, grid or pins.
3. **Takes have lineage** — versions stack under a take (v1, v2…), Evolution view (`EvolutionThread`, `EvolutionGlyph`), "Version of another take", Join as versions / Stand alone (Copy out / Move out), primary take, groups, "Rename n takes to match". Samply's praised "version stacking" exists here plus the branching tree it lacks.
4. **Words against the tape** — lyric versions with per-take word stamps ("Take's words · v2 of 3", "Words edited since this take"), chords over lyrics, chart sheet with bars, follow-playback reader with autoscroll; stage reader with key/capo and pitched reference audio. None of the rivals keep lyrics + chords + audio together (store-listing, competitive doc).
5. **Musical structure on the reel** — sections and pins, bars/beats from the take's own recording grid or detected tempo, practice loop, Step up (speed ladder with saved plans), speed/pitch without touching the recording, take level and tone. GarageBand is a DAW, not a sketchbook; Voice Memos has none.
6. **Layers that stay honest** — up to eight overdub layers riding an untouched take, one reel, one playhead (`soloMix.ts`), per-layer nudge/alignment/tone, merge or combine. BandLab does multitrack but cloud-bound; Voice Memos none.
7. **Nothing is lost** — 14-day trash for every dropped clip/take/layer (`mediaCleanup.ts`, `TRASH_RETENTION_MS`), launch-time trash pull-back of referenced files, checksummed disaster-recovery backups with verification-before-commit, recovery-mode restore prompt, merge or replace restore, integrity check and orphan recovery in Settings, crash-recovered takes, "Take kept for recovery" on disk-full. No rival advertises this class of safety.
8. **Coming back to old ideas** — Shelf (7-day set-aside with a decision window) and Revisit (Unfinished / Raw ideas / Deep cuts / Around this time with seasonal snapshots) and a yearly Activity heatmap; built for "hundreds of voice memos named New Recording 47".
9. **Sharing without accounts** — SongNook Send: 7-day expiring links anyone can open; parcels land in Received as reference material, never mixed with your own work ("zero-decision receipt"); setlists travel with takes, sections, pins, notes and charts in one file; playlists, chart books, workspaces and whole libraries export as archives (SongNook Archive or standard ZIP with .txt lyrics/notes).
10. **Lyric Spark** — Word Ladder, Cut-Up and Borrowed Words from real public-domain books (Gutenberg; Ben-Yehuda for Hebrew), plus a word finder with Sound/Meaning/Imagery tools, theme bias and definitions. No competitor has writing games.
11. **Hebrew and RTL** done properly (per-string content direction, grapheme-safe chord anchors, Hebrew word tools, Hebrew book source) — Samply and Dubnote are English-only, iOS-only.
12. **Android ships** (Samply and Dubnote have no Android), background foreground-service recording, AIFF handling, video-to-clip import (MP4/MOV/M4V/3GP sound only).
13. **Calm** — one primary action per screen, no ads, no AI training, no dark patterns on the paywall (Not now + Restore + Terms/Privacy always visible).

---

## 4. Rough edges a reviewer would notice

- **Beta/stub copy in Settings**: overview plan line reads "SongNook Beta · Pro unlocked" (`settingsAccount.betaPlan`, `settings.proUnlocked`); `settingsAccount.comingSoon` ("account services are coming later") still in the catalog. Pro sheet CTA shows "Purchases aren't open yet." / Restore shows "Nothing to restore yet." — fine for TestFlight, not for the store build unless RevenueCat lands first.
- **Gate drift vs. founder split**: the backup *reminder* and *archive offload* are Pro-gated in code although the founder said backup is never locked; workspaces >2, full editor, charts/setlists/stage reader, Lyric Spark tools, Send, setlist/chart-book PDFs have no gate. Flipping `ALL_FEATURES_FREE` today would gate the wrong things.
- `APP_STORE_RELEASE_AT` is `null` (founding-member cut-off not set) — must be set in the release commit.
- Dev rows in the collection "…" menu (Import samples, Import as sketch, Receive samples, Pro sheet) are behind `__DEV__` — correct, but the strings ship in the catalog.
- Deep-link comment in `App.tsx` says the https Send link lands "once entitlements are live" — verify universal links work in the production build (SHELL-46/47).
- Word Finder depends on Datamuse keyless access that ends 2027-01-01; `server/word-proxy` exists but `WORD_SERVICE_BASE_URL` still points at Datamuse directly.
- Hebrew sound-based Word Finder tools show "not available in Hebrew yet"; Magpie/Cut-Up/Word Ladder show an English-content notice per `localization-rtl.md`.
- Privacy policy / terms URLs: store-listing still says "<GitHub Pages URL — see OWNER-TODO>"; confirm the constants used by `SettingsAboutView` and `ProUpsellSheet` are live.
- Store description promises "Loop the hard part, slow it down, or shift the pitch" and "Layer overdubs" with no mention of Pro/IAP — update once gates flip (phase-6 §6.7).
- The layer recorder was reworked in the last five commits (one reel, take written under the song, Solo as a switch); screenshots/QA rows REC-43…49 and PLYR-41…47 describe the older layout and need a device pass.
- "Compilations" tab is labelled "Charts" for chart books in the ink tabs but "Chart book" in rows and "songbook" in code/routes — three names for one thing (user-facing: Charts / Chart book).
