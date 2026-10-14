import { formatEta, sendEtaSeconds, sendOverallFraction } from "../sendProgress";

describe("sendOverallFraction", () => {
    it("gives packing its share, then the upload the rest", () => {
        expect(sendOverallFraction({ phase: "packing", completedBytes: 50, totalBytes: 100 }, true)).toBeCloseTo(0.15);
        expect(sendOverallFraction({ phase: "uploading", completedBytes: 0, totalBytes: 100 }, true)).toBeCloseTo(0.3);
        expect(sendOverallFraction({ phase: "uploading", completedBytes: 50, totalBytes: 100 }, true)).toBeCloseTo(0.65);
    });
    it("makes the upload the whole bar for a parcel with nothing to pack", () => {
        expect(sendOverallFraction({ phase: "uploading", completedBytes: 25, totalBytes: 100 }, false)).toBeCloseTo(0.25);
    });
    it("never reads 100 before the link exists", () => {
        expect(sendOverallFraction({ phase: "sealing", completedBytes: 0, totalBytes: 0 }, true)).toBeLessThan(1);
        expect(sendOverallFraction({ phase: "uploading", completedBytes: 100, totalBytes: 100 }, true)).toBe(1);
    });
    it("treats an unknown total as nothing done yet", () => {
        expect(sendOverallFraction({ phase: "packing", completedBytes: 10, totalBytes: 0 }, true)).toBe(0);
    });
});

describe("sendEtaSeconds", () => {
    const start = 1_000_000;
    it("estimates from the upload rate", () => {
        // 20 MB in 10 s, 40 MB to go → 20 s.
        expect(
            sendEtaSeconds({ phase: "uploading", completedBytes: 20, totalBytes: 60 }, start, start + 10_000)
        ).toBe(20);
    });
    it("has no number while packing, sealing, or before the first second", () => {
        expect(sendEtaSeconds({ phase: "packing", completedBytes: 5, totalBytes: 10 }, start, start + 5000)).toBeNull();
        expect(sendEtaSeconds({ phase: "sealing", completedBytes: 0, totalBytes: 0 }, start, start + 5000)).toBeNull();
        expect(sendEtaSeconds({ phase: "uploading", completedBytes: 5, totalBytes: 10 }, start, start + 500)).toBeNull();
        expect(sendEtaSeconds({ phase: "uploading", completedBytes: 5, totalBytes: 10 }, null, start + 5000)).toBeNull();
    });
});

describe("formatEta", () => {
    it("rounds up to minutes past a minute", () => {
        expect(formatEta(45)).toBe("~45s");
        expect(formatEta(61)).toBe("~2 min");
        expect(formatEta(0)).toBe("~1s");
    });
});
