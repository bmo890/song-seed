import { Alert } from "react-native";
import { useState } from "react";
import {
  buildImportedTitle,
  importAudioAsset,
  importAudioAssets,
  pickAudioFiles,
  type ImportedAudioAsset,
} from "../../../services/audioStorage";
import { useImportStore } from "../../../state/useImportStore";
import { appActions } from "../../../state/actions";
import { enqueueBackgroundWaveformHydration } from "../../../services/backgroundWaveformHydration";
import { ensureUniqueCountedTitle } from "../../../utils";
import { checkImportDuplicates, getAllClips, showDuplicateReview } from "../../../services/importDuplicates";
import {
  buildImportedAssetDateMetadata,
  buildImportedIdeaDateMetadata,
  promptForImportDatePreference,
  type ImportDatePreference,
} from "../../../importDates";

type CollectionImportFlowParams = {
  activeWorkspaceId: string | null;
  collectionId: string;
  collectionIdeaTitles: string[];
  currentCollectionTitle: string;
};

function buildImportedProjectTitle(assets: ImportedAudioAsset[]) {
  return buildImportedTitle(assets[0]?.name);
}

export function useCollectionImportFlow({
  activeWorkspaceId,
  collectionId,
  collectionIdeaTitles,
  currentCollectionTitle,
}: CollectionImportFlowParams) {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importAssets, setImportAssets] = useState<ImportedAudioAsset[]>([]);
  const [importMode, setImportMode] = useState<"single-clip" | "song-project" | null>(null);
  const [importDatePreference, setImportDatePreference] = useState<ImportDatePreference>("import");
  const [importDraft, setImportDraft] = useState("");

  const resetImportModal = () => {
    setImportModalOpen(false);
    setImportAssets([]);
    setImportMode(null);
    setImportDatePreference("import");
    setImportDraft("");
  };

  const openImportAudioFlow = async () => {
    if (!collectionId) {
      Alert.alert("Choose a collection", "Open a collection before importing audio.");
      return;
    }

    const assets = await pickAudioFiles({ multiple: true });
    if (assets.length === 0) return;

    if (assets.length === 1) {
      const datePreference = await promptForImportDatePreference(assets);
      if (!datePreference) return;
      setImportAssets(assets);
      setImportMode("single-clip");
      setImportDatePreference(datePreference);
      setImportDraft("");
      setImportModalOpen(true);
      return;
    }

    Alert.alert(
      "Import audio",
      `Choose how to add ${assets.length} files into ${currentCollectionTitle}.`,
      [
        {
          text: "Import as individual clips",
          onPress: () => {
            void (async () => {
              const datePreference = await promptForImportDatePreference(assets);
              if (!datePreference) return;
              importAssetsAsIndividualClips(assets, datePreference);
            })();
          },
        },
        {
          text: "Import as song project",
          onPress: () => {
            void (async () => {
              const datePreference = await promptForImportDatePreference(assets);
              if (!datePreference) return;
              setImportAssets(assets);
              setImportMode("song-project");
              setImportDatePreference(datePreference);
              setImportDraft("");
              setImportModalOpen(true);
            })();
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  function importAssetsAsIndividualClips(assetsIn: ImportedAudioAsset[], datePreference: ImportDatePreference) {
    if (!collectionId || assetsIn.length === 0) return;

    const duplicateResult = checkImportDuplicates(assetsIn, getAllClips());

    function doImport(assets: ImportedAudioAsset[]) {
      if (assets.length === 0) return;
      const baseTitles = [...collectionIdeaTitles];
      const nextTitles = [...baseTitles];
      const label = assets.length === 1 ? buildImportedTitle(assets[0]!.name) : `${assets.length} clips`;
      const jobId = `import-${Date.now()}`;
      useImportStore.getState().startJob({ id: jobId, label, total: assets.length });

      void (async () => {
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
                const [importedDate] = buildImportedAssetDateMetadata([asset], datePreference, importedAt);
                const title = ensureUniqueCountedTitle(buildImportedTitle(asset.name), nextTitles);
                nextTitles.push(title);
                const importedResult = appActions.importClipToCollection(collectionId, {
                  title,
                  audioUri: asset.audioUri,
                  durationMs: asset.durationMs,
                  waveformPeaks: asset.waveformPeaks,
                  createdAt: importedDate!.createdAt,
                  importedAt: importedDate!.importedAt,
                  sourceCreatedAt: importedDate!.sourceCreatedAt,
                });
                if (activeWorkspaceId) {
                  enqueueBackgroundWaveformHydration({
                    workspaceId: activeWorkspaceId,
                    ideaId: importedResult.ideaId,
                    clipId: importedResult.clipId,
                    audioUri: asset.audioUri,
                  });
                }
              },
            }
          );

          useImportStore.getState().updateJob(jobId, {
            current: imported.length,
            failed: failed.length,
            status: failed.length === imported.length + failed.length ? "error" : "done",
          });
        } catch (error) {
          console.warn("Import audio error", error);
          useImportStore.getState().updateJob(jobId, { status: "error" });
        } finally {
          setTimeout(() => useImportStore.getState().removeJob(jobId), 2500);
        }
      })();
    }

    if (duplicateResult.hasDuplicates) {
      showDuplicateReview(
        duplicateResult,
        () => doImport(duplicateResult.uniqueAssets),
        () => doImport(duplicateResult.allAssets)
      );
      return;
    }

    doImport(duplicateResult.allAssets);
  }

  const saveImportedAudio = async () => {
    if (importAssets.length === 0 || !importMode) return;

    const targetCollectionId = collectionId;
    const modeSnapshot = importMode;
    const assetsSnapshot = importAssets;
    const draftSnapshot = importDraft;
    const datePreferenceSnapshot = importDatePreference;
    const baseTitles = [...collectionIdeaTitles];

    function doImport(assets: ImportedAudioAsset[]) {
      if (assets.length === 0) return;

      const label =
        modeSnapshot === "single-clip"
          ? draftSnapshot.trim() || buildImportedTitle(assets[0]!.name)
          : draftSnapshot.trim() || buildImportedProjectTitle(assets);

      resetImportModal();

      const jobId = `import-${Date.now()}`;
      useImportStore.getState().startJob({ id: jobId, label, total: assets.length });

      void (async () => {
        try {
          const importedAt = Date.now();

          if (modeSnapshot === "single-clip") {
            const importAsset = assets[0]!;
            const importedAudio = await importAudioAsset(
              importAsset,
              `audio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
            );
            const fallbackTitle = ensureUniqueCountedTitle(buildImportedTitle(importAsset.name), baseTitles);
            const finalTitle = draftSnapshot.trim() || fallbackTitle;
            const [importedDate] = buildImportedAssetDateMetadata([importAsset], datePreferenceSnapshot, importedAt);

            const importedResult = appActions.importClipToCollection(targetCollectionId, {
              title: finalTitle,
              audioUri: importedAudio.audioUri,
              durationMs: importedAudio.durationMs,
              waveformPeaks: importedAudio.waveformPeaks,
              createdAt: importedDate!.createdAt,
              importedAt: importedDate!.importedAt,
              sourceCreatedAt: importedDate!.sourceCreatedAt,
            });
            if (activeWorkspaceId) {
              enqueueBackgroundWaveformHydration({
                workspaceId: activeWorkspaceId,
                ideaId: importedResult.ideaId,
                clipId: importedResult.clipId,
                audioUri: importedAudio.audioUri,
              });
            }
            useImportStore.getState().updateJob(jobId, { current: 1, status: "done" });
            return;
          }

          const importedDates = buildImportedAssetDateMetadata(assets, datePreferenceSnapshot, importedAt);
          const ideaDateMetadata = buildImportedIdeaDateMetadata(importedDates);
          const imported = await importAudioAssets(
            assets,
            (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
            (current, _total, failedCount) => {
              useImportStore.getState().updateJob(jobId, { current, failed: failedCount });
            },
            { lightweight: true }
          );
          const projectClipTitles: string[] = [];
          const projectTitle = draftSnapshot.trim() || buildImportedProjectTitle(assets);
          const importedProject = appActions.importProjectToCollection(targetCollectionId, {
            title: projectTitle,
            createdAt: ideaDateMetadata.createdAt,
            importedAt: ideaDateMetadata.importedAt,
            sourceCreatedAt: ideaDateMetadata.sourceCreatedAt,
            clips: imported.imported.map((asset, index) => ({
              title: (() => {
                const nextTitle = ensureUniqueCountedTitle(buildImportedTitle(asset.name), projectClipTitles);
                projectClipTitles.push(nextTitle);
                return nextTitle;
              })(),
              audioUri: asset.audioUri,
              durationMs: asset.durationMs,
              waveformPeaks: asset.waveformPeaks,
              createdAt: importedDates[index]!.createdAt,
              importedAt: importedDates[index]!.importedAt,
              sourceCreatedAt: importedDates[index]!.sourceCreatedAt,
            })),
          });
          if (activeWorkspaceId) {
            imported.imported.forEach((asset, index) => {
              const clipId = importedProject.clipIds[index];
              if (!clipId) return;
              enqueueBackgroundWaveformHydration({
                workspaceId: activeWorkspaceId,
                ideaId: importedProject.ideaId,
                clipId,
                audioUri: asset.audioUri,
              });
            });
          }

          useImportStore.getState().updateJob(jobId, {
            current: imported.imported.length,
            failed: imported.failed.length,
            status: imported.failed.length === imported.imported.length + imported.failed.length ? "error" : "done",
          });
        } catch (error) {
          console.warn("Import audio error", error);
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
        () => doImport(duplicateResult.allAssets)
      );
      return;
    }

    doImport(duplicateResult.allAssets);
  };

  const helperText =
    importMode === "song-project"
      ? `Destination: ${currentCollectionTitle} as one new song.\nFiles: ${importAssets.length} selected audio file${importAssets.length === 1 ? "" : "s"}`
      : `Destination: ${currentCollectionTitle} as a new clip card.\nFile: ${importAssets[0]?.name ?? "Selected audio"}`;

  return {
    importModalOpen,
    importAssets,
    importMode,
    importDatePreference,
    importDraft,
    helperText,
    setImportDraft,
    setImportModalOpen,
    setImportAssets,
    setImportMode,
    setImportDatePreference,
    resetImportModal,
    openImportAudioFlow,
    saveImportedAudio,
  };
}
