import { loadManagedAudioMetadata } from "./audioStorage";
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
            const { clip } = findClip(job);
            if (!clip?.audioUri || clip.audioUri !== job.audioUri) {
                continue;
            }

            const metadata = await loadManagedAudioMetadata(
                job.audioUri,
                `${job.ideaId}-${job.clipId}`
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
        } catch (error) {
            console.warn("Background waveform hydration failed", error);
        } finally {
            queuedClipIds.delete(job.clipId);
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
