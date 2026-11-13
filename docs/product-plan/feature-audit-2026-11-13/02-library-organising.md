# 02 · The library and organising work

Feature inventory from code, main @ 2442cd38, 2026-11-13. Paths in "Where" are under `src/components/` unless they start with `src/` or `App.tsx`.

Status rule used: a feature with no gate in code is `Free`. The only gates found in this area are New workspace (`workspaces`), Move package to Files (`archive-offload`) and every SongNook Send row (`send`).

How the 3 free workspaces are counted (`WorkspaceListScreen/hooks/useWorkspaceListScreenModel.ts`, `activeWorkspaceCount`): your own workspaces that are not archived. Archived workspaces do not count. Received parcels ("From others") do not count. The starter workspace counts.

---

## Workspaces

### The workspace list ("Your workspaces")

| Feature | What it does | Status | Where |
|---|---|---|---|
| Your workspaces page | Lists every workspace with its mark, name, description, collection and idea counts, and when you last worked there. | Free | WorkspaceListScreen/components/WorkspaceListScreenContent.tsx |
| Open a workspace | Tapping a workspace opens its collections and makes it the one new work lands in. | Free | WorkspaceListScreen/components/WorkspaceList.tsx |
| New workspace (+) | Creates a workspace with a name, description, colour and mark. | Free up to 3 workspaces, then Pro | WorkspaceListScreen/components/WorkspaceListScreenContent.tsx |
| Workspace name | Types the workspace's name; left blank, it becomes "New Workspace" with today's date. | Free | WorkspaceListScreen/hooks/useWorkspaceListScreenModel.ts |
| Suggest a name | The sparkle glyph in the name field fills in a random name idea. | Free | modals/WorkspaceModal.tsx |
| Clear name | The ✕ in the name field empties it. | Free | modals/WorkspaceModal.tsx |
| Description | An optional line or two shown under the workspace's name. | Free | modals/WorkspaceModal.tsx |
| Workspace colour | A hue slider picks the workspace's colour; a new workspace starts on a random hue. | Free | modals/WorkspaceModal.tsx |
| Workspace mark (avatar) | Each workspace gets a generated pattern; the refresh badge draws a new one. | Free | modals/WorkspaceModal.tsx |
| Workspace colour tints its pages | The workspace hub takes a paper tint from the workspace's colour. | Free | WorkspaceBrowseScreen/components/WorkspaceBrowseScreenContent.tsx |
| Edit workspace | Changes a workspace's name, description, colour and mark from its "…" menu. | Free | WorkspaceListScreen/hooks/useWorkspaceListScreenModel.ts |
| Set as primary | Marks one workspace as primary; it wears a Primary star and always lists first. | Free | WorkspaceListScreen/hooks/useWorkspaceListScreenModel.ts |
| Order | Sorts the list: Last worked, Least recent, Title A–Z, Title Z–A. The choice is remembered. | Free | WorkspaceListScreen/components/WorkspaceListScreenContent.tsx |
| Last worked line | Each workspace says when it was last opened: today, yesterday, days, weeks or months ago. | Free | cards/WorkspaceCard.tsx |
| Share workspace: Export | Saves the whole workspace as one SongNook file through the phone's share sheet. | Free | WorkspaceListScreen/hooks/useWorkspaceListScreenModel.ts |
| Share workspace: SongNook Send | Makes a link to the whole workspace that anyone can open for 7 days. | Free up to 3 links per 30 days, then Pro | WorkspaceListScreen/hooks/useWorkspaceListScreenModel.ts |
| Compilations travel with a shared place | Playlists, chart books and setlists that sit wholly inside a shared workspace or collection go with it. | Free | src/services/placeShare.ts |
| Delete workspace | Moves the workspace and its ideas to Recently deleted for 30 days, after a confirm. | Free | WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts |
| Last workspace safeguard | Deleting your only workspace leaves a fresh empty one in its place. | Free | WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts |
| "From others" group | Received parcels list apart from your own workspaces; tapping one opens it in Received. | Free | WorkspaceListScreen/components/WorkspaceList.tsx |
| Paste reminder on the list | While something is copied or moved, a banner says to open a workspace first. | Free | WorkspaceListScreen/components/WorkspaceListScreenContent.tsx |
| Empty state | With no workspaces the page says "No workspaces. Tap + to create one." | Free | WorkspaceListScreen/components/WorkspaceListScreenContent.tsx |

### Archived workspaces (only for workspaces that are already archived)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Archived group | Archived workspaces list in muted ink under "Archived"; tapping one opens its menu. | Free | WorkspaceListScreen/components/WorkspaceListScreenContent.tsx |
| Archived workspace is read-only | An archived workspace can be browsed, played and shared from, but nothing edits or records into it. | Free | src/domain/workspaceVisibility.ts |
| Unarchive | Unpacks an archived workspace's audio and returns it to the active list exactly as it was. | Free | WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts |
| Unarchive from a moved package | If the package was moved to Files, Unarchive asks you to pick that file. | Free | WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts |
| Move package to Files | Saves an archived workspace's package where you choose, then deletes the copy on the phone. | Pro | WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts |
| "Confirm the package saved" | On iPhone the local copy is only deleted after you confirm the file really saved. | Pro | WorkspaceListScreen/hooks/useWorkspaceArchiveActions.ts |
| Working label | While a workspace is unpacking or moving, its row reads RESTORING or MOVING and its menu is held. | Free | cards/WorkspaceCard.tsx |

### The workspace hub (Collections)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Workspace hub | Shows the workspace's mark and name, then its top-level collections as rows. | Free | WorkspaceBrowseScreen/components/WorkspaceBrowseScreenContent.tsx |
| Collection row details | Each row shows name, idea count, sub-collection count, last edit, description and a Primary star. | Free | WorkspaceBrowseScreen/components/WorkspaceCollectionCard.tsx |
| Automatic order | Collections list with the primary one first, then by most recently worked. There is no sort control. | Free | src/domain/libraryNavigation.ts |
| Collapsing header | Scrolling folds the big workspace title into a small one in the top bar. | Free | WorkspaceBrowseScreen/components/WorkspaceBrowseScreenContent.tsx |
| Search this workspace | The search glyph opens a field; collections filter live by their names and what is inside them. | Free | WorkspaceBrowseScreen/components/WorkspaceBrowseScreenContent.tsx |
| Search match badges | Each matching collection says why: a sketch, clip, notes, lyrics, chords or sub-collection match, highlighted. | Free | WorkspaceBrowseScreen/components/WorkspaceCollectionCard.tsx |
| Empty and no-match states | "No collections yet" or "No matching collections", each with one line of help. | Free | WorkspaceBrowseScreen/components/WorkspaceCollectionList.tsx |
| Read-only hub | An archived or received workspace's hub has no + and no selection. | Free | WorkspaceBrowseScreen/components/WorkspaceBrowseScreenContent.tsx |

---

## Collections

### Making and managing collections

| Feature | What it does | Status | Where |
|---|---|---|---|
| New collection (+) | Creates a top-level collection with a name and optional description, then opens it. | Free | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionImportFlow.ts |
| Default collection name | Left blank, a new collection is named "Collection" plus the next number. | Free | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionImportFlow.ts |
| Select collections | Long-press a collection row to select; tap more rows; All and Cancel sit at the top. | Free | WorkspaceBrowseScreen/components/WorkspaceBrowseScreenContent.tsx |
| Edit collection | Renames one selected collection and edits its description. | Free | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts |
| Primary collection | Marks one collection as primary: it lists first and is where the app opens. | Free | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts |
| Delete collections | Moves the selected collections, their sub-collections and ideas to Recently deleted, with counts in the confirm. | Free | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts |
| Copy collection | Copies the selected collections to another workspace, the top level, or inside another collection. | Free | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts |
| Move collection | Moves the selected collections to another workspace, the top level, or inside another collection. | Free | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts |
| Destination picker | Copy and Move show every valid place: each workspace's top level and each collection that can hold one. | Free | modals/CollectionMoveModal.tsx |
| Share collection: Export (from the hub) | Saves one selected collection as a SongNook file. | Free | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts |
| Share collection: SongNook Send (from the hub) | Makes a 7-day link to one selected collection. | Free up to 3 links per 30 days, then Pro | WorkspaceBrowseScreen/hooks/useWorkspaceCollectionSelection.ts |
| No parcels as destinations | Received and archived workspaces never appear as a place to copy or move a collection to. | Free | src/domain/workspaceVisibility.ts |

### Nested collections (sub-collections)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Make a sub-collection | A collection becomes a sub-collection by moving or copying it inside another. There is no "new sub-collection" button. | Free | src/domain/collectionManagement.ts |
| One level deep | A sub-collection cannot hold another; a collection that has sub-collections can only go to a top level. | Free | src/domain/collectionManagement.ts |
| "Nested collections" strip | A collection with sub-collections shows a fold-out strip listing them with a count. | Free | IdeaListScreen/components/IdeaListNestedCollectionsSection.tsx |
| Open a sub-collection | Tapping a sub-collection opens it as its own page. | Free | IdeaListScreen/components/CollectionScreenContent.tsx |
| Sub-collection menu | Long-press a sub-collection for Rename, Copy, Move and Delete. | Free | modals/CollectionActionsModal.tsx |
| Up-link | The header's workspace mark and name (or the parent collection's name) take you one level up. | Free | IdeaListScreen/sections/CollectionHeaderSection.tsx |

---

## The collection page

### Page and header

| Feature | What it does | Status | Where |
|---|---|---|---|
| Collection page | Shows the collection's name, idea count, last edit, description, then its ideas as cards. | Free | IdeaListScreen/sections/CollectionHeaderSection.tsx |
| Collapsing header | Scrolling folds the large title into a compact one beside the workspace mark. | Free | IdeaListScreen/components/CollectionScreenContent.tsx |
| Record button | The one round button starts a new clip in this collection. | Free | IdeaListScreen/sections/CollectionFloatingActions.tsx |
| Play all | Queues every playable idea on the page, in the order shown, and starts playing. | Free | IdeaListScreen/components/CollectionHeaderMenu.tsx |
| New sketch | Creates an empty sketch in this collection and opens it for naming. | Free | IdeaListScreen/components/CollectionHeaderMenu.tsx |
| Import | Brings audio in from Files, or the sound of videos from the photo library. | Free | IdeaListScreen/hooks/useCollectionImportFlow.ts |
| Import as clips or one sketch | Several files can land as individual clips, or together as one sketch's takes. | Free | IdeaListScreen/hooks/useCollectionImportFlow.ts |
| Import date choice | Imported files keep their original recording date or take today's date; you choose. | Free | src/domain/importDates.ts |
| Import duplicate check | Files already in your library are flagged before import; skip them or import copies. | Free | src/services/importDuplicates.ts |
| Import progress | A bar shows files imported so far; you can keep working meanwhile. | Free | ImportProgressBanner.tsx |
| Compact view | A switch in the menu shrinks cards to single rows. It resets when you leave the page. | Free | IdeaListScreen/components/CollectionHeaderMenu.tsx |
| View activity | Opens the Activity heatmap for this collection only. | Free | IdeaListScreen/components/CollectionHeaderMenu.tsx |
| Share collection: Export | Saves the collection as one SongNook file. | Free | IdeaListScreen/hooks/useCollectionManagement.ts |
| Share collection: SongNook Send | Makes a 7-day link to the collection. | Free up to 3 links per 30 days, then Pro | IdeaListScreen/hooks/useCollectionManagement.ts |
| Link chip | A collection you sent wears "Link active · N days left · Copy" under its title. | Free | common/SentLinkChip.tsx |
| Empty state | An empty collection says "Nothing here yet. Recorded clips land here." | Free | IdeaListScreen/components/IdeaListContent.tsx |
| Missing collection fallback | If the collection was deleted, the page says so and offers "Go to your library". | Free | IdeaListScreen/components/CollectionScreenContent.tsx |
| Read-only collection | In an archive or a received parcel, record, new sketch, import and paste are hidden. | Free | IdeaListScreen/hooks/useCollectionScreenModel.ts |
| Unfinished items stay out | A sketch not yet saved, or a take still recording, does not appear in the list. | Free | IdeaListScreen/hooks/useCollectionScreenModel.ts |

### Moving through a long list

| Feature | What it does | Status | Where |
|---|---|---|---|
| Day groups | Sorted by Created or Updated, ideas group under Today, Yesterday, Last week, This month, Last month, then months. | Free | src/domain/dateBuckets.ts |
| Floating day chip | A small chip under the header names the day group you are scrolled into. | Free | IdeaListScreen/components/CollectionScreenContent.tsx |
| Fast-scroll handle | A handle appears at the edge while scrolling; drag it to move through the list quickly. | Free | IdeaListScreen/components/ListScrubber.tsx |
| Fast-scroll readout | While dragging, a chip names the day or month (date sorts) or the letter (title sort). | Free | IdeaListScreen/components/ListScrubber.tsx |
| Light cards while fast-scrolling | Cards draw a simple line instead of a waveform during a fast-scroll, so it stays smooth. | Free | IdeaListScreen/components/IdeaListContent.tsx |
| Highlight flash | A card just added, imported, or jumped to from elsewhere flashes once so you can spot it. | Free | IdeaListScreen/hooks/useCollectionScreenModel.ts |

---

## Idea cards

| Feature | What it does | Status | Where |
|---|---|---|---|
| Clip card | Shows the clip's title, length, waveform, date, up to three tags and a bookmark mark. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Sketch card | Wears a drawn stack of two paper edges, its stage, and "4 takes · Mon"; shows the primary take's wave. | Free | common/IdeaCard.tsx |
| Lyrics mark on a sketch card | A small page glyph shows when the sketch has lyrics. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Named and unnamed titles | A title you typed shows in the serif face; an automatic name stays in quiet plain type. | Free | src/domain/titleNaming.ts |
| Tap a clip card | Opens the clip in the full player. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Tap a sketch card | Opens the sketch's page. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Card play button | Plays the clip (or a sketch's primary take) right on the card; the whole left column is the button. | Free | common/IdeaCard.tsx |
| One preview at a time | Starting a preview on another card stops the first; leaving the page stops it too. | Free | src/hooks/useInlinePlayer.ts |
| Scrub on the card | While a preview is live, drag along its waveform to move through it; the time follows your thumb. | Free | common/IdeaCard.tsx |
| Held scrub | The scrub keeps hold even if your thumb slides off the card. | Free | common/useHeldScrubGesture.ts |
| Stop preview | A ✕ on the live card ends the preview. | Free | common/IdeaCard.tsx |
| Preview hands over its place | Opening the full player from a previewing card starts where the preview stood, playing or paused. | Free | src/hooks/FullPlayerProvider.tsx |
| Card follows the player | The card of the clip playing in the dock shows a now-playing mark and its button plays or pauses it. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Double-press guard | A second press within half a second is ignored, so play never looks like it failed. | Free | src/hooks/useInlinePlayer.ts |
| Compact row scrub line | In compact view a previewing row grows a thin draggable line. | Free | common/IdeaCard.tsx |
| Hold anywhere to select | A long-press anywhere on a card (not the live waveform) starts selection. | Free | common/IdeaCard.tsx |
| Search match line | When a search matches inside notes or lyrics, the card shows the matching line, highlighted. | Free | IdeaListScreen/ideaSearchMeta.ts |
| Waveforms fill in by themselves | Imported clips get their real waveforms in the background, visible cards first. | Free | src/services/backgroundWaveformHydration.ts |

---

## Sorting and filtering (collection page)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Search this collection | Filters the list as you type by titles, notes, clip notes, lyrics and chords. | Free | IdeaListScreen/components/IdeaListFilterSection.tsx |
| Show: All / Clips / Sketches | Narrows the list to one kind of idea. | Free | IdeaListScreen/components/FilterSortBar.tsx |
| Bookmarked only | Shows only bookmarked ideas. | Free | IdeaListScreen/components/FilterSortBar.tsx |
| Stage filter | Shows sketches at chosen stages: Early, Rough, Close, Song. Any number at once. | Free | IdeaListScreen/components/FilterSortBar.tsx |
| Tags filter | Shows clips carrying chosen tags, or Untagged. Any number at once. | Free | IdeaListScreen/components/FilterSortBar.tsx |
| Clear filters | One link at the foot of the menu, and a quick clear on the filter glyph, reset every filter. | Free | IdeaListScreen/components/FilterSortBar.tsx |
| Sort by | Orders the list by Created, Updated, Title, Length or Stage. | Free | IdeaListScreen/components/FilterSortBar.tsx |
| Order | Flips the sort: Newest/Oldest first, A–Z/Z–A, Longest/Shortest first, Furthest along/Earliest stage. | Free | src/domain/ideaSort.ts |
| Sort and filter are remembered | The chosen sort, kind filter and tag filter stay as set, across collections and app restarts. | Free | src/state/persistedSnapshot.ts |
| Hide a day group | The eye glyph (or a long-press) on a day label folds that whole group away. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Folded day marker | A folded group leaves a labelled line with "N hidden"; tap it to unfold. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Hide ideas | Selected ideas can be hidden from the list without deleting them. | Free | IdeaListScreen/sections/CollectionFloatingActions.tsx |
| Show all (N) | A pill beside the filters brings back every hidden idea and folded day at once. | Free | IdeaListScreen/components/IdeaListFilterSection.tsx |
| Parcels keep the sender's order | A received parcel's collection always lists oldest first, whatever your sort is. | Free | IdeaListScreen/hooks/useCollectionScreenModel.ts |

---

## Tags, stages and bookmarks

| Feature | What it does | Status | Where |
|---|---|---|---|
| Built-in tags | Clips and takes can be tagged Riff, Verse, Pre-chorus, Chorus, Intro, Outro or Interlude. | Free | IdeaDetailScreen/components/ClipTagPicker.tsx |
| Your tags | Make your own tag with a name and a colour; it is offered everywhere afterwards. | Free | IdeaDetailScreen/components/ClipTagPicker.tsx |
| Sketch tags | A tag made inside a sketch belongs to that sketch's takes only. | Free | IdeaDetailScreen/components/ClipTagPicker.tsx |
| Tag several at once | Tagging a selection shows each tag as on, off or partly on, and applies to all. | Free | IdeaDetailScreen/components/ClipTagPicker.tsx |
| Tag suggestions | A take whose title contains "verse", "chorus" and so on offers that tag in one tap. | Free | IdeaDetailScreen/songClipControls.ts |
| Tags on cards | Tags show as coloured words on clip cards (first three) and on take cards. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Bookmark an idea | Select ideas, More, Bookmark; bookmarked cards wear a small terracotta mark. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Bookmark a take | The Tags sheet inside a sketch has a Bookmarked switch for the selected takes. | Free | IdeaDetailScreen/components/ClipTagPicker.tsx |
| Stages | A sketch sits at Early, Rough, Close or Song; set in Edit sketch. | Free | IdeaDetailScreen/components/SongEditSheet.tsx |
| Stage ink | The stage shows as a small dial and coloured word on the sketch's card and page. | Free | common/StageMark.tsx |
| Take groups | Inside a sketch, takes can be put in named groups (Group 1, Verse ideas…). | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| New group / take out of group | The Group sheet assigns takes to a group, makes a new one, or takes them out. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Fold a group | Tapping a group's header folds or unfolds its takes. | Free | IdeaDetailScreen/components/EvolutionList.tsx |
| Rename a group | Long-press a group's header to rename it. | Free | IdeaDetailScreen/components/EvolutionList.tsx |

---

## Selecting and bulk actions (collection page)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Selection mode | Long-press a card to start; tap cards to add or remove; count, All and Cancel replace the filter glyphs. | Free | IdeaListScreen/sections/CollectionFilterSection.tsx |
| Search while selecting | The search field stays live in selection mode, so you can narrow and keep choosing. | Free | IdeaListScreen/sections/CollectionFilterSection.tsx |
| Play | Plays the selected ideas as a queue, in the order shown on screen. | Free | IdeaListScreen/sections/CollectionFloatingActions.tsx |
| Queue | If something is already playing, Play becomes Queue and adds the selection to it. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| New sketch (from clips) | Gathers the selected clips into one new sketch as separate takes, newest as primary, and opens it. | Free | IdeaListScreen/sections/CollectionFloatingActions.tsx |
| Undo "Made a sketch" | A bar offers Undo for a few seconds; the clips return as they were. | Free | IdeaListScreen/sections/CollectionFloatingActions.tsx |
| Hide / Unhide | Hides the selection from the list, or brings hidden ones back. | Free | IdeaListScreen/sections/CollectionFloatingActions.tsx |
| Delete | Moves the selection to Recently deleted after a confirm that names the sketches. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Undo delete | A bar reading "N ideas in Recently deleted" offers Undo for five seconds. | Free | IdeaListScreen/hooks/useCollectionSelection.ts |
| Edit (one clip) | Opens a sheet to rename the clip and write its notes; unsaved words survive the app closing. | Free | IdeaListScreen/hooks/useCollectionEditModal.ts |
| Edit (one sketch) | Opens the sketch's page with its edit sheet up. | Free | IdeaListScreen/sections/CollectionFloatingActions.tsx |
| Bookmark / Remove bookmark | Bookmarks everything selected, or removes the bookmark when all already have it. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Add to Shelf | Sets the selection aside on the Shelf for 7 days; a toast offers "View shelf". | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Tags | Opens the tag sheet for the selected clips. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Copy | Puts the selection on a clipboard; open any collection and tap "Paste here". Originals stay. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Move | Same clipboard, but the ideas leave their old collection when pasted. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Paste here banner | While something is copied or moved, every collection shows a banner with Paste here and cancel. | Free | IdeaListScreen/components/IdeaListHeaderSection.tsx |
| Duplicate guard | Pasting a copy into the same collection asks first; moving to where they already are is refused. | Free | IdeaListScreen/components/IdeaListHeaderSection.tsx |
| Playlist | Adds the selection to an existing playlist or a new one. | Free | common/PlaylistChooserSheet.tsx |
| Share audio | Sends the audio files through the phone's share sheet; a sketch sends its primary take. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Export (with a sketch selected) | Saves everything selected, takes, words, charts and notes, as one SongNook file. | Free | src/services/ideasShare.ts |
| Export for DAW | For one clip recorded to the click: a bar-aligned WAV named with its tempo. | Free | src/services/dawExport.ts |
| SongNook Send (selection) | Makes a 7-day link to the selected cards, choosing what travels with each. | Free up to 3 links per 30 days, then Pro | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Selection ends itself | Choosing an action ends selection; so does leaving the page. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |
| Read-only selection | In an archive or parcel, a selection can only play, shelve, copy out, join a playlist or be shared. | Free | IdeaListScreen/components/IdeaSelectionBar.tsx |

---

## Sketches and takes

### The sketch page

| Feature | What it does | Status | Where |
|---|---|---|---|
| Sketch page | Shows the sketch's title, stage, take count and last edit over four tabs. | Free | IdeaDetailScreen/components/SongCollapsibleHeader.tsx |
| Tabs: Takes · Lyrics · Chart · Notes | Switches between the sketch's recordings, its lyric versions, its chord chart and its notes. | Free | IdeaDetailScreen/components/SongCollapsibleHeader.tsx |
| Honest back label | The back chevron names where it returns to (the collection, Search, Activity, Shelf, Revisit). | Free | src/hooks/useOriginLabel.ts |
| Primary take line | Under the title: play the primary take, or tap its name to find it in the list. | Free | IdeaDetailScreen/components/PrimaryTakeLine.tsx |
| Record button | The round button on the Takes tab records a new take into this sketch. | Free | IdeaDetailScreen/components/SongScreenContent.tsx |
| Play all | Plays every take of the sketch as a queue. | Free | IdeaDetailScreen/components/SongHeaderMenu.tsx |
| Edit sketch | A sheet to change the title and the stage, with Save and Cancel. | Free | IdeaDetailScreen/components/SongEditSheet.tsx |
| Suggest a title | The sparkle glyph in the sketch title field fills in a random name idea. | Free | common/TitleInput.tsx |
| New sketch starts as a draft | A brand-new sketch opens its sheet first; Discard removes it without a trace. | Free | IdeaDetailScreen/hooks/useSongEditFlow.ts |
| Discard changes guard | Leaving the edit sheet with unsaved changes asks before throwing them away. | Free | IdeaDetailScreen/hooks/useSongEditFlow.ts |
| Unique titles | A sketch's title is kept unique inside its workspace. | Free | IdeaDetailScreen/hooks/useSongEditFlow.ts |
| Rename takes to match | Renaming a sketch offers to rename takes that carried its old name. | Free | IdeaDetailScreen/hooks/useSongEditFlow.ts |
| Import audio into sketch | Brings one audio or video file in as a new take, with the same date choice and duplicate check. | Free | IdeaDetailScreen/hooks/useSongImportFlow.ts |
| View in collection | Jumps to the sketch's card in its collection, scrolled to and flashed. | Free | IdeaDetailScreen/components/SongHeaderMenu.tsx |
| Share sketch: Export | Saves the whole sketch as a SongNook file. | Free | IdeaDetailScreen/components/SongScreenContent.tsx |
| Share sketch: SongNook Send | Makes a 7-day link to the sketch. | Free up to 3 links per 30 days, then Pro | IdeaDetailScreen/components/SongScreenContent.tsx |
| Delete sketch: Keep takes | Deletes the sketch but leaves its takes in the collection as separate clips. | Free | IdeaDetailScreen/components/SongHeaderMenu.tsx |
| Delete sketch: Delete all | Moves the sketch and all its takes to Recently deleted. | Free | IdeaDetailScreen/components/SongHeaderMenu.tsx |
| Notes tab | Tap the page to write notes for the sketch; Save or Cancel; unsaved words survive the app closing. | Free | IdeaDetailScreen/components/SongNotesEditor.tsx |
| Lyrics tab | Lists the sketch's lyric versions and opens them (the editor itself is listed elsewhere). | Free | IdeaDetailScreen/sections/SongLyricsSection.tsx |
| "Write with the tape" | From the Lyrics tab, opens the player set up for writing words against the take. | Free | IdeaDetailScreen/sections/SongLyricsSection.tsx |
| Chart tab | Shows the sketch's chord chart and opens it for editing (the editor itself is listed elsewhere). | Free | IdeaDetailScreen/sections/SongChartSection.tsx |
| Side menu from a sketch | The menu glyph beside "…" opens the side menu without leaving the page. | Free | common/SideMenuButton.tsx |
| Read-only sketch | In an archive or parcel a sketch only plays, reads and shares; a line says why ("Keep to edit"). | Free | common/ReadOnlyLine.tsx |

### The takes list

| Feature | What it does | Status | Where |
|---|---|---|---|
| Take card | Shows the take's title, length, waveform, date, version number, layer count, tags, bookmark and Primary mark. | Free | IdeaDetailScreen/components/ClipCard.tsx |
| Tap a take | Opens it in the full player. | Free | IdeaDetailScreen/components/ClipCard.tsx |
| Preview a take | The card's play button previews it in place, with the same scrubbing as collection cards. | Free | IdeaDetailScreen/components/ClipCard.tsx |
| Take note line | A take's note shows in two lines with More / Less; tapping opens the note to edit. | Free | common/clip/ClipNoteLine.tsx |
| Add tag from the card | A small tag key on each take opens the tag sheet. | Free | common/clip/ClipTagBadges.tsx |
| Evolution / Timeline switch | Evolution stacks each take's versions; Timeline lists every take by date. | Free | IdeaDetailScreen/components/songClipToolbar/SongClipViewToggle.tsx |
| Newest / oldest first | One tap flips the order of the takes list. | Free | IdeaDetailScreen/components/songClipToolbar/SongClipSortTrigger.tsx |
| Takes filter | Narrows takes by tags (or Untagged), Bookmarked only, and groups, with Clear filters. | Free | IdeaDetailScreen/components/songClipToolbar/SongClipFilterMenu.tsx |
| Show: Every version / Latest only | In Timeline, shows every version or only each take's newest. | Free | IdeaDetailScreen/components/songClipToolbar/SongClipFilterMenu.tsx |
| "Find in Evolution view" | In Timeline, a glyph on a take jumps to it inside its stack. | Free | IdeaDetailScreen/components/ClipCard.tsx |
| Takes help | A "?" opens a short sheet on versions, primary take, the two views and Stand alone. | Free | IdeaDetailScreen/components/TakesHelpSheet.tsx |
| Select takes | Long-press a take to select; tap more; count, All and Cancel sit in the toolbar. | Free | IdeaDetailScreen/components/songClipToolbar/SongClipListToolbar.tsx |
| Play selected takes | Plays the selected takes as a queue. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Edit a take | Renames one take and edits its notes. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Delete takes | Moves the selected takes to Recently deleted, with an Undo bar. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Make primary | Sets one take as the sketch's primary: the one that plays for the sketch everywhere. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Takes to a playlist | Adds the selected takes to an existing or new playlist. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Copy or move takes | Copies or moves takes by clipboard; open any sketch and tap Paste here. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Paste into a sketch | Pasted clips join the sketch's takes; a pasted sketch brings only its primary take. | Free | IdeaDetailScreen/components/SongClipboardBanner.tsx |
| Duplicate takes guard | Pasting takes already in the sketch asks before making duplicates. | Free | IdeaDetailScreen/components/SongClipboardBanner.tsx |
| Share takes: Share audio | Sends the selected takes' audio files through the share sheet. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Share takes: Export for DAW | For one take recorded to the click: a bar-aligned WAV named with its tempo. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Share takes: SongNook Send | Makes a 7-day link to the selected takes, with the sketch's words and chart optional. | Free up to 3 links per 30 days, then Pro | IdeaDetailScreen/components/SelectionBars.tsx |

### Making a sketch

| Feature | What it does | Status | Where |
|---|---|---|---|
| New sketch (empty) | From a collection's "…": an empty sketch to record or write into. | Free | IdeaListScreen/components/CollectionHeaderMenu.tsx |
| New sketch from clips | From a selection of clips: they become the new sketch's takes. | Free | IdeaListScreen/sections/CollectionFloatingActions.tsx |
| Import as sketch | Several imported files become one sketch. | Free | IdeaListScreen/hooks/useCollectionImportFlow.ts |
| Finish a song | A sketch is "finished" by setting its stage to Song; nothing else changes or locks. | Free | IdeaDetailScreen/components/SongEditSheet.tsx |

---

## Versions

| Feature | What it does | Status | Where |
|---|---|---|---|
| + Version | On a take's card: records a new version of that take; it stacks on top as the newest. | Free | IdeaDetailScreen/components/clipCard/ClipCardVersionKey.tsx |
| Version numbers | Versions are numbered v1, v2… oldest first; the card shows the head's number. | Free | IdeaDetailScreen/components/ClipCard.tsx |
| Stacked look | A take with older versions wears the drawn paper stack, like a sketch card. | Free | IdeaDetailScreen/components/EvolutionThread.tsx |
| "N older" fold | Tapping "N older" unfolds the older versions under the take; tapping again folds them. | Free | IdeaDetailScreen/components/clipCard/ClipCardVersionKey.tsx |
| Older version rows | Each older version can be played, opened in the full player, or long-pressed to select. | Free | IdeaDetailScreen/components/EvolutionThread.tsx |
| Collapse all | When any stack is open, one key folds them all. | Free | IdeaDetailScreen/components/SongClipListContent.tsx |
| Version of another take | Makes the selected takes the newest versions of a take you tap ("Tap the take it grew from"). | Free | IdeaDetailScreen/hooks/useSongParentPicking.ts |
| Join as versions | Stacks two or more selected takes into one take's versions. | Free | IdeaDetailScreen/hooks/useSongParentPicking.ts |
| Stand alone: Move out | Takes a version out of its stack to stand as its own take; later versions go with it. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Stand alone: Copy out | Copies a version out as its own take; the original stays in the stack. | Free | IdeaDetailScreen/components/SelectionBars.tsx |
| Undo version changes | Each version change shows an Undo bar ("Now a version", "Stands alone", "Joined as versions"). | Free | IdeaDetailScreen/hooks/useSongUndo.ts |
| Rename the other versions | Renaming one version offers to rename the others to match. | Free | src/domain/clipLineageRenamePrompt.ts |
| Primary can be an older version | The Primary mark shows on whichever version is primary, even when it is not the newest. | Free | IdeaDetailScreen/components/EvolutionThread.tsx |

---

## Search

| Feature | What it does | Status | Where |
|---|---|---|---|
| Search your library | One search across your own workspaces, from the field at the top of the side menu. | Free | SearchScreen/components/SearchScreenContent.tsx |
| What it looks inside | Sketches, clips, lyrics, chords, notes, clip notes, collections, workspaces and Lyric Pad pages. | Free | src/domain/search.ts |
| "Looks inside" landing | Before you type, the page lists what a search reaches. | Free | SearchScreen/components/SearchScreenContent.tsx |
| Grouped results | Results group by kind, each with where it lives and a highlighted snippet of the match. | Free | SearchScreen/components/SearchScreenContent.tsx |
| Match label | Each result says what matched: Title, Description, Notes, Clip title, Clip notes, Lyrics, Chords or Body. | Free | SearchScreen/components/SearchScreenContent.tsx |
| Match filters | Ink tabs with counts narrow results to one kind of match; only kinds with results appear. | Free | SearchScreen/hooks/useSearchScreenModel.ts |
| "Open in collection" | A sketch or clip result opens its collection, scrolled to the card and flashed. | Free | SearchScreen/hooks/useSearchScreenModel.ts |
| Open other results | A collection or workspace result opens that place; a Lyric Pad result opens that page. | Free | SearchScreen/hooks/useSearchScreenModel.ts |
| Result cap | Each group shows up to 30 results and says how many more a narrower search would find. | Free | SearchScreen/hooks/useSearchScreenModel.ts |
| Parcels left out | Search covers your own library; received parcels never appear in results. | Free | SearchScreen/hooks/useSearchScreenModel.ts |
| No matches state | "No matches. Try a shorter word or a lyric fragment." | Free | SearchScreen/components/SearchScreenContent.tsx |

---

## Shelf

| Feature | What it does | Status | Where |
|---|---|---|---|
| Shelf page | Lists ideas you set aside to come back to; they never leave their collections. | Free | ShelfScreen/index.tsx |
| Add to Shelf | Offered from a collection selection, Activity, Revisit and the player's menu. | Free | src/state/useShelfStore.ts |
| 7-day stay | Each idea stays 7 days; adding it again starts a fresh 7 days. | Free | src/domain/shelf.ts |
| Decision cards | In its last 48 hours an idea moves to the top with "Leaving shelf tomorrow" and Keep / Remove keys. | Free | ShelfScreen/components/ShelfDecisionCard.tsx |
| Keep 7 more days | Extends an idea's stay by a week. | Free | ShelfScreen/hooks/useShelfScreenModel.ts |
| Remove | Takes the idea off the Shelf; nothing is deleted. | Free | ShelfScreen/hooks/useShelfScreenModel.ts |
| Row menu (…) | Keep 7 more days, View in collection, Remove. | Free | ShelfScreen/index.tsx |
| Play and open from the Shelf | Cards preview and scrub in place; a clip opens the player, a sketch opens its page. | Free | ShelfScreen/hooks/useShelfScreenModel.ts |
| View in collection | The open glyph on a shelf card visits the idea's collection, focused on its card. | Free | ShelfScreen/components/ShelfItemCard.tsx |
| "Recently left the shelf" | The last five ideas that left are listed with Re-shelve ("Back for 7 days"). | Free | ShelfScreen/components/ShelfDepartedRow.tsx |
| Automatic leaving | An idea leaves by itself when its 7 days end, even if the app was closed. | Free | src/domain/shelf.ts |
| Side-menu count | The Shelf row in the side menu shows how many ideas are waiting on a keep-or-remove answer. | Free | SideNav.tsx |
| Shelf help | A "?" explains setting aside, the week's stay, and that nothing is deleted. | Free | ShelfScreen/index.tsx |
| Empty state | "Nothing set aside", with a "Browse ideas" link to your primary collection. | Free | ShelfScreen/index.tsx |

---

## Revisit

| Feature | What it does | Status | Where |
|---|---|---|---|
| Revisit page | Brings back a few older ideas each day, each with the reason it is there. | Free | RevisitScreen/index.tsx |
| Unfinished | Ideas you worked on, then left alone ("3 sessions", "Lyrics started", "Has notes"). | Free | src/domain/revisit.ts |
| Raw ideas | Ideas recorded once and never developed ("One take", "Raw capture"). | Free | src/domain/revisit.ts |
| Deep cuts | Older work shuffled back ("Untouched for 4 months"). | Free | src/domain/revisit.ts |
| Around this time | Ideas from this date in past years ("A year ago this week"). | Free | src/domain/revisit.ts |
| See snapshot | Opens a fuller seasonal page of work from around this point in past years. | Free | RevisitScreen/components/RevisitAroundSnapshotView.tsx |
| Snapshot to Activity | From the snapshot, a link opens that period in Activity. | Free | RevisitScreen/hooks/useRevisitScreenModel.ts |
| Play and open from Revisit | Cards preview and scrub in place; a clip opens the player, a sketch opens its page. | Free | RevisitScreen/hooks/useRevisitScreenModel.ts |
| View in collection | The open glyph visits the idea's collection, focused on its card. | Free | RevisitScreen/components/RevisitCandidateCard.tsx |
| Card menu: Add to Shelf | Sets the idea aside for 7 days. | Free | RevisitScreen/hooks/useRevisitScreenModel.ts |
| Card menu: Hide from Revisit | Stops an idea from resurfacing here; it stays in its collection. | Free | RevisitScreen/hooks/useRevisitScreenModel.ts |
| Customize: What to surface | Switches each of the four sections on or off. | Free | RevisitScreen/components/RevisitCustomizeSheet.tsx |
| Customize: New set each day | On: a fresh set every day. Off: today's set stays until your work changes. | Free | RevisitScreen/components/RevisitCustomizeSheet.tsx |
| Customize: Sources | Chooses which workspaces and collections Revisit draws from, with Reset. | Free | RevisitScreen/components/RevisitCustomizeSheet.tsx |
| Customize: Restore hidden (N) | Brings back every idea you hid from Revisit. | Free | RevisitScreen/components/RevisitCustomizeSheet.tsx |
| Parcels and folded items left out | Revisit never shows received parcels, hidden ideas or folded day groups. | Free | RevisitScreen/hooks/useRevisitScreenModel.ts |
| Empty state | "Too soon to revisit. Older ideas return here as newer work piles up." | Free | RevisitScreen/index.tsx |

---

## Activity

| Feature | What it does | Status | Where |
|---|---|---|---|
| Activity page | A year-long grid of days, coloured by how much you made or changed. | Free | ActivityScreen/ActivityHeatmapGrid.tsx |
| Previous / next year | Arrows step the grid through the years. | Free | ActivityScreen/ActivityHeatmapGrid.tsx |
| Today | One tap returns to the current year and today. | Free | ActivityScreen/ActivityHeatmapGrid.tsx |
| Tap a day | Lists the ideas created or updated that day. | Free | ActivityScreen/hooks/useActivityScreenModel.ts |
| Tap a month | Lists that whole month's ideas. | Free | ActivityScreen/hooks/useActivityScreenModel.ts |
| Tap two days for a range | The first tap picks a day, the second closes a span; everything between is listed. | Free | ActivityScreen/hooks/useActivityScreenModel.ts |
| Less / More key | A four-step colour key under the grid explains the shading. | Free | ActivityScreen/ActivityHeatmapGrid.tsx |
| Results list | Ideas in the chosen period, grouped by day, marked Created or Updated, with a floating day chip. | Free | ActivityScreen/ActivityRangeResults.tsx |
| Play and open from Activity | Cards preview and scrub in place; a clip opens the player, a sketch opens its page. | Free | ActivityScreen/hooks/useActivityScreenModel.ts |
| View in collection | The open glyph visits the idea's collection, focused on its card. | Free | ActivityScreen/components/ActivityResultCard.tsx |
| Card menu: Add to Shelf | Sets the idea aside for 7 days. | Free | ActivityScreen/hooks/useActivityScreenModel.ts |
| Customize: Sources | Chooses which workspaces and collections count, with Reset; the header says "2 of 3 workspaces". | Free | ActivityScreen/components/ActivityCustomizeSheet.tsx |
| Collection activity | "View activity" on a collection opens the same page for that collection alone. | Free | IdeaListScreen/components/CollectionHeaderMenu.tsx |
| Result cap | A heavy period shows the first 60 ideas and says how many more it holds. | Free | ActivityScreen/ActivityRangeResults.tsx |
| Empty period | "Nothing this month" or "Nothing this day", with a hint to tap a coloured day. | Free | ActivityScreen/ActivityRangeResults.tsx |

---

## View in collection (visits)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Visit a collection | From Search, Activity, Shelf, Revisit, a playlist or the queue: opens the idea's collection as a pushed page. | Free | src/navigation.ts |
| Focused card | The visit scrolls to the idea's card and flashes it. | Free | IdeaListScreen/sections/CollectionListSection.tsx |
| Clears what hides it | If a search, filter, hidden state or folded day would hide the card, the visit clears it. | Free | IdeaListScreen/sections/CollectionListSection.tsx |
| Back to where you came from | The back button is labelled with the page you came from and returns there intact. | Free | IdeaListScreen/sections/CollectionHeaderSection.tsx |
| Menu on a visited page | A visited collection keeps the menu glyph beside its "…". | Free | common/SideMenuButton.tsx |

---

## Recently deleted

| Feature | What it does | Status | Where |
|---|---|---|---|
| Recently deleted page | Lists everything deleted in the last 30 days, newest first, with its kind, days left and size. | Free | RecentlyDeletedScreen/index.tsx |
| Door in Settings | The page opens from Settings › Data & storage; it has no side-menu row. | Free | SettingsScreen/views/SettingsLibraryView.tsx |
| What it keeps | Clips, sketches, takes, collections, workspaces, parcels, setlists, chart books, playlists, Lyric Pad pages and sparks, whole. | Free | src/state/recentlyDeleted.ts |
| 30-day stay | Items wait 30 days, then are removed for good automatically at launch. | Free | src/state/recentlyDeleted.ts |
| Restore | Puts an item back where it was; if that place is gone, a toast says where it went. | Free | src/state/recentlyDeletedActions.ts |
| Delete permanently | Removes one item for good, after a confirm. | Free | RecentlyDeletedScreen/index.tsx |
| Empty | Deletes everything in the list for good and says how much space that frees. | Free | RecentlyDeletedScreen/index.tsx |
| Select several | Long-press a row to select; Restore or Delete permanently act on all selected. | Free | RecentlyDeletedScreen/index.tsx |
| Undo toast after a delete | Any delete shows "In Recently deleted" with Undo. | Free | common/deleteFeedback.ts |
| First-delete note | The first delete ever explains once where deleted things go and for how long. | Free | common/deleteFeedback.ts |
| Waits for big jobs | Nothing is deleted for good while a backup, restore or archive is running. | Free | RecentlyDeletedScreen/index.tsx |
| Empty state | "Nothing deleted. Deleted ideas wait here for 30 days, then go for good." | Free | RecentlyDeletedScreen/index.tsx |

---

## Playlists

| Feature | What it does | Status | Where |
|---|---|---|---|
| Playlists tab | Inside Compilations: your playlists as rows with item count and last update. | Free | LibraryScreen/views/PlaylistListView.tsx |
| New playlist | The + makes a playlist; left blank it is named "Playlist N". | Free | LibraryScreen/hooks/useLibraryScreenModel.ts |
| Any workspace | A playlist can hold clips, sketches and single takes from any workspace. | Free | LibraryScreen/hooks/useLibraryScreenModel.ts |
| Search playlists | Filters playlists by name or by the ideas inside them. | Free | LibraryScreen/components/LibraryScreenContent.tsx |
| Show: All / Mine / Received | Narrows the list to playlists you made or ones that were sent to you. | Free | LibraryScreen/components/CompilationListControls.tsx |
| Sort by: Updated / Name / Created | Orders the playlists list. | Free | LibraryScreen/components/CompilationListControls.tsx |
| Received mark | A playlist that arrived from someone wears a chip saying who sent it. | Free | common/ProvenanceChip.tsx |
| Playlist page | Shows the name, item count, total length and last update over the numbered items. | Free | LibraryScreen/views/PlaylistDetailView.tsx |
| Play playlist | The round button plays from the top, or pauses and resumes when it is the one playing. | Free | LibraryScreen/views/PlaylistDetailView.tsx |
| Play from an item | Tapping an item starts the playlist from there. | Free | LibraryScreen/views/PlaylistDetailView.tsx |
| Shuffle | Starts the playlist shuffled, or flips shuffle on the one already playing. | Free | LibraryScreen/hooks/useLibraryScreenModel.ts |
| Now-playing mark | The playing item shows moving bars in place of its number. | Free | LibraryScreen/views/PlaylistDetailView.tsx |
| Add items | Turns your library into a picker: browse collections, tap cards to pick, then "Add N". | Free | src/hooks/useLibraryCollectorHandlers.ts |
| Picker basket across collections | Picks add up as you move between collections; All and Clear act on the current page. | Free | IdeaListScreen/sections/CollectionFilterSection.tsx |
| Preview while picking | Card play buttons still preview, so you can listen before adding. | Free | IdeaListScreen/components/IdeaListItem.tsx |
| Pick from another workspace | While picking, the hub's title becomes a switcher to another workspace or a received parcel. | Free | common/WorkspacePickSheet.tsx |
| Edit playlist | The pencil turns on drag handles to reorder and − buttons to remove items. | Free | LibraryScreen/views/PlaylistDetailView.tsx |
| View in collection | Each item's open glyph visits its collection, focused on its card. | Free | LibraryScreen/views/PlaylistDetailView.tsx |
| Unavailable items | An item whose audio is gone shows greyed as "Unavailable" and is skipped in playback. | Free | LibraryScreen/views/PlaylistDetailView.tsx |
| Rename playlist | From the playlist's "…". | Free | LibraryScreen/hooks/useLibraryScreenModel.ts |
| Share playlist: Export | Saves the playlist with its audio as one SongNook file. | Free | LibraryScreen/hooks/useLibraryScreenModel.ts |
| Share playlist: SongNook Send | Makes a 7-day link to the playlist. | Free up to 3 links per 30 days, then Pro | LibraryScreen/hooks/useLibraryScreenModel.ts |
| Delete playlist | Moves the playlist to Recently deleted; its songs and clips stay in your library. | Free | LibraryScreen/hooks/useLibraryScreenModel.ts |
| "Add to…" chooser | From a selection of ideas or takes: pick an existing playlist or make a new one. | Free | common/PlaylistChooserSheet.tsx |
| Added toast | After adding, a toast says "Added to …" with "Open playlist". | Free | common/PlaylistChooserSheet.tsx |
| Keep the queue as a playlist | The queue panel's "Playlist" key saves what is queued as a playlist. | Free | QueuePanel.tsx |
| Deleted ideas drop out | Deleting an idea removes it from playlists; restoring it puts it back. | Free | src/state/recentlyDeleted.ts |
| Empty states | "Nothing to listen to yet" (no playlists) and "No items yet" (empty playlist), each with one action. | Free | LibraryScreen/views/PlaylistListView.tsx |

---

## Side menu and getting around

| Feature | What it does | Status | Where |
|---|---|---|---|
| Side menu | Opens from the menu glyph or an edge swipe on top-level pages. | Free | SideNav.tsx |
| Search field | The field at the top of the menu opens Search. | Free | SideNav.tsx |
| Workspace card | Shows the current workspace's mark and name. | Free | SideNav.tsx |
| Switch workspace | The glyph on the workspace card opens "Your workspaces". | Free | SideNav.tsx |
| Collections · N | Opens the current workspace's hub; the label carries the collection count. | Free | SideNav.tsx |
| Recent | The two collections you opened last in this workspace, one tap away; the open one is ticked. | Free | App.tsx |
| Compilations | Opens Playlists, Charts and Setlists. | Free | SideNav.tsx |
| Received | Appears once something has arrived; shows a count of parcels not opened yet. | Free | SideNav.tsx |
| Lyric Pad, Shelf, Revisit, Activity | One row each to those places. | Free | SideNav.tsx |
| Tool tray | Lyric Spark, Tuner and Metronome sit together above Settings. | Free | SideNav.tsx |
| Settings | Always opens Settings at its first page. | Free | App.tsx |
| Current place is marked | The row for the page you are on shows as active. | Free | App.tsx |
| Menu on opened pages | A sketch, a visited collection or a pushed Activity page opens the same menu from a glyph by "…". | Free | common/SideMenuButton.tsx |
| Open to (startup) | Settings › Preferences chooses whether the app opens to the Primary workspace or the Last used one. | Free | SettingsScreen/views/SettingsGeneralView.tsx |
| Opens in your primary collection | At launch the app lands in the startup workspace's primary collection, or its hub if none is set. | Free | App.tsx |
| After a crash | The app reopens somewhere other than the workspace that was open when it crashed. | Free | src/domain/libraryNavigation.ts |
| Parcels and archives are never "home" | A received parcel or an archive is visited, never made the working workspace or startup page. | Free | src/domain/workspaceVisibility.ts |
| Back closes selection first | On Android, back ends a selection or a picker before it leaves the page. | Free, Android | src/hooks/useBrowseRootBackHandler.ts |

---

## Built but not reachable

- **Archive a workspace (new archives).** The "Archive" row was removed from the workspace menu on 2026-08-04 ("shelved until the persistence plumbing is re-tested", comment in `WorkspaceListScreen/hooks/useWorkspaceListScreenModel.ts`). Only workspaces that were already archived show Unarchive and Move package to Files. So for anyone who installed after that date, **Unarchive and the Pro feature "Move package to Files" cannot be reached at all** (a restored backup or imported archive that contains an archived workspace is the only way in).
- **Bulk archive / unarchive / delete of several workspaces.** The code is in `useWorkspaceArchiveActions.ts` (`confirmArchiveSelection`, `confirmDeleteSelection`) but the workspace list has no multi-select; it is always passed an empty selection.
- **"New Collection from Import"** on the workspace hub (`useWorkspaceCollectionImportFlow.ts`, `openCollectionImportFlow`): nothing calls it. The hub's + only makes an empty collection.
- **Lyrics filter (With / Without)** on the collection page: the state and the filtering exist (`useCollectionScreenModel.ts`), the strings exist, but the filter menu draws no control for it.
- **Activity-range slice of a collection** (a banner "Activity range" with a ✕ on the collection page, `IdeaListHeaderSection.tsx`): the page supports it, but nothing opens a collection with a range any more.
- **Activity "Created only / Updated only" filter**: fixed to "both" in `useActivityScreenModel.ts`.
- **Workspace hub sort (Title A–Z, Z–A, Least recent, Last worked)**: strings remain (`workspaceBrowse.sort*`); the hub has no sort control.
- **A clip's own page** (the sketch page showing a single clip, with "Edit clip", "Make sketch" and "Delete clip" in its menu, and inline title editing): every normal path opens a clip in the full player instead. It is reached only as a fallback when an idea has no collection, which should not happen. "Make sketch" for a clip is reachable from the player's menu and from a collection selection.
- **Inline take editing and the "Primary" button on take cards in edit mode** (`ClipCardEditForm`, `ClipCardPrimaryIndicator`): sketches now edit through a sheet that covers the list, so these cannot be tapped.
- **Dev-only rows** in the collection "…" (Import samples, Import as sketch, Receive samples, Store library, Pro sheet): development builds only.
- **`ProGate` component** (`common/ProGate.tsx`): nothing uses it.

---

## Worth a decision

1. **The Pro "archive offload" feature has no front door.** `archive-offload` is on the Pro list, but new archives cannot be made (see above). Either bring Archive back, or drop the line from the Pro promise. Status left as Pro.
2. **Ways past the 3-workspace limit.** The limit is checked only on the + button. Keeping a received parcel "as its own workspace", importing a SongNook archive (adds workspaces), restoring a backup, and unarchiving all add workspaces without a check. Also, archived workspaces do not count, so if Archive returns, a free user could archive to make room. Probably fine (receiving and restore must stay free), but worth a yes.
3. **Export for DAW is free.** A bar-aligned WAV with the tempo in its name, offered from a clip or take's Share menu. It is a power feature with no gate.
4. **Export of whole places is free** (workspace, collection, sketch, selection, playlist as SongNook files). Consistent with "export is never locked", and it is also a free way to send without using Send links. Stated for completeness.
5. **Nested collections, collection copy/move across workspaces, take groups, versions (Version of another take, Join, Stand alone), custom tags** are all free. These are the organising power tools; none is gated.
6. **Shelf, Revisit, Activity and library-wide Search are all free.** Revisit's Customize (sources, daily refresh) and Activity's range and source filters are the richest parts if a Pro line were ever wanted here.
7. **Playlists are free with no limit**, while creating a chart book or setlist is Pro (`stage-tools`). The three sit side by side in Compilations.
8. **Import (Files and Videos, as clips or as one sketch) is free with no limit.** Video-to-audio import is the costly one to build.
9. **Free users with more than 3 workspaces** (made during the free month) keep and use all of them; only making another is stopped. This matches "gates only stop creating", flagged so it is a known outcome.
10. **Recently deleted keeps things 30 days, not 14.** The brief said 14; the code and every string say 30 (`RECENTLY_DELETED_DAYS = 30`; files are held 31 days). CLAUDE.md's Data law still says "14-day trash". One of them should be corrected.

No gate, limit or lock badge was found in this area beyond `workspaces`, `archive-offload` and `send`.

---

## Not sure

- **Where exactly the app lands at startup when "Open to: Primary workspace" is set but that workspace has no primary collection.** Read `App.tsx` (`buildStartupNavigationState`, lines ~817–850): it appears to open the workspace hub. Not run on a device.
- **"Back closes selection first" on iPhone.** `useBrowseRootBackHandler` is a hardware-back handler, so I marked it Android; I did not check whether the iOS edge swipe is also intercepted.
- **Compact view resetting.** It is plain screen state (`useState` in `useCollectionScreenModel.ts`), so it should reset when the collection page is left and reopened; a collection kept alive under another page would keep it. Not run.
- **Import details** (formats refused, AIFF on Android, video kinds) were only skimmed here; they sit in `src/services/audioStorage.ts` and likely belong to the recording/import agent's list.
- **The "Recent" list count.** `App.tsx` asks for 2 recent collections; I did not check whether sub-collections can appear there (the helper returns a "level" and a path label, which suggests they can).
- **Received parcel rows on the collection page** ("Keep…" link under the title, "Delete package" in the "…") exist in my files but belong to the Received agent; I left them out of the tables to avoid double counting.
- **Whether "Share audio" for a layered take sends the mix or the bare take**: not checked (`src/services/audioStorage.ts shareAudioClips`).
