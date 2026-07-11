# Phase 0.0 — Name & Brand Lock

**Effort:** ~1–2 days of work + a clearance decision · **Dependencies:** none · **Blocks:** ALL of Phase 0 and everything after it. This runs **first**, before any icon, splash, privacy-policy, or native-config work — so that work is done once against the final name.

## Why this is its own phase, and why it's first

"Song Seed" is two common words already used by several apps, and there's a (currently inactive) `songseed` domain in someone else's hands. That raises three *separate* concerns — an App Store uniqueness blocker, a trademark question, and a discoverability drag — and at least the first can force a rename whether we like it or not. The decision has to be made and locked before Phase 0 because:

- **Bundle identifiers become permanent at first store submission (Phase 5) and can never change afterward.** A different bundle ID is, to the stores, a different app — new listing, zero reviews, lost history. Right now, pre-submission, they're free to change. This is the *only* window.
- The name is embedded in Phase 0's icon/splash art, the hosted privacy policy, the EAS config, and the native project regen. Deciding late means redoing all of it.

**This is the single most schedule-critical dependency in the entire plan.** It feels like soft branding work; it is actually a hard gate.

> Disclaimer for whoever picks this up: the guidance below is practical, not legal advice. If the knockout search (Step 1) is ambiguous, get a trademark attorney's clearance opinion before spending on design/marketing — it's a few hundred dollars and cheap insurance.

## Step 1 — Clearance / knockout search (do before anything else)

1. **App Store + Play Store search** for "Song Seed" and close variants. *If a live app already holds "Song Seed" on the App Store, the name is unusable* — Apple enforces unique app names. This single check may settle the whole question.
2. **USPTO TESS** (free, uspto.gov) for `song seed` / `songseed`. Filter to **live** marks in relevant classes: **Class 9** (software) and **Class 41** (entertainment/education services). A live registered mark for music software/services under this name is the real risk signal.
3. **Domain**: note that the inactive `songseed` domain confers *no* trademark rights on its own (rights come from use in commerce, not domain registration) — don't let it drive the decision, but a clean available `.com`/`.app` for the *new* name is a nice-to-have.
4. **Outcome gate:** classify as **Clear** (proceed with current name — still consider discoverability), **Rename** (blocked or high-risk), or **Ambiguous** (get the attorney opinion). Record the outcome and evidence in this file's decision log at the bottom.

## Step 2 — If renaming: pick the new name

Criteria: distinctive (coined or unexpected words beat generic — easier to trademark, easier to rank for), available on **both** app stores and USPTO, ideally a free `.app`/`.com`, speakable, and legible at 48px for the icon wordmark. Re-run Step 1's searches against the finalist before committing. Keep the studio identity **`bmostudio`** — it's your developer/reverse-domain prefix and is unaffected by the app name.

## Step 3 — What the rename actually touches (and what it doesn't)

Critically, **most of the 488 `songseed` string hits in the repo are internal identifiers that should NOT change** — changing them is pure churn and risk with zero user or legal benefit:

### Leave alone (invisible internal identifiers)
- `modules/songseed-file-io`, `modules/songseed-metronome`, `modules/songseed-pitch-shift` — native module package names. Internal. Renaming means rewriting Swift/Kotlin package paths and podspecs for no user benefit.
- `SONGSEED_UPLOAD_STORE_FILE` / `_PASSWORD` / `_KEY_ALIAS` gradle signing properties (`android/app/build.gradle`, `plugins/withSongSeedAndroidVariants.js`) — build-time secret names.
- `songSeedScheme` manifest-placeholder **variable name** and the `withSongSeedAndroidVariants.js` **filename** — internal wiring (the placeholder's *value* is the scheme, which does change; the variable name doesn't need to).
- **Android Java namespace** `namespace 'com.bmostudio.songseed'` in `android/app/build.gradle` — this is the R-class package, separable from the store identity. The `app.config.js` comment already notes native generation "always uses the stable Java namespace." Keep it stable to avoid churn.

### The bundle ID / applicationId — a deliberate choice (read carefully)
The store-facing identity is `com.bmostudio.songseed` (iOS `bundleIdentifier`, Android `applicationId`). It is **invisible to users** — only visible to someone inspecting the app package. Two valid options:
- **Keep it** (`com.bmostudio.songseed`) even under a new display name. Totally normal after rebrands; the "songseed" token in a reverse-domain technical ID is not brand "use in commerce" and carries negligible trademark risk. **Zero churn, and nothing locks you out later** because the display name (which *is* the brand) is freely changeable forever.
- **Change it** to match the new name (e.g. `com.bmostudio.<newname>`). Cleaner, but this is the **only** pre-submission window to do so, and it must propagate to every location in the "must change" list below.

**Recommendation:** unless the new brand really needs a matching bundle ID, **keep `com.bmostudio.songseed`** — it's the lowest-risk path and costs nothing. The brand lives in the display name, not the bundle ID.

### Must change (user-facing brand — the actual rename work)
| What | Where |
|---|---|
| Display name (prod + dev) | `app.config.js` L7 (`name`), `app.json` L3 (`name`) |
| Slug | `app.json` L4 (`slug`) |
| Deep-link scheme (+ `-dev`) | `app.json` L6, `app.config.js` L8; Android manifest placeholder **values** in `android/app/build.gradle` L95/L112 and `plugins/withSongSeedAndroidVariants.js`; fallback literal in `App.tsx` L709 (`?? "songseed"`) |
| iOS share-extension name | `app.json` L50 (`iosShareExtensionName: "Song Seed Import"`) |
| npm package name + scripts | `package.json` L2 (`name`), and the `songseed-dev` scheme flag in `start:dev` (L7) — the `com.bmostudio.songseed*` app-ids in scripts L9–11 only change if you change the bundle ID |
| Android launcher label | `android/app/src/main/res/values/strings.xml` `app_name` (currently stale `song-seed` — Phase 0.8 fixes this anyway; align to final name here) |
| iOS display name | `ios/songseed/Info.plist` `CFBundleDisplayName` |
| In-app brand wordmark | `src/components/SideNav.tsx` L98 (`<Text>Song Seed</Text>`) |
| Permission usage strings | `app.json` L19/L56/L63/L72/L73 ("Song Seed needs microphone access…", notification string) |
| In-app copy referencing the name | ~68 occurrences of "Song Seed" in `src/**` (error messages, `restoreRuntime.ts`, `importDates.ts`, DB comments are fine to leave). **Centralize** into one `APP_NAME` constant (suggest `src/appMeta.ts`) and reference it, so the *next* rename is one line — most of these are in `SettingsScreen` backup/export copy. |
| The **"Song Seed Archive"** file-format name | Same 68-site sweep — decide whether the backup/export format keeps "Song Seed Archive" or adopts the new brand. It's a user-facing product term but legally decoupled from the app name; recommend renaming for consistency. **Note:** this is a display string only — do **not** change any archive *file magic / manifest identifiers / format detection strings* in `src/services/libraryArchiveManifest.ts` / `archiveKind.ts` etc., or existing users' backups stop being recognized. Verify the detection logic keys off a stable internal token, not the display name, before touching anything here. |
| Store listing, privacy policy, icon/splash wordmark | Phases 0.1 / 0.9 / 5 — they consume the final name; that's why this runs first |

### Regenerate & verify natives
Because `android/` and `ios/` are committed, either re-run `npx expo prebuild --clean` (regenerates from the updated config — but re-applies the config plugin and may need the `xcode` patch; verify the variants plugin still works and re-check any hand edits) **or** hand-edit the native locations above in both platforms. Whichever: build both variants and confirm launcher label, scheme deep-link (share-import flow), and share-extension name.

## Acceptance criteria

- [ ] Clearance outcome recorded in the decision log with evidence (store + USPTO screenshots/links)
- [ ] Final name chosen and verified available on both stores + USPTO (if renamed)
- [ ] `APP_NAME` constant introduced; in-app copy references it; no orphaned old-name strings in user-visible UI (`grep -rniE "song ?seed" src --include="*.tsx"` returns only intended/internal hits)
- [ ] Bundle-ID decision made and documented (keep vs. change — with rationale)
- [ ] Both variants build; launcher label, deep-link scheme, and share extension show the final name on device
- [ ] Archive format detection still recognizes pre-rename backups (round-trip an old backup through restore) — **data-safety regression test, do not skip**
- [ ] `npx tsc --noEmit` + `npx jest` green
- [ ] Downstream docs updated: this plan's README, `docs/admin-checklist.md`, and the audit memory note if the name changed

## Brand metaphor & voice (working candidate: "Songstead")

The leading rename candidate is **Songstead**. Whoever builds the icon (Phase 0.1) and writes store/onboarding copy (Phases 4–5) should inherit this thinking:

- **What it means:** the `-stead` suffix is Old English for *place / dwelling*, surviving mainly in **homestead** — a plot of land you settle, tend, and grow things on over time. "Songstead" = *a homestead for your songs*: warm, rooted, editorial, a little old-world.
- **Why it fits the existing "seed" language — it extends it, doesn't replace it.** The metaphor is one arc: **seed → planted → grows on the stead you tend → season after season.** "Song Seed" named only the capture moment; the app's real depth is *tending* ideas over time (revisit, versions, practice loops, overdub layers, the archive/backup machinery). "Songstead" names the whole cultivated place — a truer promise for what the product does.
- **The visual world already supports it.** The design system (`docs/design-system.md`, "Nocturne Paper / The Quiet Creative Archive") is warm paper + terracotta with an explicitly earthy workspace palette (sage, ochre, forest, rust, plum — soil-and-field colors). Keep any seedling/sprout motif — a seedling belongs *in* a stead — and broaden the vocabulary around it (tended plot, ground, growth, seasons) rather than starting over.
- **Tagline directions:** "A homestead for your songs." · "Where ideas take root." · "Tend your songs."
- **Voice guardrail (important, on-brand):** let the metaphor live in the **brand layer only** — name, tagline, icon. Keep **in-app UI labels literal**. No farm puns in the product (no "harvest"/"plow"/"crop" buttons). The design language prizes quiet restraint ("white space is structural"); cutesy agrarian labels would fight the editorial tone. The name carries the poetry so the interface doesn't have to.
- **Caveats to weigh during clearance:** `-stead` is an unfamiliar suffix to modern ears, so some users won't parse it on first read — lean on the tagline early to seed the "homestead" association. Its upside is distinctiveness: a coined compound is a far stronger trademark/SEO position than two common words — but that is a hypothesis until Step 1's search confirms it.

## Out of scope

Logo/wordmark *design* (that's Phase 0.1 icon work — this phase only locks the *name* so the designer has a target); renaming internal native modules or the Java namespace (explicitly excluded above).

## Decision log

- **2026-07-11 — Working candidate:** **"Songstead"** chosen as the leading rename direction (see Brand metaphor & voice above). Rationale: more distinctive/ownable than the two-common-words "Song Seed," and it upgrades the metaphor from capture-moment (seed) to the whole tended place (homestead), which matches the app's depth.
- **2026-07-11 — Name decision: FINAL — "Songstead."** Owner locked the name ("we are going with songstead 100%") and waived the clearance gate; Phase 0 proceeds against it. (A store/USPTO sanity search remains prudent before first submission, but no longer blocks work.)
- **2026-07-11 — Bundle ID decision: keep `com.bmostudio.songseed`.** Per the recommendation above — invisible to users, zero churn, negligible risk; the brand lives in the display name. Can still be revisited any time before first store submission (Phase 5), never after.
