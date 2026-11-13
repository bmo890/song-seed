# 04 · Words, chords, charts and the stage

Feature inventory, read from the code on `main` at `2442cd38` (2026-11-13). Paths are relative to `src/`.

How to read the Status column:

- **Free**: no gate in code. Works for everyone, always.
- **Pro**: stops a free user and opens the Pro page. A person has Pro by purchase, in the 30-day free month, or as a founding member.
- **Free up to N, then Pro**: a counted allowance.
- "Free on a received parcel" means the gate lets everyone through when the song arrived through SongNook Send.
- Gates only stop the action named. Anything already made stays open, readable and editable.

The short answers to the questions asked:

- **Word Finder**: there are exactly two doors (the lyric version editor and the Lyric Pad page editor). Both are gated. No spark, chart or selection menu opens it.
- **Transpose**: one shared control (`TransposeChip`) draws every transpose stepper in the app, and the gate lives inside it, so every place is gated the same way. The chart EDITOR has no transpose at all: editing always shows the written key.
- **Capo**: appears in one place only, the Aa reading sheet (player, stage reader, recorder lyrics). Gated there.
- **Adding to an existing chart book or setlist is free.** Creating one is Pro (three doors for a book, one for a setlist, all gated).
- **Importing or receiving a shared setlist or chart book is free.**
- **Text export of a chart is free, PDF is Pro.** Formats that exist: PDF, plain text, ChordPro (rides along in the text share), copy to clipboard, and a SongNook file for whole books and sets. There is no PDF of a whole book or setlist.
- **No gate, limit or lock badge was found in this area that is missing from the list given.** No lock badge is drawn anywhere here; a gated control looks normal until tapped.

---

## Lyrics on a sketch

The Lyrics tab of a sketch page.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Lyrics tab | Every sketch keeps its words on a Lyrics tab, as numbered versions. | Free | components/IdeaDetailScreen/sections/SongLyricsSection.tsx |
| Start writing | On an empty tab, opens a blank first version straight in the editor. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| From Lyric Pad | Picks a Lyric Pad page and copies it in as a new version; its title becomes the first line. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| Lyric Pad page picker | The picker lists pages as Pinned, then All pages. | Free | components/modals/NotePickerSheet.tsx |
| Empty-page notice | Choosing a page with no text says so and adds nothing. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| Current version card | Shows the latest version's first four lines, its number, date, line count and "chords" when it has them. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| Older versions ("N older") | Older versions fold under the current card as a paper stack; a tap unfolds the list. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| Open a version | Tapping any version opens its full page. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| + Version: New version from current | Opens the editor on a copy of the current words, saved as the next version. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| + Version: Blank version | Starts an empty new version. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| Hold to select versions | Long-press selects a version; more taps add to the selection; Done leaves it. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| Edit (one selected) | Opens the selected version in the editor. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| New draft from this | Starts a new version from an older one. This is how an old version is brought back. | Free | components/LyricsScreen/LyricsVersionsPanel.tsx |
| Delete version(s) | Deletes the selected versions after a confirm. Permanent: no Recently deleted, no Undo. | Free | state/actions.ts (deleteProjectLyricsVersions) |
| "Used by" warning on delete | The confirm says how many takes, chart book entries and setlists use those words. | Free | domain/lyrics.ts (countLyricsVersionReferences) |
| Write with the tape | Opens the full player in writing mode on the sketch's takes. Shown only when a take exists. | Free | components/IdeaDetailScreen/sections/SongLyricsSection.tsx |
| Read-only lyrics | Lyrics in a parcel not yet kept, or in an archived workspace, can be read but not changed. | Free | hooks/useReadOnly.ts |
| Lyrics in app search | The side-menu search finds words inside any sketch's lyric versions. | Free | domain/search.ts:192 |
| Chords in app search | The same search finds a chord name used over a lyric. | Free | domain/search.ts:202 |

## Lyric versions

The page that opens for one version: reader, editor, and the way out.

### Reading a version

| Feature | What it does | Status | Where |
|---|---|---|---|
| Version page | Shows "Version N", when it was edited, and the sketch's name. | Free | components/LyricsVersionScreen/components/LyricsVersionScreenContent.tsx |
| Lyrics / Chords switch | Flips the page between plain words and chords over the words. Opens on Chords when the version has them. | Free | components/common/LyricsChordsToggle.tsx |
| Pencil | Opens the word editor from Lyrics view, or the chord editor from Chords view. | Free | components/LyricsVersionScreen/components/LyricsVersionPreview.tsx |
| Scroll marker | A thin marker at the edge shows how far down a long lyric you are. | Free | components/LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx |
| Deleted-version fallback | Opening a version that was deleted shows the latest instead, with a short notice. | Free | components/LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx |
| Read-only line | In a read-only sketch the pencil gives way to a quiet "read only" line. | Free | components/LyricsVersionScreen/components/LyricsVersionPreview.tsx |

### Editing words

| Feature | What it does | Status | Where |
|---|---|---|---|
| Lyric editor | A full-page writing field for one version. | Free | components/LyricsVersionScreen/components/LyricsVersionEditor.tsx |
| Save | Saves over the latest version. | Free | state/lyricsEditorSave.ts |
| Save as new | Saves the edit as the next version, leaving the old one as it was. | Free | components/LyricsVersionScreen/components/LyricsVersionEditor.tsx |
| Old versions save as new | Editing any version but the latest always creates a new version. Automatic. | Free | components/LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx |
| Safe save | If the words changed elsewhere meanwhile, the save becomes a new version ("Saved as a new version"). | Free | state/lyricsEditorSave.ts |
| Undo / Redo | Steps back and forward through this editing session. | Free | hooks/useEditHistory.ts |
| Text direction | Sets the version to Automatic, Left to right or Right to left; saved with the version. | Free | components/LyricsVersionScreen/components/LyricsVersionEditor.tsx |
| Word finder button | Opens the Word Finder on the word at the cursor. | Pro | components/LyricsVersionScreen/components/LyricsVersionEditor.tsx:73 |
| Discard guard | Leaving with unsaved edits asks Discard or Keep editing. | Free | components/LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx |
| Unsaved words survive a crash | Unsaved typing is kept on the phone and put back when the page reopens. | Free | hooks/useEditorDraft.ts |
| Chords follow their words | Editing, adding or cutting lines keeps each chord on its own words. Automatic. | Free | domain/lyricsAlign.ts |
| Chords carry to a new version | A new version made from an old one starts with that version's chords. | Free | state/lyricsEditorSave.ts |

### Chords over lyrics

| Feature | What it does | Status | Where |
|---|---|---|---|
| Chord editor | Chords view with the pencil: place chords above the words of a version. | Free | components/LyricsVersionScreen/components/chords/ChordChartEditor.tsx |
| Tap a word to add a chord | Opens the chord picker at that spot in the line. | Free | components/LyricsVersionScreen/components/chords/ChordLine.tsx |
| Chord picker: root | Pick A to G, with flat or sharp. | Free | components/LyricsVersionScreen/components/chords/ChordPickerSheet.tsx |
| Chord picker: chord type | Seventeen types, from major and minor to 13, dim7, aug and m7b5, each named on your root. | Free | domain/chords.ts (QUALITY_OPTIONS) |
| Chord picker: bass note | Adds a slash bass note (C/G), with its own flat or sharp. | Free | components/LyricsVersionScreen/components/chords/ChordPickerSheet.tsx |
| Chord picker: Other | A free-typed ending for anything not listed (#9, no3). | Free | components/LyricsVersionScreen/components/chords/ChordPickerSheet.tsx |
| Live chord preview | The chord being built shows large at the top of the picker. | Free | components/LyricsVersionScreen/components/chords/ChordPickerSheet.tsx |
| Recent in this song | The picker lists chords already used in this sketch; one tap places one. | Free | components/LyricsVersionScreen/components/chords/ChordPickerSheet.tsx |
| Quick chord row | Tap a recent chord to arm it, then tap lyrics to drop it again and again. | Free | components/LyricsVersionScreen/components/chords/ChordPaletteBar.tsx |
| Drag a chord | Slide a chord left or right along its line. | Free | components/LyricsVersionScreen/components/chords/ChordToken.tsx |
| Tap a chord to edit or remove | Reopens the picker on that chord, with a remove key. | Free | components/LyricsVersionScreen/components/chords/useChordEditing.ts |
| Chord text size | A slider shrinks or enlarges the chord page (50% to 160%), with a reset key. | Free | components/LyricsVersionScreen/components/chords/ChordZoomBar.tsx |
| Chord editor help | A "?" sheet explains the three gestures: add, move, edit. | Free | components/LyricsVersionScreen/components/chords/ChordChartEditor.tsx |
| Transpose (chord view) | Shifts the shown chords up or down by half steps; display only, remembered per song. | Pro (free on a received parcel) | components/common/TransposeChip.tsx:34 |
| Back to written key | A reset glyph returns a shifted chart to the key it was written in. | Free | components/common/TransposeChip.tsx |

### Exporting a lyric version

| Feature | What it does | Status | Where |
|---|---|---|---|
| Export sheet | The share glyph on a version opens its ways out. | Free | components/LyricsVersionScreen/components/chords/ChordExportSheet.tsx |
| Add to chart book | Files this version in an existing chart book, with an "Open book" shortcut after. | Free | components/common/SongbookChooserSheet.tsx |
| New chart book (from the chooser) | Makes a new book and files the version in it. | Pro | components/common/SongbookChooserSheet.tsx:78 |
| PDF | Builds a print-ready page of the lyrics with chords and opens the share or print sheet. | Pro | components/LyricsVersionScreen/components/chords/useChordExport.ts:30 |
| Text | Shares plain chords-over-lyrics through the phone's share sheet. | Free | components/LyricsVersionScreen/components/chords/useChordExport.ts |
| ChordPro | The same Text share also carries a ChordPro copy for other chart apps. | Free | domain/chords.ts (serializeChordPro) |
| Copy to clipboard | Copies the chord chart as text, or the plain lyrics when there are no chords. | Free | components/LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx |
| Exports follow the key | A transposed chart exports transposed, in PDF and in text. | Free | components/LyricsVersionScreen/components/chords/useChordExport.ts |

## Words with the tape (player and recorder)

These live on screens another section covers. Listed here because they are lyric features.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Take remembers its words | Each take recorded in a sketch is stamped with the lyric version in front of the singer. | Free | components/RecordingScreen/hooks/useRecordingScreenModel.ts:529 |
| Take's words in the player | The player shows the version a take was sung from ("Take's words · v2 of 4"). | Free | components/PlayerScreen/index.tsx:296 |
| Show latest / Show take's | One tap flips between the take's version and the newest. | Free | components/PlayerScreen/index.tsx |
| "Words edited since this take" | A small pencil marks a version that was edited after the take was recorded. | Free | domain/lyrics.ts (wasLyricsEditedSinceTake) |
| "Take's words were deleted" | When a take's version is gone, the player shows the latest and says so. | Free | domain/lyrics.ts (resolveClipLyricsVersion) |
| Write with the tape | A writing field under a slim reel; words save into the latest version as you pause. | Free | components/PlayerScreen/components/PlayerLyricsWriter.tsx |
| New version while writing | A key in the writer starts a fresh version, from the current words or blank. | Free | components/PlayerScreen/index.tsx:1353 |
| Writer never overwrites newer words | If the lyric changed elsewhere, the writer's words become a new version. Automatic. | Free | components/PlayerScreen/writerLyricsSave.ts |
| Lyrics and Chart pages in the player | A sketch's lyric and bar chart open as reading pages inside the player. | Free | components/PlayerScreen/components/PlayerArtifactReader.tsx |
| Follow | The page scrolls with the playhead; dragging takes over, Resync hands back. | Free | components/PlayerScreen/components/PlayerArtifactReader.tsx |
| Edit from the player | A pencil on the reading page opens the writer, or the chart editor. | Free | components/PlayerScreen/index.tsx |
| Chords follow playback pitch | With the player's pitch raised, read the shapes with a capo, or the chords moved. | Free (needs the Pro pitch tool) | components/common/SongReading.tsx (PlaybackKeyRow) |
| Lyrics while recording | The recorder can show the sketch's latest words, folded or open. | Free | components/RecordingScreen/components/RecordingLyricsSection.tsx |
| Auto-scroll while recording | The words scroll on their own during a take, with a Test run before recording. | Free | components/PlayerScreen/PlayerLyricsPanel.tsx |
| Auto-scroll speed | Seven speeds from .25 to 2. | Free | components/PlayerScreen/PlayerLyricsPanel.tsx |
| Hide or show chords while recording | A key switches the chords over the words off and on. | Free | components/PlayerScreen/PlayerLyricsPanel.tsx |

## Lyric Pad

Loose pages that belong to no song yet. Reached from the side menu.

### The list

| Feature | What it does | Status | Where |
|---|---|---|---|
| Lyric Pad | A place for verses, hooks and lines without a song. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| New page (+) | Adds a blank page and opens it with the keyboard up. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Page count | A quiet line says how many pages there are. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| Search pages | Filters by title and body, and highlights the match on each card. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Time groups | Pages sort into Pinned, Today, Yesterday, Earlier this week, Earlier, each with a count. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Page card | Shows the title (or first line), an opening line, and a date on older pages. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| Pin from the list | The bookmark on a card pins or unpins the page; pinned pages lead the list. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| Hold to select | Long-press starts a selection; Select all and Cancel sit at the top. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| Sketch (add to a sketch) | Sends you to pick a sketch; each chosen page becomes a new lyric version there. | Free | state/actions.ts (completeSongTargetPicking) |
| Pin / Unpin (selection) | Pins or unpins every selected page. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Delete (selection) | Moves the pages to Recently deleted for 30 days, with Undo. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| More: Duplicate | Adds a copy of each selected page, titled "… (Copy)". | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| More: Share | Shares the selected pages as plain text through the phone's share sheet. | Free | domain/notepad.ts (buildShareTextFromNotes) |
| Empty and no-match states | An empty pad offers "Write something"; a search with no hits says so. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| Pages in app search | The side-menu search finds Lyric Pad pages and opens the one tapped. | Free | components/SearchScreen/hooks/useSearchScreenModel.ts:151 |

### A page

| Feature | What it does | Status | Where |
|---|---|---|---|
| Page editor | A title and a body. No save button: it saves as you pause. | Free | components/NotepadScreen/components/NoteEditor.tsx |
| Undo / Redo | Steps back and forward through this sitting's edits. | Free | components/NotepadScreen/components/NoteEditor.tsx |
| Word finder button | Opens the Word Finder on the word at the cursor. | Pro | components/NotepadScreen/components/NoteEditor.tsx:221 |
| Inserted-word flash | A word placed by the Word Finder glows briefly so you see where it landed. | Pro (part of Word Finder) | components/NotepadScreen/components/NoteEditor.tsx |
| "…": Text direction | Sets the page to Automatic, Left to right or Right to left. | Free | components/NotepadScreen/components/NoteEditor.tsx |
| "…": Pin / Unpin | Pins the open page. | Free | components/NotepadScreen/components/NoteEditor.tsx |
| "…": Delete | Deletes the page after a confirm; it waits in Recently deleted for 30 days. | Free | components/NotepadScreen/components/NoteEditor.tsx |
| Date line | The page shows the day it was last changed. | Free | components/NotepadScreen/components/NoteEditor.tsx |
| Blank page clean-up | A page left with no title and no words is removed on the way out. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |

## Word Finder

A rhyming dictionary and thesaurus in a sheet. Two doors, both gated: the lyric version editor and the Lyric Pad page editor. Every row here is behind that one gate (`word-finder-full`).

| Feature | What it does | Status | Where |
|---|---|---|---|
| Word Finder sheet | Opens over the editor with the word at the cursor already looked up. | Pro | components/common/WordFinderSheet.tsx |
| Look up any word | Type a different word in the sheet's field; a clear key empties it. | Pro | components/common/WordFinderSheet.tsx |
| Rhymes | Perfect rhymes. The sheet always opens here. | Pro | domain/wordTools.ts |
| Near | Near rhymes: close but not exact. | Pro | domain/wordTools.ts |
| Similar | Words with a similar meaning. | Pro | domain/wordTools.ts |
| Related | Words the word brings to mind. | Pro | domain/wordTools.ts |
| More | A fifth tab opens a described list of extra tools, grouped Sound, Meaning, Imagery. | Pro | components/common/WordFinderSheet.tsx |
| Homophones | Same sound, different word (course, coarse). | Pro | domain/wordTools.ts |
| Consonance | Same consonants (sample, simple). | Pro | domain/wordTools.ts |
| Sounds like | Close in sound, loose on spelling. | Pro | domain/wordTools.ts |
| Opposites | Antonyms. | Pro | domain/wordTools.ts |
| Synonyms | Strict synonyms only. | Pro | domain/wordTools.ts |
| Describing words | Adjectives for the word (ocean: deep, vast). | Pro | domain/wordTools.ts |
| Kinds of it | More specific words (bird: sparrow, heron). | Pro | domain/wordTools.ts |
| Parts of it | What it contains (car: dashboard). | Pro | domain/wordTools.ts |
| Grouped by syllables | Sound results are sorted under "1 syllable", "2 syllables", to match a meter. | Pro | domain/wordTools.ts (groupBySyllableCount) |
| "+ n more" | Long result groups show the first words and open the rest on a tap. | Pro | components/common/WordFinderSheet.tsx |
| Tap to insert | Tapping a result replaces the word at the cursor (or drops in at it) and closes the sheet. | Pro | domain/wordTools.ts (applyPickedWord) |
| Hold for a definition | Holding a result shows its meaning and part of speech. | Pro | domain/wordTools.ts (fetchWordDefinitions) |
| Explore | From a definition, looks that word up in turn; a back key returns to the previous word. | Pro | components/common/WordFinderSheet.tsx |
| Use word | From a definition, inserts the word. | Pro | components/common/WordFinderSheet.tsx |
| Theme words | Up to five theme words bias results toward the song's subject; they stay for the sitting. | Pro (English and Hebrew meaning tools only) | components/common/WordFinderSheet.tsx |
| "Try near rhymes" | When a word has no perfect rhyme, a link jumps to Near. | Pro | components/common/WordFinderSheet.tsx |
| Remembered lookups | Every lookup is stored on the phone, so repeats are instant and work offline. | Pro | services/wordLookupCache.ts |
| Honest states | Clear lines for offline, busy, error, nothing found, and a script it cannot read. | Pro | components/common/WordFinderSheet.tsx |
| Source credit | A line under results names the source where its licence asks for it. | Pro | components/common/WordFinderSheet.tsx |

## Word Finder by language

The language for Latin-letter words follows Settings → Preferences → Word tools. Hebrew letters are always looked up as Hebrew.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Word tools language setting | Choose Auto (follows the app language), English, Hebrew, Spanish, German or Portuguese. Also steers Word Ladder and Borrowed Words. | Free (the setting itself) | components/SettingsScreen/views/SettingsGeneralView.tsx |
| English: all twelve tools | Every tool works. Calls Datamuse, an outside server that is free and needs no key until 2027. | Pro · English · needs internet | domain/wordTools.ts |
| English: definitions and themes | Definitions and theme words both work, from the same outside server. | Pro · English · needs internet | domain/wordTools.ts |
| Spanish: Rhymes and Near | Worked out on the phone from spelling and stress, over a word list fetched from Datamuse. | Pro · Spanish · needs internet | domain/spanishRhyme.ts |
| Spanish: Similar, Sounds like, Consonance | From Datamuse's Spanish vocabulary. | Pro · Spanish · needs internet | domain/wordTools.ts (SPANISH_MODES) |
| Spanish: definitions | Hold for a definition works in Spanish. | Pro · Spanish · needs internet | domain/wordTools.ts |
| German: Rhymes and Near | From a rhyme list built into the app. Works offline, costs nothing. | Pro · German · on the phone | domain/germanRhyme.ts |
| German: Similar, Related, Kinds of it | From OpenThesaurus.de, a free outside server (60 lookups a minute per phone). | Pro · German · needs internet | domain/wordTools.ts (fetchOpenThesaurus) |
| Portuguese: Rhymes and Near | Worked out on the phone from spelling, over a built-in Brazilian word list. | Pro · Portuguese · on the phone | domain/portugueseRhyme.ts |
| Portuguese: Similar, Related, Kinds, Parts, Opposites | From a thesaurus built into the app. Works offline, costs nothing. | Pro · Portuguese · on the phone | domain/portugueseThesaurus.ts |
| Hebrew: Rhymes and Near | From Dicta's free Charuzit service, passed through SongNook's own server. | Pro · Hebrew · needs internet | domain/wordTools.ts (fetchHebrewRhymes) |
| Hebrew: "Which reading?" | An unpointed Hebrew word offers up to five vowel readings; rhymes follow the one chosen. | Pro · Hebrew · needs internet | domain/wordTools.ts (fetchHebrewVocalizations) |
| Hebrew: meaning tools | Similar, Related, Synonyms, Opposites, Describing, Kinds, Parts and Homophones, written by an AI model on SongNook's server. | Pro · Hebrew · needs internet · costs us per new lookup | domain/wordTools.ts (fetchHebrewWordSuggestions) |
| Hebrew: "Find words" tap | A Hebrew meaning lookup runs only when "Find words" is tapped, never while typing. | Pro · Hebrew | components/common/WordFinderSheet.tsx (runHebrewLookup) |
| Hebrew: definitions | Hold shows a short gloss and the root. Runs on the same AI server, without the extra tap. | Pro · Hebrew · costs us per new lookup | domain/wordTools.ts (fetchHebrewDefinition) |
| Tools a language lacks are hidden | The tabs and the More list show only the tools the word's language can serve. | Pro (part of Word Finder) | components/common/WordFinderSheet.tsx (renderToolList) |
| Open data credits | Settings → About lists the open projects behind the word tools and books. | Free | components/SettingsScreen/views/SettingsAboutView.tsx |

Which of the twelve tools each language has (everything here is Pro):

| Tool | English | Spanish | German | Portuguese | Hebrew |
|---|---|---|---|---|---|
| Rhymes | yes | yes | yes, on phone | yes, on phone | yes |
| Near | yes | yes | yes, on phone | yes, on phone | yes |
| Similar | yes | yes | yes | yes, on phone | yes, AI |
| Related | yes | no | yes | yes, on phone | yes, AI |
| Homophones | yes | no | no | no | yes, AI |
| Consonance | yes | yes | no | no | no |
| Sounds like | yes | yes | no | no | no |
| Opposites | yes | no | no | yes, on phone | yes, AI |
| Synonyms | yes | no | no | no | yes, AI |
| Describing words | yes | no | no | no | yes, AI |
| Kinds of it | yes | no | yes | yes, on phone | yes, AI |
| Parts of it | yes | no | no | yes, on phone | yes, AI |
| Definitions (hold) | yes | yes | no | no | yes, AI |
| Theme words | yes | no | no | no | meaning tools only |

Any other alphabet gets the line "Word lookup isn't available for this script yet."

## Lyric Spark: the page and the shared frame

Three short writing games. Reached from the tool tray in the side menu.

### Starting and keeping sparks

| Feature | What it does | Status | Where |
|---|---|---|---|
| Lyric Spark page | Lists every spark you have started, newest first. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| New spark chooser | The + opens a menu of the three games with a one-line pitch each. Opening it is never gated. | Free | components/NotepadScreen/components/LyricsSparkSheet.tsx |
| Start a Word Ladder | Begins a new Word Ladder. | Free up to 3 sparks of this game, then Pro | components/NotepadScreen/hooks/useNotepadScreenModel.ts:234 |
| Start a Cut-Up | Begins a new Cut-Up. | Free up to 3 sparks of this game, then Pro | components/NotepadScreen/hooks/useNotepadScreenModel.ts:234 |
| Start a Borrowed Words | Begins a new Borrowed Words. | Free up to 3 sparks of this game, then Pro | components/NotepadScreen/hooks/useNotepadScreenModel.ts:234 |
| Tries are counted for good | Deleting a spark gives no try back. A restored backup or "Erase everything" does not refill them. | Free up to 3 sparks per game, then Pro (the rule itself) | services/sparkTries.ts |
| Pro sparks don't count | Sparks started with Pro or in the free month use no tries. | Free up to 3 sparks per game, then Pro (the rule itself) | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Reopen a spark | Any saved spark opens at the step it was left on, and stays fully editable. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Spark card | Shows the name, the game, what it holds (words, pairs, scraps) and its step, "Finished" or "In Lyric Pad". | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| Search sparks | Filters by title, source words, draft text, and a borrowed book's title or author. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Show filter | Show only Word Ladder, Cut-Up or Borrowed Words sparks; Clear all resets. Remembered. | Free | state/useSparkPrefsStore.ts |
| Order | Newest first or oldest first. Remembered. | Free | state/useSparkPrefsStore.ts |
| Time groups | Sparks sort into Today, Yesterday, Earlier this week, Earlier. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Hold to select | Long-press selects sparks; Select all and Cancel at the top. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |
| Delete sparks | Moves the selected sparks to Recently deleted for 30 days, with Undo. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Lyric Pad (one spark selected) | Copies the selected spark's lyric into the Lyric Pad without opening it. | Free | components/NotepadScreen/components/NotepadScreenContent.tsx |

### What every game shares

| Feature | What it does | Status | Where |
|---|---|---|---|
| Step path | A numbered row shows the game's steps and where you are. | Free | components/common/SparkFrame.tsx (SparkSteps) |
| Back and next keys | A footer steps back, or on to the next step once the current one has enough. | Free | components/common/SparkFrame.tsx (SparkFooter) |
| Text size (Aa) | One slider sets the size of the words in every spark and every step. Remembered. | Free | components/common/sparkTextScale.tsx |
| How this works | The "…" opens help for the current step, with a worked example. | Free | components/WordLadderScreen/components/WordLadderHelpSheet.tsx |
| "See an example" | An empty step shows one plain hint and a link to its example; it leaves once you start. | Free | components/common/SparkFrame.tsx (SparkHint) |
| Autosave | Everything in a spark saves as you go. | Free | hooks/useDraftText.ts |
| Finish | Marks the spark finished and returns to the list. The spark stays. | Free | components/common/sparkSend.ts |
| Send to Lyric Pad | Copies the spark's lyric into a new Lyric Pad page; a toast offers Open. | Free | components/common/sparkSend.ts |
| Send again | A spark already sent asks: Update page, or New page. | Free | components/common/sparkSend.ts |
| Replace keeps the old words | If you wrote on that page since, replacing it keeps the old words in Recently deleted, with Undo. | Free | components/common/sparkSend.ts (replacePadPageKeepingOld) |
| "In Lyric Pad" link | Once sent, the last step links straight to the page. | Free | components/common/sparkSend.ts |
| Sent-page naming | A sent page whose title clashes with an existing page gets the game's name added. | Free | domain/notepad.ts (sparkSaveTitle) |
| Delete spark | The "…" deletes the spark after a confirm; 30 days in Recently deleted. | Free | components/common/SparkFrame.tsx |
| Leaving a new spark | Leaving a spark started this visit asks Save draft, Discard or Keep working. | Free | domain/sparkLeave.ts |
| Empty spark clean-up | A spark left with nothing in it is removed. (The try it used is not given back.) | Free | components/WordLadderScreen/hooks/useWordLadderScreenModel.ts |

## Lyric Spark: Word Ladder

Five steps: Verbs, Nouns, Pair, Draft, Revise. Everything below works inside any spark that exists.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Job / role | Type a job; the verbs come from that person's work. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Pick a job for me | The dice fills in a random job. | Free | domain/wordLadderIdeas.ts (randomRoleIdea) |
| Add a verb | Type verbs one per line into the list. | Free | components/WordLadderScreen/components/WordLadderColumnEditor.tsx |
| Suggest (verbs) | Adds four verbs that fit the job, from lists built into the app. Works offline. | Free · English, Hebrew, Spanish, German, Portuguese | domain/wordLadderIdeas.ts (suggestVerbs) |
| Room / place | Type a place; the nouns are things found there. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Pick a place for me | The dice fills in a random place. | Free | domain/wordLadderIdeas.ts (randomPlaceIdea) |
| Add a noun | Type nouns one per line. | Free | components/WordLadderScreen/components/WordLadderColumnEditor.tsx |
| Suggest (nouns) | Adds only as many nouns as the verbs still need. | Free · same five languages | domain/wordLadderIdeas.ts (suggestNouns) |
| Count and match hints | A counter (3/5) and a footer line say how many nouns are missing or extra. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Edit a word | Tap a word in a list to change it. | Free | components/WordLadderScreen/components/WordLadderColumnEditor.tsx |
| Reorder words | Hold a word's grip and drag it up or down. | Free | components/WordLadderScreen/components/WordLadderColumnEditor.tsx |
| Remove a word | Removes it at once; a toast offers Undo, which also restores its pairs. | Free | components/WordLadderScreen/hooks/useWordLadderScreenModel.ts |
| Automatic title | The spark names itself "The {job} in the {place}". | Free | components/WordLadderScreen/hooks/useWordLadderScreenModel.ts |
| Pair by tapping | Tap a verb, then a noun, to join them. | Free | components/WordLadderScreen/components/WordLadderPairingBoard.tsx |
| Shuffle | Pairs every free word at random. | Free | domain/wordLadder.ts (shufflePairings) |
| Lock pair | A locked pair stays through shuffles. | Free | domain/wordLadder.ts (toggleLock) |
| Remove pair | Breaks a pair; both words return to their lists. | Free | components/WordLadderScreen/components/WordLadderPairingBoard.tsx |
| Undo / Redo (pairing) | Steps back through pairing, unpairing, locks and shuffles. | Free | components/common/useUndoHistory.ts |
| Unpaired hint | The footer says how many words are still without a partner. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Job and place reminder | The Pair step shows the chosen job and place above the board. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Your pairs | On Draft, the pairs sit above the page; tap one to strike it as used. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Draft | A page to write loose lines from the pairs. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Your draft, with Copy | On Revise, the draft shows above for reference, with a Copy key. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Revise | A second page to shape the draft into lines worth keeping. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |

## Lyric Spark: Cut-Up

Four steps: Source, Cut, Arrange, Draft. Everything below works inside any spark that exists.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Paste or type a source | Start from something already written: a stuck verse, an old draft. | Free | components/CutUpScreen/components/CutUpSourceStep.tsx |
| From Lyric Pad | Pick a Lyric Pad page as the source. A copy: the page is untouched. | Free | components/CutUpScreen/components/CutUpSourceStep.tsx |
| Choose lines | Tap lines to take them, hold a line or tap "Verse n" for a whole verse, or Select all. | Free | components/CutUpScreen/components/CutUpLineSelectSheet.tsx |
| "Pulled from a Lyric Pad page" | A small mark says where the source came from. | Free | components/CutUpScreen/components/CutUpSourceStep.tsx |
| Source locks once cut | After the first cut the source is read-only, so a stray key cannot reset your work. | Free | components/CutUpScreen/components/CutUpSourceStep.tsx |
| Edit source | Unlocks the source after a warning that cuts and table start over. | Free | components/CutUpScreen/components/CutUpSourceStep.tsx |
| Replace source | Picking another page over typed or cut work asks first. | Free | components/CutUpScreen/components/CutUpSourceStep.tsx |
| Arrives cut at phrases | The Cut step opens with the lyric already cut at its natural breaks. | Free | domain/cutUp.ts (seedCutSeams) |
| Tap between words to cut | Splits a scrap in two at that point. | Free | components/CutUpScreen/components/CutUpChunkEditor.tsx |
| Tap a gap to join | Tapes two scraps on a line back together. | Free | components/CutUpScreen/components/CutUpChunkEditor.tsx |
| Recut | Returns to the automatic phrase cuts. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts (resetCuts) |
| Undo / Redo (cuts) | Steps back through cuts, joins and recuts. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts |
| Scrap count | A line says how many scraps the cut makes. | Free | components/CutUpScreen/components/CutUpChunkEditor.tsx |
| The table | Arrange opens with scraps laid out as the lyric was written, on a ruled page. | Free | components/CutUpScreen/components/CutUpBoard.tsx |
| Drag a scrap anywhere | A scrap settles on the nearest rule where you drop it. Scraps on one rule read as a line. | Free | components/CutUpScreen/components/CutUpBoard.tsx |
| Blank rule, blank line | An empty rule between scraps becomes a blank line in the draft. | Free | domain/cutUp.ts (assembleDraftFromCanvas) |
| Shuffle | Re-deals the unlocked scraps into random lines of mixed length. | Free | domain/cutUp.ts (shuffleCanvas) |
| Source order | Lays the scraps back out as the lyric was written. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts (resetOrder) |
| Pool all scraps | Sets every scrap aside to browse the whole set. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts (poolAll) |
| Undo / Redo (table) | Steps back through moves, shuffles, copies, cuts and set-asides. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts |
| Edit a scrap | Tap a scrap to change its words. | Free | components/CutUpScreen/components/CutUpBoard.tsx |
| Cut this scrap | Splits one scrap further from the table. | Free | components/CutUpScreen/components/CutUpBoard.tsx |
| Lock / Unlock | A locked scrap keeps its exact spot through shuffles. | Free | domain/cutUp.ts (toggleBoardItemLock) |
| Duplicate | Makes a copy of a scrap just below it. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts (duplicateStrip) |
| Set aside | Moves a scrap to a tray under the table; tap it there to bring it back. | Free | components/CutUpScreen/components/CutUpBoard.tsx |
| Return all | Brings every set-aside scrap back onto the table. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts (restoreAll) |
| Draft from the table | The Draft step opens with the table read out line by line. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts |
| Remix draft | Rebuilds the draft four ways: As arranged, Short, Mixed, Long. Asks before replacing your edits. | Free | components/CutUpScreen/components/CutUpDraftEditor.tsx |
| Edit the draft | Rewrite the draft freely. | Free | components/CutUpScreen/components/CutUpDraftEditor.tsx |
| Right-to-left tables | A Hebrew source lays out and reads right to left. | Free | components/CutUpScreen/hooks/useCutUpScreenModel.ts (canvasRtl) |

## Lyric Spark: Borrowed Words

Two steps: Page, Build. Called "Magpie" in code. Everything below works inside any spark that exists.

| Feature | What it does | Status | Where |
|---|---|---|---|
| A page from a real book | Opens a random page of a public-domain book. | Free · needs internet | domain/magpie.ts (drawPage) |
| Book line | Shows the book's cover, title and author; a tap opens the book sheet. | Free | components/MagpieScreen/components/MagpiePageStep.tsx |
| Tap words to collect | A tapped word is marked and joins your collection; a word next to a marked one joins its phrase. | Free | domain/magpie.ts (toggleWordOnPage) |
| Tap again to let go | Tapping a marked word drops it. | Free | domain/magpie.ts (toggleWordOnPage) |
| Pull apart | Hold a marked phrase to split it between any of its words. | Free | components/MagpieScreen/components/MagpiePageStep.tsx |
| Collected pile | Your words sit under the page with a count; tap one to remove it (Undo in the toast). | Free | components/MagpieScreen/components/MagpiePageStep.tsx |
| New page | Another random page from the same book. | Free · needs internet | components/MagpieScreen/hooks/useMagpieScreenModel.ts |
| New book | A different book. | Free · needs internet | components/MagpieScreen/hooks/useMagpieScreenModel.ts |
| Find books in | Choose English, Spanish, German, Portuguese or Hebrew books. Remembered for new sparks. | Free | state/useMagpiePrefsStore.ts |
| English, Spanish, German, Portuguese shelves | Hand-picked books fetched straight from Project Gutenberg. No SongNook server. | Free · needs internet | domain/magpieBooks.ts |
| Hebrew shelf | Books from Project Ben-Yehuda, through SongNook's own server (keyed, capped at 50 calls a minute). | Free · Hebrew · needs internet | domain/magpieBenYehuda.ts |
| Hebrew source genres | Pull Hebrew pages from Prose, Memoir, Letters, Fables; at least one stays on. | Free · Hebrew | state/useMagpiePrefsStore.ts |
| Source link | The book sheet links to the book on Project Gutenberg or Project Ben-Yehuda. | Free | components/MagpieScreen/components/MagpiePageStep.tsx |
| Words stay through pages | Collected words stay when you turn to a new page or book. | Free | domain/magpie.ts |
| Connection states | Offline or a page that will not open gets a plain message, Try again, and New book. | Free | components/MagpieScreen/components/MagpiePageStep.tsx |
| Build page | A writing page; on first visit your words arrive one per line. | Free | components/MagpieScreen/components/MagpieBuildStep.tsx |
| Tap a word to drop it in | A word from the strip lands at the cursor and is marked used. | Free | components/MagpieScreen/components/MagpieBuildStep.tsx |
| Add all | With a blank page, pours every word in, in order. | Free | components/MagpieScreen/hooks/useMagpieScreenModel.ts (pourScraps) |
| See all | Opens the whole collection in a sheet. | Free | components/MagpieScreen/components/MagpieBuildStep.tsx |
| Hold a word: Edit word | Change a collected word; it notes "edited from …". | Free | components/MagpieScreen/components/MagpieBuildStep.tsx |
| Hold a word: Split into words | Breaks a phrase into single words. | Free | domain/magpie.ts (splitFragment) |
| Hold a word: Merge with next | Joins a word to the one after it. | Free | domain/magpie.ts (mergeFragmentWithNext) |
| Hold a word: Mark used / unused | Ticks or unticks a word by hand. | Free | components/MagpieScreen/components/MagpieBuildStep.tsx |
| Hold a word: Remove | Drops the word; Undo in the toast. | Free | components/MagpieScreen/hooks/useMagpieScreenModel.ts |
| Undo / Redo (collection) | Steps back through collecting, removing, splitting and merging. | Free | components/MagpieScreen/hooks/useMagpieScreenModel.ts |
| Automatic title | The spark is named from its draft or first words. | Free | domain/magpie.ts (deriveMagpieTitle) |

## Chord charts

The bar chart of a sketch: sections of bars with chords. Lives on the sketch's Chart tab, and on its own page when opened from a setlist song or the player.

### Writing a chart

| Feature | What it does | Status | Where |
|---|---|---|---|
| Chart tab | Every sketch has a Chart tab for a bar-by-bar chord chart. | Free | components/IdeaDetailScreen/sections/SongChartSection.tsx |
| Add section | Starts a section from a preset name: Intro, Verse, Pre-Chorus, Chorus, Bridge, Interlude, Solo, Outro. | Free | components/ChordSheetScreen/components/ChordSheetBody.tsx |
| Custom section | Adds a section with a name of your own. | Free | components/ChordSheetScreen/components/ChordSheetBody.tsx |
| Text block | Adds a free-form note between sections (a spoken part, an arrangement note). | Free | components/ChordSheetScreen/components/ChordSheetBody.tsx |
| From lyrics | Builds the whole chart from the chords on the latest lyric version; asks before replacing. | Free | domain/chordSheet.ts (buildChordSheetFromLyrics) |
| Four bars to start | A new section opens with four empty bars. | Free | domain/chordSheet.ts (createSection) |
| Tap a bar | Opens that bar on its own to add, change or remove its chords. | Free | components/ChordSheetScreen/components/BarEditorSheet.tsx |
| Add chord | The same chord picker as lyrics: root, type, bass note, Other, recent chords. | Free | components/LyricsVersionScreen/components/chords/ChordPickerSheet.tsx |
| Up to seven chords a bar | A bar holds as many as seven chords. | Free | domain/chordSheet.ts (MAX_CHORDS_PER_BAR) |
| Add bar | A faint bar at the end of a section adds one more. | Free | components/ChordSheetScreen/ChordSheetSection.tsx |
| Section note | A short note line sits beside a section's name. | Free | components/ChordSheetScreen/ChordSheetSection.tsx |
| Section options: Rename | Renames a section, suggesting presets and names you have used before. | Free | components/ChordSheetScreen/useChordSheetModel.ts (labelSuggestionsFor) |
| Section options: Move up / Move down | Reorders sections. | Free | components/ChordSheetScreen/useChordSheetModel.ts (moveSection) |
| Section options: Delete | Deletes a section or text block after a confirm. | Free | components/ChordSheetScreen/components/ChordSheetBody.tsx |
| Hold a bar to select | Long-press selects bars within one section; a dock of actions appears. | Free | components/ChordSheetScreen/components/ChartSelectionDock.tsx |
| Before / After | Inserts an empty bar before or after the selection. | Free | components/ChordSheetScreen/useChordSheetModel.ts |
| Clear | Empties the selected bars but keeps them. | Free | components/ChordSheetScreen/useChordSheetModel.ts |
| Delete bars | Removes the selected bars. | Free | components/ChordSheetScreen/useChordSheetModel.ts |
| More: Copy / Cut / Paste bars | Copies or cuts bars and pastes them after the selection. | Free | components/ChordSheetScreen/useChordSheetModel.ts |
| More: Split into separate bars | Spreads one bar's chords over a bar each. | Free | domain/chordSheet.ts (splitMeasureChords) |
| Undo / Redo | Steps back up to fifty chart changes in this editing session. | Free | components/ChordSheetScreen/useChordSheetModel.ts |
| Done | Leaves editing. Leaving the tab or the page also ends editing, so nothing changes by accident. | Free | components/IdeaDetailScreen/sections/SongChartSection.tsx |
| Editing shows the written key | The editor never shows a transposed chart: you always edit what was written. | Free | components/ChordSheetScreen/components/ChordSheetScreenContent.tsx |
| Keyboard-safe editing | A note or text block being typed lifts above the keyboard. | Free | components/ChordSheetScreen/components/chartScroll.ts |
| Read-only charts | A chart in a parcel not yet kept, or an archived workspace, opens to read only. | Free | components/ChordSheetScreen/useChordSheetModel.ts |

### Reading and exporting a chart

| Feature | What it does | Status | Where |
|---|---|---|---|
| Full view | Shows the whole chart as one clean page, with a size slider (50% to 160%) and reset. | Free | components/ChordSheetScreen/components/ChordSheetBody.tsx (ChordSheetFullView) |
| Transpose (chart) | Shifts the shown chart by half steps; display only, remembered per song. | Pro (free on a received parcel) | components/common/TransposeChip.tsx:34 |
| Export sheet | The share glyph opens the chart's ways out. | Free | components/LyricsVersionScreen/components/chords/ChordExportSheet.tsx |
| PDF | Builds a print-ready chart and opens the share or print sheet. | Pro | components/ChordSheetScreen/useChordSheetModel.ts:437 |
| Text | Shares the chart as plain text, four bars to a row. | Free | domain/chordSheet.ts (serializeChordSheetText) |
| Add to chart book | Files the bar chart in an existing book. On the chart's own page only, not the sketch's Chart tab. | Free | components/ChordSheetScreen/components/ChordSheetScreenContent.tsx |
| New chart book (from the chooser) | Makes a new book and files the chart in it. | Pro | components/common/SongbookChooserSheet.tsx:78 |
| Exports follow the key | A transposed chart exports transposed. | Free | components/ChordSheetScreen/useChordSheetModel.ts (sheetForExport) |

## Transpose and capo

One transpose control and one capo control serve the whole app, so each behaves the same everywhere.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Transpose stepper | − and + move the shown chords a half step, up to eleven either way. | Pro (free on a received parcel) | components/common/TransposeChip.tsx:34 |
| Where transpose appears | Lyric chord view, sketch Chart tab, chart page, player reading page, stage reader. All one gate. | Pro (free on a received parcel) | components/common/SongReading.tsx (ReadingTransposeBar) |
| Back to written key | The reset glyph clears a shift. Not gated, so anyone can undo one. | Free | components/common/TransposeChip.tsx |
| The written chart never changes | Transpose is a way of showing; the saved chords stay as written. | Free | state/useChartPrefsStore.ts |
| One key per song, everywhere | A key set in one place is the key in the player, the reader and the chart page. | Free | state/useChartPrefsStore.ts |
| A set key keeps showing | A key chosen while you had Pro stays shown after; only changing it is gated. | Free | state/useChartPrefsStore.ts |
| Capo | Set the fret your capo is on (1 to 11); chords then show as the shapes you finger. | Pro (free on a received parcel) | components/common/ReadingSheet.tsx:74 |
| Where capo appears | Only in the Aa sheet: player, stage reader, recorder lyrics. Shown when the song has chords. | Pro (free on a received parcel) | components/common/ReadingSheet.tsx |
| Remove the capo | "None" beside the stepper takes the capo off. Not gated. | Free | components/common/ReadingSheet.tsx |
| "Capo n" on the Aa key | The Aa key shows the capo in force. | Free | components/common/ReadingSheet.tsx (readingKeyLabel) |

## Compilations hub

The Compilations page holds Playlists, Charts (chart books) and Setlists. Playlists are covered elsewhere; these rows are what the three share.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Three tabs | Playlists · Charts · Setlists, as ink tabs. | Free | components/LibraryScreen/components/LibraryScreenContent.tsx |
| Search | Finds a chart book or setlist by its name or by a song inside it. | Free | components/LibraryScreen/components/LibraryScreenContent.tsx |
| Show | All, Mine, or Received. Remembered. | Free | components/LibraryScreen/components/CompilationListControls.tsx |
| Sort by | Updated, Name, or Created. Remembered. | Free | components/LibraryScreen/components/CompilationListControls.tsx |
| "From …" mark | A book or set that someone sent carries a quiet provenance mark on its row. | Free | components/common/ProvenanceChip.tsx |
| Help | A "?" sheet says in four lines what playlists, charts, setlists and received items are. | Free | components/LibraryScreen/components/LibraryScreenContent.tsx |

## Chart books

A book of finished songs: each song's lyrics (with chords) and its bar chart, read like a book. "Songbook" in code.

| Feature | What it does | Status | Where |
|---|---|---|---|
| New chart book | The + key or the empty state's button names and creates a book. | Pro | components/LibraryScreen/hooks/useSongbookModel.ts:152 |
| Chart book list | Each book is a row with its chart count. | Free | components/LibraryScreen/views/SongbookListView.tsx |
| Open a book's page | Shows the title, "n songs · n with a chart", and one card per song. | Free | components/LibraryScreen/views/SongbookDetailView.tsx |
| Open the book | The big button opens the stage reader at the first song. | Free | components/LibraryScreen/hooks/useSongbookModel.ts (openReader) |
| Tap a song | Opens the reader at that song. | Free | components/LibraryScreen/views/SongbookDetailView.tsx |
| Play a song's take | A play key on each card plays the song's main take in the dock without leaving. | Free | components/LibraryScreen/hooks/useSongbookModel.ts (playSongAudio) |
| Add songs | Sends you into your collections to pick songs, across workspaces, then adds them. | Free | components/LibraryScreen/hooks/useSongbookModel.ts (startCollecting) |
| What gets added | Each picked song brings its latest lyric version and its bar chart. Songs with neither are skipped. | Free | domain/songbookGrouping.ts (buildDefaultSongbookItemsForIdea) |
| Add one chart from its page | "Add to chart book" on a lyric version or a chart files that one chart. | Free | components/common/SongbookChooserSheet.tsx |
| Edit book: reorder | Drag a song by its handle. | Free | components/LibraryScreen/views/SongbookDetailView.tsx |
| Edit book: remove a song | The − removes a song from the book after a confirm. The song stays in your library. | Free | components/LibraryScreen/hooks/useSongbookModel.ts (removeSong) |
| Song card detail | Says whether the song has Lyrics, a Chart, or both. | Free | components/LibraryScreen/views/SongbookDetailView.tsx |
| Live pages | The book shows the song as it is now: a lyric fixed later shows fixed. | Free | components/SongbookReaderScreen/useSongbookReaderModel.ts |
| "No longer in the library" | A song deleted from the library stays as a greyed row. | Free | domain/songbookGrouping.ts |
| Rename book | Changes the book's name. | Free | components/LibraryScreen/hooks/useSongbookModel.ts |
| Share: SongNook file | Exports the book as a small charts-only file; opening it in SongNook gives the receiver a real book. | Free | services/songbookShare.ts (shareSongbookFile) |
| Share: SongNook Send | Uploads the book and gives a link. | Free up to 3 links per 30 days, then Pro | services/songbookShare.ts (createSongbookShareLink) |
| Share: Share as text | Shares every chart in the book as one plain-text message. | Free | components/LibraryScreen/hooks/useSongbookModel.ts (shareSongbook) |
| Sent-link mark | A book with a live Send link shows it under its title. | Free | components/common/SentLinkChip.tsx |
| Delete book | Deletes after a confirm; 30 days in Recently deleted, with Undo. Songs stay. | Free | components/LibraryScreen/hooks/useSongbookModel.ts |
| Receiving a book | A book that arrives by file or Send link saves into Charts. No gate. | Free | services/libraryImport.ts |

## Setlists

An ordered set of songs, each packed with chosen takes, lyrics, chart and notes, to rehearse from or send to the band.

| Feature | What it does | Status | Where |
|---|---|---|---|
| New setlist | The + key or the empty state's button names and creates a setlist. | Pro | components/LibraryScreen/hooks/useSetlistModel.ts:172 |
| Setlist list | Each setlist is a row with its song count. | Free | components/LibraryScreen/views/SetlistListView.tsx |
| Open a set's page | Shows the title, song count, total running time and the set's note. | Free | components/LibraryScreen/views/SetlistDetailView.tsx |
| Play the whole set | Queues every song's packed takes, in order, into the player. | Free | domain/setlistPlayback.ts (buildSetlistQueue) |
| Play from a song | A play key on each row starts the set from that song. | Free | components/LibraryScreen/hooks/useSetlistModel.ts (playFromEntry) |
| Now-playing mark | The song that is sounding shows its title in terracotta. | Free | components/LibraryScreen/views/SetlistDetailView.tsx |
| Add a song | Sends you into your collections to pick songs, across workspaces. | Free | components/LibraryScreen/hooks/useSetlistModel.ts (startCollecting) |
| Default pack | A picked song arrives with its main take, latest lyrics and its chart. | Free | state/libraryCollectorActions.ts |
| Lyrics-only songs welcome | A sketch with no take can still be a set entry. | Free | state/libraryCollectorActions.ts |
| Edit set: reorder | Drag a song by its handle. | Free | components/LibraryScreen/views/SetlistDetailView.tsx |
| Edit set: remove | The − takes a song out of the set. | Free | components/LibraryScreen/hooks/useSetlistModel.ts |
| Edit set: repack a song | In edit mode, tap a row to choose what that song carries. | Free | components/LibraryScreen/views/SetlistEntryBuilderView.tsx |
| Repack: Everything | One key ticks every take, the latest lyrics, the chart and the notes. | Free | components/LibraryScreen/hooks/useSetlistModel.ts (builderSelectEverything) |
| Repack: Takes & parts | Tick which takes come along; each shows its sections and pins. | Free | components/LibraryScreen/views/SetlistEntryBuilderView.tsx |
| Repack: Charts & notes | Tick which lyric version, the chord chart, and the song notes. | Free | components/LibraryScreen/views/SetlistEntryBuilderView.tsx |
| A take brings its reel | A packed take carries its sections, pins and take notes. Version history stays home. | Free | services/setlistShare.ts (buildSetlistExportArgs) |
| Row detail | Each row says how many parts, and whether it has Lyrics, a Chart, Notes. | Free | components/LibraryScreen/views/SetlistDetailView.tsx |
| Set details | Edit the set's name and a note for the band. | Free | components/LibraryScreen/hooks/useSetlistModel.ts (openRename) |
| Share: SongNook file | Exports the set as one ready-to-play file through the phone's share sheet. | Free | services/setlistShare.ts (shareSetlist) |
| Share: SongNook Send | Uploads the set and gives a link. | Free up to 3 links per 30 days, then Pro | services/setlistShare.ts (createSetlistShareLink) |
| Sent-link mark | A set with a live Send link shows it under its title. | Free | components/common/SentLinkChip.tsx |
| Delete set | Deletes after a confirm; 30 days in Recently deleted, with Undo. Songs stay. | Free | components/LibraryScreen/hooks/useSetlistModel.ts |
| Receiving a set | A set that arrives by Send link saves as a setlist in order, with the sender's note. No gate. | Free | components/TransferReceiveScreen/index.tsx:357 |
| Missing songs | A deleted song shows "No longer in the library"; a deleted take falls back to the main one. | Free | domain/setlistPlayback.ts (resolveSetlistEntries) |

### A song in a set

| Feature | What it does | Status | Where |
|---|---|---|---|
| Song folder | Tapping a song opens its packed page: parts, lyrics, chart, notes. A bandmate sees the same page. | Free | components/SetlistSongScreen/index.tsx |
| Practice | The big play key queues this song's parts and opens the full player. | Free | components/SetlistSongScreen/index.tsx (playEntry) |
| Parts list | Each packed take is a row with its length, sections and pins; tap to play from it. | Free | components/SetlistSongScreen/index.tsx |
| Lyrics | Opens the packed lyric version on its reading page. | Free | components/SetlistSongScreen/index.tsx |
| Chart | Opens the song's bar chart on its own page. | Free | components/SetlistSongScreen/index.tsx:172 |
| Notes | Shows the song's notes when they were packed. | Free | components/SetlistSongScreen/index.tsx |
| Previous / next song | A strip at the foot names the neighbours and turns to them. | Free | components/common/SongPagerStrip.tsx |
| Swipe to turn | A sideways swipe turns to the next or previous song. | Free | components/common/SongPagerStrip.tsx (useSongSwipe) |
| "2 of 4" | The header shows where you are in the set. | Free | components/common/SongPagerStrip.tsx (SongPosition) |
| Screen stays lit | The phone does not lock while a song's page is in front. | Free | hooks/useKeepAwakeWhileFocused.ts |

## Stage reader

The full-screen reader a chart book opens in: one song per page.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Stage reader | Opens any existing book, for everyone. Reading is never gated. | Free | components/SongbookReaderScreen/index.tsx |
| One song per page | The book's name, the song's title, and its page. | Free | components/SongbookReaderScreen/index.tsx |
| Lyrics / Chart switch | Flips between the words (chords over them) and the bar chart, when a song has both. | Free | components/SongbookReaderScreen/index.tsx |
| View follows you | The view you chose carries to the next song when that song has it. | Free | components/SongbookReaderScreen/useSongbookReaderModel.ts |
| Previous / next song | The foot strip names the songs either side and turns to them. | Free | components/common/SongPagerStrip.tsx |
| Swipe to turn | A sideways swipe turns the page; up and down still scrolls. | Free | components/common/SongPagerStrip.tsx (useSongSwipe) |
| "3 of 12" | The header shows your place in the book. | Free | components/common/SongPagerStrip.tsx (SongPosition) |
| Screen stays lit | The phone does not lock while the book is open. | Free | hooks/useKeepAwakeWhileFocused.ts |
| Text size (Aa) | A slider sets the reading size (50% to 160%), shared with the player and recorder. | Free | components/common/ReadingSheet.tsx |
| Chords on or off | In the Aa sheet, hide the chords for a words-only read. | Free | components/common/ReadingSheet.tsx |
| Capo on stage | Set a capo fret in the Aa sheet. | Pro (free on a received parcel) | components/common/ReadingSheet.tsx:74 |
| Transpose on stage | Change key on the page whenever chords are showing. | Pro (free on a received parcel) | components/common/SongReading.tsx (ReadingTransposeBar) |
| Play the song | A key in the foot strip plays the song's main take in the dock, with its length. | Free | components/SongbookReaderScreen/useSongbookReaderModel.ts (toggleSongAudio) |
| Click at the song's tempo | A key starts the metronome at the tempo of the song's take. | Free | components/SongbookReaderScreen/useSongbookReaderModel.ts (songTempo) |
| Click follows the page | Turning the page moves a running click to the next song's tempo. | Free | components/SongbookReaderScreen/useSongbookReaderModel.ts |
| Click stops with the book | Closing the reader stops the click. | Free | components/SongbookReaderScreen/useSongbookReaderModel.ts |
| Page remembered by song | If the book is edited while open, you stay on the song you were reading. | Free | components/SongbookReaderScreen/useSongbookReaderModel.ts |
| Unreadable songs skipped | Songs with nothing to show are left out of the page turn. | Free | components/SongbookReaderScreen/useSongbookReaderModel.ts |

## Exporting words and charts

Every way words and charts leave the app, in one place.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Lyric version → PDF | Print-ready lyrics with chords. | Pro | components/LyricsVersionScreen/components/chords/useChordExport.ts:30 |
| Lyric version → Text | Plain chords-over-lyrics via the share sheet. | Free | components/LyricsVersionScreen/components/chords/useChordExport.ts |
| Lyric version → ChordPro | Included in the same Text share. | Free | domain/chords.ts (serializeChordPro) |
| Lyric version → Copy | Chart text or plain lyrics to the clipboard. | Free | components/LyricsVersionScreen/hooks/useLyricsVersionScreenModel.tsx |
| Bar chart → PDF | Print-ready bar chart. | Pro | components/ChordSheetScreen/useChordSheetModel.ts:437 |
| Bar chart → Text | Plain-text bars via the share sheet. | Free | components/ChordSheetScreen/useChordSheetModel.ts |
| Lyric Pad pages → Text | One or many pages as plain text via the share sheet. | Free | components/NotepadScreen/hooks/useNotepadScreenModel.ts |
| Word Ladder draft → Copy | Copy key on the Revise step. | Free | components/WordLadderScreen/components/WordLadderScreenContent.tsx |
| Spark → Lyric Pad | Any spark's lyric copied into a Lyric Pad page. | Free | components/common/sparkSend.ts |
| Lyric Pad page → sketch | A page becomes a lyric version of a sketch. | Free | state/actions.ts (completeSongTargetPicking) |
| Chart book → Text | The whole book as one text message. | Free | components/LibraryScreen/hooks/useSongbookModel.ts |
| Chart book → SongNook file | A charts-only file another SongNook can open as a book. | Free | services/songbookShare.ts |
| Chart book → Send link | A hosted link. | Free up to 3 links per 30 days, then Pro | services/songbookShare.ts |
| Setlist → SongNook file | One file with takes, charts and notes, ready to play. | Free | services/setlistShare.ts |
| Setlist → Send link | A hosted link. | Free up to 3 links per 30 days, then Pro | services/setlistShare.ts |
| PDF hand-off | A PDF opens the phone's share sheet, or the print dialog where sharing is not available. | Pro (part of PDF) | services/chordChartPdf.ts |

---

## Built but not reachable

- **`server/word-proxy`** (a Datamuse key proxy). Written, not deployed, not used: the app calls `api.datamuse.com` directly (`domain/wordTools.ts:16`). It is the planned fix for 2027, when Datamuse starts needing a key. Its README notes it is also where a server-side Pro check would go.
- **Cut-Up cut modes.** `useCutUpScreenModel.ts` still carries `setChunkMode`, `recut`, `toggleChunk`, `split`, `merge` and `bindWords` (cut by line / phrase / word, include or leave out a chunk). No screen calls them; the Cut step uses tap-to-cut seams only.
- **Borrowed Words "Rebuild from words"** (`rebuildDraft`, strings `magpie.rebuildFromWords`, `magpie.rebuildTitle`) and **drag-reorder of collected words** (`reorder`). In the model, not wired to any control.
- **Stage reader "Grid view", "Cycle text size", "Close the book", "Play reference audio".** Only the English strings remain (`library.gridView`, `library.cycleTextSize`, …). The reader now has two views (Lyrics, Chart) and the Aa sheet.
- **`ProGate` component** (`components/common/ProGate.tsx`). Kept on purpose, used nowhere; every gate in this area is a check at the moment of the tap.
- **Retired key `word-sparks-unlimited`** (the old cap on saved sparks). In the catalogue as free, read by nothing.
- **Hebrew register labels.** The Hebrew AI server can return a usage tag per word (literary, spoken) and the app parses it (`adaptHebrewWords`), but the sheet never draws it.

## Worth a decision

1. **The whole Word Finder is Pro, but half of it costs nothing to run.** German rhymes and everything in Portuguese run on the phone, offline. English, Spanish and German synonyms call free outside servers. Only Hebrew meaning lookups and Hebrew definitions cost money (about $0.002 per new word, then free for everyone forever). A free "Rhymes only" tier, or free on-phone languages, would be possible without cost.
2. **The Word Finder gate is on the phone only.** The Hebrew AI server (`server/word-he`) does not check for Pro; its protection is a monthly spend cap. Fine today, worth knowing.
3. **Hebrew definitions fire a paid lookup on a long-press, with no "Find words" tap.** The meaning tools wait for a deliberate tap; hold-for-definition does not.
4. **A spark try is spent the moment a game opens.** Opening Word Ladder and backing out with nothing typed removes the empty spark but keeps the try used. Three accidental opens use up a game for good.
5. **The three-try limit is soft once a spark exists.** A kept Cut-Up can have its source replaced and be run again; a kept Borrowed Words can pull new pages and new books without end. Only starting a new spark is counted.
6. **Borrowed Words in Hebrew uses a keyed server with a 50-calls-a-minute cap, with no gate on "New page" / "New book".** Cost is small and cached, but it is our server.
7. **Word Ladder "Suggest" and the dice are free and unlimited** (built-in lists, five languages). A helper that may be worth naming on the Pro page or leaving as a free hook; today it is not mentioned.
8. **PDF is Pro even for plain lyrics with no chords.** The lyric version's PDF is the only print-ready lyric sheet in the app, and its export sheet is titled "Export chords" either way.
9. **ChordPro export is free**, tucked inside the Text share. It is the format other chart apps import, so it is a real way out for a free user.
10. **Chart book "Share as text" and the SongNook file are free.** A free user who holds a book (received, or made in the free month) can export all of it.
11. **Books and sets made in the free month, or received, stay fully usable.** A free user can keep adding songs to them, repack, reorder, share. One old book works as an unlimited book. This follows the "gates only stop creating" rule; flagged so it is a choice, not a surprise.
12. **A received parcel's songs transpose and take a capo for free, but only while they sit in Received.** The free pass checks that the song's workspace is still marked "received". "Move to my workspaces" clears that mark (`state/dataSlice.ts:2925`) and "Move to…" a collection moves the songs into a personal workspace (`state/dataSlice.ts:2880`), so the same song becomes gated the moment a free bandmate keeps it. Possibly a surprise for them.
13. **The stage reader's click (metronome at the song's tempo) and play key are free.** The Pro page's stage line promises transpose, capo and making books and sets; the reader itself, keep-awake, page turns and the click are all free.
14. **Stepping the capo DOWN is gated, but "None" is free.** A free user whose song has capo 3 from the free month can remove it, but cannot lower it to 2. Same for transpose: reset is free, − and + are not. Small inconsistency with the code comment ("taking it off stays free").
15. **"Add to chart book" is missing from the sketch's own Chart tab.** It is offered on a lyric version and on the chart's standalone page (reached from a setlist song), not where a chart is usually written. Not a pricing matter; a reach matter.
16. **Deleting lyric versions is permanent.** Lyric Pad pages, sparks, books and sets all go to Recently deleted with Undo; lyric versions do not. Not a pricing matter; noted because it is the one place in this area where words can be lost with one confirm.

## Not sure

- **Importing a setlist FILE (not a Send link).** I confirmed the Send path builds a setlist with no gate (`TransferReceiveScreen/index.tsx:357`) and that a full archive import restores books and sets with no gate (`services/libraryImport.ts:807`). The only other `addSetlist` call in the collection import flow (`useCollectionImportFlow.ts:263`) sits in a developer-only sample routine. I did not trace every file-open path in `ShareImportScreen`, which belongs to another section; I found no gate in any of them by search.
- **Spark tries surviving a reinstall.** The count is kept in the phone's secure store (`services/freeMonthClock.ts`). The code says that on iOS this is the Keychain and outlives deleting the app. It says nothing about Android, where I would expect a reinstall to clear it and hand back three tries per game. Not tested.
- **The exact Datamuse terms.** The code and README say keyless and free until 1 January 2027 with a 100,000-a-day limit per key afterwards. I did not check Datamuse's own terms for commercial use; the claim is the code's, not verified outside it.
- **Compare and restore for lyric versions.** I found neither a side-by-side compare nor a "restore" button. Bringing an old version back is done with "New draft from this" (or by editing it, which always saves as new). If a compare view was expected, it is not in the code.
- **A song "key" field.** There is a `reading.key` string but no place to set a song's key; only the transpose offset exists. Listed as absent rather than hidden.
- **Auto-scroll in the stage reader.** There is none. Auto-scroll exists in the recorder's lyric panel, and "Follow" in the player's reading page, but the chart book reader scrolls by hand.
- **Row counts on the Lyric Spark list for old sparks**, and the precise wording of each game's help sheet, were read from strings, not seen on screen. Nothing here was run in the simulator (read-only brief).
