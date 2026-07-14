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
| 07-tuner | Tuner opens, mic permission handled, listening UI renders | 🟡 (pitch detection HUMAN) |
| 08-lyrics-pad | notes index → New Page → type → autosave shows in preview → reopen → clear | ✅ self-cleaning |
| 09-settings-navigation | Settings overview + Recording-defaults & Library-&-Backups sub-views open + back | ✅ |
| 10-collection-search | create song → matching filter shows → non-matching hides → clear restores → delete | ✅ self-cleaning |
| 11-metronome | standalone metronome: BPM ±, meter 4/4↔3/4, start/stop toggle | 🟡 (click audio HUMAN) |
| 12-collection-crud | browse → add collection → auto-open → back → select → delete → confirm gone | ✅ self-cleaning |
| 13-word-tools | Lyrics Spark sheet → Word Ladder, Cut-Up, Magpie each open + render + back | ✅ |
| 14-settings-library-views | Settings→Library→ Export / Import / Storage-details views open + back | ✅ |

**Full-suite status: 10/10 flows pass (~6 min on iPhone 17 sim).** Flow 01 clearState wipes
state first, so a full run is deterministic and self-cleaning. Run it with:
`maestro test .maestro/flows/` (Metro on 8081 + the dev-client build installed).

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
  them), but noted. (Confirmed wiped by the 8/8 full-suite run.)

### 2026-07-14 — batch 4 (tools: Tuner + Lyrics Pad) + full-suite run

- ✅ **Tuner** opens from the drawer, handles the mic-permission alert if raised, and shows
  the listening UI ("LISTENING", "Hold the phone near your instrument…"). Pitch detection
  itself needs a real mic → HUMAN on device.
- ✅ **Lyrics Pad** — index → New Page opens the editor; typed text autosaves and appears as
  the note preview back on the index; reopen + clear leaves an empty page (no residue).
- ✅ **Full suite 8/8 green in 6m 3s.** Individual times: 01 (12s), 02 (1m11s), 03 (31s),
  04 (24s), 05 (55s), 06 (1m40s), 07 (32s), 08 (38s).

### 2026-07-14 — batch 5 (Settings navigation)

- ✅ **Settings overview** renders with all section groups (STARTUP, RECORDING, LIBRARY,
  SONGSTEAD PRO, FEEDBACK, APP).
- ✅ **Recording defaults** sub-view opens (METRONOME / Count-in / Name-each-recording) and
  backs out.
- ✅ **Library & Backups** sub-view opens (SAFETY COPY / BACKUP REMINDER / SHARE & MOVE) and
  backs out.
- ℹ️ Added `settings-card-<title>` testIDs to LibraryActionCard. Needed because the cards'
  composite a11y label (title + description) made Maestro tap a spot that didn't register as
  a row press — a coordinate tap on the row navigated fine, confirming it's a selector issue,
  **not** a navigation bug in the app.
- ⏭️ Not yet encoded here (visible in the overview, worth follow-up flows): Startup radio
  (Primary vs Last-used workspace), Haptics toggle, Restore purchases, and the deeper Library
  views (Export "Parts of your work"/"Whole library", Import, Storage/health).

### 2026-07-14 — batch 6 (in-collection search)

- ✅ **Matching query** keeps the matching song visible.
- ✅ **Non-matching query** filters the list down to nothing (song hidden).
- ✅ **Clearing** the query restores the full list.
- ✅ Added `collection-search` testID to the SearchField (forwarded testID prop).
- ℹ️ Lesson: the search field keeps keyboard focus, which blocks a subsequent long-press
  from registering as a selection gesture — a `hideKeyboard` is required first. (On the
  custom song-title input `hideKeyboard` fails, but on the standard SearchField it works.)

### 2026-07-14 — hardening: full suite 10/10

- ⚠️ Caught by the full-suite run: flow 08 (Lyrics Pad) passed standalone but FAILED in the
  suite. Root cause: the pad's landing state is data-dependent — no notes → opens straight
  into the editor (no "New Page"); notes present → opens the index. Standalone testing had
  leftover notes, so it always saw the index; the suite runs after clearState (no notes).
  Fixed by making the "New Page" tap guarded and keying editor-readiness off "Word finder".
  **Takeaway: always validate a flow inside the full suite (post-clearState), not just
  standalone — state-dependent landing screens are the main flakiness source.**
- ✅ **Full suite now 10/10 green in 5m 54s.**

### 2026-07-14 — batch 7 (Metronome + Collection CRUD)

- ✅ **Metronome (standalone)** — BPM raise/lower (92↔93), meter 4/4↔3/4, start↔stop toggle.
  The audible click is HUMAN; all control state changes are verified. Passed first try
  thanks to good accessibility labels on every control.
- ✅ **Collection create** — browse "New collection" FAB → QuickNameModal → Create. The new
  collection auto-opens (lands inside the empty collection).
- ✅ **Collection delete** — back to browse → long-press card (by testID) enters
  collection-select mode → Delete → confirm → gone. Self-cleaning.
- ℹ️ testIDs added: `workspace-add-collection` (browse FAB), `quickname-input` /
  `quickname-save` / `quickname-cancel` (the shared QuickNameModal, used by many create/rename
  dialogs), and `collection-card-<title>` via a new `testID` prop on SurfaceCard.
- ℹ️ Lesson: Maestro long-pressing a *text node* fires as a tap (opens the item); long-press
  the **Pressable element by testID** to reliably trigger selection mode. Also: creating a
  collection auto-navigates into it, so deletion has to route back to the browse screen.
- ⏭️ Not yet covered: collection **rename / move / copy** (same actions surface, straightforward
  follow-ups), and nested sub-collections.

### 2026-07-14 — batch 8 (word tools / Lyrics Sparks)

- ✅ **Lyrics Spark sheet** opens from the Lyrics Pad index (sparkles button) and offers all
  three tools.
- ✅ **Word Ladder** opens and renders (JOB/ROLE · VERBS · ROOM/PLACE · NOUNS columns).
- ✅ **Cut-Up** opens and renders ("YOUR STARTING LYRIC" source step).
- ✅ **Magpie** opens and renders (book-fetch screen). Note: Magpie fetches a real book over
  the network — the fetch/curation is best verified HUMAN; this confirms the screen mounts.
- ℹ️ Added `lyrics-spark-open` testID to the sparkles button. The spark button lives on the
  Lyrics Pad *index*, which only appears once ≥1 note exists — so the flow creates a note
  first when the pad opens straight into the editor.
- ℹ️ Each tool screen has a plain "Back" button (exact match works); returning from a tool
  closes the spark sheet, so it's re-opened between tools.
- ⏭️ Deeper per-tool interactions (Word Ladder pairing/shuffle, Cut-Up cut+compose, Magpie
  word-pocketing) are follow-ups; several touch the Pro word-sparks gate.

### 2026-07-14 — batch 9 (deeper Settings/Library views)

- ✅ **Export an archive** view opens + renders + backs out.
- ✅ **Import an archive** view opens + renders + backs out.
- ✅ **Storage details** view opens + renders + backs out.
- ⚠️ Deliberately does NOT tap **Back up** / **Restore** — those start real file operations
  and system share/document sheets (HUMAN territory). Same for the actual export/import
  *actions* inside these views (share sheet, document picker).
- ℹ️ These cards live in the SHARE & MOVE section below the fold; `scrollUntilVisible` (by
  testID, direction DOWN) is needed — `tapOn: {id}` does not auto-scroll reliably.

