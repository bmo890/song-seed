import { InteractionManager } from "react-native";
import { loadManagedAudioMetadata } from "./audioStorage";
import { ensureWaveformSidecar } from "./waveformSidecar";
import { appActions } from "../state/actions";
import { useStore } from "../state/useStore";

type HydrationJob = {
    workspaceId: string;
    ideaId: string;
    clipId: string;
    audioUri: string;
};

const queuedClipIds = new Set<string>();
const queue: HydrationJob[] = [];
let isProcessing = false;
let scheduledProcess: ReturnType<typeof setTimeout> | null = null;
const HYDRATION_START_DELAY_MS = 1500;

function findClip(job: HydrationJob) {
    const workspace = useStore.getState().workspaces.find((item) => item.id === job.workspaceId);
    const idea = workspace?.ideas.find((item) => item.id === job.ideaId);
    const clip = idea?.clips.find((item) => item.id === job.clipId);
    return { workspace, idea, clip };
}

// Pause between hydration jobs. The queue runs for a LONG time after a large
// import (per clip: duration probe + native waveform decode + sidecar build +
// store write). Back-to-back it owns the JS thread's bridge traffic for minutes
// and every touch in the app feels delayed. Yielding between jobs keeps the app
// responsive; the waveforms still land, just spread out.
const INTER_JOB_YIELD_MS = 250;

/** Wait for any running animations/gestures to finish, so hydration work never
 *  competes with an active interaction (scroll, drag, navigation transition). */
function waitForIdleInteractions(): Promise<void> {
    return new Promise((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
    });
}

async function processQueue() {
    if (isProcessing) return;
    if (scheduledProcess) {
        clearTimeout(scheduledProcess);
        scheduledProcess = null;
    }
    isProcessing = true;

    while (queue.length > 0) {
        const job = queue.shift()!;

        try {
            await waitForIdleInteractions();

            const { clip } = findClip(job);
            if (!clip?.audioUri || clip.audioUri !== job.audioUri) {
                continue;
            }

            const metadata = await loadManagedAudioMetadata(
                job.audioUri,
                `${job.ideaId}-${job.clipId}`,
                // Skip the duration re-probe when the clip already knows it (a full
                // AVPlayer item load per clip, twice per import, added up fast).
                clip.durationMs && clip.durationMs > 0 ? clip.durationMs : undefined
            );

            // Only write back when the clip still exists and still points at the same audio file.
            const latest = findClip(job).clip;
            if (!latest?.audioUri || latest.audioUri !== job.audioUri) {
                continue;
            }

            appActions.hydrateClipAudioMetadata(job.workspaceId, job.ideaId, job.clipId, {
                durationMs: metadata.durationMs,
                waveformPeaks: metadata.waveformPeaks,
            });

            // Pre-build the high-res detail sidecar so the first editor/player open is
            // instant rather than decoding on demand. Best-effort; the reel regenerates
            // it lazily if this is skipped or fails.
            await ensureWaveformSidecar(job.audioUri, metadata.durationMs);
        } catch (error) {
            console.warn("Background waveform hydration failed", error);
        } finally {
            queuedClipIds.delete(job.clipId);
        }

        if (queue.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, INTER_JOB_YIELD_MS));
        }
    }

    isProcessing = false;
}

function scheduleProcessQueue() {
    if (scheduledProcess) {
        clearTimeout(scheduledProcess);
    }

    // Wait until the import burst settles before starting detailed waveform work.
    scheduledProcess = setTimeout(() => {
        scheduledProcess = null;
        void processQueue();
    }, HYDRATION_START_DELAY_MS);
}

export function enqueueBackgroundWaveformHydration(job: HydrationJob) {
    if (queuedClipIds.has(job.clipId)) {
        return;
    }

    queuedClipIds.add(job.clipId);
    queue.push(job);
    scheduleProcessQueue();
}
