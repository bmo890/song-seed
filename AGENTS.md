# Song Seed Worktree Responsibilities

This project is split into three active worktrees. Changes should be routed to the correct worktree whenever possible.

## Worktrees

### `codex/song-workspace`
Owns the song-level workspace itself.

Includes:
- Song page redesign
- `Takes | Lyrics | Notes` structure
- Timeline / Evolution views
- Primary take vs idea clips
- Clip relationships and variation UX
- Notes UI inside the song
- Lyrics UI inside the song
- Lyrics versioning from the song context
- Chord-builder work if it lives inside the song workspace

Does not own:
- Global navigation
- Collection/workspace browse
- Recording/player/editor engine behavior
- Filesystem/platform reliability

### `codex/media-workflow`
Owns playback, recording, editing, and practice behavior.

Includes:
- Recording screen
- Full player screen
- Audio editor
- Scrubbing / looping / playback behavior
- Background play/record behavior
- Toolbar/minimized media behavior
- Metronome / beat options
- Practice mode
- Looper
- Equalizer
- Guitar tuner
- Lyrics autoscroll during playback if it is tied to player/recording behavior

Does not own:
- Collection/workspace navigation
- Song page information architecture
- Library/playlists unless directly tied to player queue behavior

### `codex/library-navigation`
Owns browsing, organizing, and finding work.

Includes:
- Home / workspace page
- Sidebar navigation
- Collections / subcollections
- Ideas list
- Library page
- Playlists as an organization/browse feature
- Heatmap expansion / date-region browsing
- Revisit feature
- Hide/show and list filtering behavior
- Global UI theme/system for browse/list surfaces

Does not own:
- Detailed song workspace internals
- Recording/player/editor engine behavior
- Platform persistence concerns

## Routing Rule

When a request belongs in a different worktree than the one currently being used, call that out explicitly before making changes.

Rule of thumb:
- If it is about one song and its internal creative history: `codex/song-workspace`
- If it is about audio behavior or transport/record/edit mechanics: `codex/media-workflow`
- If it is about where things live, how you browse them, or how you find them: `codex/library-navigation`

## UI Consistency Rules

These rules are short, strict enforcement rules. Use [docs/design-system.md](/Users/benmogerman/Projects/song-seed/docs/design-system.md) for the fuller rationale and patterns.

## Code Architecture Rules

Use [docs/code-architecture.md](/Users/benmogerman/Projects/song-seed/docs/code-architecture.md) when refactoring or creating screen structure.

Key rules:
- Keep screen entry files thin
- Prefer feature-local providers, hooks, sections, and components
- Split effects by concern
- Avoid giant prop surfaces and pass-through model objects
- Default to local reuse; promote to shared only after real repeated use
- Treat `Collection` and `Song` as the architecture templates for the rest of the app

### Core philosophy
- Song Seed is a creative tool for musicians, not a dashboard.
- The UI should feel calm, minimal, predictable, and content-first.
- Avoid flashy, dense, enterprise-style layouts.

### Visual hierarchy
- Every screen should follow this order:
  - context
  - title
  - metadata
  - primary content
  - secondary tools
  - actions
- Primary content must be visually dominant.

### Cards
- Cards are for content, not for layout scaffolding.
- Correct card usage:
  - clips
  - songs
  - primary take
  - idea items
- Avoid using cards for:
  - headers
  - navigation
  - timers
  - recording controls
  - generic buttons

### Headers
- Use one consistent header structure:
  - left: navigation control
  - center: breadcrumb context
  - right: overflow menu
- Keep breadcrumbs subtle, single-line, and truncated if deep.
- Use `hamburger` only on browse/container screens:
  - Home
  - Workspace
  - Collection / Ideas list
  - Activity
  - Revisit
  - Library
  - Settings
  - Tuner
  - Metronome
- Use `back` on focused detail/task screens:
  - Song
  - Player
  - Recording
  - Editor
  - Lyrics
  - Lyrics version

### Controls
- Controls should sit directly on the surface, not inside decorative cards.
- Use three action tiers:
  - primary: one obvious action
  - secondary: inline buttons/icons
  - advanced/destructive: overflow menu

### Interaction rules
- Tap opens or activates.
- Long press reveals contextual actions or enters selection.
- Swipe is only for quick list-item actions.
- Overflow menu is for advanced or destructive actions.
- Do not invent screen-specific gestures if an existing pattern already exists.

### Lists
- List items should remain visually consistent across screens.
- Default item anatomy:
  - title
  - compact metadata
  - waveform preview if relevant
- Reuse the Ideas list card pattern before inventing a new one.

### Expandable content
- Use collapsed/expanded sections to reduce clutter.
- Collapsed state should show title plus a short summary.
- Expanded state can reveal full content and compress surrounding content if needed.

### Recording and playback
- Recording controls belong in a sticky bottom control zone.
- Playback controls should stay inline with waveform/media surfaces.
- Discard/delete should not be primary visible actions.

### Design consistency
- Reuse existing interaction zones and components whenever possible.
- Prefer shared components over page-specific clones.
- If a screen feels crowded, reduce visible controls before adding new layout layers.
