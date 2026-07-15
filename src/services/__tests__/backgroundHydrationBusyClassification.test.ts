// Regression guard for the "waveforms never load in the background" bug: a decode
// preempted by playback (skipped at the idle gate, or cancelled mid-flight by a play
// press) returns the same placeholder as a genuine decode failure. hydrateJob used to
// classify BOTH as "retry", so three play presses during a big import burned a clip's
// bounded attempts and stamped detailedWaveformUnavailable PERMANENTLY — background
// hydration then never touched the clip again, and its waveform only ever appeared via
// the player-open decode. The fix classifies playback interference as "busy" (stand
// down, no attempt consumed): no matter how many cycles playback wins, the clip must
// never be marked unavailable.
//
// The queue is driven with fake timers (start delay, busy backoff); playback busyness
// alternates so each cycle passes the job's pre-check but looks busy at classification —
// exactly the mid-job play press that used to burn an attempt.

const mockHydrateClip = jest.fn();
const mockHydrateClips = jest.fn();

const CLIP_ID = "c-1";
const AUDIO_URI = "file:///c1.m4a";
// Built inside a function so jest.mock hoisting can never see a half-initialized
// literal (a top-level `const clip` referenced from `workspaces` arrived as null).
function buildWorkspaces() {
    return [
        {
            id: "ws-1",
            title: "ws",
            collections: [],
            ideas: [
                {
                    id: "idea-1",
                    title: "idea",
                    clips: [
                        {
                            id: CLIP_ID,
                            title: CLIP_ID,
                            notes: "",
                            createdAt: 1,
                            isPrimary: true,
                            audioUri: AUDIO_URI,
                            durationMs: 1000,
                            waveformPeaks: Array.from({ length: 128 }, () => 0.5),
                        },
                    ],
                },
            ],
        },
    ];
}
const mockWorkspaces = buildWorkspaces();

// Alternates idle/busy: the job's pre-check (1st call per cycle) sees idle so the job
// runs; the post-decode classification (2nd call) sees busy — playback started mid-job.
let mockBusyCallCount = 0;

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
    // Placeholder result — indistinguishable from a genuine decode failure.
    loadManagedAudioMetadata: jest.fn().mockResolvedValue({
        durationMs: 1000,
        waveformPeaks: Array.from({ length: 256 }, () => 0.5),
        usedDetailedAnalysis: false,
    }),
}));
jest.mock("../waveformSidecar", () => ({ ensureWaveformSidecar: jest.fn() }));
jest.mock("../../utils", () => ({
    buildStaticWaveform: (_seed: string, count: number) => Array.from({ length: count }, () => 0.4),
}));
jest.mock("../waveformAnalysis", () => ({
    getWaveformCancelEpoch: () => 1,
}));
jest.mock("../audioForegroundActivity", () => ({
    isForegroundAudioBusy: () => mockBusyCallCount++ % 2 === 1,
    waitForForegroundAudioIdle: () => Promise.resolve(),
}));
jest.mock("../../state/actions", () => ({
    appActions: {
        hydrateClipAudioMetadata: (...args: unknown[]) => mockHydrateClip(...args),
        hydrateClipsAudioMetadata: (...args: unknown[]) => mockHydrateClips(...args),
    },
}));
jest.mock("../../state/useStore", () => ({
    useStore: { getState: () => ({ workspaces: mockWorkspaces }) },
}));

import { enqueueBackgroundWaveformHydration } from "../backgroundWaveformHydration";

describe("background hydration — playback interference never exhausts a clip", () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });
    afterAll(() => {
        jest.useRealTimers();
    });

    it("stands down (busy) instead of consuming attempts, so detailedWaveformUnavailable is never stamped", async () => {
        enqueueBackgroundWaveformHydration({
            workspaceId: "ws-1",
            ideaId: "idea-1",
            clipId: CLIP_ID,
            audioUri: AUDIO_URI,
        });

        // Start delay (1.5s), then well past MAX_HYDRATION_ATTEMPTS busy-backoff
        // cycles (15s each). Under the old accounting the third cycle stamped the
        // clip; under busy classification it retries forever without giving up.
        await jest.advanceTimersByTimeAsync(1500);
        for (let cycle = 0; cycle < 6; cycle += 1) {
            await jest.advanceTimersByTimeAsync(15000 + 250);
        }

        expect(mockHydrateClip).not.toHaveBeenCalled();
        const stampedUnavailable = mockHydrateClips.mock.calls.some((call) =>
            (call[0] as Array<{ detailedWaveformUnavailable?: boolean }>).some(
                (entry) => entry.detailedWaveformUnavailable
            )
        );
        expect(stampedUnavailable).toBe(false);
    });
});
