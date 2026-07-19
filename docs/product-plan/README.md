# SongNook — MVP Launch Product Plan

**Created:** 2026-07-11 · **Source:** full codebase audit (typecheck clean, 359/359 tests green at time of writing)
**Goal:** take SongNook from a feature-complete Android dev build to a shipped, premium-feeling app on both the App Store and Play Store.

## What this app is (read this first if you're new)

SongNook is a **local-first songwriting capture app** for React Native / Expo SDK 54 (React 19, RN 0.81, New Architecture enabled). Musicians record ideas, organize them into workspaces → collections → ideas → clips, grow them with lyrics/chords/practice tools/overdub layers, and back everything up to files they control. There are **no accounts and no backend** — the only network calls are word lookups (Datamuse) and public-domain book text (Gutenberg) for the lyric-spark tools.

Key architecture facts every phase touches:

| Thing | Where | Notes |
|---|---|---|
| State | `src/state/` — Zustand store, slices in `dataSlice.ts`/`playerSlice.ts`/etc., actions god-file `actions.ts` | Persisted via custom SQLite snapshot layer (`persistedSnapshot.ts`, `db/storage.ts`). Hydration-gated in `App.tsx` — never mount screens pre-hydration. |
| Design system | `src/design/tokens.ts` (colors/text/radii/shadows), `src/design/haptics.ts`, `src/design/motion.ts` | "Nocturne Paper": paper `#FDFBF7`, terracotta primary `#B87D6B`, fonts **PlayfairDisplay** (display) + **PlusJakartaSans** (UI). Canonical card = `src/components/common/SurfaceCard.tsx` (radius 8, 1px faint border, ambient shadow). |
| Dialogs | `src/components/common/AppAlert.ts` + `AppDialog.tsx` | Styled in-app dialog system. **Raw `Alert.alert` is banned** per the doc comment in AppAlert. |
| Recording | `@siteed/audio-studio` (patched — Android only, see `patches/`) via `src/hooks/useRecording.ts` | Background recording enabled; recording-session crash recovery in `src/services/recordingRecovery.ts`. |
| Playback | `expo-audio` via `src/hooks/useFullPlayer.ts` + `useInlinePlayer.ts`; global mini-player `GlobalMediaDock.tsx`; full player is the `PlayerSheet.tsx` overlay (NOT a route) | Audio session roles arbitrated in `src/services/audioSession.ts`. |
| Custom native modules | `modules/songnook-metronome`, `modules/songnook-pitch-shift` (both have Android + iOS Swift), `modules/songnook-file-io` (**Android-only by design** — SAF streaming; iOS uses share-sheet path in `src/services/archiveSave.ts`) | Waveforms decode through pitch-shift module's `computeWaveform` with `@siteed` `extractPreview` fallback (`src/services/waveformAnalysis.ts`). |
| Backups | `src/services/libraryBackup.ts`, `libraryExport.ts`, `libraryImport.ts`, `libraryMergeRestore.ts`, disaster-recovery services | This is the app's data-safety story. Treat with extreme care; extensive tests exist in `src/services/__tests__/`. |
| Monetization seam | `src/entitlements.ts` (`ALL_FEATURES_FREE = true` stub) + `src/components/common/ProGate.tsx` (built, unused) | Feature keys `"cloud-backup" | "auto-backup"` already typed. |

**House rules:** no raw `Alert.alert`; new styles use tokens (never bare `fontWeight` without `fontFamily` — see Phase 2 for why); stage git changes by explicit path (never `git add -A`); run `npx tsc --noEmit` and `npx jest` before any commit; data-safety code (backup/export/restore) requires a test for every behavior change.

## The phases

| Phase | Ticket | Effort | Needs | Blocks |
|---|---|---|---|---|
| **0.0** | [Name & brand lock](phase-0.0-name-and-brand-lock.md) | ~1–2 days + clearance | Nothing | **Everything** — must resolve first |
| 0 | [Store blockers & safety nets](phase-0-blockers-and-safety-nets.md) | ~1 week | Nothing (all Android-verifiable) | Everything |
| 1 | [iOS bring-up](phase-1-ios-bring-up.md) | ~1 week | Mac + iPhone + Apple Dev account | Phase 5 |
| 2 | [Brand unification pass](phase-2-brand-unification.md) | ~1 week | Nothing | — |
| 3 | [Interaction polish](phase-3-interaction-polish.md) | ~1 week | Physical device (haptics) | — |
| 4 | [First-run experience & help](phase-4-first-run-and-help.md) | ~1 week | Phases 0, 2 (visual language settled) | — |
| 5 | [Launch prep & store submission](phase-5-launch-prep.md) | ~3–4 days | Phases 0–4 | Launch |
| 6 | [Monetization](phase-6-monetization.md) | ~2 weeks | Launched app, 2–4 weeks of reviews | — |

Phase 0.0 (name/brand lock) **must resolve before Phase 0 begins** — the name is baked into the icon, splash, privacy policy, EAS config, and native projects, and bundle identifiers become permanent at first submission (Phase 5). Phases 2, 3, 4 are parallelizable across engineers once Phase 0 lands. Phase 1 is independent and should start as soon as hardware exists.
