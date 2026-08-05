import {
  assignPinRows,
  estimatePinBadgeWidth,
  getPinBadgeEdges,
  pinRowTop,
  resolvePinBadgeAnchor,
  MAX_PIN_LABEL_LENGTH,
  MIN_PIN_BADGE_WIDTH,
  clampPinLabel,
} from "../practicePinLayout";

const DURATION = 41_000;
const PIXELS_PER_MS = 350 / DURATION;
const SCALE = 1;

/** The rectangle a badge actually occupies, from the same inputs the renderer uses. */
function badgeSpan(marker: { atMs: number; label?: string }, width: number) {
  const centerX = marker.atMs * PIXELS_PER_MS * SCALE;
  const contentWidth = DURATION * PIXELS_PER_MS * SCALE;
  const anchor = resolvePinBadgeAnchor(centerX, width, contentWidth);
  return getPinBadgeEdges(centerX, width, anchor);
}

describe("assignPinRows", () => {
  it("keeps clear pins on one row", () => {
    const markers = [
      { id: "a", atMs: 2_000, label: "one" },
      { id: "b", atMs: 30_000, label: "two" },
    ];
    const rows = assignPinRows(markers, PIXELS_PER_MS, SCALE, DURATION);
    expect(rows.map((r) => r.row)).toEqual([0, 0]);
  });

  it("drops a colliding pin to the next row so labels never intersect", () => {
    // Two pins three seconds apart, the first wearing a long label: its badge
    // reaches past the second, so the second must stagger down.
    const markers = [
      { id: "long", atMs: 19_000, label: "a fairly long pin name" },
      { id: "next", atMs: 22_000, label: "Pin" },
    ];
    const rows = assignPinRows(markers, PIXELS_PER_MS, SCALE, DURATION);
    expect(rows.find((r) => r.marker.id === "next")!.row).toBeGreaterThan(0);
    expect(pinRowTop(1)).toBeGreaterThan(pinRowTop(0));
  });

  it("packs with the width the caller will DRAW with, not its own estimate", () => {
    // The regression, reproduced. Near the right edge a long badge flips its
    // anchor to fly LEFT of the pin. If packing sizes it by estimate (wide →
    // flips) while the tape draws it from a font measurement (narrow → doesn't),
    // the packer reserves the left side while the renderer draws on the right —
    // and a later pin gets cleared onto a row it actually collides with.
    // 250px and 270px into a 350px tape: past the flip point for the estimate,
    // short of it for the measurement.
    const atPx = (px: number) => Math.round(px / PIXELS_PER_MS);
    const markers = [
      { id: "long", atMs: atPx(250), label: "a fairly long pin name" },
      { id: "next", atMs: atPx(270), label: "Pin" },
    ];
    // A measured width much narrower than the estimate — exactly the divergence.
    const measured = (marker: { label?: string }) =>
      Math.max(MIN_PIN_BADGE_WIDTH, (marker.label?.length ?? 0) * 3 + 10);

    const rows = assignPinRows(markers, PIXELS_PER_MS, SCALE, DURATION, measured);

    // No two badges on the same row may overlap, measured the way they're drawn.
    const byRow = new Map<number, { left: number; right: number }[]>();
    for (const { marker, row } of rows) {
      const span = badgeSpan(marker, measured(marker));
      const spans = byRow.get(row) ?? [];
      for (const other of spans) {
        expect(span.left >= other.right || span.right <= other.left).toBe(true);
      }
      spans.push(span);
      byRow.set(row, spans);
    }
  });

  it("gives an unnamed pin a grabbable minimum badge", () => {
    expect(estimatePinBadgeWidth(undefined)).toBe(MIN_PIN_BADGE_WIDTH);
    expect(estimatePinBadgeWidth("")).toBe(MIN_PIN_BADGE_WIDTH);
  });
});

describe("clampPinLabel", () => {
  it("trims and caps to the drawn length", () => {
    expect(clampPinLabel("  hook  ")).toBe("hook");
    expect(clampPinLabel("x".repeat(60))).toHaveLength(MAX_PIN_LABEL_LENGTH);
  });
});
