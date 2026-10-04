import { deriveThumbnailPeaks } from "../cardWaveform";

describe("deriveThumbnailPeaks", () => {
    it("takes the max of each window, 2048 → 256", () => {
        const detail = Array.from({ length: 2048 }, (_, i) => (i % 8 === 5 ? 0.7 : 0.1));
        const peaks = deriveThumbnailPeaks(detail, 256);
        expect(peaks).toHaveLength(256);
        expect(peaks.every((peak) => peak === 0.7)).toBe(true);
    });

    it("keeps uneven windows contiguous and covers the tail", () => {
        const detail = Array.from({ length: 10 }, (_, i) => i / 10);
        expect(deriveThumbnailPeaks(detail, 4)).toEqual([0.1, 0.4, 0.6, 0.9]);
    });

    it("returns a copy when the detail is already at or below the count", () => {
        const detail = [0.2, 0.5];
        const peaks = deriveThumbnailPeaks(detail, 4);
        expect(peaks).toEqual(detail);
        expect(peaks).not.toBe(detail);
        expect(deriveThumbnailPeaks([], 4)).toEqual([]);
    });
});
