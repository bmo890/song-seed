# Play-along click over recorded audio: architecture and perceptual timing thresholds

Scope: (a) how apps keep a metronome click locked to playback of recorded audio (one clock vs two players), including speed/pitch change, seek, loop, and how DAWs place a recorded take against the grid; (b) what timing errors musicians can hear or feel, so SongNook can set measurable accuracy targets. Research done 2026-10-30. Several primary PDFs (PMC, Springer, Ableton help, Moises help) were blocked (403, captcha, or binary PDF), so some numbers come from abstracts or from secondary summaries. Each one is marked.

Legend: **[R]** = peer-reviewed research or the paper's own abstract. **[DOC]** = vendor manual or official blog. **[DEV]** = developer forum or mailing list (informed anecdote). **[USER]** = user forum or review (anecdote).

---

## Q1. Architecture: one stream/mixer (sample-locked) vs two separate players that resync

### Takeaway
Every serious source points the same way. Render the click and the playback in one engine on one sample clock: the same mixer or render callback, with click positions computed from the playback's own sample or source-time position. Two independent players drift, start at different offsets, and hide different output latencies. Developers report errors on the order of 100 ms when they try to sync separate players by copying timestamps.

### Cited Findings
- **[DEV]** An Apple Core Audio mailing-list user tried to sync two `AUScheduledSoundPlayer` instances by reading one's timestamp and copying it to the other. The two players were "out of sync usually by around 1/10 second." — [coreaudio-api 2008](https://lists.apple.com/archives/coreaudio-api/2008/Oct/msg00065.html)
- **[DEV]** Separate digital clocks cannot stay sample-accurate: "It is impossible for two or more digital sample clocks to remain sample accurate over a long period of time." Crystals never exactly match, so long-running sync drifts without a shared clock. This applies to separate devices and clock domains, not to two nodes inside one engine. — [coreaudio-api 2017](https://lists.apple.com/archives/coreaudio-api/2017/Aug/msg00016.html)
- **[DEV]** In AVAudioEngine, players in the *same* running engine can be started together. Each node's `lastRenderTime` is a common reference, and every `AVAudioPlayerNode` gets `play(at:)` with the same future `AVAudioTime`. Schedule buffers and `prepare` in advance, and round to integer frames for exact alignment. One commenter says the start time must be based on host time, not sample time, or "things will be out of sync." — [Apple Dev Forums thread 14138](https://developer.apple.com/forums/thread/14138)
- **[DEV]** Mixing an `AVAudioPlayer` (separate player) with `AVAudioEngine` is a recurring sync problem in its own forum thread. — [Apple Dev Forums 68611](https://developer.apple.com/forums/thread/68611)
- **[DEV]** Alternative suggested: feed both sources into one mixer unit. "The pull architecture of the iOS audio system will play your two audio buffers simultaneously." — [kiwix mirror of SO 35912061](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/35912061/avaudioengine-starting-a-set-of-avaudioplayernodes-at-once)
- **[DEV]** AUM (iOS host, by the same team as Loopy Pro): its clock is based on Ableton Link, which "uses the hostTime instead of sampleTime, and these are not entirely in sync on some devices in some sample rates." The developer said AUM 1.4.0 would use a *sample-precise* clock when Link is disabled. A user notes "a sample accurate beat time can only be achieved when there is no external clock source (including Link)." — [Loopy Pro forum, comment 205299](https://forum.loopypro.com/discussion/comment/205299); [Loopy Pro forum, "latency when recording with abletonlink"](https://forum.loopypro.com/discussion/19610/latency-when-recording-with-abletonlink)
- **[DEV]** AUM adjusts the timestamp it hands hosted nodes to include its own added latency, so Link-based apps can compensate. Hosts treat output latency as something to fold into the beat-time math, not something to ignore. — [Loopy Pro forum, "aum xequence and buffer compensation"](https://forum.loopypro.com/discussion/40367/aum-xequence-and-buffer-compensation)
- **[USER]** Even between hosts on one device, users need manual Link offsets: "-16.1" ms to get the AUM and Ableton Live metronomes "at the exact same time." Loopy Pro had no Link offset setting, and the developers reportedly would look into one (Dec 2025). This shows a residual ~16 ms is noticeable and worth fixing to users of these tools. — [Loopy Pro forum comment 1444314](https://forum.loopypro.com/discussion/comment/1444314/)
- **[DEV]** Old (2016) developer comment on sync priority: Inter-App Audio sync wins "since it is sample accurate and has timeline transport," then Link, then MIDI clock. — [Loopy Pro forum comment 752789](https://forum.loopypro.com/discussion/comment/752789/)
- **[DOC/DEV]** Android: SoundPool (short sounds, lowest latency on most devices, preloaded in the audio process) and MediaPlayer (long music) are separate paths. libGDX warns the default setup is "not recommended for latency sensitive apps." Oboe/AAudio with `PERFORMANCE_MODE_LOW_LATENCY` is the recommended low-latency native path. The sources don't measure SoundPool vs MediaPlayer/ExoPlayer latency differences. — [Ackee: Android high-performance audio APIs](https://www.ackee.cz/blog/en/android-high-performance-audio-apis/); [libGDX audio wiki](https://libgdx.com/wiki/audio/audio)
- **[USER]** Symptoms reported when click and audio are not one clock: in MobileSheets, "after a while audio and visual metronomes are out of sync, usually audio is one or two beats behind," and drift appeared after a volume change and cleared on stop/start. In Beat Note, audio fell behind the visual playhead when looping single measures (reportedly fixed in v3.4.9, June 2024). In Cubasis, "metronome and tracks don't line up after recording with the metronome on." — [MobileSheets forum 4363](https://www.zubersoft.com/mobilesheets/forum/thread-4363.html); [Beat Note Canny](https://beat-note.canny.io/bugs/p/the-playback-note-highlight-bar-really-lags); [Steinberg forum, Cubasis](https://forums.steinberg.net/t/cubasis-metronome-not-syncing/661207)
- **[DOC]** Moises has a help article titled "The Metronome is out of sync." Per the search snippet, its troubleshooting is to update the OS and *re-download the metronome track*. That suggests Moises delivers its click as a server-generated audio track (a stem-like file), played alongside the song, rather than synthesizing it live. The page returned 403, so this is unconfirmed. — [Moises help](https://help.moises.ai/hc/en-us/articles/360017718460-The-Metronome-is-out-of-sync)
- **[DOC]** Moises markets a "Smart Metronome" that will "automatically sync its clicks to any studio or live recording," with speed change "without compromising the pitch." — [Moises feature page](https://moises.ai/features/metronome-audio-speed-changer)

### Inferences
- The robust pattern is one engine and one clock: click events scheduled as sample offsets inside the same render callback, or the same `AVAudioEngine`/Oboe stream, that produces the music. Sources only *start-align* separate players inside one engine; independent players (AVAudioPlayer + engine, SoundPool + ExoPlayer, two expo-audio players) have no shared clock, so there is nothing to keep them aligned after start.
- The ~100 ms failure in the 2008 Core Audio report is far above every perceptual threshold in Q4. A two-player design in which each player is "resynced" can be audibly wrong by default, not marginally wrong.
- Output latency differs per path (SoundPool's low-latency path vs a MediaPlayer/ExoPlayer deep-buffer path on Android). That is a *constant* start offset even when both start "at once." No source quantified it.
- If Moises does ship the click as a pre-rendered track, it is a second way to get "one clock": bake the click into audio once, then mix it as a stem. It stays locked under time-stretch because the stretcher processes both identically, or because both are stretched by the same engine.

### Gaps
- No official documentation was found for GarageBand iOS, Logic, BandLab, Anytune, Amazing Slow Downer or Loopy Pro on how the click is rendered. Treating "DAWs render the metronome in the engine" as universal is an inference from DAW architecture, not a cited fact.
- No measured numbers were found for drift rate (ppm) between two Android players, or for the start-offset spread between SoundPool and ExoPlayer/MediaPlayer.
- JUCE, KVR and Superpowered threads specifically on "click over playback with two players" did not surface in searches.

---

## Q2. Keeping the click aligned under speed/pitch change, seek, and loop

### Takeaway
Practice tools define beats in *source (file) time*: markers or a beat map on the recording. The click fires when playback passes a beat position. Under time-stretch, the click therefore follows the stretched audio automatically, and seek and loop are just jumps in source position. DAWs do the same with a tempo map that rescales the grid. No source describes deriving the click from a free-running wall-clock tempo.

### Cited Findings
- **[DOC]** Transcribe! (Seventh String), v8.73: "You can now add metronome clicks to markers. If this is turned on then every time playback passes a marker you get a tasteful click sound." Speed is variable from 1/20 to 2×, pitch independent of speed, and pressing half-speed while playing continues without interruption. A *marker placement latency* preference shifts newly placed markers earlier: "This is particularly important if you are using metronome clicks." The app compensates for human tap latency when beats are tapped in. — [Transcribe! version history 8.73](https://seventhstring.com/xscribe/history/history873.html); [Transcribe! overview](https://seventhstring.com/xscribe/overview.html); [Transcribe! FAQ](https://seventhstring.com/xscribe/faq3.html)
- **[DOC]** Transcribe! loops are a selected waveform region played with Loop on (A-B toolbar), stored as named loops. Loops are separate from markers. — [Transcribe! FAQ](https://www.seventhstring.com/xscribe/faq3.html?a=33)
- **[DOC]** Ardour (DAW): changing tempo or time signature rescales the grid, while absolute grids (Timecode) are unaffected. The grid is a tempo map over the timeline. — [Ardour manual commit](https://git.ardour.org/ardour/manual/commit/14244c9760419a00538554680ef7f7b5674f5451)
- **[USER]** Failure reports are clustered around loops and tempo-following. In Beat Note, audio fell behind the visual playhead with "loop each measure." A MakeMusic user said the metronome "does a terrible job at following the recording in tempo-following mode." — [Beat Note Canny](https://beat-note.canny.io/bugs/p/the-playback-note-highlight-bar-really-lags); [MakeMusic community](https://help.makemusic.com/hc/en-us/community/posts/360051746313-Tempo-fluctuation)

### Inferences
- Correct model for SongNook: each click is a beat at source-time `t_src`. The engine knows the mapping source→output sample (the stretch ratio, plus the time-stretcher's own processing delay). It emits the click at the output sample where `t_src` comes out. Speed changes then never accumulate error, and seek and loop only need to recompute the next beat index from the new source position.
- Time-stretchers (Sonic, Rubber Band, etc.) add algorithmic latency/lookahead. If the click bypasses the stretcher but the music goes through it, the click leads by that delay unless the delay is compensated. This is a plausible source of a constant offset; no source quantified it for specific libraries.
- Loop wrap is the classic place for a dropped or doubled click (beat at exactly the loop end/start). The user reports above cluster there, so it deserves an explicit test.

### Gaps
- No documentation for Anytune, Amazing Slow Downer or GarageBand on click behaviour under speed change. Searches returned nothing specific.
- No figures for the processing latency of common mobile time-stretch libraries.

---

## Q3. DAW convention: move the recorded audio by measured latency, or move the grid?

### Takeaway
The consensus convention across Logic, Ableton and Reaper is to **move the audio, keep the grid**. The DAW shifts a newly recorded take earlier by the reported or measured round-trip latency, so that what the performer played against the click lands on the scheduled grid times. Driver-reported latency is often wrong, so each DAW offers a manual correction measured by loopback ("ping") test.

### Cited Findings
- **[DOC/USER]** Logic Pro, "Recording Delay" (Preferences > Audio): "Delays the recording of audio by a certain fixed value," in samples. Users measure the offset with the I/O plug-in's ping and enter it as a *negative* value. One user with a ~50 ms offset set −2500 samples at 48 kHz (~52 ms), and afterwards "everything lined up with metronome." — [r/LogicPro (mirror)](https://lr.sudovanilla.org/r/LogicPro/comments/1g29mqj/what_does_135_samples_mean_and_how_did_this); [Fractal Audio forum](https://forum.fractalaudio.com/threads/logic-pro-recording-delay-setting.157412/page-2); [Apple Logic help](https://help.apple.com/logicpro/mac/10.4/en.lproj/lgcpe11997ba.html)
- **[DOC]** Logic: plug-in delay compensation is separate. "Logic Pro compensates for latency introduced by plug-ins, ensuring that audio routed through them is synchronized with all other audio." It works by shifting tracks earlier. During recording through latent plug-ins, Apple advises switching compensation from All to "Audio and Software Instrument Tracks." — [Logic Pro 9 manual, plug-in latency compensation](https://help.apple.com/logicpro/mac/9.1.6/en/logicpro/usermanual/chapter_41_section_3.html)
- **[DOC]** Ableton Live, "Driver Error Compensation" (Preferences → Audio): the interface reports a latency that Live uses to offset recorded audio and MIDI when the track's monitor is "Off." Some drivers report it incorrectly, and DEC corrects the error, with a guided Help View lesson to measure it. (Quoted from the search summary of Ableton's FAQ; direct fetch returned 403.) — [Ableton Driver Error Compensation FAQ](https://help.ableton.com/hc/en-us/articles/115000234830)
- **[USER]** Ableton forum reports that DEC is fiddly: the value shifts when the audio engine reloads, and it needs resetting (10.0.2). — [Ableton forum 1742695](https://forum.ableton.com/viewtopic.php?p=1742695)
- **[DOC]** Reaper: "REAPER relies on the driver's latency figure to shift the take back into time." Recording-latency offset is a preference. The loopback method is a cable from output to input plus ReaInsert "ping detect" to measure samples; you add the result to the input offset and re-ping to confirm zero extra latency. The manual offset applies only to signals from hardware inputs. — [reaper.blog: rec latency offset](https://reaper.blog/2018/11/rec_latency_offset/)
- **[USER]** Loopback measurements can be off by a few samples. Reaper compensated 201 samples where 210 was correct. Network audio (Dante) adds round-trip latency that ASIO does not report. — [RME forum 33861](https://forum.rme-audio.de/viewtopic.php?id=33861); [Tascam forum](https://www.tascamforums.com/threads/someone-using-reaper-6-with-the-dm3200.7335/page-2)

### Inferences
- "Correct" in the DAW world means the grid stays at the *scheduled* click times, and the recorded audio is moved earlier by (output latency + input latency) so that a performer perfectly in time with what they *heard* lands on the grid. Moving the grid instead would put recorded takes and the click on different timelines and break every other track.
- DAWs trust a reported latency plus a user-measured correction. A mobile app can't ask users to run cable loopbacks, so automated measurement is the mobile analogue: acoustic self-align, or a measured offset after save. The convention still applies, though: correct the audio, don't move the grid.
- The residual error after DAW compensation (a few samples) is the benchmark of "professional." A take within ~1 ms of the grid after compensation matches desktop practice.

### Gaps
- Cubase's equivalent ("Adjust for Record Latency" / record shift) was not retrieved.
- No official Apple text was retrieved stating the sign convention beyond user reports. The negative-value convention is consistent across multiple user sources.

---

## Q4. Perception: what timing offsets can musicians hear or feel?

### Takeaway
Hearing two onsets as non-simultaneous starts at roughly **15–30 ms**, depending on attack sharpness: about 20 ms for pure tones, about 30 ms for piano tones, and 15–20 ms for temporal order in trained listeners. A *displaced beat in a steady click train* is detectable at about **6 ms** (or 2.5% of the interval for slower beats). For playing live through a system, **≤10 ms latency with ≤1 ms jitter** is the long-standing target. Jitter is worse than steady latency: 10 ± 3 ms degraded the performance experience as much as a fixed 20 ms. Tapping research says humans lead the beat by tens of ms and vary by similar amounts, so app error far below that is swamped by the player's own noise. Steady offsets between the click and recorded audio are still heard as "flam" once they reach ~15–20 ms.

### Cited Findings

**Asynchrony / flam detection (two onsets)**
- **[R, secondary]** In a review of asynchrony perception, the asynchrony threshold was "around 20 ms for pure tones and around 30 ms for real piano tones," regardless of whether the higher or lower tone led. Temporal order of two tones for "highly trained listeners" is "between 15 and 20 ms," mostly independent of frequency. Detection is better when the low-frequency tone leads. (Numbers from a search snippet of a 2019 PLOS ONE paper on asynchrony, PMC6561579 = journal.pone.0218162; full text blocked by captcha and binary PDF, so the original studies cited inside, e.g. Hirsh 1959 and piano-tone studies, could not be verified.) — [PMC6561579](https://pmc.ncbi.nlm.nih.gov/articles/PMC6561579); [White Rose eprint](https://eprints.whiterose.ac.uk/148848/1/journal.pone.0218162.pdf)
- **[R]** Aiba et al. (2011): professional musicians judged synchrony significantly more accurately than non-musicians. A follow-up hypothesizes pianists are better still. Numeric thresholds were not retrieved. — [Aiba 2011 JACIII](https://ist.ksc.kwansei.ac.jp/~nagata/data/Aiba_2011_JACIII.pdf); [Aiba ISPS 2013](https://ist.ksc.kwansei.ac.jp/~nagata/data/Aiba_isps2013.pdf)
- **[R, secondary]** Ensembles playing "simultaneous" notes naturally produce onset asynchronies of about 36 ms, which help listeners separate instruments rather than counting as mistakes. (Snippet from the same results set; the original study, likely Rasch, was not verified.) — [PMC6561579](https://pmc.ncbi.nlm.nih.gov/articles/PMC6561579)

**Timing displacement within a beat sequence**
- **[R]** Friberg & Sundberg (1995), *JASA* 98(5):2524–2531, "Time discrimination in a monotonic, isochronous sequence." Thirty listeners adjusted the 4th of 6 tones until the sequence sounded perfectly isochronous. JND was about **6 ms constant for inter-onset intervals < ~240 ms**, and about **2.5% of the IOI** above that. Musical training did not affect the values. (A secondary summary says "10 ms," which conflicts with the abstract; use 6 ms.) — [Friberg & Sundberg 1995 (typeset)](https://typeset.io/pdf/time-discrimination-in-a-monotonic-isochronous-sequence-ynslrz5yhj.pdf); [ASA 1993 abstract](https://auditory.org/asamtgs/asa93dnv/4pPP/4pPP2.html)
  - Applied: at 120 BPM quarters (IOI 500 ms), 2.5% ≈ **12.5 ms**. At 60 BPM (1000 ms), ≈ 25 ms. Eighth notes at 120 BPM (250 ms) are at the boundary, ≈ 6 ms. These are my arithmetic on the cited rule.

**Latency tolerance when playing live (monitoring / instrument response)**
- **[R]** Lester & Boley (2007), "The Effects of Latency on Live Sound Monitoring," AES 123rd Convention, paper 7198 (Purdue/Shure). Acceptable latency ranged "from 42 ms to possibly less than 1.4 ms under certain conditions," and varied by instrument. More latency is acceptable with wedge monitors than with in-ear monitors. (Abstract level only. 1.4 ms is a "possibly" best-case bound, not typical.) — [AES e-library 14256](https://aes2.org/publications/elibrary-page/?id=14256)
- **[R]** Wessel & Wright (NIME 2001 / CMJ 2002): "We place the acceptable upper bound on the computer's audible reaction to gesture at 10 milliseconds," with latency variation (jitter) not exceeding ~1 ms. Wright et al. 2004 restate "10 ms with 1 ms of jitter is a good goal," framed as experience. — [Wessel & Wright, arXiv 2010.01570](https://arxiv.org/pdf/2010.01570); [NIME 2001](https://nime.org/proc/nime2001_wessel/); [CNMAT 2004 latency measurements](https://www.cnmat.berkeley.edu/sites/default/files/attachments/2004_audio-and-gesture-latency-measurements-on-linux-and-osx.pdf)
- **[R]** Jack et al. (2016, Audio Mostly; journal 2018): with percussive instruments, 10 ms latency was acceptable to performers *without jitter*. **20 ms, or 10 ± 3 ms jitter, significantly degraded** the experience of performance. — [Jack et al. 2016 (Instruments Lab)](https://instrumentslab.org/data/andrew/jack_am2016.pdf)
- **[R, secondary]** Mäki-Patola & Hämäläinen (ICMC/DAFx 2004), Theremin without tactile feedback: they cite a JND for latency of a continuous gesture-controlled instrument of about 30 ms, from prior work. They tested 0/30/60/120/240 ms with 11–16 subjects. Another source notes that professional pianists may notice latency under 10 ms. — [DAFx 2004 P_011](https://dafx.de/paper-archive/2004/P_011.PDF); [ICMC 2004 paper](https://users.aalto.fi/~hamalap5/publications/icmcarticlefinal10.pdf); [CEUR-WS vol 2348 paper03](https://ceur-ws.org/Vol-2348/paper03.pdf)

**Sensorimotor synchronization (tapping along)**
- **[R]** Repp (2005), "Sensorimotor synchronization: A review of the tapping literature," *Psychonomic Bulletin & Review* 12:969–992. Updated by Repp & Su (2013), *PB&R* 20:403–452. Mean asynchrony is typically negative (NMA): taps precede the beat by "tens of milliseconds." Variability is measured as SD of asynchronies. — [Repp & Su 2013 (Springer)](https://link.springer.com/article/10.3758/s13423-012-0371-2); [Haskins reprint](https://haskinslabs.org/sites/default/files/files/Reprints/HL1496.pdf)
- **[R]** One figure in a later paper shows NMA of about 20 ms for a 500 ms isochronous sequence (single-subject example, not a group mean). A 2018 analysis of 24 datasets found that less negative asynchrony goes with lower tapping variability. — [Psychological Research 2018 (s00426-018-1043-2)](https://link.springer.com/10.1007/s00426-018-1043-2)
- **[R]** NMA is *smaller in musicians* than nonmusicians (Aschersleben 2002; Scheurich et al. 2018, as cited). However, Repp (2010b, *Human Movement Science* 29:200–213) found *no difference* in SD of asynchronies between musical amateurs and nonmusicians at 500 ms IOI. Musicians adapted faster to tempo changes. — [Western Sydney / Repp 2010 summary results](https://researchers.westernsydney.edu.au/en/publications/sensorimotor-synchronization-with-adaptively-timed-sequences/); [JYU London 2019](https://jyx.jyu.fi/bitstream/123456789/66341/1/london2019tappingdoesnthelpsynchronizeds.pdf)
- **[R]** Repp (2001, *JEP:HPP* 27:600–621) studied phase correction after *subliminal* timing perturbations. Tappers correct for shifts they don't consciously hear, so small click errors still pull the player's timing. — [informahealthcare reference list](https://informahealthcare.com/doi/ref/10.1080/00222895.2011.561377)

### Inferences (proposed measurable targets for SongNook)
- **Click vs playback (both from the app, heard together).** The listener hears two simultaneous onsets, so the asynchrony/flam thresholds apply: ~20 ms for pure-ish clicks, lower (15 ms) for trained listeners and sharp attacks. A click is a maximally sharp attack, so the conservative end applies. **Target: ≤ 5 ms constant offset, ≤ 1 ms jitter, 0 drift over a whole playback (including loops and speed changes).** This keeps a 3× margin under the ~15 ms flam bound, and it beats the Friberg–Sundberg 6 ms displacement JND, so individual beats never sound "pushed."
- **Recorded take vs grid (after latency compensation).** The DAW benchmark is a few samples. Repp's tapping data say the performer's own asynchrony is tens of ms with similar SD, so grid error of a few ms is below the player's noise. **Target: ≤ 2–3 ms mean residual, measured by loopback/acoustic test.** Anything ≥ 10 ms is at the edge of audible flam when the take is replayed against the click, and ≥ 20 ms will be heard by most musicians.
- **Jitter matters more than offset.** Jack et al. show 10 ± 3 ms jitter is as bad as 20 ms fixed. A constant offset can be calibrated away; variable offset can't. Measure SD of click-onset error across a long session, not only the mean.
- **Visual metronome flash.** Not covered by these sources. Audio-visual simultaneity windows are much wider, so audio-audio is the binding constraint.

### Gaps
- Exact per-instrument Lester & Boley thresholds (e.g. vocalists on in-ears) were not retrieved; abstract only.
- No retrieved primary text for the exact SD of tapping asynchronies (commonly cited 10–20 ms for trained tappers). Repp's tables were paywalled. Marked as a gap rather than stated.
- No study found that measured detection of a *click vs recorded-instrument* offset specifically. The two-tone asynchrony studies are the nearest proxy, and attack sharpness of the recorded instrument (strum vs vocal) will move the threshold. The "pure 20 / piano 30 ms" contrast suggests softer attacks hide more offset.

---

## Q5. Evidence that timing errors affect trust/reviews

### Takeaway
Plenty of anecdotal evidence (support forums, bug trackers, help articles) shows that click-vs-audio desync is a recognised failure that users notice and report: drift over time, lag at loop points, misalignment after recording, and drift after settings changes. No quantitative study links timing error to ratings or churn.

### Cited Findings
- **[DOC]** Moises maintains a dedicated help article, "The Metronome is out of sync." A vendor treats it as a recurring support topic. — [Moises help](https://help.moises.ai/hc/en-us/articles/360017718460-Metronome-is-out-of-sync)
- **[USER]** MobileSheets: the audio metronome falls "one or two beats behind" over time, and drift after a volume change is cured by stop/start. A counter-report says one user found it stable for 5 minutes at 120 BPM. — [MobileSheets thread 4363](https://www.zubersoft.com/mobilesheets/forum/thread-4363.html); [MobileSheets thread 8182](https://www.zubersoft.com/mobilesheets/forum/thread-8182-page-2.html)
- **[USER]** Beat Note: audio lags the playhead when looping measures. The user verified "the visualization play head is spot-on... but the audio is falling behind." Fixed in a June 2024 release. — [Beat Note Canny](https://beat-note.canny.io/bugs/p/the-playback-note-highlight-bar-really-lags)
- **[USER]** Cubasis: metronome and recorded tracks "don't line up after recording with the metronome on." — [Steinberg forum](https://forums.steinberg.net/t/cubasis-metronome-not-syncing/661207)
- **[USER, weak]** An AI-generated review aggregate for TonalEnergy says users report "inconsistent metronome timing and speed fluctuations." This is a secondary/generated summary, so treat it as a weak signal. — [marlvel.ai TonalEnergy reviews](https://marlvel.ai/apps/tonalenergy-tuner-metronome/reviews)
- **[USER]** Power users on iOS tune inter-app offsets to ~16 ms precision (AUM Link offset −16.1) and request offset settings from developers. — [Loopy Pro forum comment 1444314](https://forum.loopypro.com/discussion/comment/1444314/)

### Inferences
- Users describe failures as *drift* ("behind by a beat," "after a while") and *loop-point lag* far more than as a steady few-ms offset. That fits two-clock architectures (accumulating drift) and naive loop restarts. A one-clock design removes the most-complained-about class.
- Users diagnose by comparing against a visual playhead or against their own playing. A visible beat indicator that disagrees with the audible click undermines trust even when the audio is right.

### Gaps
- Direct App Store / Google Play review text with these phrases was not retrieved; the search engine returned forums instead. A targeted store-review scrape would be needed for quantitative claims.
- No published study ties measured app timing error to user ratings or retention.
