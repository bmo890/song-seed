# 01 · Capture, import, first run, and the instruments

Read from code on `main` @ 2442cd38 (2026-11-13). Paths in "Where" are under `src/` unless they start with `App.tsx` or `app.json`.

**No Pro gate lives in any file of this area.** The recorder, the importers, the share-sheet import, the welcome tour, Bluetooth calibration, the Tuner and the Metronome contain no `hasProAccess` / `ensurePro` / `openProUpsell` call and no lock badge. Two gates are *reached from* this area through shared parts, and both are already on the known list:

- Recording a second (or later) layer on a take: the gate is on the player's Layer key (`overdub-layers`, free: 1 layer per take, hard maximum 8).
- Capo inside the recorder's lyrics "Aa" sheet: the shared `ReadingSheet` (`stage-tools`).

---

## Recording

### Ways to start a recording

| Feature | What it does | Status | Where |
|---|---|---|---|
| Record button in a collection | Opens the recorder on a new clip that will land in this collection. | Free | `components/IdeaListScreen/sections/CollectionFloatingActions.tsx` |
| Record button on a sketch's Takes tab | Opens the recorder to add a new take to this sketch. | Free | `components/IdeaDetailScreen/components/SongScreenContent.tsx` |
| Version key on a take card | Opens the recorder to record a new version of that take ("New version of"). | Free | `components/IdeaDetailScreen/components/ClipCard.tsx` |
| Layer key in the full player | Opens the recorder to record a layer over the take, starting where the playhead is. | Free up to 1 layer per take, then Pro | `components/PlayerScreen/index.tsx` |
| Playback stops for a recording | Opening the recorder stops card previews and closes the player first. | Free | `components/IdeaListScreen/sections/CollectionFloatingActions.tsx` |
| Record button hidden where you can't write | Received parcels (until kept) and archived workspaces show no record button. | Free | `components/IdeaListScreen/components/IdeaListSelectionZone.tsx` |
| One take at a time | While a take is running, any record button brings that take back instead of starting another. | Free | `state/recordingSlice.ts` |
| Empty recording leaves nothing behind | Leaving the recorder without recording removes the empty placeholder clip. | Free | `state/actions.ts` (`discardEmptyRecordingIdea`) |

### The recorder screen

| Feature | What it does | Status | Where |
|---|---|---|---|
| Destination header | Shows where the take is going: "New clip", "Recording into", "New version of", or "Layer". | Free | `components/RecordingScreen/components/RecordingHeader.tsx` |
| Record | The one round button starts the take; it answers the press at once. | Free | `components/RecordingScreen/components/RecordingControls.tsx` |
| Pause | Pauses the take; the click and any guide stop with it. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Resume | Continues the same take after a pause. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Save | Ends the take and opens the name sheet (or saves straight away). | Free | `components/RecordingScreen/components/RecordingControls.tsx` |
| Discard | Asks "Discard take?" with Redo, Discard, and Keep recording. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Take clock | Large timer of the take's length. | Free | `components/RecordingScreen/components/RecordingMeta.tsx` |
| Status line | Reads Ready, Recording, Paused, Count-in 1/2, or Pre-roll. | Free | `components/RecordingScreen/components/RecordingMeta.tsx` |
| Live tape | A moving waveform of what the mic hears, with a red playhead. | Free | `components/visualizers/LiveTapeVisualizer.tsx` |
| Recording colour wash | The whole page tints while a take is live. | Free | `components/RecordingScreen/index.tsx` |
| Minimize | Down-chevron leaves the recorder while the take keeps recording. | Free | `components/RecordingScreen/components/RecordingHeader.tsx` |
| Back | Back chevron leaves; with a take in progress it asks before discarding. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Help sheet | "?" explains count-in, click, and that recording keeps going when locked. | Free | `components/common/helpContent.ts` |
| Faster start | The recorder is readied in advance so recording starts almost instantly (full version iOS; input only on Android). | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |

### While the tape rolls

| Feature | What it does | Status | Where |
|---|---|---|---|
| Drop a pin | A thumb-sized key marks the current moment; a counter shows how many. | Free | `components/RecordingScreen/components/RecordingMeta.tsx` (`TakePinKey`) |
| Pins on the tape | Dropped pins show as flags on the live tape. | Free | `components/visualizers/LiveTapeVisualizer.tsx` |
| Pins saved with the take | Pins become the take's marks, shifted correctly if a count-in was trimmed. | Free | `domain/livePins.ts` |
| A question pauses the take | Opening "Discard take?" pauses recording; "Keep recording" resumes it. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` (`holdTakeWhileAsking`) |
| Controls lock mid-take | Input, metronome settings and the "…" menu lock while recording runs. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |

### Saving, naming and destination

| Feature | What it does | Status | Where |
|---|---|---|---|
| Name sheet | "Save clip as / Save take as / Save layer as" with a name field. | Free | `components/modals/QuickNameModal.tsx` |
| Suggested title | Leaving the name empty saves under the suggested title (date-time, or next take name). | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Suggest a name | A sparkle key fills in a random song-like name. | Free | `components/modals/QuickNameModal.tsx` |
| Clear name | An ✕ key empties the name field. | Free | `components/modals/QuickNameModal.tsx` |
| Name the pins | The sheet lists each dropped pin with its time and a name field. | Free | `components/modals/QuickNameModal.tsx` |
| Save to (destination) | For a new clip, a row shows the workspace and collection; tap to change. | Free | `components/RecordingScreen/index.tsx` |
| Destination picker | Lists every collection in your own workspaces, with idea counts and "Started here". | Free | `components/modals/SaveDestinationPickerSheet.tsx` |
| Received parcels never offered | Recordings can only be saved into your own workspaces. | Free | `domain/workspaceVisibility.ts` |
| Make primary | When recording into a sketch, a switch makes this take the primary take. | Free | `components/RecordingScreen/index.tsx` |
| Name each clip (setting) | Settings switch; off = takes save straight under the suggested title, no sheet. | Free | `components/SettingsScreen/views/SettingsGeneralView.tsx` |
| Lyrics version stamped on the take | A take in a sketch remembers which lyrics version was current when sung. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| New version inherits tags | A new version of a take copies that take's tags. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Logged in Activity | A saved recording is logged as created (new clip) or updated (sketch). | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Rate-the-app prompt | After a save, may ask for a store review (10+ clips, 5+ days, at most every 120 days). | Free | `services/reviewPrompt.ts` |
| Waveform prepared at save | The detailed waveform is built in the background so the player opens fast. | Free | `services/waveformSidecar.ts` |

### Discard and redo

| Feature | What it does | Status | Where |
|---|---|---|---|
| Redo | Throws the take away and stays on the recorder, ready with the same settings. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` (`redoTake`) |
| Discard and leave | Throws the take away and closes the recorder. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Discarded takes are recoverable | A discarded or redone take of 5 seconds or more waits in Recently deleted. | Free | `state/discardedTake.ts` |
| Stop a count-in | Discard works during a count-in, so a wrong start can be cancelled. | Free | `components/RecordingScreen/components/RecordingBottomDock.tsx` |

### Recording in the background and the mini dock

| Feature | What it does | Status | Where |
|---|---|---|---|
| Keeps recording when locked or switched away | The take continues with the screen locked or another app in front. | Free | `hooks/useRecording.ts`, `app.json` |
| Recording dock | After minimizing, a red bar shows "Recording", the title and the running clock. | Free | `components/GlobalMediaDock.tsx` |
| Pause / resume from the dock | A key on the dock pauses or resumes the take. | Free | `components/GlobalMediaDock.tsx` |
| Save from the dock | The stop key reopens the recorder straight on the save sheet. | Free | `components/GlobalMediaDock.tsx` |
| Tap the dock to return | Tapping the dock reopens the recorder on the running take. | Free | `components/GlobalMediaDock.tsx` |
| Recording notification | Android shows a "Recording…" notification with pause and resume actions. | Free (Android only) | `hooks/useRecording.ts` |
| Take survives minimizing | Pins, click grid and layer start point stay with a minimized take. | Free | `services/recordingTakeSession.ts` |

### Input and output

| Feature | What it does | Status | Where |
|---|---|---|---|
| Input and output sheet | "…" opens a sheet to choose the microphone and see the output. | Free | `components/RecordingScreen/components/RecordingSettingsModal.tsx` |
| Choose the input | Pick Built-in Mic, Bluetooth, Wired headset, or USB Microphone. | Free | `components/RecordingScreen/components/RecordingInputPicker.tsx` |
| Look for inputs | A refresh key rescans for connected microphones. | Free | `components/RecordingScreen/components/RecordingInputPicker.tsx` |
| Input choice remembered | The chosen microphone is kept; it resets if that device disappears. | Free | `components/RecordingScreen/components/RecordingInputPicker.tsx` |
| Bluetooth mic warning | Choosing a Bluetooth mic asks first: call quality, delay can't be corrected. | Free | `components/RecordingScreen/components/RecordingInputPicker.tsx` |
| Output shown | Shows the current output (speaker, headphones) and that it follows the phone. | Free | `components/RecordingScreen/components/RecordingSettingsModal.tsx` |
| Phone mic preferred with wired headset | With a wired headset plugged in and no choice made, the phone's mic records. | Free (Android only) | `domain/recordingInput.ts` |

### Lyrics while recording (sketches that have lyrics)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Lyrics panel | The sketch's latest lyrics sit under the tape, with version and date. | Free | `components/RecordingScreen/components/RecordingLyricsSection.tsx` |
| Expand lyrics | Expanding gives the words most of the screen and shrinks the header and tape. | Free | `components/PlayerScreen/PlayerLyricsPanel.tsx` |
| Autoscroll | The lyrics scroll by themselves during the take; tap to pause or start. | Free | `components/PlayerScreen/PlayerLyricsPanel.tsx` |
| Test the scroll before recording | The same key previews the scroll speed while idle. | Free | `components/PlayerScreen/PlayerLyricsPanel.tsx` |
| Autoscroll speed | 7 speeds: 0.25×, 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×. | Free | `components/PlayerScreen/PlayerLyricsPanel.tsx` |
| Scrolling by hand pauses autoscroll | Touching the lyrics hands control back to you. | Free | `components/RecordingScreen/index.tsx` |
| Show or hide chords | When the lyrics carry chords, a key shows or hides them. | Free | `components/PlayerScreen/PlayerLyricsPanel.tsx` |
| Text size (Aa) | The Aa sheet changes the lyric size. | Free | `components/common/ReadingSheet.tsx` |
| Capo (Aa) | The Aa sheet sets a capo so chords show as easier shapes. | Pro | `components/common/ReadingSheet.tsx` |

### Safety nets

| Feature | What it does | Status | Where |
|---|---|---|---|
| Microphone permission | First record asks for the mic; if blocked, offers "Open settings". | Free | `hooks/useRecording.ts` |
| Notification permission | Android must allow the recording notification before a take can start. | Free (Android only) | `hooks/useRecording.ts` |
| Not enough space | Refuses to start a take when the phone has under 64 MB free. | Free | `hooks/useRecording.ts` (`hasRoomForATake`) |
| Phone storage full mid-take | Stops the take when storage runs out and keeps what was captured. | Free | `hooks/useRecording.ts`, `services/takeStorageWatch.ts` |
| Crash recovery ("Clip recovered") | A take cut short by a crash is restored on next launch, into the idea it was for. | Free | `services/recordingRecovery.ts`, `App.tsx` |
| "Nothing was captured" notice | If the app closed before any sound was recorded, it says so. | Free | `App.tsx` |
| "Take kept for recovery" | If a save can't finish, the audio is kept and restored on reopen. | Free | `hooks/useRecording.ts` |
| Phone call or other interruption | An interruption stops the click and guide; recording resumes automatically when possible. | Free | `hooks/useRecording.ts` |
| No recording during heavy library work | Record is refused with a toast during import, restore, backup, archive or recovery. | Free | `services/libraryOperationGate.ts` |
| Automatic backup steps aside | A background backup stops itself when you start recording. | Free | `services/libraryOperationGate.ts` |
| Background waveform work pauses | Waveform decoding for other clips waits while the recorder is open. | Free | `services/audioForegroundActivity.ts` |
| Failure messages | Clear alerts when recording can't prepare, start, pause, resume, or produce a file. | Free | `hooks/useRecording.ts` |

---

## Recording with a click

### Metronome on the recorder

| Feature | What it does | Status | Where |
|---|---|---|---|
| Metronome toggle | A metronome glyph on the status row turns the click on for the take. | Free | `components/RecordingScreen/components/RecordingMeta.tsx` |
| Tempo summary | When on, shows tempo, meter and count-in beside the glyph ("92 · 4/4 · count 1"). | Free | `components/RecordingScreen/index.tsx` |
| Metronome sheet | A settings key opens the full metronome sheet. | Free | `components/RecordingScreen/components/RecordingMetronomeSheet.tsx` |
| Click is never recorded as the take's sound | The click guides you; the help sheet states it isn't part of the take. | Free | `components/common/helpContent.ts` |
| Listen (preview) | Plays the click before recording without changing whether the take uses it. | Free | `components/RecordingScreen/components/RecordingMetronomeSheet.tsx` |
| Tempo | 40 to 240 BPM by − / + (hold to run) or a slider. | Free | `components/common/metronome/MetronomeBlocks.tsx` (`TempoBlock`) |
| Tap tempo | Tap a key in time; three or more steady taps set the tempo. | Free | `domain/metronome.ts` |
| Meter | 8 time signatures: 2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8, 12/8. | Free | `domain/metronome.ts` |
| Click on (feel) | What clicks: Beats, Eighths, Triplets, Sixteenths; groupings for 5/4 and 7/8; "In two/three/four". | Free | `domain/metronome.ts` |
| Custom beat pattern | Tap each beat to make it an accent, a click, or a rest. | Free | `components/common/metronome/MetronomeBlocks.tsx` (`BarStrip`) |
| Sound: Beep | Turn the audible click on or off and set its volume. | Free | `components/common/metronome/MetronomeBlocks.tsx` (`CueRows`) |
| Sound: Visual | Turn the on-screen beat pulse on or off. | Free | `components/common/metronome/MetronomeBlocks.tsx` |
| Sound: Haptic | Turn beat vibration on or off; 3 strengths: Light, Medium, Strong. | Free | `components/common/metronome/MetronomeBlocks.tsx` |
| Click sound | 2 voices: Click or Wood. | Free | `components/common/metronome/MetronomeBlocks.tsx` |
| Volume changes mid-take | Beep volume and haptic strength can still be changed while recording. | Free | `hooks/useMetronome.ts` |
| Tempo changes | Plan tempo or meter changes at chosen bars for a sketch; the click follows them. | Free | `components/RecordingScreen/components/RecordingMetronomeSheet.tsx` |
| Edit a tempo change | Move it a bar earlier or later, set its BPM and meter, or remove it. | Free | `components/RecordingScreen/components/RecordingMetronomeSheet.tsx` |
| Beat dots | A row of dots above the transport shows the position in the bar. | Free | `components/common/metronome/MetronomeBeatBar.tsx` |
| Page breath | The screen edge glows softly on each beat, deeper on accents. | Free | `components/RecordingScreen/components/RecordingBeatBreath.tsx` |
| Beat ruler on the tape | Bar and beat lines are drawn on the live tape, even before recording. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Settings lock for the whole take | Tempo, meter, feel and cue switches can't change mid-take, paused included. | Free | `components/RecordingScreen/index.tsx` |
| Metronome settings remembered | Tempo, meter, feel, cues and levels are kept between sessions. | Free | `hooks/useMetronome.ts` |

### Count-in

| Feature | What it does | Status | Where |
|---|---|---|---|
| Count-in length | 4 choices: Off, 1 bar, 2 bars, 4 bars of clicks before recording. | Free | `domain/metronome.ts` (`METRONOME_COUNT_IN_BAR_OPTIONS`) |
| Count-in display | A large red number counts the beats, with dots, where the clock sits. | Free | `components/RecordingScreen/components/RecordingMeta.tsx` |
| Count-in without a click in the take | A count-in can run even with the metronome off; it goes silent when recording starts. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Count-in is one-shot | After a take the count-in switches itself off; Redo keeps it for the retry. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Take starts on the downbeat | The count-in is cut off the saved file so the clip starts on beat one. | Free | `domain/clickGridAlignment.ts` |
| Count-in before resuming | If a count-in is switched on while paused, it runs before the take continues. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |

### The take's grid

| Feature | What it does | Status | Where |
|---|---|---|---|
| Take remembers its grid | Tempo, meter, feel and tempo changes are saved with the take for bars and beats later. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Grid checked against the recording | After saving, the grid is lined up to the clicks the mic actually heard. | Free | `services/gridSelfAlignment.ts` |
| Click resumes in time | After a pause, the click comes back at the right place in the bar. | Free | `domain/resumeClickPhase.ts` |
| Original take's settings restored | A new version or a layer opens with the original take's tempo, meter and click setting. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| "Original take: 92 BPM · 4/4" note | The metronome sheet says which settings came from the original take. | Free | `components/RecordingScreen/components/RecordingMetronomeSheet.tsx` |
| Output-change stamp | If headphones change mid-take, the grid is marked trustworthy only up to that moment. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |

---

## Recording a layer

Everything below comes with any layer a person is allowed to record. The only gate is on starting a layer: the first layer on a take is free, more need Pro, and a take holds at most eight.

| Feature | What it does | Status | Where |
|---|---|---|---|
| Record a layer over a take | Record a new part while the take (and its existing layers) plays as a guide. | Free up to 1 layer per take, then Pro | `components/PlayerScreen/index.tsx`, `state/actions.ts` |
| Eight-layer limit | A take holds at most eight layers, Pro included; at eight the app offers Combine instead. | Pro | `domain/overdub.ts` (`MAX_LAYERS_PER_TAKE`) |
| Guide reel | The take's waveform, sections and pins scroll above your new part. | Free | `components/RecordingScreen/components/RecordingOverdubGuide.tsx` |
| Guide position | "Guide · 0:42 / 3:10" shows how far through the song you are. | Free | `components/RecordingScreen/components/RecordingOverdubGuide.tsx` |
| Your take drawn under the song | The new part is written in red under the guide on the same timeline. | Free | `components/RecordingScreen/components/TakeRegister.tsx` |
| Existing layers shown | Layers already on the take appear as slim lanes under the reel. | Free | `components/common/OverdubLayerLanes.tsx` |
| Layers fold with lyrics open | With lyrics expanded, existing layers fold to one "Layers · n" line. | Free | `components/RecordingScreen/components/RecordingOverdubGuide.tsx` |
| Start where the playhead was (punch-in) | The layer starts at the player's position, snapped to the bar; header reads "Layer · from 0:42". | Free | `state/actions.ts` (`startClipOverdubRecording`) |
| Drag the guide to choose the start | Before recording, drag the reel to move where the layer begins. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` (`setGuideStart`) |
| Start flag and "Starts 0:42" | A line on the reel and a label show the chosen start. | Free | `components/RecordingScreen/components/RecordingOverdubGuide.tsx` |
| From top | One tap moves the layer's start back to the beginning. | Free | `components/RecordingScreen/components/RecordingOverdubGuide.tsx` |
| Listen | Plays the guide from the chosen start before you record. | Free | `components/RecordingScreen/components/RecordingOverdubGuide.tsx` |
| Lead-in before a punch | Without a count-in, the song plays one bar (or 3 seconds) before the start. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Pre-roll status | "Pre-roll" shows while the lead-in plays and nothing is kept yet. | Free | `components/RecordingScreen/components/RecordingMeta.tsx` |
| Count-in for a layer | With a count-in, the clicks lead in and the song enters on the downbeat. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| "Guide in 3" countdown | With a click but no count-in, a countdown shows when the song joins. | Free | `components/RecordingScreen/components/RecordingMeta.tsx` |
| Headphones hint | On the phone speaker it says "Headphones keep the guide out of your take." | Free | `components/RecordingScreen/components/RecordingOverdubGuide.tsx` |
| Last ten seconds warning | "Recording · 0:08 left" counts down before the song ends. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Stops at the end of the song | The layer stops itself when the guide ends and opens the save sheet. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| "End of the song" review | Cancelling that save asks: Redo layer or Keep layer. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Save layer as | Name sheet for the layer; empty keeps "Layer 1", "Layer 2". | Free | `components/RecordingScreen/index.tsx` |
| Pins while layering | Pins dropped during a layer land on the take, at the right place in the song. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Pause and resume a layer | Pausing holds the song and your part together; both continue together. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Guide returns after minimizing | Reopening a minimized layer take puts the song back in sync. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Automatic timing alignment | The layer is placed using measured device delay, then refined against the song after saving. | Free | `services/layerSelfAlignment.ts`, `services/latencyModel.ts` |
| Backing out forgets the set-up | Leaving before recording clears the layer set-up; the take is untouched. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |

---

## Bluetooth timing and calibration

| Feature | What it does | Status | Where |
|---|---|---|---|
| "Not calibrated" notice | With uncalibrated Bluetooth headphones the recorder warns takes may land late. | Free | `components/RecordingScreen/components/RecordingTimingWarnings.tsx` |
| "Calibrated over a month ago" notice | Suggests calibrating again after 30 days. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| "Calibrate again" notice | Flags an old-style calibration that should be redone once. | Free | `domain/bluetoothMonitoring.ts` |
| Bluetooth mic notice | Says a Bluetooth mic's delay can't be corrected. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| "Output changed" notice | Says when the output switched mid-take and timing may drift. | Free | `components/RecordingScreen/hooks/useRecordingScreenModel.ts` |
| Calibrate link | The notice links straight to Bluetooth calibration (not during a take). | Free | `components/RecordingScreen/components/RecordingTimingWarnings.tsx` |
| Swipe a notice away | Swiping dismisses a notice for the rest of that recorder session. | Free | `components/RecordingScreen/components/RecordingTimingWarnings.tsx` |
| Bluetooth calibration screen | Opened from Settings → Preferences → Recording or from the recorder notice. | Free | `components/BluetoothCalibrationScreen/index.tsx` |
| Listening through | Shows the connected headphones, whether calibrated, and the delay the phone reports. | Free | `components/BluetoothCalibrationScreen/index.tsx` |
| Music pass (1 of 2) | Tap along with beeps (some are silent) to measure the delay for guides and layers. | Free | `components/BluetoothCalibrationScreen/index.tsx` |
| Click pass (2 of 2) | A second tap-along measures the metronome's separate delay. | Free | `components/BluetoothCalibrationScreen/index.tsx` |
| Result with warnings | Shows both delays in ms and warns on uneven taps or unlikely results. | Free | `components/BluetoothCalibrationScreen/calibrationAnalysis.ts` |
| Fine-tune | Nudge the Music or Click delay 10 ms earlier or later before saving. | Free | `components/BluetoothCalibrationScreen/index.tsx` |
| Use the reported delay | One tap starts from the delay the phone itself reports. | Free (iOS only) | `components/BluetoothCalibrationScreen/index.tsx` |
| Save / Try again | Save the calibration for these headphones, or run it again. | Free | `components/BluetoothCalibrationScreen/index.tsx` |
| Saved calibrations | A list per headphone; menu: Fine-tune, Calibrate again, Remove. | Free | `components/BluetoothCalibrationScreen/index.tsx` |
| Calibration applied automatically | Saved delays correct take timing, layer placement and beat cues for those headphones. | Free | `services/latencyModel.ts` |
| Stops if the output changes | Calibration ends with a message if the headphones disconnect mid-pass. | Free | `components/BluetoothCalibrationScreen/index.tsx` |
| Blocked during a take | Opening calibration while recording shows "Finish the take first". | Free | `components/BluetoothCalibrationScreen/index.tsx` |

---

## Importing audio and video

### Importing from inside the app

| Feature | What it does | Status | Where |
|---|---|---|---|
| Import (collection menu) | "Import" in a collection's "…" menu brings files into that collection. | Free | `components/IdeaListScreen/components/CollectionHeaderMenu.tsx` |
| Choose the source | A menu asks: Files (audio or video) or Videos from the photo library. | Free | `components/common/importSource.ts` |
| Import from Files | Pick one or many audio files from the phone or cloud drives. | Free | `services/audioStorage.ts` (`pickAudioFiles`) |
| Import video files | A picked video comes in as a clip of its sound; the picture is dropped. | Free | `services/audioStorage.ts`, `services/audioImportFormat.ts` |
| Import videos from the photo library | Pick camera videos or screen recordings; no photo permission prompt. | Free | `services/audioStorage.ts` (`pickVideoFiles`) |
| Individual clips or one sketch | With several files, choose: each its own clip, or all as takes of one sketch. | Free | `components/IdeaListScreen/hooks/useCollectionImportFlow.ts` |
| Name the import | A single file, or a new sketch, gets a name sheet (empty = file name). | Free | `components/IdeaListScreen/hooks/useCollectionImportFlow.ts` |
| Titles from file names | Imported clips are titled from their file names, numbered if a title repeats. | Free | `services/audioStorage.ts` (`buildImportedTitle`) |
| Import audio into a sketch | A sketch's "…" menu imports one file as a new take, with optional "Make primary". | Free | `components/IdeaDetailScreen/hooks/useSongImportFlow.ts` |
| Import keeps running | The import runs in the background while you keep using the app. | Free | `state/useImportStore.ts` |
| Import progress banner | A pill shows "Importing 3 of 12…", then "Imported" or "Import failed". | Free | `components/ImportProgressBanner.tsx` |
| Originals untouched | Files are copied in; your original files and Photos videos are never deleted. | Free | `services/pickedCopies.ts` |
| One heavy job at a time | Import waits if a backup, restore or recording is running. | Free | `services/libraryOperationGate.ts` |

### Dates and duplicates

| Feature | What it does | Status | Where |
|---|---|---|---|
| Date choice | When a file carries its recording date, choose: Original date or Today's date. | Free | `domain/importDates.ts` |
| Video recording date | A video's own recording time is read so its date and duplicate check work. | Free | `services/videoCreationTime.ts` |
| Duplicate check | Spots files already in the library (same original recording time) before importing. | Free | `services/importDuplicates.ts` |
| Duplicate review sheet | Lists "Already in your library" and "New" files, with where each copy lives. | Free | `components/DuplicateReviewSheet.tsx` |
| Tick which files to import | Each row can be ticked; duplicates start unticked. | Free | `components/DuplicateReviewSheet.tsx` |
| Import as copy / Skip | For a single duplicate: import it again as a copy, or skip it. | Free | `components/DuplicateReviewSheet.tsx` |
| Same file picked twice | A file chosen twice in one import comes in once. | Free | `services/importDuplicates.ts` (`dedupeBatch`) |

### Formats and conversion

| Feature | What it does | Status | Where |
|---|---|---|---|
| AIFF conversion | AIFF files are converted to M4A on import. | Free (iOS only) | `services/audioStorage.ts` |
| AIFF refused on Android | Android says AIFF isn't supported and suggests WAV or M4A. | Free (Android only) | `components/common/importFeedback.ts` |
| CAF, Ogg, Opus conversion | These one-phone formats are converted to M4A so they play on any phone. | Free | `services/audioImportFormat.ts` |
| Video formats | 4 video types: MP4, MOV, M4V, 3GP. | Free | `services/audioImportFormat.ts` |
| "This video has no sound" | A silent video is refused with a clear message. | Free | `components/common/importFeedback.ts` |
| "Couldn't read this video" | An unreadable video is refused and suggests MP4 or MOV. | Free | `components/common/importFeedback.ts` |
| "Format won't play on this phone" | A file that can't be played or converted is refused with the fix. | Free | `components/common/importFeedback.ts` |
| Waveforms fill in later | Imported clips get a quick placeholder waveform; the real one arrives in the background. | Free | `services/backgroundWaveformHydration.ts` |

### From other apps (share sheet)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Share to SongNook | SongNook appears in other apps' share sheets for audio, video and SongNook files (up to 20 on iOS). | Free | `app.json` (`expo-share-intent`) |
| "Import from Share" screen | Lists the incoming files and says how many are ready. | Free | `components/ShareImportScreen/components/ShareImportScreenContent.tsx` |
| Unsupported items skipped | Non-audio items are left out, with a note saying how many. | Free | `services/shareImport.ts` |
| Into the current collection | One row imports into the collection you were last in. | Free | `components/ShareImportScreen/components/ShareImportDestinationSection.tsx` |
| Into another collection | Unfolds a list of every collection across your workspaces. | Free | `components/ShareImportScreen/components/ShareImportDestinationSection.tsx` |
| New Collection from Import | Creates a new collection (you name it) and puts the files there. | Free | `components/ShareImportScreen/components/ShareImportModals.tsx` |
| Clips or one sketch | Several shared files can become individual clips or one new sketch. | Free | `components/ShareImportScreen/hooks/useShareImportScreenModel.ts` |
| Date choice and duplicate review | Shared files get the same date question and duplicate review as in-app imports. | Free | `components/ShareImportScreen/hooks/useShareImportScreenModel.ts` |
| Shared SongNook file | A shared SongNook archive shows "Someone sent you music" with Import / Not now. | Free | `components/ShareImportScreen/components/ShareImportScreenContent.tsx` |
| Shared file lands as received | A chart book, setlist or playlist opens in Compilations; anything else lands in Received. | Free | `components/ShareImportScreen/hooks/useShareImportScreenModel.ts` |
| Full backup refused here | A full backup shared this way is not imported; it points to Restore instead. | Free | `components/ShareImportScreen/hooks/useShareImportScreenModel.ts` |

---

## First run

| Feature | What it does | Status | Where |
|---|---|---|---|
| Welcome tour | Seven panes shown once on first launch, over the app. | Free | `components/common/WelcomeFlow.tsx` |
| Cover pane | The mark, the name and "A quiet corner to finish songs." | Free | `components/common/WelcomeFlow.tsx` |
| Language on the cover | The app language is read from the phone and can be changed here. | Free | `components/common/WelcomeFlow.tsx` (`LanguageSelect`) |
| Restore backup link | A link on the cover leaves the tour and opens Restore, for a new phone. | Free | `App.tsx` (`WelcomeWithRestore`) |
| Six feature panes | Sketches, Write, Practice, Share, Shelf and Revisit, Organize, each with a picture. | Free | `components/welcome/WelcomeScenes.tsx` |
| Skip | Skip is available from every pane. | Free | `components/common/WelcomeFlow.tsx` |
| Next, swipe, or dots | Move with the button, a sideways swipe, or by tapping a dot. | Free | `components/common/WelcomeFlow.tsx` |
| Bring your voice memos | The last pane's "Choose files" imports audio straight away. | Free | `services/welcomeImport.ts` |
| "Imported" collection | Welcome imports land in a collection named "Imported", created if needed. | Free | `services/welcomeImport.ts` |
| Welcome import keeps original dates | Files keep their recording dates when they carry them; no question asked. | Free | `services/welcomeImport.ts` |
| Welcome import skips duplicates | Files already in the library are skipped and counted in the summary. | Free | `services/welcomeImport.ts` |
| Import continues after Start | Tapping Start mid-import doesn't stop it; the progress pill takes over. | Free | `services/welcomeImport.ts` |
| Replay intro | Settings → Help & about → "Replay intro" shows the tour again. | Free | `components/SettingsScreen/views/SettingsAboutView.tsx` |
| Starter library | A fresh install starts with a "My Songs" workspace holding an "Ideas" collection. | Free | `state/dataSlice.ts` (`createInitialWorkspace`) |
| Starter names in your language | The starter workspace and collection are named in the phone's language. | Free | `state/dataSlice.ts` |
| Permissions asked only when needed | Mic is asked on first record or tune; nothing is asked at launch. | Free | `hooks/useRecording.ts`, `components/TunerScreen/hooks/useTunerScreenModel.ts` |

---

## Tuner

| Feature | What it does | Status | Where |
|---|---|---|---|
| Tuner | A chromatic tuner in the side menu's tool tray; listens as soon as it opens. | Free | `components/TunerScreen/components/TunerScreenContent.tsx` |
| Note and octave | Shows the nearest note name with its octave. | Free | `components/TunerScreen/components/TunerDial.tsx` |
| Frequency readout | Shows the detected pitch in Hz. | Free | `components/TunerScreen/components/TunerDial.tsx` |
| Needle | A needle on an arc glides between flat and sharp. | Free | `components/TunerScreen/components/TunerDial.tsx` |
| Cents off | A number on the flat or sharp side shows how far off you are. | Free | `components/TunerScreen/hooks/useTunerScreenModel.ts` |
| Status word | Reads Waiting, Listening, In tune, Tune up, or Tune down. | Free | `components/TunerScreen/components/TunerDial.tsx` |
| In-tune colour and buzz | The dial changes colour and gives one vibration when the note locks in tune. | Free | `components/TunerScreen/hooks/useTunerScreenModel.ts` |
| Range | Hears 27.5 Hz to 2,000 Hz (low bass strings up to high violin notes). | Free | `domain/tuner.ts` |
| Steady reading | The note holds briefly after the string stops and doesn't flicker between names. | Free | `domain/tunerTracker.ts` |
| "Play one string at a time." | A one-line hint under the dial. | Free | `components/TunerScreen/components/TunerScreenContent.tsx` |
| Mic permission help | If the mic is blocked, a line says so; tap to open settings or try again. | Free | `components/TunerScreen/components/TunerScreenContent.tsx` |
| Mic released in the background | The tuner stops listening when you leave the app or the page. | Free | `components/TunerScreen/hooks/useTunerScreenModel.ts` |
| Won't interrupt a recording | With a take running in the background, the tuner says "Finish the take first". | Free | `components/TunerScreen/hooks/useTunerScreenModel.ts` |

---

## Metronome

| Feature | What it does | Status | Where |
|---|---|---|---|
| Metronome | A standalone metronome in the side menu's tool tray. | Free | `components/MetronomeScreen/components/MetronomeScreenContent.tsx` |
| Start / Stop | One round key starts and stops the click. | Free | `components/MetronomeScreen/components/MetronomeScreenContent.tsx` |
| Tempo − / + | Large number with − / + keys, 40 to 240 BPM; hold to run. | Free | `components/MetronomeScreen/components/MetronomeScreenContent.tsx` |
| Tempo slider | A slider across the whole range with a felt stop every 10 BPM. | Free | `components/MetronomeScreen/components/MetronomeScreenContent.tsx` |
| Tempo name | Shows the classical marking: Largo, Adagio, Andante, Moderato, Allegro, Presto, Prestissimo. | Free | `domain/metronome.ts` (`getTempoMarking`) |
| Tap tempo | Tap the key in time to set the tempo; it counts your taps. | Free | `domain/metronome.ts` |
| Beat dots | Dots show each beat of the bar and light as it plays, grouped by feel. | Free | `components/common/metronome/MetronomeBeatBar.tsx` |
| Meter | 8 time signatures: 2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8, 12/8. | Free | `components/common/metronome/MetronomeBlocks.tsx` (`MeterRow`) |
| Click on: subdivisions | In 2/4, 3/4, 4/4: Beats, Eighths, Triplets, or Sixteenths. | Free | `domain/metronome.ts` |
| Click on: groupings | 5/4 as 3+2 or 2+3 (or Eighths); 7/8 as 2+2+3, 3+2+2 or 2+3+2. | Free | `domain/metronome.ts` |
| Click on: compound feel | 6/8, 9/8, 12/8 as "In two / three / four" or every Eighth. | Free | `domain/metronome.ts` |
| Custom pattern | Tap each beat to set accent, click, or rest. | Free | `components/common/metronome/MetronomeBlocks.tsx` (`BarStrip`) |
| Beep | Audible click on or off, with a volume slider. | Free | `components/common/metronome/MetronomeBlocks.tsx` (`CueRows`) |
| Click sound | 2 voices: Click or Wood. | Free | `components/common/metronome/MetronomeBlocks.tsx` |
| Visual | Beat pulse on the dots on or off. | Free | `components/common/metronome/MetronomeBlocks.tsx` |
| Haptic | Beat vibration on or off; 3 strengths: Light, Medium, Strong. | Free | `components/common/metronome/MetronomeBlocks.tsx` |
| "Nothing sounds" hint | If every cue is off while running, it says to turn one on. | Free | `components/MetronomeScreen/components/MetronomeScreenContent.tsx` |
| Meter and Sound summary rows | Two rows show the current meter/feel and cues, and open their sheets. | Free | `components/MetronomeScreen/components/MetronomeScreenContent.tsx` |
| Screen stays awake | The screen doesn't dim while the metronome is running. | Free | `components/MetronomeScreen/hooks/useMetronomeScreenModel.ts` |
| Stops when you leave | Leaving the Metronome page stops the click. | Free | `components/MetronomeScreen/hooks/useMetronomeScreenModel.ts` |
| Settings remembered and shared | Tempo, meter, feel and cues persist, and are the same ones the recorder uses. | Free | `hooks/useMetronome.ts` |
| Bluetooth-corrected cues | With calibrated headphones, the flash and vibration are timed to when you hear the click. | Free | `hooks/useMetronome.ts` |
| Start failure message | If the click can't start, a toast says "Metronome couldn't start." | Free | `hooks/useMetronome.ts` |

---

## Built but not reachable

- **"New Collection from Import" on the workspace hub.** `components/WorkspaceBrowseScreen/hooks/useWorkspaceCollectionImportFlow.ts` has a full flow (`openCollectionImportFlow`: pick files → date choice → name a new collection → import, with duplicate review) and its name sheet is mounted in `WorkspaceBrowseScreenContent.tsx`, but nothing calls `openCollectionImportFlow`. The same outcome is reachable only through the share sheet ("New Collection from Import" on the Import from Share screen).
- **"Restore in progress / Record once the restore finishes" dialog.** The strings `recording.restoreRunningTitle` and `recording.restoreRunningBody` exist in every language but no code shows them. The live behaviour is the toast "Record after the restore" (`services/libraryOperationGate.ts`).
- **Recorder strings with no screen.** `recording.settingsHint`, `recording.auto`, `recording.playing`, `recording.stopPreview` and `settingsRecording.countIn / off / bars` (a Settings count-in default row) have no call site; count-in is set only in the recorder's metronome sheet.
- **Developer-only import rows.** "Import dev samples", "as one song" and "as received" in the collection menu exist only in development builds (`__DEV__`), never in the store app.
- **A dead helper line in the collection import hook.** `helperText` in `components/IdeaListScreen/hooks/useCollectionImportFlow.ts` (hard-coded English, "as one new song") is returned but never shown; the name sheet builds its own translated line in `CollectionModals.tsx`.
- **Legacy metronome engine.** `useLegacyMetronomeImpl` in `hooks/useMetronome.ts` and the "Rebuild the app to use the native metronome engine" messages only apply to a build without the native metronome; store builds carry it.

## Worth a decision

1. **Pins dropped while recording are free; pins in the player are Pro.** `practice-suite` gates adding a pin in the player, but the recorder's "Drop a pin" key and the pin-naming rows on the save sheet have no gate. A free user can create named pins on every take just by tapping during recording. Either intended (capture is never gated) or a hole in the pins gate.
2. **A recorded grid gives bars and beats for free; "Detect tempo" is Pro.** A take recorded with the click carries its tempo, meter and tempo changes into the player with no gate, while analysing a take that has no grid is under `practice-suite`. Consistent with "never gate capture", but worth knowing the two routes to the same grid differ.
3. **Tempo changes (programmed tempo/meter map per sketch) are free.** This is the most "power user" control in the recorder: planned changes at bar numbers that the click follows and the take remembers. No competitor voice-memo app has it. Candidate for Pro if a recording-side Pro feature is ever wanted.
4. **Bluetooth calibration is free.** A two-pass per-headphone latency calibration with fine-tune and saved profiles; it is what makes layers land in time on Bluetooth. Free today. Gating it would make the one free layer sound wrong on Bluetooth, so probably right to leave, but it is a distinctive feature.
5. **Video import is free.** Pulling the sound out of camera videos and screen recordings (from Files, Photos, or the share sheet). No server cost; a convenience some apps charge for.
6. **Import as one sketch, and share-sheet import, are free and unlimited.** No cap on file count (4 files import at a time, any number queued). No cost to us; noted only because bulk import is a common paid line elsewhere.
7. **Capo in the recorder is Pro, text size and chord show/hide are free.** The recorder's lyrics "Aa" sheet is the shared reading sheet, so a free user recording a sketch with chords meets the Pro page if they touch Capo. Consistent with `stage-tools`, but it is a paywall inside the capture screen, which the catalog says is never gated ("Never gate capture").
8. **The eighth-layer ceiling applies to Pro too.** At eight layers even a Pro user is told to Combine. Fine technically; make sure Pro copy never says "unlimited layers".
9. **Metronome and Tuner are entirely free**, including custom accent patterns, rests, odd-meter groupings, the Wood voice and haptic cues. Standalone metronome apps often charge for exactly these. Free instruments are a good reason to open the app daily; flagged so the choice is deliberate.

## Not sure

- **Whether video import is live for every installed build.** The "Videos" source and video files in the Files picker only appear when the installed app binary carries the native extractor (`canExtractVideoAudio()` in `services/audioStorage.ts`). The code hides them otherwise. I could not confirm from code which store builds people have; the memory note says it "needs new store builds" as of 2026-10-19.
- **Click sound (Wood), subdivisions and rests.** These show only when the native metronome reports support (`supportsClickStyle`, `supportsRests` in `hooks/useMetronome.ts`). Older binaries hide them. Same caveat as above about which build is installed.
- **Standalone metronome with the phone locked or the app in the background.** The page keeps the screen awake and stops the click when you leave the page; I found no code that stops it when the app is backgrounded, and none that promises it continues. Not determinable without a device.
- **iPhone recording notification / Live Activity.** The recorder passes an iOS notification category, but I found no evidence of a visible iOS notification beyond the system's own recording indicator. Listed as Android only.
- **"Recording resumes automatically" after a phone call.** `autoResumeAfterInterruption: true` is set on the native recorder and the screen stops the click and guide; whether the take truly resumes by itself on both platforms is native behaviour I could not verify from JS.
- **Welcome copy vs. where import lives.** The last welcome pane says "importing is always one tap away from the + button", but Import now sits in the collection's "…" menu (the "+"/record dock no longer holds it). Looks like stale copy, not a missing feature.
- **Duplicate detection method.** The old inventory says "by file hash". The code matches on the file's original recording time (`sourceCreatedAt`), not on its contents, so a file with no embedded/modified date is never flagged, and two different files stamped the same millisecond would be. Listed as built; flagging the difference from the earlier description.
- **Recovered takes' destination when the original idea is gone.** `services/recordingRecovery.ts` lands a recovered take in the idea it was for; otherwise it creates a "Recovered · <date>" clip in a writable workspace. I did not trace every fallback branch. (The "Recovered" collection string belongs to a different feature, the orphaned-audio recovery in `state/actions.ts`, not to the recorder.)
