# Phase 6 — Monetization (SongNook Pro)

> **2026-10-19 founder decisions (supersede the pricing, trial and timing below).**
> Research behind them: `reports/SongNook market and pricing.md` (comparable apps, RevenueCat
> benchmarks, 10k/100k/1M revenue scenarios). Summary: a low price does not raise the share of
> people who pay (low-priced apps ~1.4% of downloads vs ~2.8% high-priced), it lowers value per
> payer; the step from free to paying is the barrier, not $1 vs $2.
>
> - **Launch with Pro in v1** (not 2–4 weeks after): the free month makes it gentle.
> - **Free month (reverse trial):** every feature unlocked for **30 days**, no card, no store
>   trial. Quiet notes around day 25 and on the last day. When it ends nothing is lost: work made
>   with Pro tools still opens and plays; gates only stop creating new. Trial start persisted
>   where a reinstall can't reset it (iOS Keychain; Android best effort).
>   Mechanics (sweep fixes, 2026-10-23, `services/freeMonthClock.ts`): the month counts from the
>   **first launch of a build with the paywall live** (`paywallSinceAt`, written once when
>   `ALL_FEATURES_FREE` is false) or the install's first launch, whichever is later, so a v1.0
>   user gets a whole month after the flip, not a spent one. A high-water `lastSeenAt` beside it
>   means a device date set back does not reopen the month.
> - **Founding price** for everyone who subscribes in the launch window, kept for as long as they
>   stay subscribed: **$11.99/yr ("$1 a month")**, $1.99/mo, lifetime ~$29.99. No store trial on top.
>   **Superseded 2026-10-24 (founder):** launch at **$24.99/yr ("about $2 a month"),
>   $3.99/mo, lifetime $59.99 launch price → $79.99 later**, per the market research
>   (`reports/SongNook market and pricing.md`). No "founding price" on subscriptions;
>   pre-release installs (TestFlight testers) still keep Pro free.
> - **Later:** raise the price for NEW subscribers only (~$24.99/yr, $3.99/mo, lifetime ~$79.99),
>   decided from our own data via RevenueCat Experiments (price A/B for new users), not averages.
> - **Never lock:** recording, the library, lyrics, backup/export/restore, receiving through Send.
> - **Free/Pro split (founder confirmed 2026-10-19):** free = unlimited recording, 2 workspaces,
>   collections, player, marks, lyrics pad, trim, tuner, metronome, backup/export/restore, receiving
>   through Send, Shelf/Revisit/Activity; Pro = workspaces beyond 2, layers beyond 1, full editor
>   (parts, speed & pitch), practice suite, charts/transpose/capo/songbook/setlists/stage reader,
>   Lyric Spark + full word finder, sending through Send, PDF export.
> - **Founding testers get Pro free (founder confirmed).** Testers are iOS TestFlight only today
>   (no Android testers). Mechanism: an install whose first launch predates the App Store release
>   keeps Pro (the TestFlight → App Store upgrade keeps the same data), backed by RevenueCat
>   promotional entitlements for anyone that misses; no promo codes needed. Decided **once**, on
>   the first launch after `APP_STORE_RELEASE_AT` is set, and stored in the Keychain as
>   `songnook.founding` ("1"/"0"); from then on only the flag counts, so a restored backup's
>   `firstLaunchAt` cannot carry founding access and "Erase everything" cannot drop it
>   (`domain/freeMonth.ts decideFounding`).
> - **Owner paperwork first (longest lead):** App Store Connect Paid Apps agreement + banking/tax,
>   3 products in one subscription group (+ lifetime non-consumable); Google Play merchant account +
>   products; RevenueCat account (free under $2.5k monthly tracked revenue, then 1%).
> - **Code (after paperwork, needs a new store build):** react-native-purchases + keys via EAS
>   secrets, the 30-day free month, ProUpsellSheet refresh (real prices from offerings; Playfair is
>   retired, Lora only; restore + terms links), privacy policy + store privacy labels (RevenueCat
>   sees purchases, never recordings), sandbox QA (6.7).

**Effort:** ~2 weeks · **Timing:** 2–4 weeks **after** launch — ship v1.0 fully free, accumulate reviews and a usage baseline first. Launching a paywall and a new app simultaneously doubles first-impression risk. · **Dependencies:** launched app; Apple/Google merchant agreements signed (do the paperwork during the wait — it has lead time)

## Purpose

Flip the already-built entitlement seam into a real free/Pro split with billing, without ever gating the act of capturing music.

## Background you need — the seam is already built

- `src/entitlements.ts`: `ALL_FEATURES_FREE = true` short-circuits every check. `proEntitlement.set(bool)` + `useIsPro()` / `useHasProAccess(feature)` are live and subscribable. Typed feature keys currently: `"cloud-backup" | "auto-backup"` — **extend this union** with the new keys below.
- `src/components/common/ProGate.tsx`: renders children when entitled, `fallback` otherwise. Built, currently unused.
- `docs/admin-checklist.md` § "When billing / Pro accounts arrive" — repo policy: billing keys are platform secrets (EAS secrets), never committed; also notes the option to Pro-gate Word Finder server-side in `server/word-proxy/worker.js` (relevant after the 2027 Datamuse key cutover).
- House principle (decided in the 2026-07 audit): **never gate capture.** A musician mid-idea who hits a paywall deletes the app.

## The split (decided; revisit against real usage data before building)

**Free forever:** recording (unlimited), workspaces/collections/ideas, playback, trim editor, manual backup & restore (gating data safety breeds one-star reviews), metronome, tuner, lyrics editing, **one** overdub layer per clip, limited word-tool sparks (e.g. 5 saved sparks per tool).

**Pro:** practice suite (loops, pins, speed & pitch, tempo analysis), overdub layers beyond the first, auto-backup + future cloud sync (the two existing keys), workspace archive offload, unlimited word-tool sparks, setlist/chord-chart PDF export.

**Pricing shape:** monthly ~$3–4, annual ~$25–30, **plus lifetime ~$60–80**. Musician communities are subscription-hostile; the lifetime tier converts holdouts and fits a near-zero-server-cost app. Intro offer: 7-day trial on subscriptions, none on lifetime.

## Work items

### 6.1 Billing infrastructure — RevenueCat

`react-native-purchases` (Expo-compatible, config plugin). Products: `pro_monthly`, `pro_annual` (subscription group with trial), `pro_lifetime` (non-consumable). One entitlement: `pro`. Configure in RevenueCat dashboard + App Store Connect + Play Console (both consoles need the products created and, for iOS, a signed Paid Apps agreement — **longest lead-time item, start first**).
Integration: initialize SDK at app start (API key via EAS secret → `app.config.js` `extra`, read with `expo-constants`); on `customerInfo` listener, call `proEntitlement.set(info.entitlements.active["pro"] != null)`. Restore purchases = `Purchases.restorePurchases()`. **No account system needed** — RevenueCat anonymous IDs ride the store account, which also survives reinstall.

### 6.2 The catalog decides the split; flip the flag last

**How to change the split:** edit `src/domain/proCatalog.ts`, nothing else. It is one table
keyed by `ProFeature` — per row `pro: true|false` (gated at all), an optional `freeLimit` for
count-based gates (workspaces, layers, editor parts, saved sparks per tool), and a plain-English
`what`. Every gate reads it (`hasProAccess` returns true for a `pro: false` row, the count
helpers in `domain/proGating.ts` read `freeLimit`), so flipping a feature free or changing a
number is a one-value edit with no call-site change. The practice tools have per-tool switches
in `PRACTICE_TOOLS_PRO` under the same row. The sweep's suggested tweaks (3 free workspaces,
loose clips sendable free, 3 free sparks per tool) sit as comments on the rows they would
change. `PAYWALL_ROWS` in the same file is what the Pro sheet advertises; `src/__tests__/
proCatalog.test.ts` fails if a row promises a feature that is no longer gated or the row count
drifts from `pro.features.*` in translations, so a flip means editing the sheet's copy too.

Flip `ALL_FEATURES_FREE` (`domain/entitlements.ts`) to `false` **last**, behind the 6.3 pass —
everything must have a graceful gated state before the flag flips. The `__DEV__` override
(`setDevProOverride` from the debugger) exercises both states without flipping it.

### 6.3 Gate call sites (split decided by the founder 2026-10-23; every gate is one `ensurePro(key)` line at the top of a CREATE handler)

| Catalog key | Where it gates | What stays free |
|---|---|---|
| `workspaces` | New-workspace FAB (`WorkspaceListScreenContent`), beyond `freeLimit` (3) | Opening, renaming, archiving any workspace |
| `overdub-layers` | Add-layer action (`PlayerScreen`), beyond `freeLimit` | Existing layered takes play and open |
| `practice-suite` | Using pins, pitch, analysis, Step up (`PlayerScreen guardPracticeTool`, per-tool switches) | A plain loop and speed; opening practice mode, viewing marks; a received parcel's clips |
| `full-editor` | The editor's Speed & pitch tab; adding a part beyond `freeLimit` (`useEditorSelectionState`) | A plain trim |
| `stage-tools` | `TransposeChip`, capo (`ReadingSheet`), new chart book / setlist (`useSongbookModel`, `useSetlistModel`, `SongbookChooserSheet`), the stage reader (`openReader`) | Writing chord charts; reading charts, books, sets; all of it on a received parcel (`ensureProFor`) |
| `lyric-spark` | Starting a spark beyond 3 tries per game, counted for good (`useNotepadScreenModel startSpark`, `services/sparkTries.ts`; founder, 2026-10-25: deleting gives no try back; sparks made with Pro or in the free month don't count) | Existing sparks open and edit |
| `word-sparks-unlimited` | Retired 2026-10-25 (`pro: false`): replaced by the tries above | — |
| `word-finder-full` | Opening the Word Finder (`LyricsVersionEditor`, `NoteEditor`): its lookups are paid-for APIs | Lyrics themselves |
| `send` | `openSendSheet`, beyond `freeLimit` (3) links per 30 days (`useSentLinksStore.sentAt`) | Receiving, and everything in a received parcel |
| `pdf-export` | Chart PDF (`useChordSheetModel.exportPdf`, `useChordExport`) | Text and archive exports |
| `archive-offload` | `useWorkspaceArchiveActions` | Backup, export, restore, the backup reminder |
| `auto-backup` | `pro: false` — nothing reads it; reserved | Backup is never locked |

Every gate shows the **same upsell sheet** (6.4) — no bespoke paywalls per feature. Add a reusable `ProBadge` chip (terracotta outline, "PRO") in `src/components/common/`.

### 6.4 Paywall screen

One `ProUpsellSheet` (bottom sheet, full-height): PlayfairDisplay headline ("Grow every idea"), feature list with icons (the six Pro rows), price cards (annual highlighted, monthly, lifetime), trial copy, restore-purchases link, terms/privacy links (required by Apple), close affordance (Apple rejects paywalls that trap). Style: paper/terracotta, SurfaceCard price cards, no dark patterns (no fake countdowns/preselected trials-into-annual tricks). Entry points: every gate + a "SongNook Pro" row in Settings.

### 6.5 Pro state surfaces

Settings gains a Pro section: current plan, manage subscription (`Linking` to store subscription management), restore purchases. Drawer/Settings shows a subtle Pro mark for subscribers. All receipt/entitlement state stays in RevenueCat — **persist nothing entitlement-related in the app store snapshot** (it must not be backup-restorable; entitlements come from the store account).

### 6.6 Grandfathering & migration care

Users from the free-everything era will *lose access* to practice/overdub features they've used. Options, in order of goodwill: (a) grandfather existing installs (persisted `firstLaunchAt` from Phase 4.5 predates the flip → lifetime-lite flag), (b) long free window announcement in-app before flipping, (c) hard flip. **Recommend (b) minimum: an in-app notice 2 weeks ahead.** Decide with the owner; whatever is chosen, existing user *data* (saved sparks beyond limit, existing multi-layer clips) must remain fully accessible/playable/editable — gates apply to *creating new*, never to opening existing work.

### 6.7 QA

- Sandbox purchases on both platforms (TestFlight sandbox + Play internal testing license testers): buy, cancel, trial-expiry, restore, lifetime, upgrade monthly→annual.
- Offline behavior: entitlement caches (RevenueCat handles) — Pro features must work in airplane mode for an entitled user.
- The flip-flag matrix: run the full app with `ALL_FEATURES_FREE=false` + no entitlement and verify **zero dead ends** and zero gates on capture/backup/existing-content.
- Store compliance re-review: paywall screenshot goes into App Review; description updated to mention IAP; privacy labels updated (purchases linked to identity by Apple automatically).

## Verification

- [ ] `npx tsc --noEmit` + `npx jest` green; unit tests for gate-decision logic (pure functions taking entitlement + counts)
- [ ] Sandbox purchase matrix (6.7) passes on both platforms
- [ ] Zero-dead-end audit with entitlements off
- [ ] Existing-content accessibility audit (6.6) passes
- [ ] Conversion analytics decision made consciously (RevenueCat's own dashboard may suffice — avoids adding an analytics SDK and keeps the privacy story)

## Out of scope

Cloud sync itself (the `cloud-backup` key gates a future feature — don't build it here); server-verified entitlements for the word proxy (post-2027-cutover work); promo codes/referrals; regional pricing beyond store defaults.
