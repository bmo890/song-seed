import { InteractionManager } from "react-native";
import { loadManagedAudioMetadata } from "./audioStorage";
import { ensureWaveformSidecar } from "./waveformSidecar";
import { isForegroundAudioBusy, waitForForegroundAudioIdle } from "./audioForegroundActivity";
import { appActions } from "../state/actions";
import { useStore } from "../state/useStore";
import type { Workspace } from "../types";

type HydrationJob = {
    workspaceId: string;
    ideaId: string;
    clipId: string;
    audioUri: string;
    /** Bounded retry count for genuine failures (probe timeout, decode error). Waiting
     *  out foreground playback is NOT a failure and never consumes an attempt. */
    attempt?: number;
};

const queuedClipIds = new Set<string>();
const queue: HydrationJob[] = [];
/** Clips that exhausted their attempts this session — the launch backfill skips them
 *  so one undecodable file can't cause a probe loop; next launch retries fresh. */
const exhaustedClipIds = new Set<string>();
let isProcessing = false;
let scheduledProcess: ReturnType<typeof setTimeout> | null = null;
const HYDRATION_START_DELAY_MS = 1500;
/** How long to stand down when playback outlasted the idle wait — try again later
 *  rather than polling through an entire listening session. */
const BUSY_BACKOFF_MS = 15000;

/** Genuine failures (not busy-waits) retry this many times before giving up until
 *  the next app launch (enqueueMissingDurationBackfill re-enqueues then). */
const MAX_HYDRATION_ATTEMPTS = 3;

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

type JobOutcome =
    /** Clip fully hydrated (or no longer relevant) — release its claim. */
    | "done"
    /** Genuine failure — retry, consuming one bounded attempt. */
    | "retry"
    /** Playback outlasted the idle wait — stand the whole queue down and try later
     *  (no attempt consumed; waiting out music is not a failure). */
    | "busy";

async function hydrateJob(job: HydrationJob): Promise<JobOutcome> {
    // Never decode/probe while the player is loading or playing — on Android that
    // native work fights the foreground player for the codec and audio focus and
    // freezes playback. The wait caps out (45s) during continuous playback; in that
    // case REPORT busy rather than plowing into a mid-playback probe.
    await waitForForegroundAudioIdle();
    if (isForegroundAudioBusy()) return "busy";
    await waitForIdleInteractions();

    const { clip } = findClip(job);
    if (!clip?.audioUri || clip.audioUri !== job.audioUri) {
        return "done";
    }

    const metadata = await loadManagedAudioMetadata(
        job.audioUri,
        `${job.ideaId}-${job.clipId}`,
        // Skip the duration re-probe when the clip already knows it (a full
        // AVPlayer item load per clip, twice per import, added up fast).
        clip.durationMs && clip.durationMs > 0 ? clip.durationMs : undefined
    );

    const knownDurationMs =
        metadata.durationMs && metadata.durationMs > 0
            ? metadata.durationMs
            : clip.durationMs && clip.durationMs > 0
                ? clip.durationMs
                : undefined;

    // Only write back when the clip still exists and still points at the same audio file.
    const latest = findClip(job).clip;
    if (!latest?.audioUri || latest.audioUri !== job.audioUri) {
        return "done";
    }

    // Persist rules: REAL analysis (usedDetailedAnalysis) may overwrite anything; a
    // deterministic placeholder must never replace peaks the clip already has — a
    // skipped/preempted decode would otherwise become the clip's waveform forever
    // (the duration check below can't catch it, and no other path repairs peaks).
    if (metadata.usedDetailedAnalysis && knownDurationMs) {
        appActions.hydrateClipAudioMetadata(job.workspaceId, job.ideaId, job.clipId, {
            durationMs: knownDurationMs,
            waveformPeaks: metadata.waveformPeaks,
        });

        // Pre-build the high-res detail sidecar so the first editor/player open is
        // instant rather than decoding on demand. Best-effort; the reel regenerates
        // it lazily if this is skipped or fails. Re-check idle first: the metadata
        // step above can take seconds, and the user may have started playback since.
        try {
            await waitForForegroundAudioIdle();
            if (!isForegroundAudioBusy()) {
                await ensureWaveformSidecar(job.audioUri, knownDurationMs);
            }
        } catch (error) {
            console.warn("Background sidecar pre-build failed", error);
        }
        return "done";
    }

    // Landed the duration but not real peaks (probe fine, decode skipped/failed):
    // bank the duration — the card stops reading 0:00 — and retry for the peaks.
    if (knownDurationMs && (!clip.durationMs || clip.durationMs <= 0)) {
        appActions.hydrateClipAudioMetadata(job.workspaceId, job.ideaId, job.clipId, {
            durationMs: knownDurationMs,
        });
    }
    return "retry";
}

async function processQueue() {
    if (isProcessing) return;
    if (scheduledProcess) {
        clearTimeout(scheduledProcess);
        scheduledProcess = null;
    }
    isProcessing = true;

    let first = true;
    while (queue.length > 0) {
        if (!first) {
            await new Promise((resolve) => setTimeout(resolve, INTER_JOB_YIELD_MS));
        }
        first = false;

        const job = queue.shift()!;
        let outcome: JobOutcome;
        try {
            outcome = await hydrateJob(job);
        } catch (error) {
            console.warn("Background waveform hydration failed", error);
            outcome = "retry";
        }

        if (outcome === "done") {
            queuedClipIds.delete(job.clipId);
            continue;
        }

        if (outcome === "busy") {
            // Playback is going to keep winning — put the job back (front, claim held)
            // and stand the whole queue down for a while instead of burning attempts
            // or polling through the user's listening session.
            queue.unshift(job);
            break;
        }

        const attempt = (job.attempt ?? 0) + 1;
        if (attempt >= MAX_HYDRATION_ATTEMPTS) {
            // Give up until next launch. Restore the old best-effort baseline for
            // clips with NO peaks at all (archive restores) so their cards at least
            // show an envelope; never touch peaks that already exist.
            exhaustedClipIds.add(job.clipId);
            queuedClipIds.delete(job.clipId);
            const { clip } = findClip(job);
            if (clip && clip.audioUri === job.audioUri && !(clip.waveformPeaks?.length)) {
                try {
                    const metadata = await loadManagedAudioMetadata(
                        job.audioUri,
                        `${job.ideaId}-${job.clipId}`,
                        clip.durationMs && clip.durationMs > 0 ? clip.durationMs : undefined,
                        { lightweight: true }
                    );
                    appActions.hydrateClipAudioMetadata(job.workspaceId, job.ideaId, job.clipId, {
                        durationMs: clip.durationMs,
                        waveformPeaks: metadata.waveformPeaks,
                    });
                } catch {
                    // Best-effort only.
                }
            }
            continue;
        }
        // Push to the back — later jobs run first, giving the transient condition
        // (slow file, busy device) time to clear. Claim stays held.
        queue.push({ ...job, attempt });
    }

    isProcessing = false;
    if (queue.length > 0) {
        // We broke out busy — try again after the backoff.
        scheduleProcessQueue(BUSY_BACKOFF_MS);
    }
}

function scheduleProcessQueue(delayMs = HYDRATION_START_DELAY_MS) {
    if (scheduledProcess) {
        clearTimeout(scheduledProcess);
    }

    // Wait until the import burst settles before starting detailed waveform work.
    scheduledProcess = setTimeout(() => {
        scheduledProcess = null;
        void processQueue();
    }, delayMs);
}

export function enqueueBackgroundWaveformHydration(job: HydrationJob) {
    if (queuedClipIds.has(job.clipId)) {
        return;
    }

    queuedClipIds.add(job.clipId);
    queue.push(job);
    scheduleProcessQueue();
}

/**
 * Backfill scan: enqueue hydration for every clip that has audio but no known
 * duration. The import-time queue is in-memory and single-shot — an app restart,
 * a timed-out probe past its retries, or an archive restore (which never enqueues)
 * would otherwise leave clips stuck at "0:00" until they're played. Called after
 * store hydration on every launch and after archive imports; already-queued,
 * already-hydrated, and this-session-exhausted clips are skipped, so repeat calls
 * are cheap.
 */
export function enqueueMissingDurationBackfill(workspaces: Workspace[]): number {
    let enqueued = 0;
    for (const workspace of workspaces) {
        for (const idea of workspace.ideas) {
            for (const clip of idea.clips) {
                if (!clip.audioUri) continue;
                if (clip.durationMs && clip.durationMs > 0) continue;
                if (queuedClipIds.has(clip.id) || exhaustedClipIds.has(clip.id)) continue;
                enqueueBackgroundWaveformHydration({
                    workspaceId: workspace.id,
                    ideaId: idea.id,
                    clipId: clip.id,
                    audioUri: clip.audioUri,
                });
                enqueued += 1;
            }
        }
    }
    return enqueued;
}
