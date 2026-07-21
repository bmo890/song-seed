import { QuickNameModal } from "../../modals/QuickNameModal";
import type { ImportedAudioAsset } from "../../../services/audioStorage";
import type { ImportDatePreference } from "../../../domain/importDates";
import type { CollectionDestination } from "../types";
import { useTranslation } from "react-i18next";

type Props = {
  importedAssetCount: number;
  importedAssets: ImportedAudioAsset[];
  importDatePreference: ImportDatePreference;
  targetWorkspaceAvailable: boolean;
  topLevelCollectionCount: number;
  newCollectionModalOpen: boolean;
  newCollectionDraft: string;
  setNewCollectionDraft: (value: string) => void;
  setNewCollectionModalOpen: (value: boolean) => void;
  importIntoNewCollection: () => void;
  projectTitleModalOpen: boolean;
  projectTitleDraft: string;
  setProjectTitleDraft: (value: string) => void;
  setProjectTitleModalOpen: (value: boolean) => void;
  pendingCollectionDestination: CollectionDestination | null;
  setPendingCollectionDestination: (value: CollectionDestination | null) => void;
  importIntoExistingCollection: (
    destination: CollectionDestination,
    mode: "single-clip" | "individual-clips" | "song-project",
    projectTitle?: string,
    datePreference?: ImportDatePreference
  ) => void;
  buildImportedCollectionTitle: (
    assets: ImportedAudioAsset[],
    count: number
  ) => string;
  buildImportedProjectTitle: (assets: ImportedAudioAsset[]) => string;
  buildImportHelperText: (
    description: string,
    assets: ImportedAudioAsset[],
    datePreference: ImportDatePreference
  ) => string;
};

export function ShareImportModals({
  importedAssetCount,
  importedAssets,
  importDatePreference,
  targetWorkspaceAvailable,
  topLevelCollectionCount,
  newCollectionModalOpen,
  newCollectionDraft,
  setNewCollectionDraft,
  setNewCollectionModalOpen,
  importIntoNewCollection,
  projectTitleModalOpen,
  projectTitleDraft,
  setProjectTitleDraft,
  setProjectTitleModalOpen,
  pendingCollectionDestination,
  setPendingCollectionDestination,
  importIntoExistingCollection,
  buildImportedCollectionTitle,
  buildImportedProjectTitle,
  buildImportHelperText,
}: Props) {
  const { t } = useTranslation();
  return (
    <>
      <QuickNameModal
        visible={newCollectionModalOpen}
        title={t("shareImport.newCollection")}
        draftValue={newCollectionDraft}
        placeholderValue={buildImportedCollectionTitle(importedAssets, topLevelCollectionCount)}
        onChangeDraft={setNewCollectionDraft}
        onCancel={() => {
          setNewCollectionModalOpen(false);
          setNewCollectionDraft("");
        }}
        onSave={importIntoNewCollection}
        helperText={buildImportHelperText(
          t("shareImport.newCollectionFiles", { count: importedAssetCount }),
          importedAssets,
          importDatePreference
        )}
        saveLabel={t("shareImport.create")}
        saveDisabled={!targetWorkspaceAvailable}
        cancelDisabled={false}
      />

      <QuickNameModal
        visible={projectTitleModalOpen}
        title={t("shareImport.projectTitle")}
        draftValue={projectTitleDraft}
        placeholderValue={buildImportedProjectTitle(importedAssets)}
        onChangeDraft={setProjectTitleDraft}
        onCancel={() => {
          setProjectTitleModalOpen(false);
          setProjectTitleDraft("");
          setPendingCollectionDestination(null);
        }}
        onSave={() => {
          if (!pendingCollectionDestination) return;
          setProjectTitleModalOpen(false);
          importIntoExistingCollection(
            pendingCollectionDestination,
            "song-project",
            projectTitleDraft.trim() || buildImportedProjectTitle(importedAssets),
            importDatePreference
          );
          setPendingCollectionDestination(null);
          setProjectTitleDraft("");
        }}
        helperText={buildImportHelperText(
          t("shareImport.createSongIn", { collection: pendingCollectionDestination?.collectionTitle ?? t("shareImport.thisCollection") }),
          importedAssets,
          importDatePreference
        )}
        saveLabel={t("shareImport.import")}
        saveDisabled={false}
        cancelDisabled={false}
      />
    </>
  );
}
