# Phase 6 — Monetization (SongNook Pro)

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

**Pro:** practice suite (loops, pins, speed & pitch, key/BPM analysis), overdub layers beyond the first, auto-backup + future cloud sync (the two existing keys), workspace archive offload, unlimited word-tool sparks, setlist/chord-chart PDF export.

**Pricing shape:** monthly ~$3–4, annual ~$25–30, **plus lifetime ~$60–80**. Musician communities are subscription-hostile; the lifetime tier converts holdouts and fits a near-zero-server-cost app. Intro offer: 7-day trial on subscriptions, none on lifetime.

## Work items

### 6.1 Billing infrastructure — RevenueCat

`react-native-purchases` (Expo-compatible, config plugin). Products: `pro_monthly`, `pro_annual` (subscription group with trial), `pro_lifetime` (non-consumable). One entitlement: `pro`. Configure in RevenueCat dashboard + App Store Connect + Play Console (both consoles need the products created and, for iOS, a signed Paid Apps agreement — **longest lead-time item, start first**).
Integration: initialize SDK at app start (API key via EAS secret → `app.config.js` `extra`, read with `expo-constants`); on `customerInfo` listener, call `proEntitlement.set(info.entitlements.active["pro"] != null)`. Restore purchases = `Purchases.restorePurchases()`. **No account system needed** — RevenueCat anonymous IDs ride the store account, which also survives reinstall.

### 6.2 Extend the entitlement keys and flip the flag

Add to `ProFeature`: `"practice-suite" | "overdub-layers" | "word-sparks-unlimited" | "archive-offload" | "pdf-export"`. Flip `ALL_FEATURES_FREE` to `false` **last**, behind a full pass of 6.3 — everything must have a graceful gated state before the flag flips. Keep a dev override (e.g. `__DEV__` && a debug toggle) for testing both states.

### 6.3 Gate call sites (use `ProGate` fallback or imperative `hasProAccess` + upsell)

| Feature | Where to gate | Gated UX (never a dead end) |
|---|---|---|
| Practice suite | Practice panel entry in `PlayerScreen` (tool buttons render; tapping opens upsell) | Tools visible but locked-badged; one free "taste" session/day is worth considering |
| Overdub layers ≥2 | Add-layer action in the overdub section | First layer works fully; second layer add → upsell sheet explaining stacking |
| Auto-backup | `SettingsScreen` backup options (key exists) | Row visible with Pro badge |
| Archive offload | Offload action in Settings library flow | Same |
| Word sparks | Save-spark actions in WordLadder/CutUp/Magpie when count ≥ limit | Counter visible ("3 of 5 saved"); limit hit → upsell |
| PDF export | `chordChartPdf.ts` / `setlistExport.ts` call sites | Export button Pro-badged |

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
