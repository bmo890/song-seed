import { useState } from "react";
import { appActions } from "../../../state/actions";
import { reportUnsupportedImports } from "../../common/importFeedback";
import { pickImportAssets } from "../../common/importSource";
import { buildCollectionMoveDestinations } from "../../../domain/collectionManagement";
import { ensureUniqueCountedTitle } from "../../../utils";
import {
  buildImportedTitle,
  importAudioAssets,
  type ImportedAudioAsset,
} from "../../../services/audioStorage";
import { createClipImportBatcher } from "../../../services/clipImportBatcher";
import { useImportStore } from "../../../state/useImportStore";
import { getAllClips, checkImportDuplicates, showDuplicateReview } from "../../../services/importDuplicates";
import { openCollectionInBrowse } from "../../../navigation";
import {
  buildImportHelperText,
  buildImportedAssetDateMetadata,
  promptForImportDatePreference,
  type ImportDatePreference,
} from "../../../domain/importDates";
import { discardPickedCopies } from "../../../services/pickedCopies";

function buildDefaultCollectionTitle(count: number) {
  return `Collection ${count + 1}`;
}

function buildImportedCollectionTitle(assets: ImportedAudioAsset[], collectionCount: number) {
  if (assets.length === 1) {
    return buildImportedTitle(assets[0]?.name);
  }

  return buildDefaultCollectionTitle(collectionCount);
}

export function useWorkspaceCollectionImportFlow({
  navigation,
  activeWorkspaceId,
  topLevelCollectionCount,
  addCollection,
  deleteCollection,
}: {
  navigation: any;
  activeWorkspaceId: string | null;
  topLevelCollectionCount: number;
  addCollection: (workspaceId: string, title: string, parentCollectionId?: string | null, description?: string) => string;
  deleteCollection: (collectionId: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [importCollectionModalOpen, setImportCollectionModalOpen] = useState(false);
  const [importCollectionAssets, setImportCollectionAssets] = useState<ImportedAudioAsset[]>([]);
  const [importCollectionDatePreference, setImportCollectionDatePreference] =
    useState<ImportDatePreference>("import");
  const [importCollectionDraft, setImportCollectionDraft] = useState("");

  const openAddCollectionFlow = () => {
    setDraftTitle("");
    setModalOpen(true);
  };

  const openCollectionImportFlow = async () => {
    const assets = await pickImportAssets({ multiple: true });
    if (assets.length === 0) return;
    const datePreference = await promptForImportDatePreference(assets, "New collection from import");
    // Cancelled before importing: the picker's copies go, never the originals.
    if (!datePreference) return void discardPickedCopies(assets);

    setImportCollectionAssets(assets);
    setImportCollectionDatePreference(datePreference);
    setImportCollectionDraft("");
    setImportCollectionModalOpen(true);
  };

  /** The name sheet's Cancel: nothing imports, so the picked copies go. */
  const cancelImportCollectionModal = () => {
    void discardPickedCopies(importCollectionAssets);
    resetImportCollectionModal();
  };

  const resetImportCollectionModal = () => {
    setImportCollectionModalOpen(false);
    setImportCollectionAssets([]);
    setImportCollectionDatePreference("import");
    setImportCollectionDraft("");
  };

  const createCollection = () => {
    if (!activeWorkspaceId) return;
    const workspaceIdSnapshot = activeWorkspaceId;
    const title = draftTitle.trim() || buildDefaultCollectionTitle(topLevelCollectionCount);
    const description = draftDescription.trim() || undefined;
    const collectionId = addCollection(workspaceIdSnapshot, title, null, description);
    setModalOpen(false);
    setDraftTitle("");
    setDraftDescription("");
    openCollectionInBrowse(navigation, { collectionId, workspaceId: workspaceIdSnapshot });
  };

  const saveImportedCollection = () => {
    if (!activeWorkspaceId || importCollectionAssets.length === 0) return;

    const assetsSnapshot = importCollectionAssets;
    const datePreferenceSnapshot = importCollectionDatePreference;
    const draftSnapshot = importCollectionDraft;
    const workspaceIdSnapshot = activeWorkspaceId;

    function doImport(assets: ImportedAudioAsset[]) {
      if (assets.length === 0) return;

      const label =
        draftSnapshot.trim() ||
        buildImportedCollectionTitle(assets, topLevelCollectionCount);

      const collectionId = addCollection(workspaceIdSnapshot, label, null);
      resetImportCollectionModal();
      openCollectionInBrowse(navigation, { collectionId, workspaceId: workspaceIdSnapshot });

      const jobId = `import-${Date.now()}`;
      useImportStore.getState().startJob({ id: jobId, label, total: assets.length });
      const nextTitles: string[] = [];

      void (async () => {
        const batcher = createClipImportBatcher({ collectionId, workspaceId: workspaceIdSnapshot });
        try {
          const importedAt = Date.now();
          const { imported, failed } = await importAudioAssets(
            assets,
            (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
            (current, _total, failedCount) => {
              useImportStore.getState().updateJob(jobId, { current, failed: failedCount });
            },
            {
              lightweight: true,
              onImported: (asset) => {
                const [importedDate] = buildImportedAssetDateMetadata(
                  [asset],
                  datePreferenceSnapshot,
                  importedAt
                );
                const clipTitle = ensureUniqueCountedTitle(buildImportedTitle(asset.name), nextTitles);
                nextTitles.push(clipTitle);
                batcher.add({
                  title: clipTitle,
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
          reportUnsupportedImports(failed);

          if (imported.length === 0) {
            deleteCollection(collectionId);
            useImportStore.getState().updateJob(jobId, { status: "error" });
            return;
          }

          useImportStore.getState().updateJob(jobId, {
            current: imported.length,
            failed: failed.length,
            status: failed.length === assets.length ? "error" : "done",
          });
        } catch (error) {
          console.warn("Collection import error", error);
          batcher.flush();
          deleteCollection(collectionId);
          useImportStore.getState().updateJob(jobId, { status: "error" });
        } finally {
          setTimeout(() => useImportStore.getState().removeJob(jobId), 2500);
        }
      })();
    }

    const duplicateResult = checkImportDuplicates(assetsSnapshot, getAllClips());
    if (duplicateResult.hasDuplicates) {
      showDuplicateReview(
        duplicateResult,
        () => doImport(duplicateResult.uniqueAssets),
        () => doImport(duplicateResult.allAssets),
        doImport
        );
      return;
    }

    doImport(duplicateResult.allAssets);
  };

  return {
    modalOpen,
    setModalOpen,
    draftTitle,
    setDraftTitle,
    draftDescription,
    setDraftDescription,
    importCollectionModalOpen,
    importCollectionAssets,
    importCollectionDatePreference,
    importCollectionDraft,
    setImportCollectionDraft,
    openAddCollectionFlow,
    openCollectionImportFlow,
    resetImportCollectionModal,
    cancelImportCollectionModal,
    createCollection,
    saveImportedCollection,
    defaultCollectionTitle: buildDefaultCollectionTitle(topLevelCollectionCount),
    defaultImportedTitle: buildImportedCollectionTitle(importCollectionAssets, topLevelCollectionCount),
    importHelperText: buildImportHelperText(
      `${importCollectionAssets.length} file${importCollectionAssets.length === 1 ? "" : "s"} will be added as individual clips in the new collection.`,
      importCollectionAssets,
      importCollectionDatePreference
    ),
  };
}
