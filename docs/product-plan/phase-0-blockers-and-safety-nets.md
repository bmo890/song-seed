# Phase 0 — Store Blockers & Safety Nets

**Effort:** ~1 week · **Dependencies:** none — every item is verifiable on the existing Android dev build · **Blocks:** all other phases (Phase 5 hard-depends on it)

## Purpose

Remove everything that would cause an outright store rejection or a catastrophic first impression (white-screen crash, placeholder icon, unstyled OS popups in the app's most sensitive dialogs), and put the minimum observability in place so post-launch bugs are discoverable. Nothing in this phase is speculative — every item was confirmed present in the 2026-07-11 audit.

## Background you need

- The app has **no error boundary and no crash reporting**. Any render exception = permanent white screen. Because the app holds users' recordings, a white screen *feels like* data loss even though the persistence layer (SQLite snapshot + shadow manifest in `src/services/manifestSync.ts`) means a restart fully recovers.
- The app has a styled dialog system (`src/components/common/AppAlert.ts` → `AppDialog.tsx`, host mounted in `App.tsx` as `<AppDialogHost />` **above** the hydration gate, so it is available at all times). Its own doc comment bans raw `Alert.alert` — yet `App.tsx` itself contains the only four remaining raw calls, and they are the highest-stakes dialogs in the app.
- Build variants: `app.config.js` overlays `app.json`; `APP_VARIANT=production` selects the name "Song Seed", scheme `songseed`, bundle id `com.bmostudio.songseed`. Dev variant appends `.dev`. The bare `android/` and `ios/` directories are committed, so config changes require regenerating native projects (`npx expo prebuild`) or hand-editing both places.

## Work items

### 0.1 Real app icon, adaptive icon, and splash

**Current:** `assets/icon.png`, `assets/adaptive-icon.png`, `assets/splash-icon.png` are the **default Expo template placeholders** (grey concentric circles on a grid). Apple rejects placeholder icons; both stores require final art.
**Target:**
- 1024×1024 App Store icon, no alpha channel (Apple requirement), no rounded corners baked in (both OSes mask).
- Android adaptive icon: foreground layer with the mark inside the ~66% safe zone + a background layer/color. Test the round, squircle, and circle masks in the Android launcher.
- Splash image sized for `resizeMode: "contain"` on background **`#FDFBF7`** (the app's paper color) — `app.json` → `expo.splash.backgroundColor` and `expo.android.adaptiveIcon.backgroundColor` currently say `#ffffff`, which flashes white against the paper-toned app. Change both.
- Design direction lives in `docs/design-system.md` + `src/design/tokens.ts`: warm paper, terracotta `#B87D6B`, editorial serif energy (PlayfairDisplay). A seed/sprout or reel-to-reel motif in terracotta on paper would fit; keep it legible at 48px.

**Acceptance:** installed production build shows the new icon on both launchers; cold start shows the branded splash on paper background with no white flash; `npx expo-doctor` reports no icon warnings.

### 0.2 Seamless launch (expo-splash-screen)

**Current:** `expo-splash-screen` is **not installed**. The native splash auto-hides on first React frame, which is a plain `<ActivityIndicator color="#B87D6B">` view in `App.tsx` (two of them: one gating store hydration in `App`, one gating fonts/navigation in `AppContent`). Users see: splash → spinner flash → app.
**Target:** `npx expo install expo-splash-screen`; call `SplashScreen.preventAutoHideAsync()` at module scope in `App.tsx`; call `SplashScreen.hideAsync()` only when **both** gates pass (`hasHydrated && fontsLoaded && navigationStateReady`). Keep the spinner views as the behind-splash fallback. Optional but nice: `SplashScreen.setOptions({ fade: true, duration: 250 })`.
**Acceptance:** cold start is one continuous motion — splash holds until the first real screen is ready, then fades. Test with a large library (hydration takes visible time) via the dev seed if one exists, or by device with real data.

### 0.3 Root ErrorBoundary

**Current:** zero error boundaries; no `componentDidCatch` anywhere in `src/` or `App.tsx`.
**Target:** a class component `AppErrorBoundary` (new file `src/components/common/AppErrorBoundary.tsx`) wrapping everything inside `GestureHandlerRootView` in `App.tsx`. On catch:
- Render a full-screen, on-brand fallback (paper background, PlayfairDisplay headline): title like "Something went wrong", body copy that **explicitly reassures**: "Your recordings and library are safe on this device." One terracotta button: "Restart Song Seed" — remount the tree by bumping a `key` on the child (setState in the boundary), which re-runs hydration safely.
- Log `error` + `componentStack` via the crash capture from item 0.4.
- Use design tokens directly (the boundary must not depend on anything that could itself be broken — keep imports minimal: React, RN primitives, tokens).
**Acceptance:** temporarily throw inside a screen render in dev → styled fallback appears, restart button recovers the app with library intact, error is captured. Add a jest render test for the boundary itself.

### 0.4 Crash capture

**Current:** no Sentry/Crashlytics/anything; release builds strip `console.log`/`debug` (babel `transform-remove-console`, keeps `error`/`warn`), so field crashes are invisible.
**Target (choose one, decision noted here as A unless the owner objects):**
- **A (recommended): `@sentry/react-native`** via `npx @sentry/wizard@latest -i reactNative` or manual Expo setup (`sentry-expo` is deprecated; use the SDK's Expo plugin). Crashes + JS errors only; disable performance tracing and session replay; scrub PII by default (there is none — no accounts). This slightly complicates the "Data Not Collected" App Store privacy answer: crash data collected not-linked-to-identity must be declared. Coordinate with Phase 5 privacy questionnaire.
- **B (privacy-absolutist fallback):** `ErrorUtils.setGlobalHandler` + the ErrorBoundary write last-crash JSON to `FileSystem.documentDirectory/crashlog/`; Settings → About gains a "Share diagnostic log" row (mailto attachment or share sheet). Keeps "Data Not Collected" pristine but only surfaces crashes users bother to report.
**Acceptance:** a forced crash in a release-variant build is visible (Sentry event or local log file) with symbolicated/readable stack.

### 0.5 Route App.tsx's four raw Alert.alert calls through AppAlert

**Current:** `App.tsx` calls raw `Alert.alert` in the post-hydration effect (search for `Alert.alert` — four sites): (1) "Restore your library?" empty-library recovery prompt, (2) "Recovered recording" success notice, (3) "Recording recovery failed", (4) "Back up your library?" reminder with 3 buttons. These render as unstyled OS popups in the app's most trust-sensitive moments.
**Target:** replace with `AppAlert.confirm` / `AppAlert.info` / `AppAlert.custom` (the 3-button reminder maps to `custom`). Remove the now-unused `Alert` import. `AppDialogHost` is already mounted above the hydration gate so timing is safe — but **verify on device** that a dialog fired from this effect (which runs immediately after hydration) renders correctly.
**Acceptance:** trigger each flow (empty-library restore: clear app data while manifest survives is hard to simulate — at minimum code-review the path; backup reminder: set `backupReminderFrequency` and advance clock or temporarily lower the threshold in dev) and confirm styled dialogs. `grep -rn "Alert.alert" src App.tsx` returns only `AppAlert.ts`/`AppDialog.tsx` internals.

### 0.6 iOS export-compliance key

**Current:** `app.json` → `expo.ios.infoPlist` has only `NSMicrophoneUsageDescription`.
**Target:** add `"ITSAppUsesNonExemptEncryption": false` (the app uses only exempt HTTPS). Without it every TestFlight build stalls on a manual compliance question.
**Acceptance:** key present in generated `ios/songseed/Info.plist` after prebuild.

### 0.7 EAS build configuration

**Current:** no `eas.json`; builds are local (`scripts/android-dev.sh`, `expo run:*`). iOS store signing + the share extension (see below) make manual signing painful.
**Target:** create `eas.json` with `development` (dev client, internal), `preview` (internal distribution), and `production` (store) profiles; production sets `autoIncrement: true` for build numbers. Set `APP_VARIANT=production` in the production profile's `env`. **Correction to the original audit:** `android/` and `ios/` are **gitignored** — this project is **prebuild-driven (Continuous Native Generation)**, not committed-bare. EAS regenerates the native projects from `app.json` + `app.config.js` + the config plugin `plugins/withSongSeedAndroidVariants` on each build, and runs `patch-package` (postinstall) automatically. This is the cleaner setup and needs no special handling — just ensure all native config flows from the tracked JS config (it does). **Implication:** any hand-edit to a file under `android/`/`ios/` is a throwaway local artifact and will be overwritten on the next `expo prebuild` — the source of truth is always the tracked config.
- The iOS **share extension** (`expo-share-intent`, name "Song Seed Import") needs its own provisioning; EAS handles multi-target credentials automatically — this is the main reason to prefer EAS over manual Xcode signing.
**Acceptance:** `eas build --profile production --platform android` produces an installable `.aab`; iOS equivalent deferred to Phase 1 but the profile exists.

### 0.8 Production display-name regen

**Resolved by the rename + CNG:** the stale `song-seed` label lived only in the gitignored generated `strings.xml`. Because the project is prebuild-driven, the launcher label comes from `app.config.js` `name` (now "Songstead" / "Songstead Dev") on the next `expo prebuild`. No tracked file needed changing beyond the config already updated in 0.0. **Acceptance:** after a production prebuild + build, the launcher shows **"Songstead"**; dev build shows "Songstead Dev". (Verify on device during Phase 1 / first production build.)

### 0.9 Hosted privacy policy

**Current:** none. Both stores require a URL at submission. The app's story is maximally simple: all user content stays on device; backups go only where the user sends them; no accounts, no analytics (unless 0.4-A chosen → disclose crash data); network calls = Datamuse word lookups + Gutenberg book text, both anonymous.
**Target:** a one-page policy hosted at a stable URL (GitHub Pages in this repo is fine — e.g. `docs/` publishing or a `gh-pages` branch). Content sections: what's stored (locally), what's transmitted (word-lookup queries, book fetches, optionally crash reports), what's collected (nothing / crash diagnostics), contact email (bmostudio.dev@gmail.com), effective date. Mirror the wording already shipped in Settings → About → Privacy (`src/components/SettingsScreen/views/SettingsAboutView.tsx`) so in-app and hosted text agree, and add a "Privacy policy" link row there pointing at the URL.
**Acceptance:** URL is live, linked from Settings About, and recorded in this file for Phase 5.

### 0.10 `colors.danger` design token

**Current:** destructive reds are improvised per file: `#b91c1c` (ClipActionsSheet icons), `#A8443A` (practice panel delete), `#d95b56` (player playhead — actually an accent, not a danger), plus whatever `style: "destructive"` renders in AppDialog.
**Target:** add to `src/design/tokens.ts`: `danger` (suggest `#A8443A` — it's the warmest of the three and already the most-used) and `onDanger: "#FFFFFF"`. Sweep the hardcoded destructive reds in `src/components/` to the token (grep `#b91c1c`, `#A8443A`). Leave `#d95b56` playhead alone (it's a playhead accent; Phase 2 owns it). This token unblocks consistent destructive styling in Phases 2–4.
**Acceptance:** grep shows no `#b91c1c` outside tokens; visual spot-check of clip delete flows.

## Verification checklist (run at phase end)

- [ ] `npx tsc --noEmit` clean, `npx jest` green (359+ tests)
- [ ] Cold start on device: splash → app, no white flash, no spinner flash
- [ ] Forced crash shows branded fallback; restart recovers with library intact; crash visible in capture channel
- [ ] `grep -rn "Alert.alert" src App.tsx` → only the AppAlert/AppDialog internals
- [ ] Production `.aab` builds via EAS; launcher shows "Song Seed" with real icon
- [ ] Privacy policy URL live and linked in Settings

## Out of scope

Anything visual beyond the icon/splash (Phase 2), iOS building (Phase 1), onboarding (Phase 4).
