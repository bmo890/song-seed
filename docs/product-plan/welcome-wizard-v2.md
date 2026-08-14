# Welcome Wizard v2 — teach the nouns once, teach the verbs in place

**Status:** proposal · **Effort:** ~3–4 days · **Depends on:** nothing (all machinery ships today)

## Founder request

Explain the big ideas — workspace, collection, clip vs sketch — then, inside the
sketch, clip versioning and lyric writing (tools, Lyric Spark, versions). Not
dense; people skip these quickly. Maybe a note on Shelf and Revisit.

## Where we are today

A welcome wizard already ships. `src/components/common/WelcomeFlow.tsx` renders
four swipeable panes over the app on first launch (gated by persisted
`hasSeenWelcome`, replayable from Settings → About → "Replay intro", covered by
`.maestro/flows/01-first-run-welcome.yaml`):

1. **Capture** — "Catch the spark"
2. **Develop** — "Shape every idea" (takes/lyrics/chords/versions in one line)
3. **Practice** — "Make it yours" (loop / slow / pitch)
4. **Bring it with you** — interactive audio import (`src/services/welcomeImport.ts`)

What it does **not** cover is exactly the founder's list: the
workspace → collection map, clip vs sketch, how versioning actually works,
lyric versions and the word tools, Shelf, Revisit.

The app also already has a second teaching tier we should lean on instead of
growing the wizard:

- **HelpSheet** system (`common/HelpSheet.tsx` + `helpContent.ts`) — live on
  Recording, Player/practice, Editor, lyrics editor, chord editor, and each
  word tool.
- **First-visit help emphasis** — the word tools persist `seenHelpSteps` and
  highlight the "?" on a step's first visit, then let it recede.
- **Teaching empty states** — `EmptyState` exists; the lyrics tab already
  opens with "No lyrics yet · Start a draft, or bring one from Lyric Pad."
- **Shelf and Revisit self-explain** — both screens open with settled intro
  copy ("Things you set aside to come back to soon…", "Older ideas resurface
  here so good work doesn't get lost.").

## Design position

People skim wizards — the founder is right. So the wizard's only job is the
**mental model**: the nouns and how they nest. Every *verb* (link a version,
branch a thread, spark a line) is taught **at the moment it becomes real**, by
the in-context tier the app already owns. A wizard pane about thread-splitting
is wasted on someone who has recorded nothing; a "?" that glows the first time
they open a Takes tab with two takes is not.

Concretely: **five panes, one idea each, one sentence each.** Everything
deeper moves to help sheets and first-visit emphasis.

## Layer 1 — the wizard (rebuild of WelcomeFlow)

Keep the shipped architecture: full-screen gate outside `NavigationContainer`
(beside `RestoreRestartGate`), `hasSeenWelcome` flag with its four-place
persistence and the restore-collision guard, Settings replay row, detached
import service. Rebuild the panes and the presentation.

### Panes

Copy drafts below are English; every string lands in `welcome.*` in both
catalogs (parity test enforces it). Bodies stay ≤ 16 words, terminology-lawful.

| # | Eyebrow | Title (Lora) | Body (Jakarta) | Visual motif |
|---|---|---|---|---|
| 1 | Capture | Catch the spark | Hum it, strum it, sing it — SongNook records the idea before it slips away. | record dot (keep existing pane) |
| 2 | Organize | Workspaces hold collections | One workspace per project. Collections sort the clips and sketches inside. | tiny nested diagram: workspace card → collection rows |
| 3 | Grow | Clips become sketches | A clip is one fragment. Make it a sketch to gather takes, versions, lyrics, and chords. | clip card → sketch card with Takes·Lyrics·Chart·Notes tab strip |
| 4 | Write | Words keep versions | Lyric versions live in the sketch. Lyric Pad holds loose lines; Lyric Spark knocks new ones loose. | lyric page with v1/v2 stack |
| 5 | Bring it with you | Start with what you have | Got a phone full of voice memos? Bring them in — they land in an "Imported" collection. | keep the interactive import pane |

Notes:

- Pane 2 and 3 are the founder's "big ideas" and are the new heart of the
  wizard. The diagram, not the prose, carries the hierarchy — keep it abstract
  (tinted card shapes, no screenshots to maintain).
- Pane 3 absorbs the old "Develop" pane; "Make it a sketch" mirrors the real
  button (`Make sketch`), so the wizard pre-teaches a verb the UI repeats.
- Pane 4's "knocks new ones loose" echoes the shipped Lyric Spark line
  ("knock loose a line you wouldn't write on purpose") — one voice.
- Pane 5 keeps the import flow exactly as built (detached run, duplicate skip,
  "Imported" collection) but retitles it: "Your recordings belong here" breaks
  the terminology law (*recording* is verb-only).
- **The Practice pane is cut.** Loop/slow/pitch are verbs; the Player's
  practice help sheet already teaches them at the right moment. If we want a
  trace, one word of pane 3's visual (a pin on the sketch card) is enough.
- **Shelf and Revisit stay out of the wizard.** Both are discovery features
  that only mean something once a library has age, and both screens already
  open with their own intro line. A pane about them at minute zero is the
  definition of skippable. (Founder said "if necessary" — recommendation: not
  necessary.)

### Presentation

- **Skip** stays top-corner on every pane; **Next → Start** bottom; page dots.
- **Motion:** replace the `ScrollView pagingEnabled` pager with a cross-fade +
  ≤6 px rise between panes (`collapseIn`/`collapseOut` from
  `src/design/motion.ts`). Horizontal *swipe stays as a gesture* — it just
  triggers the same fade advance. This resolves two problems at once: the
  motion law ("fades and small vertical slides are the entire vocabulary")
  and the current pager's RTL bug (scroll-offset math is direction-unaware
  under Hebrew; with no offsets there is nothing to mirror except the gesture
  direction and the dot order).
- **Haptics:** advance/skip ride the canon `Button` (`haptic.tap`); import
  completion fires `success` with its existing caption; landing in the app is
  silent (navigation is silent).
- **No dialogs above the gate** — preserved constraint from the import pane
  (AppAlert can't be trusted to stack over the welcome overlay).

### Design-system debt to clear in the rebuild

The shipped WelcomeFlow predates the button lock and violates the standard;
the rebuild clears all of it:

- Bare hex `#FDF5F2` (×2) → `colors.primarySurface`.
- Stadium `radii.round` on text buttons (CTA + Choose files) → soft keys,
  `radii.lg`, ~38 px.
- Solid `primaryDeep` CTA (undefined tier) → canon `Button` tiers; solid
  `colors.primary` only if we call Start the highest-stakes commit (it isn't —
  tonal wash reads right).
- Hand-rolled `fontFamily`/`fontSize` throughout → `text.*` tokens (the title
  is literally `text.cardTitle`).
- Raw `Pressable`s → canon `Button`/`IconButton`.
- Dead English literals in the local `PANES` const (only `icon` survives the
  `t()` overrides) → delete.
- "recordings" as an object noun in `importTitle`/`recordingsAdded` → clips /
  voice memos.

## Layer 2 — teach versioning and lyrics where they happen

The founder's "how clip versioning works" cannot survive a skimmed wizard —
threads, branch vs split, primary take, Evolution vs Timeline is a lecture.
Instead:

1. **Takes help sheet** (new, the one real addition): a `HelpSheet` behind a
   `HelpButton` in the sketch's Takes toolbar, using the established
   `helpContent.ts` pattern. Rows: what a take is · versions link takes into a
   thread (v1, v2…) · primary take represents the song · Evolution vs
   Timeline · branch vs split. This is the fifth sheet in a system that
   already has recording/player/overdub/editor — zero new UI concepts.
2. **First-visit emphasis** on that "?" — reuse the word-tools
   `seenHelpSteps` pattern (persist a `seenHints` set; emphasize the
   HelpButton the first time a sketch's Takes tab is opened, recede after).
3. **The second-take moment:** versioning becomes real when a sketch gains its
   second take. On that save, re-emphasize the Takes "?" once (same
   `seenHints` mechanism, second key). Quiet, dismissible-by-use, no toast
   spam, no coach-mark system invented.
4. **Lyrics tab needs nothing new** — the empty state already teaches ("Start
   a draft, or bring one from Lyric Pad"), the version editor already has a
   help sheet, and each word tool has its own. Verify the lyrics *versions
   list* explains CURRENT in its empty/help copy; extend the existing sheet if
   not.

## Layer 3 — replay and reference (already done)

"Replay intro" in Settings → About already exists and keeps working — the v2
wizard replays identically. Help sheets remain the reference layer.

**Existing users:** `hasSeenWelcome` is already true for them (and the
hydration fallback deliberately treats any persisted state as seen — do not
touch that logic). Recommendation: do **not** re-gate existing users with v2;
they've lived the concepts. The replay row is there for the curious. No flag
versioning needed.

## Out of scope / do not build

- No coach-mark/tooltip overlay system (phase-4 already ruled it out; still
  right).
- No wizard panes for Practice, Shelf, Revisit, Compilations, Search, sharing,
  Tuner/Metronome — all self-explain in place or via existing sheets.
- No screenshots inside panes (maintenance trap, breaks RTL); abstract tinted
  shapes only.

## Implementation map

| Piece | Files |
|---|---|
| Wizard rebuild | `src/components/common/WelcomeFlow.tsx` (rewrite in place; gate + flag untouched) |
| Pane copy | `src/i18n/translations.ts` `welcome.*` — en + he (parity test guards) |
| Takes help sheet | `src/components/common/helpContent.ts` (+ `TAKES_HELP`), HelpButton in `IdeaDetailScreen` takes toolbar |
| First-visit emphasis | new persisted `seenHints: string[]` following the four-place flag pattern (`dataSlice` → `persistedSnapshot` → `storeTypes` → `useStore` fallback) |
| Maestro | update `.maestro/flows/01-first-run-welcome.yaml` (Skip is matched by a11y label "Skip the intro" — keep or migrate deliberately) |

Untouched on purpose: `WelcomeGate` (`App.tsx`), `hasSeenWelcome` persistence +
hydration fallback, restore-collision ordering (`App.tsx` sets the flag before
raising the restore prompt), `welcomeImport.ts`, Settings replay row.

## Acceptance

- Fresh install → wizard (5 panes) → Start → seeded "My Songs" workspace; kill/
  relaunch → no wizard; restore path never shows it; replay row re-runs it.
- Wizard passes the §6 gate: tokens only, canon buttons, motion tokens, copy
  budgets, terminology law, both catalogs, RTL walkthrough in Hebrew (dots,
  gesture direction, FrankRuhl/Heebo faces).
- Takes "?" emphasized on first sketch open and after the second take, then
  recedes; sheet content matches shipped behavior (branch/split/primary).

## Open questions for the founder

1. **Cut the Practice pane** — agreed? (Recommended: yes; the player teaches it.)
2. **Shelf/Revisit out of the wizard** — agreed? (Recommended: yes; their
   screens self-explain, and a pane at minute zero teaches nothing.)
3. **Keep the interactive import as the closing pane?** (Recommended: yes —
   it's the only pane that *does* something, and it ends the wizard with the
   user's own material in the app.)
4. **Second-take emphasis** — comfortable with re-lighting the "?" once, or
   should the second take pass silently and leave only the first-visit glow?
