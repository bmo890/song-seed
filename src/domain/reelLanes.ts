import type { PracticeMarker } from "../types";

/**
 * The reel's lanes (2026-10-13). Marks stopped being boxes laid over the audio
 * and got rooms of their own: pin names in a lane above the waveform, section
 * names on a rule below it, the waveform alone in the middle. This file is the
 * one source of that geometry — the Skia layer draws from it and the RN layer
 * (gestures only) lays its hitboxes out from it, so a touch target can never
 * drift from the picture.
 */

/** Height of one row of pin names. */
export const PIN_LANE_ROW_HEIGHT = 14;
/** Names stagger onto a second row, never a third: past that the name gives way. */
export const PIN_LANE_MAX_ROWS = 2;
/** Clear of the clock ticks and bar numbers that ride the reel's top edge. */
export const PIN_LANE_TOP_PAD = 12;
/** The strip between the last name row and the waveform, where a pin whose name
 *  is hidden keeps its head. */
export const PIN_LANE_HEAD_STRIP = 6;
export const PIN_HEAD_RADIUS = 2;
/** Head centre to the first glyph of the name. */
export const PIN_NAME_GAP = 5;
export const PIN_NAME_FONT_SIZE = 10.5;
/** Estimated advance per character at the name's size, for the RN hitboxes. */
export const PIN_NAME_CHAR_WIDTH = 6;
/** Breathing room between two names on the same row. */
export const PIN_NAME_CLEARANCE = 8;
/** A stem passing a name on a lower row keeps this far from its last glyph. */
export const PIN_STEM_CLEARANCE = 4;
export const PIN_EDGE_GUARD = 8;

/** Section rule along the reel's bottom edge, and the name that sits on it. */
export const SECTION_RULE_HEIGHT = 2;
export const SECTION_NAME_FONT_SIZE = 10.5;
export const SECTION_NAME_ROW_HEIGHT = 14;

export type ReelLaneDensity = "full" | "slim";

export type PinLanePlacement<M> = {
    marker: M;
    /** Row of the name (0 = top). -1 when the name is not drawn. */
    row: number;
    /** Which side of the head the name flies on. */
    anchor: "start" | "end";
    /** Width of the name as drawn, 0 when hidden. */
    nameWidth: number;
};

export function estimatePinNameWidth(label: string | undefined): number {
    return Math.ceil((label?.length ?? 0) * PIN_NAME_CHAR_WIDTH);
}

/**
 * Place every pin's name. In time order, each name takes the TOP row if it is
 * clear there and its stem would not cut through a name on the row beneath;
 * otherwise the second row; otherwise the name gives way and only the head and
 * stem are drawn. Staggering DOWNWARD is what keeps stems out of names: a pin
 * on the lower row starts below its neighbour's name instead of piercing it.
 */
export function layoutPinLane<M extends Pick<PracticeMarker, "atMs"> & { label?: string }>(
    markers: M[],
    pixelsPerMs: number,
    scale: number,
    durationMs: number,
    density: ReelLaneDensity,
    resolveNameWidth: (marker: M) => number = (marker) => estimatePinNameWidth(marker.label)
): PinLanePlacement<M>[] {
    if (markers.length === 0) return [];
    const sorted = [...markers].sort((a, b) => a.atMs - b.atMs);
    const contentWidth = durationMs * pixelsPerMs * scale;
    const rowRight: number[] = Array.from({ length: PIN_LANE_MAX_ROWS }, () => -Infinity);
    const rowLeft: number[] = Array.from({ length: PIN_LANE_MAX_ROWS }, () => Infinity);

    return sorted.map((marker) => {
        const hidden: PinLanePlacement<M> = { marker, row: -1, anchor: "start", nameWidth: 0 };
        if (density === "slim" || !marker.label) return hidden;

        const x = marker.atMs * pixelsPerMs * scale;
        const nameWidth = resolveNameWidth(marker);
        const reach = PIN_HEAD_RADIUS + PIN_NAME_GAP + nameWidth;
        const anchor: "start" | "end" = x + reach > contentWidth - PIN_EDGE_GUARD ? "end" : "start";
        const left = anchor === "start" ? x - PIN_HEAD_RADIUS : x - reach;
        const right = anchor === "start" ? x + reach : x + PIN_HEAD_RADIUS;

        for (let row = 0; row < PIN_LANE_MAX_ROWS; row += 1) {
            const clearOnRow = left >= rowRight[row] + PIN_NAME_CLEARANCE || right <= rowLeft[row] - PIN_NAME_CLEARANCE;
            // The stem drops from this row through every row beneath it.
            let stemClear = true;
            for (let below = row + 1; below < PIN_LANE_MAX_ROWS; below += 1) {
                if (x < rowRight[below] + PIN_STEM_CLEARANCE && x > rowLeft[below] - PIN_STEM_CLEARANCE) stemClear = false;
            }
            if (clearOnRow && stemClear) {
                rowRight[row] = Math.max(rowRight[row], right);
                rowLeft[row] = Math.min(rowLeft[row], left);
                return { marker, row, anchor, nameWidth };
            }
        }
        return hidden;
    });
}

/** How many name rows the lane needs for this layout. */
export function pinLaneRowCount(placements: { row: number }[]): number {
    return placements.reduce((rows, placement) => Math.max(rows, placement.row + 1), 0);
}

/** Top inset of the waveform: the pin lane's whole height, 0 with no pins. */
export function pinLaneHeight(pinCount: number, rowCount: number): number {
    if (pinCount === 0) return 0;
    return PIN_LANE_TOP_PAD + rowCount * PIN_LANE_ROW_HEIGHT + PIN_LANE_HEAD_STRIP;
}

/** Vertical centre of a name row. */
export function pinLaneRowCenterY(row: number): number {
    return PIN_LANE_TOP_PAD + row * PIN_LANE_ROW_HEIGHT + PIN_LANE_ROW_HEIGHT / 2;
}

/** Where a pin's head sits: beside its name, or in the head strip when the name is hidden. */
export function pinHeadY(row: number, laneHeight: number): number {
    return row >= 0 ? pinLaneRowCenterY(row) : laneHeight - PIN_LANE_HEAD_STRIP / 2;
}

/** Bottom inset of the waveform: the section lane's height, 0 with no sections. */
export function sectionLaneHeight(sectionCount: number, density: ReelLaneDensity): number {
    if (sectionCount === 0) return 0;
    return density === "slim" ? SECTION_RULE_HEIGHT + 3 : SECTION_RULE_HEIGHT + SECTION_NAME_ROW_HEIGHT + 3;
}
