# QA Flows — App Shell & Misc

| ID | Flow | Steps (terse) | Expected result | Auto | Platforms | Pri |
|---|---|---|---|---|---|---|
| SHELL-01 | Fresh install welcome | Wipe app → launch → observe | 3-pane welcome (Capture/Grow/Practice) over paper bg; splash never flashes bare spinner | AUTO | iOS+Android | P1 |
| SHELL-02 | Welcome swipe + Next | Welcome → swipe panes → tap Next → dots update → last pane CTA reads "Start" → tap | Dots track pane; Start dismisses; seeded "My Songs"/"Ideas" library visible behind | AUTO | iOS+Android | P1 |
| SHELL-03 | Welcome skip | Welcome pane 1 → tap Skip | Intro dismisses immediately; seeded library shown; welcome never re-shown on relaunch | AUTO | iOS+Android | P2 |
| SHELL-04 | Android back during welcome | Welcome → press hardware back | App does not exit past welcome into a broken state; no crash | AUTO-A | Android | P3 |
| SHELL-05 | Replay intro from Settings | Settings → About → Replay intro | Welcome re-renders full-screen; Skip/Start return to Settings screen underneath | AUTO | iOS+Android | P2 |
| SHELL-06 | Cold start with data | Kill app (existing library) → relaunch → time to first screen | No welcome; lands per startup preference; interactive <4s; no blank/empty-library flash | AUTO | iOS+Android | P1 |
| SHELL-07 | Hydration gate | Cold start → watch pre-content frames | Warm spinner (paper bg) only until hydration; store never mounts empty/writable before rehydrate | PARTIAL | iOS+Android | P1 |
| SHELL-08 | Startup workspace preference | Set startup pref (primary vs last-used) → kill → relaunch | Opens the preferred workspace's primary collection (or Browse if none) | AUTO | iOS+Android | P2 |
| SHELL-09 | Recovery-mode restore prompt | Corrupt/clear persisted store but keep shadow manifest → launch | "Restore your library?" dialog with item count; Restore recovers; "Not now" leaves library; welcome suppressed | HUMAN | iOS+Android | P1 |
| SHELL-10 | Recovered recording prompt | Start recording → force-kill app mid-take → relaunch | "Recovered recording" info alert names restored take; take exists in library | HUMAN | iOS+Android | P1 |
| SHELL-11 | Recording recovery failed path | Corrupt pending recording session file → relaunch | "Recording recovery failed" alert; app continues normally, no crash | HUMAN | iOS+Android | P3 |
| SHELL-12 | Backup reminder alert | Make reminder due (frequency set, stale lastBackup) → relaunch | Alert with Later / Turn Off Reminders / Open Backup Settings; Turn Off sets frequency off; Open navigates to Settings | PARTIAL | iOS+Android | P2 |
| SHELL-13 | Error boundary screen | Force a render crash (dev hook/test screen) | Styled "Something went wrong" screen (not white screen); Restart button remounts app with library intact | HUMAN | iOS+Android | P1 |
| SHELL-14 | Crash diagnostic log | After SHELL-13 → Settings → About → share diagnostic log | Crash entry (boundary + stack) present in shared log | HUMAN | iOS+Android | P2 |
| SHELL-15 | Toast appear/auto-dismiss | Trigger quiet confirmation (e.g. copy/save action) | Pill toast slides up above media dock, auto-dismisses ~2s, never obscures a dialog | AUTO | iOS+Android | P2 |
| SHELL-16 | Rapid toast replacement | Fire two toast-producing actions back-to-back | Second toast replaces first cleanly; none get stuck; no stale toast replays after screen change | AUTO | iOS+Android | P3 |
| SHELL-17 | Destructive dialog styling | Trigger any delete confirm | Warm-paper card, red destructive label/icon, cancel present; warning haptic fires | PARTIAL | iOS+Android | P1 |
| SHELL-18 | Dialog dismiss rules | Open confirm w/ cancel → tap scrim; open info dialog w/o cancel → tap scrim | Scrim tap (and Android back) dismisses only when a cancel button exists | AUTO | iOS+Android | P2 |
| SHELL-19 | Dialog button layouts | Trigger 2-button, 3-button, and rich (description) dialogs | 2 plain = side-by-side; 1 or 3+ stack; rich rows show icon+label+description | AUTO | iOS+Android | P3 |
| SHELL-20 | Paywall open from Settings | Settings → Songstead Pro upsell row | Bottom sheet: "Grow every idea", 6 feature rows, 3 plan cards, Annual preselected w/ "Best value" tag | AUTO | iOS+Android | P1 |
| SHELL-21 | Paywall plan select | Tap Monthly → tap Lifetime → tap Annual | Selection highlight moves; CTA reads "Get Lifetime" for lifetime, else "Start free trial" | AUTO | iOS+Android | P2 |
| SHELL-22 | Paywall CTA (billing stub) | Select any plan → tap CTA | Info alert: purchasing not available, "preview of the upgrade"; sheet stays open after dismissing alert | AUTO | iOS+Android | P1 |
| SHELL-23 | Paywall restore (stub) | Paywall → tap Restore | "There are no purchases to restore yet" alert; sheet stays open | AUTO | iOS+Android | P2 |
| SHELL-24 | Paywall Terms/Privacy links | Paywall → tap Terms; tap Privacy | External browser opens the hosted terms/privacy pages; returning to app keeps sheet open | AUTO-A | iOS+Android | P3 |
| SHELL-25 | Paywall dismiss gestures | Open paywall → drag sheet down; reopen → tap backdrop | Both dismiss the sheet; underlying screen untouched; reopening shows fresh default (Annual) selection | AUTO | iOS+Android | P2 |
| SHELL-26 | Settings Restore purchases row | Settings → Pro section → Restore purchases | Result alert shown (stub: nothing to restore); no crash, no entitlement change | AUTO | iOS+Android | P2 |
| SHELL-27 | Dev Pro override | Dev build: enable entitlement override → revisit Settings + a gated feature | Settings shows "Songstead Pro · Active"; gated features proceed without paywall | AUTO | iOS+Android | P2 |
| SHELL-28 | Tuner open + grant mic | Drawer → Tuner → grant mic permission | Listening state; dial shows "--" idle; helper text visible; no error | AUTO | iOS+Android | P1 |
| SHELL-29 | Tuner deny (re-askable) | Fresh permission → deny at prompt | Inline error "needs microphone access… Tap to try again"; tap re-prompts | AUTO-A | iOS+Android | P2 |
| SHELL-30 | Tuner permanently denied | Deny in system settings → open Tuner → tap error → enable mic in Settings → return to app | Error says "disabled in system settings. Tap to open settings"; tap opens OS settings; on foreground return tuner auto-starts listening | HUMAN | iOS+Android | P2 |
| SHELL-31 | Tuner real pitch | Play a note (e.g. guitar E2/A4) near mic | Correct note+octave, cents needle tracks, green in-tune lock ≤5¢ with one success haptic (no machine-gun repeat); stale signal clears to "--" | HUMAN | iOS+Android | P2 |
| SHELL-32 | Tuner focus lifecycle | Tuner listening → navigate to another drawer screen → return; also background/foreground app | Mic stops on blur (OS mic indicator off), restarts on focus/foreground; engine self-restarts if it stalls | HUMAN | iOS+Android | P2 |
| SHELL-33 | Metronome BPM set | Drawer → Metronome → drag tempo slider / tap +/- | BPM readout updates; while running, tempo change applies (debounced) without staying stuck at old tempo | AUTO | iOS+Android | P1 |
| SHELL-34 | Metronome start/stop | Tap Start → observe pulse halo + beat/bar counter → tap Stop | Visual pulse flashes on beat, counter advances, Stop halts everything; click is audible at set volume (ear check) | PARTIAL | iOS+Android | P1 |
| SHELL-35 | Tap tempo | Tap the Tap button 4+ times at steady rate; then wait and tap once | BPM converges to tapped rate; long pause resets tap history (single tap doesn't set BPM) | AUTO | iOS+Android | P2 |
| SHELL-36 | Meter change | Select meter chips (3/4, 6/8, …) while running | Meter label + beat ring beats-per-bar update; downbeat accent lands on beat 1 (ear check) | PARTIAL | iOS+Android | P2 |
| SHELL-37 | Cue toggles + all-off warning | Toggle beep/visual/haptic cues off one by one while running | Each cue stops independently (haptic feel = hand check); with all outputs off a status label warns; level rows hide when cue off | PARTIAL | iOS+Android | P2 |
| SHELL-38 | Live click volume | While running, change beep level | Volume changes live without restart, phase reset, or audible glitch | PARTIAL | iOS+Android | P3 |
| SHELL-39 | Metronome persistence | Set BPM/meter/cues/levels → kill app → relaunch → Metronome | All settings restored from store | AUTO | iOS+Android | P3 |
| SHELL-40 | Metronome vs playback session | Start metronome → play a clip from library → return | Audio session ownership hands off cleanly; no stuck click, no dead playback | PARTIAL | iOS+Android | P2 |
| SHELL-41 | BT calibration full run | Connect BT headphones → open Bluetooth Calibration → run music pass + click pass → fine-tune ± by ear → Save | Offset estimated, ± adjusts, save confirms with route label; recording overdubs then align | HUMAN | iOS+Android | P2 |
| SHELL-42 | BT calibration no-BT state | Open Bluetooth Calibration with no BT route | Screen renders guidance for non-Bluetooth route, run controls handle it gracefully; no crash | AUTO | iOS+Android | P3 |
| SHELL-43 | Remove saved calibration | With a saved calibration → tap remove | Confirm dialog "Remove/Keep" naming the route; Remove deletes entry, Keep does nothing | HUMAN | iOS+Android | P3 |
| SHELL-44 | Interrupt calibration | Mid-pass → press back / disconnect headphones | Pass aborts cleanly, no stuck audio, screen recovers to idle with error or reset state | HUMAN | iOS+Android | P3 |
| SHELL-45 | Store-review prompt | ≥10 saved clips, ≥5 days post-install, no ask in 120d → save a clip | OS review dialog may appear once; never re-asks within cooldown; save flow never blocked if API missing | HUMAN | iOS+Android | P3 |
| SHELL-46 | Deep link scheme | With app cold and warm: open songstead://home | App opens/foregrounds to Home; no crash; nav state sane afterwards | AUTO-A | iOS+Android | P2 |
| SHELL-47 | Invalid deep link | Open songstead://nonexistent-path | App opens normally (fallback nav), no crash, no blank screen | AUTO-A | iOS+Android | P3 |
| SHELL-48 | Share-intent redirect | Share an audio file from another app to Songstead | App routes to ShareImport screen (not Home); after import/cancel, reset returns to Home | HUMAN | iOS+Android | P1 |
| SHELL-49 | Help sheet basics | Open a Help button (e.g. Recording help) → read → drag down / tap backdrop | Sheet lists icon+label+description items matching real behavior; both dismiss gestures work | AUTO | iOS+Android | P3 |
| SHELL-50 | Empty state teaching | Open a surface with no content (fresh collection/search no results) | EmptyState: muted icon, title, body, optional action button that works — never a blank void | AUTO | iOS+Android | P3 |
| SHELL-51 | Dev menu access | Dev build: shake device / adb dev menu | Dev menu opens; entitlement override + debug tools reachable; not present in release builds | HUMAN | iOS+Android | P3 |
