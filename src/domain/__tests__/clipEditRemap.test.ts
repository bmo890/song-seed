import {
    buildSpanRuns,
    complementSpans,
    remapClipForRate,
    remapClipForSpans,
    spanRunsOutputDurationMs,
    type RemappableClipFacts,
} from "../clipEditRemap";
import { TEMPO_MAP_SCHEMA_VERSION } from "../tempoMap";
import type { ClipSection, PracticeMarker, RecordingGrid } from "../../types";

/** 120bpm 4/4: pulse 500ms, bar 2000ms. Grid zero at file t=0 unless a test moves it. */
const GRID: RecordingGrid = {
    bpm: 120,
    meterId: "4/4",
    tempoMap: undefined,
    grouping: undefined,
    countInBars: 2,
    clickThroughTake: true,
    firstDownbeatMs: 0,
    gridValidToMs: undefined,
    source: "metronome",
};

function facts(over: Partial<RemappableClipFacts> = {}): RemappableClipFacts {
    return { recordingGrid: GRID, ...over };
}

function pin(atMs: number, id = `p${atMs}`): PracticeMarker {
    return { id, label: "pin", atMs };
}

function section(startMs: number, endMs: number, id = `s${startMs}`): ClipSection {
    return { id, startMs, endMs, label: "Verse", kind: "verse" };
}

describe("complementSpans", () => {
    it("returns what survives when spans are removed", () => {
        expect(complementSpans([{ startMs: 2000, endMs: 4000 }], 10_000)).toEqual([
            { startMs: 0, endMs: 2000 },
            { startMs: 4000, endMs: 10_000 },
        ]);
    });

    it("collapses touching and overlapping removals into one gap", () => {
        expect(
            complementSpans(
                [
                    { startMs: 2000, endMs: 4000 },
                    { startMs: 4000, endMs: 5000 },
                    { startMs: 4500, endMs: 6000 },
                ],
                10_000
            )
        ).toEqual([
            { startMs: 0, endMs: 2000 },
            { startMs: 6000, endMs: 10_000 },
        ]);
    });

    it("returns nothing when everything is removed", () => {
        expect(complementSpans([{ startMs: 0, endMs: 10_000 }], 10_000)).toEqual([]);
    });
});

describe("buildSpanRuns", () => {
    it("merges touching keeps so they are not mistaken for a seam", () => {
        const runs = buildSpanRuns(
            [
                { startMs: 0, endMs: 2000 },
                { startMs: 2000, endMs: 5000 },
            ],
            10_000
        );
        expect(runs).toHaveLength(1);
        expect(spanRunsOutputDurationMs(runs)).toBe(5000);
    });

    it("sorts, clamps to the source and lays spans end to end", () => {
        const runs = buildSpanRuns(
            [
                { startMs: 6000, endMs: 99_000 },
                { startMs: -500, endMs: 1000 },
            ],
            8000
        );
        expect(runs.map((run) => [run.sourceStartMs, run.sourceEndMs, run.outputStartMs])).toEqual([
            [0, 1000, 0],
            [6000, 8000, 1000],
        ]);
    });
});

describe("pins through an edit", () => {
    it("rebases pins inside an extract and drops the rest", () => {
        const result = remapClipForSpans(
            facts({ practiceMarkers: [pin(1000), pin(45_000), pin(70_000)] }),
            [{ startMs: 30_000, endMs: 60_000 }],
            90_000
        );
        // The bug this replaces: 45s was cloned verbatim onto a 30s file.
        expect(result.practiceMarkers).toEqual([expect.objectContaining({ atMs: 15_000 })]);
    });

    it("shifts pins left by the material removed before them", () => {
        const spans = complementSpans([{ startMs: 4000, endMs: 6000 }], 20_000);
        const result = remapClipForSpans(
            facts({ practiceMarkers: [pin(2000), pin(5000), pin(10_000)] }),
            spans,
            20_000
        );
        expect(result.practiceMarkers?.map((marker) => marker.atMs)).toEqual([2000, 8000]);
    });

    it("keeps a pin that lands exactly on a seam", () => {
        const spans = complementSpans([{ startMs: 4000, endMs: 6000 }], 20_000);
        const result = remapClipForSpans(facts({ practiceMarkers: [pin(4000)] }), spans, 20_000);
        expect(result.practiceMarkers?.map((marker) => marker.atMs)).toEqual([4000]);
    });
});

describe("sections through an edit", () => {
    it("clips a section to the extracted window", () => {
        const result = remapClipForSpans(
            facts({ sections: [section(20_000, 50_000)] }),
            [{ startMs: 30_000, endMs: 60_000 }],
            90_000
        );
        expect(result.sections).toEqual([
            expect.objectContaining({ startMs: 0, endMs: 20_000 }),
        ]);
    });

    it("keeps a section straddling a cut as ONE shorter section", () => {
        const spans = complementSpans([{ startMs: 8000, endMs: 10_000 }], 30_000);
        const result = remapClipForSpans(facts({ sections: [section(6000, 14_000)] }), spans, 30_000);
        expect(result.sections).toHaveLength(1);
        expect(result.sections?.[0]).toEqual(
            expect.objectContaining({ startMs: 6000, endMs: 12_000 })
        );
    });

    it("drops a section the edit swallowed", () => {
        const spans = complementSpans([{ startMs: 5000, endMs: 9000 }], 30_000);
        const result = remapClipForSpans(facts({ sections: [section(6000, 8000)] }), spans, 30_000);
        expect(result.sections).toBeUndefined();
    });
});

describe("grid through an extract", () => {
    it("keeps the grid exactly when the extract starts on a downbeat", () => {
        // 4000ms = the downbeat of bar 3.
        const result = remapClipForSpans(facts(), [{ startMs: 4000, endMs: 12_000 }], 30_000);
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid).toEqual(
            expect.objectContaining({ bpm: 120, meterId: "4/4", firstDownbeatMs: 0 })
        );
    });

    it("keeps a perfect grid when the extract starts mid-bar (the beat-3 case)", () => {
        // 5000ms = beat 3 of bar 3. The next downbeat (bar 4, 6000ms) becomes bar 1,
        // 1000ms into the new file — the partial bar before it extrapolates backwards.
        const result = remapClipForSpans(facts(), [{ startMs: 5000, endMs: 20_000 }], 30_000);
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid?.firstDownbeatMs).toBeCloseTo(1000, 6);
        expect(result.recordingGrid?.bpm).toBe(120);
    });

    it("drops the grid when no downbeat survives the extract", () => {
        const result = remapClipForSpans(facts(), [{ startMs: 4100, endMs: 5900 }], 30_000);
        expect(result.gridOutcome).toEqual({ kind: "dropped" });
        expect(result.recordingGrid).toBeUndefined();
    });

    it("reports no grid when the source never had a measured downbeat", () => {
        const result = remapClipForSpans(
            facts({ recordingGrid: { ...GRID, firstDownbeatMs: null } }),
            [{ startMs: 0, endMs: 10_000 }],
            30_000
        );
        expect(result.gridOutcome).toEqual({ kind: "none" });
        expect(result.recordingGrid).toBeUndefined();
    });

    it("zeroes the count-in once the head is trimmed, and keeps it when it is not", () => {
        const trimmedHead = remapClipForSpans(facts(), [{ startMs: 4000, endMs: 12_000 }], 30_000);
        expect(trimmedHead.recordingGrid?.countInBars).toBe(0);

        const intactHead = remapClipForSpans(facts(), [{ startMs: 0, endMs: 12_000 }], 30_000);
        expect(intactHead.recordingGrid?.countInBars).toBe(2);
    });
});

describe("grid through a cut", () => {
    it("survives a head cut — it is only a rebase", () => {
        const spans = complementSpans([{ startMs: 0, endMs: 4000 }], 30_000);
        const result = remapClipForSpans(facts(), spans, 30_000);
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid?.firstDownbeatMs).toBeCloseTo(0, 6);
    });

    it("survives a tail cut untouched", () => {
        const spans = complementSpans([{ startMs: 20_000, endMs: 30_000 }], 30_000);
        const result = remapClipForSpans(facts(), spans, 30_000);
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid?.firstDownbeatMs).toBeCloseTo(0, 6);
    });

    it("survives an interior cut that removes whole bars", () => {
        // 4000→8000 removes exactly bars 3 and 4.
        const spans = complementSpans([{ startMs: 4000, endMs: 8000 }], 30_000);
        const result = remapClipForSpans(facts(), spans, 30_000);
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid?.gridValidToMs).toBeUndefined();
    });

    it("survives a mid-bar cut that removes exactly one bar at a steady tempo", () => {
        // 5000→7000: starts on beat 3, ends on beat 3, one whole bar of material gone,
        // so the two halves reassemble into one correctly-sized bar.
        const spans = complementSpans([{ startMs: 5000, endMs: 7000 }], 30_000);
        const result = remapClipForSpans(facts(), spans, 30_000);
        expect(result.gridOutcome).toEqual({ kind: "kept" });
    });

    it("stops trusting the grid at a cut that lands off the bar line", () => {
        // 5000→6000 removes half a bar: the music re-enters on beat 3 while the grid
        // still says beat 1. Everything after the seam is musically void.
        const spans = complementSpans([{ startMs: 5000, endMs: 6000 }], 30_000);
        const result = remapClipForSpans(facts(), spans, 30_000);
        expect(result.gridOutcome).toEqual({ kind: "partial", validToMs: 5000 });
        expect(result.recordingGrid?.gridValidToMs).toBe(5000);
        // The grid still drives the ruler and click up to the seam.
        expect(result.recordingGrid?.firstDownbeatMs).toBeCloseTo(0, 6);
    });

    it("reports the FIRST bad seam when several cuts are made", () => {
        const spans = complementSpans(
            [
                { startMs: 4000, endMs: 8000 }, // whole bars — transparent
                { startMs: 12_000, endMs: 13_000 }, // half a bar — breaks the grid
            ],
            30_000
        );
        const result = remapClipForSpans(facts(), spans, 30_000);
        // 12_000 in the source is 8_000 in the output (4s already removed).
        expect(result.gridOutcome).toEqual({ kind: "partial", validToMs: 8000 });
    });

    it("carries an existing invalidation point onto the new timeline", () => {
        const spans = complementSpans([{ startMs: 2000, endMs: 4000 }], 30_000);
        const result = remapClipForSpans(
            facts({ recordingGrid: { ...GRID, gridValidToMs: 20_000 } }),
            spans,
            30_000
        );
        expect(result.gridOutcome).toEqual({ kind: "partial", validToMs: 18_000 });
    });
});

describe("free editing (grid policy)", () => {
    const FREE = { gridPolicy: "free" as const };

    it("drops the grid outright when a cut breaks it, instead of half-keeping it", () => {
        const spans = complementSpans([{ startMs: 5000, endMs: 6000 }], 30_000);
        const strict = remapClipForSpans(facts(), spans, 30_000);
        const free = remapClipForSpans(facts(), spans, 30_000, FREE);

        expect(strict.gridOutcome).toEqual({ kind: "partial", validToMs: 5000 });
        expect(free.gridOutcome).toEqual({ kind: "dropped" });
        expect(free.recordingGrid).toBeUndefined();
    });

    it("still keeps a perfect grid through an off-grid extract — nothing was broken", () => {
        // The policy is about breakage, not punishment: an extract re-anchors exactly
        // wherever it starts, so free editing costs nothing here.
        const free = remapClipForSpans(facts(), [{ startMs: 5000, endMs: 20_000 }], 30_000, FREE);
        expect(free.gridOutcome).toEqual({ kind: "kept" });
        expect(free.recordingGrid?.firstDownbeatMs).toBeCloseTo(1000, 6);
    });

    it("still keeps the grid through head and tail cuts", () => {
        const head = complementSpans([{ startMs: 0, endMs: 4321 }], 30_000);
        const tail = complementSpans([{ startMs: 21_234, endMs: 30_000 }], 30_000);
        expect(remapClipForSpans(facts(), head, 30_000, FREE).gridOutcome).toEqual({ kind: "kept" });
        expect(remapClipForSpans(facts(), tail, 30_000, FREE).gridOutcome).toEqual({ kind: "kept" });
    });

    it("keeps the source's own invalidation — that is inherited, not this edit's doing", () => {
        const spans = complementSpans([{ startMs: 2000, endMs: 4000 }], 30_000);
        const free = remapClipForSpans(
            facts({ recordingGrid: { ...GRID, gridValidToMs: 20_000 } }),
            spans,
            30_000,
            FREE
        );
        expect(free.gridOutcome).toEqual({ kind: "partial", validToMs: 18_000 });
    });

    it("never costs pins or sections — they do not depend on bar alignment", () => {
        const spans = complementSpans([{ startMs: 5000, endMs: 6000 }], 30_000);
        const free = remapClipForSpans(
            facts({ practiceMarkers: [pin(2000), pin(9000)], sections: [section(0, 12_000)] }),
            spans,
            30_000,
            FREE
        );
        expect(free.gridOutcome).toEqual({ kind: "dropped" });
        expect(free.practiceMarkers?.map((marker) => marker.atMs)).toEqual([2000, 8000]);
        expect(free.sections?.[0]).toEqual(expect.objectContaining({ startMs: 0, endMs: 11_000 }));
    });
});

describe("grid with tempo changes", () => {
    /** 120bpm from bar 1, 60bpm from bar 5 (i.e. from 8000ms). Bars: 2000ms then 4000ms. */
    const RAMPED: RecordingGrid = {
        ...GRID,
        tempoMap: {
            schemaVersion: TEMPO_MAP_SCHEMA_VERSION,
            segments: [
                { atBar: 1, bpm: 120, meterId: "4/4" },
                { atBar: 5, bpm: 60, meterId: "4/4" },
            ],
        },
    };

    it("renumbers segments when whole bars are removed before a tempo change", () => {
        // Remove bars 2–3 (2000→6000): the 60bpm change moves from bar 5 to bar 3.
        const spans = complementSpans([{ startMs: 2000, endMs: 6000 }], 40_000);
        const result = remapClipForSpans(facts({ recordingGrid: RAMPED }), spans, 40_000);
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid?.tempoMap?.segments).toEqual([
            { atBar: 1, bpm: 120, meterId: "4/4" },
            { atBar: 3, bpm: 60, meterId: "4/4" },
        ]);
    });

    it("keeps a tempo change that began inside removed material", () => {
        // Extract from 10_000 (bar 5 is at 8000, bar 6 at 12_000): the 60bpm segment
        // starts before the window but governs it.
        const result = remapClipForSpans(
            facts({ recordingGrid: RAMPED }),
            [{ startMs: 10_000, endMs: 30_000 }],
            40_000
        );
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid?.bpm).toBe(60);
        expect(result.recordingGrid?.tempoMap).toBeUndefined(); // single tempo now
    });

    it("refuses a mid-bar cut whose two halves have different tempos", () => {
        // 5000 sits mid-bar at 120bpm; 14_000 sits mid-bar at 60bpm. Even though the
        // span happens to measure whole bars, the joined bar would belong to neither.
        const spans = complementSpans([{ startMs: 5000, endMs: 14_000 }], 40_000);
        const result = remapClipForSpans(facts({ recordingGrid: RAMPED }), spans, 40_000);
        expect(result.gridOutcome.kind).toBe("partial");
    });
});

describe("grid through a baked speed change", () => {
    it("leaves everything alone for a pitch-only render", () => {
        const result = remapClipForRate(facts({ practiceMarkers: [pin(4000)] }), 1, 30_000);
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid?.bpm).toBe(120);
        expect(result.practiceMarkers?.[0].atMs).toBe(4000);
    });

    it("scales tempo, anchor and pins together when the rate divides exactly", () => {
        const result = remapClipForRate(
            facts({
                practiceMarkers: [pin(4000)],
                sections: [section(0, 8000)],
                recordingGrid: { ...GRID, firstDownbeatMs: 300 },
            }),
            0.5,
            60_000
        );
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.recordingGrid?.bpm).toBe(60);
        expect(result.recordingGrid?.firstDownbeatMs).toBeCloseTo(600, 6);
        // The bug this replaces: pins kept their original ms on a stretched file.
        expect(result.practiceMarkers?.[0].atMs).toBe(8000);
        expect(result.sections?.[0]).toEqual(expect.objectContaining({ startMs: 0, endMs: 16_000 }));
    });

    it("drops the grid when the new tempo cannot be represented", () => {
        // 120 × 2.5 = 300bpm, past the engine's ceiling.
        const result = remapClipForRate(facts(), 2.5, 12_000);
        expect(result.gridOutcome).toEqual({ kind: "dropped" });
        expect(result.recordingGrid).toBeUndefined();
    });

    it("limits trust when whole-bpm rounding makes the click drift", () => {
        // 102 × 1.1 = 112.2 → stored 112. Relative error ~0.0018, so ~25ms of drift
        // accumulates in roughly 14 seconds.
        const result = remapClipForRate(
            facts({ recordingGrid: { ...GRID, bpm: 102 } }),
            1.1,
            120_000
        );
        expect(result.gridOutcome.kind).toBe("partial");
        const validToMs = (result.gridOutcome as { validToMs: number }).validToMs;
        expect(validToMs).toBeGreaterThan(10_000);
        expect(validToMs).toBeLessThan(20_000);
        expect(result.recordingGrid?.bpm).toBe(112);
    });
});

describe("detected tempo", () => {
    const ANALYSIS = {
        schemaVersion: 2,
        analyzedAt: 1,
        key: null,
        mode: null,
        keyConfidence: 0,
        bpm: 100,
        bpmSteadiness: 0.9,
        confirmed: true,
    };

    it("carries across an extract but makes the clip re-earn the confirmation", () => {
        const result = remapClipForSpans(
            facts({ analysis: ANALYSIS }),
            [{ startMs: 4000, endMs: 12_000 }],
            30_000
        );
        expect(result.analysis).toEqual(expect.objectContaining({ bpm: 100, confirmed: false }));
    });

    it("is dropped once a seam breaks the pulse it measured", () => {
        const spans = complementSpans([{ startMs: 4000, endMs: 8000 }], 30_000);
        expect(remapClipForSpans(facts({ analysis: ANALYSIS }), spans, 30_000).analysis).toBeUndefined();
    });

    it("scales with a baked speed change", () => {
        const result = remapClipForRate(facts({ analysis: ANALYSIS }), 0.5, 60_000);
        expect(result.analysis?.bpm).toBe(50);
    });
});

describe("degenerate edits", () => {
    it("returns nothing usable when the edit keeps no material", () => {
        const result = remapClipForSpans(facts({ practiceMarkers: [pin(10)] }), [], 30_000);
        expect(result.gridOutcome).toEqual({ kind: "dropped" });
        expect(result.practiceMarkers).toBeUndefined();
        expect(result.sections).toBeUndefined();
    });

    it("treats an extract of the whole file as a faithful copy", () => {
        const result = remapClipForSpans(
            facts({ practiceMarkers: [pin(4000)], sections: [section(0, 10_000)] }),
            [{ startMs: 0, endMs: 30_000 }],
            30_000
        );
        expect(result.gridOutcome).toEqual({ kind: "kept" });
        expect(result.practiceMarkers?.[0].atMs).toBe(4000);
        expect(result.sections?.[0]).toEqual(expect.objectContaining({ startMs: 0, endMs: 10_000 }));
        expect(result.recordingGrid?.countInBars).toBe(2);
    });
});
