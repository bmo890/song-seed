# Platform timing APIs: knowing when a sound leaves the speaker and when it reaches the mic (iOS + Android), plus haptic/visual alignment

Researched 2026-10-30. Primary sources (AOSP/AndroidX source, developer.android.com, Apple docs JSON) are preferred. Forum posts are marked **[anecdote]**. Inferences are kept separate from cited facts.

---

## Android: AudioTrack.getTimestamp and AudioRecord.getTimestamp (API 24+)

### Takeaway
Both calls return a pair: a frame position and a `nanoTime` on CLOCK_MONOTONIC (or BOOTTIME for AudioRecord). For output, the pair is the frame's estimated **presentation** time, so it already includes hardware latency. For input, it is the time at "the earliest point available in the capture pipeline." The CDD only *strongly recommends* ±1 ms accuracy and does not require it. A route that cannot report timestamps fails visibly by returning false or an error, so the caller knows. Undeclared DSP on a route that does report is not visible to the caller.

### Cited Findings
- AudioTrack.getTimestamp javadoc (AOSP main): "Poll for a timestamp on demand." The data at the returned position "may either already have been presented" or "may have not yet been presented but is committed to be presented." — [AOSP AudioTrack.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/media/java/android/media/AudioTrack.java)
- Recommended polling rate: "approximately once every 10 seconds to once per minute," and "Calling this method more often is inefficient." The official docs also say an app that wants a high-resolution frame↔time mapping should build it itself from these sparse timestamps. — [AOSP AudioTrack.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/media/java/android/media/AudioTrack.java); [AudioTrack.GetTimestamp docs mirror](https://learn.microsoft.com/en-us/dotnet/api/android.media.audiotrack.gettimestamp?view=net-android-37.0)
- When it is unavailable: "temporarily unavailable while the audio clock is stabilizing," "during and immediately after a route change," and "permanently unavailable for a given route if the route does not support timestamps." In that case the supplied instance is left unaltered and the call returns false. — [AOSP AudioTrack.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/media/java/android/media/AudioTrack.java)
- Hidden `getTimestampWithStatus` returns ERROR_WOULD_BLOCK when called in STOPPED/FLUSHED state or right after start before enough frames are consumed, ERROR_DEAD_OBJECT when the track must be recreated, and ERROR_INVALID_OPERATION when the route does not support timestamps. — [AOSP AudioTrack.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/media/java/android/media/AudioTrack.java)
- AudioRecord.getTimestamp(AudioTimestamp, int timebase): "The AudioTimestamp reflects the frame delivery information at the earliest point available in the capture pipeline." Timebase is TIMEBASE_BOOTTIME or TIMEBASE_MONOTONIC. It returns SUCCESS or ERROR_INVALID_OPERATION. "Calling startRecording() following a stop() will reset the frame count to 0." The javadoc never says "ADC." — [AOSP AudioRecord.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/media/java/android/media/AudioRecord.java)
- CDD change "require timestamps to be accurate to +/- 1 ms":
  - Adds [SR] (STRONGLY RECOMMENDED) clauses: output timestamps from `AudioTrack.getTimestamp` and `AAudioStream_getTimestamp` should be accurate to ±1 ms, and the error in input timestamps from `AudioRecord.getTimestamp` / `AAudioStream_getTimestamp` should be limited to ±1 ms.
  - Defines a timestamp as a frame position plus "the estimated time when that frame enters or leaves the audio processing pipeline."
  - The commit message admits getTimestamp "has had insufficient testing," and the CTS test was tracked separately (bug 64140129).
  - Source: [AOSP CDD commit f845c6c](https://android.googlesource.com/platform/compatibility/cdd/+/f845c6c%5E%21/)
- Hardware latency is already inside the output timestamp. A 2015 VLC commit: "the latency should not be used when AudioTrack.getTimestamp is used, since it already takes hardware latency into account." — [vlc-commits, Apr 2015](https://mailman.videolan.org/pipermail/vlc-commits/2015-April/030027.html)
- AOSP change in AudioTrack.cpp: AudioTrack used to cache the output latency at creation. It now re-reads `mAfLatency` on every getTimestamp call, because "Unless a device switch leads to a track teardown, AudioTrack will be unaware of the latest latency value." — [AOSP frameworks/av commit (e/OS mirror)](https://gitlab.e.foundation/e/os/android_frameworks_av/-/commit/fb12e20e426bc6bcff06e39fba45a931cf787040)
- Background: a native C++ AudioTrack timestamp API was added in AOSP. — [New AudioTrack C++ API for audio timestamps](https://gerrit.omnirom.org/plugins/gitiles/android_frameworks_av/+/ce70374bf105f8a6160bf5dd70affea012b2a464%5E%21)
- **[anecdote]** A VLC-Android issue reports that enabling the getTimestamp/HW-latency path gave "incorrect delay compensation on internal speakers and garbled audio with Bluetooth." — [VLC-Android issue 1487](https://code.videolan.org/videolan/vlc-android/-/issues/1487)

### Inferences
- Output: `nanoTime` estimates when `framePosition` reaches the "end of the pipeline," i.e. the DAC/HAL boundary as the HAL reports it. Any speaker-protection DSP or amplifier delay after that point counts only if the HAL folds it into its presentation position. The cited docs neither confirm nor rule this out.
- Input: "earliest point available" means the stamp is as early as the HAL can report. If the HAL cannot see past its own DSP (beamforming, noise suppression), the stamp can be late by that DSP's delay, and the API gives no flag for it.
- Both timestamps use CLOCK_MONOTONIC, so playback and capture can be put on one clock without converting. That is the key property for a shared-clock design.
- Because the CDD clause is [SR] only, ±1 ms is a target. A real device can be off by several ms, and bad devices by much more, while still passing CTS. Calibrate per device and per route; do not trust blindly.

### Gaps
- No primary source found with a per-device table of actual getTimestamp error (Samsung, Pixel). Specific Samsung/Pixel getTimestamp bugs were not found in primary sources.
- Whether speaker-protection / smart-amp DSP (common on Samsung/Pixel) is included in reported presentation time is undocumented.

---

## Android: AAudio / Oboe (getTimestamp, MMAP/exclusive, LowLatency, FullDuplexStream, latency calc)

### Takeaway
`AAudioStream_getTimestamp` / Oboe `getTimestamp(CLOCK_MONOTONIC)` give a presentation or capture time for a frame. They are valid only while the stream is started, and they are unimplemented on OpenSL ES (Android ≤ 7). MMAP/exclusive streams give the lowest latency. AOSP had to add a hardware-time offset estimate to make MMAP timestamps accurate. Oboe's `FullDuplexStream` is a helper that runs input reads inside the output callback, so the two streams stay in lockstep. It does not do latency compensation.

### Cited Findings
- AAudio getTimestamp reports the time at which a given frame was presented, for syncing audio with video/MIDI and **aligning recording and playback**. It is valid only when the stream is started and returns ERROR_INVALID_STATE otherwise; because start is asynchronous, that error can appear briefly after starting, so retrying is the expected handling. Position and time both increase monotonically. — [aaudio-sys docs (mirror of NDK header)](https://docs.rs/aaudio-sys/latest/i686-unknown-linux-gnu/fn.AAudioStream_getTimestamp.html)
- Oboe API reference: the timestamp is a best-effort estimate that cannot account for any delay unknown to the implementation. "Due to issues in Android before R, we recommend NOT calling this method from a data callback." — [Oboe reference (AOSP mirror)](https://android.googlesource.com/platform/external/oboe/+/10cd299e/docs/reference/functions.html); [oboe-rs audio_stream.rs](https://docs.rs/crate/oboe/latest/source/src/audio_stream.rs)
- Oboe getTimestamp returns `Result::ErrorUnimplemented` for OpenSL ES streams. The latency readout in HelloOboe shows 0 ms on Android 7 for that reason. — [Oboe FullGuide](https://github.com/google/oboe/blob/main/docs/FullGuide.md); [oboe issue #15](https://github.com/google/oboe/issues/15)
- AOSP commit "aaudio: improve accuracy of timestamps" (older):
  - Early AAudio returned a hard-coded 6 ms placeholder offset, with a TODO to get a more accurate timestamp from the service.
  - The commit accounts for latency added by the AAudio service and adds a hardware timestamp type for frames at the DAC/ADC.
  - For MMAP it adds an estimated HW-vs-MMAP time offset ("This is an estimate of the time difference between the HW and the MMAP time"), with a note that the value should eventually come from the HAL.
  - Sources: [gerrit 97350f9](https://gerrit.omnirom.org/plugins/gitiles/android_frameworks_av/+/97350f9df7252c881f011a410fcd9e6d766d2bee%5E%21); [AAudioServiceStreamMMAP.cpp diff](https://gerrit.omnirom.org/plugins/gitiles/android_frameworks_av/+/97350f9df7252c881f011a410fcd9e6d766d2bee%5E%21/services/oboeservice/AAudioServiceStreamMMAP.cpp)
- Exclusive mode: "SharingMode::Exclusive (available on API 26+)… provide[s] the lowest possible latency by bypassing the mixer stage," but such streams are "more likely to get disconnected" and "Not all audio devices provide exclusive endpoints." `PerformanceMode::LowLatency` "uses smaller buffers and an optimized data path." The lowest latency requires LowLatency plus a high-priority data callback. Oboe's routing section also notes timestamp-related behaviour differs "when the stream is offloaded or it is not on mmap path." — [Oboe FullGuide](https://github.com/google/oboe/blob/main/docs/FullGuide.md)
- FullDuplexStream (Oboe header):
  - It hooks the output data callback and, on each output callback, reads available input and calls `onBothStreamsReady()`.
  - Startup runs in three phases: drain input for 20 callbacks (`kNumCallbacksToDrain`), a cushion (`setNumInputBurstsCushion`, "Typically 0 for latency measurements or 1 for glitch tests"), then discard 30 callbacks (`kNumCallbacksToDiscard`) "so the input and output reach equilibrium." The goal is "a state where the input buffer is empty and the output buffer is full."
  - Recommended setup: open output first, give input twice the output's buffer capacity, match sample rates.
  - Source: [Oboe FullDuplexStream.h](https://github.com/google/oboe/blob/main/include/oboe/FullDuplexStream.h)
- The Oboe FullGuide page I read does not document `calculateLatencyMillis` or `LatencyTuner`. — [Oboe FullGuide](https://github.com/google/oboe/blob/main/docs/FullGuide.md)

### Inferences
- With FullDuplexStream, input and output frame counters advance together, but the frame-to-frame offset is unknown. You still need either timestamps (input nanoTime vs output nanoTime) or an acoustic/loopback calibration to learn the true acoustic round trip.
- Before Android R, avoid calling getTimestamp in the audio callback. Poll from another thread and hand the latest (frame, ns) pair to the callback.
- MMAP timestamps depend on the HAL's own reporting. The "estimate" comment in AOSP suggests a fixed per-device offset error is possible.

### Gaps
- Oboe `LatencyTuner` is not covered in the sources read. From general knowledge it adjusts `bufferSize` to avoid underruns, which changes output latency (not timestamp accuracy), but this is not verified here.
- `calculateLatencyMillis()` documentation was not retrieved.
- No OboeTester published accuracy numbers for getTimestamp were retrieved.

---

## Android: hidden AudioTrack#getLatency, published round-trip figures, FEATURE_AUDIO_PRO

### Takeaway
`getLatency()` is `@hide`, and its own javadoc says "DO NOT UNHIDE… too many problems." Media3 still calls it by reflection as a fallback when timestamps are not advancing. Google publishes threshold flags, not per-device numbers, and states there is "no API to determine audio latency over any path at runtime."

### Cited Findings
- `getLatency()` javadoc: "Returns this track's estimated latency in milliseconds. This includes the latency due to AudioTrack buffer size, AudioMixer (if any) and audio hardware driver." Then: "DO NOT UNHIDE. The existing approach for doing A/V sync has too many problems. We need a better solution." — [AOSP AudioTrack.java](https://raw.githubusercontent.com/aosp-mirror/platform_frameworks_base/main/media/java/android/media/AudioTrack.java)
- `FEATURE_AUDIO_LOW_LATENCY` "indicates a continuous output latency of 45 ms or less." `FEATURE_AUDIO_PRO` "indicates a continuous round-trip latency of 20 ms or less," and the CDD says 20 ms "even though musicians generally require 10 ms." low_latency is a prerequisite for pro. — [NDK Audio latency guide](https://developer.android.com/ndk/guides/audio/audio-latency)
- "There is currently no API to determine audio latency over any path on an Android device at runtime." Rule of thumb: input (and output) latency is about half the round-trip latency over paths without signal processing. Mobile mics and speakers get processing that "introduces latency." Use the `VOICE_RECOGNITION` input preset to remove unwanted processing. Adding OpenSL effect interfaces (EQ, bass boost, virtualizer, reverb) causes the fast-track request to be rejected. — [NDK Audio latency guide](https://developer.android.com/ndk/guides/audio/audio-latency)
- Warmup (cold-start) latency is the time to start the pipeline the first time data is enqueued. Google's mitigation is to enqueue silence beforehand, at a power cost. Typical buffer sizes are 96–512 frames. — [NDK Audio latency guide](https://developer.android.com/ndk/guides/audio/audio-latency)
- Built-in mic↔speaker round trip is hard to measure because of open-air feedback, so measurements often use a headset loopback dongle. — [AOSP latency_measurements (old source.android.com)](https://android.googlesource.com/platform/docs/source.android.com/+/dec78a3/src/devices/audio/latency_measurements.jd)
- The current source.android.com "latency" page has no per-device round-trip table. — [source.android.com latency measurements](https://source.android.com/docs/core/audio/latency/measurements)
- **[vendor, ~2016, dated]** Superpowered:
  - Built-in speaker → built-in mic round trip: 32 ms without its media server, 24 ms with it, on one device; 25 ms vs 19 ms on another.
  - The built-in mic array's noise cancelling / feedback suppression adds "about ~13 ms" vs a headset loopback.
  - Their stated pro target is 10 ms round trip.
  - Sources: [Superpowered latency app](https://superpowered.com/latency); [Superpowered Android media server](https://superpowered.com/superpowered-android-media-server); [Android low latency primer](https://superpowered.com/android-audio-low-latency-primer)
- Google's WALT tool documents hardware-based audio latency measurement (photodiode/microphone with a known reference). — [WALT AudioLatency.md](https://android.googlesource.com/platform/external/walt/+/refs/heads/android13-dev/docs/AudioLatency.md)

### Inferences
- Treat getLatency as a coarse fallback (it covers buffer + mixer + driver, maybe not DSP or BT). Never use it as ground truth.
- Because no runtime API exists for path latency, per-device and per-route calibration (a loopback click test) is the only way to learn the true acoustic round trip. FEATURE_AUDIO_PRO only bounds it at ≤ 20 ms.

### Gaps
- Google's historical Nexus/Pixel round-trip table was not retrieved in this pass. The old .jd pages exist on googlesource but their numbers were not extracted.
- No current (2025–26) independent per-device round-trip database was found. Superpowered's database is the usual source, but no figures were retrievable.

---

## Android: ExoPlayer/Media3 position vs what is heard; sample-locked click via AudioProcessor

### Takeaway
Media3's `AudioTrackPositionTracker` prefers `AudioTrack.getTimestamp`, extrapolated with the system clock, so `getCurrentPosition` approximates what is heard. When timestamps are absent or not advancing, it falls back to playhead position minus reflected `getLatency()`. A custom `AudioProcessor` sees PCM in media order and gets the stream position at each flush, so a click can be mixed in sample-locked to the media timeline.

### Cited Findings
- `AudioTrackPositionTracker.getCurrentPositionUs`:
  - When `audioTimestampPoller.hasAdvancingTimestamp()` is true, position comes from `getTimestampPositionUs()`, which wraps AudioTrack.getTimestamp.
  - Otherwise it falls back to the playback head (smoothed against the system clock) and applies `positionUs = max(0, positionUs - latencyUs)`.
  - The result is capped at frames written.
  - Smoothing limits speed changes to 10% (`MAX_POSITION_SMOOTHING_SPEED_CHANGE_PERCENT`) when drift is under 1 s.
  - The playhead "only has a granularity of ~20 ms," and is smoothed by sampling a playhead offset every 30 ms over the last 10 samples.
  - Source: [Media3 AudioTrackPositionTracker.java](https://raw.githubusercontent.com/androidx/media/release/libraries/exoplayer/src/main/java/androidx/media3/exoplayer/audio/AudioTrackPositionTracker.java)
- Latency via reflection:
  - `getLatency` is looked up with a comment saying "There's no guarantee this method exists," and it is sampled every 500 ms (PCM only).
  - The buffer duration is subtracted, and the result is clamped ≥ 0. A value over 10 s (`MAX_LATENCY_US`) triggers `onInvalidLatency` and is reset to 0.
  - If the call throws: "The method existed, but doesn't work. Don't try again."
  - There is an SDK ≤ 29 workaround for a Bluetooth failure that leaves the playhead stuck at 0 (force reset after 200 ms).
  - Source: [Media3 AudioTrackPositionTracker.java](https://raw.githubusercontent.com/androidx/media/release/libraries/exoplayer/src/main/java/androidx/media3/exoplayer/audio/AudioTrackPositionTracker.java)
- `AudioTimestampPoller`:
  - Polls every 10 ms (`FAST_POLL_INTERVAL_US`) while initializing or confirming, every 10 s once advancing, and every 500 ms in error.
  - Timestamps offset from the system clock by more than 5 s (`MAX_AUDIO_TIMESTAMP_OFFSET_US`) are "deemed spurious" — "a fail safe that should not be required on correctly functioning devices."
  - It waits up to 2 s for an advancing timestamp before declaring an error, and allows a 1 ms max position drift between successive timestamps (`MAX_POSITION_DRIFT_ADVANCING_TIMESTAMP_US = 1000`).
  - Comment: "We haven't received a timestamp for a while, so they probably aren't available for the current audio route," and it resets polling on suspected route change.
  - Source: [Media3 AudioTimestampPoller.java](https://raw.githubusercontent.com/androidx/media/release/libraries/exoplayer/src/main/java/androidx/media3/exoplayer/audio/AudioTimestampPoller.java)
- `AudioProcessor.StreamMetadata.positionOffsetUs` is "The position of the underlying stream in microseconds from which the processor will start receiving input buffers after a call to flush." It is captured at flush and not updated until the next flush. It also exposes `periodUid` and `timeline`. — [Media3 AudioProcessor.StreamMetadata](https://developer.android.com/reference/androidx/media3/common/audio/AudioProcessor.StreamMetadata)

### Inferences
- **Sample-locked click:** in a custom AudioProcessor, record `positionOffsetUs` at flush, then count input frames. The media time of frame n is `positionOffsetUs + n / sampleRate`. Mixing click samples at beat positions computed this way is sample-exact relative to the media, regardless of AudioTrack latency, because the click travels the same pipeline as the music.
  - Caveat: place the processor **before** any speed/pitch processor (Sonic) so frame counts are in media time. A processor after Sonic sees output-time frames.
  - On older Media3 versions without StreamMetadata, the processor only gets `flush()`, and position must be passed in another way.
- Media3's `getCurrentPosition` is "what is heard" only to the accuracy of AudioTrack timestamps (CDD ±1 ms target). On no-timestamp routes, which Media3 says can happen per route, it degrades to playhead minus getLatency (~20 ms granularity smoothed, getLatency of unknown accuracy).
- For grid stamping, prefer a sample-locked in-chain click (zero relative error to the music) over scheduling a separate click player against `getCurrentPosition`.

### Gaps
- The Media3 version that introduced `StreamMetadata`/`positionOffsetUs` was not confirmed (believed 1.6–1.8; unverified).
- Not verified whether DefaultAudioSink's position accounts for the audio-processor chain's own internal delay (e.g. Sonic's lookahead).

---

## Bluetooth on Android (A2DP latency reporting, typical values, LE Audio)

### Takeaway
A2DP latency is typically 100–250+ ms and comes from AVDTP delay reports, to which AOSP adds a fixed offset. Older Android (2015) returned false from getTimestamp on BT. Newer AudioTrack re-reads output latency on each getTimestamp, but BT accuracy is still unreliable. LE Audio is designed for lower latency, but no Android measurements were found.

### Cited Findings
- AOSP Bluetooth audio HAL derives delay from A2DP delay reports and adds a fixed sync offset: "Sync from audio_a2dp_hw to add extra delay kExtraAudioSyncMs(+200ms)." — [AOSP Bluetooth module commit (e/OS mirror)](https://gitlab.e.foundation/e/os/android_packages_modules_bluetooth/-/commit/68f123f93ab0d670f06919825166490044c5e5cc)
- **[older behaviour, 2015]** "AudioTrack.getTimestamp doesn't work with Bluetooth, as it returns false." VLC fell back to `AudioSystem.getOutputLatency()`. — [vlc-commits, Apr 2015](https://mailman.videolan.org/pipermail/vlc-commits/2015-April/030027.html)
- **[anecdote]** The OS reported BT latency of roughly 200–300 ms via AVDTP delay reports. Enabling the timestamp path garbled BT audio in VLC. — [VLC-Android issue 1487](https://code.videolan.org/videolan/vlc-android/-/issues/1487)
- Media3 carries a workaround for SDK ≤ 29 where a BT connection failure leaves the playhead stuck at 0. — [Media3 AudioTrackPositionTracker.java](https://raw.githubusercontent.com/androidx/media/release/libraries/exoplayer/src/main/java/androidx/media3/exoplayer/audio/AudioTrackPositionTracker.java)
- Measured BT latency (headphone review labs): RTINGS measured SBC at 173 ms, aptX at 166 ms and aptX Low Latency at 34 ms; SoundStage measured 34 ms for aptX LL and 248 ms for SBC. Typical summary ranges are SBC 200–250 ms, AAC 120–150 ms, aptX 100–150 ms. — [RTINGS latency](https://www.rtings.com/headphones/learn/latency); [RTINGS SBC vs aptX](https://www.rtings.com/headphones/learn/sbc-aptx-which-bluetooth-codec-is-the-best); [SoundStage Solo](https://www.soundstagesolo.com/index.php/features/185-latency-a-new-concern-for-audiophiles)
- LE Audio (LC3): one secondary source gives a ~30 ms typical maximum codec latency. Others give no single figure. No Android end-to-end measurement was found. — [thewelltemperedcomputer Bluetooth](https://www.thewelltemperedcomputer.com/HW/Bluetooth.htm) (secondary; low confidence)

### Inferences
- A BT headset's latency (150–250 ms) is far larger than any timestamp error. Delay reports are headset-declared and can be wrong, so a BT route needs its own calibration or a "BT: grid may be off" warning.
- The BT mic (HFP/SCO) is a different, lower-quality path with its own latency. Recording usually stays on the built-in mic while playback goes over A2DP, so the round trip is asymmetric.

### Gaps
- No primary Android 10+ doc on "BT latency reporting" APIs was found. Not verified whether getTimestamp on A2DP now consistently includes the delay report on current Android (14–16).
- No measurements of LE Audio round trip on Android phones.

---

## iOS: AVAudioSession latencies, AVAudioTime hostTime, scheduling, tap timestamps, gaps

### Takeaway
iOS gives `inputLatency`, `outputLatency` and `ioBufferDuration` as **estimates**. They are good on the built-in and wired routes and poor on Bluetooth: in one report, AirPods' real latency started ~55 ms above the reported value and drifted for 20–30 min. Everything runs on one host clock (mach_absolute_time / AVAudioTime.hostTime), so stamping output and input on the same clock is natural. The default mic processing adds ~30 ms that the measurement mode removes.

### Cited Findings
- `AVAudioSession.outputLatency`: "The latency for audio output, in seconds." Discussion: "Using an AirPlay-enabled device for your audio content can result in a 2-second delay." — [Apple docs: outputLatency](https://developer.apple.com/documentation/avfaudio/avaudiosession/outputlatency)
- **[anecdote, Apple forums]** Drum-practice developer on an iPhone 12 mini with AirPods 2 and a 64-frame buffer at 48 kHz (1.333 ms):
  - Reported `inputLatency` was 2.438 ms and `outputLatency` 160.667 ms, so input + output + 2×buffer = 165.771 ms.
  - Measured ~215–220 ms right after connecting, falling to ~155–160 ms over 20–30 min. With AirPods already in use it started at ~180 ms.
  - Older devices showed larger discrepancies. Wired and built-in routes were "predictable." No Apple reply.
  - Source: [Apple forums 679274](https://developer.apple.com/forums/thread/679274)
- **[anecdote]** For BT headsets the reported value is much smaller than the real latency and can change by tens of ms within a minute. Suggested workaround: an Audio Queue processing tap, comparing playback timestamps vs frames written. — [Apple forums 126277](https://developer.apple.com/forums/thread/126277)
- **[mailing list, 2020]** On coreaudio-api, inputLatency/outputLatency are described as estimates, least reliable with BT and most reliable without external audio. Contributors debated whether round trip = 4 or 5 buffer durations, depending on whether input latency exceeds the buffer duration. — [coreaudio-api Jan 2020 msg 8](https://lists.apple.com/archives/coreaudio-api/2020/Jan/msg00008.html); [msg 9](https://lists.apple.com/archives/coreaudio-api/2020/Jan/msg00009.html)
- **[vendor]** Superpowered: on iOS the default audio session mode "adds around 30 ms of additional latency due some feedback reduction and other pre-processing." Use the "measurement" mode for minimum built-in-mic round trip. — [Superpowered latency](https://superpowered.com/latency)
- **[anecdote]** It is unsettled whether the AVAudioEngine input-tap `AVAudioTime` marks the buffer start and whether `inputLatency` must be subtracted. The developer's approach was `bufferStart = seconds(forHostTime: ts.hostTime) - inputLatency`. No replies. — [Apple forums 131057](https://developer.apple.com/forums/thread/131057)
- **[anecdote, Stack Overflow]** In AVAudioEngine, `sampleTime` differs between the output and input nodes, so `hostTime` is used to find the offset between them. Examples schedule playback at a host time a fixed interval ahead and ignore tap buffers whose host time precedes the reference start. Node `latency == 0` means "no latency or unknown," and it can change on engine reconfiguration. — [SO: reconcile input/output timestamps](https://dev.library.kiwix.org/content/stackoverflow_en_nopic_2021-08/questions/65600996/avaudioengine-reconcile-sync-input-output-timestamps-on-macos-ios); [objc2-avf-audio AVAudioNode docs](https://docs.rs/crate/objc2-avf-audio/latest/source/src/generated/AVAudioNode.rs)

### Inferences
- Best practice for a sample-accurate click alongside recording on iOS:
  1. Run the click and capture in the same IO cycle: one AVAudioEngine, or a RemoteIO render callback where both input and output `AudioTimeStamp`s carry `mHostTime`.
  2. Generate the click in the render callback or schedule it with `AVAudioPlayerNode.scheduleBuffer(at: AVAudioTime(hostTime:))`.
  3. Convert input host time to "acoustic arrival" by subtracting `inputLatency`, and output host time to "acoustic emission" by adding `outputLatency`.
  4. Then verify once per route with a loopback (play a click, detect it in the mic) to measure the residual.
  The ~30 ms default-mode processing makes `.measurement` mode (or at least avoiding `.voiceChat`/voice processing) important for tight grids.
- Voice-processing I/O (AEC) adds processing delay on input that may not be fully reflected in `inputLatency`. This is undocumented in the sources read.
- On BT, both the reported number and the real latency drift, so a one-time calibration can go stale. Re-calibrate per session or warn.

### Gaps
- Apple's official statement on whether input-tap timestamps already include input latency was not found.
- No primary-source accuracy figures for built-in-speaker `outputLatency` (e.g. smart-amp/speaker-protection DSP) were found.
- WWDC sessions (e.g. "What's new in AVAudioEngine," "Audio latency") were not retrieved.

---

## Is "stamp click output and mic input on one system clock" sound? Residual error?

### Takeaway
Yes. It is the design the APIs are explicitly built for. AAudio documents timestamps as being for "aligning recording and playback," Android timestamps share CLOCK_MONOTONIC, and iOS uses one host clock. The residual error is whatever the platform does not declare: the HAL's timestamp error (CDD target ±1 ms, unenforced), undeclared mic/speaker DSP (Superpowered: ~13 ms Android mic array, ~30 ms iOS default mode), acoustic flight time (~0.3 ms at 10 cm, by physics), and Bluetooth (tens to hundreds of ms, drifting).

### Cited Findings
- AAudio getTimestamp is intended for aligning recording and playback. — [aaudio-sys docs](https://docs.rs/aaudio-sys/latest/i686-unknown-linux-gnu/fn.AAudioStream_getTimestamp.html)
- The CDD defines a timestamp as a frame position plus the estimated time "when that frame enters or leaves the audio processing pipeline," targeting ±1 ms on both sides ([SR]). — [AOSP CDD commit](https://android.googlesource.com/platform/compatibility/cdd/+/f845c6c%5E%21/)
- Oboe: the timestamp "cannot account for any delay unknown to the implementation." — [oboe-rs audio_stream.rs](https://docs.rs/crate/oboe/latest/source/src/audio_stream.rs)
- Signal processing on mobile mic/speaker paths introduces latency. Google recommends `VOICE_RECOGNITION` to reduce input processing. — [NDK audio latency](https://developer.android.com/ndk/guides/audio/audio-latency)
- ~13 ms noise-cancel overhead on Android built-in mic arrays; ~30 ms iOS default-mode pre-processing. — [Superpowered Android media server](https://superpowered.com/superpowered-android-media-server); [Superpowered latency](https://superpowered.com/latency)
- **[anecdote]** BT: the reported-vs-actual gap reached ~55 ms on AirPods and drifted. — [Apple forums 679274](https://developer.apple.com/forums/thread/679274)

### Inferences
- Sound design: compute `clickEmitNs` from the output timestamp, `micFrameNs` from the input timestamp, and map captured frames to the grid via `micFrameNs - clickEmitNs`. Then apply a **measured per-route correction**: play a known click, detect the onset in the recording, and store the median residual per device+route. This catches undeclared DSP. Expected residual after correction is about 1 ms, bounded by onset-detection precision and HAL jitter.
- Without that correction, expect a few ms (good wired/USB paths) to 10–30 ms (built-in mic with processing on) of systematic offset. Bluetooth is not trustworthy without per-session calibration.
- Acoustic path: sound travels ~343 m/s, so ~0.3 ms per 10 cm (physics, not from a cited source). It is negligible for phone speaker→mic but relevant for an instrument several metres from the phone.
- An in-pipeline click (Media3 AudioProcessor, or the iOS render callback) eliminates click-vs-music error entirely. Only the mic side then needs mapping.

### Gaps
- No peer-reviewed or vendor dataset quantifying the residual error of timestamp-only alignment across many devices was found.

---

## Haptic and visual timing (aligning with the audible click)

### Takeaway
Neither platform gives a "this vibration started at time T" timestamp. Haptics are fire-and-hope, with tens of ms of actuator and driver latency. iOS Core Haptics is the only API that schedules haptics at an absolute engine time, and it can play audio and haptics in one pattern. Android can couple haptics to audio through haptic channels or HapticGenerator (API 31+) on supported devices; this is the only way to get audio-locked haptics there. For visuals, `CADisplayLink.targetTimestamp` and Choreographer's expected presentation time let you schedule a pulse against predicted display time on the same monotonic/host clock as audio.

### Cited Findings — Android haptics
- Design guidance:
  - A keyclick should last 10–20 ms, but "the actuator may continue to ring for another 20 to 50 milliseconds after a 20-millisecond input… Therefore, it's best to avoid single-shot vibrations for this type of feedback."
  - Prefer `HapticFeedbackConstants` and `VibrationEffect` predefined effects / `Composition` primitives "more likely to give a consistent quality experience across devices."
  - Rich haptics need wide-bandwidth actuators, so plan a fallback: "Given the choice of buzzy haptics or no haptics… choose no haptics."
  - Source: [Android haptics principles](https://developer.android.com/develop/ui/views/haptics/haptics-principles)
- AOSP hardware assessment: `EFFECT_CLICK` is the baseline, mapped to `KEYBOARD_PRESS`. `createOneShot(20,255)` is the short-impulse test, with a recommended max single impulse of 20 ms (longer is "perceived as a buzzy vibration"). Amplitude waveforms require `Vibrator.hasAmplitudeControl()`. No latency requirement is given. — [source.android.com haptics hardware](https://source.android.com/docs/core/interaction/haptics/hardware)
- Android 16 (API 36) adds `VibratorFrequencyProfile` for frequency mapping. — [Analyze vibration waveforms](https://developer.android.com/develop/ui/views/haptics/actuators?authuser=8)
- HapticGenerator: "an audio post-processor which generates haptic data based on the audio channels." It is created only on devices supporting audio-coupled-haptic playback (`isAvailable()`) and requires the VIBRATE permission. Usage: `AudioAttributes.Builder().setHapticChannelsMuted(false)` plus attach to the player's audio session. API 31. — [HapticGenerator reference](https://developer.android.com/reference/android/media/audiofx/HapticGenerator)
- AOSP added `VibratorPerfTest`, measuring vibrator start/stop latency via the state listener and trace markers. It is a benchmark, with no published numbers. — [AOSP frameworks_base commit (e/OS mirror)](https://gitlab.e.foundation/e/os/android_frameworks_base/-/commit/0fe9157d1d0e0deced8a27337dc76b2b9f834876)
- ERM spin-up is ~50–100 ms, and the LRA has a slightly better start-up time (TI app note, 2012, dated). — [TI app note](https://edgeworker.ti.com/cn/lit/pdf/zhct181)
- **[low confidence, unsourced blog]** It claims Pixel 6 haptic latency of 12–25 ms and Galaxy S21 of 15–35 ms, and states a ~20 ms audio–tactile perceptual window. — [omr.it.com blog](https://omr.it.com/blog/haptic-feedback-timing-audio-tactile-synchronization/)
- **[anecdote]** A Unity bug: `Handheld.Vibrate()` blocks the calling thread 15–20 ms on a Galaxy Note 4. This is API-call duration, not actuator onset. — [Unity issue tracker](https://issuetracker.unity3d.com/issues/handheld-dot-vibrate-takes-15-20-ms-to-complete-on-android-device)
- A research paper treats ~45 ms as the human-perceivable threshold for vibrotactile latency (not Android-specific). — [VibraForge, arXiv 2409.17420](https://arxiv.org/pdf/2409.17420)

### Cited Findings — iOS haptics
- `UIFeedbackGenerator.prepare()`:
  - The generator enters a prepared state "for a short period of time" in which feedback has "lower latency." "The system needs time to prepare the Taptic Engine," and calling prepare() immediately before triggering "does not improve latency."
  - The engine idles after triggering, after "typically seconds," or on deallocation.
  - Repeated prepare() calls without triggering may eventually be ignored.
  - Source: [Apple docs: prepare()](https://developer.apple.com/documentation/uikit/uifeedbackgenerator/prepare())
- CHHapticEngine:
  - `currentTime` is "The absolute time, in seconds, to use for scheduling haptic and audio events."
  - `playsHapticsOnly` makes the engine ignore audio events; `playsAudioOnly` is the reverse.
  - `init(audioSession:)` creates an engine tied to an audio session.
  - `isAutoShutdownEnabled` makes the engine start/stop on demand, which adds start-up delay.
  - Source: [Apple docs: CHHapticEngine](https://developer.apple.com/documentation/corehaptics/chhapticengine)
- `CHHapticPatternPlayer.start(atTime:)`: "If time is 0 or any value less than the haptic engine's currentTime, the pattern starts playing immediately." — [Apple docs: start(atTime:)](https://developer.apple.com/documentation/corehaptics/chhapticpatternplayer/start(attime:))
- **[secondary, third-party guides]** One guide says prepared generators stay ready ~1 s, and that unprepared generators may lag ~10–20 ms. Examples schedule audio and haptics against a shared `CACurrentMediaTime()` offset. — [axiom haptics guide](https://lobehub.com/skills/charleswiltgen-axiom-axiom-haptics)

### Cited Findings — visual
- `CADisplayLink.targetTimestamp`: "The time interval that represents when the next frame displays." It is on the `CACurrentMediaTime()` clock (host time), per Apple's example. — [Apple docs: targetTimestamp](https://developer.apple.com/documentation/quartzcore/cadisplaylink/targettimestamp)
- Android NDK Choreographer:
  - The frame callback gets a CLOCK_MONOTONIC frame time. The docs advise against using it to drive animation and point to the per-frame **expected presentation time**, the time the frame should appear on screen.
  - From API 33, apps can choose among future frame timelines.
  - Source: [NDK Choreographer reference](https://developer.android.com/ndk/reference/group/choreographer)

### Inferences
- **Visual pulse:** each display-link/Choreographer tick, compute which beat's acoustic emission time (`clickEmitNs`, from audio timestamps) falls nearest the frame's expected presentation time, and light the pulse on that frame. The error is then about ±½ frame (±8 ms at 60 Hz, ±4 ms at 120 Hz) plus undeclared panel latency.
  - This works because both clocks are monotonic/host time: Android's Choreographer and AudioTimestamp both use CLOCK_MONOTONIC; iOS's CACurrentMediaTime and AVAudioTime.hostTime are both mach host time.
  - This is better than firing the visual from the audio callback, which leads the sound by the full output latency.
- **iOS haptic:** use Core Haptics and schedule each tick with `start(atTime: engine.currentTime + (clickEmitHost - now))`, keeping the engine running (disable auto-shutdown) during playback. Alternatively, put the haptic events in the same `CHHapticPattern` as an audio click. Remaining error is the Taptic Engine's own undeclared actuation delay; no Apple figure was found.
- **Android haptic:** there is no scheduling API, so the app must fire `vibrate()` early by an assumed actuator latency (tens of ms; ERM much worse than LRA) from a timer on the monotonic clock. Error stays roughly ±10–20 ms or worse and varies by device. On devices where `HapticGenerator.isAvailable()` or haptic channels exist, routing the click's haptic through the audio stream is the only audio-locked option.
- Perceptual budget: the cited ~20 ms window and ~45 ms threshold suggest haptics within ~20 ms of the audible click feel simultaneous. Android timer-fired haptics are at the edge of that.

### Gaps
- No Apple-published Taptic Engine latency figure, and no measured latency for `CHHapticEngine` scheduled starts, was found.
- Not confirmed whether `CHHapticEngine.currentTime` equals `CACurrentMediaTime()` or is merely on a comparable clock. The docs do not say.
- No primary per-device Android vibration onset latency data. No docs found on which devices expose audio-coupled haptic channels (Pixel 6+ is believed to; unverified).
- `VibrationEffect.Composition` primitive latency (PRIMITIVE_CLICK/TICK) vs `createOneShot` is undocumented in the sources read. The API level (29 vs 31) for `setHapticChannelsMuted` was not confirmed.
- Display panel latency (scan-out to photons) beyond the predicted presentation time was not quantified.
