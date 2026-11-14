# SongNook — pricing & marketing plan (the living record)

Read this before touching prices, the Pro sheet, Pro gates, the free month, store or
legal copy, or anything we host (Send, word-tool workers, future cloud). When the
founder decides something here, update this file in the same change and add a line to
the decision log (§10). Older plans (`phase-6-monetization.md`, the 2026-10-19 founding
price) are history; where they disagree with this file, this file wins.

Last reviewed: 2026-11-02.

## 1. Prices

| Plan | Price | Pro page line | Store product |
|---|---|---|---|
| Yearly | **$24.99** | "Billed once a year" · tag "Save 48%" (worked out from store prices) | `songnook_pro_yearly` |
| Monthly | **$3.99** | "Cancel anytime" | `songnook_pro_monthly` |
| Lifetime | **$59.99 for 90 days after release → $79.99** | "Pay once. Launch price until {date}, then $79.99." · after: "Pay once." | `songnook_pro_lifetime` (non-consumable) |

- Subscription group "SongNook Pro"; RevenueCat entitlement `songnook_pro`, offering
  `default` (`$rc_annual`, `$rc_monthly`, `$rc_lifetime`). Public SDK keys live in
  `src/services/billing.ts` on purpose (OTA bundles skip EAS env vars).
- The page shows store prices in the buyer's currency once RevenueCat answers; the
  printed dollar prices are the fallback. "then $79.99" shows only beside the dollar
  launch price; other currencies name the end date alone (`ProUpsellSheet.subOf`).
- **Lifetime launch window (founder, 2026-11-01): a fixed date, 90 days after the App
  Store release** (`LIFETIME_LAUNCH_DAYS`, `lifetimeLaunchEndsAt` in
  `src/domain/freeMonth.ts`). Before `APP_STORE_RELEASE_AT` is set the sheet says
  "Launch price, later $79.99"; once it is set the sheet prints the end date; after the
  date it says "Pay once." and the printed fallback becomes $79.99. Chosen over a
  one-month window, which would have ended inside early users' free month (they hit no
  paywall, so they'd miss it), and over a per-person "during your free month" price
  (fairer, but the founder preferred one simple date).
- Monthly is about twice the yearly cost over 12 months on purpose: it steers people to
  yearly, which keeps payers longest.

**Why not $1 a month** (founder asked twice, 2026-10-19 and 2026-11-01). In RevenueCat's
data (115,000+ apps), low-priced apps turn fewer downloads into payers (1.4%) than
mid-priced (2.0%) or high-priced ones (2.8%), and earn about a sixth as much per payer
in year one. The step from free to paying is the barrier, not $1 against $2. Stories of
"$1 a month, 100,000 users, $100k a month" mean 100,000 *payers*, about 5 million users at
typical conversion; only ~4.6% of new apps reach even $10k a month within two years.
Our plan earns about twice the $1 plan per payer and only loses if it halves the number
of payers. Full research: `reports/SongNook market and pricing.md` (local, untracked).

**Where we sit:** Music Memos (Nomad) $24.99/yr · $3.99/mo · $49.99 lifetime; OnSong
$29.99/yr; Demo $39.99/yr · $99.99 lifetime; Dubnote $39.99/yr · $99.99 lifetime. We are
the friendly price at the bottom of the musician-app band without looking cheap.

## 2. Promises we must keep

These are written into the terms (`docs/terms-of-use.md`) or the app. Breaking one is a
trust problem, and some are legal ones.

1. **Lifetime covers the app's tools, not online storage** (founder, 2026-11-01). Lifetime
   unlocks every Pro tool in the app, including unlimited Send links, for as long as we
   offer SongNook. Services that keep work stored online (cloud sync) are not included
   and may be sold separately. Said in the terms only (founder, 2026-11-01): the Pro
   sheet and store descriptions don't mention cloud storage we don't offer, in an app
   whose point is that work stays on the phone. If cloud ever launches, be generous to
   lifetime buyers (e.g. a discount on the add-on). Never add a hosted, ongoing-cost
   service to lifetime without the founder.
2. **The $79.99 raise must really happen on the printed date.** The sheet shows the
   end date; on that day the founder changes the lifetime price in App Store Connect
   and Play Console by hand (the app cannot). An advertised raise that never comes can
   count as fake urgency (EU consumer law). If the plan changes, change the sheet
   (`pro.plans.lifetime.*`, all five languages) first.
3. **What someone paid never changes.** Raise prices for new buyers only.
4. **Lifetime is per store account.** Without accounts, a lifetime bought on iPhone does
   not unlock Android. The terms say so.
5. **Never locked:** recording, the library, lyrics, backup/export/restore, receiving
   through Send. A free user can fully use a parcel a Pro user sent (Pro tools are free on
   received ideas and books).
6. **The free month:** every Pro tool for 30 days, no card, once per device. When it ends
   nothing is lost; gates only stop creating new Pro things.
7. **TestFlight testers keep Pro** (installs that predate `APP_STORE_RELEASE_AT`, plus
   RevenueCat promotional entitlements for anyone missed). Decided from the free month's
   first-launch record in the Keychain (`services/freeMonthClock.ts`), never from a
   backup; "1" is stored once, "0" never. On iPhone it survives reinstalls, Erase
   everything and TestFlight → App Store. An Android reinstall or a new phone of either
   kind starts a new record: those testers need the promotional entitlement.

## 3. Free and Pro

The split lives in code: `src/domain/proCatalog.ts` (numbers and switches) and
`src/domain/proGating.ts`. Do not restate limits elsewhere. Summary as of 2026-11-14:

- **Pro (as built 2026-11-14, commits 485d8626 and 743c72a5):** workspaces beyond 2;
  layers beyond 1 per take (8 at most); speed, pitch and Step up in the player (a plain
  loop and pins are free, and a step back toward the original speed, key or capo always
  is); the editor's Speed & pitch tab (trimming and cutting into any number of parts are
  free); transpose, capo, making chart books and setlists (writing charts is free; a book
  that exists always opens in the stage reader); chart PDF; Export for DAW; the whole
  Word Finder; a word game beyond 1 try of each game (a spark left with nothing written
  gives its try back); Send beyond 1 link per 30 days. Tempo detection (hidden) and
  archive offload (unreachable) are gated in code but named on no list of Pro tools.
- **Marked in the app:** every one of those doors wears the Pro mark for someone it
  would stop (`common/ProMark`, rule in CLAUDE.md).
- The paywall is on in code since the release commit of 2026-11-11:
  `ALL_FEATURES_FREE = false` (`src/domain/entitlements.ts`) and
  `APP_STORE_RELEASE_AT = 2026-11-11` (`src/domain/freeMonth.ts`). It reaches people
  only through a new build or an update, and an update from main turns it on for
  every 1.0.0 build already installed. The lifetime launch price ends 2027-02-09.

## 4. Costs and margin

Measured against current prices (2026-11-01, sources in the Send report:
https://claude.ai/artifact/W99F3YEyLhs5Z5M4zBiSRK).

- **Net per payer:** a yearly subscriber brings about **$1.77 a month** after the stores'
  15% (US; about $1.48 in the EU, where prices include VAT). Apple takes 10% on a
  subscription after its first year. Monthly ≈ $3.39. Lifetime ≈ $51 once.
- **Hosting per payer:** about **20–30 cents a month**, mostly Expo app-update charges for
  the free users each payer carries ($0.005 per active user per month). Send storage is
  pennies: about $0.004 per GB sent (Cloudflare R2, 7-day hold, free downloads).
- **At 2.5% paying:** 10k active users ≈ $443/mo net, ~80% kept; 100k ≈ $4.4k, ~84%;
  1M ≈ $44k, ~87%. Break-even on fixed costs ≈ 20 yearly subscribers.
- **Biggest line:** Expo updates. Its free plan stops at 1,000 active users, so launch
  needs Starter ($19/mo). Past ~10k users, consider a self-hosted update server.
- **Capped APIs:** Hebrew word finder (Claude Haiku) has a daily breaker ≈ $6/day.
  English uses Datamuse, free to ~100k requests a day (verify; cache harder at scale).
- **Rule for new hosted features:** before it ships, write its cost per active user per
  month here and compare it with $1.77. Anything that grows forever (storage) needs a cap
  from day one.

## 5. Cloud storage (future, not built)

The one real cost risk: it is permanent and grows. Not decided; the working shape is:

- Sell it as storage. A small amount may come with yearly Pro (5 GB ≈ 7 cents a month);
  a "Pro + Cloud" plan around $39.99/yr with ~50 GB (worst case 75 cents a month against
  ~$2.80 net). Lifetime buyers add cloud as a small yearly extra.
- Needs sign-in so a library can follow someone to a new phone. That is when accounts
  arrive (also fixes lifetime across platforms).

## 6. SongNook Send: what we may claim

- **End to end (shipped 2026-11-01, docs/product-plan/send-e2e-encryption.md):** builds
  with the native seal and the web page encrypt every parcel on the sender's device; the
  key rides only in the link's #k=. True to say there: "Only people with the link can open
  it, not even SongNook." The app shows it only where it seals (`sendSheet.sealedHint`,
  `helpContent.send.sealedThesis`); older builds keep the old lines because they still
  send unsealed until they update.
- **Still never say:** "unhackable", "100% secure", that we can't see that a parcel exists
  or its size, or anything about a link someone has leaked.
- **Never:** any absolute.
- Share-menu lines (approved 2026-11-01, `shareExit.*`): Send = "A link anyone can play.
  SongNook opens it with everything." SongNook file = "A copy to keep or move yourself.
  Opens in SongNook."
- Shipped 2026-11-01: browser pairing (paid users send from a computer), Pro and the
  free 3 links checked on the server (dormant until the paywall), Delete link.

## 7. Growth levers (planned, none decided)

- **Introductory offer:** first year $14.99, then $24.99. Low-price pull at launch
  without a permanently low price.
- **Regional prices:** lower in Brazil, Mexico, India (fits Portuguese and Spanish).
- **RevenueCat Experiments after launch:** $19.99 vs $24.99 yearly for new users.
- **Trial check:** if the no-card month converts under ~1% after 2–3 months, test a
  7-day store trial on yearly at the paywall.
- **Later tiers:** a band/group plan (shared setlists and charts, seats) is the proven
  next step in this niche; stem export belongs inside Pro.

## 8. Positioning and voice

- North star: **a quiet place to finish creative work.** We charge for finishing
  (layers, sketches, charts with setlists, export), never for capture.
- What we stand on: your work stays on your phone and stays yours; no ads; no AI
  training; it will last (Spire, Take and Apple's Music Memos were abandoned, and
  musicians remember).
- The real rival is free Apple Voice Memos, not other paid apps.
- Store and privacy truth: `docs/product-plan/store-truth.md` (privacy label = purchase
  history + sent user content, not linked, no tracking); listing copy:
  `docs/product-plan/store-listing.md`.
- Copy follows CLAUDE.md: calm, no exclamation marks, no marketing inside the product.

## 9. Open decisions (founder)

- Introductory offer: yes or no.
- Regional prices: which countries.
- Cloud plan shape and price.

Settled since: Send links last 7 days with a Delete link; browsers pair with a typed
code (accounts wait for cloud); post-encryption Send copy is in §6.

## Release-day checklist (pricing)

1. DONE 2026-11-11 (code only): `APP_STORE_RELEASE_AT` is 2026-11-11 in
   `src/domain/freeMonth.ts`. The lifetime launch price ends 90 days later,
   2027-02-09, and the sheet prints that date. If the app goes on sale much later,
   move the date in that one line before the build.
2. Put 2027-02-09 in the founder's calendar: change `songnook_pro_lifetime` to
   $79.99 in App Store Connect and Play Console that day.
3. DONE 2026-11-11 (code only): `ALL_FEATURES_FREE` is false
   (`src/domain/entitlements.ts`). No build or update has carried it yet.
4. Send server (`server/songnook-send`, deploy with `--config ./wrangler.toml`): set
   `PRO_FOR_ALL=false` and `APP_SEND_ENFORCED=true`, and
   `wrangler secret put REVENUECAT_SECRET_KEY`. Without this the browser and the free
   3 links stay open to everyone. Then open `https://send.songnook.app/healthz/billing`:
   it must say the key is accepted, or every subscriber is treated as free on Send.
   Deploy only once the App Store listing is live: the Send page's iOS button now
   points at it.

## 10. Decision log

- 2026-10-19 — Pro ships in v1; 30-day no-card free month; founding price $11.99/yr
  (superseded 2026-10-24).
- 2026-10-23 — Free/Pro split confirmed; received parcels use Pro tools free; Send 3
  links per 30 days free.
- 2026-10-24 — Prices: $24.99/yr, $3.99/mo, lifetime $59.99 launch → $79.99 later.
- 2026-10-25 — Store-truth decisions D1–D8; word games 3 tries per game for good.
- 2026-11-01 — Founder asked whether $1/mo would sell more; prices kept (§1).
  Lifetime scope written into the terms and Pro sheet: app tools and Send included,
  future online storage not. This file created as the single record.
- 2026-11-01 — Lifetime launch price ends 90 days after the App Store release (fixed
  date, printed on the sheet), not one month: a month would end inside early users'
  free month.
- 2026-11-01 — Cloud exclusion stays in the terms only; the Pro sheet line about it
  was removed and the store description stays "Every Pro tool, pay once." (founder:
  don't raise a question about cloud storage we don't offer).
- 2026-11-01 — Send: links stay 7 days, Delete link added, browsers pair with a typed
  code; parcels sealed end to end from iOS build 16 / Android vc 14.
- 2026-11-02 — Founder asked whether to drop lifetime while cloud is unsettled; kept.
  It costs pennies per buyer (everything is on the phone), cloud is already outside it
  in the terms, rivals all offer one, and subscription-averse musicians buy nothing
  without it. Revisit at the 90-day launch-price date with real numbers.
- 2026-11-02 — Data-safety audit fixes (founder: "start fixing"): a chart book that
  exists always opens in the stage reader (making books stays Pro; 11-M3). Founding is
  decided from the Keychain first-launch record and never stored as "0" (11-H1). The free
  month's clock ignores a single forward jump of more than 2 days until a later launch
  confirms it (07-M4).
- 2026-11-11 — Launch audit, A fixes (founder: "everything else from the A's"). The Pro
  sheet carries a renewal line under Get Pro (`pro.renewNoteIos` / `renewNoteAndroid`:
  "Yearly and monthly renew until cancelled. Cancel in your App Store account.", Apple
  3.1.2). Someone who already has Pro sees "You have Pro", their renewal date or
  "Lifetime. Paid once." or "Founding member. Yours for good.", and Manage subscription;
  plans stay behind "See plans". The Send server re-asks RevenueCat after 60 seconds
  for a "not Pro" answer (a "Pro" answer still holds 6 hours), so a new buyer is not
  refused, and `/healthz/billing` reports a missing or refused key. The unused
  `processing` background mode is gone from app.json. Founder waived A2 (founding
  members are not Pro on the Send server): there were no real testers.
- 2026-11-11 — Release commit (audit A6): paywall on in code, release date 2026-11-11,
  so the $59.99 lifetime price ends 2027-02-09 (change it to $79.99 in both stores that
  day). The Send page's iOS button points at the App Store listing in `wrangler.toml`;
  not deployed, and the server flags (`PRO_FOR_ALL`, `APP_SEND_ENFORCED`) are untouched,
  until the founder says so.
- 2026-11-12 — The Pro surface is a full-screen page (founder: "the get pro deserves a
  full screen", then "Yes" to the proposal). It closes by a ✕ alone: no "Not now" or
  "Done" link. What Pro adds is five one-line bullets (`PAYWALL_ROWS`, five rows), the
  privacy line stays, and plans, Get Pro, the renewal line and Restore · Terms ·
  Privacy sit on the same page. The per-month figure under Yearly is gone ("About
  $2.08 a month"); Yearly says "Billed once a year" and carries "Save N%", worked out
  from the store's own yearly and monthly prices (48% at US prices, the printed
  fallback). No price changed: Yearly stays $24.99. The layers line says "Up to 8
  layers on a take", because a take holds eight (`MAX_LAYERS_PER_TAKE`). JS only, so
  it can ship by update; not published until the founder says so. A "SongNook Pro" row
  in the side menu was offered and is not decided.
- 2026-11-13 — Cutting in the editor is free (founder: "Trimming to edit should not be
  pay walled", then "Agreed"). A free user marks any number of parts in one edit,
  Split included; only the Speed & pitch tab stays Pro (`full-editor` keeps `pro: true`
  and loses its `freeLimit`). Built, not published: build 19 is in App Store review,
  so it ships by update after approval and before the founder presses Release. The
  Pro page's line "Practice tools and the full editor" is still true (Speed & pitch)
  and gets reworded with the page's new order, which the founder has not picked yet
  (proposed: layers, words, practice with speed and pitch, charts, no limits).
- 2026-11-14 — The split after the feature audit (`feature-audit-2026-11-13/`, founder's
  answers in `founder-answers-2026-11-14.md`). Founder agreed to all nineteen decisions on
  the ledger and then to the revised package ("i agree with your revised suggestions
  regarding pro"). **Agreed, NOT built yet, and nothing ships before Apple approves:**
  pins free everywhere · Speed in the player becomes Pro (loop stays free; Keep then holds
  only a loop for a free person) · going back toward the original pitch, capo or key is
  always free · Step up stays as built (nobody free runs a drill) · the whole Word Finder
  stays Pro (the "Rhymes free" idea was dropped) · word games: 1 try of each game for
  good, counted only once something is written, deleting gives none back · Send: 1 link
  per 30 days (was 3; the server's `FREE_LINKS`, the terms, the Send error text and the
  web sender page all state the number) · workspaces: 2 free (was 3), collections
  unlimited, the export-and-import workaround is left alone · Export for DAW becomes Pro ·
  chart PDF stays Pro and the terms' "export is never locked" gets corrected · tempo
  detection and archive offload come off every list of Pro tools · the layer mixer, tempo
  changes, tuner, metronome, calibration, video import, automatic backup, playlists, Shelf,
  Revisit, Activity and the stage reader stay free. Rule behind it: free is capture,
  organise, write, play back and back up, for good; Pro is the tools that change or finish
  the song, and in each Pro group the most-used tool is Pro. Founder then asked a third
  time about $1 a month and about gating Revisit and Activity; advice given was to keep
  both as they are (see "Why not $1 a month" in §1); their answer is pending.
- 2026-11-14 — Built the same day (485d8626 the split, 743c72a5 the Pro marks), not
  published. The founder also asked that Pro doors be marked in the app itself; they now
  are. Prices and free Revisit / Activity confirmed ("okay. yes."). Still to approve: the
  reworded Pro page (outcomes, what stays free), the end-of-free-month note that names the
  tools a person used, and the two changed sentences in the terms (allowances; export).
  The terms and the Send server (`FREE_LINKS = 1`) are changed in the repo only, not
  deployed. Ship order: after Apple approves, with the founder's yes, before Release.
- 2026-11-14 — The Pro page's wording and order, approved by the founder ("Yes"). Each
  line is the result, then the tool, most useful first: Write your way out of a block
  (Lyric Spark, Word Finder) · Practice tools · Take it to the stage · Share it the way
  you marked it · Add a harmony. Then "Also with Pro: unlimited workspaces and Export for
  DAW." and "Free for good: recording, your library, lyrics, charts, backup." The order is
  judgement (how often a songwriter reaches for each), not data. Founder's asks behind
  it: name "Practice tools"; sell Lyric Spark as the way out of a block, not "word
  games"; say that marks travel with a share so the band sees what you mean (true in
  their SongNook, not in a browser, so the line says "in their SongNook"). Five languages,
  written by Claude; Hebrew wants the founder's read. Built 6b62d83f + the reorder, not
  published. Still open: the end-of-free-month note naming the tools a person used
  (needs local use counts), and the two terms sentences.
- 2026-11-14 — Terms: the founder approved the two changed sentences ("Yes"): what is
  never locked, with "your work can always leave the app as audio, text and SongNook
  files" in place of "export ... never locked"; and "one SongNook Send link a month and
  one try of each word game". In `docs/terms-of-use.md` and the built legal page; NOT
  deployed, and the terms' date line changes on the day they go live. The founder also
  handed all translations to Claude ("ill rely on you for all the translations"): the
  Pro page, the Pro mark and the Send limit sentence are in all five languages, and the
  Hebrew Pro page was checked in the simulator (right-to-left, mixed Latin names).
- 2026-11-14 — "Used in your free month" (founder: "Yes"). The Pro page names up to three
  Pro tools a person used during the free month, most used first, as one line under the
  privacy promise ("Word Finder 14 · Layers 6 · Practice tools 3"). A list, not the
  sentence first drafted: a sentence needs different grammar for every count in every
  language. A use is a sitting (one group counts once per 30 minutes), counted only
  during the free month, never for a Pro or founding member. Counted and kept on the
  phone (`services/proUse.ts`): never sent, not in the library, in no backup, parcel or
  export, so the privacy label does not change. To keep the prices in view the page's
  two quiet lines ("Also with Pro", "Free for good") now sit under the prices, not above
  them. Built, in five languages, not published.
- 2026-11-14 — First Pro line reworded (founder: "be more straight", and Lyric Spark is
  exercises you work through, not a tool that writes lines for you): "Lyric Spark gives
  you writing exercises to work through when you're stuck. The Word Finder finds rhymes,
  synonyms and more." Five languages. Rule for any copy about Lyric Spark: exercises
  the person does, never lines the app produces.
- 2026-11-14 — Layers line reworded so it is not only for singers (founder: "make it
  clear that it can be another instrument as well"): "Add another part. A harmony, a
  second guitar, a bass line. Up to 8 layers on one take." Five languages.
- 2026-11-14 — Unlimited workspaces moved from the small line into the sharing line
  ("Unlimited Send links and workspaces."); the small line is now "Also with Pro: Export
  for DAW." Founder asked where workspaces had gone, then "Yes". Five languages.
- 2026-11-14 — Workspaces get their own line (founder: "it should be separate from the
  others"): "Room for every project. Unlimited workspaces, so your own songs, each band
  and each album stay apart." Sixth line, between sharing and layers; the sharing line
  ends "Unlimited Send links." again. Six lines push the prices just below the first
  screen when the "used in your free month" line shows. Five languages.
