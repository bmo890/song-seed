# Clip editor — user flows, edge cases, and the metadata-survival plan

*2026-08-01 · companion to `clip-editor-audit.md` (visual audit) and the facelift mock.
Grounded in code: `useEditorExportFlow.ts`, `audioTrim.ts`, `types.ts` (ClipVersion,
RecordingGrid), `domain/tempoMap.ts`, native `songnook-pitch-shift` renderers.*

The question this document answers: **when a user cuts, extracts, or transforms a
clip, what happens to everything the clip carries — and what should?** Today the
answer is bad in ways the visual audit couldn't see.

---

## 1 · What a clip carries through an edit — today's truth

`buildDerivedClipDraft` (useEditorExportFlow.ts:251) builds every derived clip. What
survives today:

| clip data | today after extract/cut | verdict |
|---|---|---|
| title, notes, tags | carried | fine |
| editRegions (provenance) | appended | fine |
| waveformPeaks | regenerated from new file | fine |
| sourceAudioUri, lineage (parentClipId) | carried, repaired on delete-original | fine |
| **practiceMarkers (pins)** | **cloned verbatim — times NOT remapped** | **corrupt**: extract a 0:30–1:00 span and a pin at 0:45 now points at 0:45 of a 30s file (was 0:15) |
| **sections** | **silently dropped** (not in the draft at all) | lost work |
| **recordingGrid (metronome/tempo map)** | **silently dropped** | lost: click, bar ruler, beat grid all gone on the child |
| analysis (detected tempo) | dropped | lost, re-detectable |
| isBookmarked | dropped (reset) | acceptable, keep deliberate |
| overdub layers | blocked by flatten gate | correct design |

And in the transform path (speed change): pins are carried **verbatim** while the
audio's timeline is scaled — a 2× speed copy has every pin at twice its real position.

**These are data-corruption bugs independent of any facelift.** The plan below fixes
them with one shared remap layer.

---

## 2 · The flows, walked end to end

### F1 — "Extract the songs from a long rehearsal"
Loose clip (idea kind `clip`) in a collection. User marks 6–12 parts, names the good
ones inline, saves. **Today**: each part becomes a *new loose clip idea in the same
collection*; original stays unless "delete original" is ticked. That destination rule
is right — keep it. Needs from the facelift: painless per-part naming (inline on
rows, not a modal wall), part list that scrolls well past ~6, "Rehearsal v2…v13"
default names are noise — suggested names should be `<clip title> · part N`
(time-stamped parts stay quiet Jakarta per the earned-serif rule).

### F2 — "Extract the good take from a sketch recording"
Same mechanics, but inside a sketch (`project`): parts become new takes with lineage
(`parentClipId` → source). Delete-original hands primary status to the first extract
and re-parents children — already implemented, keep.

### F3/F4 — "Trim flubbed parts out" (one or several)
Remove-intent regions; output is **one** clip with the kept spans butt-joined in
order. The excess (removed spans) is *discarded* — the only artifacts are the new
trimmed clip and (by default) the untouched original. That's the safety story:
**nothing is ever destroyed unless "delete original" is explicitly chosen**, and the
original always contains the excess.

### F5 — "Slow it down / change key, keep a copy"
Transform tab. Output = new clip/take, same destination rules. Time-affecting.

### F6 — "Extract AND cut in one visit" — **decision: stays exclusive**
The global intent (all regions keep, or all remove) is a *good* constraint: one edit
= one kind of outcome, and the two outcomes' complements overlap confusingly. The
rehearsal flow doesn't need it: extract the songs; the "excess" is the untouched
original. A user who wants both runs two passes (original is still there). If demand
appears, the extension is a sheet option — "Also save the rest as one clip" — on the
extract path, *not* mixed region types. Deferred; founder call.

### F7 — combined trim + speed change — **decision: stays exclusive (two saves)**
The render pipeline is two different native paths (renderTrim vs pitch/rate
renderer). Chaining them in one save is possible later (trim → transform the temp
file) but multiplies the remap matrix. Two saves via the fresh child clip is honest
and cheap. Deferred; founder call.

### F8 — clip has sections/pins → §4 remap rules.
### F9 — clip has a metronome grid → §3, the heart of this doc.
### F10 — clip has overdub layers → flatten gate (kept; restyled per audit D7).
### F11 — imported clip, no grid, maybe detected tempo → analysis carried per §4.

---

## 3 · The metronome grid through an edit — the real problem, and the plan

### Why naive carrying is impossible
`RecordingGrid` = `firstDownbeatMs` (file t=0 → downbeat of bar 1) + a bar-anchored
`TempoMap` (segments take effect at bar boundaries; grid zero is bar 1's downbeat).
Any edit that changes the file's timeline breaks one or both anchors. The user's
exact scenario — cut removes the middle of a bar, downstream audio now enters on
beat 3 but the grid says beat 1 — would make the click land off-beat *forever after
the seam*. Carrying the grid wrongly is worse than dropping it.

### The good news
The tempo-map model already contains everything needed to do this *exactly* in the
happy paths — positions before grid zero are well-defined (backward extrapolation),
segments are bar-anchored, and `gridValidToMs` already expresses "grid trustworthy
only up to here" (built for mid-take interruptions — the same concept as a bad seam).

### Rules (pure module `src/domain/clipEditRemap.ts` — BUILT 2026-08-01, 35 tests)

**Extract `[s, e)` — grid survives EXACTLY, always** (when the source grid is usable):
1. No grid, or `firstDownbeatMs == null` → child gets no grid (nothing usable).
2. Let `d` = the first bar downbeat ≥ `s` (from the map). If `d ≥ min(e,
   gridValidToMs)` → no downbeat inside the extract → no grid.
3. Child grid: `firstDownbeatMs' = d − s` (< one bar); the map re-anchored so the
   bar at `d` becomes bar 1 (`atBar' = atBar − B + 1`, earlier segments dropped, the
   segment active at `B` clamped to bar 1). The partial audio before `d`
   extrapolates backward within one segment — exact by construction, because tempo
   never changes mid-bar. **An extract starting on beat 3 keeps a perfect grid.**
4. `gridValidToMs' = gridValidToMs − s` when it falls inside; `countInBars' = 0`;
   grouping/clickThroughTake/source carried.

**Cut/splice — three seam classes, handled per seam:**
- **Head cut `[0, x)`**: not a seam at all — it's a rebase. Apply the extract rule at
  `s = x`. Grid survives exactly.
- **Tail cut**: timeline before it untouched. Grid survives exactly (clamp
  `gridValidToMs`).
- **Interior cut, bar-aligned** (both edges on bar downbeats ⇒ a whole number of
  bars removed): renumber — bars after the seam shift down by the removed bar count,
  segment `atBar`s shift with them, segments wholly inside the removed span drop.
  Musically the take now *skips* those bars; the click stays locked. Exact.
- **Interior cut, NOT bar-aligned** (the user's beat-3 scenario): the grid after the
  seam is musically void — do **not** pretend otherwise. Keep the grid and set
  `gridValidToMs = first bad seam` (reusing the existing invalidation semantics:
  ruler/click work up to the seam, honestly absent after). Multiple cuts: valid up
  to the first non-aligned seam.
- "Bar-aligned" is **by construction, not by tolerance**: alignment comes from
  snapping (below), never from a ±ms fudge factor. A freehand cut 30ms off a bar
  line is off the bar line.

**Transform**: rate `r` ≠ 1 scales the whole timeline by `1/r` — remap is exact:
`firstDownbeatMs' /= r`, `gridValidToMs' /= r`, every segment `bpm' = bpm × r`
(availability gating already handles out-of-range bpm). Pitch-only (`r = 1`): carry
everything untouched. Pins/sections: `atMs / r`.

### The musician's choice — one toggle, two honest outcomes (settled 2026-08-02)

Strict grid adherence constrains where you can cut, and not every edit wants that.
Chopping a rehearsal into songs doesn't care about bar lines; tightening a take does.
So it is **the musician's call, made once per edit**, shown only when the source clip
actually has a grid.

**Keep to the grid (ON, the default when a grid exists).** Region edges snap to beats,
with stronger magnetism at bar lines, matching reel zoom (zoomed out → bars, zoomed in
→ beats). Haptic `tap` on snap. The MarkInspector's ‹ › nudge deliberately *escapes*
the snap for surgical work. Seams stay transparent, so the grid comes through whole.

**Free (OFF).** No snapping, cut anywhere. An edit that breaks the grid yields a clip
with **no grid at all** — a plain new audio file — rather than one whose click dies
partway through with no explanation. `GridPolicy = "preserve" | "free"` in
`clipEditRemap.ts`.

Two properties that make this safe rather than lossy:

1. **Free mode only costs the grid when the edit genuinely breaks it.** Every extract
   and every head/tail cut re-anchors exactly, whatever position it starts at, so
   those keep their grid under both settings. The toggle is about breakage, never
   punishment.
2. **Pins and sections always survive, both ways.** They are positions in time, not
   bar positions; nothing about them depends on alignment.

A partial grid (`gridValidToMs`) therefore only ever reaches the musician from an
invalidation *inherited* from the source take (an interrupted recording), or from
whole-bpm rounding drift on a baked speed change — never as a surprise from their own
cut.

**Honesty line in the save sheet** (copy-budget compliant): `Grid kept` ·
`Grid kept to 01:12` · `No grid`. One quiet row, no paragraph.

### Seam audio quality (independent bug)
The native renderTrim butt-joins kept ranges with **no crossfade** — a mid-waveform
cut can click audibly. Add a short equal-power crossfade (~8ms) at interior seams in
both native renderers (iOS/Android). Extract paths (single range) get a ~4ms fade-in
/ fade-out at file edges only if the cut is mid-waveform. Needs native rebuild +
device listening.

---

## 4 · Remap rules for everything else (same module, same pass)

| data | extract `[s,e)` | cut (removed ranges) | transform rate `r` |
|---|---|---|---|
| pins (`atMs`) | inside → `−s`; outside → drop | inside removed span → drop; after → shift left by removed-so-far | `/ r` |
| sections (`start/endMs`) | intersect with `[s,e)`, clamp, shift `−s`; empty → drop | subtract removed spans, clamp/merge via existing `normalizeSections` | `/ r` |
| detected tempo (`analysis`) | carry, clear `confirmed` | drop (seams break pulse continuity; Detect can re-run) | carry with `bpm × r`, clear `confirmed` |
| grid | §3 | §3 | §3 |
| lyrics | live on the idea, not the clip — unaffected | — | — |

Every remap is a pure function over `(spans, edit description)` with exhaustive unit
tests: boundary pins (exactly at `s`, at `e`, at a seam), sections spanning a seam,
section swallowed by a cut, pin at the seam ms, empty results, rounding.

---

## 5 · Save & destination — settled answers to the open questions

- **Where do edits land?** Loose clip → each extract is a new loose clip in the
  *same collection*; sketch take → new takes in the *same sketch* with lineage.
  No destination picker in v1 — moving clips is the library's job, and the
  post-save toast already confirms where they went. (Founder can override.)
- **How are they named?** Inline quiet title field on each part row (placeholder =
  suggested name); the save sheet is a receipt, not a form. Blank = suggested name,
  which becomes `<source title> · part N` for extracts (auto-generated flag set, so
  the earned-serif rule and later bulk-rename keep working).
- **Original kept or replaced?** Always kept by default; every path creates new
  clips. "Also delete original" lives in the save sheet as a danger-tier row —
  and when the original is a sketch's primary take or has children, the existing
  primary-handoff/re-parent logic runs (already built). Deleting the original of a
  loose clip deletes that idea (existing behavior, now stated plainly in the row's
  sub-line when it applies).
- **What about the excess in an extract?** Nothing is rendered for it; it lives on
  inside the untouched original. Optional future: "Also save the rest" (§2 F6).

---

## 6 · Edge cases inventory (each gets a test or a guard)

1. **Cut everything** (removed spans cover the file) → zero-length output. Block at
   the CTA with the outcome line ("nothing left"), not at render time.
2. **Extract = whole file** → legal (a copy); suggested name still versioned.
3. Region shorter than `MIN_REGION_DURATION_MS` — already guarded; keep.
4. Regions touching t=0 / file end; two regions sharing an edge (cut → one seam,
   not two; complementRanges already merges — test it).
5. `firstDownbeatMs null` (pre-measurement takes) → treat as no grid.
6. `gridValidToMs` already set on the source → all remaps clamp against it first.
7. Extract entirely inside the count-in / before the first downbeat → no grid.
8. Tempo-change take: interior bar-aligned cut spanning a segment boundary →
   renumber must drop swallowed segments and keep the map normalized (dedicated
   tests; `MAX_TEMPO_MAP_SEGMENTS` respected).
9. Rate transform pushing bpm out of the click's 40–240 range → grid carried,
   click gated off by the existing availability check (no special case).
10. Source clip is playing in the dock / sits in the queue when deleted-after-export
    → verify queue/dock repair (suspected gap; test before shipping delete-original
    restyle).
11. Export interrupted (app death mid-render): commits happen only after ALL
    renders succeed (already true — keep it that way); temp files cleaned
    idempotently; re-entry finds original untouched.
12. Disk full / render failure mid-batch → one error surface, zero partial commits.
13. Very long rehearsal (10+ parts): list virtualization not needed (tens, not
    thousands), but the save sheet receipt must scroll internally.
14. RTL: part rows and inspector follow the player's settled law — time axis pinned
    LTR (`ltrRow`), language mirrors.
15. Rapid double-tap on save → `isExporting` already latches; keep the progress
    modal blocking.
16. Editing a clip whose sidecar waveform is still resolving → editor already
    falls back to thumbnail peaks; the child regenerates its own (keep).

---

## 7 · Build order (supersedes the audit's phase list)

1. **Phase 0 — data correctness — DONE 2026-08-01.**
   `src/domain/clipEditRemap.ts` + 35 tests, wired into all three export paths.
   Fixes silent pin corruption, section loss, grid loss, transform-time scaling.
   `complementSpans` is now shared with `services/audioTrim`, so the rendered audio
   and the remapped metadata can never disagree about what survived.
   Carries the `GridPolicy` choice (§3) end to end: domain + export flow accept it,
   defaulting to `preserve`. The toggle control itself ships in Phase 2 next to
   snapping, so it is designed once, in the new skin, rather than bolted onto the
   old one.
   The `gridOutcome` each edit returns is logged today and becomes the save sheet's
   honesty line in Phase 3.
   **Still open, deliberately not guessed at:** overdub *flatten*
   (`saveCombinedClipAsNewClip`, state/actions.ts) drops `recordingGrid` — and since
   layer offsets may be negative, whether the mix preserves the root take's t=0 needs
   device verification before the grid can be carried. Flagged, not fixed.
2. **Phase 1 — skin — DONE 2026-08-02.** Selection ink from tokens (keep =
   `primaryDeep`, remove = `danger`, identical on reel/segment/rows — the Tailwind
   blue/red and the green/brick pair are both gone); canon `SegmentedControl` for
   intent; soft keys everywhere (footer CTA is now a tonal wash, steppers and Reset
   left `borderRadius: 999`, and the reel's 80×48 stadium play button became a
   circle); reel parity by configuration — `zoomPlacement="overlay"` +
   `showTimingRow={false}`, the player's own props — so the ambiguous
   `00:00.00 / 00:37.18` pill pair became one `00:00 / 00:37` readout in the header
   next to the clip name; overdub gate off its hex literal and onto the empty-state
   recipe; the unreachable extract/splice switcher deleted along with
   `exportOperation` state (now derived) and the word "splice"; full copy pass in EN
   + HE to the **part** vocabulary within budget. Verified in the simulator across
   keep, remove, save and speed/pitch.
3. **Phase 2 — precision:** shared MarkInspector, selectable part rows, zoom-tied
   nudge, use-playhead, **snap-to-grid + the "keep to the grid" toggle** (§3), grid
   honesty line in the save flow.
4. **Phase 3 — commit:** inline naming, bottom-sheet receipt, danger-tier
   delete-original with the contextual sub-line.
5. **Phase 4 — reel parity + polish:** ghosted sections/pins on the editor reel,
   ruler, minimap, seam crossfade in the native renderers (device-verified).

## 8 · Founder decisions — SETTLED 2026-08-01

1. **Snap-to-grid on gridded takes: YES**, default ON, nudge steppers escape it.
2. "Also save the rest as one clip" on extract: **deferred**.
3. Combined trim+transform in one save: **deferred** (two saves via the child clip).
4. Destination stays fixed (same collection / same sketch): yes.
5. Seam crossfade: ship 8ms, tune by ear on device (Phase 4).
