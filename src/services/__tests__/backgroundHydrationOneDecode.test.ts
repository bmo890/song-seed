// 2026-10-03: a clip's card waveform used to wait on (a) a second full decode per
// clip and (b) a 48-clip write buffer — so after an import, cards stayed on the
// placeholder for minutes while their peaks sat in memory. Now one decode (the
// detail sidecar) serves the card too, writes land within seconds, and the rows on
// screen jump the queue.

const mockHydrateClips = jest.fn();
const mockLoadManagedAudioMetadata = jest.fn();
const mockEnsureWaveformSidecar = jest.fn();

const DETAIL = Array.from({ length: 2048 }, (_, i) => (i % 8 === 3 ? 0.9 : 0.1));

function clip(id: string) {
    return {
        id,
        title: id,
        notes: "",
        createdAt: 1,
        isPrimary: true,
        audioUri: `file:///${id}.m4a`,
        durationMs: 1000,
        waveformPeaks: Array.from({ length: 128 }, () => 0.5),
    };
}
const mockWorkspaces = [
    {
        id: "ws-1",
        title: "ws",
        collections: [],
        ideas: [
            { id: "idea-1", title: "a", clips: [clip("c-1")] },
            { id: "idea-2", title: "b", clips: [clip("c-2")] },
            { id: "idea-3", title: "c", clips: [clip("c-3")] },
        ],
    },
];

jest.mock("react-native", () => ({
    InteractionManager: {
        runAfterInteractions: (cb: () => void) => {
            cb();
            return { cancel() {} };
        },
    },
}));
jest.mock("../audioStorage", () => ({
    __esModule: true,
    MANAGED_WAVEFORM_PEAK_COUNT: 256,
    IMPORT_PLACEHOLDER_WAVEFORM_PEAK_COUNT: 128,
    MAX_DETAILED_AUDIO_ANALYSIS_DURATION_MS: 30 * 60 * 1000,
    loadManagedAudioMetadata: (...args: unknown[]) => mockLoadManagedAudioMetadata(...args),
}));
jest.mock("../waveformSidecar", () => ({
    ensureWaveformSidecar: (...args: unknown[]) => mockEnsureWaveformSidecar(...args),
}));
jest.mock("../../utils", () => ({
    buildStaticWaveform: (_seed: string, count: number) => Array.from({ length: count }, () => 0.4),
}));
jest.mock("../waveformAnalysis", () => ({
    getWaveformCancelEpoch: () => 1,
    cancelActiveWaveformDecode: () => {},
}));
jest.mock("../audioForegroundActivity", () => ({
    isForegroundAudioBusy: () => false,
    waitForForegroundAudioIdle: () => Promise.resolve(),
    isRecordingActive: () => false,
    onRecordingActivityChange: () => () => {},
}));
jest.mock("../../state/actions", () => ({
    appActions: {
        hydrateClipAudioMetadata: jest.fn(),
        hydrateClipsAudioMetadata: (...args: unknown[]) => mockHydrateClips(...args),
    },
}));
jest.mock("../../state/useStore", () => ({
    useStore: { getState: () => ({ workspaces: mockWorkspaces }) },
}));

import {
    enqueueBackgroundWaveformHydration,
    prioritizeBackgroundWaveformHydration,
} from "../backgroundWaveformHydration";

const job = (n: number) => ({
    workspaceId: "ws-1",
    ideaId: `idea-${n}`,
    clipId: `c-${n}`,
    audioUri: `file:///c-${n}.m4a`,
});

describe("background hydration — one decode, prompt writes, visible first", () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });
    afterAll(() => {
        jest.useRealTimers();
    });
    beforeEach(() => {
        mockHydrateClips.mockClear();
        mockLoadManagedAudioMetadata.mockClear();
        mockEnsureWaveformSidecar.mockReset();
        mockEnsureWaveformSidecar.mockResolvedValue(DETAIL);
    });

    it("derives the card's 256 peaks from the one sidecar decode and writes within seconds", async () => {
        enqueueBackgroundWaveformHydration(job(1));
        // Start delay, then the job's own zero-delay idle gates.
        await jest.advanceTimersByTimeAsync(1500);
        await jest.advanceTimersByTimeAsync(100);

        expect(mockEnsureWaveformSidecar).toHaveBeenCalledWith("file:///c-1.m4a", 1000, { mode: "background" });
        expect(mockLoadManagedAudioMetadata).not.toHaveBeenCalled();

        // The queue drained, so the write is flushed at once.
        expect(mockHydrateClips).toHaveBeenCalledTimes(1);
        const [entries] = mockHydrateClips.mock.calls[0] as [Array<{ clipId: string; waveformPeaks?: number[] }>];
        expect(entries).toHaveLength(1);
        expect(entries[0].clipId).toBe("c-1");
        expect(entries[0].waveformPeaks).toHaveLength(256);
        // Max per window of 8: every window holds one 0.9.
        expect(entries[0].waveformPeaks!.every((peak) => peak === 0.9)).toBe(true);
    });

    it("the rows on screen jump the queue", async () => {
        enqueueBackgroundWaveformHydration(job(1));
        enqueueBackgroundWaveformHydration(job(2));
        enqueueBackgroundWaveformHydration(job(3));
        prioritizeBackgroundWaveformHydration(["idea-3", "idea-2"]);

        await jest.advanceTimersByTimeAsync(1500 + 3 * 250 + 100);

        const order = mockEnsureWaveformSidecar.mock.calls.map((call) => call[0]);
        expect(order).toEqual(["file:///c-3.m4a", "file:///c-2.m4a", "file:///c-1.m4a"]);
    });
});
