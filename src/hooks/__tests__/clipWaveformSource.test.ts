// The low-res flash lives or dies on what the reel knows on its FIRST rendered frame.
// This bug has been introduced TWICE by computing "is detail coming?" in an effect —
// effects run after paint, so frame one claimed nothing was coming, the reel painted
// the stretched low-res stand-in, and the guard meant to prevent that never fired.
// resolveClipWaveformSource is pure precisely so that contract is pinned here.

// The function under test is pure, but it ships alongside the hook — whose imports
// reach the native audio module. Mocked so the pure contract is testable on its own.
jest.mock("react-native", () => ({
    InteractionManager: { runAfterInteractions: () => ({ cancel() {} }) },
}));
jest.mock("../../services/waveformAnalysis", () => ({ cancelActiveWaveformDecode: jest.fn() }));
jest.mock("../../services/waveformSidecar", () => ({
    generateWaveformSidecar: jest.fn(),
    peekWaveformSidecar: jest.fn(),
    readWaveformSidecar: jest.fn(),
}));

import { resolveClipWaveformSource } from "../useClipWaveform";

const DETAIL = Array.from({ length: 2048 }, () => 0.5);
const THUMBNAIL = Array.from({ length: 256 }, () => 0.5);
const URI = "file:///a.m4a";

describe("resolveClipWaveformSource", () => {
    it("a CACHED sidecar is served immediately — full res on frame one, nothing outstanding", () => {
        const source = resolveClipWaveformSource({
            audioUri: URI,
            enabled: true,
            cachedPeaks: DETAIL,
            thumbnailPeaks: THUMBNAIL,
        });
        expect(source.isDetail).toBe(true);
        expect(source.peaks).toHaveLength(2048);
        expect(source.isResolvingDetail).toBe(false);
    });

    it("a COLD clip reports resolving with NO read having happened yet — the flash bug, pinned", () => {
        const source = resolveClipWaveformSource({
            audioUri: URI,
            enabled: true,
            cachedPeaks: null,
            resolvedUri: null,
            thumbnailPeaks: THUMBNAIL,
        });
        // The reel must already know detail is coming, so it can hold back the coarse
        // stand-in instead of painting it and sharpening a beat later.
        expect(source.isResolvingDetail).toBe(true);
        expect(source.isDetail).toBe(false);
        expect(source.peaks).toHaveLength(256); // thumbnail is still supplied as the fallback
    });

    it("a MISSING sidecar (read finished, no hit) stops resolving — coarse wave beats an indefinite placeholder", () => {
        const source = resolveClipWaveformSource({
            audioUri: URI,
            enabled: true,
            cachedPeaks: null,
            resolvedUri: URI,
            thumbnailPeaks: THUMBNAIL,
        });
        expect(source.isResolvingDetail).toBe(false);
        expect(source.isDetail).toBe(false);
        expect(source.peaks).toHaveLength(256);
    });

    it("a landed read promotes to detail and clears resolving", () => {
        const source = resolveClipWaveformSource({
            audioUri: URI,
            enabled: true,
            detail: { uri: URI, peaks: DETAIL },
            resolvedUri: URI,
            thumbnailPeaks: THUMBNAIL,
        });
        expect(source.isDetail).toBe(true);
        expect(source.isResolvingDetail).toBe(false);
    });

    it("a clip switch never serves the PREVIOUS clip's waveform, not even for one frame", () => {
        const source = resolveClipWaveformSource({
            audioUri: "file:///second.m4a",
            enabled: true,
            // State still tagged with clip one — must be ignored, same frame.
            detail: { uri: URI, peaks: DETAIL },
            resolvedUri: URI,
            thumbnailPeaks: THUMBNAIL,
        });
        expect(source.isDetail).toBe(false);
        expect(source.isResolvingDetail).toBe(true);
        expect(source.peaks).toHaveLength(256);
    });

    it("disabled / no uri: never claims to be resolving (nothing is coming)", () => {
        expect(
            resolveClipWaveformSource({ audioUri: URI, enabled: false, cachedPeaks: DETAIL })
                .isResolvingDetail
        ).toBe(false);
        expect(
            resolveClipWaveformSource({ audioUri: null, enabled: true }).isResolvingDetail
        ).toBe(false);
    });
});
