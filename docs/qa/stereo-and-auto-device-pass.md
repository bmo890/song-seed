# Device pass: stereo, Auto, Even (2026-11-22)

All native: needs a fresh dev build on both platforms (an OTA update can't carry it).
Nothing here was compiled before this pass; a build error is the first thing to look for.

## Stereo

| # | Do | Expect |
|---|---|---|
| 1 | Settings › Recording | "Stereo by default" row (no Pro mark). Absent on a phone that can't. |
| 2 | Open the recorder | Stereo key beside the metronome, on if the default is on. |
| 3 | Flip it, record 10 s, Redo | Choice holds through Redo; key locked while rolling. |
| 4 | Discard, reopen the recorder | Key back to the Settings default. |
| 5 | Stereo take: guitar or voice moved left → right of the phone, in headphones | Sound moves between ears; left is left (portrait, screen facing you). |
| 6 | Same, with a count-in (head-trimmed take, saved as AAC) | Still stereo after save (a known iOS AAC pitfall). |
| 7 | Stereo take with wired headphones plugged in | Take is mono (expected). |
| 8 | Android: first stereo take | If the phone fakes it: toast "This phone records mono", stereo switches vanish. |
| 9 | Mono take, then stereo take, then Layers › Combine | The combined clip is stereo. |
| 10 | Compare a mono and a stereo take of the same thing (iPhone) | Stereo uses iOS's standard mode: listen for any added processing. |
| 11 | iPhone: a stereo take, then turn Stereo off and record again | The mono take sounds like mono takes did before (same mic as before the stereo one). |
| 12 | iPhone: open the recorder with Stereo on, THEN plug in a wired headset, record | Take is mono, from the headset's mic; stereo is still offered afterwards. |
| 13 | iPhone: flip the Stereo key and tap Record at once | The take matches the key (listen in headphones). |
| 14 | Stereo take with the metronome and a count-in; a stereo layer over a guide | Still stereo; the grid and the layer's timing are as on a mono take. |
| 15 | Android: one stereo take with a finger over one mic | Nothing changes (one doubtful take is not a verdict); the next clean take is stereo. |

## Auto and Even (player › Sound drawer, and a layer's sheet)

| # | Recording | Expect from Auto |
|---|---|---|
| 1 | Quiet voice memo | Level up several dB; tone untouched. |
| 2 | Loud full-band rehearsal | Level about right; Even on; maybe Hi cut (cymbals). |
| 3 | Phone on a table, tapping it | Low cut on. |
| 4 | Already well-levelled take | "Already balanced". |
| 5 | Tap Auto again | Previous level and tone come back. |
| 6 | A dull take (phone in a pocket) | Hi boost on; lighting Hi boost puts out Hi cut. |
| 7 | Even on vs off, live and after Combine | Loud and quiet parts closer; no pumping, no crackle. Same on iPhone and Android. |
| 8 | After Auto | A line beside the key says what it heard ("Too quiet · Low rumble"); it goes when Auto is undone. |
| 9 | A hummed melody, a soft voice, a strummed guitar | Level only: no tone key, no Even (Auto leaves an ordinary take's tone alone). |
| 10 | Mid cut on a boxy room recording; Mid boost puts it out | The middle clears a little; the two never light together. |

Tune by ear: target level (-18 dBFS), the rumble/harsh/hiss shares, Even's range (15 dB)
and crest (20 dB) triggers live in `src/domain/autoSound.ts`; Even's settings in
`SoundChainAudioProcessor.kt` and `SongNookToneEQ.swift` (keep the two matched).
