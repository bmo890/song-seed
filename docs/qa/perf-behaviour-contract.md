# Performance pass — behaviour contract (2026-09-24)

Everything below must be observably unchanged after each performance commit.
Each item is checked in the iOS simulator after every step; anything that cannot be
checked there stays out of the pass. The reel and its siblings are the priority:
their code is not edited in this pass — they only receive stable inputs.

## Full player and reel

- Playback continues untouched across navigation (open a sketch, open a drawer page,
  push a pushed page) and across minimize/expand of the sheet.
- The reel scrolls smoothly during playback; the playhead never jumps or re-anchors on a
  React commit; bar numbers stay glued to their hairlines.
- Scrub: drag moves the playhead, release seeks, the tape lands where the finger left it.
- Fling: decays and lands; one release tick.
- Pinch zoom: detents work; zoom persists while playing.
- Tap on minimap seeks.
- Practice loop: set a range, loop plays and wraps; loop survives minimize and expand;
  loop range handles drag.
- Step-up: rate climbs per cycle while looping; stops at the ceiling.
- Pins: add, drag, reposition, open actions; pin badges follow the tape.
- Sections: bands drawn; section rail tap seeks.
- Count-in options (bars / 3 s run-up) start playback as before.
- Play/pause from the transport, from the dock, and from the lock screen.
- End of clip advances the queue (or stops at the end) as before.
- Header readout shows this clip's length and position, never the previous clip's.
- Layers bench: lanes tap to select; nudge drag works; overdub preview render state shows.
- Lyrics/chart reader follow mode scrolls with the tape.

## Recorder

- Live tape draws during a take, continues after minimize/reopen, and clears on redo.
- Elapsed clock ticks; count-in shows beats; head trim applied at save.
- Saved take's waveform peaks are identical to before for the same audio (compared).
- Record, pause, resume, redo, discard, save, minimize all work; auto-name save works.
- Metronome click-through and count-in unchanged (grid anchor, self-alignment at save).

## Collection

- Cards render the same; inline preview plays; play button opens preview; card opens
  the sketch/player; long-press selects; day dividers hide/show; search filters; sort and
  filter work; "view in collection" highlight flashes; import runs with progress.
- Library edits (rename, bookmark, tags, markers, sections) persist and survive relaunch.

## Store / persistence

- Every edit reaches SQLite (relaunch shows it); the manifest updates; the persist guard
  still trips on a suspicious empty write; a save flush still makes the take durable.
- Backups and restores round-trip.

## Dock and drawer

- The dock shows the right title/subtitle/duration and updates on clip change; the shelf
  badge in the drawer updates when an item is shelved or leaves.
