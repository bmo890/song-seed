# QA Flows — Recording

| ID | Flow | Steps (terse) | Expected result | Auto | Platforms | Pri |
|---|---|---|---|---|---|---|
| REC-01 | Quick record entry | Collection → mic FAB | Recording screen opens, eyebrow "New recording", date-style placeholder title, status Ready, timer 0:00 | AUTO | iOS+Android | P1 |
| REC-02 | Record into project | Song detail → record button | Recording screen, eyebrow "Recording into", project title in header | AUTO | iOS+Android | P1 |
| REC-03 | Record variation | Song detail → clip card → reply/record variation → record → save | New clip appears as child of parent clip (lineage), inherits parent tags | AUTO | iOS+Android | P2 |
| REC-04 | Overdub entry | Full player at 0:00 → add layer | Recording screen, eyebrow "Layer", guide-mix card with master title + waveform reel + existing layer lanes | AUTO | iOS+Android | P1 |
| REC-05 | Punch-in entry | Player scrubbed mid-song → add layer | Eyebrow "Layer · from m:ss" (bar-snapped), guide reel opens at punch position | AUTO | iOS+Android | P2 |
| REC-06 | Abandoned quick-record placeholder | Quick record → never record → Back | Returns to collection; NO empty ghost clip idea left behind | AUTO | iOS+Android | P1 |
| REC-07 | Mic permission grant | Fresh install → record → OS mic prompt → Allow | Recording starts immediately after grant | AUTO-A | iOS+Android | P1 |
| REC-08 | Mic permission blocked | Launch with mic denied (canAskAgain=false) → tap record | Alert "Microphone access needed" with Cancel + Open Settings; Cancel stays on screen, nothing recorded | AUTO | iOS+Android | P1 |
| REC-09 | Deny → fix in Settings | Deny mic → alert → Open Settings → enable → return → record | Settings app opens on app page; after enabling, record works without relaunch | HUMAN | iOS+Android | P2 |
| REC-10 | Notification permission (Android) | Android 13+, notifications denied → tap record | "Notification access needed" alert; recording does NOT start; blocked-state variant offers Open Settings | AUTO-A | Android | P2 |
| REC-11 | Record → save named take | Record → wait 5s → save icon → type name → Save | Recording pauses, naming modal opens; after Save returns to origin screen, clip listed with typed name and >0 duration | AUTO | iOS+Android | P1 |
| REC-12 | Save with empty name | Record → save → leave field empty → Save | Clip saved under the suggested placeholder title shown in the field | AUTO | iOS+Android | P2 |
| REC-13 | Auto-named save | Settings → Recording → "name each recording" OFF → record → save | No naming modal; saves under suggested title and navigates back automatically | AUTO | iOS+Android | P1 |
| REC-14 | Naming modal cancel | Record → save → modal → Cancel | Modal closes, take kept, status Paused; can resume or save again | AUTO | iOS+Android | P1 |
| REC-15 | Save destination picker | Quick record (standalone) → save → tap destination row → pick other collection/workspace | Clip lands in chosen collection; row absent for project/variation/overdub takes | AUTO | iOS+Android | P2 |
| REC-16 | Primary toggle | Record into project → save → toggle "primary" ON → Save | New clip marked primary; previous primary demoted | AUTO | iOS+Android | P2 |
| REC-17 | Saved audio audible | Record real sound → save → play clip in player | Played clip contains the actual recorded sound, correct length, waveform matches audio | PARTIAL | iOS+Android | P1 |
| REC-18 | Pause / resume | Record → tap record btn (pause) → tap again (resume) | Pause: timer freezes, status "Paused", dot idle. Resume: timer continues from frozen value, status "Recording" | AUTO | iOS+Android | P1 |
| REC-19 | Resume w/ count-in re-armed | Record → pause → metronome sheet → count-in 1 bar → resume | Fresh count-in runs (dots + "Count-in" status) before capture resumes; count-in resets to Off after | AUTO | iOS+Android | P2 |
| REC-20 | Discard confirm → delete | Record → trash icon → "Discard recording?" → Discard | Take deleted, leaves screen back to origin; clip count unchanged | AUTO | iOS+Android | P1 |
| REC-21 | Discard confirm → keep | Record → trash icon → "Keep recording" | Alert closes, recording still running, timer never stopped | AUTO | iOS+Android | P1 |
| REC-22 | Back with no take | Open recording screen → Back immediately | Leaves without any confirm (nothing to discard) | AUTO | iOS+Android | P2 |
| REC-23 | Back with active take | Record → header Back | Same "Discard recording?" confirm as trash; Discard exits to origin | AUTO | iOS+Android | P1 |
| REC-24 | Redo take | Record 5s → redo icon → "Redo take?" → Redo | Back to Ready on SAME screen; timer 0:00; metronome/count-in settings restored for next attempt | AUTO | iOS+Android | P2 |
| REC-25 | Redo during count-in | Start take with count-in → tap redo mid-count | Count-in cancels cleanly to Ready (no stuck arming state); count-in bars preserved | AUTO | iOS+Android | P2 |
| REC-26 | Minimize during recording | Record → minimize (—) | Returns to previous screen; red "Recording" dock chip shows title + pause + save buttons; recording keeps rolling | AUTO | iOS+Android | P1 |
| REC-27 | Dock pause/resume | Minimize while recording → tap dock pause → tap dock mic | Chip flips Paused/Recording; reopening screen shows matching state + elapsed | AUTO | iOS+Android | P2 |
| REC-28 | Dock save | Minimize while recording → tap dock save | Recording screen reopens with naming modal already up; save completes normally | AUTO | iOS+Android | P1 |
| REC-29 | Hardware back mid-take | Record → Android hardware back | Screen pops WITHOUT discard confirm; recording continues; dock chip appears (same as minimize) | AUTO-A | Android | P2 |
| REC-30 | Minimize during count-in | Start take w/ count-in → minimize during count | Pending start cancelled (no capture, no dock chip), returns to previous screen | AUTO | iOS+Android | P2 |
| REC-31 | Count-in flow | Metronome sheet → count-in 2 bars → record | Record btn shows timer icon; status "Count-in x/2" with beat dots filling; timer stays 0:00 through count; then flips to Recording, timer runs; next take's count-in resets to Off | AUTO | iOS+Android | P1 |
| REC-32 | Count-in head trim | Count-in 2 bars → record on the downbeat → save → play | Saved take starts at the downbeat: no count-in clicks or dead pre-roll at file start, first hit not clipped | HUMAN | iOS+Android | P1 |
| REC-33 | Metronome sheet controls | Body metronome ⚙ → adjust BPM (+/−, type, tap tempo), meter, count-in bars, cue tiles, beep/haptic levels | Every control updates its readout; summary chip on meta row reflects "BPM · meter · count N" | AUTO | iOS+Android | P2 |
| REC-34 | Metronome preview | Sheet → Listen → Stop preview | Click audibly plays at set BPM while idle; Stop silences; preview does NOT enable click-through-take | PARTIAL | iOS+Android | P2 |
| REC-35 | Metronome toggle chip | Tap metronome chip on meta row (on/off) | On: chip shows tempo summary, sheet subtitle "On — clicks while you record". Off: quiet icon, any preview silenced | AUTO | iOS+Android | P2 |
| REC-36 | Click during take | Metronome ON → record → listen; then metronome OFF + count-in → record | ON: click audible through the take. OFF+count-in: click stops the moment the count-in ends | PARTIAL | iOS+Android | P2 |
| REC-37 | Sheet locked mid-take | While recording open metronome sheet | Tempo/meter/count-in/cues disabled; beep + haptic level sliders still adjustable live | AUTO | iOS+Android | P3 |
| REC-38 | Record over running preview | Start Listen preview → close sheet → record | No double/layered click (preview restarts cleanly); take not trimmed; no ghost silence at start | PARTIAL | iOS+Android | P3 |
| REC-39 | Input picker | Header … (idle) → Recording Settings | Device list shows available inputs deduped (single Built-in Mic), active row highlighted with check; selecting another applies (spinner) and persists across screen reopen; refresh re-queries | PARTIAL | iOS+Android | P2 |
| REC-40 | Input picker error state | Device enumeration fails | "Couldn't list audio inputs — using the default mic." note; recording still possible | HUMAN | iOS+Android | P3 |
| REC-41 | Stale preferred input | Prefer BT mic → power BT off → reopen recording → record | Preference silently resets to default mic; recording works; picker shows default selected | HUMAN | iOS+Android | P2 |
| REC-42 | Settings locked mid-take | Record → header … | Button disabled while actively recording; enabled again when paused, picker shows "Pause or stop recording…" note when opened disabled | AUTO | iOS+Android | P2 |
| REC-43 | Overdub guide playback | Overdub entry → record | Guide mix audible in monitor; reel scrolls smoothly, position counter advances, section bands + layer lanes ride the waveform; reel not seekable | PARTIAL | iOS+Android | P1 |
| REC-44 | Overdub auto-stop | Record layer → let it reach guide end | Auto-pauses at guide duration, naming modal opens as review; record/resume locked (review lock) | AUTO | iOS+Android | P1 |
| REC-45 | Overdub review cancel | Auto-stopped review modal → Cancel | "Review overdub" alert: "Redo overdub" discards + resets to Ready; "Keep take" returns to modal state | AUTO | iOS+Android | P2 |
| REC-46 | Overdub save | Review modal → Save (name or default "Layer N") | Stem attached to master; back on player the new layer lane appears; modal shows even when auto-name setting is OFF | AUTO | iOS+Android | P1 |
| REC-47 | Guide join countdown | Overdub, count-in OFF → record | "Master joins in N" beat countdown then "Master joining…"; guide enters at a bar line, then normal recording | PARTIAL | iOS+Android | P2 |
| REC-48 | Grid restore from master | Master recorded w/ metronome → open overdub session | Metronome preset to master's BPM/meter/count-in + click state; sheet shows "Original take: X BPM · meter" | AUTO | iOS+Android | P2 |
| REC-49 | Punch-in alignment | Punch layer mid-song, no count-in → record → save | Monitoring starts one bar before punch (lead-in); saved stem sits exactly at punch bar on master timeline, in time | HUMAN | iOS+Android | P2 |
| REC-50 | Uncalibrated BT warning | Connect uncalibrated BT headphones → open recording | Banner "aren't calibrated…" with Calibrate button → opens BluetoothCalibration screen; body card shows offset info | HUMAN | iOS+Android | P2 |
| REC-51 | BT mic warning | Select/route a Bluetooth microphone input | "Recording through a Bluetooth microphone…" banner, no Calibrate button; recording still allowed | HUMAN | iOS+Android | P2 |
| REC-52 | Mid-take route change | Record → disconnect/connect headphones mid-take | Banner "Audio route changed Ns into the take…"; recording keeps running (not interrupted); warning clears on next take | HUMAN | iOS+Android | P2 |
| REC-53 | Lyrics panel | Record into project that has lyrics → expand lyrics | Latest lyrics version shown (chords if present); expand → perform mode: header collapses, compact timer row, lyrics fill screen; no panel for projects without lyrics | AUTO | iOS+Android | P2 |
| REC-54 | Lyrics autoscroll | Expand lyrics → autoscroll on → record; drag lyrics mid-scroll; change speed | Scrolls while recording; manual drag flips mode to manual (stops following); speed multiplier changes rate | PARTIAL | iOS+Android | P3 |
| REC-55 | Crash recovery | Record 10s → force-kill app → relaunch | Alert "Recovered recording"; clip "Recovered Recording <date>" in first collection/Inbox with audio + waveform; marker cleared (no repeat on next launch) | AUTO | iOS+Android | P1 |
| REC-56 | Disk-full save failure | Fill device storage → record → save | "Recording kept for recovery" alert (not a silent loss); relaunch restores the take as recovered clip | HUMAN | iOS+Android | P1 |
| REC-57 | Target deleted mid-session | Record into project → minimize → delete that project → dock save | "Recording kept for recovery" alert; take NOT orphaned; relaunch restores it to Inbox | AUTO | iOS+Android | P2 |
| REC-58 | Phone-call interruption | Record → receive real call | Recording stops/pauses cleanly, guide + metronome stop; no crash; take recoverable or resumable after call | HUMAN | iOS+Android | P1 |
| REC-59 | Background / lock-screen | Record → lock screen 30s → unlock | Capture continued (elapsed advanced, audio unbroken); Android shows persistent recording notification with live waveform | HUMAN | iOS+Android | P1 |
| REC-60 | Notification actions | While recording, use Android notification pause/resume | Notification actions toggle the take; in-app state matches on return | HUMAN | Android | P2 |
| REC-61 | External audio conflict | Play Spotify/Music → open recording → record | Entry/record handles other audio predictably (mix or duck per platform); no crash; take captures mic not a stall | HUMAN | iOS+Android | P2 |
| REC-62 | Entry stops in-app playback | Play a clip in full player → start any recording entry | Player closes/stops before recording screen opens; no playback bleeding into the take | AUTO | iOS+Android | P2 |
| REC-63 | Instant save (tiny take) | Record → save within <1s → Save | No crash; either saves a tiny clip or fails with the recovery alert — never a silent stall | AUTO | iOS+Android | P3 |
| REC-64 | Help sheet | Header ? → open → close | Recording help sheet opens with content and closes back to unchanged screen state | AUTO | iOS+Android | P3 |
