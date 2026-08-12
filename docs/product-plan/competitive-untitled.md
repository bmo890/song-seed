# Competitive analysis — [untitled] (untitled.stream)

**Written:** 2026-08-12 · **Method:** public sources only (App/Play listings, press,
reviews, founder interviews). No hands-on use — direct fetches were blocked by this
environment's network policy, so every claim below traces to a cited search result.
Treat feature details as *reported*, not verified. Sources at the bottom.

---

## 0. The one-paragraph read

[untitled] is **not the same product as SongNook, and the overlap is shallower than
it looks.** They are a cloud vault and social layer for music that already exists as
a file — DAW bounces, stems, WIP mixes — aimed at working artists, producers, and
their collaborators. SongNook is a local-first workshop for music that does not exist
yet: the hum, the riff, the verse that won't land. They own *after the take*. We own
*before the song*. The apparent similarity comes from both showing waveforms in a
list. The divergence is total once you look at what each app expects you to arrive
with: they expect a file, we expect an impulse.

The real threat is not their current feature set. It is that they are **walking
toward us** — in-app recording, overdub, a tuner, a trim/pitch/speed edit suite — with
$22.6M and 100K monthly users behind them. The real opportunity is that the entire
songwriting craft layer (lyrics, chords, practice, performance, resurfacing) is
absent from their product and appears to be nowhere in their roadmap, because it does
not serve their business model.

---

## 1. What they are

| | |
|---|---|
| Company | Sin Titulo Inc. — founders Dan Lilienthal & José Chayet |
| Launched | Aug 2, 2023 on the App Store (~2 years live) |
| Funding | ~$22.6M total; a16z-backed; $900k pre-seed in early 2021 (General Catalyst, Looking Glass) |
| Scale | ~100K monthly active users; ~32K paying subscribers |
| Ratings | ~4.9★ across ~15K iOS reviews |
| Platforms | iPhone, Android, Web, **Mac desktop app** — all syncing |
| Price | $7.99/mo or $49.99/yr. Free tier exists but storage is capped; edit suite, unlimited storage, and extra privacy features are paid |
| Positioning | "a sacred place for your work-in-progress music" |
| Social proof | Used by Tommy Richman, PinkPantheress, Álvaro Díaz, Caroline Polachek's and Kevin Abstract's circles; Fast Company Most Innovative Companies 2026 |

Their pitch, roughly: Google Drive's file logic + SoundCloud's audio quality +
encryption + artist ownership. The founding insight was that unreleased music leaks
and lives in a mess of iMessage threads, AirDrops, and Dropbox folders.

## 2. Their feature set (as reported)

**Storage & organization**
- Projects and folders, synced across iPhone / Android / Web / Mac
- Lossless audio streaming
- Offline mode — listen, edit, organize without connectivity
- Import from AirDrop, iMessage, Mac, video-to-audio extraction
- Version history: replace a track's audio and keep the prior versions
- Per-track notes

**Editing ("Edit Suite" — paid)**
- Trim, waveform zoom
- Pitch and speed / varispeed (now compatible with multi-track recording)
- AI stem splitting
- Tuner (added v1.18)
- Multi-track recording; overdub onto existing tracks; looping auto-records to a new track

**Sharing & collaboration**
- Share links; see *who listened*; manage per-project access
- Collaborators on a project
- Timestamped comments on projects and tracks (added v1.19, July 2026)
- Per-project listen notifications

**Monetization for the artist (2026)**
- Paid Projects: sell demos, stems, songs, whole projects direct to fans at any price
- Platform takes **0% from the artist**; charges the *buyer* a 5% fee

**Trust**
- Partnered with a named cybersecurity firm; encryption pitched as on par with Dropbox/SoundCloud. Leak-proofing is a headline feature, not a footnote.

## 3. Where they are weak

From user reviews and the published design critique:

- **Playback bugs.** Tracks skip within an album — the title shows one song while the next one plays. Playback randomly stops. The last second or two of tracks glitches; transitions aren't smooth.
- **No EQ, no shuffle.** Both are top user requests, still unbuilt.
- **Own vs. others' projects are visually indistinguishable** — a real IA failure once you have collaborators.
- **Price resistance.** "Membership price is quite steep" recurs in reviews; storage sits behind the paywall.
- **You cannot import Voice Memos.** The design critique flags that the import button's icon looks exactly like the Voice Memos logo, implying a capability the app doesn't have. For a songwriter, this is not a small gap — it is the single most common place a song idea already lives.
- **Account and cloud are mandatory.** There is no version of this product where your work stays on your device.
- **Zero writing tools.** No lyrics, no chords, no charts, no practice, no metronome, no setlists. The word "songwriter" is in their marketing; nothing in the product helps you write a song.

## 4. Head to head

### Where they beat us

| Capability | Them | Us |
|---|---|---|
| Multi-device sync | iOS + Android + Web + Mac, seamless | **None.** Single device. Backup/export is manual and file-based |
| Sharing to a listener | Link + access control + listen analytics | Snapshot transfer (`songnook-send`), no analytics, no access control |
| Collaboration | Collaborators, timestamped comments | **None.** Received packages are read-only snapshots, by design |
| Stem separation | AI stems | None |
| Selling to fans | Paid Projects, 0% artist cut | None |
| Distribution & trust | 100K MAU, 4.9★/15K reviews, a16z, name artists | Pre-launch. Zero users, zero reviews, no dev accounts yet |
| Storage headroom | Unlimited on paid | Device storage; archive offload is planned, not built |
| Import breadth | Video→audio, AirDrop, iMessage, Mac upload | Files/voice memos on-device (which, notably, *they* can't do) |

**The honest summary of this column:** their advantages are almost entirely
*infrastructure and distribution* — the things capital buys. Only stem splitting is a
craft feature, and it's a commodity (Moises, Lalal.ai, every DAW).

### Where we beat them

| Capability | Us | Them |
|---|---|---|
| **Lyrics** | Full lyric editor with *versions* (`LyricsVersionScreen`), lyric pad, notepad | Nothing |
| **Chords** | Chord sheets, transpose, chord-chart PDF export | Nothing |
| **Lyric spark tools** | Word Ladder, Cut-Up, Magpie (Gutenberg + Ben-Yehuda public-domain text), rhyme/synonym/related-word finder | Nothing |
| **Practice suite** | Loops, step-up loop, pins & sections, speed + pitch without altering the recording, tempo detection, playback click, beat grid | Pitch/speed only, as an edit operation |
| **Metronome** | Native module, both platforms, audited timing, Bluetooth latency calibration, count-in | Nothing |
| **Tuner** | Native, first-class | Added recently, buried in the paid Edit Suite |
| **Performance** | Setlists, songbooks, songbook reader, playlists, setlist export | Nothing |
| **Resurfacing** | Shelf, Revisit, Activity — the app actively brings old ideas back | Nothing. Folders are inert |
| **Idea genealogy** | Clip lineage — this take came from that take | Linear version history only |
| **Overdub** | Layered overdubs on a clip, as a writing act | Multi-track, as a production act |
| **Ownership** | No account, no cloud, no sign-up. Nothing is ever uploaded. Backup/export to Files, iCloud, or Drive — *you* choose where. Disaster recovery + integrity scanner | Account required; your library is on their servers |
| **Cost to use your own work** | Free, forever, no subscription to open your library | Storage capped without a subscription |
| **Localization** | Full i18n with RTL and Hebrew type remapping | Not advertised |

**The honest summary of this column:** everything between "I have a hum" and "I can
play this song for a room" is ours and unbuilt by them.

---

## 5. On the UI

Your read is right that theirs looks better, but it's worth being precise about
*why*, because the answer is not "they have better taste."

1. **They have a narrower product.** Projects, folders, tracks, a player. That's the
   whole IA. Beauty is much easier when there are four nouns. We have workspaces,
   collections, ideas, clips, takes, lyrics, versions, charts, notes, sparks,
   setlists, songbooks, playlists, shelf, revisit, activity. Every one of those is a
   real capability a songwriter uses — and every one is a surface that must be
   designed, and a chance to look busy.
2. **Two years of shipping.** They launched Aug 2023 and are on v1.19. Their polish is
   accumulated, not innate.
3. **A funded design team.** $22.6M buys full-time designers and motion work.
4. **A single strong concept.** "[untitled]" as a name is a *concept*, not a logo —
   the brand and the product are the same idea. That's the one thing genuinely worth
   envying, and the good news is we already have our equivalent in the sketchbook
   metaphor. Nocturne Paper is a stronger and more distinctive idea than dark-mode
   minimal; it just hasn't been executed across two years of screens yet.

The lesson is not "restyle SongNook." It's that **their restraint is enforced by
scope, and ours has to be enforced by editing.** The design-system rules in
`CLAUDE.md` are that enforcement mechanism. The place where they will keep beating us
on feel is *motion and transitions* — that's where funded design teams spend, and
it's cheap for us to close relative to features.

Two concrete things to steal:
- **Craft in the small.** Their playback bugs suggest their audio engine is weaker
  than ours. Our metronome timing audits, latency model, and grid alignment work are
  real engineering advantages — but they are invisible unless the surface feels as
  considered as the engine.
- **A single held metaphor across every screen.** Not new visuals — fewer of them.

---

## 6. Strategic conclusions

**1. Do not chase cloud, sharing, or the fan marketplace.** That is their moat and it
is made of capital and network effects. We would build a worse version of the thing
they are best at, and abandon the thing they cannot do.

**2. Our defensible position is the craft layer + ownership.** "Everything from the
hum to the stage, and it never leaves your phone." No one else combines capture,
writing (lyrics/chords/words), practice, and performance. [untitled] is a filing
cabinet with a nice player. We are a workshop.

**3. Treat their drift toward capture as a clock, not a crisis.** They added recording,
overdub, and a tuner. They will keep walking toward the moment of capture because it's
upstream of their storage business. But they will not build lyric versioning or
setlists — those don't feed a storage subscription. Plant the flag on the writing and
practice half, loudly, in the store listing and first-run.

**4. Multi-device is our one genuinely painful gap.** It's their strongest practical
advantage and the most common reason a songwriter would pick them. Our answer should
*not* be a cloud with an account wall — that trades away our only structural
differentiator. The better answer is a strong, boring continuity story: excellent
backup/restore, device-to-device transfer, and eventually an *optional* sync where
local-only remains the default and fully functional. The rule: **an account must
never be the price of opening your own library.**

**5. Their pricing suggests Phase 6 is underpriced.** Musicians are paying $7.99/mo
or $49.99/yr for *storage and sharing*. Our planned $3–4/mo for the practice suite,
overdub layers, and exports may be leaving money on the table. The lifetime tier
(~$60–80) remains the right instinct for a subscription-hostile audience and a
near-zero-server-cost app — but the monthly could plausibly sit at $4.99–5.99.
Their price complaints are attached to *renting your own storage*, which is not what
we'd be charging for.

**6. There is a real wedge in their weakest point: import.** They cannot ingest Voice
Memos. Every songwriter has a graveyard of them. "Bring your voice memos somewhere
they'll actually become songs" is a sharp, true, non-comparative hook — and it's a
capability we already ship.

---

## Sources

- [Untitled — App Store](https://apps.apple.com/us/app/untitled/id6445854828) · [Ratings & Reviews](https://apps.apple.com/us/app/untitled/id6445854828?see-all=reviews&platform=iphone) · [Desktop app](https://apps.apple.com/us/app/untitled-for-desktop/id6744922982?mt=12)
- [[untitled] — Google Play](https://play.google.com/store/apps/details?id=stream.untitled)
- [untitled.stream](https://untitled.stream/) · [pricing](https://untitled.stream/pricing)
- [Design Critique: [untitled] iOS App — IXD@Pratt](https://ixd.prattsi.org/2024/09/design-critique-untitled-ios-app/)
- [Tools :: [untitled] — Music Ally](https://musically.com/2026/03/06/tools-untitled/)
- [Fast Company — Most Innovative Companies 2026](https://www.fastcompany.com/91503643/untitled-most-innovative-companies-2026)
- [Investing in [untitled] — a16z](https://a16z.com/announcement/investing-in-untitled/)
- [[untitled] — Not Boring by Packy McCormick](https://www.notboring.co/p/untitled)
- [Beyond the Feed: Building a "Sacred Space" for Musicians — Boardroom](https://boardroom.tv/interview-untitled-dan-lilienthal-jose-chayet/)
- [Artists are calling [untitled] the best thing since torrenting — Daily Dot](https://www.dailydot.com/culture/untitled-music-app/)
- [[untitled] Launches Paywalled Projects — Midnight Rebels](https://midnightrebels.com/untitled-launches-paywalled-projects-to-let-artists-sell-demos-commission-free/)
- [New app, [untitled], lets you share and organise unreleased music — MusicTech](https://musictech.com/news/gear/untitled-to-organise-unreleased-music/)
- [DJ Mag](https://djmag.com/news/new-app-untitled-launched-help-producers-share-and-organise-unreleased-music-securely) · [Product Hunt](https://www.producthunt.com/products/untitled-2) · [Crunchbase](https://www.crunchbase.com/organization/untitled-61d6)
