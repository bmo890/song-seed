import type { RecordingGrid } from "../../types";
import { barLeadIn, frameLevels, isLeadInQuiet, planBarAlignedExport } from "../barAlignedExport";
import { TEMPO_MAP_SCHEMA_VERSION } from "../tempoMap";
import { parseWavLayout } from "../wavHeader";

const SR = 48_000;
// 91 bpm in 4/4, the founder's take: beat 659.34 ms, bar 2637.36 ms.
const BEAT_MS = 60_000 / 91;
const BAR_MS = BEAT_MS * 4;

function grid(overrides: Partial<RecordingGrid> = {}): RecordingGrid {
    return {
        bpm: 91,
        meterId: "4/4",
        countInBars: 0,
        clickThroughTake: true,
        firstDownbeatMs: 1200,
        source: "metronome",
        ...overrides,
    };
}

/** Per-frame levels: room noise at −60 dBFS, plus bursts at the given ms. */
function levels(lengthMs: number, bursts: { atMs: number; ms: number; level: number }[]) {
    const out = new Float32Array(Math.round((lengthMs * SR) / 1000)).fill(0.001);
    for (const burst of bursts) {
        const from = Math.round((burst.atMs * SR) / 1000);
        const to = Math.min(out.length, from + Math.round((burst.ms * SR) / 1000));
        for (let frame = from; frame < to; frame += 1) out[frame] = burst.level;
    }
    return out;
}

describe("barLeadIn", () => {
    it("finds the first bar line of a take that started mid-bar", () => {
        const lead = barLeadIn(grid());
        expect(lead?.leadMs).toBeCloseTo(1200, 6);
        expect(lead?.barMs).toBeCloseTo(BAR_MS, 6);
        expect(lead?.beatMs).toBeCloseTo(BEAT_MS, 6);
    });

    it("folds a downbeat measured more than a bar in back to the first bar line", () => {
        expect(barLeadIn(grid({ firstDownbeatMs: BAR_MS + 300 }))?.leadMs).toBeCloseTo(300, 6);
    });

    it("leaves takes that weren't recorded to the click alone", () => {
        expect(barLeadIn(null)).toBeNull();
        expect(barLeadIn(grid({ source: "detected" }))).toBeNull();
        expect(barLeadIn(grid({ source: "manual" }))).toBeNull();
        expect(barLeadIn(grid({ firstDownbeatMs: null }))).toBeNull();
    });

    it("trusts no grid that broke before its first bar line", () => {
        expect(barLeadIn(grid({ gridValidToMs: 900 }))).toBeNull();
        expect(barLeadIn(grid({ gridValidToMs: 30_000 }))).not.toBeNull();
    });

    it("runs the lead-in at the first tempo of a tempo map", () => {
        const lead = barLeadIn(
            grid({
                tempoMap: {
                    schemaVersion: TEMPO_MAP_SCHEMA_VERSION,
                    segments: [
                        { atBar: 1, bpm: 120, meterId: "3/4" },
                        { atBar: 5, bpm: 90, meterId: "4/4" },
                    ],
                },
            })
        );
        expect(lead?.barMs).toBeCloseTo(1500, 6);
    });
});

describe("isLeadInQuiet", () => {
    const lead = barLeadIn(grid())!;

    it("hears an empty lead-in through the clicks a running preview left in it", () => {
        // Beat 4 of the bar before sits one beat ahead of the bar line, with its ring.
        const clickAt = lead.leadMs - BEAT_MS;
        expect(isLeadInQuiet(levels(lead.leadMs, [{ atMs: clickAt, ms: 120, level: 0.4 }]), SR, lead)).toBe(true);
    });

    it("hears a pickup between the clicks", () => {
        const pickup = levels(lead.leadMs, [{ atMs: 900, ms: 200, level: 0.2 }]);
        expect(isLeadInQuiet(pickup, SR, lead)).toBe(false);
    });

    it("ignores the downbeat's own attack arriving a hair early", () => {
        expect(isLeadInQuiet(levels(lead.leadMs, [{ atMs: lead.leadMs - 5, ms: 5, level: 0.5 }]), SR, lead)).toBe(true);
    });

    it("counts quiet playing under −40 dBFS as room", () => {
        expect(isLeadInQuiet(levels(lead.leadMs, [{ atMs: 200, ms: 100, level: 0.008 }]), SR, lead)).toBe(true);
        expect(isLeadInQuiet(levels(lead.leadMs, [{ atMs: 200, ms: 100, level: 0.012 }]), SR, lead)).toBe(false);
    });
});

describe("planBarAlignedExport", () => {
    const lead = barLeadIn(grid())!;

    it("cuts an empty lead-in so the file starts on beat 1", () => {
        expect(planBarAlignedExport({ lead, sampleRate: SR, quiet: true })).toEqual({ kind: "cut", frames: 57_600 });
    });

    it("pads a pickup back to the bar line before it, cutting nothing", () => {
        const plan = planBarAlignedExport({ lead, sampleRate: SR, quiet: false });
        expect(plan).toEqual({ kind: "pad", frames: Math.round((BAR_MS * SR) / 1000) - 57_600 });
        // Silence + lead-in = exactly one bar: the downbeat lands on bar 2.
        if (plan.kind === "pad") expect(plan.frames + 57_600).toBe(Math.round((BAR_MS * SR) / 1000));
    });

    it("leaves a take already on the bar line (a count-in take) as it is", () => {
        const onTheBar = barLeadIn(grid({ firstDownbeatMs: 0.4 }))!;
        expect(planBarAlignedExport({ lead: onTheBar, sampleRate: SR, quiet: false })).toEqual({ kind: "asIs" });
    });
});

describe("frameLevels", () => {
    it("takes each frame's loudest channel from 16-bit stereo", () => {
        const bytes = new Uint8Array(8);
        const view = new DataView(bytes.buffer);
        view.setInt16(0, 16384, true);
        view.setInt16(2, -32768, true);
        view.setInt16(4, 0, true);
        view.setInt16(6, -8192, true);
        expect(Array.from(frameLevels(bytes, { channels: 2, bitsPerSample: 16, sampleFormat: "int" }))).toEqual([1, 0.25]);
    });

    it("reads 32-bit float and 24-bit int", () => {
        const float = new Uint8Array(4);
        new DataView(float.buffer).setFloat32(0, -0.5, true);
        expect(frameLevels(float, { channels: 1, bitsPerSample: 32, sampleFormat: "float" })[0]).toBeCloseTo(0.5, 6);
        const int24 = new Uint8Array([0x00, 0x00, 0xc0]); // −0.5
        expect(frameLevels(int24, { channels: 1, bitsPerSample: 24, sampleFormat: "int" })[0]).toBeCloseTo(0.5, 6);
    });
});

describe("parseWavLayout", () => {
    function header(tag: number, bits: number, channels = 1, dataSize = 960) {
        const bytes = new Uint8Array(44);
        const view = new DataView(bytes.buffer);
        bytes.set([0x52, 0x49, 0x46, 0x46], 0);
        view.setUint32(4, 36 + dataSize, true);
        bytes.set([0x57, 0x41, 0x56, 0x45], 8);
        bytes.set([0x66, 0x6d, 0x74, 0x20], 12);
        view.setUint32(16, 16, true);
        view.setUint16(20, tag, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, SR, true);
        view.setUint32(28, SR * channels * (bits / 8), true);
        view.setUint16(32, channels * (bits / 8), true);
        view.setUint16(34, bits, true);
        bytes.set([0x64, 0x61, 0x74, 0x61], 36);
        view.setUint32(40, dataSize, true);
        return bytes;
    }

    it("describes integer and float PCM", () => {
        expect(parseWavLayout(header(1, 16), 44 + 960)).toEqual({
            dataStart: 44,
            dataBytes: 960,
            sampleRate: SR,
            channels: 1,
            bitsPerSample: 16,
            blockAlign: 2,
            sampleFormat: "int",
        });
        expect(parseWavLayout(header(3, 32, 2), 44 + 960)?.sampleFormat).toBe("float");
    });

    it("reads an unfinalized take's audio from the bytes on disk", () => {
        expect(parseWavLayout(header(1, 16, 1, 0), 44 + 501)?.dataBytes).toBe(500);
    });

    it("refuses what it can't rewrite safely", () => {
        expect(parseWavLayout(header(1, 8), 44 + 960)).toBeNull();
        expect(parseWavLayout(header(2, 16), 44 + 960)).toBeNull();
        expect(parseWavLayout(new Uint8Array(44), 44)).toBeNull();
    });
});
