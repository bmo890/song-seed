import {
    buildImportedTitle,
    importAudioAssets,
    pickAudioFiles,
} from "./audioStorage";
import { createClipImportBatcher } from "./clipImportBatcher";
import { checkImportDuplicates, getAllClips } from "./importDuplicates";
import { buildImportedAssetDateMetadata } from "../importDates";
import { useImportStore } from "../state/useImportStore";
import { useStore } from "../state/useStore";
import { ensureUniqueCountedTitle } from "../utils";

/** Collection the welcome-flow import lands in (found by title, created if missing —
 *  so replaying the intro and importing again reuses the same collection). */
export const WELCOME_IMPORT_COLLECTION_TITLE = "Imported";

export type WelcomeImportProgress =
    | { phase: "importing"; current: number; total: number }
    | { phase: "done"; imported: number; failed: number; skippedDuplicates: number }
    | { phase: "error" };

export type WelcomeImportResult = {
    /** null = user cancelled the picker (nothing to report). */
    outcome: "imported" | "cancelled" | "error";
    imported: number;
    failed: number;
    skippedDuplicates: number;
};

/**
 * The welcome wizard's "bring your recordings" import. Reuses the REAL import
 * pipeline (OS picker → managed-storage copy with lightweight native duration
 * probe → chunked store commits → background waveform hydration), but with the
 * onboarding-appropriate defaults instead of the collection screen's prompts:
 *
 *  - Destination: an "Imported" collection in the active workspace, created on
 *    demand. Keeps a big memo library out of the starter "Ideas" inbox and makes
 *    the done-state copy concrete ("find them in Imported").
 *  - Dates: source file dates when the files carry them (a voice-memo library
 *    keeps its real chronology), per-asset fallback to the import date — the
 *    same behavior the in-app prompt's "source" choice gives.
 *  - Duplicates: exact matches against existing clips are silently skipped (a
 *    fresh library has none; a replayed intro shouldn't double-import) and the
 *    skip is reported in the result instead of via a review dialog — AppAlert
 *    dialogs can't be trusted to stack above the welcome gate.
 *
 * The import runs detached: if the caller unmounts (user taps Start mid-import),
 * the copy loop, store commits, and hydration enqueue all complete on their own,
 * and the shared import-store job keeps the global progress pill accurate.
 */
export async function runWelcomeImport(
    onProgress: (progress: WelcomeImportProgress) => void
): Promise<WelcomeImportResult> {
    const assets = await pickAudioFiles({ multiple: true });
    if (assets.length === 0) {
        return { outcome: "cancelled", imported: 0, failed: 0, skippedDuplicates: 0 };
    }

    const state = useStore.getState();
    const workspace =
        state.workspaces.find((candidate) => candidate.id === state.activeWorkspaceId) ??
        state.workspaces[0];
    if (!workspace) {
        // Unreachable in practice (sanitize always leaves a starter workspace), but
        // never let onboarding throw.
        onProgress({ phase: "error" });
        return { outcome: "error", imported: 0, failed: 0, skippedDuplicates: 0 };
    }

    const existingCollection = workspace.collections.find(
        (collection) =>
            collection.title.trim().toLowerCase() === WELCOME_IMPORT_COLLECTION_TITLE.toLowerCase()
    );
    const collectionId =
        existingCollection?.id ??
        state.addCollection(workspace.id, WELCOME_IMPORT_COLLECTION_TITLE);

    const duplicateResult = checkImportDuplicates(assets, getAllClips());
    const toImport = duplicateResult.hasDuplicates ? duplicateResult.uniqueAssets : assets;
    const skippedDuplicates = assets.length - toImport.length;
    if (toImport.length === 0) {
        onProgress({ phase: "done", imported: 0, failed: 0, skippedDuplicates });
        return { outcome: "imported", imported: 0, failed: 0, skippedDuplicates };
    }

    // Unique titles against the destination collection's existing ideas (matters on
    // an intro replay; a fresh library contributes none).
    const nextTitles = workspace.ideas
        .filter((idea) => idea.collectionId === collectionId)
        .map((idea) => idea.title);

    const jobId = `welcome-import-${Date.now()}`;
    useImportStore.getState().startJob({
        id: jobId,
        label: toImport.length === 1 ? buildImportedTitle(toImport[0]!.name) : `${toImport.length} recordings`,
        total: toImport.length,
    });
    onProgress({ phase: "importing", current: 0, total: toImport.length });

    const batcher = createClipImportBatcher({ collectionId, workspaceId: workspace.id });
    try {
        const importedAt = Date.now();
        const { imported, failed } = await importAudioAssets(
            toImport,
            (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
            (current, total, failedCount) => {
                useImportStore.getState().updateJob(jobId, { current, failed: failedCount });
                onProgress({ phase: "importing", current, total });
            },
            {
                lightweight: true,
                onImported: (asset) => {
                    const [importedDate] = buildImportedAssetDateMetadata([asset], "source", importedAt);
                    const title = ensureUniqueCountedTitle(buildImportedTitle(asset.name), nextTitles);
                    nextTitles.push(title);
                    batcher.add({
                        title,
                        audioUri: asset.audioUri,
                        durationMs: asset.durationMs,
                        waveformPeaks: asset.waveformPeaks,
                        createdAt: importedDate!.createdAt,
                        importedAt: importedDate!.importedAt,
                        sourceCreatedAt: importedDate!.sourceCreatedAt,
                    });
                },
            }
        );
        batcher.flush();

        useImportStore.getState().updateJob(jobId, {
            current: imported.length,
            failed: failed.length,
            status: failed.length > 0 && imported.length === 0 ? "error" : "done",
        });
        onProgress({
            phase: "done",
            imported: imported.length,
            failed: failed.length,
            skippedDuplicates,
        });
        return {
            outcome: "imported",
            imported: imported.length,
            failed: failed.length,
            skippedDuplicates,
        };
    } catch (error) {
        batcher.flush();
        console.warn("Welcome import error", error);
        useImportStore.getState().updateJob(jobId, { status: "error" });
        onProgress({ phase: "error" });
        return { outcome: "error", imported: 0, failed: 0, skippedDuplicates };
    } finally {
        setTimeout(() => useImportStore.getState().removeJob(jobId), 2500);
    }
}
