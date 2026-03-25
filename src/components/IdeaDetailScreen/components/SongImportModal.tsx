import { QuickNameModal } from "../../modals/QuickNameModal";
import { buildImportHelperText } from "../../../importDates";
import { buildImportedTitle } from "../../../services/audioStorage";
import { ensureUniqueCountedTitle } from "../../../utils";
import { useSongScreen } from "../provider/SongScreenProvider";

export function SongImportModal() {
  const { screen, importFlow } = useSongScreen();

  if (!screen.selectedIdea) {
    return null;
  }

  return (
    <QuickNameModal
      visible={importFlow.importModalOpen}
      title="Import audio into song"
      draftValue={importFlow.importDraft}
      placeholderValue={
        importFlow.importAsset
          ? ensureUniqueCountedTitle(buildImportedTitle(importFlow.importAsset.name), screen.songClipTitles)
          : ""
      }
      onChangeDraft={importFlow.setImportDraft}
      isPrimary={importFlow.importAsPrimary}
      onChangeIsPrimary={importFlow.setImportAsPrimary}
      onCancel={importFlow.resetImportModal}
      onSave={() => {
        void importFlow.saveImportedAudio();
      }}
      helperText={buildImportHelperText(
        `Destination: ${screen.selectedIdea.title} as a new clip version.\nFile: ${importFlow.importAsset?.name ?? "Selected audio"}`,
        importFlow.importAsset ? [importFlow.importAsset] : [],
        importFlow.importDatePreference
      )}
      saveLabel="Import"
      saveDisabled={false}
      cancelDisabled={false}
    />
  );
}
