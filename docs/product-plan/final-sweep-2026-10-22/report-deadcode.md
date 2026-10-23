# Cross-cutting audit: dead code, dependencies, build config, tests

Tree: `main` @ `b4a7268`. Read-only at audit time; the items marked "applied" landed in the
sweep commit (see `../final-sweep-2026-10-22.md`).

Method (precision over coverage):
- Dead files = zero importers in the resolved import graph (relative specifiers with
  `.ts/.tsx/.js/.json`, `index.*`, `.ios/.android/.native/.web`; `require`, `jest.mock`, dynamic
  `import()` included) AND unreachable from `App.tsx`/`index.ts`. Both methods agreed exactly.
- Dead exports = exported name that appears as a whole word in NO other file under `src/`,
  `App.tsx`, `index.ts`, `modules/`; the 34 "never referenced anywhere" names were re-checked
  with `git grep -w` over the whole repo (docs, .maestro, server).
- Dependency use = package name in an import/require/plugin position across `src`, `App.tsx`,
  `index.ts`, `app.json`, `app.config.js`, `plugins/`, `babel.config.js`, `jest.config.js`,
  `modules/`, `scripts/`.

Counts: P0 0 · P1 1 · P2 6 · P3 9. tsc clean (only after `patch-package` — the expo-audio patch
is load-bearing), jest 187/1560 green at audit time, zero TODO/FIXME/HACK/XXX in the repo, no
secrets in tracked files, `app.json` valid JSON (mis-indent at line 35 cosmetic).

## 1. Dead files (zero importers, unreachable from the app root)

| File | Lines | Verdict |
|---|---|---|
| `src/components/common/Knob.tsx` | 348 | Built ahead for the Sound room (`docs/design-system.md:417`), no call site. Not bundled (Metro bundles only reachable modules). P3: keep if the Sound room ships this cycle, else remove with its doc rows. |
| `src/components/common/LitKey.tsx` | 113 | Same (`docs/design-system.md:414`). P3. |
| `src/components/common/ProGate.tsx` | 23 | Documented "do NOT remove" (phase-6 seam). Keep. |
| `src/components/common/SectionHeader.tsx` | 22 | Only mention is in a phase-4 doc. **Applied: deleted.** |
| `src/dev/renderCensus.ts` | 25 | "Temporary instrumentation … not meant to ship", no call sites. **Applied: deleted.** |

`src/components/dev/SyncProbe.tsx` ("TEMPORARY DIAGNOSTIC") was statically imported by
`App.tsx` and gated only by `const SHOW_SYNC_PROBE = false`, so the Skia/Reanimated module
shipped in the release bundle. **Applied: deleted with its import and render line.** The other
dev tools (`jsStallMonitor`, `commitProfiler`) are correctly lazy-`require`d under `__DEV__`.

## 2. Dead exports

### 2a. Exported and referenced nowhere at all (34, verified repo-wide)

| File | Symbol(s) | Note |
|---|---|---|
| `SettingsScreen/components/SettingsShared.tsx` | `LIBRARY_DEEP`, `SegmentedField`, `FormatOptionRow`, `AccordionSection` | ~130 lines of retired pre-ValueRow Settings UI. **Applied: removed.** |
| `PlayerScreen/helpers.ts` | `getNoteSummary` | |
| `common/dockIcons.tsx` | `DockMergeBoxIcon` | |
| `Knob.tsx` / `LitKey.tsx` / `ProGate.tsx` / `SectionHeader.tsx` | the components | §1 |
| `src/dev/renderCensus.ts` | `useRenderCensus` | §1 |
| `domain/chords.ts` | `ACCIDENTAL_OPTIONS` | |
| `domain/compilationListing.ts` | `COMPILATION_FILTERS`, `COMPILATION_SORTS` | |
| `domain/cutUp.ts` | `CHUNK_MODE_OPTIONS` (English labels), `unitIndexByWord`, `composeDraftText` | |
| `domain/entitlements.ts` | `getDevProOverride`, `useIsPro` | `setDevProOverride` is debugger-invoked by QA flows and `useIsPro` is named in the phase-6 doc — keep those; `getDevProOverride` is removable. |
| `domain/hierarchy.ts` | `getHierarchyIconColor` | |
| `domain/lyrics.ts` | `getLyricsPreview` | |
| `domain/metronome.ts` | `METRONOME_SUBDIVISION_OPTIONS` | |
| `domain/overdub.ts` | `overdubGainDbToPlayerVolume` | |
| `domain/pitchShift.ts` | `formatPitchShiftLabel` | hard-coded English |
| `domain/tuner.ts` | `getTunerMeterPercent` | |
| `domain/wordLadder.ts` | `COLUMN_A_LABEL`, `COLUMN_B_LABEL`, `ROLE_SEED_PLACEHOLDER`, `PLACE_SEED_PLACEHOLDER`, `getColumnAPlaceholder`, `getColumnBPlaceholder` | Hard-coded English. **Applied: removed.** |
| `services/libraryBackup.ts` | type `ManualExactBackupResult` | |
| `services/managedMedia.ts` | `MAX_IN_MEMORY_ARCHIVE_BYTES` | |
| `services/persistLog.ts` | `getPersistLogPath` | |
| `utils.ts` | `getCollectionSizeBytes` | |

### 2b. Exported but consumed only inside their own file (389)

Mostly `type` aliases exported beside a component, tuning constants and internal helpers.
Dropping `export` is harmless; deleting is not. Notables with real code: `services/billing.ts`
`isBillingAvailable`/`initBilling` (consistent with "everything is free"), `workspaceTheme.ts`
`hslToHex`/`hexToHsl`/`computeWorkspaceTheme`, `dataSlice.ts` `resolvePrimaryCollectionIdForWorkspace`.

### 2c. Test-only exports (139)

Normal "export for test" pattern (`cutUp.ts` board helpers, `stepUpLoop.ts` ×7, `wordTools.ts`
×8, `*ForTests` resetters). Nothing to act on.

## 3. Dependencies

| Package | Finding |
|---|---|
| `@react-native-community/slider` | **Zero imports**; `docs/product-plan/craft-control-kit.md:240` says remove at zero; lint baseline `slider_stock=0`. Still autolinks natively. P2: remove from deps + `expo.install.exclude`, rebuild natives. |
| `react-dom`, `react-native-web`, root `wrangler` | Zero use; no root `wrangler.toml`, so `npm run deploy`/`preview` cannot work; `songnook-file-io` has no web stub and audio-studio/SQLite have no web path. P1 (dead toolchain): remove with the `web/deploy/preview` scripts and the `expo-web` launch config, or document "no web". |
| `@types/jest`, `jest`, `jest-expo` | In `dependencies`; belong in `devDependencies`. `patch-package` must stay in deps (postinstall on EAS). |
| `expo-system-ui` | Zero imports but needed: config plugin makes `userInterfaceStyle: "light"` and the root background take effect on Android. Keep. |
| `react-native-screens`, `react-native-worklets` | Required peers. Keep. |

In use (flagged candidates checked): `fflate` = in-memory reader (6 services) vs
`songnook-file-io` = streaming writer — not an overlap; `unique-names-generator` (`utils.ts`),
`grapheme-splitter` (`chords.ts`), `expo-print` (`chordChartPdf.ts`), `expo-asset`
(`lockScreenArtwork.ts`), `expo-updates` (About view + locale reload), `expo-secure-store`
(`freeMonthClock.ts`), `@siteed/audio-studio` (21 files), `react-native-svg` (icons/glyphs, 11
files) vs `@shopify/react-native-skia` (canvases, 7 files) — rational split; `i18next` direct
imports are all `import type`.

## 4. Patches (`patches/`, applied by `postinstall`)

| Patch | What it changes | Survive? |
|---|---|---|
| `@siteed+audio-studio+3.0.2` | Android MediaSession held during recording (headset keys toggle the take), notification layout, iOS stream-manager tweaks, capture-start timestamps, `setPreferredDevice`. | Fix. Keep. |
| `expo-audio+1.1.1` | Status loop only while playing (was 20 Hz forever), background cadence, `updateLockScreenOptions`, `lockScreenCommand`, stale-notification cleanup. | Fix and load-bearing for tsc (`useFullPlayer.ts` uses the added API). Keep; port on every bump. |
| `expo-file-system+19.0.24` | Android FileHandle read/write loops until full (short reads were zero-padded); removes `publication` block. | Fix (zip streaming integrity). Re-verify the publication removal on the next SDK. |
| `expo-haptics+15.0.8` | Vibrate on the main queue. | Fix. Keep. |
| `react-native+0.81.5` | `Text.js` RTL default start alignment on iOS. | Fix for Hebrew. Re-validate on RN upgrade. |
| `react-native-draggable-flatlist+4.0.3` | `getItemLayout`-based cell geometry; no first-frame jump. | Fix. Keep. |
| `react-native-pitchy+1.2.0` | MPM/NSDF detector with clarity + level, Android AudioRecord lifecycle, 16 KB page-size linker flags (Play requirement). | Fix. Keep. |
| `react-native-worklets+0.5.1` | Registers `WorkletsModule` as a lifecycle listener so frames pause on `onHostPause` (was 60 Hz with the display off). | Fix (battery). Drop on bump when upstream registers it. |
| `xcode+3.0.1` | Null-guard in `pbxProject.js`. | Prebuild workaround; re-check on the next Expo bump. |

## 5. Build / config

- `app.json` parses; `RECORD_AUDIO` listed twice (harmless); `POST_PROMOTED_NOTIFICATIONS` is a real API-36 permission; `blockedPermissions` CAMERA with the image-picker camera string set is fine (iOS string only).
- `app.config.js` / `eas.json` consistent (dev/prod name, scheme, bundle id, Gradle flavor commands, `appVersionSource: remote`, `autoIncrement`). Apple ids in the submit block are not secrets.
- `babel.config.js`: `react-native-reanimated/plugin` is literally `require('react-native-worklets/plugin')` on this install, and `babel-preset-expo` already auto-adds `react-native-worklets/plugin` → registered twice (idempotent, redundant pass). P3: drop the `plugins` line per SDK 54 guidance.
- `tsconfig.json` strict, excludes `server`; `jest.config.js` ignores worktrees and `server/songnook-send`; no `metro.config.js`.
- `.gitignore` covers `.env*`, `.dev.vars*`, keystores, native dirs; nothing matching is tracked. Secrets grep (AWS/Google/GitHub/Slack/Stripe shapes, PEM, Bearer, api_key, account_id): none; only a `"ut_SECRET"` test fixture and Cloudflare resource ids (not credentials).
- Largest tracked files: design-audit PNG/HTML mock-ups under `docs/product-plan/` (max 1.0 MB, ~60 PNGs); tree 23.6 MB / 1 197 files.
- `scripts/`: `push-dev-samples.sh` defaults `SRC` to a personal path (P3).
- `plugins/withSongNookAndroidVariants.js`: correct against the SDK-54 Groovy template and idempotent, but every injection anchors on template whitespace and silently no-ops on drift (an Expo bump could ship a debug-signed release); with `SONGNOOK_UPLOAD_STORE_FILE` unset the `release {}` block is empty and relies on EAS credential injection. P2: assert each anchor matched; run `eas build -p android --profile preview` as a sanity check.

## 6. Tests / typecheck

tsc exit 0 after `patch-package` (unpatched `node_modules` gives 3 errors in `useFullPlayer.ts`
— CI/EAS must run `postinstall`). Jest 187 suites / 1 560 tests at audit time (188 / 1 563 after
the sweep commit), slowest `src/__tests__/browseRootBackAction.test.ts` 18 s.

## 7. console.* survey

Non-test totals: log 89 · warn 176 · error 5 · debug/info 0 → 181 calls survive release. Top
files: `useRecordingScreenModel.ts` 41, `useRecording.ts` 21, `useEditorExportFlow.ts` 17,
`useFullPlayer.ts` 16, `useSongClipEditing.ts` 12, `waveformAnalysis.ts` 11, `state/actions.ts`
10, `usePlaybackClick.ts` 10. Every warn/error opened sits in a catch or one-shot failure
branch; zero console calls in the visualizers, `AudioReel`, `OverdubLayerLanes`, `TakeRegister`,
`WaveformStrip`, the status-tick hooks. Only repeat-prone: `useNativePitchTransport.ts:372`
`console.error` per native engine error event (bounded by the engine). No action required.

## 8. TODO/FIXME/HACK/XXX

None in `src`, `App.tsx`, `index.ts`, `plugins`, `scripts`, `modules`. Commented-out code
negligible (3 lines each in `useRecordingScreenModel.ts` and `PlayerScreen/index.tsx`).

## 9. Findings (severity-ordered)

| # | Sev | Where | What | Fix |
|---|---|---|---|---|
| 1 | P1 | `package.json` `deploy`/`preview`; root `wrangler`, `react-dom`, `react-native-web` | Web deploy path non-functional; dead toolchain. | Remove deps + scripts + launch config, or document "no web". Not an iOS ship blocker. |
| 2 | P2 | `App.tsx`; `components/dev/SyncProbe.tsx` | TEMPORARY Skia probe in the release bundle. | **Applied.** |
| 3 | P2 | `@react-native-community/slider` | Native dep, zero imports. | Remove + rebuild natives. |
| 4 | P2 | `SettingsShared.tsx` | ~130 lines retired Settings UI. | **Applied.** |
| 5 | P2 | `wordLadder.ts` | 6 dead exports with hard-coded English. | **Applied.** |
| 6 | P2 | `plugins/withSongNookAndroidVariants.js` | Whitespace-anchored Gradle injection no-ops silently on drift. | Assert each anchor (~6 lines). |
| 7 | P2 | `patches/expo-audio+1.1.1.patch` | tsc depends on the patch. | Keep postinstall in every CI/EAS path; note in README. |
| 8 | P3 | `babel.config.js` | Worklets plugin registered twice. | Drop the `plugins` line. |
| 9 | P3 | `package.json` | `jest`, `jest-expo`, `@types/jest` in dependencies. | Move to devDependencies. |
| 10 | P3 | `SectionHeader.tsx`, `src/dev/renderCensus.ts` | Dead files. | **Applied.** |
| 11 | P3 | `Knob.tsx`, `LitKey.tsx` | 461 lines built ahead for an unshipped Sound room. | Founder's call. |
| 12 | P3 | §2a | 20 more never-referenced exports. | One sweep; leave `ProGate`, `setDevProOverride`, `useIsPro`. |
| 13 | P3 | `app.json:35` | Mis-indent. | Cosmetic. |
| 14 | P3 | `scripts/push-dev-samples.sh:10` | Personal path default. | `$HOME` or require an argument. |
| 15 | P3 | `patches/expo-file-system`, `patches/xcode` | Prebuild workarounds. | Re-test on the next SDK bump. |
| 16 | P3 | `docs/product-plan/**/*.png,html` | ~60 mock-ups up to 1 MB in the app repo. | Housekeeping. |
