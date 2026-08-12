# Competitive landscape

**Written:** 2026-08-12 · **Method:** public sources only (App/Play listings, press,
reviews, founder interviews). No hands-on use — direct fetches were blocked by this
environment's network policy, so every claim below traces to a cited search result.
Treat feature details as *reported*, not verified. Sources at the bottom.

Deep dive on **[untitled]** (§1–6), then shorter profiles of **Samply** (§7) and
**BandLab** (§8), the map that places all three (§9), and how [untitled] actually
grew — plus what of it transfers to us (§10).

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
$22.6M and 300K monthly users behind them. The real opportunity is that the entire
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
| Scale | **300,000 monthly users (Dec 2025), 3× year-over-year**; ~34,000 paying $49.99/yr (≈$1.7M ARR). Earlier reporting cited ~100K MAU / ~32K subs — that figure is stale. |
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
| Distribution & trust | 300K MAU, 4.9★/15K reviews, a16z, name artists | Pre-launch. Zero users, zero reviews, no dev accounts yet |
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

## 7. Samply

**What it is:** a client-review tool for audio professionals. Founded 2019,
Cambridge MA, tiny funding (~$125K reported) — a lean, focused, profitable-shaped
business, not a venture rocket. Web-first with a free native iOS companion app.

**Core loop:** you send a mix to a client/collaborator; they leave **time-coded
comments** on the waveform; you reply, ship a new version, they A/B the versions.
That's the product. Its users are mixing and mastering engineers, composers, sync
agents, podcast producers — people whose *job* has a feedback round.

**Notable features**
- Time-coded comments with replies and threads
- Version management + A/B listening between versions
- Lossless, gapless playback; **loudness matching (LUFS normalization)** so version A/B isn't decided by whichever is louder — a genuinely expert touch
- Access control: password protection, download on/off, comment permissions
- Custom branding; live listening sessions; take payment before download (paid tiers)
- iOS app is free and playback-focused: offline listening, AirPlay, CarPlay
- Free tier; paid tiers unlock unlimited storage, advanced editing, enhanced privacy

**Relevance to us: low, but instructive.** Samply sits *downstream* of everything
SongNook does — it starts when you have a mix worth sending to someone who will
critique it. There is no capture, no writing, no practice, no performance. A
SongNook user graduates *into* a Samply-shaped need only if they work with clients.

**What's worth learning from them:**
1. **A small, sharp, unfunded product can win a niche outright** by being the best at one loop. That's a more relevant model for us than [untitled]'s venture path.
2. **LUFS-matched A/B** is the kind of detail that signals "built by someone who does this work." Our equivalents are the metronome timing audit and latency model — real, and currently invisible to the user. Their lesson is to *let the craft show*.
3. **Version A/B is a primitive we half-have.** We store lyric versions and clip lineage; we don't let you *compare two takes back to back at matched level*. For a songwriter choosing between three passes at a chorus, that's a real, small, in-scope feature — and it's ours to build, since neither [untitled] nor BandLab does it either.

## 8. BandLab

**What it is:** a free cloud DAW welded to a music social network. **100M+ registered
users** across 170+ countries — the largest player in this space by two orders of
magnitude.

**Notable features**
- Browser + mobile multitrack DAW: 16 tracks free (32 with membership), 15-minute max duration, unlimited projects, no storage cap
- 370+ instruments, 160,000+ loops and samples, beat maker, synths, drum machines
- Mixing effects (reverb, compression, EQ) and free **Mastering**
- AI tools: Voice Cleaner, Voice-to-MIDI, AutoPitch, AutoMix, SongStarter
- **Collab projects** — a drummer adds a beat, a guitarist a riff, owner compiles the mix
- Social feed, forks/remixes of other people's projects, followers
- Membership (~$8.25/mo annual, $14.95/mo monthly): distribution to Spotify/Apple Music keeping 100% royalties, Opportunities (gigs, deals, sync), Fan Reach campaigns, 32 tracks

**Relevance to us: low overlap, high gravitational pull.** BandLab is *production* —
arranging, beat-making, mixing, mastering, releasing. SongNook has no ambition to be a
DAW and should never acquire one. But BandLab is free, enormous, and on every
platform, so it is the default answer to "what app should I use to make music on my
phone." We will lose that framing every time; we have to not be in it.

**Their structural weakness, and it's the same one:** BandLab is a *social production
network*. It's loud by design — a feed, followers, remix counts, opportunities,
campaigns. It is the exact opposite of "a quiet place to finish creative work." It
also requires an account and lives entirely in their cloud, and its writing support
is nil (SongStarter generates ideas *for* you; it doesn't help you write yours).

**What's worth learning from them:** the free tier is genuinely generous and the
paywall sits on *distribution and career services*, not on the act of making music.
That's the same instinct as our "never gate capture" rule, and it validates it at
100M-user scale.

## 9. The map

Place the four apps on the songwriting timeline and the picture resolves:

```
   hum ──── song ──── take ──── mix ──── release ──── audience
    │         │         │         │          │            │
 SongNook ════════════╡         │          │            │
                    [untitled] ═╪══════════╪════════════╡
                            Samply ════════╡
                    BandLab ═══════════════╪════════════╡
```

- **SongNook** — capture → write → practice → perform. Ends before the mix.
- **[untitled]** — store, version, share, sell what you've already bounced.
- **Samply** — one narrow loop: get expert feedback on a mix.
- **BandLab** — produce and release; plus a social graph.

**Nobody is where we are.** All three assume a file already exists. All three require
an account and a cloud. None of them has lyrics, chords, practice tooling, setlists,
or any notion of returning to an old idea. The songwriting craft layer is empty
territory occupied by scattered single-purpose apps (rhyme dictionaries, chord
charts, metronomes, setlist apps) — never assembled into one workshop.

**What all three confirm:**
1. **Musicians pay.** $7.99–$14.95/mo across the board. Our planned $3–4/mo is low.
2. **They all monetize infrastructure or career services** — storage, delivery, distribution — never the creative act. Same conclusion as Phase 6's "never gate capture."
3. **They are all loud in some way** — feeds, listener analytics, notifications, opportunities, campaigns. The quiet is genuinely unoccupied.
4. **Cloud + account is the universal assumption.** Local-first is not a limitation we're apologizing for; it is the only unclaimed position in the category.

**The sharpest version of our pitch, given this field:** *everyone else stores or
produces the music you've already made. SongNook is where the song gets written — and
it never leaves your phone.*

---

## 10. How [untitled] acquired users — the marketing

The short answer, and it is genuinely the answer: **they did almost no conventional
marketing.** Co-founder José Chayet, on being asked about growth: *"If you start there,
you're thinking about marketing, not the product."* Reporting consistently describes
the company as having "relied largely on word of mouth to grow." There is **no public
evidence of paid user acquisition, performance marketing, paid influencer deals,
billboards, or an ASO campaign.** That's an absence of evidence rather than proof of
zero spend — but it is not the story anyone tells about them, including themselves.

What they did instead, concretely, in rough chronological order:

### The tactics they actually ran

**A. A very long build before any push.** The founders spent ~5.5 years on the vision
before scale arrived, with an explicit plan from day one to build a vertically
integrated music company across creation, distribution, and consumption. Growth was
allowed to be slow because the product was the strategy.

**B. Closed beta + waitlist, seeded inside a specific subculture (mid-2022 →
Aug 2023).** Whispers circulated in tight-knit TikTok indie-producer communities more
than a year before the public App Store launch. Not a broadcast — an embedded
presence in a scene.

**C. Hands-on creator seeding — the closest thing to a real marketing program.**
Producer-creators on TikTok described having "been working with the team at [untitled]
as they prepared to launch." They cultivated direct relationships with credible
micro-influencers *inside the producer niche*, who then made organic content
unprompted. High-touch and cheap; the opposite of a paid influencer buy.

**D. Artist status seeding.** Getting the app into the hands of PinkPantheress, Hayley
Williams, Tommy Richman, Geese, Álvaro Díaz. Their one notable ad — shot on iPhone —
cast *real working producers* (credits including Solange, Caroline Polachek, Charli
XCX, Kevin Abstract) rather than actors. In music, tools are status objects; "the app
your favourite producer uses" outperforms any media buy.

**E. Launch PR built on a newsworthy problem, not a product announcement.** The pitch
to press was leak culture — Kanye and Frank Ocean stems for sale on the dark web —
which is a story journalists write for free. DJ Mag, MusicTech, and EDM all covered
the August 2023 launch. Earned media bought credibility, not just reach.

**F. Feature-as-news, repeatedly.** Paid Projects (0% from the artist, 5% to the
buyer), vinyl pressing, AI stem splitting, timestamped comments. Each ships as an
announceable story and generates another coverage cycle. This looks deliberate: build
things that are inherently reportable.

**G. The a16z / tech-press flywheel.** $22.6M raised, an a16z announcement post, Not
Boring, and Fast Company ranking them **No. 47 on the World's 50 Most Innovative
Companies of 2026**. Repeated free placement in front of industry and tech audiences.

**H. Going physical.** They opened a Brooklyn office containing a performance space and
a recording studio, with stated intent to do shows and eventually a festival. Marketing
as *place* — being literally embedded in the scene rather than advertising to it.

### But the real engine was in the product

None of the above explains 3× year-over-year growth on its own. Two loops do:

**1. The share link is simultaneously the product and the advertisement.**
Their core job-to-be-done — send a WIP to a collaborator, manager, label, or PR — mints
a new user *every single time it is performed*. Artists send [untitled] links to
collaborators, PR teams, and labels; the recipient needs the app to hear it properly.
This is a genuine product-led viral loop, not a referral program bolted on. The sender
is also usually the higher-status party in the exchange, which means every invitation
arrives with an implicit endorsement. Reported growth was "listening went up every
month, without much marketing."

**2. A second, much larger loop on the fan side.** Artists started using it to drop or
leak unreleased tracks *to fans*, and fans downloaded the app to hear them. The Daily
Dot headline is "artists are calling it the best thing since torrenting." TikTok is
full of "how to get unreleased music on untitled" tutorials — not tutorials made by the
company. A professional tool acquired a consumer audience because the *content on it*
was scarce and desirable. This is the single biggest multiplier and it was largely
emergent, not designed.

**3. Deliberate scarcity before launch.** Whispers circulated in tight-knit TikTok
indie-producer communities by mid-2022 — a closed beta and waitlist — but the public
App Store launch wasn't until August 2023. They spent over a year accumulating demand
behind a closed door.

**4. Seeded from the top of the status hierarchy.** They worked directly with producers
ahead of launch. Named users now include PinkPantheress, Tommy Richman, Hayley
Williams, Geese, Álvaro Díaz; their ad — shot on iPhone — features real producers
who've worked with Solange, Caroline Polachek, Charli XCX, Kevin Abstract. In music,
tools are status objects. "The app your favourite producer uses" outperforms any
paid ad.

Reported trajectory: **300,000 monthly users as of December 2025 — triple the year
prior — of whom ~34,000 pay $49.99/yr.** That's roughly $1.7M ARR against $22.6M
raised, which is worth noting: at this stage they are optimising for growth and
category ownership, not revenue. Their patience with slow monetisation is a function
of the raise, and is not available to us.

### On the near-empty social account

A side note, because it's the visible part and the most misleading: it is a *symptom*
of the growth, not its cause.

Three things are likely all true at once:
- **The audience arrived from elsewhere.** TikTok tutorials, press, artist mentions,
  and the app itself sent people to the account, where they followed so as not to miss
  news. Followers accrued without any content being posted.
- **Silence is congruent with the brand.** The product is named "[untitled]" — an empty
  field — and sells itself as a *sacred, private* space. A busy marketing feed would
  contradict the promise. Restraint here is brand consistency, not a growth tactic.
- **Scarcity signals insider status.** In music culture, the tools that matter are
  often the ones you have to know about. A near-empty account reads as "we don't need
  to explain ourselves," which is exactly the posture that makes a tool feel like
  membership.

**The trap:** this is survivorship bias. Restraint did not produce the growth — the
viral loop produced the growth, and restraint was *affordable because the loop worked*.
An empty Instagram attached to a product with no loop is just an empty Instagram. Copy
the posture only after we have an engine that makes silence a choice.

### What this means for us — honestly

**SongNook has no viral loop, and by design nearly cannot have one.** Local-first, no
accounts, nothing uploaded. [untitled]'s entire acquisition engine is precisely the
thing we refused. That refusal is still right — it's our only unclaimed position — but
we must stop expecting their playbook to transfer wholesale. Seven things that *do*:

1. **Invest in the one loop we can have: received packages.** `songnook-send` snapshots
   — a setlist to learn, a songbook, a friend's clips — arrive as a link that needs the
   app. Weaker than a live listening surface, but real. The "zero-decision receipt"
   principle in `sharing-and-received-architecture.md` is therefore not only a UX rule,
   it is our **primary acquisition surface**: a recipient with no library must land
   somewhere beautiful and immediately understand what this app is. That first-run path
   deserves disproportionate design attention.
2. **Run their pre-launch play — it's cheap, and we're at exactly the right moment.**
   We are pre-launch with no dev accounts yet. A waitlist seeded into songwriter
   communities (songwriting subreddits, worship-music circles, guitar/uke forums,
   songwriter YouTube) months before submission costs nothing and builds the same
   accumulated demand. This is the single most directly copyable thing in the whole
   analysis.
3. **Seed from the top of a *different* hierarchy.** Their A-list is pop/rap producers,
   which we cannot reach and would not serve. Ours is working songwriters, songwriting
   teachers, worship leaders, and gigging musicians — the people who actually have
   setlists, songbooks, and half-finished verses. Far cheaper to reach, far more loyal,
   and they have the problems we solve.
4. **We have a free-press narrative with a named villain too.** Theirs is leaks; ours
   is *"your unfinished songs are training data."* "The songwriting app that never
   uploads your music" is a genuinely timely 2026 story, and unlike them we can prove
   it — there is no server to trust.
5. **Content is our substitute for virality.** We can't run the fan-leak loop, but the
   craft layer is inherently demonstrable: getting from a hum to a chorus, using the
   word tools to break a stuck line, practising a part at 70%. Songwriting instruction
   is an enormous organic category, and every demo of those features is also a lesson.
6. **Hand-seed creators, don't buy them.** Their highest-leverage move was cultivating
   direct relationships with a small number of credible producer-creators *before*
   launch, who then made content unprompted. The songwriter-YouTube and
   songwriting-teacher equivalent is a list of maybe 30 people, reachable by email, at
   zero cost. This is a founder job, not a marketing spend, and it should start now.
7. **Ship features that are stories.** They got repeat coverage cycles by releasing
   things that were inherently reportable. Ours are already sitting in the roadmap —
   the never-uploads privacy stance, the word tools, clip lineage. Sequencing releases
   for announceability is free reach.

**The asymmetry to keep in view:** their word-of-mouth strategy was *affordable*
because $22.6M bought 5.5 years of patience and a tolerance for ~$1.7M ARR. We do not
have that runway. Word of mouth is the right long-term shape for us too — but we need
at least one channel that produces users on a timescale we can survive, and points
2, 3, and 6 are the candidates.

---

## Sources

**[untitled]**

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
- [[untitled] Is Blowing Up — Here's Why Musicians Love It (YouTube)](https://www.youtube.com/watch?v=WNZ72aGxri4) · [Untitled App — TikTok topic](https://www.tiktok.com/discover/untitled-app) · [How to get unreleased music on untitled — TikTok topic](https://www.tiktok.com/discover/how-to-get-unreleased-music-on-untitled-stream)
- [untitled.stream on ROSTR Stack](https://stack.rostr.cc/listings/untitledstream) · [Tracxn profile](https://tracxn.com/d/companies/untitledstream/__3FPbVSS1NkQsAPqVyzegT2k8lknvheKEAyYhq9OPwxc)


- [FINIEN EP131 — José Chayet & Dan Lilienthal, co-founders (podcast)](https://www.finien.com/podcasts/ep131-untitled-jose-chayet-dan-lilienthal-co-founders/) · [Big Ass Kids interview](https://www.bigasskids.com/ralphs/interviews/untitled-co-founders-dan-lilienthal-jos-chayet-on-the-rise-of-the-diy-artist-and-how-their-platform-will-kickstart-a-music-renaissance)
- [Fast Company — 10 most innovative companies in music 2026](https://www.fastcompany.com/91497277/music-most-innovative-companies-2026)

**Samply**

- [Samply — Listen & Share, App Store](https://apps.apple.com/us/app/samply-listen-share/id6463439253) · [Apps docs](https://docs.samply.app/applications.html)
- [Samply — Crunchbase](https://www.crunchbase.com/organization/samply-db2e) · [PitchBook](https://pitchbook.com/profiles/company/442316-89)
- [Top 5 Samply alternatives — Audome](https://blog.audome.com/samply-app-alternatives-5/) · [Fasttrak vs. Samply](https://fasttrak.it/comparison/samply) · [Gearspace thread](https://gearspace.com/board/mastering-forum/1377425-whats-deal-samply-app.html)

**BandLab**

- [BandLab — App Store](https://apps.apple.com/us/app/bandlab-music-maker-beats/id968585775)
- [BandLab Pro and Max membership](https://blog.bandlab.com/bandlab-membership/) · [Membership FAQ](https://help.bandlab.com/hc/en-us/articles/20758981227033-BandLab-Membership-FAQ) · [Track & project duration limits](https://help.bandlab.com/hc/en-us/articles/115002945433-Track-and-Project-Duration-Limits) · [Distribution FAQ](https://blog.bandlab.com/bandlab-distribution-faq/)
- [BandLab Review 2026 — MakerStack](https://makerstack.co/reviews/bandlab-review/) · [AI Tool Finder](https://aitoolfinder.org/tools/bandlab/) · [Audeobox guide](https://www.audeobox.com/learn/bandlab/)
