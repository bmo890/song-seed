# Songstead — Manual QA Checklist

A sit-down-with-your-phone checklist. Walk it top to bottom on a **real iOS device** and a
**real Android device** before each release. Tick both boxes per item.

**Legend**
- `iOS ☐  Android ☐` — check off per platform.
- **[AUTO]** — also covered by an automated Maestro flow (named), so it's machine-verified on
  the iOS Simulator. Still worth a human eye on device, especially for feel/audio.
- **[HUMAN]** — only a human on a real device can verify this (mic, Bluetooth, haptics,
  interruptions, system sheets). No automation exists or is possible.
- **[ANDROID]** — behaviour that specifically needs Android hardware/gesture back or Android
  conventions.

The automated suites (run on the iOS Simulator) back most of this up:
- Main suite: `maestro test .maestro/flows/` (19 flows)
- Clip suite: `scripts/push-dev-samples.sh` then `maestro test .maestro/clip-flows/` (11 flows)
See `docs/qa/RUN-LOG.md` for the automation status of each.

---

## 0. Setup / smoke

- iOS ☐  Android ☐ — App launches from a cold start without a crash or white screen. **[AUTO: 01]**
- iOS ☐  Android ☐ — App resumes from background to the same screen (no reset). **[HUMAN]**
- iOS ☐  Android ☐ — Rotate the device (if rotation is supported) — layout doesn't break. **[HUMAN]**
- iOS ☐  Android ☐ — Dark mode / light mode both render legibly (toggle in OS settings). **[HUMAN]**

## 1. First run & onboarding

- iOS ☐  Android ☐ — Fresh install shows the welcome flow ("Catch the spark"). **[AUTO: 01]**
- iOS ☐  Android ☐ — Next through the panes, and "Skip the intro" both work. **[AUTO: 01]**
- iOS ☐  Android ☐ — Last pane "Your recordings belong here": "Choose audio files" opens the OS file picker; cancelling returns to the pane intact. **[HUMAN]**
- iOS ☐  Android ☐ — Pick several audio files → inline "Importing X of N…" progress; done state shows the count; clips land in an "Imported" collection with durations, waveforms fill in on their own. **[HUMAN]**
- iOS ☐  Android ☐ — **Selection bar vs. media dock:** with a session in the media dock (playing OR paused), long-press a clip → the selection top bar AND the bottom action bar (Make song / Play / Hide / Delete / More) are both fully visible — no strip of the docked player sheet (paper, or its chevron/⋯/title header) covering the actions. Cancel selection → dock drops back to the bottom. **[HUMAN]** (fix: the docked sheet is HIDDEN while a toolbar is up — it can't be moved, it's full-height)
- iOS ☐  Android ☐ — **Swipe the player up while selecting:** with the selection bar open, drag the media dock upward → the sheet rises out of the dock's top edge cleanly. No terracotta band of dock painted across the MIDDLE of the rising sheet, and no sheet visible below the dock. Release to open, collapse again → selection bar and dock return intact. **[HUMAN]** (fix: the dock un-lifts once the sheet is in motion)
- iOS ☐  Android ☐ — Selection bar with a session, then **swipe the sheet up and back down** repeatedly → no flicker of the sheet appearing over the action bar at rest. **[HUMAN]**
- iOS ☐  Android ☐ — **Reel, clip switch:** with a paused session, open clip A in full player, collapse, open clip B → B's waveform appears directly; A's waveform is never shown on B, no reshape/"scrunch" after appearing. **[HUMAN]**
- iOS ☐ — **Reel, fresh import + play:** open a freshly imported clip ("Analyzing waveform…" + pulsing line), press play immediately → waveform arrives ~1–2s later WHILE playing (iOS analyzes alongside playback). **[HUMAN]**
- Android ☐ — Same flow on Android: while playing, caption reads "Waveform finishes after playback" (pulsing line stays); pause → "Analyzing…" returns and the waveform lands within a couple of seconds. **[ANDROID]**
- iOS ☐  Android ☐ — Opening any analyzed clip: waveform appears at its zoom level immediately — no stretched sparse bars squeezing together, no flash of a wrong wave. (The haptic on open is the sheet landing, by design.) **[HUMAN]**
- iOS ☐  Android ☐ — Tap Start while an import is still running → import finishes in the background (global progress pill), all clips present in "Imported". **[HUMAN]**
- iOS ☐  Android ☐ — Replay the intro (Settings → About) and import the same files again → duplicates are skipped and reported ("already in your library"), no doubles created. **[HUMAN]**
- iOS ☐  Android ☐ — After onboarding you land on a seeded library (My Songs → Ideas). **[AUTO: 01]**
- iOS ☐  Android ☐ — Re-open the app later → goes straight to the library (no welcome again). **[HUMAN]**

## 2. Navigation & drawer

- iOS ☐  Android ☐ — Hamburger opens the drawer; tapping the scrim/back closes it. **[AUTO: 02]**
- iOS ☐  Android ☐ — Drawer → **Lyrics Pad**, **Metronome**, **Settings** each open. **[AUTO: 02]**
- iOS ☐  Android ☐ — Drawer → **Revisit**, **Activity**, **Library** (listening hub) each open. **[AUTO: 06]**
- iOS ☐  Android ☐ — Drawer → **Tuner** opens (mic-permission prompt appears first run). **[AUTO: 07]**
- iOS ☐  Android ☐ — Drawer search button opens global **Search**. **[AUTO: 06]**
- iOS ☐  Android ☐ — Workspace switch button opens the workspace picker. **[AUTO: 17]**

## 3. Back button — must NEVER close the app

> This was a real bug (fixed). Verify carefully, especially on Android.

- Android ☐ — From **Settings** (reached via drawer), press hardware/gesture back → lands on the
  **open collection** (hub-and-spoke: drawer pages are destinations, back always returns to the
  hub, not your visit trail). Does **NOT** close the app. **[ANDROID]** (fix: no more `exitApp()`)
- Android ☐ — Same from **Tuner, Metronome, Library, Activity, Revisit** — one back press lands
  on the collection, never closes the app. **[ANDROID]**
- Android ☐ — **Loop regression:** write a note in the lyrics pad → switch to Metronome (drawer) →
  press back → lands on the **collection** (not bounced back into the lyrics pad); repeated back
  presses reach home then background the app — no ping-pong. **[ANDROID]** (fix: initialRoute +
  focus-scoped NoteEditor back handler)
- Android ☐ — With a note editor open in the lyrics pad, back closes the editor (to the pad's
  list); next back lands on the collection. **[ANDROID]**
- Android ☐ — With the **drawer open**, back closes the drawer (stays on screen). **[ANDROID]**
- Android ☐ — On **Browse** with collections selected, back clears the selection. **[ANDROID]**
- Android ☐ — On **Revisit** with an "Around This Time" snapshot open, back closes the snapshot. **[ANDROID]**
- Android ☐ — "View in collection" from Activity/Search/Revisit → back returns to that origin. **[ANDROID]**
- Android ☐ — At the **home** screen (Browse, drawer closed, nothing to go back to), back sends
  the app to the **background** (still in Recents, resumes where you left off) — NOT destroyed. **[ANDROID]**
- iOS ☐  Android ☐ — Deep path (collection → song → editor → back → back …) never skips a
  screen, never loops, never exits early. **[AUTO: 19]** (iOS in-app back)
- iOS ☐ — Swipe-from-left back gesture works on pushed screens (song detail, editor, recorder). **[HUMAN]**

## 4. Library — songs, collections, workspaces

### Songs
- iOS ☐  Android ☐ — Create a song (create-FAB → Song), name it, Save. **[AUTO: 05]**
- iOS ☐  Android ☐ — Status chips SEED/SPROUT/STEM/SONG set completion % (SONG→75%, SEED→0%). **[AUTO: 15]**
- iOS ☐  Android ☐ — Saved status shows on the song's list card. **[AUTO: 15]**
- iOS ☐  Android ☐ — Long-press a song → selection mode; delete with the destructive confirm;
  undo toast appears. **[AUTO: 05]**
- iOS ☐  Android ☐ — Bulk **Select all** → delete clears the collection. **[AUTO: 05]**
- iOS ☐  Android ☐ — **Hide** a song → it leaves the list and a "Show all (N)" pill appears;
  Show all → it returns. **[AUTO: 18]**

### Collections
- iOS ☐  Android ☐ — Create a collection (browse "+" → New Collection) → it opens. **[AUTO: 12]**
- iOS ☐  Android ☐ — Long-press a collection card → select → **Delete** → confirm → gone. **[AUTO: 12]**
- iOS ☐  Android ☐ — Rename / Copy / Move a collection (browse selection actions). **[HUMAN]**
- iOS ☐  Android ☐ — ⚠️ Deleting a workspace's **last** collection must NOT strand a
  "collection could not be found" dead-end (known issue — verify the fix). **[HUMAN]**

### Workspaces
- iOS ☐  Android ☐ — Workspace picker lists workspaces; create a workspace (name → Save). **[AUTO: 17]**
- iOS ☐  Android ☐ — Delete a workspace (card ⋯ → Delete → "Delete permanently"). **[AUTO: 17]**
- iOS ☐  Android ☐ — Switch active workspace → the library content changes to that workspace. **[HUMAN]**

## 5. Search

- iOS ☐  Android ☐ — In-collection search: matching query filters to the item; non-matching
  hides it; clearing restores the list. **[AUTO: 10]**
- iOS ☐  Android ☐ — Global (drawer) search finds a song by title across the library. **[AUTO: 16]**
- iOS ☐  Android ☐ — Search finds by **lyric line** and by clip **note** content. **[HUMAN]**

## 6. Recording  (mostly HUMAN — needs a real mic)

- iOS ☐  Android ☐ — Record FAB opens the recorder; "NEW RECORDING" / "Ready" / controls show. **[AUTO: 04]**
- iOS ☐  Android ☐ — Metronome toggle on/off in the recorder; metronome settings sheet opens. **[AUTO: 04]**
- iOS ☐  Android ☐ — **Actually record** a take → audio is captured and saved as a clip. **[HUMAN]**
- iOS ☐  Android ☐ — Count-in plays before recording (if enabled). **[HUMAN]**
- iOS ☐  Android ☐ — Discard recording works; Back returns to the collection. **[AUTO: 04]**
- iOS ☐  Android ☐ — Record with the metronome audible in the take vs not (bleed check). **[HUMAN]**
- iOS ☐  Android ☐ — Incoming **phone call / alarm** during recording is handled gracefully. **[HUMAN]**
- iOS ☐  Android ☐ — Recording with a **Bluetooth** mic/headset. **[HUMAN]**
- iOS ☐  Android ☐ — Input picker: tapping a **Bluetooth input** asks "Use Bluetooth microphone?"
  (quality + timing caveats); Cancel keeps the prior input; confirm applies it and an inline
  "Bluetooth mic active…" note stays under the picker. (REC-65) **[HUMAN]**
- Android ☐ — Select a **USB or wired mic** in the input picker → record → the take audibly
  captured the CHOSEN mic, not the built-in one (regression guard for the
  setPreferredDevice patch). (REC-66) **[ANDROID]**
- iOS ☐  Android ☐ — Calibrate BT headphones normally (A2DP), then select **their mic** (HFP)
  and reopen recording → the saved offset is NOT applied: banner shows the uncalibrated
  state for the "(mic active)" route, not the saved ms. (REC-67) **[HUMAN]**
- iOS ☐  Android ☐ — Settings → Recording shows a **Devices** section: Bluetooth calibration
  card (saved-count meta) opens the calibration screen; hint points to the recording-screen
  mic picker. (REC-68) **[AUTO-able, currently human]**

## 7. Clips — import & organize

- iOS ☐  Android ☐ — Import audio via the create-FAB → **Import** (system file picker) →
  choose a file → it lands as a clip with the correct duration. **[HUMAN]** (picker is
  system UI; the pipeline is **[AUTO: clip-01]** via the dev path)
- iOS ☐  Android ☐ — Import **multiple** files → choose "Individual clips" → each becomes a clip. **[HUMAN]**
- iOS ☐  Android ☐ — Import **multiple** files → choose "Song project" → one song with N clips. **[AUTO: clip-06]**
- iOS ☐  Android ☐ — Re-import the same file(s) → "ALREADY IN YOUR LIBRARY" review appears;
  Skip adds nothing; Import all adds duplicates. **[AUTO: clip-07]**
- iOS ☐  Android ☐ — Rename a clip and add notes (selection → More → Edit). **[AUTO: clip-03]**
- iOS ☐  Android ☐ — **Copy** a clip to another collection (Copy → Paste to collection → confirm). **[AUTO: clip-10]**
- iOS ☐  Android ☐ — **Move** a clip to another collection (removed from source). **[AUTO: clip-11]**
- iOS ☐  Android ☐ — Delete a clip (More → Delete clip) and via selection. **[AUTO: clip-03]**
- iOS ☐  Android ☐ — **Share audio** (More → Share) opens the system share sheet. **[HUMAN]**

## 8. Player

- iOS ☐  Android ☐ — Tap a clip → the player opens with the waveform + duration. **[AUTO: clip-01]**
- iOS ☐  Android ☐ — Play / Pause toggles and **audio actually plays** through the speaker. **[AUTO: clip-01]** (toggle) / **[HUMAN]** (sound quality)
- iOS ☐  Android ☐ — Scrub the position; seek lands where expected. **[HUMAN]**
- iOS ☐  Android ☐ — Markers Hide↔Show; waveform Expand↔Shrink. **[AUTO: clip-05]**
- iOS ☐  Android ☐ — Collection ⋯ → **Play all** plays the queue back-to-back; next clip
  auto-advances. **[AUTO: clip-08]** (start) / **[HUMAN]** (auto-advance between clips)
- iOS ☐  Android ☐ — Minimize player → the mini media dock shows and keeps playing. **[AUTO: clip-01]** (minimize) / **[HUMAN]** (dock playback)
- iOS ☐  Android ☐ — Lock screen / notification transport controls (play/pause) work. **[HUMAN]**
- iOS ☐  Android ☐ — Playback continues in the background; interruption (call) pauses cleanly. **[HUMAN]**
- iOS ☐  Android ☐ — Route audio to **Bluetooth** speaker/headphones. **[HUMAN]**

## 9. Waveform editor

- iOS ☐  Android ☐ — More options → **Edit clip** opens the Audio Editor. **[AUTO: clip-02]**
- iOS ☐  Android ☐ — "Add at playhead" creates a region; drag handles to resize. **[AUTO: clip-02]** (add) / **[HUMAN]** (drag)
- iOS ☐  Android ☐ — **Extract** a region → a new clip is created. **[AUTO: clip-04]**
- iOS ☐  Android ☐ — **Cut / trim** a region → a shorter clip is saved (Save Splice). **[AUTO: clip-09]**
- iOS ☐  Android ☐ — Multiple regions in one pass; Delete region; join regions. **[HUMAN]**
- iOS ☐  Android ☐ — "Delete the original after export" option behaves as described. **[HUMAN]**
- iOS ☐  Android ☐ — Editor playback + scrub within the editor. **[HUMAN]**

## 10. Overdub  (HUMAN — needs mic)

- iOS ☐  Android ☐ — More options → **Add overdub** opens the recorder in overdub mode. **[HUMAN]**
- iOS ☐  Android ☐ — Record an overdub layer; it plays back layered over the base. **[HUMAN]**
- iOS ☐  Android ☐ — Multiple overdub layers; mute/solo/remove a layer. **[HUMAN]**
- iOS ☐  Android ☐ — Flatten overdubs into a single clip. **[HUMAN]**

## 11. Lyrics Pad & word tools

- iOS ☐  Android ☐ — Lyrics Pad opens; type a line → it **autosaves** (leave + return, still there). **[AUTO: 08]**
- iOS ☐  Android ☐ — New Page creates a note; note index shows previews. **[AUTO: 08]**
- iOS ☐  Android ☐ — Lyrics Spark → **Word Ladder** opens and renders. **[AUTO: 13]**
- iOS ☐  Android ☐ — Lyrics Spark → **Cut-Up** opens and renders. **[AUTO: 13]**
- iOS ☐  Android ☐ — Lyrics Spark → **Magpie** opens and fetches a real book (needs network). **[AUTO: 13]** (mount) / **[HUMAN]** (fetch + word-pocketing)
- iOS ☐  Android ☐ — Word Finder (rhymes/similar) in the note editor. **[HUMAN]**
- iOS ☐  Android ☐ — Word Ladder pairing/shuffle; Cut-Up cut+compose; Magpie steal words. **[HUMAN]**

## 12. Tuner & metronome

- iOS ☐  Android ☐ — Tuner opens; grant mic permission → "LISTENING" state shows. **[AUTO: 07]**
- iOS ☐  Android ☐ — Tuner detects pitch from a real instrument/voice (needle moves, note reads). **[HUMAN]**
- iOS ☐  Android ☐ — Metronome: BPM ± changes the value; meter 4/4↔3/4; Start/Stop toggles. **[AUTO: 11]**
- iOS ☐  Android ☐ — Metronome **click is audible** and on-tempo; tap-tempo works. **[HUMAN]**
- iOS ☐  Android ☐ — Metronome cues (Beep / Haptic / Visual) each do what they say. **[HUMAN]**

## 13. Settings & data safety

- iOS ☐  Android ☐ — Settings overview renders all sections; Recording defaults & Library &
  Backups sub-views open and back out. **[AUTO: 09]**
- iOS ☐  Android ☐ — Export / Import / Storage-details views open and render. **[AUTO: 14]**
- iOS ☐  Android ☐ — Startup radio (Primary vs Last-used workspace) changes selection. **[HUMAN]**
- iOS ☐  Android ☐ — Haptics toggle on/off (feel the difference). **[HUMAN]**
- iOS ☐  Android ☐ — **Back up** the library → a backup file is produced (share sheet). **[HUMAN]**
- iOS ☐  Android ☐ — **Restore** from a backup file → library is restored intact. **[HUMAN]**
- iOS ☐  Android ☐ — **Export an archive** (chosen workspaces/collections) → file saved. **[HUMAN]**
- iOS ☐  Android ☐ — **Import an archive** → arrives as new workspaces, existing data untouched. **[HUMAN]**
- iOS ☐  Android ☐ — Backup-reminder prompt appears per the chosen cadence. **[HUMAN]**
- iOS ☐  Android ☐ — Archive a workspace → offload the package to Files/Drive → restore it. **[HUMAN]**
- iOS ☐  Android ☐ — Send feedback / share diagnostic log. **[HUMAN]**

## 14. Monetization / paywall

- iOS ☐  Android ☐ — Settings → Upgrade to Pro opens the paywall sheet with the feature list. **[AUTO: 03]**
- iOS ☐  Android ☐ — "Start free trial" shows the pre-billing preview notice (inline, not a
  dead-end). **[AUTO: 03]**  ← this was a real bug (fixed)
- iOS ☐  Android ☐ — "Restore purchases" shows the friendly nothing-to-restore message. **[AUTO: 03]**
- iOS ☐  Android ☐ — (Post-launch, once billing is live) real purchase, restore, and the Pro
  gates unlocking. **[HUMAN]**

## 15. Cross-cutting / stress

- iOS ☐  Android ☐ — Large library (100+ clips) scrolls and plays without slowdown. **[HUMAN]**
- iOS ☐  Android ☐ — Low storage / storage-pressure handling during import/record. **[HUMAN]**
- iOS ☐  Android ☐ — Airplane mode: Magpie shows "needs a connection"; everything else works. **[HUMAN]**
- iOS ☐  Android ☐ — Haptics fire on the right actions (record, save, delete, state changes). **[HUMAN]**
- iOS ☐  Android ☐ — Accessibility: font scaling / VoiceOver-TalkBack basic pass. **[HUMAN]**

---

### Notes column
Use this space to jot device/OS version and any failures:

| Date | Device / OS | Section | Issue |
|---|---|---|---|
|  |  |  |  |
