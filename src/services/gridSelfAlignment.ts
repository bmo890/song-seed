import { useStore } from "../state/useStore";
import { ensureWaveformSidecar } from "./waveformSidecar";
import { alignGridToRecordedClicks } from "../domain/clickGridAlignment";
import type { RecordingGrid } from "../types";

/**
 * After a take with the click running saves, align its grid to the clicks the mic
 * actually recorded (see domain/clickGridAlignment for why the schedule isn't enough).
 *
 * Runs off the save path: it waits for the detail-waveform sidecar (already being warmed
 * by the save flow) and patches the stored clip when the measurement is confident. Reads
 * the store at completion time, so it survives the recording screen unmounting, and
 * re-finds the clip by id — if the user deleted the take in the meantime, nothing happens.
 */
export async function selfAlignClipGrid(args: {
    ideaId: string;
    clipId: string;
    audioUri: string;
    durationMs: number;
    grid: RecordingGrid;
}): Promise<void> {
    const { ideaId, clipId, audioUri, durationMs, grid } = args;
    if (!grid.clickThroughTake) return;

    try {
        const bins = await ensureWaveformSidecar(audioUri, durationMs);
        if (!bins || !bins.length) return;

        const result = alignGridToRecordedClicks({ grid, bins, durationMs });
        if (result.kind === "unchanged") {
            console.log(`[timing] click self-align: unchanged (${result.reason})`);
            return;
        }

        console.log(
            result.kind === "corrected"
                ? `[timing] click self-align: grid shifted ${Math.round(result.correctionMs)}ms ` +
                      `onto the recorded clicks (contrast ${result.contrast.toFixed(2)})`
                : `[timing] click self-align: null downbeat stamped at ` +
                      `${Math.round(result.grid.firstDownbeatMs ?? 0)}ms from the recorded clicks ` +
                      `(contrast ${result.contrast.toFixed(2)})`
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
