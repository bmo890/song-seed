# 12a — Screen sweep: the full player, its sheet, the dock and the queue

Sweep A, 2026-11-02. Read-only on the repo. Scope: `src/components/PlayerScreen/**`, `PlayerSheet.tsx`,
`GlobalMediaDock.tsx`, `QueuePanel.tsx`, and the gesture handlers in `src/components/visualizers/**`.
Every action was followed into `src/state`, `src/services` and `src/domain`.

How it was checked:
- I read the code.
- Three store paths were run in a throwaway Jest probe against the real `useStore` and `appActions`
  (`src/__audit_scratch_A__/`, now deleted). Probe output is quoted where it is used.
- Nothing was walked on a device or in the simulator.

Findings already reported in 01–08 are not repeated. The inventory rows point at them, for example "see 04-H5".

Severity scale (same as 04):
- **CRITICAL**: realistic silent loss.
- **HIGH**: loss after a plausible slip, the wrong item changed, or loss behind a misleading confirmation.
- **MEDIUM** and **LOW** as usual.

---

## Findings

### HIGH

#### A-H1. "Make sketch" from the player, on a clip outside the active workspace, can only end by deleting the clip
**Confidence: verified (store probe) plus reading the sketch page.**

**Where:**
- The player's grow paths all call `handleMakeSketch`:
  - the overflow row `songDetail.makeSong`
  - the first-clip Sketch door
  - the clip's Lyrics and Chart slots ("Lyrics and charts live in a sketch…" → Make sketch)
- `handleMakeSketch` (`usePlayerScreenLifecycle.ts:454-468`) runs `appActions.convertClipIdeaToProject(ideaId)`.
- `convertClipIdeaToProject` (`actions.ts:2382+`) knows the player can hold clips from anywhere. It patches the idea's **own** workspace into a draft: `isDraft: true, draftFromClipIdea: true`.
- It then opens the sketch page in edit mode. The two exits there are not workspace-aware:
  - **Save** (`useSongEditFlow.ts:64`) calls `state.updateIdeas(...)` with no `workspaceId`, so it writes to the active workspace only. The draft is never cleared (04-H2 class).
  - **Discard** (`useSongEditFlow.ts:139`) calls `appActions.deleteSelectedIdea(true)`. That looks the idea up in the active workspace only:

```ts
// actions.ts:2150-2169
const activeWs = state.workspaces.find(w => w.id === state.activeWorkspaceId);
const selectedIdea = activeWs?.ideas.find(i => i.id === state.selectedIdeaId);
if (selectedIdea?.isDraft && selectedIdea.draftFromClipIdea) { /* revert to the clip */ }
else if (selectedIdea?.isDraft && selectedIdea.clips.length > 0) { /* dissolve */ }
else {
    state.deleteIdea(state.selectedIdeaId);   // ← reached when the idea is in another workspace
}
```

- `deleteIdea` removes the idea from whichever workspace holds it, then trashes its audio once the change is durable.

**Probe:**
- Two workspaces; A is active; clip `bandClip` lives in B.
- `convertClipIdeaToProject("bandClip")` gives `{kind:"project", isDraft:true}`.
- The Save path (`updateIdeas` without `workspaceId`) leaves `{"title":"bandClip","isDraft":true}`.
- `setSelectedIdeaId` followed by `deleteSelectedIdea(true)` gives `after discard: null`. The clip idea is gone.

**Steps:**
1. Play something the player holds without switching the active workspace. Examples:
   - a clip in a **received parcel** (received packages are never made active, 04-H2)
   - a **playlist or setlist** in Compilations that holds clips from another workspace. `useLibraryScreenModel.ts:111` and `useSetlistModel.ts:114` start the queue without `setActiveWorkspaceId`.
2. Full player → "…" → Make sketch, or tap the Sketch door or a Lyrics/Chart slot. The sketch page opens on the naming sheet.
3. Either path ends the same way:
   - Tap **Cancel**: "Discard this sketch? / Nothing has been saved yet." → **Discard**.
   - Tap **Save**: nothing changes, the idea is still a draft. Every back, swipe or Android back then raises the same Discard dialog (`beforeRemove` guard, `useSongEditFlow.ts:154`). There is no way off the page except Discard or killing the app.

**Effect:**
- The original clip is deleted (title, notes, marks, layers, tags) and its audio goes to the unreachable trash (04-H6).
- The dialog says nothing was saved, so the person believes they are only dropping the sketch frame.
- Until then, the converted draft is also hidden from its collection.

**Fix:**
- In `deleteSelectedIdea`, resolve the idea across workspaces (`ideaWorkspaceId`) before choosing the branch, and never fall through to `deleteIdea` for an idea whose `isDraft` is true.
- Pass `workspaceId: ideaWorkspaceId(...)` in `useSongEditFlow.handleSave`.
- Until both are fixed, hide the grow paths in the player when the idea isn't in the active workspace.

#### A-H2. The Notes page saves into whichever clip is playing when you press Save, not the one you were writing about
**Confidence: verified by reading.**

**Where:**
- The draft is local to the doors section and seeded once, when the sheet opens:

```ts
// PlayerSupportSections.tsx:71-79
const [notesDraft, setNotesDraft] = useState(clipNotes);
const openNotes = useCallback(() => { setNotesDraft(clipNotes); onToggleNotesExpanded(true); }, ...);
const saveNotes = useCallback(() => {
  if (notesDraft !== clipNotes) onSaveNotes(notesDraft);   // clipNotes = the clip on screen NOW
  onToggleNotesExpanded(false);
}, ...);
```

- `onSaveNotes` is `saveClipNotes` (`PlayerScreen/index.tsx:369-386`). It writes `notes` onto `notesIdeaId`/`notesClipId`, which are the ids of the **current render's** clip.
- `notesExpanded` lives in `usePlayerScreenUi` and is never reset when the clip changes.
- When a clip finishes, the lifecycle advances the queue while the sheet is up (`usePlayerScreenLifecycle.ts:358-360`, `advancePlayerQueue("next", true)`). The full player stays `isActive` underneath the notes sheet.

**Steps:**
1. Play a playlist, setlist or collection queue in the full player.
2. Tap the Notes page and start writing about the clip that's playing. A 20–40 s sketch ends long before the note does.
3. The clip ends, and the next clip loads and plays under the sheet.
4. Tap Save. A swipe-down saves too, because ClipNotesSheet keeps edits on dismiss.

**Effect:**
- The text is written over the **next** clip's notes, and its earlier note is lost silently. The new text is saved there in full.
- The clip the person was writing about gets nothing.
- There is no undo, and no toast that says where the note went.

**Fix:**
- Capture `{ideaId, clipId}` in `openNotes` and save to those ids.
- Optionally close the sheet, or show the clip's name in it, when the queue moves.

#### A-H3. The lyric writer keeps its own copy of the words while docked and writes it back over later edits
**Confidence: verified by reading. The store effect was checked in the probe.**

**Where:**
- `PlayerLyricsWriter.tsx:31` seeds `useState(initialText)` once per mount, and every keystroke saves the whole local text: `saveProjectLyrics(ideaId, text)` on a 700 ms debounce, on blur and on unmount.
- The writer is keyed on `ui.writingSession` (`index.tsx:1978`). That only changes through `openWriting` or the new-version button.
- The player sheet is **pre-mounted and kept** while docked (`PlayerSheet.tsx:33-43`), so the writer, its `text` state and `lyricsWriting` all survive a collapse:
  - a header or footer drag
  - a scrim tap
  - Android back (`index.tsx:1129-1136`)
  - the chevron
- Expanding from the dock re-renders with the new `initialText`, but `useState` ignores it.
- Only re-entering through the sketch's "write with the tape" (`playerOpenIntent`) bumps the session.

**Steps:**
1. Sketch → Lyrics → write with the tape. Type, then collapse the player (swipe down or tap above the card). You land back on the sketch.
2. Fix lines in the sketch's lyric editor, or add a chorus, and Save. That edits the latest version in place, or makes a new version.
3. Tap the dock to expand the player. The writer still shows the old words. Type one character.

**Effect:**
- The debounce saves the writer's stale text plus the character into the **latest** version (`saveProjectLyrics` replaces the latest version's document in place, `actions.ts:1909-1946`).
- The editor's changes are gone. If they were saved as a new version, that new version is overwritten instead.
- Chords anchored to changed lines are re-anchored or lost.
- Probe:
  - The lyrics were saved as "line one / line two", then edited elsewhere to "line one / line TWO fixed / chorus".
  - The writer's flush of its seed plus "!" left `versions: 1 ["line one","line two!"]`.
  - The fix and the chorus are gone, and no new version was kept.

**Related (already reported):** 04-M2 covers the same stale-state class when the writer moves across sketches (Next or auto-advance).

**Fix:**
- Choose one:
  - bump the writing session (reseed) whenever the sheet expands, or when `latestLyricsVersion.updatedAt` moves past the writer's last own save while it is not dirty
  - or close the writer when the sheet docks
- At minimum, compare against the version's `updatedAt` before a flush and refuse to write a seed older than the stored text.

### MEDIUM

#### A-M1. "Layer" on a clip outside the active workspace records a plain take that never becomes a layer
**Confidence: verified by reading.**

**Where:**
- `handleAddOverdub` (`index.tsx:1272-1313`) calls `appActions.startClipOverdubRecording`, which is workspace-agnostic (`findWorkspaceIdeaClip`). It sets `recordingIdeaId` and `recordingOverdubClipId`.
- The recorder then resolves both from the **active** workspace only:

```ts
// useRecordingScreenModel.ts:161-171
const recordingIdea = useMemo(() => workspaces.find((w) => w.id === activeWorkspaceId)?.ideas.find((i) => i.id === recordingIdeaId), ...);
const recordingOverdubClip = useMemo(() => recordingOverdubClipId && recordingIdea ? ... : null, ...);
```

- So the recorder treats the take as a normal one.
- On save, the non-overdub branch finds no `targetIdea` in the active workspace and returns `false` (`:437-445`).
- The take is kept for launch recovery with a dialog (the "handled" path noted under 04-H2). It never lands as the layer, and the punch-in point is lost.

**Steps:**
1. Play a clip from a received parcel, or a playlist or setlist holding clips from another workspace.
2. Tap Layer, record a harmony, and save.

**Effect:**
- No layer appears on the clip.
- The audio survives only as a recovered loose clip, without its offset.

**Fix:** resolve `recordingIdea` with `ideaWorkspaceId`, as `attachRecordedOverdubStem` already does. This is the recorder-side half of 04-H2. Until then, hide Layer for such clips.

#### A-M2. Back to a minimised take from the red dock: a stale save token pauses the take and opens the save sheet
**Confidence: plausible (reading). The consumer lives in the recorder.**

**Where:**
- The dock's stop key bumps a store counter: `requestRecordingSave()` (`GlobalMediaDock.tsx:349-356`, `recordingSlice.ts:50-54`). The counter is never reset or consumed.
- The recorder starts from `handledSaveRequestRef = useRef<number | null>(null)` (`useRecordingScreenModel.ts:294`). It acts on any non-zero token at mount:

```ts
// useRecordingScreenModel.ts:1739-1744
if (recordingSaveRequestToken === handledSaveRequestRef.current) return;
handledSaveRequestRef.current = recordingSaveRequestToken;
if (!recordingSaveRequestToken) return;
void requestSaveRecording();   // pauses the take, opens the naming sheet
```

- Minimising pops the recorder screen (`minimizeRecording`, `:2699`). A return mounts a new screen.

**Steps:**
1. Earlier in the session, stop a minimised take from the dock's square once. The token is now 1.
2. Later, record a new take, minimise it, then tap the red dock pill to go back to the recorder.

**Effect:**
- The take is paused on arrival and the naming sheet is up.
- If the person doesn't notice, playing on records nothing, and the naming sheet's Discard is one tap away.

**Fix:** consume the request in the store (a `consumeRecordingSaveRequest()` that zeroes it), or seed `handledSaveRequestRef` with the token present at mount unless the dock asked for a save in the same navigation.

### LOW

- **A-L1. Stale engine duration written onto a clip with no stored duration (first-frame rule).**
  - Where: `usePlayerScreenLifecycle.ts:239-245`.
  - The effect writes `durationMs: playerDuration` as soon as `playerClip.durationMs` is falsy. On a queue step, `playerDuration` is still the **previous** clip's: the engine hasn't loaded the new file yet. `usePlayerScreenData.ts:91-94` says so and gates its own use with `engineHoldsThisClip`; this effect doesn't.
  - Trigger: freshly imported clips before backfill.
  - Effect:
    - The wrong length shows on the card and is persisted.
    - It is used by `clampClipOverdubStemOffsetMs` and `snapPunchInMsToGrid` when a layer is recorded or nudged, so a punch-in past the wrong length is clamped.
    - It is usually corrected when the waveform decode lands. Android defers that until playback pauses, and a failed decode leaves it.
  - Fix: require `currentPlaybackSourceUri === playbackAudioUri`.
- **A-L2. Mark editors don't follow the clip when the queue moves.**
  - Pin editor from the reel (`index.tsx:2193-2211`):
    - It holds `pinActionsTarget` from clip A.
    - After an auto-advance, Save runs `handleEditPin(A-pin-id)` against clip B. The edit is lost. If B had no stored pins, B's lyric-heading fallback pins are also saved as real pins.
    - Delete does nothing.
  - Section editor (`PlayerPracticeDrawers.tsx:1144-1170`): the same pattern.
  - The pin-naming modal shown right after "+ Pin" closes by itself (namingPin becomes null), and the typed name is lost.
  - Fix: capture the ids at open; close the editors on a clip change.
- **A-L3. Merge layers.**
  1. The name modal's Save calls `runMerge` with no in-flight guard (`PlayerLayersBench.tsx:205-214, 471-477`). A double tap during the modal's fade would run `mergeClipOverdubStems` twice. The second run finds none of the picked ids and appends its merged layer (`if (!placed) stems.push(merged)`), so the merge is doubled. Speculative.
  2. `buildMergeLayerInputs` ignores `isMuted`. A muted picked layer becomes audible in the merged layer, and its own file is trashed. So "the take sounds the same" does not hold.
  - Fix: guard on `merging`; skip or warn on muted picks.
- **A-L4. "Reset all" also resets the take's saved level and tone.**
  - It shows in both the Loop and the Sound drawers (`index.tsx:1542-1562`), with no confirm and no undo.
  - It persists `adjustClipOverdubRootGain(-gain)` and toggles off every tone flag. From the Loop drawer the person expects only the loop to reset.
  - Fix: limit it to session tools, or name what it touches.
- **A-L5. The writer and the Notes sheet have no background flush or draft store.**
  - The writer loses up to 700 ms of typing if iOS suspends and then evicts the app before the debounce fires.
  - The Notes sheet loses everything typed if the app is killed with it open.
  - Smaller cousins of 04-H3.
- **A-L6. Clips outside the active workspace never get their waveform or duration stored from the player.**
  - `hydrateClipAudioMetadata(activeWorkspaceId, …)` (`usePlayerScreenLifecycle.ts:242, 305, 311`) only writes the active workspace.
  - Received or cross-workspace clips are re-decoded on every open. Efficiency, and a missing duration that A-L1 then fills wrongly once the workspace becomes active.
- **A-L7. The "Keep" switch writes live values 700 ms after they settle** (`index.tsx:1524-1531`).
  - After a clip switch, if the engine reports a rate other than the kept one for longer than that, the stored kept speed is overwritten.
  - `useFullPlayer.ts:266` prefers `status.playbackRate` over the requested rate. Speculative.
- **A-L8. Overflow and sheet rows can fire twice during their close animation.**
  - Applies to "Combine as new clip", the section picker presets and the Layer key.
  - The result: two flattened copies, two sections (undoable), or two recorder screens (RN7 `navigate`).
  - "Combine and edit" also leaves the flattened copy behind when the editor is abandoned.
  - Speculative.
- **A-L9. Lyric-heading fallback pins can't be deleted.**
  - `usePlayerScreenData.ts:116-129` draws `heading-N` pins from the lyrics when the clip has none.
  - Delete calls `removeClipPracticeMarker` on a list that doesn't hold them, so nothing changes. No data loss, only a confusing no-op.

---

## Interaction inventory

Abbreviations:
- **P** = `PlayerScreen/index.tsx`
- **L** = `usePlayerScreenLifecycle.ts`
- **B** = `PlayerLayersBench.tsx`
- **D** = `PlayerPracticeDrawers.tsx`
- **Q** = `QueuePanel.tsx`
- **G** = `GlobalMediaDock.tsx`
- **S** = `PlayerSheet.tsx`
- **act** = `state/actions.ts`
- **ds** = `state/dataSlice.ts`

"Session" means UI or transport state that is never persisted.

### Player sheet shell

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 1 | Sheet › scrim above the card (tap) | `goBack` → animates down, `setPlayerScreenMounted(false)` (S:111-130). The writer stays mounted | n/a | OK / A-H3 |
| 2 | Header drag-down (header, footer and body regions) | `minimizePlayer` → `popPlayerScreen` (P:1175-1226, L:434) | springs back under the threshold | OK / A-H3 |
| 3 | Android hardware back | `minimizePlayer` (P:1129-1136). Open Modals take back first | n/a | OK / A-H3 |
| 4 | Header › close chevron | `minimizePlayer` | n/a | OK |
| 5 | Header › title / time readout | display only | — | OK |

### Overflow "…" menu (L:470-748, `AppAlert.menu`)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 6 | Combine as new clip (layered take) | pause → `saveCombinedClipAsNewClip(copy)` (act:1663) imports the mix as a new clip or idea → `goBack` | `AppAlert.error` with message + error haptic | OK; double-fire A-L8 |
| 7 | Combine and edit | the same copy, then navigates to Editor with the new ids | error alert; throws `combinedOpenFailed` if the copy can't be found | OK; leftover copy A-L8 |
| 8 | Trim audio (plain take) | pause → Editor | — | OK; outside the active workspace see 04-H2 (editor drops the edit) |
| 9 | Make sketch (standalone clip) | `convertClipIdeaToProject` → draft, `openSketchPage` (L:454-468) | returns false if already a sketch | **A-H1** (outside the active workspace); Discard-loses-versions see 03-#4 |
| 10 | Add to Shelf | `useShelfStore.setAside` + toast | — | OK |
| 11 | Shelf toast › View shelf | minimize + `openShelf` | — | OK |
| 12 | Share | opens the share menu, or shares directly when there is one exit | — | OK |
| 13 | Share › Audio | `shareAudioFile(playbackUri)` | error alert + haptic | OK |
| 14 | Share › Export for DAW | `exportClipForDaw` | error alert + haptic | OK |
| 15 | Share › SongNook Send | `openSendSheet` built from the current store idea (takes / card / clips) | the Send sheet's own handling (06) | OK |
| 16 | Delete clip | destructive confirm → pause → `deleteIdea` (only take) or `deleteClipFromIdea` → `stopSessionAndClose` | flush, then trash | see **04-H5**, **04-L3** (copy), **04-H6** (trash). Works across workspaces |
| 17 | Delete confirm › Cancel / scrim / back | nothing | — | OK |
| 18 | Menu dismiss (scrim / grabber) | nothing | — | OK |

### Reel toolbar (listening)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 19 | Marks key | session (`markersVisible`) | — | OK |
| 20 | Layer key | pause → `startClipOverdubRecording` (act:1326) → Recording | `AppAlert.info` "layer unavailable" | **A-M1**; double tap A-L8 |
| 21 | Layer limit alert › Combine | combine chooser (#39-40) | — | OK |
| 22 | Layer limit alert › Cancel | nothing | — | OK |
| 23 | Pro upsell (2nd+ layer) | nothing | — | OK |
| 24 | Tools key | session mode | — | OK |

### Reel (`PlayerTimeline`, `PlaybackTapeVisualizer`, `PracticePinBadges`, `MinimapVisualizer`)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 25 | Tape pan / tap / pinch | seek / zoom only (onSeek, onScrubStateChange, pinch) | — | OK |
| 26 | Pin hold (no move) | opens the pin editor (#118) | — | OK |
| 27 | Pin hold + drag | `handleRepositionMarker` → `setClipPracticeMarkers` (undoable, ds:2323, any workspace). Fallback heading pins become real pins | — | OK |
| 28 | Pin badge tap / long-press-drag (classic) | seek; reposition if moved over 200 ms, else actions | — | OK |
| 29 | Section band tap | seek | — | OK |
| 30 | Section band hold + drag (Tools) | `moveSection` → `setClipSections` (undoable) | — | OK |
| 31 | Loop handles / move (Tools, writing) | session loop range | — | OK |
| 32 | Minimap pan / tap | seek | — | OK |
| 33 | Lane tap | opens that layer's sheet | — | OK |
| 34 | Lane Solo switch | session; renders scratch solo mix (`soloMix.ts`) | haptic error, solo cleared without a message | OK (UX only) |
| 35 | Lane Mute | `toggleClipOverdubStemMute` → persist + mix re-render | `AppAlert.error` | OK |
| 36 | Lanes collapse header | layer prefs | — | OK |
| 37 | Lanes foot › Merge | opens the merge picker | — | OK |
| 38 | Lanes foot › Combine | combine chooser | — | OK |

### Combine chooser (`openCombineChooser`, B:47-64)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 39 | New clip | `saveCombinedClipAsNewClip(copy)` → `goBack` | `AppAlert.error` | OK |
| 40 | Replace take | `saveCombinedClipAsNewClip(replace)`; the replaced take's files are trashed via `mediaCleanup` | `AppAlert.error` | see **04-L4** / **04-M5** (lone clip re-dated and re-titled) |
| 41 | Cancel / scrim | nothing | — | OK |

### Layer sheet (`PlayerLayersBench`)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 42 | Play / Pause key | main transport seek + play | caught | OK |
| 43 | Solo key | session | — | OK |
| 44 | Alignment strip slide | `nudgeClipOverdubStem` (delta, beat snap) | `AppAlert.error` | OK |
| 45 | Strip zoom toggle | view | — | OK |
| 46 | Nudge keys ×4 | `nudgeClipOverdubStem` (store-read delta) | error alert | OK |
| 47 | Original | nudges back to `recordedOffsetMs` | error alert | OK |
| 48 | Level knob / tone flags | `adjustClipOverdubStemGain` / `toggleClipOverdubStemToneFlag` | error alert | OK |
| 49 | Help | HelpSheet | — | OK |
| 50 | "…" | layer menu | — | OK |
| 51 | › Rename → name modal Save | `renameClipOverdubStem` (title only) | error alert | OK |
| 52 | Rename modal Cancel / back | discards the draft name | — | OK |
| 53 | › Remove → confirm "Its audio is deleted." | `removeClipOverdubStem`; trashes the file only if unreferenced and after a flush | error alert; after a queue advance the error names the wrong clip (A-L2 class) | OK (honest copy, no undo; 04-H6 class) |
| 54 | Remove confirm › Cancel | nothing | — | OK |
| 55 | Sheet swipe / scrim | closes | — | OK |

### Merge picker (B:448-478)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 56 | Layer ink options | session picks | — | OK |
| 57 | Cancel | clears picks | disabled while merging | OK |
| 58 | Merge N | opens the name modal | disabled when fewer than 2 are picked | OK |
| 59 | Name modal Save | `mergeClipOverdubStems` (act:1573): render, import, swap stems, flush, trash the old files | `AppAlert.error` | **A-L3** |
| 60 | Name modal Cancel / back | nothing | — | OK |
| 61 | Picker dismiss | blocked while merging | — | OK |

### Reading and writing bar

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 62 | Close (chevron + "Lyrics/Chart") | `closeReading`; the writer unmounts and flushes | — | OK |
| 63 | Compact Marks toggle | session | — | OK |
| 64 | Writing › Loop chip | session loop (Pro guard) | — | OK |
| 65 | Writing › Loop what | alert: sections (first 5) / whole take | — | OK |
| 66 | Writing › New version | alert | — | OK |
| 67 | › From current | `saveProjectLyricsAsNewVersion(latestLyricsText)` + reseed | — | OK |
| 68 | › Blank | new empty version + reseed (a pending flush could land in it; needs typing within 700 ms of the tap) | — | OK (speculative LOW) |
| 69 | › Cancel / scrim | nothing | — | OK |
| 70 | Writing › Play / Pause | transport | — | OK |
| 71 | Writer text input | `saveProjectLyrics` (latest version, own workspace) on a 700 ms debounce, on blur and on unmount | none needed | **A-H3**; **04-M2**; A-L5 |
| 72 | Reading › Follow chip | session | — | OK |
| 73 | Follow speed presets | `handleSpeedTap` (session) | — | OK |
| 74 | Aa → ReadingSheet (size, key, capo, chords) | chart prefs per idea (display only) | — | OK |
| 75 | Pencil (lyrics) | `openWriting` (bumps the session, so it reseeds) | — | OK |
| 76 | Pencil (chart) | minimize + chart editor | — | OK |
| 77 | Full view toggle | session | — | OK |
| 78 | Take's / latest words row | session flip | — | OK |
| 79 | Full view thread drag / tap | seek | — | OK |
| 80 | Reader scroll / resync / follow −/+ | view and session | — | OK |

### Listening page doors (`PlayerArtifactDoors`, `PlayerSupportSections`)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 81 | Lyrics tile | opens reading | — | OK |
| 82 | Lyrics slot (empty) | `openWriting` | — | OK |
| 83 | Chart tile | opens reading | — | OK |
| 84 | Chart slot (empty) | minimize + chart editor | — | OK |
| 85 | Sketch door (first clip) | `handleMakeSketch` | — | **A-H1** |
| 86 | Clip's Lyrics / Chart slot → confirm Make sketch | `handleMakeSketch` | — | **A-H1** |
| 87 | Make-sketch confirm › Cancel | nothing | — | OK |
| 88 | Notes tile / slot | seeds the draft, opens ClipNotesSheet | — | OK |
| 89 | Notes text input | local draft | — | **A-H2**; A-L5 |
| 90 | Notes › Save | `saveClipNotes` → `updateIdeas` in the idea's own workspace | none | **A-H2** |
| 91 | Notes › Cancel | discards (explicit) | — | OK |
| 92 | Notes swipe / scrim / back | saves if edited (ClipNotesSheet) | — | OK; **A-H2** after an advance |

### Footer (`TransportBar`)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 93 | Previous | restart the take, or `advancePlayerQueue("previous")` | — | OK |
| 94 | Play / Pause (+ count-in, 3 s run-up) | transport; a failed count-in still plays | — | OK |
| 95 | Next | `advancePlayerQueue("next")` | — | OK (04-M2 for the writer) |
| 96 | Close ✕ | `stopSessionAndClose`; clears the queue; the writer unmount flushes | — | OK |
| 97 | Trailing: queue (listening) / repeat (Tools) | session | — | OK |

### Queue sheet (Q, also hosted by the dock)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 98 | Row tap | `setPlayerQueue(index)` | — | OK |
| 99 | View in collection | `setActiveWorkspaceId(row.ws)` → open collection | — | see **08-R1** |
| 100 | Shuffle | queue order (session) | — | OK |
| 101 | Save (as playlist) | PlaylistChooserSheet with the queue items | the sheet's own handling | OK |
| 102 | Edit / Done | session | — | OK |
| 103 | Remove row | `removeFromPlayerQueue` (queue only; emptying it closes the session) | — | OK (queue-only) |
| 104 | Drag reorder | `reorderPlayerQueue` (identity-aware) | — | OK |
| 105 | Sheet expand / drag / close | view | — | OK |

### Tools (`PlayerPracticeDrawers`)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 106 | Drawer tabs | session | — | OK |
| 107 | Reset all | session tools + the persisted root gain and tone | — | **A-L4** |
| 108 | Keep switch (Loop / Sound) | `setClipKeptPractice` (+ settle effect) | — | OK; A-L7 |
| 109 | + Section → picker | — | — | OK |
| 110 | Picker preset / custom option | `handleAddSection` → `setClipSections` (undoable) | null when the spot is taken | OK; double tap A-L8 |
| 111 | Picker › New custom | opens the section editor | — | OK |
| 112 | Picker Cancel / backdrop / back | nothing | — | OK |
| 113 | + Pin | `addClipPracticeMarker` (Pro guard) + naming modal | — | OK |
| 114 | Pin naming modal Save / Delete / Cancel | `handleEditPin` / `removeClipPracticeMarker` / nothing | — | OK; A-L2 |
| 115 | Undo / Redo marks | `restoreMarks` (sections + markers, store values) | history cleared per clip | OK |
| 116 | Mark row tap | select (session) | — | OK |
| 117 | Row play glyph | seek + play (count-in rules) | — | OK |
| 118 | Held row "…" | section editor or pin editor | — | OK |
| 119 | Section editor Save / Return | `handleEditSection` (no-op skip) | — | OK; A-L2 |
| 120 | Section editor ink swatches | draft | — | OK |
| 121 | Section editor Delete | `setClipSections` minus the section (undoable, no confirm) | — | OK |
| 122 | Section editor Cancel / back | discards the draft | — | OK |
| 123 | Section SpanInspector (edge pick, slide preview, commit, nudge, type, use playhead) | `handleRepositionSectionEdge` | — | OK |
| 124 | Pin MarkInspector (slide, commit, nudge, type time, use playhead) | `handleRepositionMarker` | — | OK |
| 125 | Pin editor (drawer) Save / Delete / Cancel | `handleEditPin` / delete (undoable) | — | OK; A-L2; A-L9 |
| 126 | Loop switch | session | — | OK |
| 127 | Loop SpanInspector edges / edge pick (cues) | session | — | OK |
| 128 | Loop a part | session | — | OK |
| 129 | Step up help | HelpSheet | — | OK |
| 130 | Step up restart | session | — | OK |
| 131 | Step up plan (sliders glyph) | opens StepUpSequenceSheet | — | OK |
| 132 | Step up switch | session (also turns the loop on) | — | OK |
| 133 | Count-in length key / switch | session | — | OK |
| 134 | Click switch / volume / voice / haptic | store prefs | — | OK |
| 135 | Speed presets / slider / BPM-× unit / pitch ± (SpeedPitchDials) | session; unit is a pref | — | OK |
| 136 | Take level knob / tone flags (Sound) | `adjustClipOverdubRootGain` / `toggleClipOverdubRootToneFlag` → persist + re-render | error alert | OK |
| 137 | Detect tempo (wired, hidden) | `setClipAnalysis` (overwrites an earlier result even when inconclusive) | error text | OK (hidden) |

### Step-up plan sheet

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 138 | Preset inks (built-in / Custom) | `setActivePlan`; the custom slot is preserved; Custom never wipes itself | — | OK |
| 139 | Stage passes −/+, rate −/+, remove, add | `setSequence` (persisted plan store) | bounded | OK |
| 140 | Save preset / name input / remove preset | behind the parked `SAVED_SEQUENCES_ENABLED` flag; remove has no confirm | — | OK (parked) |
| 141 | Sheet close | — | — | OK |

### Pin editor from the reel (P:2193-2211)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 142 | Name / note inputs | draft | — | OK |
| 143 | Save | `handleEditPin` (no-op skip) | — | A-L2 |
| 144 | Delete (trash glyph, no confirm) | `removeClipPracticeMarker` (undo is under Tools) | — | OK; A-L9 |
| 145 | Cancel / Android back | discards the draft | — | OK |

### Other overlays

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 146 | Overdub HelpSheet | — | — | OK |
| 147 | ReadingSheet (key / capo / size / chords) | chart prefs | — | OK |

### Media dock (G)

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 148 | Recording pill tap | opens the recorder (new screen mount) | — | **A-M2** |
| 149 | Recording pause / resume | the shared recorder pauses or resumes | not awaited, no error UI | OK |
| 150 | Recording stop (square) | `requestRecordingSave` + opens the recorder | — | OK (source of A-M2's token) |
| 151 | Dock swipe-up | expands the sheet | snaps back | OK / A-H3 (the writer keeps stale text) |
| 152 | Queue button | dock queue sheet (rows #98-105) | — | OK |
| 153 | Title tap | `requestInlineStop` + expand | — | OK / A-H3 |
| 154 | Previous / Play / Next | transport and queue | — | OK |
| 155 | Close ✕ | `closePlayer` + `clearPlayerQueue`; the player unmounts and the writer flushes | — | OK |

### Automatic behaviour behind user actions

| # | Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|---|
| 156 | Auto-advance at clip end | `advancePlayerQueue("next")` | — | trigger for A-H2, A-L2, 04-M2 |
| 157 | Duration hydrate effect | `hydrateClipAudioMetadata(active ws, …, playerDuration)` | — | **A-L1**, A-L6 |
| 158 | Waveform hydrate effect | decode → peaks + duration (never a placeholder) | un-claims and retries | OK; A-L6 |
| 159 | Keep settle effect | `setClipKeptPractice` after 700 ms | — | A-L7 |
| 160 | Forced close token (playing clip deleted elsewhere) | one owner closes; the queue is cleared by runtime cleanup | — | OK |
| 161 | Solo files on unmount | scratch files deleted (never library media) | — | OK |
| 162 | Mix re-render queue (any layer edit) | publish new mix, flush, trash the old one after 60 s | caught | OK; see **03-#12** |
| 163 | `PlayerLyricsPanel` (used by the recorder): open / close, chords pref, speed, reading sheet, autoscroll | prefs only | — | OK |

---

## Files read

**Read in full:**
- `src/components/PlayerScreen/index.tsx`
- `PlayerScreen/hooks/usePlayerScreenLifecycle.ts`
- `PlayerScreen/hooks/usePlayerScreenData.ts`
- `PlayerScreen/hooks/usePlayerScreenUi.ts`
- `PlayerScreen/hooks/usePlayerPins.ts`
- `PlayerScreen/hooks/usePlayerSections.ts`
- `PlayerScreen/hooks/useClipAnalysis.ts`
- `PlayerScreen/hooks/usePerClipPractice.ts`
- `PlayerScreen/hooks/usePlayerSpeedControls.ts`
- `PlayerScreen/hooks/usePlayerTransportClock.ts`
- `PlayerScreen/helpers.ts`
- `PlayerScreen/playerZoom.ts`
- `PlayerScreen/components/PlayerLyricsWriter.tsx`
- `PlayerScreen/components/PinDetailModal.tsx`
- `PlayerScreen/components/MarksToggle.tsx`
- `PlayerScreen/components/PlayerFooterSection.tsx`
- `PlayerScreen/components/PlayerSupportSections.tsx`
- `PlayerScreen/components/PlayerArtifactDoors.tsx`
- `PlayerScreen/components/PlayerLayersBench.tsx`
- `PlayerScreen/components/PlayerPracticeDrawers.tsx`
- `PlayerScreen/components/sectionModals.tsx`
- `src/components/PlayerSheet.tsx`
- `src/components/GlobalMediaDock.tsx`
- `src/components/QueuePanel.tsx`

**Read for handlers and writes only** (no store writes beyond transport/session state found by reading and grep):
- `PlayerScreen/components/PlayerHeaderSection.tsx`
- `PlayerScreen/components/PlayerTimeline.tsx`
- `PlayerScreen/components/StepUpSequenceSheet.tsx`
- `PlayerScreen/components/StemAlignmentOverlay.tsx`
- `PlayerScreen/components/PlayerArtifactReader.tsx`
- `PlayerScreen/PracticePinBadges.tsx`
- `PlayerScreen/PlayerLyricsPanel.tsx`
- `PlayerScreen/hooks/useStepUpLoop.ts`
- `PlayerScreen/hooks/usePracticeLoopController.ts`
- `PlayerScreen/hooks/usePlayerPracticePitchTransport.ts`
- `visualizers/PlaybackTapeVisualizer.tsx` (gestures, lines ~1600-1720)
- `visualizers/MinimapVisualizer.tsx` (gestures)
- `visualizers/LiveTapeVisualizer.tsx` (no gestures)
- `visualizers/reelStage.ts`
- `visualizers/reelFonts.ts`

**Skimmed** (styles, no interactions):
- `PlayerScreen/styles.ts`
- `PlayerScreen/components/practiceDrawerStyles.ts`
- `PlayerScreen/__tests__/playerZoom.test.ts`
- `PlayerScreen/hooks/__tests__/usePerClipPractice.test.ts`

**Followed into:**
- `state/actions.ts`:
  - overdub render queue (180-470)
  - `hydrateClipAudioMetadata`
  - `startClipOverdubRecording`
  - stem actions
  - `mergeClipOverdubStems`
  - `saveCombinedClipAsNewClip`
  - `saveProjectLyrics` / `AsNewVersion`
  - `deleteSelectedIdea`
  - `deleteClipFromIdea`
  - `dissolveSketch`
  - `convertClipIdeaToProject`
- `state/dataSlice.ts`:
  - marker / section / kept / analysis setters
  - overdub mutators
  - `updateIdeas`
  - `deleteIdea`
  - `updateIdeaInState`
  - `setActiveWorkspaceId`
- `state/playerSlice.ts` (queue)
- `state/recordingSlice.ts`
- `state/useStepUpPresetsStore.ts`
- `state/runtimeCleanup.ts` (queue cleanup)
- `domain/playerSections.ts` (`normalizeSections`)
- `domain/keptPractice.ts`
- `domain/overdub.ts` (solo and merge inputs)
- `services/soloMix.ts`
- `hooks/useFullPlayer.ts` (rate)
- `components/common/{AppAlert.ts, dialogStore.ts, AppDialog.tsx, SelectionActionSheet.tsx, BottomSheet.tsx, actionMenuStore.ts}`
- `components/modals/ClipNotesSheet.tsx`
- `IdeaDetailScreen/hooks/useSongEditFlow.ts`
- `RecordingScreen/hooks/useRecordingScreenModel.ts` (the overdub resolve, save-token and minimise paths)
- `navigation.ts` (`openSketchPage`, `openIdeaInCollection`)
- `i18n/locales/en.ts` (player and sketch copy)
