# SongNook Design System

**North star: a quiet place to finish creative work.**

SongNook is a physical musician's sketchbook made digital — intentional, tactile,
editorial. Every decision below serves that sentence. When a rule here conflicts
with something in the code, the rule wins for new work; the code gets a punch-list
entry.

This document is the single source of truth for visual language, interaction
feedback, copy voice, and component reuse. It is code-verified (2026-07-23).
The condensed enforceable version lives in the repo-root `CLAUDE.md`; agents load
that automatically and come here for detail.

---

## 1. Principles

1. **Simplicity** — clarity over features; complex UI hides behind progressive disclosure.
2. **Creative focus** — audio ideas, lyrics, and creative evolution always outrank configuration and metadata.
3. **Progressive disclosure** — show only what the moment needs; advanced actions live in overflow.
4. **Predictability** — one interaction model everywhere; shared patterns behave identically on every screen.
5. **Calm** — quiet, focused, inviting. No bright colors, heavy decoration, or dashboard density. The app should feel like opening a notebook, not launching software.

A litmus test for any screen: *could this sit open on a music stand without
distracting from the instrument?*

---

## 2. Visual language

Source of truth: `src/design/tokens.ts`. This section mirrors it; if they ever
disagree, fix one of them in the same commit.

### Color

| Token | Value | Use |
|---|---|---|
| `colors.page` | `#FDFBF7` | Base page background |
| `colors.surface` | `#FFFFFF` | Lifted cards/sheets |
| `colors.surfaceContainer` | `#F4F1ED` | Sub-nav, segmented tracks, utility bg |
| `colors.surfaceHigh` | `#EDE9E4` | Secondary buttons, hover/selected fills |
| `colors.textPrimary` | `#1b1c1a` | Primary text (warm charcoal — never pure black) |
| `colors.textSecondary` | `#84736f` | Secondary text, muted icons |
| `colors.textMuted` | `#a89994` | Tertiary/annotation text |
| `colors.textStrong` | `#524440` | Emphasis within UI chrome |
| `colors.primary` | `#B87D6B` | The one terracotta accent |
| `colors.primaryDeep` | `#824F3F` | Accent-tone icons, dense accents |
| `colors.record` / `recordSurface` / `recordBorder` | `#C0453B` / `#FCF2F0` / `#EBD3CE` | Recording state only |
| `colors.playhead` | `#D95B56` | Playback position only |
| `colors.danger` / `dangerSurface` | `#A8443A` / `#FBEFEC` | Destructive only |
| `colors.borderSubtle` / `borderMuted` | `#E8E4DF` / `#D7C2BD` | Technical lines |

Rules:
- **No new hex literals outside `tokens.ts` / `workspaceTheme.ts`.** Import `colors`. (~1,000 legacy literals exist in `src/styles/*`; they are debt, not precedent.)
- Color is scarce: terracotta for the primary action + active states, record-red for recording, danger-red for destruction. Everything else is warm neutral.
- Workspace accent colors come from `src/domain/workspaceTheme.ts` (7 earthy hues) — never invent an eighth.

### Typography

Fonts: **Lora** (serif — decided 2026-07-23, replacing Playfair Display app-wide)
+ **Plus Jakarta Sans** (UI). Under RTL these keys auto-remap to
FrankRuhlLibre/Heebo in `App.tsx` — always use the Latin family keys or `text.*`
tokens, never the Hebrew keys directly.

**The earned serif (decided 2026-07-23):** the serif belongs to what the user
made *and named*. Named clips/songs render titles in Lora; auto-named clips show
their timestamp name in quiet tabular Jakarta until the user claims them with a
name. Chrome, buttons, and metadata are always Jakarta — a serif button is a bug.

| Token | Face | Size/LH | Use |
|---|---|---|---|
| `text.pageTitle` | Lora 500 | 48/48 | Main-screen editorial titles only |
| `text.headerTitle` | Lora 600 | 22 | Secondary-screen headers (`ScreenHeader`) |
| `text.cardTitle` | Lora 500 | 30/36 | Large card headings (workspace cards) |
| `text.sectionTitle` | Jakarta 700 | 10, +1.0, CAPS | Uppercase metadata labels |
| `text.body` | Jakarta 400 | 14 | Body copy |
| `text.supporting` | Jakarta 400 | 13 | Secondary descriptions |
| `text.caption` | Jakarta 600 | 12 | Compact labels |
| `text.annotation` | Jakarta 600 | 10, +0.8, CAPS | Eyebrows, badges |

Rules:
- Prefer `text.*` tokens; when a bespoke size is unavoidable, still use the family constants.
- **Never `fontWeight` without `fontFamily`** — RN falls back to the system font (the "random font" bug).
- Numbers that update or align (durations, counts) get `fontVariant: ["tabular-nums"]`.
- Lora is for *content and identity* (titles of things the user made, screen identity). UI controls, buttons, and metadata are always Jakarta. If a button is in a serif, it's wrong.
- Never re-introduce Playfair Display — retired 2026-07-23 (too theatrical at content sizes).

### Shape & depth

Working canon (the overall visual concept is under active review in the v1
audit — until that concludes, this is law):

| Shell | Radius | Recipe | Use |
|---|---|---|---|
| **Content card** (`IdeaCard` shell, `styles/ideasList.ts`) | 12 | white, 1px `rgba(215,194,189,0.18)`, whisper shadow | Clips, songs, list content — anything the user made |
| **Structural card** (`common/SurfaceCard.tsx`) | 8 (`radii.lg`) | white, 1px `rgba(215,194,189,0.1)`, `shadows.card` | Settings groups, detail panels, scaffolding |
| Chips/pills | `radii.md` 6 / `round` 999 | — | Badges, segmented, pill buttons |
| Sheets | 18 top corners | `BottomSheet` | All bottom sheets |

- The generic radius-4 `card` style in `styles/base.ts` is **deprecated** — do not use it in new work.
- One-off card recipes (`WorkspaceCard`, `WorkspaceCollectionCard`, `OverdubLayerCard`) are known deviations slated for normalization; do not copy them.
- Shadows are ambient whispers (`shadows.*`, opacity ≤ 0.08). Depth comes primarily from tonal layering (white on `#FDFBF7`), not shadow.
- No pure black, anywhere, ever.

---

## 3. Component canon

**Reuse before creating. Restyle nothing inline.** If a canon component can't do
what you need, extend the component — never fork its look at the call site.

### The clip card (locked 2026-07-23)

One recipe everywhere (collection, version history, Activity, Revisit) — only the
meta cluster's contents vary per context:

- **Shell:** white, r12, **borderless**, whisper shadow (`0 2 8 rgba(61,55,50,.06)`).
  The resting card has zero lines on it.
- **Three rows, always:** title+duration · waveform strip · meta. Never a fourth
  row for chrome.
- **Title:** earned serif — named → Lora; auto-named → timestamp in tabular
  Jakarta. Duration top-right, tabular.
- **Waveform strip** (~22px, from sidecar peaks): visual identity at rest — tap
  behaves like tapping the card. Goes live (progress tint + drag-to-scrub) ONLY
  while this card is the active preview.
- **Meta row:** time-of-day left ("just now" only within the first minute) ·
  right cluster: stage dot · ♪ N takes · bookmark — glyphs, no pills.
- **Play button:** bare glyph (no circle/border), 44pt hit area, flips to pause
  while previewing. Drives the preview session; the mediadock/full-player flow is
  untouched and sacred.
- **Sketch tell (exclusivity rule):** ONLY sketches get the workspace-color left
  spine (3.5px) + semibold title + ♪ N. No clip ever gets a spine.
- **Preview session:** card play pauses the queue dock, which minimizes to a
  controls-free pill; ✕/pill restores the dock paused (never auto-resume). One
  transport visible at a time.

### The sketch page (locked 2026-07-26)

- **Eyebrow says SKETCH** (`brand.sketch`), never SONG — the workspace object is
  a sketch; "song" is reserved for the finished thing. Overflow rows follow:
  "Edit sketch" / "Make sketch" / "Delete sketch".
- **Stage is ink, not a chip:** dot + uppercase word in the stage's `STAGE_INK`
  hue, display-only under the title (edited in the edit sheet). No gray pill.
- **Takes, not "Ideas":** the list section header inside a sketch is TAKES
  (`screens.takes`); clip-detail replies use `songDetail.replies`. Both via `t()`.
- **Primary-take strip:** bare glyph play (no filled circle), PRIMARY TAKE label
  in caps Jakarta, earned-serif title (Lora only when hand-named), locate glyph.
- **Toolbar:** view switch = canon `SegmentedControl`; sort (direction arrow) and
  filter (funnel) are bare `IconButton` glyphs on the trailing edge — active
  filter is told by filled glyph + terracotta ink. No circle chips.
- **One FAB:** record stands alone; Import lives in the header overflow.

### Layout stability law (locked 2026-07-27)

State changes must never resize a surface. A quiet page is one that doesn't
twitch — the recurring bug class here is a state that *adds* something and
pushes everything below it. Three rules, all violated at least once:

- **Reserve, don't add.** A border that appears on selection is declared at
  rest as `borderWidth: 2, borderColor: "transparent"` (padding reduced to
  match), so turning it on is a colour change. Same for any state ring.
- **Fixed-height zones.** A card's title row, strip zone and bottom zone all
  carry a fixed `minHeight` (26 / 18 / 26). Otherwise the bottom row changes
  height between rest and play (or with/without a soft key), the card's centre
  moves, and the lead play glyph — centred on the card — drifts off the
  waveform's axis.
- **Swap in place, don't insert.** Selection mode replaces the toolbar's
  controls row rather than inserting a bar above the list, so entering
  selection leaves every row exactly where it was.

### The stage dial + title-row law (locked 2026-07-27)

Stage is a **dial**, not a dot: a hollow ring filled clockwise a quarter per
stage (`StageMark`). A single dot could only say "there is a stage"; the wedge
says *which* without being read. Copy is the **distance ladder** —
**Idea · Rough · Close · Song** — each word naming how far the work is from
done. (The songseed-era seed/sprout/stem metaphor was retired with the rename;
the storage keys still read seed/sprout/stem/song and stay that way.) The ink is
one warm hue gaining saturation across the ladder — `textMuted` → `stageMid` →
`stageLate` → `primaryDeep` — so the colour carries the progression on its own.

The dial is display-only. Where stage is *chosen* (edit sheet, collection
filter) the control stays hollow-→-filled selection ink, because there the fill
means "picked", not "progress" — two meanings for one fill would be a bug.

**Title-row law.** A status mark (PRIMARY, stage) rides the title row, just
before the duration — the most-read line on the card, so a rare status lands
without adding a surface. The row is single-line by construction
(`numberOfLines={1}`), so a mark can never wrap to a second row. Squeeze order
is fixed: the **title** takes the room and ellipsizes first, down to a floor of
`minWidth: 88`; past that the mark's **word** truncates (`flexShrink: 1`); the
**glyph never shrinks**, since it carries the meaning alone.

### The stemmed thread (Evolution, locked 2026-07-27)

- **The card is the present.** A multi-version lineage renders as one tinted
  shell; the head card plays the current version and wears its version tag
  ("v2 · Just now") plus its own note. No duplicate row for the current version.
- **The stem is only the past.** A warm line descends from the card through
  hollow nodes (v1, v2…), tap to audition (node fills terracotta while playing),
  long-press to select. The stem never contains the future — actions are not
  timeline events. One older version always shows; ≥2 fold behind
  "N older versions".
- **Version notes** are the clip's own notes field, shown as one italic Lora
  line under the node (`Lora_500Medium_Italic` — a real face, never
  `fontStyle`). Content you wrote earns the serif.
- **"New version" is the thread's action**, labeled in words (mic + two words)
  in the thread footer. Single-version cards carry the same labeled soft key on
  the card itself. The bare unlabeled mic is retired.
- **The recorder names the path:** arriving via "New version" shows
  "NEW VERSION OF ‹take›"; the FAB path keeps "Recording into ‹sketch›".
- **Primary wears a CROWN, never a spine** (locked 2026-07-27): a terracotta
  rule across the card's *top* + `primaryDeep` ink label (dot + word) in the
  same single colour. The left spine stays reserved for the sketch tell — status
  never borrows that device.
- **Stem rows are transports:** each carries a bare play glyph with its own hit
  target, so playback survives selection mode (audition a candidate before you
  commit to it). Same rule on full clip cards. An active row extends into the
  canon `ScrubBar` + ✕, mirroring compact collection rows.
- **Notes** (one treatment app-wide): italic Lora, clamped to 2 lines, with a
  `More`/`Less` affordance shown ONLY when the text truly overflows — measured
  against a hidden unclamped twin, because `onTextLayout` under `numberOfLines`
  only reports drawn lines. The affordance renders OUTSIDE the clamped Text or
  the ellipsis eats it. Expanded caps at 10 lines; longer notes belong to the
  notes sheet. When a search is active, the window slides to the match.
- **Musician words, not git words:** "Link as version of…" (was Set parent),
  "Make its own take" (was Start new thread), versions not "older takes".
  Groups hold whole threads (assignment at lineage level) and count with a
  music-note glyph, never git-branch.

| Need | Use | Notes |
|---|---|---|
| Content card shell | `common/IdeaCard.tsx` | ALL clip/song/content rows funnel here (via `ClipCard`, `InlineIdeaCard`, `IdeaListItem`). Never build a parallel clip card. |
| Structural card | `common/SurfaceCard.tsx` | |
| Buttons | `common/Button.tsx` (soft keys, r8 — tiers primary/secondary/destructive/quiet, see §Button language), `common/IconButton.tsx` (bare glyph, tones accent/muted/strong) | Icon-first: reach for `IconButton` + a conventional glyph before a labeled button. Stadium `round` retired on text buttons. |
| Tabs/modes | `common/SegmentedControl.tsx` | Sliding thumb; pass `persist` (useSegmentedThumb) when the control survives subtree swaps. |
| Screen header | `common/ScreenHeader.tsx` | Secondary screens: back + title (+ subtitle). Main screens: editorial `pageTitle`. There is no `AppHeader`; breadcrumbs component was removed — quiet `A › B` eyebrow text only. |
| Sheets | `common/BottomSheet.tsx` | The only sheet primitive. |
| Action sheets | `common/SelectionActionSheet.tsx` / `modals/ClipActionsSheet.tsx` pattern | **Max ~6 rows.** More than that means the screen's information architecture is wrong — split by intent or promote the top 1–2 actions inline. |
| Overflow | `IconButton` `ellipsis-horizontal` → action sheet | |
| Empty states | `common/EmptyState.tsx` | |
| Toasts | `toastStore` / `ToastHost` | Every background `success` haptic pairs with a toast, never a dialog. |
| Dialogs | `AppDialog` / `WarmModal` | Confirmation only — never for information that could be a toast. |
| Waveform | `common/AudioReel.tsx` | Tap = play/pause, drag = scrub. Everywhere. |

### Button language (locked 2026-07-24)

**The stadium pill is retired.** `radius: round` (999) is banned on text buttons —
it is the single most "framework default" shape and reads as generic. Round stays
ONLY for genuinely circular icon buttons (the record FAB, close ✕). All text
buttons are **soft keys: `radii.lg` (8)**, refined proportions (~38px tall, never
46), color — not heft — carries meaning.

| Tier | Fill | Text | Use |
|---|---|---|---|
| **Primary (default)** | tonal terracotta wash (`#F3E4DE`) | `primaryDeep` | The one action per screen. Warm, unmistakably tappable, never shouty. |
| **Primary (emphasis)** | solid `colors.primary` | `onPrimary` | Reserve for the single highest-stakes commit (Save in a sheet, a paywall CTA). |
| **Secondary** | `surfaceHigh` neutral | `textStrong` | Supporting (Cancel). |
| **Tertiary / quiet** | transparent (ghost/ink) | `primaryDeep` | Low-stakes, links (From Lyrics Pad). Ink = text + terracotta rule. |
| **Destructive** | solid `colors.danger` | `onDanger` | Irreversible confirms (Delete). |
| **Destructive (soft)** | `dangerSurface` wash | `colors.danger` | Reversible (Discard). |
| **Record** | `colors.record` | `onRecord` | Reserved — recording only. |
| **Disabled** | `surfaceHigh`, opacity ~0.55 | `textMuted` | — |

- **One primary action per screen.** Two big buttons = one is lying. An empty
  state gets ONE primary + a quiet ink link, never two competing pills.
- Never a row of equal-weight text buttons; prefer an icon row with one accented member.
- Advanced/destructive/rare actions live in overflow.

### Selection controls (locked 2026-07-24)

Two treatments, used everywhere so single vs. multi reads at a glance:

- **Single-select** (Lyrics-style toggles, Evolution|Timeline, Takes tabs) →
  the sliding-thumb **`SegmentedControl`**. The one single-select primitive.
- **Multi-select** (Stage filter, tag pickers) → **editorial ink**: options as
  words with a leading ink-dot (hollow `borderMuted` → filled `colors.primary`
  when on), generous hit-padding for thumb targets. No capsules, no chips.
- Stage accent color comes from the shared `STAGE_INK` map (`StatusBadge`), never
  cold literals.

---

## 4. Interaction feedback

### Press
Every tappable surface uses `styles.pressDown` (or `pressDownStrong` for large
floating controls). No ad-hoc opacity values.

### Haptics — `src/design/haptics.ts` only

Never import `expo-haptics` directly. The sole sanctioned exception is the
metronome *beat* in `useMetronome.ts` — a musical output with its own intensity
control, deliberately outside the UI toggle.

| Verb | Intent |
|---|---|
| `tap` | Any acknowledged press: buttons, rows, toggles, slider release |
| `light` | Small state flips that should land: favorite, chip select, step/detent boundaries, **sheet settle (open or dismiss)** |
| `grab` | Picking something up: drag lift, entering selection mode, record start/stop |
| `success` | A completion the user waited for — always paired with a toast |
| `warning` | A destructive confirm opening |
| `error` | A failure — **required** on failed saves/exports/imports (currently unwired: debt) |

Rulings (2026-07-23, standardizing prior ambiguity):
- **Sheet settle = `light` everywhere.** Sheets open constantly; a medium thump is not quiet. `grab` is reserved for true lifts. (`PlayerSheet`'s `grab` on settle is now a deviation to fix.)
- Step controls (transpose, speed, pitch): boundary crossings = `light`, release = `tap`. No mixing per screen.
- Terminal states, not motion: gestures fire on settle, never continuously. Repeating ticks throttle ≥ 80ms, manual interaction only.
- Navigation (tab/screen changes) stays silent — arrival is its own feedback.

### Motion — `src/design/motion.ts` only

`durations`: fast 120 (menus/fades) · base 180 (toggles/thumbs) · gentle 220
(docks/sheets) · slow 300 (panel expansion). `springs`: surface / pop / handle.
Entrances: `popIn` (dialogs), `collapseIn`/`collapseOut` (panels, via
`AnimatedCollapse`).

- **No numeric duration or spring literals in new code** — import the tokens. (25 legacy literals across 15 values exist: debt, not precedent.)
- Nothing pops: list rows appearing/disappearing, panels revealing, state swaps all get an entrance/exit (fade or ≤ 6px vertical slide — never horizontal slides, never bounces).
- Fades and small vertical slides are the entire motion vocabulary. Motion explains *where things came from*; it never decorates.

### Sound
No UI sounds. Haptics carry all feel. The metronome click is music, not UI.

---

## 5. Copy & voice

**Voice: a calm, terse studio companion.** Musician-to-musician, lowercase-hearted,
never salesy, never explaining the obvious. The interface labels things; it does
not narrate them.

### Word budgets (hard limits)

| Surface | Budget |
|---|---|
| Button / action label | ≤ 2 words (prefer icon alone) |
| Empty-state title | ≤ 6 words |
| Empty-state body | ≤ 14 words, one sentence, ends with what to *do* |
| Settings row hint | ≤ 12 words — describe the effect, never justify the feature |
| Alert/confirm body | ≤ 20 words: what happens + what's at stake. No triple-clause paragraphs |
| Toast | ≤ 5 words |
| Help sheets (`helpContent`) | The one place longer prose is allowed |

If a string needs more words to be understood, the *design* is unclear — fix the
design, not the copy.

### Terminology canon (decided 2026-07-23)

| Concept | Canonical | Banned as object names |
|---|---|---|
| A recorded audio fragment | **clip** | ~~recording~~ (verb only), ~~idea~~ (the creative concept, not the object), ~~scrap~~ (Cut-Up internal only) |
| A collection list item (umbrella) | **idea** — collection contexts only (the header's "N ideas" counts clips AND sketches with mixed media; decided 2026-07-23) | never replaces **clip** as the recorded-fragment object name |
| A take of a song | **take** — only inside a song's takes context | |
| A song-in-progress container | **sketch** (workspace UI) | ~~song project~~ |
| A finished song | **song** | ~~track~~ |
| Collections | workspace › collection; songbook / setlist / playlist as themselves | |

### Mechanics
- **All user-facing strings go through `t()`** — including `label=` and `accessibilityLabel=` props. No inline English prose in components.
- One term per concept per sentence. Never "hum the idea — your first take lands here."
- No exclamation marks. No "simply/just/easily." No feature marketing inside the product.

---

## 6. Screen ship checklist (the gate)

Any PR touching UI passes ALL of these before merge:

1. Colors/fonts/radii/spacing from tokens — zero new literals.
2. Built from canon components — no inline restyling, no new one-off cards.
3. One primary action; destructive/rare actions in overflow; action sheets ≤ 6 rows.
4. Every interactive element: `pressDown` + a cited haptic verb from the table.
5. All motion uses `durations`/`springs`/presets; nothing pops in or out.
6. Copy within budgets, terminology canon respected, everything through `t()`, checked in RTL.
7. Empty state exists and is quiet (≤ 6 + ≤ 14 words).
8. Screen passes the music-stand test.

---

## 7. Known debt registry (do not copy these patterns)

- ~1,000 hex literals + ~860 fontFamily literals in `src/styles/*` and screen styles — migrate opportunistically when touching a file.
- `haptic.error` unwired; `PlayerSheet` settle uses `grab`; transpose mixes `tap`/`light` in `EditorScreen`.
- 25 hardcoded motion durations; two animation systems (RN Animated + Reanimated) with divergent spring configs; Settings/Tuner/Shelf/list-mutations have no transitions.
- Copy: `workspaceArchive/*` + `settingsBackup/*` clusters exceed budgets; `library/tracks_one` says "track"; Library empty states + `AppErrorBoundary` + mini-game `label=` props bypass i18n.
- One `fontWeight`-without-family at `IdeaListScreen/components/CollectionScreenContent.tsx:101`.
- Card one-offs: `WorkspaceCard`, `WorkspaceCollectionCard`, `OverdubLayerCard`.
