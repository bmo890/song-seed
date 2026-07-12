// Regression guard for the native-duration-probe fix: once import fills clip.durationMs,
// the launch backfill must NOT skip clips on duration alone — a clip with a real duration
// but only a SUB-resolution placeholder waveform still needs hydration, or an app restart
// mid-import would strand it on the fake waveform forever.
//
// The heavy imports of backgroundWaveformHydration (audioStorage → @siteed, the store, the
// actions) are mocked so the module loads; fake timers swallow the deferred processQueue so
// no real decode runs. enqueueMissingMetadataBackfill itself only reads clip fields and
// returns how many it enqueued, which is what we assert.
jest.mock("../audioStorage", () => ({
    __esModule: true,
    MANAGED_WAVEFORM_PEAK_COUNT: 256,
    loadManagedAudioMetadata: jest.fn(),
}));
jest.mock("../waveformSidecar", () => ({ ensureWaveformSidecar: jest.fn() }));
jest.mock("../audioForegroundActivity", () => ({
    isForegroundAudioBusy: () => false,
    waitForForegroundAudioIdle: () => Promise.resolve(),
}));
jest.mock("../../state/actions", () => ({ appActions: {} }));
jest.mock("../../state/useStore", () => ({
    useStore: { getState: () => ({ workspaces: [] }) },
}));

import { enqueueMissingMetadataBackfill } from "../backgroundWaveformHydration";
import type { Workspace } from "../../types";

function peaks(count: number): number[] {
    return Array.from({ length: count }, () => 0.5);
}

function workspaceWith(
    clips: Array<{
        id: string;
        audioUri?: string;
        durationMs?: number;
        waveformPeaks?: number[];
        detailedWaveformUnavailable?: boolean;
    }>
): Workspace {
    return {
        id: "ws-1",
        title: "ws",
        collections: [],
        ideas: [
            {
                id: "idea-1",
                title: "idea",
                notes: "",
                status: "clip",
                completionPct: 0,
                kind: "clip",
                collectionId: null,
                createdAt: 1,
                lastActivityAt: 1,
                clips: clips.map((c) => ({
                    id: c.id,
                    title: c.id,
                    notes: "",
                    createdAt: 1,
                    isPrimary: true,
                    audioUri: c.audioUri,
                    durationMs: c.durationMs,
                    waveformPeaks: c.waveformPeaks,
                    detailedWaveformUnavailable: c.detailedWaveformUnavailable,
                })),
            },
        ],
    } as unknown as Workspace;
}

describe("enqueueMissingMetadataBackfill — re-enqueues placeholder-waveform clips", () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.clearAllTimers();
    });
    afterAll(() => {
        jest.useRealTimers();
    });

    it("skips fully-hydrated clips but re-enqueues missing-duration OR sub-resolution-waveform clips", () => {
        // Unique clip IDs so the module's in-session dedup set doesn't hide any.
        const enqueued = enqueueMissingMetadataBackfill([
            workspaceWith([
                // fully hydrated: real duration + full-resolution (256) waveform → SKIP
                { id: "c-full", audioUri: "file:///full.m4a", durationMs: 1000, waveformPeaks: peaks(256) },
                // imported pending: real duration but 128-point placeholder → ENQUEUE
                { id: "c-placeholder", audioUri: "file:///ph.m4a", durationMs: 1000, waveformPeaks: peaks(128) },
                // no duration yet (native probe absent / older build) → ENQUEUE
                { id: "c-no-duration", audioUri: "file:///nd.m4a", durationMs: undefined, waveformPeaks: peaks(256) },
                // duration but no waveform at all (archive restore) → ENQUEUE
                { id: "c-no-waveform", audioUri: "file:///nw.m4a", durationMs: 1000, waveformPeaks: undefined },
                // background analysis gave up (past detail cap / undecodable) → SKIP,
                // even though its waveform is only a sub-resolution placeholder.
                {
                    id: "c-gave-up",
                    audioUri: "file:///gu.m4a",
                    durationMs: 1000,
                    waveformPeaks: peaks(128),
                    detailedWaveformUnavailable: true,
                },
                // no audio → never enqueued
                { id: "c-no-audio", audioUri: undefined, durationMs: undefined, waveformPeaks: undefined },
            ]),
        ]);

        expect(enqueued).toBe(3);
    });
});
