# QA automation run log

A running record of what's been **verified via automated Maestro flows on the iOS
Simulator** (iPhone 17), so you can see coverage at a glance. This is the "what has Claude
actually driven and confirmed" log — distinct from `CHECKLIST.md` (the full inventory of
what *should* be tested) and the `flows/*.md` section files.

Legend: ✅ automated + passing · 🟡 partially automated (UI verified, sensory truth is HUMAN)
· 🔒 blocked (needs seed data / device) · ▶️ encoded flow file.

Simulator can't do: real mic capture, Bluetooth, phone-call interruption, lock-screen,
background audio, real share-sheet-from-another-app, Files app, storage pressure, haptics
feel. Those stay HUMAN on device (see CHECKLIST.md designations).

---

## Encoded Maestro flows (`.maestro/flows/`)

| Flow file | Covers | Status |
|---|---|---|
| 01-first-run-welcome | fresh install → welcome panes → skip → seeded library | ✅ |
| 02-drawer-navigation | drawer → Lyrics Pad, Metronome, Settings render | ✅ |
| 03-paywall | Settings → Upgrade to Pro → sheet, CTA notice, restore | ✅ |
| 04-recording-screen | record FAB → recorder UI, metronome toggle, settings sheet, back | 🟡 (mic capture HUMAN) |
| 05-song-lifecycle | create song → name → save → detail → back → list → select → delete → confirm gone | ✅ self-cleaning |
| 06-drawer-destinations | Revisit, Activity, Library (listening hub), global Search each open + render | ✅ |

## Reusable subflows (`.maestro/subflows/`)

| Subflow | Purpose |
|---|---|
| open-library | cold-launch → dismiss backup dialog + LogBox → land on library root |
| dismiss-logbox | dismiss the dev LogBox banner (call before any bottom-anchored tap) |

## Stable testIDs added (selector foundation)

`fab-create`, `fab-record`, `fab-menu-<key>` (song/import), `header-menu`, `header-back`
(collection header), `song-header-back` (song detail), `song-title-input` (New/Edit Song
sheet), `dialog-btn-<label-slug>` (every AppDialog button — e.g. `dialog-btn-delete`,
`dialog-btn-cancel`).

## Bugs found by the harness

| # | Bug | Where | Fix |
|---|---|---|---|
| 1 | Paywall "Start free trial" / "Restore" were dead-end taps on iOS (AppAlert Modal can't present over the sheet Modal) | ProUpsellSheet | Render notice inline (commit c17ddf2) |

## Individual checks verified (beyond the committed flow files)

_Appended below as I drive each flow. "screen renders" = opened without crash and key
elements present; "action works" = the interaction produced the expected state change._

### 2026-07-14 — batch 2 (library CRUD)

- ✅ **Create song** — create-FAB (+) menu opens with Song/Import; "Song" creates a draft
  idea and opens the New Song sheet. Verified.
- ✅ **Name a song** — title input accepts text, Save persists it; titled song renders on
  the detail page and in the collection list. Verified.
- ✅ **Detail ↔ collection navigation** — back from song detail returns to the collection.
  Verified.
- ✅ **Selection mode** — long-press a list card enters multi-select ("N selected", Select
  all, Play, Hide, Delete, More). Verified.
- ✅ **Delete song + confirm** — selection Delete → destructive confirm dialog → undo toast
  ("Deleted 1 item") → row removed. Verified.
- ✅ **Bulk delete (Select all)** — selection "Select all" → Delete → confirm clears the
  whole collection. Verified (used as the residue-cleanup path).
- ℹ️ Note: the dev LogBox banner ("Open debugger to view warnings") reappears on new
  warnings and silently eats bottom-anchored FAB taps — every flow now dismisses it right
  before FAB interaction. Worth investigating *why* the app logs boot warnings (would help
  both dev ergonomics and test reliability).

### 2026-07-14 — batch 3 (drawer navigation)

- ✅ **Revisit** opens and renders (drawer → Revisit).
- ✅ **Activity** opens and renders — heatmap + "A year of your creative activity…".
- ✅ **Library** (listening hub: Playlists / Setlists / Songbook) opens and renders. Note:
  this is NOT the workspace collection list — "Library" in the drawer is the playback hub.
- ✅ **Global Search** opens from the drawer's search button; "Search looks inside" helper
  renders.
- (Lyrics Pad, Metronome, Settings already covered by flow 02.)
- ℹ️ Added `nav-row-<label>` testIDs to every drawer row. Needed because Maestro text
  matching is **case-insensitive**, so `.*Library` was also matching "Search your library"
  and tapping the wrong row. testIDs make each destination unambiguous.
- ℹ️ Two default-titled residual seeds ("8:56 PM Jul 14th", "8:58 PM…") remain from earlier
  failed iterations — harmless (the suite starts from flow 01's clearState, which wipes
  them), but noted.

