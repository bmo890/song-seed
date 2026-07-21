import { QuickNameModal } from "../../modals/QuickNameModal";
import { buildImportHelperText } from "../../../domain/importDates";
import { buildImportedTitle } from "../../../services/audioStorage";
import { ensureUniqueCountedTitle } from "../../../utils";
import { useSongScreen } from "../provider/SongScreenProvider";
import { useTranslation } from "react-i18next";

export function SongImportModal() {
  const { t } = useTranslation();
  const { screen, importFlow } = useSongScreen();

  if (!screen.selectedIdea) {
    return null;
  }

  return (
    <QuickNameModal
      visible={importFlow.importModalOpen}
      title={t("songDetail.importAudio")}
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
        t("songDetail.importDestination", {
          title: screen.selectedIdea.title,
          file: importFlow.importAsset?.name ?? t("songDetail.selectedAudio"),
        }),
        importFlow.importAsset ? [importFlow.importAsset] : [],
        importFlow.importDatePreference
      )}
      saveLabel={t("songDetail.import")}
      saveDisabled={false}
      cancelDisabled={false}
    />
  );
}
