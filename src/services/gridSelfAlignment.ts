import { useStore } from "../state/useStore";
import { ensureWaveformSidecar } from "./waveformSidecar";
import {
    alignGridToRecordedClicks,
    type ClickSignal,
} from "../domain/clickGridAlignment";
import type { OnsetEnvelope } from "../domain/onsetEnvelope";
import type { RecordingGrid } from "../types";

/**
 * After a take with the click running saves, align its grid to the clicks the mic
 * actually recorded (see domain/clickGridAlignment for why the schedule isn't enough).
 *
 * There are two possible signals, and they are not equal:
 *
 *  - The ONSET ENVELOPE captured while recording (1ms, high-passed). Preferred always. It
 *    needs no decode, so nothing can preempt it, and a click is actually visible in it.
 *  - The waveform SIDECAR, for takes that have no envelope. Measurement says this usually
 *    cannot see a click under real playing at all — contrast 1.07 where a sample-level
 *    measurement of the same audio read 30.3 (docs/qa/grid-truth.md). Kept because a
 *    take with no envelope has nothing else, and declining honestly beats guessing.
 *
 * Reads the store at completion time, so it survives the recording screen unmounting, and
 * re-finds the clip by id — if the user deleted the take in the meantime, nothing happens.
 */
/** Attempts to get the sidecar, backing off — a preempted background decode returns null
 *  immediately rather than throwing, and the old code took that as "no clicks here". */
const SIDECAR_RETRY_DELAYS_MS = [0, 1_500, 4_000, 10_000, 20_000];

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSidecar(audioUri: string, durationMs: number) {
    for (const delayMs of SIDECAR_RETRY_DELAYS_MS) {
        if (delayMs > 0) await wait(delayMs);
        const bins = await ensureWaveformSidecar(audioUri, durationMs);
        if (bins && bins.length) return bins;
    }
    return null;
}

export async function selfAlignClipGrid(args: {
    ideaId: string;
    clipId: string;
    audioUri: string;
    durationMs: number;
    grid: RecordingGrid;
    /** Captured during the take. When present, nothing else is consulted. */
    onsetEnvelope?: OnsetEnvelope | null;
}): Promise<void> {
    const { ideaId, clipId, audioUri, durationMs, grid, onsetEnvelope } = args;
    if (!grid.clickThroughTake) return;

    try {
        let signal: ClickSignal | null = null;
        if (onsetEnvelope && onsetEnvelope.bins.length > 0) {
            signal = {
                kind: "onset",
                bins: onsetEnvelope.bins,
                binMs: onsetEnvelope.binMs,
            };
        } else {
            const bins = await waitForSidecar(audioUri, durationMs);
            if (bins && bins.length) {
                signal = { kind: "sidecar", bins };
            }
        }

        if (!signal) {
            // Loud, because this is the path where a take silently keeps an uncorrected
            // grid: the sidecar decode is background work, so opening the player and
            // pressing play right after saving — the natural thing to do — preempts it.
            console.warn(
                "[timing] click self-align: SKIPPED — no onset envelope and no waveform " +
                    "sidecar after retries; this take keeps its scheduled-click grid"
            );
            return;
        }

        const result = alignGridToRecordedClicks({ grid, signal, durationMs });
        if (result.kind === "unchanged") {
            console.log(
                `[timing] click self-align: unchanged (${result.reason}) ` +
                    `[${signal.kind} signal]`
            );
            return;
        }

        const provenance =
            `${result.signalKind} signal, contrast ${result.contrast.toFixed(2)}, ` +
            `resolution ${result.msPerBin.toFixed(1)}ms/bin`;
        console.log(
            result.kind === "corrected"
                ? `[timing] click self-align: grid shifted ${Math.round(result.correctionMs)}ms ` +
                      `onto the recorded clicks (${provenance})`
                : `[timing] click self-align: null downbeat stamped at ` +
                      `${Math.round(result.grid.firstDownbeatMs ?? 0)}ms from the recorded clicks ` +
                      `(${provenance})`
        );

        useStore.getState().updateIdeas(
            (ideas) =>
                ideas.map((idea) => {
                    if (idea.id !== ideaId) return idea;
                    return {
                        ...idea,
                        clips: idea.clips.map((clip) =>
                            clip.id === clipId ? { ...clip, recordingGrid: result.grid } : clip
                        ),
                    };
                }),
            { preserveActivity: true }
        );
    } catch (error) {
        console.warn("[timing] click self-align failed", error);
    }
}
