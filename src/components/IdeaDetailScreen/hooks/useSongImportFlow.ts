import { useState } from "react";
import { checkImportDuplicates, getAllClips, showDuplicateReview } from "../../../services/importDuplicates";
import { buildImportedTitle, importAudioAsset, type ImportedAudioAsset } from "../../../services/audioStorage";
import { reportUnsupportedImports } from "../../common/importFeedback";
import { pickImportAssets } from "../../common/importSource";
import { i18n } from "../../../i18n/instance";
import { useImportStore } from "../../../state/useImportStore";
import { appActions } from "../../../state/actions";
import { ensureUniqueCountedTitle } from "../../../utils";
import { buildImportedAssetDateMetadata, promptForImportDatePreference, type ImportDatePreference } from "../../../domain/importDates";
import type { SongIdea } from "../../../types";
import { afterOverlayCloses } from "../../common/afterOverlayCloses";

type SongImportFlowParams = {
  selectedIdea: SongIdea | null | undefined;
  songClipTitles: string[];
};

export function useSongImportFlow({ selectedIdea, songClipTitles }: SongImportFlowParams) {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importAsset, setImportAsset] = useState<ImportedAudioAsset | null>(null);
  const [importDatePreference, setImportDatePreference] = useState<ImportDatePreference>("import");
  const [importDraft, setImportDraft] = useState("");
  const [importAsPrimary, setImportAsPrimary] = useState(false);

  function resetImportModal() {
    setImportModalOpen(false);
    setImportAsset(null);
    setImportDatePreference("import");
    setImportDraft("");
    setImportAsPrimary(false);
  }

  async function openImportAudioFlow() {
    if (!selectedIdea || selectedIdea.kind !== "project") return;
    const [asset] = await pickImportAssets({ multiple: false });
    if (!asset) return;
    const datePreference = await promptForImportDatePreference([asset], i18n.t("songDetail.importAudio"));
    if (!datePreference) return;
    setImportAsset(asset);
    setImportDatePreference(datePreference);
    setImportDraft("");
    setImportAsPrimary(false);
    setImportModalOpen(true);
  }

  function saveImportedAudio() {
    if (!selectedIdea || selectedIdea.kind !== "project" || !importAsset) return;

    const ideaId = selectedIdea.id;
    const assetSnapshot = importAsset;
    const isPrimarySnapshot = importAsPrimary;
    const draftSnapshot = importDraft;
    const datePreferenceSnapshot = importDatePreference;

    function proceedWithImport(asset: ImportedAudioAsset) {
      const importedAt = Date.now();
      const fallbackTitle = ensureUniqueCountedTitle(buildImportedTitle(asset.name), songClipTitles);
      const finalTitle = draftSnapshot.trim() || fallbackTitle;
      const [importedDate] = buildImportedAssetDateMetadata([asset], datePreferenceSnapshot, importedAt);

      resetImportModal();

      const jobId = `import-${Date.now()}`;
      useImportStore.getState().startJob({ id: jobId, label: finalTitle, total: 1 });

      void (async () => {
        try {
          const importedAudio = await importAudioAsset(
            asset,
            `audio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
          );
          appActions.importClipToProject(ideaId, {
            title: finalTitle,
            audioUri: importedAudio.audioUri,
            durationMs: importedAudio.durationMs,
            waveformPeaks: importedAudio.waveformPeaks,
            isPrimary: isPrimarySnapshot,
            createdAt: importedDate!.createdAt,
            importedAt: importedDate!.importedAt,
            sourceCreatedAt: importedDate!.sourceCreatedAt,
          });
          useImportStore.getState().updateJob(jobId, { current: 1, status: "done" });
        } catch (error) {
          console.warn("Song import audio error", error);
          reportUnsupportedImports([{ error }]);
          useImportStore.getState().updateJob(jobId, { status: "error" });
        } finally {
          setTimeout(() => useImportStore.getState().removeJob(jobId), 2500);
        }
      })();
    }

    const duplicateResult = checkImportDuplicates([assetSnapshot], getAllClips());
    if (duplicateResult.hasDuplicates) {
      // Close the name sheet before the review: iOS refuses a second sheet beside it.
      resetImportModal();
      void afterOverlayCloses().then(() =>
        showDuplicateReview(duplicateResult, () => {}, () => proceedWithImport(assetSnapshot))
      );
      return;
    }

    proceedWithImport(assetSnapshot);
  }

  return {
    importModalOpen,
    importAsset,
    importDatePreference,
    importDraft,
    importAsPrimary,
    setImportModalOpen,
    setImportAsset,
    setImportDatePreference,
    setImportDraft,
    setImportAsPrimary,
    resetImportModal,
    openImportAudioFlow,
    saveImportedAudio,
  };
}
