import type { ChordSheet } from "../types";

/**
 * The player's page tiles (2026-10-13): a lyric sheet and a chord chart shown
 * as miniature pages above the transport. These build what a tile prints —
 * the top of the real page, never a summary of it.
 */

/** A row of a chart miniature: a section's name, a system of bars, or a text block. */
export type ChartPreviewRow =
    | { kind: "label"; key: string; text: string }
    | { kind: "bars"; key: string; cells: string[] }
    | { kind: "text"; key: string; text: string };

/** Bars per system in the miniature. Two reads at tile width; four does not. */
export const CHART_PREVIEW_BARS_PER_ROW = 2;
/** Systems shown per section before the next section starts. */
export const CHART_PREVIEW_SYSTEMS_PER_SECTION = 2;
/** The tile fades out long before this; it only bounds the work. */
export const CHART_PREVIEW_MAX_ROWS = 8;

/** A bar as the chart draws it: its chords, or a rest dash when empty. */
export function chartBarText(chords: string[]): string {
    const named = chords.map((chord) => chord.trim()).filter(Boolean);
    return named.length > 0 ? named.join("  ") : "—";
}

export function buildChartPreview(sheet: ChordSheet | null | undefined): ChartPreviewRow[] {
    if (!sheet) return [];
    const rows: ChartPreviewRow[] = [];
    for (const section of sheet.sections) {
        if (rows.length >= CHART_PREVIEW_MAX_ROWS) break;
        if (section.kind === "text") {
            const text = section.text?.trim();
            if (text) rows.push({ kind: "text", key: section.id, text });
            continue;
        }
        if (section.measures.length === 0) continue;
        const label = section.label.trim();
        if (label) rows.push({ kind: "label", key: `${section.id}-label`, text: label });
        const systems = Math.min(
            CHART_PREVIEW_SYSTEMS_PER_SECTION,
            Math.ceil(section.measures.length / CHART_PREVIEW_BARS_PER_ROW)
        );
        for (let system = 0; system < systems; system += 1) {
            const start = system * CHART_PREVIEW_BARS_PER_ROW;
            rows.push({
                kind: "bars",
                key: `${section.id}-${system}`,
                cells: section.measures
                    .slice(start, start + CHART_PREVIEW_BARS_PER_ROW)
                    .map((measure) => chartBarText(measure.chords)),
            });
        }
    }
    return rows.slice(0, CHART_PREVIEW_MAX_ROWS);
}

/** Bars in the whole chart, for the tile's corner. */
export function countChartBars(sheet: ChordSheet | null | undefined): number {
    if (!sheet) return 0;
    return sheet.sections.reduce(
        (total, section) => total + (section.kind === "text" ? 0 : section.measures.length),
        0
    );
}

/** Lines of the lyric sheet a tile can hold. */
export const LYRIC_PREVIEW_LINES = 7;

/**
 * The top of the lyric page: leading blank lines dropped, stanza breaks kept
 * (a run of blanks collapses to one), cut at what the tile can show.
 */
export function buildLyricPreview(text: string, maxLines = LYRIC_PREVIEW_LINES): string {
    const out: string[] = [];
    for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
        const line = raw.trim();
        if (!line) {
            if (out.length === 0 || out[out.length - 1] === "") continue;
            out.push("");
        } else {
            out.push(line);
        }
        if (out.length >= maxLines) break;
    }
    while (out.length > 0 && out[out.length - 1] === "") out.pop();
    return out.join("\n");
}
