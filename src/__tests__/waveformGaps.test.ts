import { fillWaveformBinGaps, WAVEFORM_EMPTY_BIN_MAX } from "../domain/waveformGaps";

const EMPTY = 0.004;

/** A decoder comb: a real value every `period` bins (fractional periods alternate). */
function comb(values: number[], period: number): number[] {
    const length = Math.ceil(values.length * period);
    const peaks = new Array<number>(length).fill(EMPTY);
    values.forEach((value, index) => {
        peaks[Math.floor(index * period)] = value;
    });
    return peaks;
}

describe("fillWaveformBinGaps", () => {
    it("returns a dense wave untouched, by reference", () => {
        const dense = [0.2, 0.4, 0.6, 0.5, 0.3, 0.2, 0.7];
        expect(fillWaveformBinGaps(dense)).toBe(dense);
    });

    it("leaves a dense wave with a stray silent bin alone", () => {
        const dense = [0.2, 0.4, EMPTY, 0.5, 0.3, 0.2, 0.7, 0.6, 0.4];
        expect(fillWaveformBinGaps(dense)).toBe(dense);
    });

    it("fills the holes of a comb with the line between its real bins", () => {
        const repaired = fillWaveformBinGaps(comb([0.2, 0.8, 0.5, 0.5], 3));
        expect(repaired.slice(0, 7)).toEqual([0.2, expect.closeTo(0.4), expect.closeTo(0.6), 0.8, expect.closeTo(0.7), expect.closeTo(0.6), 0.5]);
        expect(repaired.every((value) => value > WAVEFORM_EMPTY_BIN_MAX)).toBe(true);
    });

    it("handles the measured iOS comb (a real bin every 5.8) without leaving stubs", () => {
        const values = Array.from({ length: 300 }, (_, index) => 0.3 + 0.4 * Math.abs(Math.sin(index / 7)));
        const repaired = fillWaveformBinGaps(comb(values, 5.8));
        expect(repaired.filter((value) => value <= WAVEFORM_EMPTY_BIN_MAX)).toHaveLength(0);
    });

    it("keeps real silence silent, filling only what the last buffer covered", () => {
        const peaks = [...comb([0.5, 0.6, 0.7], 4), ...new Array<number>(20).fill(EMPTY), ...comb([0.4, 0.5], 4)];
        const repaired = fillWaveformBinGaps(peaks);
        // The buffer at bin 8 covers bins 9-11; the 20 bins of silence after it stay empty.
        expect(repaired.slice(9, 12)).toEqual([0.7, 0.7, 0.7]);
        expect(repaired.slice(12, 32).every((value) => value <= WAVEFORM_EMPTY_BIN_MAX)).toBe(true);
        expect(repaired[32]).toBe(0.4);
    });

    it("is a no-op the second time", () => {
        const once = fillWaveformBinGaps(comb([0.2, 0.8, 0.5, 0.9, 0.3], 6));
        expect(fillWaveformBinGaps(once)).toBe(once);
    });

    it("reads a sidecar's 8-bit floor as empty too", () => {
        const fromSidecar = comb([0.3, 0.6, 0.4], 5).map((value) => Math.round(value * 255) / 255);
        expect(fillWaveformBinGaps(fromSidecar).filter((value) => value <= WAVEFORM_EMPTY_BIN_MAX)).toHaveLength(0);
    });

    it("leaves silence and near-empty input alone", () => {
        const silent = new Array<number>(50).fill(EMPTY);
        expect(fillWaveformBinGaps(silent)).toBe(silent);
        const one = [EMPTY, EMPTY, 0.5, EMPTY, EMPTY];
        expect(fillWaveformBinGaps(one)).toBe(one);
        expect(fillWaveformBinGaps([])).toEqual([]);
    });
});
