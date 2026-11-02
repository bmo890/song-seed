# 12d — Screen sweep: recorder, editor, instruments

Sweep D, 2026-11-02, read-only, against `main` @ 845f3bb8. Scope: every file in
`src/components/RecordingScreen/**`, `src/components/EditorScreen/**`,
`src/components/BluetoothCalibrationScreen/**`, `src/components/TunerScreen/**`,
`src/components/MetronomeScreen/**`, plus `src/hooks/useRecording.ts` and the services, store
actions and native calls they reach. One scratch jest test (store level, `findIdeaInLibrary` against
the recorder's own lookup) was run and deleted.

Earlier findings this sweep leans on rather than repeats: 03-#1 (marker path not rebased),
03-#2 (single marker overwritten or cleared), 03-#3 (launch recovery against a live take),
03-#6 (save copies the whole take), 03-#9 (Discard and Redo hard-delete), 03-#11 (head trim is
permanent), 04-H2 (writes outside the active workspace), 04-M5 (Replace on a lone clip),
07-M3 (Replace re-dates the take and drops its lyrics stamp), 08-R1 (record FAB on a stale
workspace page), 08-L3 (time-based ids).

## Summary

| ID | Sev | Finding | Confidence |
|---|---|---|---|
| D-H1 | **HIGH** | A take recorded into a sketch outside the active workspace (any received parcel's sketch, or after switching workspace while minimized) can't be saved. Discard leaves the mic recording. Only Redo, which deletes the take, or a force-quit ends it. | verified by reading + scratch test |
| D-H2 | **HIGH** | Any record entry point used while a take is minimized re-targets the live take. A sketch take becomes a clip in another collection, a layer becomes a plain clip, a plain take becomes a layer on another song. The old quick-record shell resurfaces as a 0:00 card. | verified by reading |
| D-M1 | MEDIUM | Minimize, then reopen: the take's pins and its beat grid are lost with no message. They live in screen state, not in the app-wide take session. | verified by reading |
| D-M2 | MEDIUM | After the first dock Save in an app session, reopening any minimized take from the dock pauses it and opens the name sheet. With "Name each recording" off, it saves and closes, ending the take. | verified by reading |
| D-M3 | MEDIUM | Bluetooth calibration (from Settings) and the Tuner can be opened while a take is minimized. Calibration claims the session exclusively with `allowsRecording:false`, which cuts the live take's input. The Tuner opens a second mic capture. | calibration: verified by reading (the code comments say so); Tuner: plausible |
| D-M4 | MEDIUM | Editor Replace in a sketch or a clip stack drops take-level fields that 07-M3 and 04-M5 don't list: bookmark, kept practice, group membership, manual sort, and the playlist and setlist entries that point at the take. | verified by reading |
| D-L1 | LOW | Editor: an unnamed part is saved under a different suggested name than the list and the sheet showed (sorted order vs insertion order). | verified by reading |
| D-L2 | LOW | Editor back, swipe-back and Android back drop every marked part and the speed/pitch setting without asking. | verified by reading |
| D-L3 | LOW | When the iOS WAV header wait times out, save still copies the file and then deletes the raw take. The copy can carry a stale data size, so it plays short. | plausible |
| D-L4 | LOW | Back pressed in the gap between Record and the recorder reporting "recording" drops the placeholder and context. The take then starts headless with no dock. | plausible (race) |
| D-L5 | LOW | "Take kept for recovery" and the editor's load failure use `AppAlert.info`, so no `error` haptic fires (CLAUDE.md: failures MUST fire `error`). | verified by reading |
| D-L6 | LOW | Metronome sheet tempo changes: two changes can be stepped onto the same bar. They then share a React key, edit and delete together, and normalize to one. | verified by reading |
| D-L7 | LOW | The input picker silently forgets the chosen mic whenever it is briefly absent from the device list. | verified by reading |
| D-L8 | LOW | The name sheet renames `idea.clips[0]`, not the clip id the save created. | speculative |
| D-L9 | LOW | The recorder's Save guard is React state, and a refused second save clears the overdub target. A same-frame double Save on a layer can file it as a plain take. | speculative |
| D-L10 | LOW | Minimize during arming discards a rolling capture of up to a few seconds without asking (no-count-in click/guide path). | verified by reading |
| D-L11 | LOW | The Metronome page opened while a minimized take is clicking shares the engine. Leaving the page stops the take's click; tempo edits retime it. | verified by reading |

---

## HIGH

### D-H1. A take into a sketch outside the active workspace can't be saved, and Discard doesn't stop it

**Where**

- The recorder resolves its target only in the **active** workspace (`useRecordingScreenModel.ts:161-164`):
  ```ts
  const recordingIdea = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId)?.ideas.find((i) => i.id === recordingIdeaId),
  ```
- Save bails out silently when that lookup misses (`:1524-1528`):
  ```ts
  async function requestSaveRecording() {
    if (!recordingIdea) return;
  ```
- Discard does the same, but still navigates away (`:1307-1308` and `:1514-1517`):
  ```ts
  async function cancelRecording() {
    if (!recordingIdea) return;
  ...
  cancelRecording().then(() => { endRecordTrace("discard"); navigation.goBack(); });
  ```
- Redo has no such guard (`redoTake`, `:1328`). It discards the take for real.
- The dock resolves the same id **library-wide** (`GlobalMediaDock.tsx:122`, `findIdeaInLibrary`). So it keeps showing "Recording" and keeps reopening the stuck screen.
- The scratch test confirmed it: the model's lookup returns `undefined`, the dock's lookup returns the sketch, and the attach `updateIdeas` is a no-op on that workspace.

**How you get there**

1. The sketch page's Record FAB is not gated for received content (`SongScreenContent.tsx:69-78`; the collection page hides it with `hideRecord={screen.isReceivedWorkspace}`). Neither is "+ Version" (`ClipCard.tsx:274-280`) or the player's Layer key (`actions.ts:1354` searches every workspace). Received → open a parcel → open a sketch → Record. The parcel is never made active (`ReceivedScreen/index.tsx:105`).
2. Or: start any take, Minimize, open the drawer and switch workspace (`setActiveWorkspaceId` has no recording guard, `dataSlice.ts:1522`), then tap the dock.

**What happens**

- Save (dock key or the recorder's key) does nothing. No sheet, no message.
- Discard → "Discard take?" → Discard closes the recorder, but the recorder keeps capturing. The dock reappears with the clock still running.
- The take can end only two ways. Redo (from the same Discard dialog) hard-deletes it (03-#9). A force-quit lands it in the active workspace's first collection as "Recovered …" (03-#1 and 03-#2 apply to that path).
- In a parcel, everything recorded is effectively lost unless the person thinks to force-quit.
- 04-H2 says the recorder "correctly returns `attached === false`". It doesn't get that far: `requestSaveRecording` returns before `saveRecording` runs.

**Fix**

- Resolve `recordingIdea` with `findIdeaInLibrary` (as the dock does), and attach with `updateIdeas(..., { workspaceId: ideaWorkspaceId(...) })` in the `onRecorded` callback and in `saveQuickClipName`.
- Never return from `cancelRecording` without stopping the recorder.
- Gate Record, + Version and Layer on received sketches, or decide that recording into a parcel lands in the person's own workspace.

### D-H2. Recording from anywhere while a take is minimized re-targets the live take

**Where:** every record entry point writes the recording context with no "a take is live" check.

- `CollectionFloatingActions.tsx:527-531`: `appActions.quickRecordIdea(...)`, which runs `setRecordingParentClipId(null); setRecordingIdeaId(createdId)` (`actions.ts:842-855`).
- `SongScreenProvider.tsx:149-156` (sketch FAB), `ClipCard.tsx:274-280` (+ Version), `PlayerScreen/index.tsx:1303-1307` (Layer → `startClipOverdubRecording`, `actions.ts:1354-1358`).
- `setRecordingParentClipId` also clears the layer fields (`recordingSlice.ts:37-43`).
- The collection's Record FAB stays visible while the dock shows a live take (`IdeaListSelectionZone.tsx:78-83`).
- `isRecordingActive()` exists (`audioForegroundActivity.ts:40`), but only the waveform decoder reads it.

**Steps:** record into sketch "A" (or record a layer, or a quick clip), then Minimize. In any collection, tap the big Record button. The recorder opens on the still-running take, now headed "New clip". Tap Save.

**What happens**

- The `onRecorded` callback reads the new `recordingIdeaId` (`useRecordingScreenModel.ts:438-446`). The sketch take is saved as a standalone clip in that collection, not in sketch A.
- A minimized **layer** loses `recordingOverdubClipId` and the guide. It is saved as a plain clip of the punch-trimmed vocal.
- Through the player's Layer key, a plain take becomes a **layer on a different song**, placed at that player's punch point (`:378-415`).
- The original quick-record shell is no longer `recordingIdeaId`. The collection's hide rule (`useCollectionScreenModel.ts:200`) stops hiding it, so a 0:00 empty card appears until the next launch sweep.
- The audio survives, but it is attached to the wrong item.

**Fix:** while `recorder.isRecording || recorder.isPaused`, make every record entry point open the live take (as the dock does) instead of re-arming. Or snapshot the target ids into the take session at start, and read them from there at save.

---

## MEDIUM

### D-M1. Minimize and reopen loses the take's pins and its beat grid

- Minimize pops the recorder (`minimizeRecording`, `:2699-2709`), which unmounts the screen.
- `recordingTakeSession.ts` deliberately moved the per-take facts into an app-wide session ("Minimizing the recorder unmounted it…", `:19-27`). But these still live in the screen:
  - `livePins` / `livePinsRef` (`useRecordingScreenModel.ts:144-146`)
  - `takeGridRef` (`:298`), `liveTakeGrid` (`:302`), `takePunchInMsRef` (`:334`)
  - `recordingMetronomeEnabled` (`:257`)
- The reopened instance starts with `[]` and `null`.
- At save, `practiceMarkers` come from `livePinsRef.current` (`:479-485`), and `recordingGrid` from `takeGridRef.current` (`:361-371`). Both come back empty or undefined.
- Grid self-alignment (`:503`) and the downbeat re-aim (`planHeadTrim`, `:519-521`) are skipped as well.

**Steps:** start a take with the metronome or a count-in. Drop two pins. Minimize, check the lyrics or a collection, come back through the dock, and Save.

**Effect:**

- The pins are gone, and nothing says so.
- The clip has no `recordingGrid`: no bar lines, no snapping, no grid for later layers.
- A layer stem loses its grid too.

**Fix:** keep the pins, the take grid and the punch in the take session (`recordingTakeSession.ts`) next to `headTrim`.

### D-M2. The save request re-fires on every recorder mount

- `handledSaveRequestRef` starts at `null` (`:294`).
- The effect (`:1739-1744`) treats any non-zero `recordingSaveRequestToken` as new on mount:
  ```ts
  if (recordingSaveRequestToken === handledSaveRequestRef.current) return;
  handledSaveRequestRef.current = recordingSaveRequestToken;
  if (!recordingSaveRequestToken) return;
  void requestSaveRecording();
  ```
- The token only ever counts up (`recordingSlice.ts:51-54`). The dock's square bumps it (`GlobalMediaDock.tsx:354`).
- After one dock Save in a session, every later reopen of a live take through the dock body (`onOpenRecording`) runs `requestSaveRecording`. That pauses the take, the guide and the click, and opens the name sheet.
- With "Name each recording" off (`promptForClipName` false), the auto-name effect (`index.tsx:72-86`) saves the take and closes the recorder. The musician only wanted to look at the take, and everything they play afterwards is not recorded.

**Fix:** initialise the ref to the token's value at mount, `useRef(useStore.getState().recordingSaveRequestToken)`, or have the dock pass the request in the route params.

### D-M3. Calibration and the Tuner can take the mic from a minimized take

**Calibration**

- The recorder refuses to open calibration mid-take (`useRecordingScreenModel.ts:826-835`): "Calibration claims the audio session exclusively (mic released…) — entering it mid-take would cut the recorder's input."
- The Settings entry has no such guard (`SettingsGeneralView.tsx:121-124`).
- The calibration screen activates an exclusive playback owner (`BluetoothCalibrationScreen/index.tsx:176-185`). The playback mode is `allowsRecording: false` (`audioSession.ts:18`), and an exclusive owner overrides the recorder's higher-priority role (`:85-91`).

**Tuner**

- The Tuner starts `react-native-pitchy` on focus (`useTunerScreenModel.ts:392-398`). On iOS that re-sets the shared session to PlayAndRecord/Measurement with only `DefaultToSpeaker` and starts a second `AVAudioEngine` input tap (`node_modules/react-native-pitchy/ios/Pitchy.mm:47-59, 130-133`). This drops the recorder's `MixWithOthers`/Bluetooth options.
- On Android it opens a second `AudioRecord` (`PitchyModuleImpl.kt:95-106`).

**Effect:** the live take may stop or record silence from that point. The take's file survives, but the music played meanwhile does not.

**Fix:** block both screens with the same "Finish the take first" toast while `recorder.isRecording || recorder.isPaused`, or have the tool tray hide them.

### D-M4. Editor Replace drops take-level fields beyond 07-M3

`buildDerivedClipDraft` (`useEditorExportFlow.ts:203-232`) builds the new take from a fixed field list. It carries none of these:

- `isBookmarked`
- `keptPractice`
- `manualSortOrder`
- `parentAssignedAt`
- `lyricsVersionId` (already 07-M3)

`commitExportedClips` then gives the result a new id (`:258-263`) and, with "Also delete the original", drops the source. When the idea is a sketch or a clip stack:

- **Bookmark lost.** A bookmarked take comes back unbookmarked.
- **Group lost.** `clipGroupAssignments[oldId]` is dropped by normalization, so the take leaves its group (08 reference map, line 34).
- **Order lost.** A manually ordered take goes to the top.
- **References dangle.** Playlist items (`PlaylistItem.clipId`) and setlist entries (`SetlistEntry.clipIds`) that named the take point at nothing.

The save sheet says only "The source take goes."

**Fix:** a Replace result should carry the source's take-level fields, its `createdAt` (07-M3) and its group. Either reuse the source clip id, or rewrite id references the way combine-replace keeps the idea id.

---

## LOW

- **D-L1. Saved part names differ from the ones shown.**
  - The parts list and the save sheet order parts by start, and name unnamed ones `suggestedTitleFor(index)` in that order (`EditorPartsList.tsx` `ordered`; `EditorSaveSheet.tsx:67`).
  - The save uses insertion order (`useEditorExportFlow.ts:192-193`): `keepRegions.map((region, index) => region.title?.trim() || buildSuggestedTitle(index))`.
  - Add a part at 1:00, then one at 0:10, and save: the names come out swapped from what the sheet listed.
  - Fix: sort `keepRegions` by start before building titles.
- **D-L2. Editor exits without asking.**
  - Back (`EditorScreen/index.tsx:578-581`), swipe-back and Android back pop the editor with marked parts, typed part names and a speed/pitch setting unsaved.
  - No media is lost, only the editing session.
  - Fix: confirm when `selectedRanges.length > 0 || hasActiveTransforms`.
- **D-L3. Save continues past an unsettled header.**
  - `useRecording.ts:1004-1005`: `if (!headerFinal) console.warn(...keeping it untrimmed)`. The import copy (`:1084-1097`) still runs, and then the raw temp is deleted (`:1174-1179`).
  - `waitForFinalWavHeader` itself warns that a caller must avoid "anything that would rewrite the take from a stale read".
  - A copy taken before iOS writes the final size keeps a smaller, plausible `data` size. `assessWavHeader` treats that as `finalized` (`domain/wavHeader.ts:81`), so nothing repairs it, and the clip plays short.
  - Fix: on timeout, keep the raw temp and the marker. Or rewrite the copy's sizes from its byte length before deleting the raw file.
- **D-L4. Back during start orphans a headless take.**
  - The plain-take start (`useRecording.startRecording`, 110 to 650 ms) leaves `isRecording` false until the native start returns.
  - Back in that gap reads "nothing recorded" (`useRecordingScreenModel.ts:1439-1447`). It drops the placeholder, clears the context and pops.
  - The start then completes: the mic is live, and no dock appears (`hasRecordingSession` needs `recordingIdea`). The next recorder open inherits the take.
  - Fix: treat an in-flight start as a take, or disable Back while it runs.
- **D-L5. Failure dialogs without the error haptic.**
  - `AppAlert.info(t("recording.keptForRecoveryTitle"), …)` (`useRecording.ts:1140, 1204`) and the editor's `AppAlert.info(t("editor.editUnavailable"), …)` (`EditorScreen/index.tsx:512`) are failures shown without `haptic.error()`.
  - Fix: use `AppAlert.error`, or fire the haptic.
- **D-L6. Tempo-change rows collide.**
  - Stepping a change onto another change's bar (`RecordingMetronomeSheet.tsx:180-187`, `updateChange` keyed by `atBar`) gives two rows `key={segment.atBar}`.
  - Both then edit and remove together, and `normalizeTempoMap` keeps one (`tempoMap.ts:158-171`). The sketch's plan loses a change.
  - Fix: key the drafts by id, and refuse a step onto an occupied bar.
- **D-L7. The input preference is forgotten while the device is away.**
  - `RecordingInputPicker.tsx:75-80` nulls the saved input whenever it isn't in the current list (a Bluetooth mic switched off, a USB mic unplugged).
  - It's a setting, not content.
- **D-L8. The rename targets a position, not an id.**
  - `saveQuickClipName` renames `idea.clips[0]` (`useRecordingScreenModel.ts:1669, 1678, 1686`), after two awaited stops (`:1618-1619`).
  - If anything prepends a take to the same idea in that window, the typed name lands on that take.
  - Fix: return the new clip id from the `onRecorded` callback and rename by id.
- **D-L9. A double Save can file a layer as a take.**
  - `finishSave` guards with `isSavingClip` state (`index.tsx:42-44`).
  - A second Save in the same frame reaches `saveQuickClipName`, gets `false` from `saveRecording`'s in-flight guard, then sets `pendingOverdubSaveRef.current = null` and clears the recording context (`useRecordingScreenModel.ts:1602-1615`) while the first save is still running.
  - The first save's `onRecorded` callback then files the layer as a plain take.
  - Fix: a ref guard in `finishSave`, and don't touch `pendingOverdubSaveRef` on a refused save.
- **D-L10. Minimize during arming discards audio.**
  - `minimizeRecording` → `cancelPendingRecordingStart` → `cancelPreparedRecording` deletes the capture (`useRecording.ts:928-932`).
  - In the no-count-in click path, arming lasts through the anchor polling and the guide lock (`useRecordingScreenModel.ts:2400-2599`), and capture is already rolling.
  - Fix: confirm, or keep the take as a normal minimized take.
- **D-L11. The Metronome page and a live take share one engine.**
  - Its blur cleanup stops a running metronome (`useMetronomeScreenModel.ts:33-42`), which is the take's click. BPM and meter edits retime the click under the take.
  - The audio is safe; the grid is only metadata.

---

## Interaction inventory

**Legend:** OK = no data path at risk. A finding id means the row is at risk (see above).

### Recording screen — header and chrome

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Header › Back chevron, nothing captured | `discardEmptyRecordingIdea` (`actions.ts:861`) drops only an empty clip-kind shell, then clears the context and pops | n/a | OK |
| Header › Back chevron, take live | "Discard take?" dialog: Keep recording / Discard / scrim / Android back. The take is paused while asking (`holdTakeWhileAsking`) | Discard → `cancelRecording` → `discardRecording` (hard delete, 03-#9); with no `recordingIdea` it does nothing but pop | D-H1, 03-#9 |
| Header › Help | opens HelpSheet (read-only) | — | OK |
| Header › Minimize | pops the screen; the take keeps rolling; while arming, it cancels the start | screen state lost on unmount | D-M1, D-L10 |
| Header › "…" | opens the Input & output sheet; disabled while capturing | — | OK |
| Swipe-back / Android back (no handler) | pops like Minimize; the unmount drops an empty shell only when no take is in flight (`:1363-1369`, `:2713-2760`) | — | OK, D-M1 for a live take |
| App background mid-take | the recorder keeps running (background audio); the marker is persisted | kill → launch recovery | 03-#1, 03-#2, 03-#3 |
| OS interruption (call) | `onRecordingInterrupted` → session released; guide and click stopped (`:2083-2103`) | the file survives with the marker | OK |
| Timing warning › swipe to dismiss | screen state only | — | OK |
| Timing warning › Calibrate | navigates to calibration; refused mid-take with a toast | — | OK (contrast D-M3) |

### Recording screen — body

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Metronome glyph toggle | screen state `recordingMetronomeEnabled`; locked while arming or capturing | — | OK (lost on minimize, D-M1) |
| Metronome options glyph | opens the metronome sheet | — | OK |
| Pin key (meta row and take register) | `addLivePin` appends to screen state; it lands on the clip at save | — | D-M1 |
| Guide reel drag / tap (layer, before the take) | `setRecordingPunchInMs` (store); bar-clamped | seek failure stops Listen | OK |
| Listen / Stop listening (InkKey) | guide player seek + play | `haptic.error` on failure | OK |
| "From top" link | punch reset to 0 | — | OK |
| Layer lanes fold | screen state | — | OK |
| Lyrics panel › header tap (expand/collapse) | screen state | — | OK |
| Lyrics › autoscroll toggle / manual scroll interrupt | screen state | — | OK |
| Lyrics › speed popover rows | screen state | — | OK |
| Lyrics › chords on/off | `useChartPrefsStore.setChordsHidden` (preference) | — | OK |
| Lyrics › Aa → ReadingSheet: zoom slider, chords hidden, reset capo | reading and chart preferences; reset capo clears this sketch's capo pref | — | OK (preference only) |

### Recording screen — bottom dock

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Record key (idle) | `handleStartRecording` → prepare → start → marker (`persistPendingRecordingSession`); the count-in, guide and click paths arm the head trim | start failure → `rollbackFailedRecordingStart` + `AppAlert.error` + `haptic.error`; the restore-running and no-space guards alert | 03-#2c (rollback clears the marker), D-L4 |
| Record key (recording) → Pause | pauses the recorder, guide and click | pause failure → `AppAlert.error` | OK |
| Record key (paused) → Resume | claims the session, optional count-in, re-phased click | resume failure → `AppAlert.error` | OK |
| Record key double tap | `starting` local state + `startInFlightRef` | — | OK |
| Discard key → dialog › Redo | `redoTake` → `discardRecording` (hard delete) | — | 03-#9 |
| Discard key → dialog › Discard | `cancelRecording` → hard delete, then pop | no-op when the target is outside the active workspace | D-H1, 03-#9 |
| Discard key → dialog › Keep recording / scrim / Android back | resumes only if the question paused the take | — | OK |
| Save key | `requestSaveRecording`: pause, then open the name sheet | silent no-op when the target is outside the active workspace | D-H1 |
| Overdub auto-stop at guide end | locks review and opens the name sheet | — | OK |

### Recording screen — name sheet (DraftedQuickNameModal → QuickNameModal)

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Name field (typing) | `useDraftText` commits to the store on a pause; flushed before Save/Cancel | — | OK |
| Keyboard Done (submit) | flush → `finishSave` | same as Save | OK, D-L9 |
| Random-name glyph / clear glyph / suggestion chips | draft only | — | OK |
| "Make primary take" toggle (sketch) | screen state; the save callback demotes the other clips (`:488-498`) | — | OK |
| Pin label rows | screen state; carried by `placeLivePins` | — | OK |
| Destination row → SaveDestinationPickerSheet › destination row | sets the override; at save, `relocateIdeaToCollection` (same or other workspace) | a cross-workspace move is not flushed separately (passive) | OK, 08-L5 |
| Destination picker › close / scrim | — | — | OK |
| Save | `saveRecording` (stop → header wait → trim → copy → sidecar → attach → flush → temp delete) → rename `clips[0]` → activity → pop | throw → "kept for recovery" (info, no error haptic); attach false → kept; the auto-name path reveals the sheet on failure | D-L3, D-L5, D-L8, D-L9, 03-#6 |
| Cancel / Android back (`onRequestClose`) | flush draft, hide sheet; the take stays paused | for a review-locked layer: "End of the song" dialog › Redo layer (hard delete) / Keep layer | OK, 03-#9 |
| Auto-name save ("Name each recording" off) | saves at once under the suggested name | failure reveals the sheet | D-M2 |

### Recording screen — Input & output sheet

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Input row | `setPreferredRecordingInputId` + `selectDevice`; disabled while capturing | — | OK |
| Bluetooth input row → confirm › "Use it" / "Phone mic" | as above / nothing | — | OK |
| Refresh inputs | re-reads devices | shows a list error line | OK |
| Device list effect | clears the preference when the device is absent | — | D-L7 |
| Sheet scrim / drag close | — | — | OK |

### Recording screen — metronome sheet

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Listen (preview) | starts/stops the engine; idle only | logs a warning | OK |
| Enabled switch | screen state | — | OK |
| Tempo stepper / typed BPM / tap tempo | global metronome prefs (store); locked during a take | — | OK |
| Meter fold › meter row / feel / custom pattern | global prefs; locked mid-take | — | OK |
| Count-in fold › segmented control | global pref (one-shot per take) | — | OK |
| Sound fold › output toggles, beep and haptic level sliders, click voice | global prefs | — | OK |
| Changes fold › row tap / remove ✕ / bar stepper / BPM stepper / meter row / Add change | `setSongGrid` on the sketch (`dataSlice.ts:2083`, any workspace) | — | D-L6 |
| Sheet close | draft re-adopted on the next open | — | OK |
| Help sheet close | — | — | OK |

### Global media dock (entry to this screen; the dock itself is in another sweep)

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Dock body tap (live take) | reopens the recorder | the stale token auto-pauses or auto-saves | D-M2 |
| Dock save square | bumps the token, opens the recorder | — | D-M2 (seed), D-H1 |
| Record FAB / sketch FAB / + Version / player Layer while a take is minimized | re-arms the recording context under the live take | — | D-H2 |

### Editor

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Back chevron / swipe-back / Android back | pops; marked parts discarded | — | D-L2 |
| Help | read-only | — | OK |
| Tabs Keep / Remove / Speed & pitch | `setIntent` re-types every part; Speed & pitch is Pro-gated | — | OK |
| Reel scrub / tap-seek / pinch zoom | playhead only | — | OK |
| Held part edge drag (MultiTimeRangeSelector) | screen state; snapped edge | — | OK |
| Part move bar (LoopMoveHandle) | screen state | — | OK |
| Transport › to start / play / to end | playback | play errors logged | OK |
| Parts head › Keep to grid | grid policy for the remap | — | OK |
| Parts head › Add part / Split here | `addRange` (Pro limit; "No room" alert; silent when the clip is under 1 s) | — | OK |
| Part row tap (hold) / play-from glyph | screen state / seek and play | — | OK |
| Part name field | screen state | — | D-L1 |
| Part trash (held) | removes the part from screen state, no confirm (no data) | — | OK |
| SpanInspector › edge pick / slider / nudge carets / use playhead | screen state | — | OK |
| Footer › Save clips / Save copy (disabled at "Nothing left") | opens the save sheet; "Nothing marked" alert | — | OK |
| Speed & pitch dials (presets, slide, pitch steps, reset) | screen state | — | OK |
| Save sheet › name field (splice/transform) | screen state | — | OK |
| Save sheet › "Also delete the original" switch | arms Replace; the key turns red "Replace" | — | OK |
| Save sheet › Save (extract) | per part: native `renderTrim` → copy to managed → commit; new ideas (clip) or new takes (sketch) → pop 2 | throw → managed copies of finished parts deleted, `AppAlert.error`; no re-entrancy guard beyond the re-render | OK, D-L1; no-op outside the active workspace (04-H2) |
| Save sheet › Save (splice) | complement render → managed → commit | same | OK |
| Save sheet › Save (transform) | `renderPitchShiftedFile` (tmp name from the title; non-Latin falls back to a UUID) → managed → commit | same | OK |
| Save sheet › Replace (any of the three) | as above + source dropped + `trashFilesOfDroppedClips` (the original survives as `sourceAudioUri`) | — | D-M4, 07-M3, 04-M5 |
| Save sheet › drag-dismiss / Android back | closes; nothing written | — | OK |
| Layered take › "Combine" | `saveCombinedClipAsNewClip` adds a combined take, then replaces the editor route | `AppAlert.error`; key disabled while running | OK (the combined take stays if the person backs out; as labelled) |
| Load failure | `AppAlert.info` "Edit unavailable" | no error haptic | D-L5 |

### Bluetooth calibration

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Screen mount | exclusive playback session (mic released) | — | D-M3 when a take is live |
| Start / Calibrate again | runs a tap pass (click engine + player) | phase error text | OK |
| Tap pad (gesture) | tap epochs (screen) | — | OK |
| Stop | stops audio, resets the run | — | OK |
| Use reported latency | seeds the result | — | OK |
| Music / click ± steppers | draft offsets | — | OK |
| Save | `setBluetoothMonitoringCalibration` (preference) + toast + pop | — | OK |
| Retry | resets the draft | — | OK |
| Saved row → menu › Fine-tune / Calibrate again / Remove → confirm Remove / Keep | preference edit / delete (confirmed) | — | OK |
| Leave screen | timers cleared, engine stopped, session released | — | OK |

### Tuner

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| Screen focus | starts pitchy mic capture | `haptic.error` + message | D-M3 when a take is live |
| Error line tap (Try again / Open settings) | restart / OS settings | — | OK |
| Blur / background | stops capture | — | OK |

### Metronome page

| Screen › element | What it does to data | Failure handling | Verdict |
|---|---|---|---|
| BPM stepper / slider / tap tempo | global metronome prefs | — | OK |
| Start / stop | engine (shared with the recorder) | — | D-L11 |
| Meter row → sheet (meter, feel, custom pattern) | global prefs | — | OK |
| Sound row → sheet (cue toggles, levels, click voice) | global prefs | — | OK |
| Sheet close | — | — | OK |
| Leave page | stops a running click; releases keep-awake | — | D-L11 |

---

## Checked and solid

- **Saving is ordered correctly.** The raw temp and the marker survive every failure until the attach is durable. `saveRecording` has a ref re-entrancy guard (`useRecording.ts:967-977`).
- **A take that can't attach is kept, never dropped:** `attached === false`, or a throw from `attachRecordedOverdubStem` (`actions.ts:1388`).
- **Count-in cancel deletes only the count-in capture,** and clears the marker only if this take wrote it (`cancelPreparedRecording`).
- **A Discard's housekeeping can't wipe the next take's marker.** It is queued (`discardCleanup`).
- **Editor saves never touch the source file.** A failure deletes only the managed copies this save made. Replace trashes through `mediaCleanup.ts` and keeps the original as `sourceAudioUri`.
- **The overdub stem attaches before the mix renders.** Layer pins are placed on the master by a fresh read.
- **Count-in and click settings are snapshotted at start** (while the screen stays mounted), and locked mid-take.
- **The placeholder cleanup only removes an empty clip-kind shell** (`domain/recordingPlaceholder.ts`). It never removes a sketch or an idea that holds a take.

## Files read

**Recorder** (`src/components/RecordingScreen/`)

- `index.tsx`
- `hooks/useRecordingScreenModel.ts`
- `components/`:
  - `RecordingHeader.tsx`, `RecordingControls.tsx`, `RecordingBottomDock.tsx`
  - `RecordingSettingsModal.tsx`, `RecordingInputPicker.tsx`, `RecordingTimingWarnings.tsx`
  - `RecordingLyricsSection.tsx`, `RecordingBody.tsx`, `RecordingBeatBreath.tsx`
  - `RecordingMeta.tsx` (interactive parts), `RecordingOverdubGuide.tsx` (interactive parts), `TakeRegister.tsx` (no handlers)
  - `RecordingMetronomeSheet.tsx`
  - `__tests__/takeBars.test.ts` (listed)

**Editor** (`src/components/EditorScreen/`)

- `index.tsx`, `helpers.ts`
- `components/`:
  - `EditorHeaderSection.tsx`, `EditorPartsHead.tsx`, `EditorPartsList.tsx`
  - `EditorFooterSection.tsx`, `EditorTransformSection.tsx`, `EditorSaveSheet.tsx`
- `hooks/`:
  - `useEditorExportFlow.ts`, `useEditorSelectionState.ts`
  - `useEditorTransformState.ts`, `useEditorPreviewTransport.ts`

**Instruments**

- `src/components/BluetoothCalibrationScreen/index.tsx` (`calibrationAnalysis.ts` and `styles.ts` are pure, no handlers)
- `src/components/TunerScreen/`:
  - `index.tsx`, `styles.ts`
  - `components/TunerScreenContent.tsx`, `components/TunerDial.tsx`
  - `hooks/useTunerScreenModel.ts`
- `src/components/MetronomeScreen/`:
  - `index.tsx`, `styles.ts`
  - `components/MetronomeScreenContent.tsx` (handlers)
  - `hooks/useMetronomeScreenModel.ts`

**Hooks, services, domain, state**

- `src/hooks/`: `useRecording.ts`, `useRecordingDisplayElapsed.ts` (head), `useMetronome.ts` (session and stop paths)
- `src/services/`:
  - `recordingTakeSession.ts`, `recordingRecovery.ts`
  - `audioTrim.ts`, `wavHeaderReady.ts`, `wavHeaderRepair.ts`
  - `audioSession.ts` (owners, exclusive), `audioForegroundActivity.ts`
  - `audioStorage.ts` (`importRecordedAudioAsset`)
- `src/domain/`:
  - `wavHeader.ts` (`assessWavHeader`), `recordingPlaceholder.ts`, `livePins.ts`
  - `draftRecovery.ts`, `draftCommitter.ts`
  - `clipEditRemap.ts` (outline), `tempoMap.ts` (`normalizeTempoMap`)
- `src/state/`:
  - `recordingSlice.ts`
  - `actions.ts`: `quickRecordIdea`, `discardEmptyRecordingIdea`, `relocateIdeaToCollection`, `startClipOverdubRecording`, `attachRecordedOverdubStem`
  - `dataSlice.ts`: `updateIdeas`, `setActiveWorkspaceId`, `setSongGrid`, `setBluetoothMonitoringCalibration`

**Entry points and shared components** (read for context)

- `src/components/modals/QuickNameModal.tsx` and `SaveDestinationPickerSheet.tsx` (handlers)
- `src/components/common/`: `WarmModal.tsx`, `AppAlert.tsx` (error), `ReadingSheet.tsx` (handlers)
- `src/components/PlayerScreen/`: `PlayerLyricsPanel.tsx` (handlers), `index.tsx:1280-1310`, `hooks/usePlayerScreenLifecycle.ts:480-575`
- `src/components/GlobalMediaDock.tsx:95-375`
- `src/components/IdeaListScreen/`: `sections/CollectionFloatingActions.tsx:505-540`, `components/IdeaListSelectionZone.tsx`, `components/ActionButtons.tsx`
- `src/components/IdeaDetailScreen/`: `components/SongScreenContent.tsx`, `provider/SongScreenProvider.tsx:130-160`, `components/ClipCard.tsx:260-285`
- `src/components/SettingsScreen/views/SettingsGeneralView.tsx:110-125`
- `src/navigation.ts` (`visitCollection`), `App.tsx:360-520`

**Native**

- `modules/songnook-pitch-shift/ios/SongNookPitchShiftRenderer.swift`: `renderTrim`, the transform render, output naming
- `node_modules/react-native-pitchy/ios/Pitchy.mm` and `android/.../PitchyModuleImpl.kt` (start/stop, session)

**Earlier reports**

- 01–08 skimmed for overlap.
