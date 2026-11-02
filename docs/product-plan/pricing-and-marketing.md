# SongNook — pricing & marketing plan (the living record)

Read this before touching prices, the Pro sheet, Pro gates, the free month, store or
legal copy, or anything we host (Send, word-tool workers, future cloud). When the
founder decides something here, update this file in the same change and add a line to
the decision log (§10). Older plans (`phase-6-monetization.md`, the 2026-10-19 founding
price) are history; where they disagree with this file, this file wins.

Last reviewed: 2026-11-02.

## 1. Prices

| Plan | Price | Pro sheet line | Store product |
|---|---|---|---|
| Yearly | **$24.99** | "About $2 a month, billed yearly" · tag "Best value" | `songnook_pro_yearly` |
| Monthly | **$3.99** | "Cancel anytime" | `songnook_pro_monthly` |
| Lifetime | **$59.99 for 90 days after release → $79.99** | "Pay once. Launch price until {date}, then $79.99." · after: "Pay once." | `songnook_pro_lifetime` (non-consumable) |

- Subscription group "SongNook Pro"; RevenueCat entitlement `songnook_pro`, offering
  `default` (`$rc_annual`, `$rc_monthly`, `$rc_lifetime`). Public SDK keys live in
  `src/services/billing.ts` on purpose (OTA bundles skip EAS env vars).
- The sheet shows store prices in the buyer's currency once RevenueCat answers; the
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
   RevenueCat promotional entitlements for anyone missed).

## 3. Free and Pro

The split lives in code: `src/domain/proCatalog.ts` (numbers and switches) and
`src/domain/proGating.ts`. Do not restate limits elsewhere. Summary as of 2026-11-01:

- **Pro:** workspaces beyond 3; layers beyond 1 per take; pitch, pins, analysis and
  Step up (plain loop and speed are free); editor parts beyond 1 and its Speed & pitch
  tab; transpose, capo, chart books, setlists, stage reader (writing charts is free);
  PDF export; the whole Word Finder (its APIs cost money); Lyric Spark beyond 3 tries per
  game; Send beyond 3 links per 30 days; archive offload.
- `ALL_FEATURES_FREE = true` in `src/domain/entitlements.ts` until the paywall goes live
  (set `APP_STORE_RELEASE_AT` in the release commit).

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

1. Set `APP_STORE_RELEASE_AT` in `src/domain/freeMonth.ts` in the release commit. The
   lifetime launch price then ends 90 days later, and the sheet prints that date.
2. Put that end date in the founder's calendar: change `songnook_pro_lifetime` to
   $79.99 in App Store Connect and Play Console that day.
3. Flip `ALL_FEATURES_FREE` to false (`src/domain/entitlements.ts`).
4. Send server (`server/songnook-send`, deploy with `--config ./wrangler.toml`): set
   `PRO_FOR_ALL=false` and `APP_SEND_ENFORCED=true`, and
   `wrangler secret put REVENUECAT_SECRET_KEY`. Without this the browser and the free
   3 links stay open to everyone.

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
