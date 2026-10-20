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
/** Clear of the clock ticks that ride the reel's top edge. Kept tight: the wave
 *  stays centred, so every point of lane costs it height on BOTH sides. */
export const PIN_LANE_TOP_PAD = 8;
/** The strip between the last name row and the waveform, where a pin whose name
 *  is hidden keeps its head. */
export const PIN_LANE_HEAD_STRIP = 5;
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

/** `full`: two name rows. `compact`: one — the short reel that makes room for the
 *  Tools drawers. `slim`: none, heads and rules only (the reading-height reel). */
export type ReelLaneDensity = "full" | "compact" | "slim";

/** Name rows a density allows. */
export function pinLaneMaxRows(density: ReelLaneDensity): number {
    return density === "full" ? PIN_LANE_MAX_ROWS : density === "compact" ? 1 : 0;
}

/** Reels shorter than this drop pin names entirely. */
export const SLIM_REEL_MAX_HEIGHT = 96;
/** Reels shorter than this keep one row of pin names. */
export const COMPACT_REEL_MAX_HEIGHT = 130;

/** The one rule both the canvas and the hitboxes use to pick a density. */
export function laneDensityForHeight(height: number): ReelLaneDensity {
    return height < SLIM_REEL_MAX_HEIGHT ? "slim" : height < COMPACT_REEL_MAX_HEIGHT ? "compact" : "full";
}

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
    const maxRows = pinLaneMaxRows(density);
    const rowRight: number[] = Array.from({ length: maxRows }, () => -Infinity);
    const rowLeft: number[] = Array.from({ length: maxRows }, () => Infinity);

    return sorted.map((marker) => {
        const hidden: PinLanePlacement<M> = { marker, row: -1, anchor: "start", nameWidth: 0 };
        if (maxRows === 0 || !marker.label) return hidden;

        const x = marker.atMs * pixelsPerMs * scale;
        const nameWidth = resolveNameWidth(marker);
        const reach = PIN_HEAD_RADIUS + PIN_NAME_GAP + nameWidth;
        const anchor: "start" | "end" = x + reach > contentWidth - PIN_EDGE_GUARD ? "end" : "start";
        const left = anchor === "start" ? x - PIN_HEAD_RADIUS : x - reach;
        const right = anchor === "start" ? x + reach : x + PIN_HEAD_RADIUS;

        for (let row = 0; row < maxRows; row += 1) {
            const clearOnRow = left >= rowRight[row] + PIN_NAME_CLEARANCE || right <= rowLeft[row] - PIN_NAME_CLEARANCE;
            // The stem drops from this row through every row beneath it.
            let stemClear = true;
            for (let below = row + 1; below < maxRows; below += 1) {
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

/**
 * How tall the full player's reel stands in each flow (2026-10-13, founder:
 * "larger when no lyrics/chords/tools are open"). One rule: the reel takes the
 * page when nothing else is asking for it, and pays rent the moment something
 * opens beneath it.
 *
 *   listening  nothing open — as tall as the page allows once the things that
 *              sit beneath it (the take's note, the page tiles) have their room
 *   tools      Tools drawers or the layers bench need the page
 *   reading    lyrics or a chart open (or being written): the slim tape
 */
export type ReelFlow = "listening" | "tools" | "reading";

/** What sits above the transport on the listening page. `tiles`: at least one
 *  written page (or the first-visit sketch card). `slots`: only empty slots. */
export type ListeningPages = "none" | "slots" | "tiles";
export type ListeningBelow = { pages: ListeningPages; note: boolean };

export const LISTENING_REEL_MIN_HEIGHT = 120;
export const LISTENING_REEL_MAX_HEIGHT = 400;
export const TOOLS_REEL_HEIGHT = 112;
export const READING_REEL_HEIGHT = 64;
/** Everything on the listening page that is always there and is not the reel:
 *  title block, minimap, the toolbar row and the transport, with a little air. */
export const LISTENING_BASE_RESERVE = 280;
/** Height of a written page tile, and of an empty slot. */
export const PAGE_TILE_HEIGHT = 168;
export const PAGE_SLOT_HEIGHT = 96;
/** Space the tile row keeps beneath itself. */
export const PAGE_ROW_GAP = 16;
/** The take's note under the toolbar: two lines of margin script. */
export const LISTENING_NOTE_RESERVE = 54;

/**
 * The listening page, half and half (founder, 2026-10-20): the reel and its minimap
 * take the top half of the page body (everything between the title and the
 * transport, as laid out), the pages beneath take the bottom half. Measured, so a
 * two-line title or a zoomed reel can never push the pages under the transport.
 */
export function listeningReelHeightForBody(bodyHeight: number): number {
    // The reel and its minimap share this half: the reel gives up the strip's room
    // when it shows (AudioReel minimapWithinHeight).
    const room = Math.round(bodyHeight / 2);
    return Math.max(LISTENING_REEL_MIN_HEIGHT, Math.min(LISTENING_REEL_MAX_HEIGHT, room));
}

/** `usableHeight` is the window's height less its top and bottom safe insets. */
export function reelHeightForFlow(
    flow: ReelFlow,
    usableHeight: number,
    below: ListeningBelow = { pages: "none", note: false }
): number {
    if (flow === "reading") return READING_REEL_HEIGHT;
    if (flow === "tools") return TOOLS_REEL_HEIGHT;
    const pages =
        below.pages === "tiles"
            ? PAGE_TILE_HEIGHT + PAGE_ROW_GAP
            : below.pages === "slots"
              ? PAGE_SLOT_HEIGHT + PAGE_ROW_GAP
              : 0;
    const room = Math.round(
        usableHeight - LISTENING_BASE_RESERVE - pages - (below.note ? LISTENING_NOTE_RESERVE : 0)
    );
    return Math.max(LISTENING_REEL_MIN_HEIGHT, Math.min(LISTENING_REEL_MAX_HEIGHT, room));
}
