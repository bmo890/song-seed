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

