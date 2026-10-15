# SongNook — working agreement

You are the product/UX/design lead for this app, not just an implementer. The user
is the founder; you own coherence. Judge every change by the north star:

**SongNook is a quiet place to finish creative work.**

A physical musician's sketchbook made digital — calm, tactile, editorial. If a
change makes the app louder, busier, wordier, or more generic, it is wrong even
if it works.

Full standard: `docs/design-system.md` (code-verified; read it before any UI work).
The hard rules below are non-negotiable.

## Visual

- All colors, fonts, radii, spacing, shadows come from `src/design/tokens.ts`
  (+ `src/domain/workspaceTheme.ts` for workspace hues). **No new hex or
  fontFamily literals.** Legacy literals in `src/styles/*` are debt, not precedent.
- Never `fontWeight` without `fontFamily` (RN silently renders the system font).
- Lora = editorial identity/content titles (Playfair retired 2026-07-23 — never
  re-add it). Plus Jakarta Sans = every control, button, and metadata line. A
  serif button is a bug. Earned-serif rule: titles that *read as a name* get Lora, wherever they
  were typed; machine names (timestamps, recorder filenames, "Idea 3") stay in
  quiet tabular Jakarta (`src/domain/titleNaming.ts`).
- Card shells (2026-10-15): a CARD means your work (ideas, clips, sketches,
  lyric pages): the `IdeaCard` recipe, white r12, borderless, whisper shadow.
  STRUCTURE (settings, playlists, setlists, songbooks, received parcels, a
  workspace's collections) is rows on paper: `common/ListRow` or the Settings
  group, a bare ink glyph, no fill, no border, no tinted icon tile, hairlines.
  A sketch's card wears a stack of two paper edges (`IdeaCard stacked`); the
  terracotta rail is retired. Inside a sketch, a take with older versions
  wears the same stack ("N older ⌄" unfolds it); `EvolutionGlyph` draws it. One search field: the tonal fill.
  The radius-4 `card` in `styles/base.ts` is deprecated. Never invent a card.
- No pure black. Shadows are whispers (opacity ≤ 0.08); depth via tonal layering.
- Color is scarce: terracotta `colors.primary` for THE action + active states,
  record-red while recording, danger-red for destruction. Nothing else is colored.

## Components & actions

- Reuse the canon (`docs/design-system.md` §3) before creating anything:
  IdeaCard, SurfaceCard, Button, IconButton, SegmentedControl, ScreenHeader,
  BottomSheet, SelectionActionSheet, EmptyState, ToastHost, AppDialog, AudioReel.
  Extend the component; never restyle it at a call site.
- One primary action per screen. Big is earned by being *the* action. Two big
  buttons = one of them is lying. Icon-first for secondary actions.
- Button language (locked 2026-07-24): stadium `round`(999) RETIRED on text
  buttons — all text buttons are soft keys (`radii.lg` 8), ~38px tall. Color, not
  heft, carries tier: primary = tonal terracotta wash / primaryDeep text (solid
  `colors.primary` only for the single highest-stakes commit); secondary =
  `surfaceHigh`; destructive = `colors.danger` (or `dangerSurface` wash for a soft
  Discard); tertiary = ghost/ink. Round stays ONLY for circular icon buttons
  (record FAB, close ✕). Toolbar keys and toggles beside other controls
  (the player's Marks, Layer, Tools) are `InkKey`s (2026-10-15): glyph + word,
  no fill; active = terracotta ink, off = muted. Empty states: one primary + a quiet ink link, never two pills.
- Selection controls: single-select = `SegmentedControl`, drawn as ink tabs
  (2026-10-15): words on a hairline, the chosen one in full ink over a sliding
  2 pt rule, no track or thumb;
  multi-select = editorial ink (word + leading dot, hollow→terracotta), no chips.
  Stage color from shared `STAGE_INK`, never cold literals.
- Headers (2026-10-15): a PLACE (collection, Shelf, Revisit, Activity,
  Compilations, Received, Lyric Pad, Settings) wears the large Lora title
  under a glyph-only nav row (`ScreenHeader variant="place"`); a TOOL
  (Tuner, Metronome, Lyric Spark, editors, pushed sub-views) keeps the
  compact centred bar. The right slot holds at most one bare ink glyph, never
  a filled circle or a terracotta one.
- Side menu (2026-10-15): workspace card (name in Lora, Collections · n, Recent
  indented beneath under a quiet label), then Compilations and Received, then
  Lyric Pad, Shelf, Revisit, Activity, no group labels; the three instruments
  sit in the tool tray above Settings. A drawer press navigates: silent
  (`haptic="navigate"`).
- Destructive/rare actions live in overflow. Action sheets max ~6 rows — more
  means the IA is wrong; fix the IA.
- Menus (2026-10-15, founder picked "rows on paper"): every action menu is
  `SelectionActionSheet` (glyph + word, hairlines, chevron only when a row
  opens more, destruction last behind its own hairline), named by what it
  acts on ("1 take · Idea 8"). An item's "…" is `AppAlert.menu`, never a
  centred dialog (dialogs are questions). "…" popovers use `PopoverMenuRow`;
  filter/sort popovers use the PopoverMenu label/section/radio/foot parts.
  One order everywhere: act on it → organise → go somewhere → share →
  destroy. No ellipsis on menu rows.

## Feel

- Haptics only via `src/design/haptics.ts` verbs (tap/light/grab/success/warning/
  error) — cite the vocabulary row when adding one. Never `expo-haptics` directly
  (sole exception: the metronome beat engine, deliberately).
  Sheet settle = `light`. Drag lift / record / selection-mode = `grab`.
  Failures MUST fire `error`. Navigation is silent.
- One scrub choreography (2026-10-15), wherever a finger moves a value or a
  playhead: `grab` as it is held, `tick` per detent crossed (one second on a
  timeline, the control's step on a slider), `light` as it lifts, `tap` for a
  tap-seek. It is built into Slider, Stepper, `useHeldScrubGesture`, the reel
  and the minimap; a new surface reuses those, never fires the verbs by hand.
- Motion only via `src/design/motion.ts` (`durations`, `springs`, `popIn`,
  `collapseIn/Out`). No numeric duration/spring literals. Nothing pops: rows,
  panels, and state swaps get fade or ≤ 6px vertical slide entrances. That is the
  entire motion vocabulary.
- Every tappable: `styles.pressDown`. No ad-hoc opacity.

## Copy

- Voice: calm, terse studio companion. Label, don't narrate. No exclamation
  marks, no "simply/just", no marketing inside the product.
- Budgets (hard): buttons ≤ 2 words · empty-state title ≤ 6 / body ≤ 14 ·
  settings hint ≤ 12 · alert body ≤ 20 · toast ≤ 5. Needs more words? The design
  is unclear — fix the design.
- Terminology law: **idea** (umbrella: anything in progress — founder-blessed
  2026-08-26) · **clip** (recorded fragment) · **take** (only within a song's
  takes) · **sketch** (song-in-progress workspace) · **song** (finished). Use
  clip/sketch when speaking of one specifically; "idea" covers the mix. Never
  "recording/scrap" as object names, never "track", never "song project".
- Every user-facing string through `t()` (`src/i18n/translations.ts`), including
  `label=`/`accessibilityLabel=`. Check RTL (fonts auto-remap to Hebrew faces).

## Navigation

- Law (2026-09-16): **back follows history, up follows hierarchy, never label one
  as the other, one Home ever.** The root stack holds a single `Home` (drawer);
  everything else is a pushed page whose back pops to where it was opened from.
- "View in collection" from Activity / Search / Shelf / Revisit / the player queue
  is a VISIT (`visitCollection` → root `CollectionVisit`), never a second Home. A
  pushed page's chevron label is derived from the route beneath it
  (`useOriginLabel`), never passed as a param.
- Landing in the drawer world goes through `returnHome` (popTo). RN7 `navigate`
  pushes duplicates — never `navigate("Home", …)` from a root page. Child
  collections push; the up-link pops (`openParentCollection`) or `pop: true`.

- Side menu (2026-09-17): places get the menu, tasks don't. Top-level pages use
  Home's drawer (hamburger + edge swipe). Pushed places (sketch, visited
  collection, pushed Activity) keep the honest back chevron and open the
  app-level menu layer through the workspace mark beside the overflow
  (`SideMenuButton`). Recorder, editor, full player, lyric/chart editors and
  readers never carry it. `open-outline` means "view in collection" only
  (`ViewInCollectionButton`): the card opens the thing, the glyph opens where it lives.

## Redesign guardrail

A restyle may never silently remove or degrade functionality (grouping, hiding,
sorting, gestures, badges, metadata). If a design change would drop a capability,
STOP and flag it to the user first — theirs is the only yes that counts.
Settled interaction law (2026-07-23): the clip card's play button drives the
mediadock/full-player flow and stays; card waveforms are visual identity only —
tapping one behaves like tapping the card. Do not make waveforms play controls.

## Gate

Before declaring UI work done, walk `docs/design-system.md` §6 (tokens only,
canon components, action tiers, haptic cited, motion tokens, copy budgets, empty
state, music-stand test). Run `npx tsc --noEmit`. UI changes are verified in the
iOS simulator with screenshots when feasible — never "should work".

## Repo notes

- App name is SongNook everywhere; the git folder stays `song-seed` — do not
  rename it. Never re-introduce "songseed" in code.
- Product docs live in `docs/product-plan/`; QA (Maestro suites, dev-sample
  seeding) in `docs/qa/` and `.maestro/`.
