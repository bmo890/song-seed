# Phase 4 — First-Run Experience & Help

**Effort:** ~1 week · **Dependencies:** Phase 0 (splash/error shell), Phase 2 preferred (visual language settled before new screens are built)

## Purpose

A brand-new user currently opens SongNook to a bare list screen reading **"No active workspaces. Tap + to create one."** — that is the entire welcome. The app's model (workspaces → collections → ideas → clips, plus takes/overdubs/practice tools) is concept-heavy, and the first five minutes decide the store review. This phase builds the shortest path from install → first recording, plus contextual help for the flows that have none.

## Background you need

- **Data model:** a *workspace* is a top-level project space (has color/avatar, from `src/workspaceTheme.ts` — 7 earthy hues); *collections* nest inside (hierarchy in `src/hierarchy.ts`); *ideas* hold *clips* (audio takes); clips can carry overdub layers, lyrics link at the idea level. Creation actions live in `src/state/actions.ts` (`appActions`) and the store slices.
- **Startup routing:** `App.tsx` `resolveStartupWorkspaceId` + `buildStartupNavigationState` decide where the app opens (primary workspace / last used / Home per the `workspaceStartupPreference` setting). With zero workspaces it lands on `WorkspaceListScreen`.
- **Persistence pattern for new flags:** any new persisted field (e.g. `hasSeenWelcome`) must be added in **four places**: `src/state/dataSlice.ts` (type + initial + setter), `src/state/persistedSnapshot.ts`, `src/state/storeTypes.ts` (persisted-keys union), and hydration fallback in `src/state/useStore.ts`. Follow the `promptForClipName` commit as the template (`git log -S promptForClipName`).
- **Help pattern already exists:** `src/components/common/HelpSheet.tsx` — a styled bottom-sheet host; see `CutUpScreen/components/CutUpHelpSheet.tsx`, `MagpieScreen/.../MagpieHelpSheet.tsx`, `WordLadderScreen/.../WordLadderHelpSheet.tsx` for the established content pattern (sections of short heading + body copy) and how the trigger button is placed in the screen header. **Reuse this exactly** — do not invent a second help system.
- **Empty-state reality:** only 6 files in `src/components/` render designed empty states. Most list surfaces show blank regions or one bare `<Text>`.
- **Design language for new UI:** tokens (`src/design/tokens.ts`), PageIntro/SectionHeader/SurfaceCard/Button in `src/components/common/`, dialogs via AppAlert. PlayfairDisplay for headlines. Fades/vertical slides only.

## Work items

### 4.1 Starter workspace auto-creation (highest-value item, do first)

**Current:** first launch requires the user to invent a workspace name before they can do anything — friction at the exact moment motivation is highest.
**Target:** on first launch with zero workspaces (guard: run once, after hydration, only when `workspaces.length === 0` **and** the shadow manifest is also empty — do not fight the empty-library restore prompt in `App.tsx`; check `readManifest` the same way that flow does), auto-create one workspace ("My Songs", default terracotta) with one collection ("Ideas"), set it primary, and route startup into it. Result: the record button is one tap from first launch.
**Care:** this writes to the persisted store — reuse existing creation actions from `appActions`/slices rather than hand-rolling state, so activity events/manifest sync happen normally. Add a unit test for the "when to seed" decision function (pure: `shouldSeedStarterWorkspace(workspaces, manifestIdeaCount)`).

### 4.2 Welcome flow (2–3 screens, once)

**Target:** a lightweight intro shown once before the seeded workspace appears. 2–3 panes, swipeable, skippable ("Skip" top-right on every pane):
1. **Capture** — "Your ideas, the moment they happen." (record motif)
2. **Grow** — "Takes, lyrics, versions — one idea, one place." (workspace/collection motif)
3. **Practice** — "Loop it, slow it, pitch it, learn it." (practice motif) → CTA "Start"
Visuals: paper background, PlayfairDisplay headlines, one-line PlusJakartaSans body each, terracotta accents; simple fade/slide between panes (Reanimated); page dots. No permissions requested here (mic permission stays just-in-time in the recording flow — it already handles denial well).
**Mechanics:** persisted `hasSeenWelcome` flag (four-place pattern above); render the welcome as a full-screen overlay/gate inside `AppContent` before the NavigationContainer becomes interactive (similar layering to `RestoreRestartGate` — read that component first). Also add "Replay intro" row in Settings → About so it's re-viewable and testable.
**Acceptance:** fresh install → splash → welcome → "Start" → lands in seeded workspace; kill/relaunch → no welcome; restore-from-backup path never shows welcome over the restore prompt.

### 4.3 Teaching empty states

Give each major surface a designed empty state: icon (Ionicons, muted), one PlayfairDisplay-adjacent line, one supporting sentence, and — where sensible — an action button. Surfaces + suggested copy direction:

| Surface | File(s) | Message direction |
|---|---|---|
| Collection with no ideas | `IdeaListScreen/components/CollectionScreenContent.tsx` | "Nothing here yet — tap record and hum it." + Record CTA |
| Library (playlists/songbooks/setlists empty) | `LibraryScreen/` per-tab | What each container is *for*, one line each |
| Search before query / no results | `SearchScreen/components/SearchScreenContent.tsx` | Before: what's searchable. No-results: suggest fewer words |
| Revisit with nothing to resurface | `RevisitScreen/` | Explain revisit's purpose ("old ideas resurface here after they've rested") |
| Activity empty | `ActivityScreen/` | One line + how activity accrues |
| Notepad/word tools empty lists | `NotepadScreen/`, spark screens | Mostly have flows — verify, fill gaps |
| Overdub layer list empty | `PlayerScreen` overdub section | "Layer a harmony over this take" + add-layer CTA |

Build one shared `EmptyState` component (`src/components/common/EmptyState.tsx` — icon/title/body/action props) so they're consistent; check first whether a partial pattern already exists in the 6 files that have empty states and consolidate.

### 4.4 Help sheets for the tool-dense flows

The word tools have help; the audio flows don't. Using the existing HelpSheet pattern (trigger: the same help-icon placement the word tools use), write four:

1. **Recording** (`RecordingScreen`): count-in & metronome behavior, what happens on save (naming setting), background recording, input picker + Bluetooth calibration pointer.
2. **Full player / practice** (`PlayerScreen` — likely trigger in the practice panel header): sections vs pins vs loop; speed & pitch practice (and that it doesn't alter the clip); analysis (key/BPM detection) and its limits.
3. **Overdub layers** (overdub section of PlayerScreen): the mental model — layers ride the root take; mute/solo/levels; **why timing edits require flattening first** (this exact confusion has a full-screen interstitial in the editor; the help sheet should pre-empt it); alignment/nudge.
4. **Trim editor** (`EditorScreen`): keep vs remove intent, regions, what export does (new clip vs replace, the "remove original" toggle), speed & pitch save behavior.

Content rule: short sections, verb-first headings, ≤3 sentences each — match the tone of `CutUpHelpSheet`.

### 4.5 Store-review prompt

`npx expo install expo-store-review`. Trigger after a *positive* moment: suggested rule — 10th saved clip AND ≥5 days since install AND never asked before (persisted `reviewPromptShownAt`; the clip-count can derive from live store data, days-since-install needs a persisted `firstLaunchAt`, set in 4.1's seed moment). Call `StoreReview.requestReview()` — the OS decides whether to actually show; never gate app function on it, never ask after an error, cap at the OS's own limits (iOS ~3/year). Wire the trigger check where clips are saved (the save path in `RecordingScreen`/`appActions`) but keep the decision logic in a pure, tested function.

## Verification

- [ ] Fresh-install walkthrough on both platforms: splash → welcome → seeded workspace → record a clip within ~30 seconds and 3 taps from cold start
- [ ] Welcome never reappears; replayable from Settings; never collides with the empty-library restore prompt or recording-recovery dialogs (test order-of-operations by simulating each)
- [ ] All empty states shot on device and attached to PR; VoiceOver/TalkBack reads them sensibly
- [ ] All four help sheets reviewed for copy accuracy by the owner (behavior claims must match actual behavior)
- [ ] Persistence: new flags survive restart; `npx jest` green with new tests for seed-decision + review-prompt logic; snapshot version untouched (new optional fields must hydrate-fallback cleanly for existing users — verify upgrading an existing install doesn't re-trigger welcome; `hasSeenWelcome` should default **true when workspaces exist** for exactly this reason)

## Out of scope

Interactive coach-marks/tooltips overlaying real UI (high effort, post-launch); video tutorials; localization (the app is English-only for v1 — flag copy centralization as future work).
