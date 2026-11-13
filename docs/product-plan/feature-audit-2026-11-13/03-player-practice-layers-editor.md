# 03 · Listening, practising, layers, and editing audio

Read from code on 2026-11-13 (main at 2442cd38). Every row is something a person can reach in the app today. Paths are under `src/` unless they start with `modules/`.

How the gates in this area work, in one place:

- **Practice tools** go through one check, `guardPracticeTool` (`components/PlayerScreen/index.tsx:1319`). Today it stops three things for a free person: adding a pin from the Marks list, changing pitch, and switching Step up on. Loop and speed pass through it but are set free. Nothing else in Tools is checked at all.
- **Layers**: one check, on the "Layer" key (`PlayerScreen/index.tsx:1292`). A free person can record a layer onto a take that has none.
- **Editor**: one live check, on opening the "Speed & pitch" tab (`EditorScreen/index.tsx:629`).
- A clip that came in a received parcel uses the practice tools free. A parcel (until Keep) and an archived workspace are read-only: no layer, trim, write or delete.
- Existing work always opens: a take with a pitch kept, many layers, or many pins plays and edits for everyone.

---

## Playing back

### Now-playing dock

| Feature | What it does | Status | Where |
|---|---|---|---|
| Now-playing dock | A bar at the bottom shows the playing clip while you browse the rest of the app. | Free | components/GlobalMediaDock.tsx |
| Title and context line | Shows the clip name, then its sketch and collection, so a loose clip is never bare. | Free | components/GlobalMediaDock.tsx |
| Progress line | A thin line along the dock's top edge shows how far through the clip you are. | Free | components/GlobalMediaDock.tsx |
| Play / pause | Starts or pauses the playing clip from the dock. | Free | components/GlobalMediaDock.tsx |
| Previous | Past 3 seconds it restarts the clip; before that it goes to the previous clip in the queue. | Free | domain/transportPrevious.ts |
| Next | Skips to the next clip in the queue; greyed out on the last one. | Free | components/GlobalMediaDock.tsx |
| Queue button with count | Opens the queue; shows "2/7" beneath when the queue holds more than one clip. | Free | components/GlobalMediaDock.tsx |
| Open full player (tap) | Tapping the dock's title opens the full player. | Free | components/GlobalMediaDock.tsx |
| Open full player (swipe up) | Swiping up on the dock pulls the full player up under your finger. | Free | components/GlobalMediaDock.tsx |
| Dismiss (✕) | Ends the listening session: stops the sound, clears the queue, hides the dock. | Free | components/GlobalMediaDock.tsx |
| "Preview playing" line | While a card's own preview plays over a paused session, the dock says so. | Free | components/GlobalMediaDock.tsx |
| One sound at a time | Starting the dock or full player stops a card preview, and the other way round. | Free | hooks/FullPlayerProvider.tsx |
| Dock steps aside | The dock lifts above a selection toolbar and hides while the side menu is open. | Free | components/GlobalMediaDock.tsx |
| Recording pill | While a take records in the background the dock shows a red "Recording" pill with its timer. | Free | components/GlobalMediaDock.tsx |
| Recording pill: pause / resume | Pauses or resumes the running take from the dock. | Free | components/GlobalMediaDock.tsx |
| Recording pill: Save take | Stops the take and opens the recorder to save it. | Free | components/GlobalMediaDock.tsx |
| Recording pill: reopen recorder | Tapping the pill returns to the recorder. | Free | components/GlobalMediaDock.tsx |

### Full player sheet

| Feature | What it does | Status | Where |
|---|---|---|---|
| Full player | A card that rises over the page with the reel, transport, tools and the clip's pages. | Free | components/PlayerSheet.tsx |
| Page dims behind the card | The page underneath darkens as the player rises, so it reads as laid over where you were. | Free | components/PlayerSheet.tsx |
| Drag down to collapse | Drag the header, footer or blank paper down (a quarter of the screen, or a flick) to dock the player. | Free | components/PlayerScreen/index.tsx |
| Tap the grabber to collapse | Tapping the small handle at the top docks the player. | Free | components/PlayerScreen/components/PlayerHeaderSection.tsx |
| Android back collapses | The Android back button or gesture docks the player instead of leaving the page. | Free (Android) | components/PlayerScreen/index.tsx |
| Collapsing keeps the session | Docking never stops playback or loses your place; only ✕ ends a session. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Close (✕) in the footer | Ends the session from the full player, same as the dock's ✕. | Free | components/PlayerScreen/components/PlayerFooterSection.tsx |
| Header details | Shows the clip title, its sketch, the date, the layer count and a live time readout. | Free | components/PlayerScreen/components/PlayerHeaderSection.tsx |
| Compact header | With Tools or a page open, the title shrinks to one line and a "0:12 / 3:40" row appears. | Free | components/PlayerScreen/index.tsx |
| Play / pause | The main play button; at the end of a clip, play starts again from the top. | Free | components/PlayerScreen/components/PlayerFooterSection.tsx |
| Previous | Past 3 seconds restarts the take; before that, the previous clip in the queue. | Free | components/PlayerScreen/index.tsx |
| Next | Skips to the next clip in the queue. | Free | components/PlayerScreen/components/PlayerFooterSection.tsx |
| Queue button with count | Opens the queue sheet from the footer; shows "2/7" when the queue has several clips. | Free | components/PlayerScreen/components/PlayerFooterSection.tsx |
| Plays through the queue | When a clip ends, the next one in the queue starts by itself, docked or open. | Free | hooks/FullPlayerProvider.tsx |
| End of the queue | After the last clip, playback rests at the end; the session stays and play restarts it. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Repeat | With Tools open, the footer's last button becomes Repeat: the clip replays each time it ends. | Free | components/PlayerScreen/components/PlayerFooterSection.tsx |
| Opens where the card preview stood | Opening the player on a clip whose card preview was playing carries on from that spot. | Free | hooks/FullPlayerProvider.tsx |
| Closes if the clip is deleted | If the playing clip is deleted elsewhere, the player closes itself. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Waveform status captions | While a wave is still being read the reel says "Reading waveform…", "Waveform after playback" or "Waveform coming…". | Free | components/common/AudioReel.tsx |
| Lost mix repairs itself | If a layered take's mixed file goes missing, the take plays its base and the mix is rebuilt. | Free | hooks/useFullPlayer.ts |

### Background, lock screen and hardware buttons

| Feature | What it does | Status | Where |
|---|---|---|---|
| Background playback | Playback keeps going with the phone locked or another app in front. | Free | services/audioSession.ts |
| Plays in silent mode | Playback sounds even with the iPhone's silent switch on. | Free (iOS) | services/audioSession.ts |
| Takes over from other apps | Starting playback stops music from other apps rather than mixing with it. | Free | services/audioSession.ts |
| Lock-screen / notification card | Shows the take name, its sketch (or collection) and collection, with SongNook artwork. | Free | services/lockScreenMetadata.ts |
| Lock-screen play / pause | Plays or pauses from the lock screen or notification. | Free | hooks/useFullPlayer.ts |
| Lock-screen previous / next | Steps through the queue; previous restarts first after 3 seconds; next greys out at the end. | Free | hooks/useFullPlayer.ts |
| Lock-screen scrubber | Dragging the system scrubber moves the playhead in the clip. | Free | hooks/useFullPlayer.ts |
| Headphone and Bluetooth buttons | Play, pause and skip from headset or car controls. | Free | hooks/useFullPlayer.ts |
| Card stays while paused | The lock-screen card stays up through pauses and card previews until the session ends. | Free | hooks/useFullPlayer.ts |
| Controls work with pitch or tone on | Dock, lock screen and headset keep working while the pitched or toned sound plays. | Free | hooks/useNativePitchTransport.ts |
| Sound settings stay when docked | A clip keeps its pitch, level and tone when the player is docked or the menu opens. | Free | components/PlayerScreen/hooks/usePlayerPracticePitchTransport.ts |
| Android card clears itself | After the queue ends and sits idle, Android's media card and session end on their own. | Free (Android) | hooks/FullPlayerProvider.tsx |

---

## Queue

| Feature | What it does | Status | Where |
|---|---|---|---|
| Queue sheet | Lists what is playing next; opens at half height, pulls up to full screen, drags down to close. | Free | components/QueuePanel.tsx |
| Position readout | The header reads "3 of 12". | Free | components/QueuePanel.tsx |
| Rests on the playing row | The list opens at the playing clip and follows it on a track change unless you scrolled away. | Free | components/QueuePanel.tsx |
| Row details | Each row shows its number (or a playing indicator), title, sketch name and length. | Free | components/QueuePanel.tsx |
| Tap a row to jump | Tapping a row plays that clip and keeps the queue open. | Free | components/QueuePanel.tsx |
| Shuffle | Mixes the queue order without stopping the playing clip; tapping again restores the order. | Free | state/playerSlice.ts |
| Playlist | Keeps the queue, in this order, as a new playlist or adds it to one you have. | Free | components/QueuePanel.tsx |
| Edit: remove | In Edit, the minus removes a clip from the queue; removing the last one ends the session. | Free | components/QueuePanel.tsx |
| Edit: reorder | In Edit, hold a row's handle and drag to change the order. | Free | components/QueuePanel.tsx |
| View in collection | A row's glyph docks the player and opens the clip's collection with its card highlighted. | Free | components/QueuePanel.tsx |

---

## The reel

| Feature | What it does | Status | Where |
|---|---|---|---|
| Waveform reel | The clip's wave rolls like tape under a fixed playhead; played and unplayed sides differ. | Free | components/visualizers/PlaybackTapeVisualizer.tsx |
| Drag to scrub | Drag the tape to move through the clip; a tick is felt for each second crossed. | Free | components/visualizers/PlaybackTapeVisualizer.tsx |
| Flick | A fast flick lets the tape coast and settle before it seeks. | Free | components/visualizers/PlaybackTapeVisualizer.tsx |
| Bar magnet | On a take recorded with the metronome, a scrub that lands near a bar line settles on it. | Free | components/common/AudioReel.tsx |
| Pinch to zoom | Two fingers stretch the tape through five zoom levels: 1×, 2×, 4×, 8×, 16×. | Free | components/common/AudioReel.tsx |
| Zoom control | A magnifier on the reel opens zoom out, zoom in and fit-whole-clip keys; it folds away after a few seconds. | Free | components/common/AudioReel.tsx |
| Opening zoom | Clips open zoomed in (up to 8×), never showing less than about 8 seconds. | Free | components/PlayerScreen/playerZoom.ts |
| Minimap | When zoomed in, a small map of the whole clip appears under the reel. | Free | components/visualizers/MinimapVisualizer.tsx |
| Minimap tap and drag | Tap the map to jump there, or drag along it to cross a long clip fast. | Free | components/visualizers/MinimapVisualizer.tsx |
| Bars and beats ruler | A take recorded with the metronome shows bar lines, beat ticks, bar numbers and tempo changes. | Free | components/visualizers/PlaybackTapeVisualizer.tsx |
| Sections on the reel | Sections show as named, coloured rules along the reel's bottom edge. | Free | components/visualizers/PlaybackTapeVisualizer.tsx |
| Pins on the reel | Pins show as small named heads on a line across the tape. | Free | components/PlayerScreen/PracticePinBadges.tsx |
| Tap a section name to jump | Tapping a section's name on the reel moves the playhead to its start. | Free | components/PlayerScreen/components/PlayerTimeline.tsx |
| Tap a pin to jump | Tapping a pin on the reel moves the playhead to it. | Free | components/PlayerScreen/PracticePinBadges.tsx |
| Marks on / off | The "Marks" key hides or shows sections and pins on the reel; shown only if the clip has marks. | Free | components/PlayerScreen/components/MarksToggle.tsx |
| Lyric headings as markers | A take with no pins shows up to four lyric headings ("Chorus:", "[Verse]") as rough markers. | Free | components/PlayerScreen/helpers.ts |
| Loop drawn on the reel | An active loop is drawn on the tape with its two edges and a move bar beneath. | Free | components/PlayerScreen/components/PlayerTimeline.tsx |
| Reel resizes with the page | The reel takes half the page when listening and slims down when Tools or a page opens. | Free | domain/reelLanes.ts |
| Quiet wave while soloing | While a layer is soloed the take's own wave is drawn as silent. | Free | components/PlayerScreen/components/PlayerTimeline.tsx |

---

## Marks: sections and pins

### Sections

| Feature | What it does | Status | Where |
|---|---|---|---|
| Add a section | "+ Section" in Tools › Marks drops a section at the playhead. | Free | components/PlayerScreen/hooks/usePlayerSections.ts |
| Section types | Pick Intro, Verse, Pre-chorus, Chorus, Bridge, Solo or Outro. | Free | components/PlayerScreen/components/sectionModals.tsx |
| Custom section | "New custom" makes a section with your own name and one of eight inks. | Free | components/PlayerScreen/components/sectionModals.tsx |
| Reuse a custom type | Custom section names already used on the clip are offered again in the picker. | Free | domain/playerSections.ts |
| Smart placement | If the playhead spot is taken, the new section goes after the last one. | Free | components/PlayerScreen/hooks/usePlayerSections.ts |
| Hold a section to adjust | Tapping a row opens its Start and End boxes without moving the playhead. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Edge slider | A slider moves the chosen edge across what the reel shows, with a live preview on the tape. | Free | components/common/SpanInspector.tsx |
| Nudge ‹ › | Arrows move an edge one second at rest, finer as you zoom in, down to 50 ms. | Free | components/common/MarkInspector.tsx |
| Use playhead | Sets the chosen edge to where the playhead is. | Free | components/common/MarkInspector.tsx |
| Type a time | Hold a Start or End box to type its time. | Free | components/common/MarkInspector.tsx |
| Prev end / Next start | One tap snaps an edge to the neighbouring section's edge. | Free | components/common/SpanInspector.tsx |
| Push a neighbour | Moving an edge into the next section pushes that section's edge along. | Free | domain/playerSections.ts |
| Slide a section on the reel | With Tools open, hold a section's name on the reel and drag to move it whole. | Free | components/PlayerScreen/components/PlayerTimeline.tsx |
| Edit name and ink | The "…" on a held section changes its name and ink. | Free | components/PlayerScreen/components/sectionModals.tsx |
| Delete a section | The trash in the section's edit dialog removes it. | Free | components/PlayerScreen/components/sectionModals.tsx |
| Play from a section | The play glyph on a row jumps there and plays, honouring the count-in choice. | Free | components/PlayerScreen/index.tsx |
| "You are here" in the list | The section being played is washed lighter; passed marks fade; pins sit grouped under their section. | Free | domain/markPhase.ts |
| Undo / redo marks | Steps back or forward through every section and pin change on this clip. | Free | components/common/useUndoHistory.tsx |

### Pins

| Feature | What it does | Status | Where |
|---|---|---|---|
| Add a pin | "+ Pin" in Tools › Marks drops a pin at the playhead and asks its name. Free on parcel clips. | Pro | components/PlayerScreen/index.tsx:2103 |
| See and jump to pins | Existing pins show on the reel and in the Marks list for everyone. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Pins from the recorder | Pins dropped while recording arrive on the saved take. | Free | components/RecordingScreen/hooks/useRecordingScreenModel.ts |
| Name and note | A pin takes a name (up to 18 characters) and a free-text note shown under it. | Free | components/PlayerScreen/components/PinDetailModal.tsx |
| Numbered unnamed pins | Pins without a name read "Pin 1", "Pin 2" in time order. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Move a pin in the list | Slider, nudge arrows, Use playhead, or hold to type a time. | Free | components/common/MarkInspector.tsx |
| Drag a pin on the reel | With Tools open, hold a pin on the tape and drag it to a new spot. | Free | components/visualizers/PlaybackTapeVisualizer.tsx |
| Hold a pin to edit | With Tools open, holding a pin on the reel opens its name, note and delete. | Free | components/PlayerScreen/index.tsx |
| Delete a pin | The trash in the pin's edit dialog removes it. | Free | components/PlayerScreen/hooks/usePlayerPins.ts |
| Play from a pin | The play glyph on a pin's row jumps there and plays. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |

---

## Practice tools

### The Tools drawers

| Feature | What it does | Status | Where |
|---|---|---|---|
| Tools key | Opens three drawers under the reel: Marks, Loop, Sound. Opening and looking is always free. | Free | components/PlayerScreen/index.tsx |
| Running dots | A dot on the Loop or Sound tab shows that something in it is switched on. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Reset all | Puts loop, Step up, speed, pitch, click, count-in, level and tone back to neutral. | Free | components/PlayerScreen/index.tsx |
| Keep (Loop) | A switch: the take remembers its loop and count-in and opens with them next time. | Free | components/PlayerScreen/index.tsx |
| Keep (Sound) | A switch: the take remembers its speed, pitch and click and opens with them next time. | Free | components/PlayerScreen/index.tsx |
| Settings stay with their clip | In one session each clip keeps its own speed, pitch, click, count-in and loop as the queue moves. | Free | components/PlayerScreen/hooks/usePerClipPractice.ts |

### Loop

| Feature | What it does | Status | Where |
|---|---|---|---|
| Loop | A switch that repeats a stretch of the clip; it starts as a quarter of the clip. | Free | components/PlayerScreen/hooks/usePracticeLoopController.ts |
| Loop Start / End boxes | Picking an edge cues the playhead: the start exactly, the end two seconds early. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Loop edge slider and nudges | Slider, ‹ › arrows, Use playhead and typed times move either loop edge; shortest loop is 1 second. | Free | components/common/SpanInspector.tsx |
| Drag loop edges on the reel | Drag either end of the loop on the tape itself. | Free | components/common/TimeRangeSelector.tsx |
| Move the whole loop | A bar under the reel slides the loop along without changing its length. | Free | components/common/LoopMoveHandle.tsx |
| Loop a part | Tap a section's name in the Loop drawer to loop exactly that section. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Loop while writing | The lyric writer's bar has a Loop key, so a part repeats while you write. | Free | components/PlayerScreen/index.tsx |
| Loop what | While writing, a picker loops one of the first five sections or the whole take. | Free | components/PlayerScreen/index.tsx |
| Loop with the screen off | The loop keeps wrapping while the phone is locked. | Free | components/PlayerScreen/hooks/usePracticeLoopController.ts |

### Step up

| Feature | What it does | Status | Where |
|---|---|---|---|
| Step up | A switch: the loop starts slow and speeds up as passes repeat; it starts the loop. Free on parcel clips. | Pro | components/PlayerScreen/index.tsx:2087 |
| Step up plan sheet | Opens the plan: pick a drill and edit its steps. It opens for everyone; running it needs Step up. | Free | components/PlayerScreen/components/StepUpSequenceSheet.tsx |
| Ready drills | Three plans: Slow build (0.5× up by 0.05 each pass), Steady climb (0.6× to 1×), Final polish (0.85× to 1×). | Free | domain/stepUpLoop.ts |
| Custom plan | Your own plan, remembered across clips: 1 to 12 steps, each 1 to 20 passes at a speed. | Free | components/PlayerScreen/components/StepUpSequenceSheet.tsx |
| Step speeds in BPM | With the speed dial set to BPM, steps read and move in bpm, five at a time. | Free | components/PlayerScreen/components/StepUpSequenceSheet.tsx |
| Progress line | While a drill runs: dots for passes, "3 / 10" and the live speed. | Pro | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Restart drill | A refresh glyph starts the running drill again from its first step. | Pro | components/PlayerScreen/hooks/useStepUpLoop.ts |
| Drill finishes | After the last pass playback stops with a "Step up done" toast and the drill rewinds. | Pro | components/PlayerScreen/index.tsx |
| Speed returns after a drill | Ending a drill puts the speed back to what you had set before it. | Pro | components/PlayerScreen/hooks/useStepUpLoop.ts |
| Click fences the drill | With the click on, the drill stays inside speeds the click can sound at. | Pro | domain/stepUpLoop.ts |
| Step up help | A "?" beside Step up explains the tool in one sheet. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |

### Count-in on playback

| Feature | What it does | Status | Where |
|---|---|---|---|
| Count-in | A switch in the Loop drawer: play starts behind a short run-up. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| 3 seconds | Backs the playhead up three seconds and plays, so you hear where you are. Works on any clip. | Free | components/PlayerScreen/index.tsx |
| 1 bar / 2 bars | Clicks one or two bars before playback starts. Only on takes recorded with the metronome. | Free | hooks/usePlaybackClick.ts |
| Count-in on "play from" | Playing from a section or pin row uses the same count-in. | Free | components/PlayerScreen/index.tsx |
| Tap to cancel | Pressing play during the count-in cancels it. | Free | components/PlayerScreen/index.tsx |

### Speed

| Feature | What it does | Status | Where |
|---|---|---|---|
| Speed | Plays slower or faster without changing pitch: 0.5× to 1.5×, heard live. | Free | components/common/SpeedPitchDials.tsx |
| Speed slider | Steps of 0.05 with a felt stop every tenth. | Free | components/common/SpeedPitchDials.tsx |
| Speed − / + keys | Fine steps of 0.05 (or 1 bpm) without the slider. | Free | components/common/SpeedPitchDials.tsx |
| Speed presets | Tap 0.5, 0.75, 1, 1.25 or 1.5 under the slider. | Free | components/PlayerScreen/index.tsx |
| Speed in BPM | On a take recorded with the metronome, "Speed · BPM" tabs let the dial read and step in bpm. | Free | domain/tempoSpeed.ts |
| Reset speed | A small refresh beside the label returns to normal speed. | Free | components/common/SpeedPitchDials.tsx |
| Speed while following a page | With Follow on, a − / + stepper in the reading bar changes speed through the presets. | Free | components/PlayerScreen/components/PlayerArtifactReader.tsx |

### Pitch

| Feature | What it does | Status | Where |
|---|---|---|---|
| Pitch | Shifts the key by semitones without changing speed: −12 to +12. Free on a parcel's clip. | Pro | components/PlayerScreen/index.tsx:2139 |
| Reset pitch | The refresh beside Pitch returns to the original key. It passes the same check as changing pitch. | Pro | components/common/SpeedPitchDials.tsx |
| A kept pitch still plays | A take that kept a pitch (set with Pro or in the free month) opens and plays pitched for everyone. | Free | components/PlayerScreen/hooks/usePerClipPractice.ts |
| Pitch unavailable | On a build without the sound engine, the pitch value reads "—" and the keys are off. | Free | components/common/SpeedPitchDials.tsx |

---

## Tempo and grid

| Feature | What it does | Status | Where |
|---|---|---|---|
| Click on playback | A switch in Sound: the metronome clicks along with a take that was recorded to it. | Free | hooks/usePlaybackClick.ts |
| Tempo summary | Beside Click: the take's tempo and meter, or "92 · 3/4 → 102 · 4/4" when it changes. | Free | components/PlayerScreen/index.tsx |
| Click volume | A slider for the click's loudness against the song, 0 to 100 in steps of 5. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Click sound | Choose "Click" or "Wood", shared with the metronome. Shown where the build supports it. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Click haptic | A switch that taps the beat in your hand. Shown only where the engine can do it. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Click follows the take | The click re-aligns after a seek or speed change and stops where the grid is no longer trusted. | Free | hooks/usePlaybackClick.ts |
| Click row hidden without a grid | A clip not recorded with the metronome shows no Click row and no bar count-ins. | Free | components/PlayerScreen/components/PlayerPracticeDrawers.tsx |
| Grid on the reel | Bars, beats and tempo changes are drawn on the reel for takes recorded with the metronome. | Free | domain/gridRuler.ts |
| Grid survives combining | A combined (mixed-down) clip keeps the take's grid, so its click and ruler still work. | Free | state/actions.ts |

---

## Sound

| Feature | What it does | Status | Where |
|---|---|---|---|
| Level | The take's own volume, −12 to +12 dB in 1 dB steps, saved with the take. | Free | components/common/LevelToneStrip.tsx |
| Tone | Four switches saved with the take: Low cut, Low boost, Mid boost, Hi cut. The two Lows exclude each other. | Free | domain/overdub.ts |
| Reset level / Reset tone | A small refresh beside each returns it to neutral. | Free | components/common/LevelToneStrip.tsx |
| Limiter | Loud level, pitch and layer mixes pass through a limiter so they do not distort. | Free | modules/songnook-pitch-shift |
| Mix headroom | Each layer added lowers every part slightly so a full stack does not clip. | Free | domain/overdub.ts |

---

## Pages under the reel (notes, lyrics, chart)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Notes page | Any clip or take carries a note: a tile shows it, an empty slot invites one. | Free | components/PlayerScreen/components/PlayerArtifactDoors.tsx |
| Write a note | The note opens in a sheet to write in place; it saves to the take it was opened on. | Free | components/PlayerScreen/components/PlayerSupportSections.tsx |
| Lyrics tile | Shows the first lines of the sketch's lyrics, its version ("v2 of 4 · date") and its chords. | Free | components/PlayerScreen/components/PlayerArtifactDoors.tsx |
| Chart tile | Shows the chart's first bars and its bar count. | Free | components/PlayerScreen/components/PlayerArtifactDoors.tsx |
| Empty Lyrics slot | "+ Lyrics" opens the writer under the reel. | Free | components/PlayerScreen/components/PlayerArtifactDoors.tsx |
| Empty Chart slot | "+ Chart" docks the player and opens the sketch's chart editor. | Free | components/PlayerScreen/index.tsx |
| Slots on a loose clip | On a clip, Lyrics and Chart slots offer "Make sketch", since pages live in a sketch. | Free | components/PlayerScreen/components/PlayerArtifactDoors.tsx |
| Sketch card (first time) | Before any sketch exists, one card explains a sketch and offers "Make sketch". | Free | components/PlayerScreen/components/PlayerArtifactDoors.tsx |
| Read lyrics or chart | A tile opens its page under a slimmer reel; the tape still scrubs and zooms. | Free | components/PlayerScreen/components/PlayerArtifactReader.tsx |
| Follow | Scrolls the page in step with playback, at any speed. | Free | components/PlayerScreen/components/PlayerArtifactReader.tsx |
| Resync | After you scroll by hand, a "Resync" key returns the page to the playhead. | Free | components/PlayerScreen/components/PlayerArtifactReader.tsx |
| Text size | The "Aa" sheet's slider sets the reading size, shared with the songbook and setlists. | Free | components/common/ReadingSheet.tsx |
| Chords on / off | In the "Aa" sheet, show or hide chords over the lyrics. | Free | components/common/ReadingSheet.tsx |
| Capo | In the "Aa" sheet, set a capo fret (up to 11). Free on parcel songs; taking it off is free. | Pro | components/common/ReadingSheet.tsx:74 |
| Transpose | A − / + bar above the page shifts the chords by half steps. Free on a parcel's song. | Pro | components/common/TransposeChip.tsx:34 |
| Chords follow playback pitch | While pitch is shifted, a line says by how much and a switch picks capo shapes or moved chords. | Free | components/common/SongReading.tsx |
| Full view | Hides the reel so the page fills the screen; a thin line above the transport shows position. | Free | components/PlayerScreen/index.tsx |
| Seek in full view | Tap or drag along that thin line to move through the clip. | Free | components/PlayerScreen/index.tsx |
| Edit from the page | The pencil opens the lyric writer, or the chart editor for a chart. | Free | components/PlayerScreen/index.tsx |
| Write against the tape | Lyrics are typed under the slim reel while it plays; words save by themselves as you pause. | Free | components/PlayerScreen/components/PlayerLyricsWriter.tsx |
| Play / pause in the writer bar | The writing bar carries its own play key while the keyboard covers the transport. | Free | components/PlayerScreen/index.tsx |
| New version while writing | Start a fresh lyric version "From current" or "Blank" without leaving the player. | Free | components/PlayerScreen/index.tsx |
| Safe save over newer words | If the words changed elsewhere, the writer saves as a new version instead of overwriting. | Free | components/PlayerScreen/writerLyricsSave.ts |
| Take's words vs latest | A take recorded on an older lyric version shows that version; one tap flips to the latest. | Free | components/PlayerScreen/index.tsx |
| "Words edited since this take" | A small pencil marks lyrics that changed after the take was recorded. | Free | domain/lyrics.ts |
| Marks key while reading | A small pin glyph in the reading bar hides or shows marks on the slim reel. | Free | components/PlayerScreen/components/MarksToggle.tsx |
| Page closes on a new idea | Moving to a different sketch or clip closes the open page; another take of the same sketch keeps it. | Free | components/PlayerScreen/index.tsx |
| Read-only pages | In a received parcel (until Keep) or an archive, pages open to read with no write slots. | Free | components/PlayerScreen/components/PlayerArtifactDoors.tsx |

---

## Layers

### Adding and seeing layers

| Feature | What it does | Status | Where |
|---|---|---|---|
| Layer key | Beside Tools: records a new layer over the take, starting at the playhead. | Free up to 1 layer per take, then Pro | components/PlayerScreen/index.tsx:1292 |
| Starts where you are | Playback pauses and the layer punches in at the playhead; near the top it is a full-length layer. | Free up to 1 layer per take, then Pro | components/PlayerScreen/index.tsx |
| Punch-in lands on a bar | On a take with a grid, the punch-in point snaps to the nearest bar line. | Free up to 1 layer per take, then Pro | domain/overdub.ts |
| Eight-layer limit | A take holds at most 8 layers, for everyone, Pro included; at 8 a dialog offers Combine. | Free | components/PlayerScreen/index.tsx:1277 |
| Layered takes always open | A take with any number of layers plays and edits for everyone. | Free | domain/proGating.ts |
| Layer count in the header | The player's header shows "3 layers". | Free | components/PlayerScreen/components/PlayerHeaderSection.tsx |
| Layer lanes | Each layer is a row under the reel: name, time span and its own wave, moving with the reel. | Free | components/common/OverdubLayerLanes.tsx |
| Playhead through the lanes | The reel's playhead runs down through the lanes as one line. | Free | components/common/OverdubLayerLanes.tsx |
| "Layers · n" header | Tapping it hides or shows all the lanes; the choice is remembered. | Free | state/useLayerPrefsStore.ts |
| Collapse all / Expand all | Folds every lane to its name line, or opens them again. | Free | components/common/OverdubLayerLanes.tsx |
| Lanes scroll past three | More than three lanes scroll inside their strip. | Free | components/common/OverdubLayerLanes.tsx |
| Off-screen hint | A lane whose audio is out of view shows which way it lies. | Free | components/common/OverdubLayerLanes.tsx |
| Lanes fold while reading | With a page open, the lanes fold to their header; a tap opens them. | Free | components/PlayerScreen/components/PlayerTimeline.tsx |

### Solo and mute

| Feature | What it does | Status | Where |
|---|---|---|---|
| Solo | A switch on each lane: hear only the soloed layers, any number at once, in time with the reel. | Free | services/soloMix.ts |
| Solo is for listening only | Solo is never saved; it ends when the clip changes or the player is docked. | Free | components/PlayerScreen/index.tsx |
| Solo beats mute | A muted layer still plays when it is soloed. | Free | domain/overdub.ts |
| Mute | A switch on each lane silences that layer; saved with the take. | Free | state/actions.ts |
| Silent layers look off | A muted layer, or one left out by a solo, is drawn faded. | Free | components/common/OverdubLayerLanes.tsx |
| Playback carries on during a re-mix | Changing a layer never stops the song; the new mix swaps in at the same spot. | Free | hooks/useFullPlayer.ts |

### The layer's sheet

| Feature | What it does | Status | Where |
|---|---|---|---|
| Open a layer | Tapping a lane opens that layer's sheet: title, time span and its controls. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| Play from the layer | Plays the song from two seconds before the layer comes in. | Free | components/PlayerScreen/index.tsx |
| Solo in the sheet | The same Solo switch as on the lane. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| Alignment strip | Shows the layer's wave over the take's wave, with beat ticks when the take has a grid. | Free | components/PlayerScreen/components/StemAlignmentOverlay.tsx |
| Drag to move | Slide the layer along the strip; it snaps to a beat when within 60 ms of one. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| Zoom / Full clip | Switches the strip between the whole clip and a 4-second close-up around the layer's start. | Free | components/PlayerScreen/components/StemAlignmentOverlay.tsx |
| Timing readout | Says "In place" or how many ms the layer sits from where it was recorded. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| Timing nudge | Four keys move the layer −25, −10, +10 or +25 ms, up to about 2 seconds either way. | Free | domain/overdub.ts |
| Original | Returns the layer to where it was recorded. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| Layer level | The layer's own volume, −12 to +12 dB. | Free | components/common/LevelToneStrip.tsx |
| Layer tone | Low cut, Low boost, Mid boost, Hi cut for this layer alone. | Free | components/common/LevelToneStrip.tsx |
| Rename | From the sheet's "…": give the layer a name. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| Remove | From the sheet's "…": deletes the layer after a confirm; its audio goes too. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| "Updating layer mix" | A small spinner in the sheet while the mix rebuilds. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| Layers help | A "?" in the sheet explains layers, level and tone, timing and editing. | Free | components/common/helpContent.ts |

### Merging and combining

| Feature | What it does | Status | Where |
|---|---|---|---|
| Merge layers | Under the lanes (two or more layers): pick layers, name the result, and they become one layer. | Free | components/PlayerScreen/components/PlayerLayersBench.tsx |
| Merge keeps the sound | Each merged layer keeps its place, level and tone, so the take sounds the same after. | Free | domain/overdub.ts |
| Combine layers › New clip | Mixes the take and all layers into one new clip; the take keeps its layers. | Free | state/actions.ts |
| Combine layers › Replace take | Mixes everything into one clip that takes the take's place; layers can't be edited after. | Free | state/actions.ts |
| Combine keeps older versions | Replacing a take that has older versions under it leaves those versions in place. | Free | state/actions.ts |
| Combine as new clip (menu) | The same new-clip mixdown from the player's "…" menu. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Combine and edit (menu) | Makes the combined clip and opens it in the editor in one step. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Layers in a parcel or archive | In a received parcel (until Keep) or an archive, layers can be soloed but not changed. | Free | domain/layerAffordances.ts |

---

## Editing a clip

### Getting in

| Feature | What it does | Status | Where |
|---|---|---|---|
| Trim audio | The player's "…" menu opens "Edit clip". This menu is the only way into the editor. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Layered take: combine first | A take with layers shows "Combine the layers first"; one key makes a combined copy and opens it. | Free | components/EditorScreen/index.tsx |
| Editor header | Shows the clip, the playhead time and length, a back chevron and a help "?". | Free | components/EditorScreen/components/EditorHeaderSection.tsx |
| Editor help | One sheet: Keep or remove, Saving, Speed & pitch. | Free | components/common/helpContent.ts |

### Keep and Remove

| Feature | What it does | Status | Where |
|---|---|---|---|
| Keep tab | Mark the parts you want; each part you keep becomes its own clip. | Free | components/EditorScreen/index.tsx |
| Remove tab | Mark the parts you don't want; they are cut out and the rest is joined into one clip. | Free | components/EditorScreen/index.tsx |
| Switching tabs keeps your parts | Flipping between Keep and Remove turns every marked part to the new kind. | Free | components/EditorScreen/hooks/useEditorSelectionState.ts |
| Add part | Marks a new part at the playhead, an eighth of the clip long (at least 1 second). | Free | components/EditorScreen/hooks/useEditorSelectionState.ts |
| Any number of parts | There is no limit on parts in one edit. | Free | domain/proCatalog.ts |
| Split here | With the playhead inside a part, the same key splits that part in two. | Free | components/EditorScreen/hooks/useEditorSelectionState.ts |
| "No room" notice | Parts must be at least 1 second; a notice says so when a new one won't fit. | Free | components/EditorScreen/hooks/useEditorSelectionState.ts |
| Parts list | Each part is a row with play glyph, name or number and its times; "Parts · 3" counts them. | Free | components/EditorScreen/components/EditorPartsList.tsx |
| Hold a part to adjust | Tapping a row opens Start and End boxes, slider, nudges, Use playhead and typed times. | Free | components/common/SpanInspector.tsx |
| Drag a part's edges on the reel | The held part is drawn on the tape; drag either end. | Free | components/EditorScreen/index.tsx |
| Move a part | A bar under the reel slides the held part along without resizing it. | Free | components/common/LoopMoveHandle.tsx |
| Prev end / Next start | One tap snaps a part's edge to its neighbour. | Free | components/common/SpanInspector.tsx |
| Keep to grid | On a take with a grid (on by default): edges land on bars, or beats when zoomed in. | Free | components/EditorScreen/components/EditorPartsHead.tsx |
| Nudges ignore the grid | The ‹ › arrows always move freely, as a way off the grid. | Free | components/EditorScreen/index.tsx |
| Part names | In Keep, each part can be named; unnamed ones get a suggested title. | Free | components/EditorScreen/components/EditorPartsList.tsx |
| Delete part | Removes a marked part from the edit. | Free | components/EditorScreen/components/EditorPartsList.tsx |
| Play from a part | A row's play glyph plays from that part's start. | Free | components/EditorScreen/components/EditorPartsList.tsx |
| Play the held part | With a part held, play plays that part and stops at its end. | Free | components/EditorScreen/index.tsx |
| Play / pause | The editor's own transport plays the clip being edited. | Free | components/EditorScreen/index.tsx |
| To start / To end | The skip keys jump to the clip's start and end. | Free | components/EditorScreen/index.tsx |
| Editor reel | The same reel as the player: scrub, pinch zoom, zoom keys, minimap, bars and beats. | Free | components/common/AudioReel.tsx |
| Song marks as a guide | The clip's sections and pins show faintly on the editor's reel to cut against. | Free | components/EditorScreen/index.tsx |
| Other parts on the reel | Parts not being held show as named bands in the keep or remove colour. | Free | components/EditorScreen/index.tsx |

### Saving an edit

| Feature | What it does | Status | Where |
|---|---|---|---|
| Save clips (Keep) | Opens a receipt listing each new clip with its name and length, then saves them. | Free | components/EditorScreen/components/EditorSaveSheet.tsx |
| Save copy (Remove) | Saves one new clip with the marked parts cut out; shows "0:12 removed from …" and a name field. | Free | components/EditorScreen/components/EditorSaveSheet.tsx |
| "Nothing left" | If the removals cover the whole clip, the save key is off and says why. | Free | components/EditorScreen/components/EditorFooterSection.tsx |
| Original stays by default | Every edit saves as a new clip; the source is untouched. | Free | components/EditorScreen/hooks/useEditorExportFlow.ts |
| Also delete the original | A switch in the save sheet; the key turns to a red "Replace" and the source take or clip goes. | Free | components/EditorScreen/components/EditorSaveSheet.tsx |
| Replace keeps identity | A replaced clip keeps its date, lyric version, shelf, playlist and set links. | Free | components/EditorScreen/hooks/useEditorExportFlow.ts |
| Replace keeps older versions | Older versions stacked under the edited clip stay where they are. | Free | components/EditorScreen/hooks/useEditorExportFlow.ts |
| Replaced audio goes to trash | The removed original's files are trashed, not left on the phone. | Free | state/mediaCleanup.ts |
| Grid outcome line | The save sheet says "Grid kept", "Grid kept to 01:12" or "No grid" for this edit. | Free | components/EditorScreen/index.tsx |
| Pins, sections and tempo carry over | The new clip keeps the source's pins, sections and grid, moved to fit the new timing. | Free | domain/clipEditRemap.ts |
| Saved toast and return | After saving, the editor closes and a "Clip saved" / "3 clips saved" toast confirms. | Free | components/EditorScreen/hooks/useEditorExportFlow.ts |
| Lands in the same place | New clips go to the source's collection, or into the same sketch as takes. | Free | components/EditorScreen/hooks/useEditorExportFlow.ts |

### Speed & pitch tab

| Feature | What it does | Status | Where |
|---|---|---|---|
| Speed & pitch tab | The editor's third tab: change a clip's speed and key for good. Opening it needs Pro. | Pro | components/EditorScreen/index.tsx:629 |
| Editor speed | 0.5× to 2×, with presets 0.5, 0.75, 1, 1.5, 2, heard live before saving. | Pro | components/EditorScreen/components/EditorTransformSection.tsx |
| Editor pitch | −12 to +12 semitones, heard live where the build supports it. | Pro | components/EditorScreen/components/EditorTransformSection.tsx |
| Save copy (speed & pitch) | Bakes the change into a new clip; the receipt reads "0.85x · −2 st". | Pro | components/EditorScreen/hooks/useEditorExportFlow.ts |
| Marks stretch with speed | A baked speed change moves pins, sections and tempo to match the new length. | Pro | domain/clipEditRemap.ts |
| "Pitch preview unavailable" | A note shown when this build can't preview pitch. | Pro | components/EditorScreen/components/EditorTransformSection.tsx |

---

## Exporting audio (from the player)

| Feature | What it does | Status | Where |
|---|---|---|---|
| Share | The "…" menu's Share row; with only one way out it goes straight to the system share sheet. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Share audio | Sends the audio file as recorded through the system share sheet, named after the clip. | Free | services/audioStorage.ts |
| Layered takes share the mix | A take with layers shares its mixed-down sound, not the bare take. | Free | domain/clipPresentation.ts |
| Export for DAW | For takes recorded with the metronome: a WAV that starts on a bar line, named with its tempo. | Free | services/dawExport.ts |
| Pickup kept | If something was played before the first bar, silence is added in front rather than cutting it. | Free | domain/barAlignedExport.ts |
| SongNook Send | Makes a share link for the take, with its notes, marks, layers, lyrics and chart each on or off. | Free up to 3 links per 30 days, then Pro | state/useSendSheetStore.ts:76 |

---

## Other rows in the player's "…" menu

| Feature | What it does | Status | Where |
|---|---|---|---|
| Menu named by the clip | The menu's title is the clip's own name. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Make sketch | On a loose clip: turns it into a sketch and opens the sketch page to name it. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Add to Shelf | Sets the idea aside for 7 days; the toast offers "View shelf". | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Delete clip | After a confirm, moves the clip to Recently deleted, with Undo in the toast, and closes the player. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Delete sketch (only take) | Deleting a sketch's only take deletes the whole sketch, and the dialog says so. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |
| Shorter menu when read-only | In a parcel (until Keep) or an archive, only Add to Shelf and Share remain. | Free | components/PlayerScreen/hooks/usePlayerScreenLifecycle.ts |

---

## Built but not reachable

- **Detect tempo / Re-detect tempo** ("analysis" in the Pro list). The whole feature is built and wired to the gate (`PlayerScreen/index.tsx:2058`), but the Sound drawer never draws its row: a code note dated 2026-10-13 says detection "is not trustworthy yet", so the door is hidden. Nobody, free or Pro, can run it. The Pro page copy and the catalog still name "analysis" as a practice tool.
- **Named Step up sequences** (Save sequence / Remove sequence). Built end to end, switched off by `SAVED_SEQUENCES_ENABLED = false` in `StepUpSequenceSheet.tsx` (founder call 2026-08-01). The one remembered Custom plan is what ships.
- **Classic reel**. The older reel drawing is still in the code behind a `classicReel` setting, but no screen has the switch any more.
- **Fold a single layer lane**. The store can fold one lane (`toggleLayerCollapsed`) and the strings exist ("Collapse {{title}}"), but only Collapse all / Expand all is on screen.
- **"Move loop to the playhead" and "Jump playhead to loop start"**. The functions and strings exist; no button calls them.
- **Section retype and inline rename** (`handleChangeSectionKind`, `handleCommitRename`). Superseded by the name-and-ink dialog; nothing calls them.
- **Parts limit in the editor**. `useEditorSelectionState.ts:36` still runs a "full-editor" check on Add part. It always passes since the limit was removed today; putting a `freeLimit` back in `proCatalog.ts` would switch it on. This is a second "full-editor" call site that is not in the brief's list.
- **`ProGate` component** (`components/common/ProGate.tsx`). Exists, used nowhere in this area.

## Worth a decision

1. **Pins are Pro in one place and free in three.** "+ Pin" in Tools is Pro. But pins dropped while recording are free, a free person can rename, move, annotate and delete any pin, and dragging one of the automatic lyric-heading markers in Tools saves them all as real pins with no check. If pins are meant to be Pro, the recorder is the open door; if not, the one gate is odd.
2. **Sections are completely free** (add, name, colour, move, loop a section) while pins, their simpler sibling, are gated. Sections are arguably the richer tool.
3. **"Analysis" is sold but not there.** Tempo detection is listed as a Pro practice tool, yet it is hidden for everyone. Either take it out of the Pro wording or bring the row back.
4. **Step up's plan sheet opens free.** A free person can pick a drill and build a custom plan, and only meets the Pro page on the switch. That may be a fine taste, or a tease; worth choosing on purpose.
5. **Reset pitch asks for Pro.** A take that kept a pitch from the free month plays pitched for a free person, but the small "Reset pitch" key opens the Pro page. "Reset all" still clears it. Undoing should probably never be gated.
6. **The one-layer limit can be walked around.** The limit counts layers on the take now. Record a layer, "Combine layers › Replace take", and the take has no layers again, so another free layer can be added, without end. Combine and Merge are both free.
7. **Merge layers is free but needs two layers,** so in practice only Pro people (or free-month takes) can use it. No change needed unless Combine becomes Pro.
8. **Costly or "power" things that are free today:** Export for DAW (bar-aligned WAV), per-layer and per-take level and tone, the limiter, solo mixes, click on playback with haptic and sound choice, speed in BPM, Keep with clip, unlimited cutting in the editor, lyrics Follow, write-against-the-tape. All fine if intended; Export for DAW and the per-layer mixer are the ones a competitor would charge for.
9. **Speed is free in the player but Pro in the editor.** Playing at 0.75× is free; saving a 0.75× copy is Pro. That is a clean line, but note that pitch is Pro in both.
10. **Capo and transpose inside the player** are Pro (stage tools) even though they sit on the player's reading page. Listed here so they are not missed when deciding "is everything in the player's reading view free?".
11. **Received-parcel exemption is uneven.** Practice tools, capo and transpose are free on a parcel's clip. The editor's Speed & pitch tab and the Layer key have no such exemption (layers are moot while a parcel is read-only, but apply after Keep).
12. **The eight-layer cap** is a hard limit for Pro too. Fine as a product rule; listed so the Pro page never promises "unlimited layers".

## Not sure

- **Limiter and the pitch quality pass on phones.** The native code is in `modules/songnook-pitch-shift` (Android `SoundChainAudioProcessor.kt`, iOS limiter in the mix bake). A memory note from 2026-10-21 said it "ships only with the next store builds". Store builds have gone out since, so it should be live, but I only read the source; I did not confirm it on a device.
- **Loop with the screen off.** The code says the loop wrap is "timed from the playback position, screen on or off" and Android keeps position reports coming while a loop is set. I did not test a locked phone.
- **Click sound choice and click haptic.** Both rows show only when the installed build reports support (`supportsVoice`, `supportsPlayAlongHaptic`). Android haptics during play-along are held back on older binaries by a code note. Which store builds show which row was not checked.
- **Android media card ending after idle.** Described in code comments as behaviour of a patched audio library; I did not read the patch itself.
- **Share audio file format.** The file is shared as stored (its own extension). I did not trace which format the recorder writes on each platform; another agent covers recording.
- **Where the full player is opened from** (card play button, sketch page, playlists, "Shuffle play") and the card's own mini preview belong to the library agents; I listed only the hand-over.
- **The recorder's lyrics panel** lives in the player's folder (`PlayerScreen/PlayerLyricsPanel.tsx`: autoscroll, autoscroll speed, lyric size) but is used only by the recorder. It is not in these tables.
