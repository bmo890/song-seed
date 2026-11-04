# Comparable and adjacent apps for SongNook: catalog, prices and scale signals

Retrieval date for every store figure below is **2026-10-19** unless noted.

**How to read the numbers (applies throughout):**
- **"US ratings"** = `userRatingCount` from Apple's public iTunes Search/Lookup API, **US storefront only**, all versions. Label: *rough proxy* for scale. Pulled via `https://itunes.apple.com/search?term=<name>&entity=software&country=us` (example: [iTunes Search API, Moises](https://itunes.apple.com/search?term=moises&entity=software&country=us&limit=3)).
- **"Play installs"** = Google Play's public install bracket (e.g. 10M+) for the US listing, and **"Play reviews"** = the global review count shown on the listing. Install bracket label: *official, coarse*. Review count label: *rough proxy*. Source: `https://play.google.com/store/apps/details?id=<package>`.
- **IAP prices** = the "In-App Purchases" list on the US App Store web page (`https://apps.apple.com/us/app/id<ID>`). Apple shows only the top ~10 SKUs, and they often include legacy, sale, intro and A/B-test price points, so duplicate names at different prices are normal. Label: *official list price (US)*, but which SKU a new user sees today is not shown.
- Revenue and download estimates from Sensor Tower, AppGoblin, Latka, Tracxn and similar sites are *third-party estimates*. Their published error ranges are wide: Appfigures self-reports 5–25% error, and one developer reported Sensor Tower showing $40k/mo against a real $90k/mo ([Mirava](https://www.mirava.io/blog/app-revenue-growth-estimator); [Appaloma](https://www.appaloma.com/research/app-intelligence-commodity-2026)).

---

## Q1. Songwriting and idea-capture apps (the closest competitors)

### Takeaway
SongNook's closest direct competitors are small. The one sizable iOS-native songwriting app is **Demo: Songwriting Studio** (~6.0k US ratings; $5.99/mo, $39.99/yr, **$99.99 lifetime**). Lyric-only tools are bigger: **Rhymer's Block** has ~34.5k US ratings, and Android's "Lyrics Notepad" has 1M+ installs. **BandLab** (100M+ users, 100M+ Play installs) is the giant, but it is a social DAW rather than a private sketchbook. Apple's **Music Memos** was retired in March 2021 and folded into Voice Memos, which leaves Voice Memos and GarageBand as the free default.

### Cited Findings

**Store data (retrieved 2026-10-19)**

| App (developer) | Platforms | Model / US prices (App Store IAP list) | US ratings (avg) | Play installs / reviews | Notes |
|---|---|---|---|---|---|
| **Demo: Songwriting Studio** (Demo Music, LLC) | iOS only (no Play listing found in search) | Freemium. Demo+ **$5.99/mo**, **$39.99/yr** (also $44.99/yr SKU), weekly $2.99, **Lifetime $99.99** — [App Store](https://apps.apple.com/us/app/id1563264178) | 5,986 (4.62) — [iTunes API](https://itunes.apple.com/search?term=songwriting+app&entity=software&country=us) | — | Released 2021-10; updated 2026-08. Chord generator, rhyme-aware lyric tool, multitrack recorder, MIDI/stem export, iCloud sync, CoWrite sharing — [App Store LC](https://apps.apple.com/lc/app/demo-songwriting-studio/id1563264178). Reviews cite the paywall as friction — [same](https://apps.apple.com/lc/app/demo-songwriting-studio/id1563264178) |
| **Writers Session** (Anthony Briscoe) | iOS | Free + IAP (IAP list not parsed) — [App Store](https://apps.apple.com/us/app/id1172558973) | 2,660 (4.53) — [iTunes API](https://itunes.apple.com/search?term=hum+songwriting&entity=software&country=us) | — | Released 2017; updated 2026-10 |
| **Hum** (Just Hum LLC) | iOS | Paid upfront **$2.99** — [App Store](https://apps.apple.com/us/app/id796154884) | 44 (3.68) — [iTunes API](https://itunes.apple.com/search?term=hum+songwriting&entity=software&country=us) | — | **Last updated 2019-11-05**, so effectively dormant. Lyrics, notes and recording in one app with tagging by key/tuning/mood, built-in tuner and Dropbox backup. Kickstarter origin. Reviews report Dropbox-sync crashes and an unresponsive developer — [mwm.ai aggregator](https://mwm.ai/apps/hum/796154884); [MacStories Kickstarter](https://www.macstories.net/?p=32759) |
| **Rhymer's Block** (WATT Apps) | iOS + Android | Freemium. Pro Yearly **$19.99 / $29.99 / $39.99** SKUs, Pro Bundle $9.99 (one-time, also $6.99), "Promote on The Block" $2.99 — [App Store](https://apps.apple.com/us/app/id796584182) | **34,514 (4.74)** — [iTunes API](https://itunes.apple.com/search?term=rhymers+block&entity=software&country=us) | 100K+ / 3.71K — [Play](https://play.google.com/store/apps/details?id=com.ron.rhymersblock) | Lyric notepad + rhyme finder + social "Block" feed. iOS last updated 2025-07 |
| **Lyric Studio – Rap Rhyme Maker** (Bakery Scent S.r.l.) | iOS | Weekly-heavy: Weekly $2.99–4.99, Lyric Pro $39.99 (likely yearly), "Urban Notes" $6.99/mo, $49.99/yr — [App Store](https://apps.apple.com/us/app/id1600316328) | 2,437 (4.51) — [iTunes API](https://itunes.apple.com/search?term=lyric+studio&entity=software&country=us) | — | AI/rhyme lyric tool, rap-oriented |
| **Lyric Notepad – Song Writing** (Zipo Apps) | iOS | Many SKUs: "Unlimited access" $0.99–$49.99; Premium $6.99/$8.99 — [App Store](https://apps.apple.com/us/app/id1435329761) | 621 (3.55) — [iTunes API](https://itunes.apple.com/search?term=lyric+notepad&entity=software&country=us) | — | |
| **Lyrics Notepad – Song Writing** (Android, pkg kmcilvai.perfectpoet) | Android | Free + IAP | — | **1M+ / 17.1K** — [Play](https://play.google.com/store/apps/details?id=kmcilvai.perfectpoet) | Largest Android lyric notepad found |
| **"write lyrics & save your ideas"** (pkg com.smoothuse.lyrics_writer) | Android | Free + IAP | — | **1M+ / 5.49K** — [Play](https://play.google.com/store/apps/details?id=com.smoothuse.lyrics_writer) | |
| **Songwriter's Pad + Lyrics AI** (Dante Media) | iOS + Android | Gold **$12.99** (likely monthly) / **$79.99** (likely yearly); "Unlimited Songs + 20K tokens" $149.99; AI word-token packs $4.99–19.99; beats $4.99 — [App Store](https://apps.apple.com/us/app/id6462515092) | 49 (4.14) — [iTunes API](https://itunes.apple.com/search?term=songwriters+pad&entity=software&country=us) | 50K+ / 248 — [Play](https://play.google.com/store/apps/details?id=com.songwriterpad.sspai) | Current app released 2023-11. Songwriter's Pad was long a desktop/web product; this is the AI-era relaunch |
| **The Lyrics App** (Michael Handkins) | iOS | Free + IAP | 570 (4.71) — [iTunes API](https://itunes.apple.com/search?term=lyric+notepad&entity=software&country=us) | — | Last updated 2024-11 |
| **Fast Rhymes Songwriting Studio** | Android | Free + IAP | — | 100K+ / 1.4K — [Play](https://play.google.com/store/apps/details?id=rhyme.dictionary.mobileapp) | |
| **Music Memos – Chords & Lyrics** (Nomad AI OÜ, maker of Chord ai) | iOS | **$3.99/mo, $24.99/yr, $49.99 lifetime** — [App Store](https://apps.apple.com/us/app/id6446246814) | 69 (4.1) — [iTunes API](https://itunes.apple.com/search?term=music+memos&entity=software&country=us) | — | Third-party app reusing Apple's retired name. Records ideas and detects chords |
| **Dubnote: Music Recorder** (Vochlea Music) | iOS | Premium **$7.99/mo, $39.99/yr**; Pro $1.99/mo, $19.99/yr; Lifetime $99.99 — [App Store](https://apps.apple.com/us/app/id6445849526) | 163 (4.55) — [iTunes API](https://itunes.apple.com/search?term=song+ideas+recorder&entity=software&country=us) | — | 2024-12 newcomer: music idea recorder (voice → MIDI, by Vochlea) |
| **Song Cage: Capture Song Ideas** (Digital Candy LLC) | iOS | 14-day trial then **$79 one-time licence** — [App Store](https://apps.apple.com/us/app/id6778730565) | 1 — [iTunes API](https://itunes.apple.com/search?term=songcraft&entity=software&country=us) | — | **2026-06 newcomer**, directly in SongNook's "song idea capture" niche. Notable: premium one-time price |
| **Jibber: Songwriter Voice Memos** (Simon de Wit) | iOS | Free (no IAP parsed) | 0 — [iTunes API](https://itunes.apple.com/search?term=songwriting+voice+memo&entity=software&country=us) | — | **2026-08 newcomer**: voice-memo organizer for songwriters |
| **Lyric Genie: Songwriting App** (Edan Dover) | iOS | Pro **$4.99/mo**, **$29.99 or $49.99/yr** — [App Store](https://apps.apple.com/us/app/id6739787614) | 14 — [iTunes API](https://itunes.apple.com/search?term=songwriting+app&entity=software&country=us) | — | 2025-01 newcomer |
| Other 2025–26 newcomers (tiny) | iOS | Free | ≤26 each | — | SongSmith (2025-09, 26 ratings), StrumLab SongCraft (2025-06), Memody voice-to-MIDI (2026-05), Versepad lyric notepad (2026-06) — [iTunes API](https://itunes.apple.com/search?term=lyric+notepad&entity=software&country=us); [iTunes API](https://itunes.apple.com/search?term=songcraft&entity=software&country=us) |
| **Take Creative Vocal Recorder** (Reason Studios) | iOS | Free | 1,695 — [iTunes API](https://itunes.apple.com/search?term=song+ideas+recorder&entity=software&country=us) | — | **Abandoned**: last updated 2019-04 |
| **Spire: Music Recorder & Studio** (iZotope) | iOS | Free (IAP not shown) | 16,229 (4.75) — [iTunes API](https://itunes.apple.com/search?term=song+ideas+recorder&entity=software&country=us) | — | **Abandoned**: last updated 2021-08. Shows that a well-loved idea recorder can be shelved by a large parent |
| **Songcraft** (songcraft.io) | Web (browser); no iOS app by that name found | Free plan + Pro "as low as **$5/mo**" (third-party listing; no official price page found) — [Subscribed.fyi](https://subscribed.fyi/songcraft/reviews/) | — | — | Browser workspace for lyrics, chords, tabs and audio with real-time collaboration — [Subscribed.fyi](https://subscribed.fyi/songcraft/reviews/) |

**Free platform defaults and giants**

| App | Platforms | Model / prices | Scale signals |
|---|---|---|---|
| **BandLab** (BandLab Technologies / Caldecott Music Group) | iOS, Android, web | Free core. App Store IAPs: **BandLab Membership $14.99/1 mo; Membership Pro $14.99/1 mo, $149.99/12 mo**; "Boost" promo credits $3–20 — [App Store](https://apps.apple.com/us/app/id968585775) | **100M+ users** (company/CEO via Bloomberg, Mar 2024; US ≈30% of users), up from 50M in Jun 2022 — [Billboard](https://www.billboard.com/business/tech/bandlab-100-million-users-report-1235637853/); [Music Ally](https://musically.com/2024/03/25/music-creation-firm-bandlab-says-it-has-more-than-100m-users/). Still cited as "over 100 million" in Apr 2025 — [Sony release](https://www.sony.co.jp/en/news-release/202504/25-0430E/index.html) — and in its 2025 iPhone App of the Year finalist post — [BandLab](https://bandlabtechnologies.com/news/bandlab-finalist-apple-2025-iphone-app-of-the-year/). Raised €23M Series B1 at a €400M valuation (2023) — [Team France Export](https://www.teamfrance-export.fr/infos-sectorielles/24982/24982-bandlab-technologies-basee-a-singapour-leve-23-m-eur). US ratings **510,225 (4.74)** — [iTunes API](https://itunes.apple.com/search?term=bandlab&entity=software&country=us). Play **100M+ installs / 837K reviews** — [Play](https://play.google.com/store/apps/details?id=com.bandlab.bandlab). No revenue or paid-member figures found |
| **GarageBand** (Apple) | iOS/macOS only | Free | US ratings 117,827 (4.08) — [iTunes API](https://itunes.apple.com/search?term=garageband&entity=software&country=us) |
| **Voice Memos** (Apple) | iOS/macOS only | Free, preinstalled | US ratings **1,112,705 (4.8)** — [iTunes API](https://itunes.apple.com/search?term=voice+memos&entity=software&country=us) |
| **Apple Music Memos** (Apple) | iOS (retired) | Was free | Apple announced the retirement in late 2020. 1.0.7 was the final version and added export to Voice Memos. Downloads ended about **1–2 March 2021**. Apple pointed users to Voice Memos, and to GarageBand for editing — [9to5Mac](https://9to5mac.com/2020/12/10/apple-music-memos-voice-memos-integration/); [iMore](https://www.imore.com/music-memos-no-longer-available-download-ios); [RouteNote](https://routenote.com/blog/apple-has-completely-removed-their-music-memos-app/); [Digital Music News](https://www.digitalmusicnews.com/2021/03/02/apple-retires-music-memos/) |

### Inferences
- Apple never gave a public reason for retiring Music Memos beyond migrating users to Voice Memos and GarageBand. The likely reading is consolidation, since Voice Memos had absorbed its core recording and editing. That is inference, not a stated reason. The result is a "musician's memo" gap that a crop of indie apps fills: Demo, Dubnote, Song Cage, Jibber and Nomad's "Music Memos".
- Price anchors in this niche cluster at **~$4–8/mo and $25–40/yr** (Demo $5.99 / $39.99, Dubnote $7.99 / $39.99, Lyric Genie $4.99 / $29.99, Nomad Music Memos $3.99 / $24.99, Rhymer's Block $19.99–39.99/yr). **Lifetime options are common: $49.99 to $99.99** (Demo $99.99, Dubnote $99.99, Music Memos $49.99, Song Cage $79 one-time).
- Ratings counts suggest the direct "songwriting sketchbook" segment is small: the leader, Demo, has ~6k US ratings, against 34.5k for Rhymer's Block and 500k+ for BandLab. A private, offline, musician-specific organizer has room, but the paid market is modest.
- Two notable idea recorders (iZotope Spire, Reason Take) and Hum were abandoned. Developer longevity is a real trust issue for this audience, which suits SongNook's "media stays reachable, private on-device" positioning.

### Gaps
- No third-party revenue or download estimate found for Demo, Rhymer's Block, Writers Session, Lyric Studio or Songwriter's Pad. These need Sensor Tower, Appfigures or AppMagic logins.
- Could not confirm Songcraft's official current pricing (only a third-party listing). No "Song Notes" songwriting app of meaningful size was found under that name.
- "ShowShow-like tools" could not be identified. No app by that name surfaced in App Store search.
- Writers Session and The Lyrics App IAP prices were not parsed.

---

## Q2. Chord, lyrics and setlist apps

### Takeaway
This category is large and monetizes well. **Ultimate Guitar** (Muse Group) reports ~30M MAU and ~102M app downloads. **Chordify** and **Chord ai** sell $8–11/mo subscriptions. Gig-binder apps (OnSong, BandHelper, SongbookPro, forScore, SongSheet Pro, SongBook ChordPro) are small by ratings but sell **$3–6/mo, $18–60/yr or $6–25 one-time**, and several offer lifetime licences.

### Cited Findings

| App (developer) | Platforms | US prices (App Store IAP list unless noted) | US ratings (avg) | Play installs / reviews | Company / third-party scale |
|---|---|---|---|---|---|
| **Ultimate Guitar: Chords & Tabs** (Muse Group) | iOS, Android, web | Pro: **$9.99/mo, $39.99/yr** (sale SKUs $22.99, $29.99, $9.99); **UG Pro+ $9.99/mo, $39.99/yr**; "Annual Pro Access $29.99" — [App Store](https://apps.apple.com/us/app/id357828853). Web pricing reported much higher: **$99/yr** (~$25/mo) with $65/yr spring sale — [Guitar Chalk 2026](https://www.guitarchalk.com/ultimate-guitar-pro-review/); PriceTimeline (Jul 2025) $9.99/mo, $99/yr — [PriceTimeline](https://pricetimeline.com/data/price/ultimate-guitar). Sources conflict on price | **480,290 (4.73)** — [iTunes API](https://itunes.apple.com/search?term=ultimate+guitar&entity=software&country=us) | **10M+** / 639K — [Play](https://play.google.com/store/apps/details?id=com.ultimateguitar.tabs) (bracket looks low against the company figure; reported as shown) | **Official:** ~30M MAU, 102M app downloads, 2.1M tabs — [Muse Group, UG page](https://www.mu.se/ultimate-guitar); Muse brands reach "over 500 million" people a year — [MBW](https://www.musicbusinessworldwide.com/francisco-partners-exits-its-minority-investment-in-muse-group-owner-of-audacity-hal-leonard-and-ultimate-guitar/). **Third-party:** AppGoblin estimates iOS app ~$100K+/mo (32% IAP / 68% ads), ~1.5M iOS MAU — [AppGoblin](https://appgoblin.info/apps/357828853) (looks low for a top grossing music app; treat as low-confidence). Unverified claim of "1.5M Pro users" — [SonusGear](https://sonusgear.alibaba.com/guitar/is-ultimate-guitar-pro-worth-it) (low quality) |
| **Chordify** (Chordify BV) | iOS, Android, web | **$8.00–$8.99–$9.00/mo; $42.00–$54.00/yr**; Black Friday $47.90 — [App Store](https://apps.apple.com/us/app/id1073624757) | 33,846 (4.73) — [iTunes API](https://itunes.apple.com/search?term=chordify&entity=software&country=us) | **10M+** / 42.7K — [Play](https://play.google.com/store/apps/details?id=net.chordify.chordify) | **Official (undated, older):** 300M+ unique visitors, 6.4M registered users — [Chordify press](https://chordify.pr.co/164891-releasing-ios-app-2-0). Semrush: chordify.net ~8.5–9.8M visits/month, Jun–Jul 2025 (third-party traffic estimate) — [Semrush](https://sv.semrush.com/website/chordify.net/competitors) |
| **Chord ai** (Nomad AI OÜ) | iOS, Android | **$10.99/mo, $69.99/yr**; family $14.99/mo, $99.99/yr — [App Store](https://apps.apple.com/us/app/id1446177109) | 5,922 (4.64) — [iTunes API](https://itunes.apple.com/search?term=chordify&entity=software&country=us) | 1M+ / 56.8K (4.7) — [Play](https://play.google.com/store/apps/details?id=com.chordai) | — |
| **Songsterr** (Guitar Tabs LLC) | iOS, Android, web | Songsterr Plus $9.99 (period not shown); legacy $4.99 SKUs — [App Store](https://apps.apple.com/us/app/id399211291) | 48,065 (4.71) — [iTunes API](https://itunes.apple.com/search?term=ultimate+guitar&entity=software&country=us) | 5M+ / 61K — [Play](https://play.google.com/store/apps/details?id=com.songsterr) | — |
| **OnSong 2026** (OnSong LLC) | iOS (mature); **Android new** | **Essentials $3.99/mo, $29.99/yr; Premium $5.99/mo, $59.99/yr** — [App Store](https://apps.apple.com/us/app/id1330350343) | 5,650 (4.51) — [iTunes API](https://itunes.apple.com/search?term=onsong&entity=software&country=us) | **100+** (new Android port) — [Play](https://play.google.com/store/apps/details?id=com.onsongapp.app) | Chord-chart/setlist binder for gigging and church musicians; moved to annual "OnSong 20xx" subscription branding |
| **BandHelper** (Arlo Leach) | iOS, Android, web | Tiered by plan and band size: **Basic Solo $3/mo, $18/yr; Pro Solo $38/yr**; Basic 2–5 users $5/mo, $46/yr; Plus 2–5 $70/yr; Pro 2–5 $9/mo, $94/yr; Pro 6–20 $14/mo — [App Store](https://apps.apple.com/us/app/id552012927) | 113 (4.27) — [iTunes API](https://itunes.apple.com/search?term=bandhelper&entity=software&country=us) | 50K+ / 359 — [Play](https://play.google.com/store/apps/details?id=com.arlomedia.bandhelper) | Sibling paid app **Set List Maker $19.99** one-time, 87 US ratings — [iTunes API](https://itunes.apple.com/search?term=setlist+maker&entity=software&country=us) |
| **SongbookPro** (Songbook Systems) | iOS, Android, Windows | Free + **$5.99 one-time** full-version upgrade — [App Store](https://apps.apple.com/us/app/id1475370014) | 2,730 (4.74) — [iTunes API](https://itunes.apple.com/search?term=onsong&entity=software&country=us) | **500K+** / 9.64K — [Play](https://play.google.com/store/apps/details?id=com.songbookpro.songbookpro) | Cheap one-time ChordPro songbook; strong on Android |
| **SongSheet Pro** (Ghostdust) | iOS | **$5.99/mo, $59.99/yr, $129.99 lifetime**; weekly $2.99; early-bird $29.99/yr, $79.99 lifetime — [App Store](https://apps.apple.com/us/app/id581094194) | 2,716 (4.72) — [iTunes API](https://itunes.apple.com/search?term=onsong&entity=software&country=us) | — | |
| **SongBook ChordPro** (LinkeSOFT) | iOS, Android, desktop | **$19.99 upfront** + Yearly $19.99 / Monthly $1.99 IAP — [App Store](https://apps.apple.com/us/app/id392888837) | 2,409 (4.75) — [iTunes API](https://itunes.apple.com/search?term=songbook+chordpro&entity=software&country=us) | — | |
| **forScore** (forScore LLC) | iPad/iOS/macOS only | **$24.99 upfront** + forScore Pro (annual sub; IAP list shows **$14.99**, plus a 30-day pass $2.99) — [App Store](https://apps.apple.com/us/app/id363738376). forScore KB (Feb 2025): "$24.99 one-time; Pro starts at $14.99/yr" — [forScore KB](https://forscore.co/kb/how-to-buy/); forScore Pro page states $9.99/yr — [forScore Pro](https://forScore.co/pro) (sources conflict) | **43,368 (4.81)** — [iTunes API](https://itunes.apple.com/search?term=forscore&entity=software&country=us) | n/a (no Android) | Benchmark for "paid upfront + optional sub" in pro-musician tools |
| **MuseScore** (Muse Group) | iOS, Android | Free + subscription (not parsed) | 79,121 (4.61) — [iTunes API](https://itunes.apple.com/search?term=forscore&entity=software&country=us) | — | Sheet music; adjacent only |

### Inferences
- Ultimate Guitar's iOS in-app list ($9.99/mo, $39.99/yr) is far below its reported web price ($99/yr). Either the App Store SKUs are older or discounted, or web pricing differs. A report-writer should present both and not pick one.
- Gig-binder apps show that working musicians pay for reliability: OnSong at $30–60/yr, BandHelper at $18–94/yr, SongSheet's $129.99 lifetime, forScore's $24.99 upfront plus sub. Their ratings counts are small (100s to low thousands, apart from forScore at 43k). This is a niche of high-intent, low-volume buyers.
- Transpose/capo, setlists and songbooks are table stakes across $6-one-time (SongbookPro) to $60/yr (OnSong). SongNook's chart features alone will not justify a premium price; the bundle with recording and sketches is the differentiator.

### Gaps
- No 2025–26 official user or subscriber count for Chordify, OnSong, BandHelper, forScore or SongbookPro.
- No Muse Group or UG revenue found (private company). AppGoblin's ~$100K/mo iOS estimate is unverified and likely understated.
- Android IAP prices are not shown per item on Play web pages, so Android pricing is assumed to mirror iOS but is unverified.

---

## Q3. Practice apps (loop, slow-down, pitch, stems)

### Takeaway
**Moises** is the category giant: company-reported **70M users (Dec 2025)**, **$50M+ raised**, 50M+ Play installs, US iOS **Premium $5.99/mo, $39.99/yr, Pro $29.99/mo**. Classic practice tools sell on one-time prices instead: **Anytune Pro+ $14.99**, Anytune feature packs $1.99–4.99, **Amazing Slow Downer $14.99**. Android's "Music Speed Changer" has 10M+ installs.

### Cited Findings

| App (developer) | Platforms | US prices | US ratings (avg) | Play installs / reviews | Company / third-party scale |
|---|---|---|---|---|---|
| **Moises: The Musician's App** (Moises Systems / Music AI) | iOS, Android, web, desktop | **Premium $5.99/mo, $39.99/yr; Pro $29.99/mo** (the Pro yearly SKU was not in the top-10 list) — [App Store](https://apps.apple.com/us/app/id1515796612). Third-party sites cite web Premium ~$3.99/mo (~$2.99/mo billed annually) and Pro ~$9.99/mo; these conflict with the iOS prices — [StemSplit review](https://stemsplit.io/blog/moises-ai-review); [Chartlex](https://www.chartlex.com/blog/marketing/moises-ai-review-2026) | 28,119 (4.70) — [iTunes API](https://itunes.apple.com/search?term=moises&entity=software&country=us&limit=3) | **50M+** / 436K — [Play](https://play.google.com/store/apps/details?id=ai.moises) | **Official:** "70 million users worldwide", "over 15 million new creators" in 2025, "raised $50+ million", 1.2B minutes processed, 190 countries (CEO post, 22 Dec 2025) — [Moises 2025 recap](https://moises.ai/newsroom/company-milestones/2025-year-in-review/). Earlier: 30M registered users (Apr 2023) after a $10.25M raise — [MBW](https://www.musicbusinessworldwide.com/after-rasing-10-25m-ai-music-making-app-moises-reaches-than-more-30m-registered-users1234/); **$40M Series A** ($30M primary + $10M secondary) at 50M users — [MBW](https://www.musicbusinessworldwide.com/music-ai-raises-40m-in-series-a-round-as-its-moises-platform-hits-50m-users/); [Music.AI press](https://music.ai/blog/press/music-ai-raises-40m-series-a/). **Third-party:** Sensor Tower US iOS last-month estimate ~200K downloads, ~$1M revenue (page data marked ~200 days old as indexed) — [Sensor Tower](https://app.sensortower.com/overview/1515796612?country=US). Users are registered/cumulative, not MAU |
| **Anytune: Transcribe & Practice** (Anytune Inc.) | iOS, Android, macOS | Free + one-time packs: Basic $1.99, Import $2.99, Pro Pack $4.99, Studio Pack $4.99, Export $4.99, Remote/Watch $4.99 — [App Store](https://apps.apple.com/us/app/id415365180) | 8,543 (4.80) — [iTunes API](https://itunes.apple.com/search?term=anytune&entity=software&country=us) | 100K+ / 1.26K — [Play](https://play.google.com/store/apps/details?id=app.anytune.musicplayer) | — |
| **Anytune Pro+** | iOS | **$14.99 upfront** + $4.99 add-ons — [App Store](https://apps.apple.com/us/app/id478293637) | 8,382 (4.87) — [iTunes API](https://itunes.apple.com/search?term=anytune&entity=software&country=us) | — | — |
| **Amazing Slow Downer** (Roni Music) | iOS, Android, desktop | **$14.99 upfront** (iOS); Lite free — [App Store](https://apps.apple.com/us/app/id308998718) | 459 (3.94); Lite 111 (2.71) — [iTunes API](https://itunes.apple.com/search?term=amazing+slow+downer&entity=software&country=us) | Paid 50K+ / 1.04K; Lite 100K+ / 573 — [Play](https://play.google.com/store/apps/details?id=com.ronimusic.asd); [Play Lite](https://play.google.com/store/apps/details?id=com.ronimusic.asdlite) | — |
| **Music Speed Changer** (Single Minded Productions) | iOS, Android | Free + IAP | 4,156 (4.79) — [iTunes API](https://itunes.apple.com/search?term=anytune&entity=software&country=us) | **10M+** / 178K — [Play](https://play.google.com/store/apps/details?id=com.smp.musicspeed) | — |
| **Up Tempo** (Stonekick) | iOS | Free + IAP | 1,172 — [iTunes API](https://itunes.apple.com/search?term=anytune&entity=software&country=us) | — | — |

### Inferences
- Moises shows that loop, slow-down and pitch features attract a mass audience when bundled with AI stems. A practice tool alone (Anytune, Amazing Slow Downer) stays niche at one-time prices of $5–15. SongNook's practice tools are best framed as part of the sketch workflow, not as a standalone selling point.
- Moises's US iOS Premium price ($5.99/mo, $39.99/yr) is almost exactly the Demo and Dubnote price point. $39.99/yr is a well-established anchor among musician-utility apps on iOS.

### Gaps
- No official Moises revenue, ARR or paid-subscriber count; the 70M figure is cumulative users, not MAU.
- The Sensor Tower Moises estimate is stale and US-iOS-only.
- Moises Pro yearly iOS price was not in the visible IAP list.

---

## Q4. Voice recorders used by musicians

### Takeaway
Free defaults dominate: **Apple Voice Memos** (1.1M US ratings) and Android's **Easy Voice Recorder** (50M+ installs; Pro $4.99 one-time). Musician-leaning recorders are cheap one-time purchases: **Just Press Record $6.99**, **Voice Record Pro** free with **$8.99** ad removal. **Dolby On** is free and has 10M+ Play installs.

### Cited Findings

| App | Platforms | Model / US price | US ratings (avg) | Play installs / reviews |
|---|---|---|---|---|
| **Voice Memos** (Apple) | iOS/macOS | Free, preinstalled | **1,112,705 (4.8)** — [iTunes API](https://itunes.apple.com/search?term=voice+memos&entity=software&country=us) | n/a |
| **Just Press Record** (Open Planet Software) | iOS, watchOS, macOS | **$6.99 upfront**, no IAP shown — [App Store](https://apps.apple.com/us/app/id1033342465) | 1,525 (4.25) — [iTunes API](https://itunes.apple.com/search?term=just+press+record&entity=software&country=us) | n/a |
| **Voice Record Pro** (Dayana Networks) | iOS | Free + **$8.99 "No Advertisement"** — [App Store](https://apps.apple.com/us/app/id546983235) | 16,403 (4.74); VRP 7: 1,156 — [iTunes API](https://itunes.apple.com/search?term=voice+record+pro&entity=software&country=us) | n/a |
| **Dolby On** (Dolby Laboratories) | iOS, Android | Free, no IAP shown — [App Store](https://apps.apple.com/us/app/id1443964192) | 7,436 (4.82) — [iTunes API](https://itunes.apple.com/search?term=dolby+on&entity=software&country=us) | **10M+** / 25.8K — [Play](https://play.google.com/store/apps/details?id=com.dolby.dolby234) |
| **Easy Voice Recorder** (Digipom / Coffee Bean Ventures) | Android | Free + ads; **Pro $4.99 one-time** (Play developer page; snapshot date unknown) — [Play developer page](https://play.google.com/store/apps/developer?id=Digipom) | — | **50M+** / 624K — [Play](https://play.google.com/store/apps/details?id=com.coffeebeanventures.easyvoicerecorder) |
| **Voice Recorder & Audio Editor** (TapMedia) | iOS | Free + IAP | 453,369 (4.72) — [iTunes API](https://itunes.apple.com/search?term=voice+memos&entity=software&country=us) | — |
| **AudioShare** (Kymatica) | iOS | **$4.99 upfront** — [iTunes API](https://itunes.apple.com/search?term=audioshare&entity=software&country=us) | 855 (4.68) | — |

### Inferences
- In the generic recorder market, one-time pricing in the $5–9 range is the norm. Musicians who choose a dedicated recorder pay little. SongNook's value has to come from organization (takes, layers, sketches, lyrics), not from recording alone.

### Gaps
- No third-party revenue estimate gathered for Just Press Record, Voice Record Pro or Easy Voice Recorder.
- Play review counts were pulled, but Android IAP price points were not.

---

## Q5. Tuners and metronomes

### Takeaway
Tuners are mass-market funnels: **GuitarTuna** (Yousician) has 100M+ Play installs and 2.67M Play reviews; **Fender Tune** has 151.8K US ratings and is free. Metronome subscriptions run **$4–10/mo or $30–80/yr** (Soundbrenner Plus, GuitarTuna Tools), while **Pro Metronome** still sells a **$3.99** Pro unlock. SongNook's built-in tuner and metronome are parity features, not a reason to pay.

### Cited Findings

| App | Platforms | US prices | US ratings (avg) | Play installs / reviews | Company / third-party scale |
|---|---|---|---|---|---|
| **GuitarTuna** (Yousician) | iOS, Android | Tools **$6.49/mo, $29.99/yr**; Play $8.99–9.99/mo, $39.99/yr; Learn **$24.99/mo, $139.99/yr**; Pro sub $1.99–6.49; Pro $12.99 — [App Store](https://apps.apple.com/us/app/id527588389) | 148,598 (4.78) — [iTunes API](https://itunes.apple.com/search?term=guitartuna&entity=software&country=us) | **100M+** / 2.67M — [Play](https://play.google.com/store/apps/details?id=com.ovelin.guitartuna) | **Third-party, widely divergent:** Yousician FY2024 revenue €50–100M (Tracxn) against $3.6M (Latka) against $22.8M (Growjo) — [Tracxn](https://tracxn.com/d/companies/yousician/__9_js14rTh79nrKlExWy_o-y8h6uzWU-JoYbthACpUYg); [Latka](https://getlatka.com/companies/yousician); [Growjo](https://growjo.com/company/Yousician). Old Adapty-cited GuitarTuna estimate: ~700K downloads and ~$2M revenue in a month (pre-2025) — [Adapty](https://adapty.io/paywall-library/guitartuna/). Lazyweb lists GuitarTuna 2024 revenue $24M (unsourced) — [Lazyweb](https://www.lazyweb.com/company/guitartuna). Apprank: Yousician app (not GuitarTuna) ~$600K/mo, Aug 2026 — [Apprank](https://apprank.io/yousician-learn-play-guitar-3039). All low-to-medium confidence |
| **Fender Tune** (Fender Digital) | iOS, Android | Free (no IAP shown on either store) — [App Store](https://apps.apple.com/us/app/id1107017950) | **151,760 (4.79)** — [iTunes API](https://itunes.apple.com/search?term=fender+tune&entity=software&country=us) | 5M+ / 71.2K — [Play](https://play.google.com/store/apps/details?id=com.fender.tuner) | Funnel for Fender Play (60.6K US ratings) |
| **The Metronome by Soundbrenner** | iOS, Android | **Soundbrenner Plus**: SKUs $4.99, $7.99, $9.99 (monthly-range) and $39.99, $59.99, $79.99 (yearly-range) — [App Store](https://apps.apple.com/us/app/id1048954353) | 48,361 (4.71) — [iTunes API](https://itunes.apple.com/search?term=soundbrenner&entity=software&country=us) | 5M+ / 90.6K — [Play](https://play.google.com/store/apps/details?id=com.soundbrenner.pulse) | Company: "7 million downloads" (blog post, undated) — [Soundbrenner blog](https://www.soundbrenner.com/blog/the-metronome-app-by-soundbrenner-updates); App Store says "trusted by more than 10 million musicians". The About page reportedly claims "90 million monthly active users" — [Soundbrenner About](https://soundbrenner.com/pages/about-us); this conflicts badly with 5M+ Play installs and is probably a misreading or marketing reach. Do not use |
| **Pro Metronome** (Polybeat / EUMLab) | iOS, Android | **Pro Version $3.99 one-time**; Annual $3.99, Monthly $0.99; feature unlocks $0.99–1.99 — [App Store](https://apps.apple.com/us/app/id477960671) | 20,534 (4.71) — [iTunes API](https://itunes.apple.com/search?term=pro+metronome&entity=software&country=us) | 5M+ / 22.3K — [Play](https://play.google.com/store/apps/details?id=com.eumlab.android.prometronome) | — |
| Smart Metronome & Tuner (Ihara) | iOS | Free + IAP | 61,614 — [iTunes API](https://itunes.apple.com/search?term=soundbrenner&entity=software&country=us) | — | — |
| Metronome Pro (MWM) | iOS, Android | Free + IAP | 22,570 — [iTunes API](https://itunes.apple.com/search?term=pro+metronome&entity=software&country=us) | 1M+ / 22.9K — [Play](https://play.google.com/store/apps/details?id=com.mwm.metronome) | — |
| Guitar Tuner – Simply Tune (Simply) | iOS | Free + IAP | 105,909 — [iTunes API](https://itunes.apple.com/search?term=guitartuna&entity=software&country=us) | — | — |

### Inferences
- Free tuners from big brands (Fender, Yousician) and $4 metronome unlocks put a ceiling on what bundled instruments can add to SongNook's price. Their real value is keeping musicians in one app.
- The Yousician revenue estimates differ roughly 30× across trackers. This illustrates why private-tracker revenue should be presented as ranges with low confidence.

### Gaps
- No official 2025–26 Yousician or GuitarTuna MAU. A 20M+ MAU figure (Yousician + GuitarTuna combined) dates from 2021 and has not been refreshed, per search-result summaries; no primary source was retrieved.
- Soundbrenner's MAU claim is unreliable as captured. The primary page was not fetched directly.
