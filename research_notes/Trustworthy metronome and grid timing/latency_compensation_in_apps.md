# Recording-latency compensation in mobile music apps (iOS and Android)

Scope: how real apps make a take recorded against a click land on the grid, across speaker + mic, wired headphones and Bluetooth. Researched 2026-10-30. Labels used: **[DOC]** = vendor manual, help page or platform documentation; **[FORUM]** = user or developer anecdote; **[DATED]** = material from before 2020.

## 1. How the named apps handle input/output (round-trip) latency compensation

### Takeaway
Two clear camps. On **Android**, every serious recorder I could document (n-Track, FL Studio Mobile, BandLab, Cubasis-style hosts) runs an **acoustic loopback calibration**: it plays a beep through the speaker, records it with the mic and measures the offset. Each also keeps a **manual offset** as a fallback. On **iOS**, apps mostly **trust the OS-reported latency** and say calibration is "not necessary". Even so, iOS users still report early or late takes, and they ask for a manual offset. Cubasis is the iOS exception: it ships an offset slider plus a calibrate routine. I found **no app that uses tap-along calibration** for recording alignment, and **no app documented as re-aligning each take from click bleed**.

### Cited Findings

**n-Track Studio (Android, also iOS/desktop)** **[DOC]**
- The app tells the user to calibrate the first time they try to record. Calibration can be re-run from the latency calibration button in Settings. Android controls the buffering, so the app "can't know" on its own how to line a new take up with existing tracks. — [n-Track user guide, audio issues](https://ntrack.com/lk/audio-issues)
- Method: the app plays a short burst of sound while recording the mic, then aligns the original burst with the recorded one. — [n-Track user guide](https://ntrack.com/lk/audio-issues)
- Before calibrating: use a quiet room, disconnect headphones and USB audio devices, and turn device volume to maximum. The usual cause of failure is a mic input level that is too low. — [n-Track user guide](https://ntrack.com/lk/audio-issues)
- Manual fallback. Record a snap, set the compensation (start at 5000), record a second track while the first plays, compare them, then step the value by 1000 and refine in steps of 100. Positive and negative values are both accepted. Entering "1" disables automatic compensation. — [n-Track user guide](https://ntrack.com/lk/audio-issues). Staff on the forum describe the same flow: main menu → "Recording latency compensation" → "Go!", volume fully up, quiet room. — [n-Track forum, "Overdubbing"](https://discussion.ntrack.com/t/overdubbing/16364) **[FORUM, staff]**
- Per-take nudge: long-press the waveform → Properties → "Adjust latency" in ms (positive if early, negative if late, suggested 10 ms steps). Or drag the clip against the grid. — [n-Track user guide](https://ntrack.com/lk/audio-issues)
- Calibration results are collected anonymously and published as a public "Android devices audio performance chart" (14,173 devices listed). — [n-Track Android latency chart](https://www.ntrack.com/android-latency/devices)

**FL Studio Mobile (Android + iOS)** **[DOC]**
- Setting: "Enable audio recording latency compensation", which "ensures recorded audio is correctly aligned with the Playlist." The manual says the compensation "removes a slice of audio, equal to the detected round-trip audio delay, from the start of the recording." — [FL Studio Mobile manual, Settings](https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_HomePanel_Settings.htm)
- Calibration: "FL Studio Mobile will try to record its own output … by recording a single 'beep' sound and comparing where it ends up relative to the Playlist." The manual says the calibration is "**Not necessary on iOS devices.**" — [FL Studio Mobile manual](https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_HomePanel_Settings.htm)
- Calibration steps for the internal mic: quiet location, disconnect headphones, volume 80–100 %, then tap Calibrate. With an external mic, hold it close to a speaker or against a headphone driver. Don't move or bump the device. "This won't work on a bus! :)". The failure message usually means "the calibration beep was not detected." — [FL Studio Mobile manual](https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_HomePanel_Settings.htm)
- Forum, iOS: a user couldn't find the Calibrate option on iOS, and the reply said manual calibration is no longer required there. — [Image-Line forum, "Calibrate iOS Latency Compensation"](https://forum.image-line.com/viewtopic.php?p=1785113) **[FORUM]**
- Forum, Android problems: on a Chromebook, calibration succeeded and takes recorded in sync "until it doesn't". With USB interfaces, the default "Native" sound mode froze, distorted or crashed the app, which prevented accurate compensation. — [Image-Line forum, calibration failure](https://forum.image-line.com/viewtopic.php?p=1204228); [Image-Line forum, Android USB audio](https://forum.image-line.com/viewtopic.php?p=1185880) **[FORUM]**

**BandLab (iOS, Android, web)** **[DOC, partially read]**
- Help articles say there is "no way to completely fix latency, but we can help you work around it". Running the latency test "can help BandLab detect and implement compensation techniques". The test "will still help you align your new recordings" even if live monitoring still feels off. — [BandLab Help, "Fixing Latency"](https://help.bandlab.com/hc/en-us/articles/115002959414-Fixing-Latency) (page returned 403 to my fetch; these lines come from search-result extracts)
- Advanced manual offset: "Set the Manual Adjustment to the number shown on the latency test result". This is for cases where automatic correction is off. The help page calls "100–250 ms" "high but might be expected on some devices". — [BandLab Help, "How do I troubleshoot latency?"](https://help.bandlab.com/hc/en-us/articles/115002959414-How-do-I-fix-latency-) (search extract)
- BandLab advises running the test with the headphones and mic you will actually use. It also says Bluetooth "will add even more latency". — same BandLab help page (search extract)
- A BandLab staff reply says there is no latency fix on iOS "as it is automatically compensated". It adds that Bluetooth "naturally comes with some latency". Reddit users report the latency-fix option missing on iOS, and a moderator replied that it was fixed in an update. — [r/Bandlab thread](https://nyc1.lr.ggtyler.dev/r/Bandlab/comments/1h0n83s/how_to_fix_latency_issues) **[FORUM, staff]**

**Soundtrap (web, desktop app, mobile)** **[DOC, partially read]**
- The Voice & Mic track's instrument panel has a "Calibrate" button. Calibration is described as aligning the mic's round-trip latency so that "new recordings will now align correctly with the beat". Support says to redo it if you switch microphones. — [Soundtrap Support, "Latency Calibration"](https://support.soundtrap.com/hc/en-us/articles/25549534050962-Latency-Calibration); [Soundtrap Support, "Latency"](https://support.soundtrap.com/hc/en-us/articles/26663690434066-Latency) (403 to fetch; content from search extracts. I could not confirm whether the calibration is loopback or tap-based.)
- A W3C 2021 workshop talk by a Soundtrap engineer covers latency in browser DAWs. — [W3C talk, Ulf Hammarqvist](https://w3.org/2021/03/media-production-workshop/talks/ulf-hammarqvist-audio-latency.html) (not read in full)

**Cubasis (iOS/Android, Steinberg)** **[FORUM]**
- The setting is "Audio Recording Offset Compensation" ("Audio Rec. Offset Compensation" in Setup → Audio). Users describe it as a slider that is fiddly at low values. There is a calibrate function, which says to remove all hardware first and needs enough input level. — [Steinberg forum, "advice for the Cubasis 3 recording offset compensation"](https://forums.steinberg.net/t/is-there-some-advice-for-the-cubasis-3-recording-offset-compensation/745813); [Steinberg forum, "Please explain audio recording offset compensation"](https://forums.steinberg.net/t/please-explain-audio-recording-offset-compensation/766363)
- Users found the "Total Latency" figure Cubasis displays to be a good value for the offset when recording against the metronome. — [Steinberg forum](https://forums.steinberg.net/t/is-there-some-advice-for-the-cubasis-3-recording-offset-compensation/745813)
- Bug report: on Cubasis 3.4.3 / iOS 15.4 with Focusrite interfaces, the compensation added 12–13 ms on Input 1 but only about 0.3–0.6 ms on other inputs. — [Steinberg forum, Scarlett Input 1](https://forums.steinberg.net/t/scarlett-interfaces-increased-latency-on-input-1/781632)
- The calibrate function gave wrong results with an iRig HD. — [Steinberg forum, "Calibrate function gives incorrect results with iRig HD"](https://forums.steinberg.net/t/calibrate-function-gives-incorrect-results-with-irig-hd/740519)
- With the iPad internal mic, a user measured a 32 ms recording offset and was told it "can't be compensated automatically" at that time. — [Steinberg forum, "Audio out of sync from iPad mic"](https://forums.steinberg.net/t/audio-out-of-sync-from-ipad-mic/95425) **[likely DATED]**

**GarageBand for iOS** **[FORUM only]**
- No official documentation of a user offset or calibration. A user said "I unfortunately couldn't find a way to enter latency offset in GarageBand". — [The Gear Forum, iPad recording latency](https://thegearforum.com/threads/ipad-recording-latency%E2%80%A6-help-me.9698/latest)
- There are reports of both over- and under-compensation. Notes recorded "consistently before the beats" ([Apple Community, "GB over-compensating for latency"](https://discussions.apple.com/thread/8306871)). Takes delayed with or without Bluetooth ([Apple Community 255907696](https://discussions.apple.com/thread/255907696)). "Reverse latency" (takes early) on an iPad Pro running iOS 17.4.1 ([Apple Community 255563195](https://discussions.apple.com/thread/255563195)). One user reported added monitoring latency of about 100–200 ms with USB mics after iPadOS 18.5 ([Apple Community 256075938](https://discussions-jp-prz.apple.com/thread/256075938)).
- In one Steinberg thread, GarageBand stayed in sync where Cubasis was 32 ms off. That suggests GarageBand applies the OS-reported latency automatically. — [Steinberg forum](https://forums.steinberg.net/t/audio-out-of-sync-from-ipad-mic/95425)

**Loopy Pro (iOS)** **[FORUM / roadmap]**
- A forum reply says "Loopy doesn't do latency compensation". There is a roadmap item for a manual latency/track-offset slider in system settings, motivated by Bluetooth and high-latency setups, with status "planned". — [Loopy Pro roadmap, latency adjustment](https://roadmap.loopypro.com/feature-requests/p/latency-adjustment-custom-track-offset-parameter); [Loopy Pro forum](https://forum.loopypro.com/discussion/comment/1272139)
- iOS "Measurement" session mode turns off AGC and extra processing on the built-in mic and speaker. Users describe the default mode as adding "loads of latency". AUM exposes it and also shows the round-trip latency. — [Loopy Pro forum (Audiobus forum archive)](https://forum.loopypro.com/discussion/comment/432253) **[DATED, ~2017]**

**Auria Pro (iOS)** **[FORUM]**
- Forum posts discuss a "Record Latency" setting (the manual reportedly suggests 4096). That appears to be a buffer size, not a capture offset. One user says Auria "does not implement negative compensation". Another says Cubasis and Auria Pro "don't do latency compensation when using audio tracks". — [Audiobus forum, Auria Pro recording](https://forum.audiob.us/discussion/36113/auria-pro-recording); [Loopy Pro forum, FAC Maxima / latency compensation on iOS hosts](https://forum.loopypro.com/discussion/30145/fac-maxima-latency-within-cubasis-and-other-au-hosts-latency-compensation-on-ios-hosts); [Loopy Pro forum, Auria MIDI compensation](https://forum.loopypro.com/discussion/45720/auria-pro-midi-compensation-placing-events-early)

**Ableton Note, Koala, Spire, Audio Evolution Mobile** — no documentation found (see Gaps). An Ableton Note launch-era thread asks for "some form of delay compensation, especially with Bluetooth headphones". It is a user request, not a feature. — [Elektronauts, Ableton Note thread](https://stage2.elektronauts.com/t/ableton-note/181538?page=3) **[FORUM]**

### Inferences
- The split follows the platforms. iOS publishes per-route `inputLatency`/`outputLatency`, and apps there trust them and skip calibration. Android had no runtime latency API for most of its history (see §5), so Android apps converged on loopback calibration.
- "Trusting iOS" mostly works, but the recurring early/late reports (GarageBand, Cubasis Input 1, iPad mic 32 ms) show that the OS figure can be wrong for some routes and devices. That is why users keep asking for a manual offset.
- The common product pattern is: automatic estimate, plus a one-time loopback calibration on Android, plus a manual offset field, plus per-clip nudging. Nobody I found ships only one of these.

### Gaps
- No primary documentation for GarageBand iOS, Ableton Note, Koala Sampler, Spire, Audio Evolution Mobile or Auria on recording-offset handling. Searches returned only forum posts or nothing at all.
- BandLab and Soundtrap help pages returned 403, so the exact calibration mechanism (loopback beep vs tap) and the UI location are unconfirmed beyond search extracts.
- No source confirmed any app using tap-along calibration for recording offset. Tap-along appears in metronome apps (e.g., a Soundbrenner feature request for a metronome latency offset, [Soundbrenner suggestions](https://suggestions.soundbrenner.com/latency-offset-adjustment-for-metronome)), but not as a documented recorder calibration.

## 2. Calibration UX: where it lives, how long it takes, per route, automatic re-runs

### Takeaway
Calibration is a **one-shot, settings-level action**. It is offered at the first record attempt (n-Track) or sits behind a "Calibrate" button in Settings or the track panel (FL Studio Mobile, Soundtrap, Cubasis). It needs a quiet room, max volume and no headphones, because it is an acoustic speaker-to-mic test. **It is not automatically per route.** Vendors tell users to redo it when the mic or interface changes. None I found re-calibrates automatically on route change.

### Cited Findings
- n-Track prompts at the first record attempt and can be re-run from Settings. Prerequisites: quiet room, headphones and USB disconnected, full volume. — [n-Track guide](https://ntrack.com/lk/audio-issues)
- FL Studio Mobile: Home → Settings → Calibrate. Quiet, headphones out, 80–100 % volume, don't touch the device. On failure the beep "was not detected". — [FL Studio Mobile manual](https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_HomePanel_Settings.htm)
- Soundtrap: "Calibrate" sits in the Voice & Mic track's instrument panel. Redo it after switching microphones. — [Soundtrap Support](https://support.soundtrap.com/hc/en-us/articles/25549534050962-Latency-Calibration) (search extract)
- BandLab: run the test with the headphones and mic you will use, then optionally paste the result into "Manual Adjustment". — [BandLab Help](https://help.bandlab.com/hc/en-us/articles/115002959414-How-do-I-fix-latency-) (search extract)
- Cubasis: calibrate in Setup → Audio with hardware removed. Users are unsure whether to recalibrate after a sample-rate or buffer change. — [Steinberg forum](https://forums.steinberg.net/t/please-explain-audio-recording-offset-compensation/766363)
- Generic DAW guidance (Audacity workflow): "if you change the input, output or audio host, measure again". — [Jack Righteous, Audacity workflow guide](https://jackrighteous.com/blogs/ai-creator-tools/audacity-recording-microphone-overdub-latency-workflow)
- On duration, the manuals describe a single beep or burst ("a single 'beep'", "a short burst"), so the test is a few seconds at most. No source gives a timed figure. — [FL Studio Mobile manual](https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_HomePanel_Settings.htm); [n-Track guide](https://ntrack.com/lk/audio-issues)
- Android's own CTS loopback test uses noise bursts rather than clicks, so the start of the signal can be recognised accurately. It measures speaker/mic, wired headset (loopback dongle) and USB as separate paths, and calibrates the output level first. — [AOSP, Audio loopback latency test](https://source.android.com/docs/compatibility/cts/audio-loopback-latency?hl=en); [AOSP, Measure audio latency](https://source.android.com/docs/core/audio/latency/measure)

### Inferences
- A speaker-to-mic calibration measures the **speaker** route only. It cannot measure the wired-headphone route, because the mic can't hear the headphones (Ardour makes the same point, §5). Yet apps apply that one stored value to every route. With wired headphones the output path is usually similar to or shorter than the speaker path, so the error tends to be small. With Bluetooth it is large.
- The acoustic path adds roughly 1 ms per 34 cm of speaker-to-mic distance. That is negligible on a phone, and calibration includes it anyway.

### Gaps
- No source documents any app keeping a separate calibrated value per output route, or auto-recalibrating when the route changes.
- No published timing for how long calibration takes, and no published failure rates.

## 3. Bluetooth (A2DP) handling

### Takeaway
Measured Bluetooth output latency is **~125–220 ms and drifts**, and iOS's reported `outputLatency` underestimates it, especially just after connecting. Apps respond with **advice, not engineering**: "use wired headphones", "not recommended for multitrack recording". I found **no app that refuses to record over Bluetooth**, and **no documented Bluetooth-specific calibration**. Loopy Pro's planned manual offset slider is the nearest thing.

### Cited Findings
- iPhone 12 mini + AirPods 2, `playAndRecord` with `.allowBluetoothA2DP`, built-in mic. The session reported `inputLatency` 2.438 ms, `outputLatency` 160.667 ms and `ioBufferDuration` 1.333 ms, predicting 165.8 ms in total. The measured figure was **~215–220 ms on a fresh connection, falling over 20–30 min to ~155–160 ms**. With AirPods already in use it started at ~180 ms. Older iOS devices were further off. No Apple engineer replied. — [Apple Developer Forums 679274](https://developer.apple.com/forums/thread/679274) **[FORUM, developer measurement]**
- Another developer found the reported value "much smaller than the real Bluetooth audio latency", shifting from ~193 ms to ~260 ms within a minute. — [Apple Developer Forums 126277](https://developer.apple.com/forums/thread/126277) **[FORUM]**
- Core Audio list: `inputLatency`/`outputLatency` are "estimations and not exact", and "least reliable of course with Bluetooth". — [coreaudio-api list, Jan 2020](https://lists.apple.com/archives/coreaudio-api/2020/Jan/msg00009.html)
- Stephen Coyle's measurements: AirPods 2 ~153 ms, AirPods Pro ~126 ms. AirPods Pro 2 are described as about 40 ms better, but still disappointing for real-time playing. — [iMore, AirPods Pro 2 latency](https://www.imore.com/airpods/airpods-pro-2-latency-is-much-better-but-will-still-disappoint-heres-why)
- Bluetooth output "can delay loop playback until the loop is restarted" (Loopy). Bluetooth latency is "largely inherent to the protocol". — [Loopy Pro forum](https://forum.loopypro.com/discussion/comment/1123136/) **[FORUM]**
- A user said you will have "at least 100 ms of delay when monitoring realtime input signals with Bluetooth audio". — [Audiobus/Auria forum](https://forum.audiob.us/discussion/36113/auria-pro-recording) **[FORUM]**
- n-Track: Bluetooth headsets and speakers "add considerable latency", are not recommended for multitrack recording or live playing, and "wired headphones add no latency". — [n-Track guide](https://ntrack.com/lk/audio-issues) **[DOC]**
- BandLab: Bluetooth "will add even more latency". Staff say it "naturally comes with some latency". One Reddit tip: switch the audio input in settings and back to the BT headphones. — [BandLab Help](https://help.bandlab.com/hc/en-us/articles/115002959414-Fixing-Latency) (search extract); [r/Bandlab](https://nyc1.lr.ggtyler.dev/r/Bandlab/comments/1h0n83s/how_to_fix_latency_issues) **[FORUM]**
- FL Studio Mobile uses Bluetooth only for MIDI and says nothing about Bluetooth audio for recording. — [FL Studio Mobile manual](https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_HomePanel_Settings.htm)
- GarageBand iOS: monitoring the mic through Bluetooth "makes it impossible to record in sync with the other tracks". — [Apple Community 7812953](https://discussions.apple.com/thread/7812953) **[FORUM]**
- Cubase/Cubasis users file feature requests for "some kind of delay compensation for bluetooth or ability to move audio by msecs". — [Steinberg forum feature request](https://forums.steinberg.net/t/incorporate-some-kind-of-delay-compensation-for-bluetooth-or-ability-to-move-audio-by-msecs/1004415) **[FORUM]**
- Bluetooth makes the platform's "use the reported latency" approach unreliable in two ways: the error is roughly 20–60 ms relative to the reported value, and it drifts over minutes. — derived from [Apple Developer Forums 679274](https://developer.apple.com/forums/thread/679274) and [126277](https://developer.apple.com/forums/thread/126277)

### Inferences
- With an A2DP output and the phone mic, the take is late by the full Bluetooth output delay plus the input path, because the performer plays to a click heard ~150–220 ms late. An app that subtracts the reported `outputLatency` gets within tens of ms on iOS, but the leftover error drifts within one session. That rules out a fixed calibration constant for Bluetooth.
- A speaker loopback cannot measure Bluetooth earbuds, because the phone mic can't hear them. So the only measured options for Bluetooth are a manual nudge, or a tap-along test where the user taps to the click they hear. No app I found ships the tap-along test (see §1 Gaps).

### Gaps
- No Android Bluetooth latency figures from the sources read (Android's latency pages don't cover Bluetooth). Nothing on LE Audio/LC3 or aptX Low Latency in recording apps.
- No app found that detects Bluetooth and shows an in-product warning before recording with a click. I can't confirm whether any does.

## 4. Self-alignment: measuring the offset per take from click bleed in the recording

### Takeaway
I found **no app documented as self-aligning each take from click bleed**. The established practice is a one-time calibration plus manual per-clip nudging. Generic sources warn that cross-correlation can lock onto the wrong peak, and that self-recorded click tests can miss parts of the real path.

### Cited Findings
- Audacity's documented approach is a one-time loopback click recording, applied as a fixed "Latency Correction" (e.g., a measured 73 ms entered as −73). There is "still a tiny delay". — [Audacity manual, Punch and Roll Record](https://manual.audacityteam.org/man/punch_and_roll_record.html); [Berklee Online help, correcting latency in Audacity](https://online.berklee.edu/help/1849138)
- Forum critique: "self-recording the click track is never going to give accurate latency values. It will always be missing the delays in the headphone and microphone systems." — [Audacity forum, latency](https://forum.audacityteam.org/t/latency/40532) **[FORUM]**
- Mic bleed of the click is a known artefact when overdubbing on headphones. Advice is to run the latency test through the same input you record with. — [Audacity forum](https://forum.audacityteam.org/t/latency-test-help/62189) **[FORUM]**
- About 8 ms of misalignment was observed when testing overdub alignment with a ping loopback. — [Gearspace, measuring latency](https://gearspace.com/threads/measuring-latency.98915/) **[FORUM, DATED]**
- Cross-correlation "does not always find where one signal is inside another". — [MathWorks Answers, align two signals using cross correlation](https://www.mathworks.com/matlabcentral/answers/896787-align-two-signals-using-cross-correlation) **[FORUM]**
- Android's reference loopback test deliberately uses noise bursts, not clicks, so a normalized correlation can find the start unambiguously. — [AOSP, Measure audio latency](https://source.android.com/docs/core/audio/latency/measure)

### Inferences
- A periodic click is a poor correlation target: every beat looks alike, so the correlation has a peak every beat period and is ambiguous across a whole beat. Bleed through headphones is faint, and a live performance dominates it. Through the speaker, the bleed is the playback itself, which the OS figure already covers. This is consistent with no shipping app relying on it, and with AOSP choosing noise bursts.
- If a per-take check is attempted at all, the pattern the sources support is a distinctive pre-roll or count-in burst (noise, not a periodic click), correlated within a narrow window around the expected offset. That is an inference from the AOSP method, not a documented app feature.

### Gaps
- No primary source found for any app (iOS or Android) that measures per-take offset from the recording itself. No published reliability data for such an approach.

## 5. What audio developers say is the most robust approach

### Takeaway
Platform engineers measure **round-trip with a loopback and a correlatable signal**. Where the OS exposes stream timestamps (AAudio/Oboe `getTimestamp`, iOS session latencies), apps use them to align. Developers treat both as estimates that miss unknown external latency (USB DACs, Bluetooth). The robust recipe is: use the OS timestamps and latencies as the baseline, offer a loopback calibration for the speaker route, and keep a user offset for everything else.

### Cited Findings
- Android definitions: round-trip = input + app processing + output. Rule of thumb: input ≈ output ≈ ½ round-trip on paths without processing. CDD target is **round-trip ≤ 20 ms**, and musicians "generally need about 10 ms". "There is no runtime API to query audio latency on any path." — [Android Developers, Audio latency](https://developer.android.com/ndk/guides/audio/audio-latency) **[DOC]**
- Feature flags: `android.hardware.audio.low_latency` means continuous output latency ≤ 45 ms. `android.hardware.audio.pro` means continuous round-trip ≤ 20 ms. — [Android Developers, Audio latency](https://developer.android.com/ndk/guides/audio/audio-latency) **[DOC]**
- Android warns: don't assume input and output callbacks are synchronized (separate queues, no shared clock), don't assume the actual rate equals the nominal rate, and don't assume capture and playback rates match. Use asynchronous SRC for drift. Use the `VOICE_RECOGNITION` input preset to avoid processing. Prime output with silence to avoid warmup latency. — [Android Developers, Audio latency](https://developer.android.com/ndk/guides/audio/audio-latency) **[DOC]**
- AOSP measures round-trip (input and output are hard to isolate) by playing white-noise bursts and finding them in the input with normalized correlation. OboeTester provides a round-trip test that can run from an Intent for CI. — [AOSP, Measure audio latency](https://source.android.com/docs/core/audio/latency/measure) **[DOC]**
- Oboe derives latency from `getTimestamp()` (`calculateLatencyMillis`). Output latency is usually higher than input. Input latency "will decrease abruptly when you read data… then increase slowly". External DACs (USB/HDMI) add latency "the Android device is unaware of". `getTimestamp` was unsupported on OpenSL ES. — [oboe-rs docs, AudioStreamSafe](https://docs.rs/oboe/latest/oboe/trait.AudioStreamSafe.html); [google/oboe issue #15](https://github.com/google/oboe/issues/15)
- AAudio commit "improve accuracy of timestamps" accounts for latency added by the AAudio service (Phil Burk). — [AOSP mirror commit](https://gitlab.e.foundation/e/os/android_frameworks_av/-/commit/97350f9df7252c881f011a410fcd9e6d766d2bee)
- iOS round-trip formulas are debated on the Core Audio list: `inputLatency + outputLatency + 2×ioBufferDuration` vs `+4×`, plus one more buffer when a latency exceeds the buffer duration. Measurement mode gives the lowest latency. — [coreaudio-api list](https://lists.apple.com/archives/coreaudio-api/2020/Jan/msg00007.html); [msg00008](https://lists.apple.com/archives/coreaudio-api/2020/Jan/msg00008.html); [msg00011](https://lists.apple.com/archives/coreaudio-api/2020/Jan/msg00011.html)
- Ardour makes a speaker-to-mic measurement optional for capture alignment because it fails with headphones ("the mic won't be able to pick it up"). The thread suggests an audio queue processing tap as a loopback with playback timestamps. — [coreaudio-api list, Jan 2020](https://lists.apple.com/archives/coreaudio-api/2020/Jan/msg00009.html)
- Logic Pro support context: a recording delay offset mainly corrects drivers that report the wrong latency, and is usually left at 0. — cited in [Apple Community 7970624](https://discussions.apple.com/thread/7970624) **[FORUM]**
- Superpowered's open-source round-trip latency app runs on iOS and Android. 2015–2016 data: Apple devices < 10 ms; best Android Nexus 9 at 15 ms and Nexus 6P at 18 ms; KitKat/Lollipop devices in the hundreds of ms; database of 4,238+ models/builds. — [SuperpoweredLatency GitHub](https://github.com/JeffMcKnight/SuperpoweredLatency); [Android Authority 2015](https://androidauthority.com/horrendous-android-audio-latency-624171); [Android Authority, Marshmallow](https://androidauthority.com/android-6-0-marshmallow-audio-latency-670727) **[DATED]**

**Typical numbers by route and platform (collected)**
| Route / context | Figure | Source |
|---|---|---|
| Android CDD round-trip target | ≤ 20 ms (pro), ≤ 45 ms output (low_latency) | [Android Developers](https://developer.android.com/ndk/guides/audio/audio-latency) |
| Android device latency (FL Studio Mobile manual) | "usually between 40 and 200 ms" | [FL Studio Mobile manual](https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_HomePanel_Settings.htm) |
| BandLab test result range | 100–250 ms "high but might be expected on some devices" | [BandLab Help](https://help.bandlab.com/hc/en-us/articles/115002959414-How-do-I-fix-latency-) |
| n-Track crowd chart, best Android entries | ~5–18 ms (page 1; e.g., Galaxy S9+ 11.7 ms with pro FastPath); "not scientifically accurate" | [n-Track chart](https://www.ntrack.com/android-latency/devices) |
| FL Studio Mobile audio buffer | ~5–20 ms per buffer | [FL Studio Mobile manual](https://www.image-line.com/fl-studio-learning/fl-studio-mobile-online-manual/html/plugins/FL%20Studio%20Mobile_HomePanel_Settings.htm) |
| Android typical HAL buffer sizes | 96–512 frames (2–11 ms at 48 kHz) | [Android Developers](https://developer.android.com/ndk/guides/audio/audio-latency) |
| iOS round-trip (2015–16) | < 10 ms | [Android Authority](https://androidauthority.com/horrendous-android-audio-latency-624171) [DATED] |
| iPad internal mic, Cubasis offset | 32 ms | [Steinberg forum](https://forums.steinberg.net/t/audio-out-of-sync-from-ipad-mic/95425) [likely DATED] |
| iOS built-in input latency (iPhone 12 mini) | 2.4 ms reported | [Apple Dev Forums 679274](https://developer.apple.com/forums/thread/679274) |
| Bluetooth AirPods 2 on iPhone | reported 160.7 ms; measured 215–220 → 155–160 ms over 20–30 min | [Apple Dev Forums 679274](https://developer.apple.com/forums/thread/679274) |
| Bluetooth (other iOS dev) | 193 → 260 ms within a minute | [Apple Dev Forums 126277](https://developer.apple.com/forums/thread/126277) |
| AirPods 2 / AirPods Pro (Coyle) | ~153 ms / ~126 ms | [iMore](https://www.imore.com/airpods/airpods-pro-2-latency-is-much-better-but-will-still-disappoint-heres-why) |
| Wired headphones | "add no latency" (n-Track's claim, i.e. negligible beyond the device path) | [n-Track guide](https://ntrack.com/lk/audio-issues) |
| MacBook internal speaker + mic acoustic loop | 44 ms | [Loopy Pro forum](https://forum.loopypro.com/discussion/49383/pretty-big-latency-on-the-internal-speaker-or-mic-on-macbook-pro-2021) [FORUM] |

### Inferences
- The developer consensus has three layers: (1) align from platform timestamps and latencies (AAudio `getTimestamp`, iOS session latencies plus buffer terms); (2) verify or override with a loopback measurement using a correlatable burst on the routes where the mic can hear the output (the speaker); (3) give the user a manual offset for routes no loopback can measure (headphones, Bluetooth, unknown USB DACs).
- Android figures span two orders of magnitude (5 ms to 250 ms) across devices and modes. A hard-coded constant is therefore never acceptable on Android. Some measurement, either OS timestamps or calibration, is required per device.

### Gaps
- I did not find a recent (2022–2026) Google or Superpowered blog post that states a recommended recording-alignment recipe in so many words. The recipe above is assembled from the docs.
- I found no JUCE or KVR threads specifically on phone recording-offset compensation within the call budget.
- No current (2024–2026) per-device round-trip table from Superpowered. Its figures are 2015–16.
