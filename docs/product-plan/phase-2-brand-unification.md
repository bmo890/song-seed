# Phase 2 — Brand Unification Pass

**Effort:** ~1 week · **Dependencies:** Phase 0.10 (`colors.danger` token) · **Parallelizable with:** Phases 1, 3

## Purpose

Make every screen look like it was made by the same hand. The audit found one bug class repeated across ~13 files plus systematic drift in corner radii and one-off colors. This phase is **mechanical, low-risk, and high-visual-impact** — it's the single biggest step toward "premium" feel.

## Background you need — the font-leak bug class

React Native does **not** synthesize font weights for custom fonts. The app loads exactly seven font files (see `useFonts` in `App.tsx`): PlayfairDisplay 400/600/700 and PlusJakartaSans 400/500/600/700. A style like:

```ts
title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary }  // ❌ BUG
```

has **no `fontFamily`**, so it renders in the OS system font (San Francisco / Roboto) — visibly not the app's font. The fix is always:

```ts
title: { fontFamily: "PlusJakartaSans_700Bold", fontSize: 16, color: colors.textPrimary }  // ✅
```

Mapping: `fontWeight "400"` → `_400Regular`, `"500"` → `_500Medium`, `"600"` → `_600SemiBold`, `"700"/"bold"` → `_700Bold`. Once `fontFamily` names the weighted face, **delete the `fontWeight` property** (keeping it can cause Android to fake-bold an already-bold face). Use PlusJakartaSans for all UI text; PlayfairDisplay only for display headlines (screen titles, card titles — match what `src/design/tokens.ts` → `text` does). Numbers that need column alignment get `fontVariant: ["tabular-nums"]`.

This exact bug was already fixed once in `src/components/SettingsScreen/` (July 2026) — use that diff as the reference pattern (`git log --oneline --all -- src/components/SettingsScreen/styles.ts`, commit `372e2d93`).

## Design-system ground truth (match these, not older docs)

- Tokens: `src/design/tokens.ts` — `colors`, `text`, `radii` (xs 2 / sm 4 / md 6 / lg 8 / xl 12 / round 999 / drawer 20), `shadows`.
- Canonical card: `src/components/common/SurfaceCard.tsx` — `radii.lg` (8), `borderWidth: 1` faint border, `shadows.card`.
- Active/selected state: terracotta — border `#B87D6B` / `colors.primary`, bg `#FDF5F2` — **never black**.
- Destructive: `colors.danger` (added in Phase 0.10).
- No pure black, no harsh shadows (opacity ≤ 0.08), animations are fades/small slides.

## Work items

### 2.1 Font-leak fixes, worst-first (the audit's confirmed list)

For each file: fix every bare `fontWeight`, verify on device that nothing reflows badly (weighted faces have slightly different metrics), move on. Counts are bare-fontWeight occurrences found 2026-07-11.

| # | File | Count | Notes |
|---|---|---|---|
| 1 | `src/components/MetronomeScreen/styles.ts` | 14 (file has **zero** fontFamily) | Entire metronome screen is system font today |
| 2 | `src/components/RecordingScreen/RecordingMetronomeSheet.tsx` | 11 | In the core recording flow |
| 3 | `src/components/BluetoothCalibrationScreen/index.tsx` | 10 | |
| 4 | `src/components/TunerScreen/styles.ts` | 7 (zero fontFamily) | |
| 5 | `src/components/PlayerScreen/components/OverdubLayerCard.tsx` | 7 (local StyleSheet ~lines 495–618) | Overdub layer titles/controls |
| 6 | `src/components/EditorScreen/EditorTransformSection.tsx` | 4 | Speed & pitch controls |
| 7 | `src/components/EditorScreen/EditorExportModal.tsx` | 3 | |
| 8 | `src/components/EditorScreen/EditorTransformExportModal.tsx` | 2 | |
| 9 | `src/components/SearchScreen/components/SearchScreenContent.tsx` | 2 | |
| 10 | `src/components/ActivityScreen/components/ActivityResultCard.tsx` | 2 | |
| 11 | One each | | `ShareImportScreen/styles.ts`, `RecordingScreen/RecordingTimingWarnings.tsx`, `PlayerScreen/components/StemAlignmentOverlay.tsx`, `RevisitScreen/styles.ts` (7fw/3ff — audit partials), `common/SourceFilterRow.tsx`, `EditorScreen/index.tsx` (the overdub interstitial, see 2.3) |

Then run the detector to catch stragglers: for every `StyleSheet.create` style object containing `fontWeight`, flag it if the same object lacks `fontFamily`. A quick heuristic: `grep -rn "fontWeight" src --include="*.ts*" | grep -v __tests__` and inspect each hit's style block. `src/styles.ts` (130 fw / 131 ff) is *mostly* paired — spot-check rather than assume.

### 2.2 Radii sweep

**Current:** literal `borderRadius` values of 10, 11, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 26 coexist with the token scale (audit counted 19×14, 23×10, 9×17, 9×18…).
**Target:** map every literal to the nearest token — 10/11 → `radii.lg` or `xl` by context (cards → lg 8, sheets → xl 12); 13–18 → `xl` (12); 19–26 → `xl` or keep only for genuine bottom-sheet top corners (a `sheet: 16` token may be worth adding if many sheets legitimately want 16 — decide once, add to tokens, use everywhere). Import `radii` and use the token, not the number. Work file-by-file via `grep -rn "borderRadius: 1[0-9]\|borderRadius: 2[0-9]" src --include="*.ts*" | grep -v __tests__ | grep -v "radii"`.
**Judgment rule:** if unsure, match `SurfaceCard` (8) for card-like surfaces and 12 for modals/sheets. Screenshot before/after for anything that looks materially different.

### 2.3 Editor screen interstitial + loading states

`src/components/EditorScreen/index.tsx` (~line 380): the "Save a combined clip first" overdub-flatten interstitial is inline-styled — bare `fontWeight: "700"` headline, hardcoded `#1b1c1a`/`#524440`. Restyle: PlayfairDisplay headline via `text.cardTitle`-like treatment, token colors, and give the moment some intent (icon, SurfaceCard framing) — it's a full-screen state users hit at a decision point. Also the "Analyzing audio..." loading state (bare spinner + unstyled text) → tokened text, consistent with other loading states.

### 2.4 One-off color sweep in the player orbit

`playerScreenStyles` (`src/components/PlayerScreen/styles.ts`) is token-based — leave its tints alone. The drift is in satellites: `OverdubLayerCard.tsx` (31 hexes), `StemAlignmentOverlay.tsx` (8), `PlayerPracticePanel.tsx` (`#A8443A` delete icons → `colors.danger`; `PLAYHEAD_COLOR #d95b56` — keep, but hoist into tokens as e.g. `colors.playhead` so it's named). Replace grays/charcoals with the matching `colors.*`; keep genuinely functional colors (waveform tints, section colors from `playerSections.ts`, workspace hues from `workspaceTheme.ts`).

### 2.5 Status bar on every screen

**Current:** `<ExpoStatusBar style="dark">` appears on only ~10 screens; Android is edge-to-edge (`edgeToEdgeEnabled: true`) so unset screens risk wrong icon contrast.
**Target:** the app is light-only (`userInterfaceStyle: "light"`) — set the status bar **once** at the root: `<StatusBar style="dark" />` inside `AppContent` in `App.tsx`, then delete the per-screen instances (grep `ExpoStatusBar\|expo-status-bar` — 10 files listed in the audit). Verify no screen needed a different style (none should; there are no dark screens).

### 2.6 Dialog/sheet consistency spot-check

All confirmations must go through `AppAlert`/`AppDialog`, bottom sheets through `common/BottomSheet.tsx`, modals through `WarmModal.tsx`. Grep for raw `Modal` imports outside those wrappers (`grep -rln '"react-native"' src/components --include="*.tsx" | xargs grep -l "Modal,"`) and assess each: is it styled to match (paper bg, token radii, PlusJakartaSans)? Fix outliers. Known users of raw `Modal`: `PlayerPracticePanel` (via WarmModal — fine), check `EditorExportModal` and export progress modals.

## Verification

- [ ] Detector pass: no style object with `fontWeight` lacking `fontFamily` outside `src/styles.ts` verified pairs
- [ ] `grep -rn "borderRadius: 1[3-9]\|borderRadius: 2[0-9]" src --include="*.ts*" | grep -v __tests__ | grep -v radii | grep -v round` → empty (or documented exceptions)
- [ ] `npx tsc --noEmit` + `npx jest` green
- [ ] Device walkthrough of every touched screen (metronome, tuner, calibration, recording sheet, overdub card, editor incl. both export modals, search, activity, share import) — screenshots into the PR
- [ ] `grep -rn "#b91c1c\|#A8443A" src` → only tokens.ts

## Out of scope

Adding animation/haptics (Phase 3); refactoring `src/styles.ts` (6,108 lines) into per-screen files — **do not attempt**; only fix leaks in place. New screens should use local token-based styles per house rules.
