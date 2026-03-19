# Practice Mode Pin UI Refactor

## Design Decisions

### Zoom behavior
- Pins stay on the **main reel only** (not minimap). They already track zoom/pan via the same `timelineTranslateX` and `timelineScale` shared values.
- Pins that scroll off-screen are naturally clipped. No minimap pin rendering needed.

### Overlapping labels
- **Stagger into two rows**: Sort markers by `atMs`, estimate each badge's pixel width, if two consecutive badges would overlap horizontally at current scale, bump the second one to row 1 (lower offset ~28px). Alternate back to row 0 when spacing permits.
- Container auto-sizes: single row height (~30px) when no overlaps, double row (~56px) when staggering is needed.

### + button placement
- Left side: small pin icon → "Pins" label → `+` button, forming a compact header row above the positioned badges.

---

## Changes

### 1. `PracticePinBadges.tsx` — Major refactor

**Remove**: The absolute-right `+` button.

**Add**:
- **Header row** at top: pin icon (Ionicons `pin-outline` or similar) + "Pins" text label + `+` add button. Compact, left-aligned.
- **Collision detection**: After sorting markers by `atMs`, for each pair of adjacent badges, estimate pixel width (label chars × ~7 + 16px padding). If the right edge of badge N overlaps the left edge of badge N+1 at current scale, assign badge N+1 to row 1. If badge N+1 is already row 1, the next badge goes back to row 0 (zigzag).
- Badges on **row 0**: `top: 0`, badges on **row 1**: `top: ~28px`
- Container height adjusts dynamically.

**Keep**: Tap to seek, longpress+drag to reposition (with yellow indicator line), release near original = open rename/delete actions sheet.

### 2. `PlayerScreen/index.tsx` — Simplify practice tools

**Compact practice card** (matching mockup density):
- Loop row: label + toggle + range pill (keep as-is, already clean)
- Speed row: replace discrete chips with a continuous slider with labeled ticks (0.5x, 1x, 1.5x, 2x) — matches mockup
- Count-in row: Off / 1b / 2b chips (keep as-is)
- Notes row: fold into the card as a single row with "Notes" label and "Add notes..." pressable text. Remove the separate `notesBox` below.

**Remove**: Standalone `notesBox` section, extra vertical gaps.

### 3. Pin header in `renderBelowOverlay`

Move the `+` button and "Pins" header into `PracticePinBadges` itself as a non-animated header row above the absolutely-positioned badges. The header stays fixed (not affected by timeline transform) while badges below track the timeline.

---

## Files to modify
1. `src/components/PlayerScreen/PracticePinBadges.tsx` — header row, collision detection, two-row stagger, remove old + button
2. `src/components/PlayerScreen/index.tsx` — compact practice tools, fold notes row, simplify speed to slider
