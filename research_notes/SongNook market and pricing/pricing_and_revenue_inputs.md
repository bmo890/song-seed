# Pricing Strategy Evidence and Revenue-Modeling Inputs for SongNook (low-priced freemium music app)

Research date: 2026-10-19. Plan under evaluation: Free + Pro at $11.99/yr (about $1/mo), $1.99/mo, about $29.99 lifetime, 30-day full access with no card (reverse trial).
Source-quality note: the strongest mobile data is RevenueCat's State of Subscription Apps (SOSA) 2025 (published March 2025, 2024 data, 75k+ apps) and SOSA 2026 (published around March 2026, 2025 data, 115k+ apps, $16B revenue). Full PDFs (with Music category breakouts) are gated; figures below come from RevenueCat's public preview page or a SaaStr summary. Opt-in vs card trial and reverse-trial numbers are mostly B2B SaaS, not mobile, and are flagged as such.

## 1. Comparable prices and the Music/creativity price band; is $0.99-$1.99/mo unusually low, and what low prices do to conversion, churn and value

### Takeaway
SongNook's prices are far below the market: about a third of the median annual subscription price ($34.80 in SOSA 2026) and about a quarter of the typical $7.99-$9.99 monthly band. RevenueCat data shows low-priced apps get roughly half the download-to-trial rate and 5-7x lower first-year LTV per payer. They do convert trials better and keep subscribers longer (yearly retention 53.7% vs 48.3%; monthly 22.5% vs 12.2%).

### Cited Findings
**Market price bands (data)**
- SOSA 2026: typical price bands are $4.99-$6.99 weekly, $7.99-$9.99 monthly, and $29.99-$39.99 annual. The median annual price rose to $34.80 from $31.60. North America's annual median is $39.99 vs $18.32 in India/SE Asia. — [SaaStr summary of RevenueCat SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- SOSA 2025: an expert contributor puts the median consumer subscription price at $29.99/yr, with the upper quartile almost 3x higher. Medians were flat year on year; P75 and P90 rose slightly. — [RevenueCat SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)

**Comparable apps (data, store or vendor listings; check before publishing)**
- Hookpad (Hooktheory, songwriting): free tier; Standard $7.99/mo or **$199 lifetime**; Aria AI add-on $14.99/mo. — [Hooktheory pricing](https://www.hooktheory.com/pricing)
- Demo: Songwriting Studio (the closest direct comparable): Demo+ $5.99/mo or $39.99/yr, with a 3-day free trial on the yearly plan. — [App Store listing](https://apps.apple.com/US/app/id1563264178)
- BandLab Membership: $14.99 for 1 month, $149.99 for 12 months (third-party aggregator, may be stale). — [AppPricingLab](https://apppricinglab.com/app/apple/968585775)
- Ultimate Guitar: $9.99/mo or $59.99/yr in the US App Store (€9.99 / €59.99 in Germany). — [App Store listing](https://apps.apple.com/app/apple-store/id357828853); [UG help center](https://help.ultimate-guitar.com/en/articles/6741579-ultimate-guitar-subscription-cost-a-comprehensive-guide-to-pricing)
- Hum (songwriting notes + audio, Just Hum LLC): historically $1.99 paid upfront plus about $30/yr for full features. This comes from an old company profile and is unverified as current. — [Gust profile](https://gust.com/companies/justhum)
- Songwriter's Pad: $9.99 app with $1.99 / $3.99 / $9.99 monthly tiers (third-party blog, undated, possibly stale). — [Two Story Melody](https://twostorymelody.com/top-apps-for-musicians/)
- Low-price note-taking comparables: Bear Pro $2.99/mo or $29.99/yr, 7-day trial (vendor FAQ). — [Bear FAQ](https://bear.app/faq/features-and-price-of-bear-pro/). Drafts Pro raised prices to $2.99/mo / $29.99/yr for new subscribers in 2021, then later cut the annual plan back to $19.99. The current monthly price is unclear ($1.99 or $2.99 depending on source). — [Drafts forum 2021](https://forums.getdrafts.com/t/drafts-pro-price-change-coming-jan-1-2021/9271); [Drafts forum, $19.99/yr](https://forums.getdrafts.com/t/drafts-pro-now-only-19-99-usd-per-year/10898)
- Mass-market voice recorder apps run aggressive pricing, e.g. $6.99/week, $9.99/mo, $99.99/yr (single listing cited by a design-analysis site). — [Screensdesign voice memo apps](https://screensdesign.com/categories/voice-memo-apps/)

**Effect of low price (data, RevenueCat)**
- Download-to-trial: high-priced apps 9.8% vs low-priced 4.3% (SOSA 2025); 8.9% vs 4.4% (SOSA 2026). — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025); [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Day-35 download-to-paid: high-priced 2.66% vs low-priced 1.49% (SOSA 2025). — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)
- Trial-to-paid: lower-priced apps 47.8% vs high-priced 28.4% (SOSA 2025, expert contributor). — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)
- Year-1 retention by price (SOSA 2025):
  - Yearly plans: low-priced 53.7% vs high-priced 48.3%.
  - Monthly plans: low 22.5%, mid 16.4%, high 12.2%.
  - [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)
- Realized first-year LTV per payer:
  - SOSA 2025: high-priced $55.21 median vs low-priced $8.08 (low-priced P90 $22.43).
  - SOSA 2026: $62.19 vs $10.69 overall; monthly plans $35.89 vs $6.67. — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025); [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Refunds: low-priced plans 2.2%; freemium apps 3.4% vs hard paywall 5.8%; overall payers 2-5%. — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)

**Opinion and interpretation**
- Airbridge, citing SOSA 2025, attributes the gap to buyer intent: cheap prices attract a broader but less committed audience. — [Airbridge](https://airbridge.io/en/blog/app-pricing-test)
- RevenueCat frames a cheaper recurring plan as trading lower revenue per user for higher conversion and lower churn (conceptual, not measured). — [RevenueCat blog](https://www.revenuecat.com/blog/how-to-think-about-recurring-revenue/)
- RevenueCat advises judging price tests on full-lifecycle LTV, not first conversion. — [RevenueCat price testing](https://www.revenuecat.com/blog/engineering/price-testing-for-mobile-apps.md)

### Inferences
- $11.99/yr sits below the bottom of the common annual band ($29.99-$39.99), and $1.99/mo is about 4-5x below the common monthly band. Among direct songwriting comparables (Demo $39.99/yr, Hookpad $7.99/mo, Ultimate Guitar $59.99/yr) it is the cheapest by a wide margin. Only legacy indie note apps (Drafts $19.99/yr) come close. "Unusually low" is fair.
- The "high vs low priced" split in RevenueCat is relative and its cut-offs are not public. Even so, $11.99/yr is almost certainly in the "low" bucket. The low-priced LTV medians ($8-$11 per payer in year 1) are a reasonable sanity anchor for SongNook's net first-year revenue per payer (see §4 arithmetic).
- Low price likely helps retention and lowers refunds, but it does not raise the share of downloads that pay. RevenueCat shows low-priced apps convert fewer downloads, not more. Modeling a high conversion rate to compensate for the low price is therefore not supported by the data.
- SOSA 2025 and SOSA 2026 low/high LTV figures are on slightly different bases, so do not compute growth from them.

### Gaps
- Music-category medians (price, conversion, retention) are in the gated full SOSA PDFs; neither public preview included them.
- Current verified prices for Moises, GuitarTuna, BandLab, Songwriter's Pad and Hum were not confirmed from primary listings.
- No controlled experiment specifically testing $0.99-$1.99/mo against higher prices on perceived value was found.

## 2. Lifetime purchase options: prevalence, typical multiple, revenue share, pros and cons

### Takeaway
About 18-24% of subscription apps also sell a lifetime option. Lifetime is usually priced at 5-12x the annual price, with observed examples from 2.1x to 11.5x. SongNook's $29.99 lifetime is about 2.5x annual, at the very bottom of that range. No public source gave lifetime's share of revenue.

### Cited Findings
- In most categories, about 18-24% of apps offer both a subscription and a lifetime option. Photo & Video leads, with Education and Travel also high; Business is the outlier. — [RevenueCat, "Lifetime subscriptions", Nov 12 2025](https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md)
- Pricing multiples:
  - Typical lifetime price is 5-12x annual. The article suggests testing 5x, 8x and 12x.
  - Examples:

    | App | Annual | Lifetime | Multiple |
    |---|---|---|---|
    | Calm | $79 | $399 | 5.0x |
    | Jumpspeak | $69 | $249 | 3.6x |
    | Moonly | $28.98 | $59.98 | 2.1x |
    | Placify | $14.99 | $49.99 | 3.3x |
    | Fiit | £119.99 | £375 | 3.1x |
    | Waking Up | $129.99 | $1,500 | 11.5x |

  - [RevenueCat](https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md)
- Constraints and pros/cons, per RevenueCat:
  - Lifetime is a non-consumable purchase on the App Store, so it cannot carry a store free trial.
  - Pros: upfront cash, locking in users who would churn, use in promos and referrals, differentiation from larger competitors.
  - Cons: can cannibalize loyal high-value subscribers, makes upsells harder, messy migration from a subscription (double charges, refunds), ongoing costs can outrun lifetime revenue, and investors prefer recurring revenue.
  - RevenueCat recommends tracking the lifetime vs subscription revenue mix but publishes no benchmark. — [RevenueCat](https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md)
- Hybrid adoption: more than 35% of apps mix subscriptions with consumables or lifetime purchases (Gaming 61.7%, Social & Lifestyle 39.4%). This counts apps, not revenue. — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)
- Adapty (16k+ apps): one-time and lifetime purchases grew from 6.4% to 10.3% of monetization models between 2023 and 2025. This is a share of models, not revenue, and is secondhand. — [Airbridge summary](https://www.airbridge.io/en/blog/should-you-offer-a-lifetime-subscription)
- Music comparable: Hookpad sells lifetime at $199 against $7.99/mo, about 25 months of the monthly price. — [Hooktheory](https://www.hooktheory.com/pricing)
- Indie case: one developer's app portfolio (about 120k downloads, about $50.9k revenue in the year) included lifetime purchases; $3,012 MRR came from 3,630 active subscriptions. This comes via search snippet because the page was blocked (HTTP 403). — [Indie Hackers](https://www.indiehackers.com/post/50-000-revenue-in-one-year-0276d6a7df)

### Inferences
- At $29.99, lifetime equals 2.5 years of the annual plan. Low-priced yearly plans keep about 54% of subscribers after year 1, so expected subscription revenue over 2.5 years from an annual buyer is well under $29.99. That means lifetime is unlikely to cannibalize revenue at this ratio and may raise cash per buyer.
- The cost-side risk RevenueCat flags (ongoing costs outrunning lifetime revenue) is small for an on-device app. It grows only if cloud features (sharing, backup) become meaningful per-user costs; see §6.
- If SongNook later wants to raise prices, a low lifetime price creates a large, permanent cohort of non-paying Pro users. Pricing lifetime at 4-5x annual ($49.99-$59.99) would sit nearer the observed examples.
- Modeling input (assumption, not sourced): no benchmark exists, so treat lifetime share of gross revenue as a scenario variable, for example 10-30% in year 1.

### Gaps
- No public source gave lifetime's share of revenue or of payers for any category.
- No data on lifetime uptake when lifetime is priced below 3x annual.

## 3. Reverse trials / no-card free periods vs opt-in store trials; typical lengths (7 vs 14 vs 30 days)

### Takeaway
On mobile, the standard "trial" is a store trial that requires payment details and converts automatically unless cancelled. Longer trials convert better: 17-32 day trials have a 42.5-45.7% median trial-to-paid rate vs about 25-30% for trials of 4 days or less. A no-card reverse trial has no mobile benchmark. It should be modeled as freemium (about 2% download-to-paid) with a possible uplift. SaaS evidence suggests reverse trials beat plain freemium by 10-40%, but convert far below card-required trials.

### Cited Findings
**Mobile store trials (data)**
- Trial length vs conversion:
  - 17-32 day trials: 45.7% median trial-to-paid vs 26.8% for shorter trials (SOSA 2025).
  - 17-32 day trials: 42.5% vs 25.5% for trials of 4 days or less, a 70% lift (SOSA 2026).
  - [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025); [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Trial-length usage:
  - 52% of 2024 trials ran 5-9 days.
  - The share of trials of 4 days or less rose from 42% to 46.5% (2025 data).
  - [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025); [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Day-0 cancellation share by trial length: 3-day 55%, 7-day 39.8%, 14-day 35.7%, 30-day 31%. 50% of paid conversions happen on Day 0, and 82% of trial starts happen on install day. — [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth); [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)
- Adapty median trial-to-paid by length band (bands with no stated source; updated Mar 2026):

  | Trial length | Median trial-to-paid |
  |---|---|
  | 1-4 days | 30% |
  | 5-9 days | 45% |
  | 10-16 days | 44% |
  | 17-32 days | 45.7% |

  Adapty also says 51% of 30-day trial users cancel before the trial ends, vs 26% on 3-day trials. — [Adapty](https://adapty.io/blog/trial-conversion-rates-for-in-app-subscriptions/)
- Media & Entertainment median trial-to-paid is 43.8% (SOSA 2025). — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)

**Freemium vs hard paywall on mobile (data; a reverse trial ends in freemium)**
- Day-35 download-to-paid:
  - SOSA 2025: hard paywall 12.11% vs freemium 2.18%.
  - SOSA 2026: 10.7% vs 2.1%; top 10% of hard-paywall apps reach 38.7%.
- Day-14 revenue per install: $2.32 (hard paywall) vs $0.27 (freemium). Day 60: $3.09 vs $0.38.
- SaaStr says 12-month retention is "almost identical" for freemium and hard paywall, with no number given.
- [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025); [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)

**Opt-in (no card) vs opt-out (card) and reverse trials (SaaS data, not mobile)**
- FirstPageSage, 86 SaaS companies, Q1 2022-Q3 2025 (via Adapty):

  | Model | Visitor-to-trial | Trial-to-paid |
  |---|---|---|
  | Opt-in, no card | 8.5% | 18.2% |
  | Opt-out, card required | 2.5% | 48.8% |
  | Freemium | 13.3% | 2.6% |

  [Adapty](https://adapty.io/blog/trial-conversion-rates-for-in-app-subscriptions/)
- Elena Verna (growth advisor, opinion plus practitioner data):
  - Freemium free-to-paid is typically about 5%, vs 15-80% for trial models.
  - Reverse trials start users on a premium trial, often with no card, then drop them to free.
  - Moving freemium products to reverse trials produced 10-40% conversion increases (via Failory). — [Amplitude](https://amplitude.com/en-us/blog/reverse-trial.md); [Elena's Growth Scoop](https://www.elenaverna.com/p/reverse-trials-examples); [Failory](https://newsletter.failory.com/p/no-freemium)
- Third-party SaaS ranges (unverified secondary citations):
  - OpenView: reverse trials 7-21% conversion vs freemium 3-15%.
  - ChartMogul 2026: 4-6% is "good" for reverse trials.
  - Visionary Marketing (B2B SaaS, unverified method): reverse trial 38.4%, no-card opt-in 25.2%, card-required 60.4%.
  - [Userpilot](https://userpilot.com/blog/?p=13042); [Userpilot freemium](https://userpilot.com/blog/freemium-saas/); [Visionary Marketing](https://visionary-marketing.co.uk/blog/saas-free-trial-conversion-statistics-2026)
- Mobile context: store trials are opt-out by design, since Apple and Google auto-renew unless the user cancels. Global mobile trial-to-paid is about 25-37%. — [AppPricingLab playbook](https://apppricinglab.com/playbook/free-trial-conversion)

### Inferences
- SongNook's 30-day no-card full-access period is not comparable to the 42-46% "30-day trial" figures. Those are store trials with payment details captured, so non-cancellers convert automatically. The structurally comparable mobile benchmark is freemium: about 2.1-2.2% median download-to-paid by Day 35, and 1.49% for low-priced apps.
- A reverse trial plausibly lifts this by 10-40% (Verna, SaaS). That suggests a working range of about 1.5-3% of downloads paying, with 4-5% as an upper-quartile optimistic case. North America's freemium-inclusive upper quartile is 5.5% (SOSA 2025).
- A 30-day window suits a sketchbook app where value builds up through stored work, which drives loss aversion when Pro features lapse. Store-trial data also shows longer windows spread cancellations rather than front-loading them. The cost is delayed revenue and a 30-day lag before conversion can be measured.
- Option to model: run the 30-day reverse trial and also offer a store trial (e.g. 7 days) on the yearly plan at the paywall. Store trials with card capture convert much higher, but this adds UX weight.

### Gaps
- No mobile-app study comparing reverse trials (no card) with store trials or plain freemium was found.
- No data on 7 vs 14 vs 30 day trials for no-card designs specifically.

## 4. Monthly vs annual plan mix, retention benchmarks, first-year LTV for low-priced plans

### Takeaway
Annual plans retain far better than monthly: 44.1% vs 17.0% year-1 retention overall, and 53.7% vs 22.5% for low-priced plans. Low-priced apps realize only about $8-$11 per payer in year 1. Google Play loses nearly a third of cancellations to billing failures.

### Cited Findings
- Year-1 retention by plan (SOSA 2025): yearly 44.1% (down from 47.1%); monthly 17.0% (down from 18.8%); weekly 3.4%. Upper-quartile yearly is 60-75%. Barely 10% of monthly payers reach year two. — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)
- Low-priced plans retain better: yearly 53.7%, monthly 22.5%. — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025)
- First-year realized LTV per payer, low-priced apps: $8.08 median and $22.43 P90 (SOSA 2025); $10.69 (SOSA 2026); $6.67 on monthly plans (SOSA 2026). — [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025); [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Annual realized LTV per payer by region: North America $32 vs India/SE Asia $14; Western Europe $26.64 vs North America $26.07 on annual payer LTV. — [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Involuntary churn (billing failures) is about 31% of cancellations on Google Play vs 14% on iOS. — [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Revenue per install:
  - Day-60 median $0.31 overall.
  - By store: App Store $0.38 vs Google Play $0.14; North America $0.66 (iOS) vs $0.35 (Android).
  - By paywall: freemium $0.38 at Day 60 (SOSA 2026).
  - [SOSA 2025](https://revenuecat.com/state-of-subscription-apps-2025); [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)
- Revenue concentration (SOSA 2026):
  - Median MRR growth is 5.3%.
  - 17.3% of new apps reach $1k MRR within 2 years; 4.6% reach $10k MRR.
  - Apps launched in 2025 or later earn 3% of subscription revenue.
  - A guide citing RevenueCat says median monthly revenue after 12 months is under $50.
  - [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth); [theswiftk.it guide](https://theswiftk.it.com/blog/zero-to-10k-mrr-indie-ios-app)

### Inferences (worked arithmetic, author's own; not sourced data)
- Net per annual subscriber in year 1 at $11.99, assuming a 15% store fee (Apple Small Business Program or Google): about $10.19 before VAT. In VAT-inclusive storefronts (EU/UK), net is lower, about $8.50 at 20% VAT.
  - This lands close to the $8-$11 low-priced LTV medians, consistent with mostly annual buyers.
- Net per monthly subscriber at $1.99 and 15%: about $1.69/mo. Monthly year-1 survival is low (22.5% of low-priced monthly payers are still active at 12 months). A rough first-year value, assuming an average of 5-6 paid months, is about $8.50-$10. So monthly is roughly break-even with annual in year 1 but much worse after that.
- At $1.99 vs $11.99, the monthly plan is 2x the annual on a 12-month basis ($23.88). That standard anchor makes annual look like a strong deal, so expect annual to dominate the mix.
- Plan mix assumption (no direct data found): model 65-80% annual, 10-25% monthly, 5-20% lifetime, and treat these as scenario variables.
- Renewal: annual renewals at about 54% and 15% Apple fee after year 1 mean a year-2 net per original annual payer of about $5.50 (0.54 × $10.19).

### Gaps
- No published plan-mix shares (monthly/annual/lifetime) by category or price level were found.
- No music-category retention data in public material.

## 5. Indie developer case studies with real numbers (small music or note-taking apps)

### Takeaway
Verified indie music-app figures are scarce. The best available data points are an indie portfolio with about 120k downloads and about $51k/yr, a radio/podcast app with $168.8k trailing revenue on about 177k downloads, and Overcast's 2014 numbers. Market-level data shows most new subscription apps earn very little.

### Cited Findings
- Indie Hackers year-end report (circa 2023, multi-app portfolio, not music): about 120,000 downloads across iOS and Android, $50,861 revenue including lifetime purchases, $3,012 MRR, 3,630 active subscriptions (about $0.83/sub/month). Page fetch was blocked (403); figures come from the search snippet. — [Indie Hackers](https://www.indiehackers.com/post/50-000-revenue-in-one-year-0276d6a7df)
- Indie iOS radio/podcast app sale listing: $168.8k trailing-12-month proceeds, about 357k MAU, about 177k downloads. This is a broker listing, not audited. — [Acquire.com](https://app.acquire.com/startup/mwxj6lg9a8-music-app-for-ios-users-to-access-global-radio-stations-and-podcasts)
- Overcast (indie podcast player, 2014, old): 318,996 downloads and $164,134 revenue after Apple's cut. — [marco.org](https://marco.org/2015/01/15/overcast-sales-numbers)
- TalkNotes (indie voice-notes, AI transcription) reached $100 MRR in Sept 2023, launching with a low-priced one-time pass. — [Indie Hackers](https://www.indiehackers.com/product/talknotes)
- An AI song generator verified through RevenueCat on TrustMRR showed $414 in 30-day revenue. — [TrustMRR](https://trustmrr.com/startup/songer)
- Design-analysis site estimates for voice-memo apps (e.g. "$150k/month"; category average $112k/month) are unverified estimates, likely for aggressive weekly-paywall apps. Do not use them as benchmarks. — [Screensdesign](https://screensdesign.com/categories/voice-memo-apps/)

### Inferences
- A rough cross-check: the IH portfolio's revenue per download is about $0.42 ($50,861 / 120k), close to RevenueCat's freemium Day-60 RPI of about $0.31-$0.38. At SongNook's price level, about $0.15-$0.30 per download per year is a defensible base range: about 2% pay × about $10 net, plus some lifetime.
- Illustrative revenue (inference, using 2% download-to-paid and about $10 net per payer in year 1):

  | Downloads | Payers | Year-1 net revenue |
  |---|---|---|
  | 10k | ~200 | ~$2k |
  | 100k | ~2,000 | ~$20k |
  | 1M | ~20,000 | ~$200k |

  Range ±50% for 1-3% conversion.

### Gaps
- No verified 2023-2026 revenue disclosure was found for a small songwriting, voice-memo-for-musicians or music note-taking app.
- RevenueCat Sub Club podcast episodes with music-app founders were not reviewed.

## 6. Real costs: store commission, processor/RevenueCat fees, Cloudflare R2/Workers at 10k / 100k / 1M users

### Takeaway
For a small developer, store fees are about 15% on both stores: Apple's Small Business Program, or Google's subscription rate (now 10% service + 5% billing in the US/UK/EEA). RevenueCat is free under $2,500 monthly tracked revenue, then 1%. Cloudflare costs for a mostly on-device app are negligible: about $5/mo base, plus $0.015/GB-month for R2 storage with free egress.

### Cited Findings
**Apple App Store**
- Standard commission is 30% on a subscription's first year and 15% after the subscriber's first year.
- The Small Business Program (under $1M annual proceeds) cuts the first-year rate to 15%.
- [RevenueCat on SBP](https://www.revenuecat.com/blog/engineering/small-business-program.md); [SplitMetrics, Aug 2025](https://splitmetrics.com/blog/google-play-apple-app-store-fees/)

**Google Play**
- Subscriptions have been 15% from day one since Jan 2022. — [AppleInsider](https://appleinsider.com/articles/21/10/21/google-play-drops-all-subscription-commissions-to-15-from-day-one)
- Epic settlement (announced March 2026, rolled out June 30, 2026 in the US, UK and EEA):

  | Billing method | Service fee | Billing fee | Google total |
  |---|---|---|---|
  | Google Play Billing | 10% | 5% | 15% |
  | Alternative billing / web link | 10% | 0% | 10% + your processor's fee |

- Rollout: Australia, Japan and Korea by end of 2026; most other markets by Sept 2027. Qualifying apps get lower-rate programs from Sept 30, 2026. — [Adapty, Jun 25 2026](https://adapty.io/blog/google-play-billing-changes-subscriptions-fees); [TechCrunch, Mar 4 2026](https://techcrunch.com/2026/03/04/google-settles-with-epic-games-drops-its-play-store-commissions-to-20); [MacRumors, Jun 24 2026](https://macrumors.com/2026/06/24/google-play-store-fee-change/)
- Sources disagree on tier details: Shopifreaks describes a "flat 10% on the first $1M." Verify against Play Console. — [Shopifreaks](https://www.shopifreaks.com/google-starts-cutting-play-store-fees-to-a-flat-10-service-fee-on-the-first-1m-and-allows-external-payment-links-making-good-on-its-epic-games-settlement/)

**Web revenue**
- Web revenue is 3.2% of subscription-app revenue globally (4.9% in North America). — [SaaStr/SOSA 2026](https://saastr.com/the-top-10-learnings-from-revenuecats-state-of-subscription-apps-how-115000-mobile-apps-deliver-16b-in-revenue-whats-working-whats-quietly-killing-growth)

**RevenueCat**
- "Pay nothing for up to $2,500 in monthly tracked revenue," then 1% of MTR.
- Paywalls and web Funnels add 1% on conversions they drive.
- The page does not say whether the 1% applies to all MTR or only the excess.
- [RevenueCat pricing](https://www.revenuecat.com/pricing/)

**Cloudflare R2 and Workers**
- R2 Standard:
  - Storage $0.015/GB-month; Class A operations $4.50/M; Class B operations $0.36/M.
  - Free tier: 10 GB-month storage, 1M Class A and 10M Class B operations per month.
  - Egress is free.
  - [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Workers:
  - Free plan: 100k requests/day.
  - Paid plan: $5/mo minimum with 10M requests and 30M CPU-ms included, then $0.30 per million requests and $0.02 per million CPU-ms.
  - [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

### Inferences (illustrative cost model; assumptions stated, not sourced)
- Assumptions: share links ("SongNook Send") are the only cloud feature. 5% of MAU send one 20 MB parcel per month, retained for 30 days. Each parcel is about 5 Class A + 20 Class B operations and about 30 Worker requests.

  | Users | Sends/month | R2 storage | R2 cost | Workers | Cloud total |
  |---|---|---|---|---|---|
  | 10k | 500 | ~10 GB | free tier | free or $5 plan | $0-5/mo |
  | 100k | 5,000 | ~100 GB | ~$1.35/mo | ~150k req, inside $5 plan | ~$7/mo |
  | 1M | 50,000 | ~1 TB | ~$15/mo (+ ~$0.7 ops) | ~1.5M req, inside $5 plan | ~$20-25/mo |

- Cloud costs stay well under 1% of revenue in all scenarios. If cloud backup of full libraries were added (e.g. 500 MB per paying user), storage would be about $0.09/payer/yr, still small next to about $10 net revenue.
- Effective total take on $11.99/yr:
  - iOS, Small Business Program, year 1: 15% → $10.19.
  - Plus RevenueCat 1% once above $2.5k MTR: about $10.07.
  - EU/UK VAT (included in store price) reduces net further.
  - Apple year-2+ renewals stay at 15%. SBP already gives 15% in year 1, so renewals do not improve further for a small developer.

### Gaps
- Apple's and Google's official fee pages were not fetched directly; Apple fee figures come from developer-platform blogs.
- Whether RevenueCat's 1% applies to all MTR or only the excess above $2,500 was unclear from the pricing page.
- VAT/GST proceeds by storefront were not researched; use Apple and Google proceeds tables when modeling non-US revenue.
