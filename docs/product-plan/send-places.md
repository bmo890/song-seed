# Send a place — collections and workspaces over SongNook Send

_2026-10-13. Status: **built**, tsc + jest green; device pass pending (§16 of the manual checklist)._

## The ask

Beyond clips, sketches, playlists, setlists and chart books, a sender must be
able to hand over a **collection** or a **whole workspace**, with everything the
place holds — marks, chords, lyrics, notes, sections, tags, grids, overdub stems,
nested collections — and the receiver must land it correctly: a workspace as a
new workspace of their own, a collection into a new workspace or into one they
already have. Both halves, both platforms, every edge the receive flow can hit.

## What was true before

| Kind | Share as file | Get a link | Receiver lands it as |
|---|---|---|---|
| setlist / playlist / chart book | ✓ | ✓ | the compilation, backing songs in a package |
| clips | ✓ | ✓ | a package of files |
| **collection** | — | — | (importable; never sendable) |
| **workspace** | — | — | (importable; never sendable) |

The archive format already carried every field in full fidelity and the importer
already rebuilt nested collections and remapped compilations; the manifest's
`share.kind` already knew `collection` and `workspace`. What was missing was the
front door, the wire, and three receive-side edges.

## What ships

### Sending (app → file or link)

- **Collection page ⋯ → Share…** opens a sheet with *Share as file* and *Get a
  link* (`CollectionHeaderMenu` → `CollectionModals`). One row in the overflow,
  so the menu stays under six rows. Received packages can be passed along the
  same way.
- **Workspaces page card ⋯ → Share as file / Get a link** for any live (not
  archived) workspace (`useWorkspaceListScreenModel`).
- `src/services/placeShare.ts` — one args builder per kind, shared by both
  exits so a link and a file are the same bytes. Full fidelity, every take,
  hidden items included, `.songnook` extension, `share.kind` stamped. A
  collection scope includes its nested collections (parents preserved).
- **Compilations travel only when entirely inside the shared scope**
  (`src/domain/scopedCompilations.ts`): a setlist built from this collection
  arrives as a setlist "from Ben"; one that reaches into another collection
  stays home rather than arriving with half its songs missing.
- The collection header wears the **"Link active · N days left · Copy"** chip
  like a setlist does.
- **Size guard** (`TooLargeShareError`): the service caps are 512 MB per file,
  1 GB per transfer. A link is refused on device before any byte is uploaded,
  with one sentence pointing at *Share as file*. The progress toast now lives
  until replaced — a workspace can take minutes to pack.
- `createTransfer` sends **`kind`** for every link, so the recipient page and
  the receive screen can name the parcel before any file is opened.
- Bug fixed on the way: the outbox sanitizer dropped **playlist** links on
  relaunch (missing from its allowlist).

### The wire (server/songnook-send)

- `share_kind` accepts all seven kinds (`lib/shareKind.ts`); unknown reads as
  `clips`, never refused. No migration: the column was already free text.
- Recipient page meta line: "1 SongNook package · a collection" /
  "… · a whole workspace" / "3 songs · a setlist, in order". A `.songnook` item
  no longer counts as a "song".
- The web sender page still offers Files / Playlist / Setlist only — a browser
  cannot build a collection; it can forward a `.songnook` the app made, whose
  manifest the app trusts on receipt regardless of the parcel's label.

### Receiving (link → phone)

- The destination line under Save says where each kind lands:
  *Saves to Received · Collection*, *… · Workspace*, *Saves to Compilations ›
  Chart books*, running orders as before. The archive row says the kind.
- Save opens the package it made (not the Received list) for a collection or a
  workspace; compilations still open in Library.
- **A workspace package with several top-level collections lists them under
  its row on the Received page** — every collection stays one tap away (before,
  only the first collection was reachable).

### Keeping (the receiver's decision)

Unchanged surface — *Keep this…* on the package, *Keep…* in multi-select — with
the three honest answers: **as its own workspace** (a received workspace becomes
a new workspace of yours, provenance dropped), **into a workspace at the top
level**, or **under one of its collections**. Two edges closed:

- A package whose collection carries nested collections can only land at a
  workspace's top level (sub-collections never nest twice). The chooser no
  longer offers "under a collection" for it and says why; the store action
  refuses up front instead of failing halfway through a multi-collection move.
- Setlists, chart books and playlists that arrived with the package keep
  resolving after a keep: setlists and chart books resolve songs by id across
  every workspace; playlists are relocated by the move.

## One Share… row, and the Send sheet (2026-10-13, founder ask)

**"Get a link" is gone as a label; the row is "SongNook Send".** Everywhere a
menu had both a file row and a link row, it now has one **Share…** row that
drills into a second sheet (back chevron returns to the menu): *Share as file* ·
*SongNook Send* (· *Share as text* on a chart book). Setlist, playlist and chart
book menus drop from five rows to four; the workspace card's sheet likewise; the
collection ⋯ and the clip selection's Share… already worked this way.

**The Send sheet mimics the desktop page.** Tapping *SongNook Send* opens one
bottom sheet (`SendLinkSheet`, mounted once at the root like ToastHost, fed by
`useSendSheetStore`): **Title** (prefilled with the thing's name), **From**
(remembered after the first parcel in `useSendPrefsStore`, exactly as the web
page remembers it in the browser), **A note**, then one key, *Get link*. Sealing
happens inside the sheet, which cannot be swiped away mid-upload; the finished
link stays there, already on the clipboard, with *Copy* and *Share* (OS sheet)
and a quiet *Done*. Failures (nothing to send, too large, offline) return the
sheet to its form with one dialog, so nothing typed is lost.

Why a sheet, not a modal form: a sheet is how every other decision in the app is
taken (keep, move, tag), it keeps the page you are sending from in view, and the
keyboard-avoiding `BottomSheet` already exists. The three lines are the whole
desktop form; the desktop's "What is this?" switch is not needed on the phone
because the app always knows what it is sending.

The From name answers the earlier "Someone" question for in-app links: the
sender types it once and every later parcel carries it (still `userId: null`
until accounts).

### Ordering, Export, and two fixes (2026-10-13, founder pass)

- **Ordering on the phone.** The desktop page lets a sender drag the rows and
  Sort A→Z before sealing. The Send sheet now carries the same two tools for a
  parcel of loose clips: the list above the title, numbered, with up/down
  nudges per row and a quiet *Sort A–Z* ink link; the clips upload in that
  order and the receiver gets them in it. A setlist or playlist keeps its own
  order (reorder it on its page); a collection or workspace has none.
- **Export, not Share, for the file.** The row that writes a `.songnook` to the
  phone (a folder picker on Android, the share sheet on iOS) was called "Share
  as file" and read as a second share. It is **Export** now, with a folder
  glyph, everywhere it appears: setlist, playlist, chart book, collection,
  workspace. The *Share…* umbrella stays, holding Export · SongNook Send
  (· Share as text). Settings already said Export.
- **Fix: "Playlist…" from a collection selection filed nothing.** The
  selection sheet ends the selection after every row except the ones that
  open another sheet, and the playlist row was missing from that list — the
  chooser opened with an empty selection and did nothing. Added to the list.
- **The queue's "Save" is "Playlist…"**, the same door as everywhere else, and
  a **new playlist asks for its name** (prefilled "Playlist N") and then opens
  the playlist page — you made a thing, you land on it. Adding to an existing
  playlist keeps the toast with *Open playlist*. The chooser snapshots its
  items at open, so an ending selection can never empty it again.

### Audit: every door, every surface (2026-10-13, "is it everywhere?")

| Surface | Door | Exits |
|---|---|---|
| Setlist / playlist / chart book page ⋯ | Share… | Export · SongNook Send (· Share as text) |
| Collection page ⋯ | Share… | Export · SongNook Send |
| Workspaces card ⋯ (live workspace) | Share… | Export · SongNook Send |
| Hub: a selected collection → ⋯ | — | Copy · Move · **Export · SongNook Send** (new) |
| **Sketch page ⋯** | **Share…** (new) | Export · SongNook Send — the whole sketch: every take, lyrics with chords, chord sheet, notes, marks, sections, tags (`sketchShare`, kind `sketch`) |
| Clip selection (collection / sketch takes) | Share… | Share (audio, OS sheet) · SongNook Send (ordered) |
| Full player ⋯ | Share… | **Share audio · SongNook Send** (was a straight link) |
| Queue | Playlist… | existing playlist · new, named, opened |
| Settings → Library | Export | the whole library, no share block (a backup-style archive) |
| Chart / chord editor | Export | a PDF or text by the OS sheet (produces a document — Export is the right word) |
| Notepad | Share | notes as text by the OS sheet |

Received packages, Shelf, Search, Revisit and Activity are discovery surfaces
and carry no sending door of their own: you open the thing, then send it from
its page. A received package's collection page keeps Share…, so a parcel can
be passed along.

A `sketch` kind was added end to end (types, outbox, receive validation,
icons, labels, service) so a sent sketch reads as "a sketch — takes, lyrics,
chords, notes" on the recipient page and "Saves to Received · Sketch" in the
app, and lands as a package presenting as that one sketch.

## Edge cases accounted for

| Edge | Behaviour |
|---|---|
| Empty collection / workspace | "Nothing to share" — no draft transfer, no upload |
| Archived workspace (audio packed away) | no share rows offered |
| Collection with only nested content | shared (scope includes descendants) |
| Compilation straddling the scope | stays home (never a partial arrival) |
| Parcel over 512 MB file / 1 GB total | refused on device: "Too large to link" → share as file |
| Same link opened twice | "Already saved" (transferId dedupe, unchanged) |
| Save fails midway | partial package removed (unchanged) |
| Old parcel without `kind` / web-sent `.songnook` | reads as clips; manifest decides on save; destination line promises only "Saves to Received" |
| Received workspace with N collections | every collection listed and openable |
| Keep under a collection, package has nested collections | not offered; top level + own workspace remain |
| Keep as own workspace | title, colour, collections, ideas kept; `origin`/`received` cleared |
| Forwarding a received package | allowed — Share… on its page; new sender stamped on receipt |
| RTL | all new strings in `he`; rows use start/end margins |

## Verify on device (manual checklist §16, new rows)

Collection → Share… → Get a link; open on another phone → *Saves to Received ·
Collection* → Save → package opens as the collection, nested collection inside,
marks/chords/lyrics/notes present, the setlist built from it under Compilations
"from <you>". Workspace → ⋯ → Get a link → same, Received row lists every
collection → *Keep this… → As its own workspace* → it appears among Workspaces.
Desktop: the link's page reads "1 SongNook package · a whole workspace".

## Open (founder calls)

1. ~~Sender name~~ — now typed on the Send sheet and remembered (above).
2. A workspace link over 1 GB has no link path at all (service cap); the file
   path has no cap. Raise the cap (Pro?) or leave.
