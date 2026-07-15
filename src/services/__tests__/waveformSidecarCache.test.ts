// The sidecar cache is what lets the reel paint the REAL waveform on its first frame.
// Without it every open re-read the file (two async FS hops + a 2048-number parse) on a
// JS thread already busy opening the player, so the reel showed the low-res thumbnail
// stretched to the zoom and then visibly sharpened — the "spread apart then snap".
//
// Correctness here is user-visible in both directions: a miss costs the upgrade flash,
// and a STALE hit would paint the wrong waveform for a re-recorded take.

const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();
const mockWriteAsStringAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
    getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
    readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
    writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
    deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));
jest.mock("../audioStorage", () => ({
    MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS: 600000,
    loadAudioDurationMs: jest.fn(),
}));
jest.mock("../audioForegroundActivity", () => ({ isForegroundAudioBusy: () => false }));
jest.mock("../waveformAnalysis", () => ({ computeWaveformPeaks: jest.fn() }));
jest.mock("../storagePaths", () => ({
    waveformSidecarUri: (uri: string) => `${uri}.waveform`,
}));

import {
    deleteWaveformSidecar,
    peekWaveformSidecar,
    readWaveformSidecar,
    writeWaveformSidecar,
} from "../waveformSidecar";

/** The on-disk shape: 8-bit quantized bins. 128/255 decodes to ~0.502. */
function encoded(bins: number[]) {
    return JSON.stringify({ v: 1, bins });
}

describe("waveform sidecar cache", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetInfoAsync.mockResolvedValue({ exists: true });
        mockReadAsStringAsync.mockResolvedValue(encoded([0, 128, 255]));
    });

    it("reads from disk once, then serves the cache — no second FS round-trip", async () => {
        const first = await readWaveformSidecar("file:///a.m4a");
        expect(first).toHaveLength(3);
        expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);

        const second = await readWaveformSidecar("file:///a.m4a");
        expect(second).toEqual(first);
        expect(mockReadAsStringAsync).toHaveBeenCalledTimes(1);
    });

    it("peek is synchronous after a read — this is what lets the first frame be correct", async () => {
        expect(peekWaveformSidecar("file:///b.m4a")).toBeNull();
        await readWaveformSidecar("file:///b.m4a");
        expect(peekWaveformSidecar("file:///b.m4a")).toHaveLength(3);
    });

    it("a write warms the cache, so a hydration-built sidecar needs no read at all", async () => {
        await writeWaveformSidecar("file:///c.m4a", [0.25, 0.5]);
        expect(peekWaveformSidecar("file:///c.m4a")).toEqual([0.25, 0.5]);
        expect(mockReadAsStringAsync).not.toHaveBeenCalled();
    });

    it("a delete invalidates — a regenerated sidecar must never serve the old shape", async () => {
        await readWaveformSidecar("file:///d.m4a");
        expect(peekWaveformSidecar("file:///d.m4a")).not.toBeNull();
        await deleteWaveformSidecar("file:///d.m4a");
        expect(peekWaveformSidecar("file:///d.m4a")).toBeNull();
    });

    it("a MISSING sidecar is not cached as a hit (it must re-check once generated)", async () => {
        mockGetInfoAsync.mockResolvedValue({ exists: false });
        expect(await readWaveformSidecar("file:///e.m4a")).toBeNull();
        expect(peekWaveformSidecar("file:///e.m4a")).toBeNull();
    });

    it("evicts the oldest entry past the cap, and a touch keeps an entry alive (LRU)", async () => {
        await writeWaveformSidecar("file:///keep.m4a", [0.5]);
        for (let i = 0; i < 23; i += 1) {
            await writeWaveformSidecar(`file:///pad-${i}.m4a`, [0.5]);
        }
        // At the 24-entry cap with "keep" as the oldest — touch it so it isn't next out.
        expect(peekWaveformSidecar("file:///keep.m4a")).not.toBeNull();
        await writeWaveformSidecar("file:///overflow.m4a", [0.5]);

        expect(peekWaveformSidecar("file:///keep.m4a")).not.toBeNull();
        expect(peekWaveformSidecar("file:///pad-0.m4a")).toBeNull();
    });
});
