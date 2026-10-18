import { assessWavHeader } from "../wavHeader";

/** The header the recorder writes at capture start: 44 bytes, sizes as placeholders. */
function canonicalHeader({
    riffSize = 0x24,
    dataSize = 0,
    channels = 1,
    sampleRate = 44100,
    bitsPerSample = 16,
} = {}) {
    const header = new Uint8Array(44);
    const view = new DataView(header.buffer);
    const blockAlign = channels * (bitsPerSample / 8);
    header.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    view.setUint32(4, riffSize, true);
    header.set([0x57, 0x41, 0x56, 0x45], 8); // WAVE
    header.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    header.set([0x64, 0x61, 0x74, 0x61], 36); // data
    view.setUint32(40, dataSize, true);
    return header;
}

describe("assessWavHeader", () => {
    it("finalizes a killed take from the bytes on disk (the 2026-10-18 sim file)", () => {
        // 10.3 s of mono 16-bit 44.1 kHz behind a placeholder header.
        const fileSize = 911_594;
        const result = assessWavHeader(canonicalHeader(), fileSize);
        expect(result).toEqual({
            kind: "unfinalized",
            patch: {
                writes: [
                    { offset: 4, value: fileSize - 8 },
                    { offset: 40, value: fileSize - 44 },
                ],
                dataBytes: fileSize - 44,
                durationMs: 10_335,
            },
        });
    });

    it("drops a torn final sample rather than declaring half a frame", () => {
        const result = assessWavHeader(canonicalHeader({ channels: 2 }), 44 + 4 * 1000 + 3);
        expect(result.kind).toBe("unfinalized");
        if (result.kind !== "unfinalized") return;
        expect(result.patch.dataBytes).toBe(4000);
        expect(result.patch.writes[0].value).toBe(44 + 4000 - 8);
    });

    it("rewrites a size that promises more audio than the file holds", () => {
        const result = assessWavHeader(canonicalHeader({ dataSize: 0xffffffff }), 44 + 882);
        expect(result.kind).toBe("unfinalized");
    });

    it("leaves a finalized header alone", () => {
        const header = canonicalHeader({ riffSize: 36 + 88_200, dataSize: 88_200 });
        expect(assessWavHeader(header, 44 + 88_200)).toEqual({ kind: "finalized" });
    });

    it("keeps an honest data size with a trailing chunk after it", () => {
        const header = canonicalHeader({ riffSize: 36 + 88_200 + 40, dataSize: 88_200 });
        expect(assessWavHeader(header, 44 + 88_200 + 40)).toEqual({ kind: "finalized" });
    });

    it("calls a header with no audio after it empty", () => {
        expect(assessWavHeader(canonicalHeader(), 44)).toEqual({ kind: "empty" });
        expect(assessWavHeader(canonicalHeader(), 45)).toEqual({ kind: "empty" });
    });

    it("walks past a LIST chunk before data", () => {
        const base = canonicalHeader();
        const list = new Uint8Array(8 + 5 + 1); // odd size → one pad byte
        list.set([0x4c, 0x49, 0x53, 0x54], 0);
        new DataView(list.buffer).setUint32(4, 5, true);
        const header = new Uint8Array(base.length + list.length);
        header.set(base.subarray(0, 36), 0);
        header.set(list, 36);
        header.set(base.subarray(36), 36 + list.length);
        const fileSize = header.length + 2000;
        const result = assessWavHeader(header, fileSize);
        expect(result.kind).toBe("unfinalized");
        if (result.kind !== "unfinalized") return;
        expect(result.patch.writes[1]).toEqual({ offset: 36 + list.length + 4, value: 2000 });
    });

    it("refuses anything that isn't RIFF/WAVE", () => {
        const m4a = new Uint8Array([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
        expect(assessWavHeader(m4a, 10_953)).toEqual({ kind: "notWav" });
        expect(assessWavHeader(new Uint8Array(4), 4)).toEqual({ kind: "notWav" });
    });
});
