import type { PracticeMarker } from "../types";

/**
 * Geometry of the practice-pin badges, shared between the Skia layer that DRAWS them
 * (inside the reel canvas, glued to the tape by construction) and the RN layer that
 * carries their GESTURES (invisible at rest; visible only mid-drag, under the finger,
 * where a one-frame slip cannot be seen). One source of numbers, or the touch targets
 * drift from the picture.
 */

export const PIN_BADGE_HEIGHT = 18;
export const PIN_BADGE_CHAR_WIDTH = 6;
export const PIN_BADGE_H_PAD = 12;
export const PIN_ROW_GAP = 2;
export const PIN_TOP_PAD = 3;
export const PIN_EDGE_GUARD_PX = 8;
export const PIN_DOT_SIZE = 10;
/**
 * Longest pin label. The cap is a LAYOUT fact, not a taste one: the badge is drawn
 * this many characters wide on the tape, and much past this it stops being a mark and
 * becomes a banner across the take.
 */
export const MAX_PIN_LABEL_LENGTH = 24;

/** Trim and cap a label to what the badge can actually draw. */
export function clampPinLabel(label: string): string {
    return label.trim().slice(0, MAX_PIN_LABEL_LENGTH);
}

export type PinBadgeAnchor = "start" | "end";

export function estimatePinBadgeWidth(label: string | undefined): number {
    if (!label) return PIN_BADGE_HEIGHT; // unlabelled pin is a dot
    return Math.max(32, label.length * PIN_BADGE_CHAR_WIDTH + PIN_BADGE_H_PAD);
}

/** The label is a flag flying RIGHT of the pin line; near the right edge it flips. */
export function resolvePinBadgeAnchor(
    centerX: number,
    width: number,
    contentWidth: number
): PinBadgeAnchor {
    if (centerX + width > contentWidth - PIN_EDGE_GUARD_PX) return "end";
    return "start";
}

export function getPinBadgeEdges(centerX: number, width: number, anchor: PinBadgeAnchor) {
    if (anchor === "end") return { left: centerX - width, right: centerX };
    return { left: centerX, right: centerX + width };
}

export type PinRowAssignment<M> = { marker: M; row: number };

/** First row whose last badge clears this one; overlapping pins drop a row. */
export function assignPinRows<M extends Pick<PracticeMarker, "atMs"> & { label?: string }>(
    markers: M[],
    pixelsPerMs: number,
    scale: number,
    durationMs: number
): PinRowAssignment<M>[] {
    if (markers.length === 0) return [];
    const sorted = [...markers].sort((a, b) => a.atMs - b.atMs);
    const contentWidth = durationMs * pixelsPerMs * scale;
    const rowRightEdges: number[] = [];
    const result: PinRowAssignment<M>[] = [];

    for (const marker of sorted) {
        const centerX = marker.atMs * pixelsPerMs * scale;
        const width = estimatePinBadgeWidth(marker.label);
        const anchor = resolvePinBadgeAnchor(centerX, width, contentWidth);
        const { left, right } = getPinBadgeEdges(centerX, width, anchor);

        let assignedRow = rowRightEdges.findIndex((edge) => left >= edge + 4);
        if (assignedRow === -1) {
            assignedRow = rowRightEdges.length;
            rowRightEdges.push(right);
        } else {
            rowRightEdges[assignedRow] = right;
        }
        result.push({ marker, row: assignedRow });
    }
    return result;
}

export function pinRowTop(row: number): number {
    return PIN_TOP_PAD + row * (PIN_BADGE_HEIGHT + PIN_ROW_GAP);
}
