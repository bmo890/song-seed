import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { CollectionActionsModal } from "../../modals/CollectionActionsModal";
import { CollectionMoveModal } from "../../modals/CollectionMoveModal";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { buildImportHelperText } from "../../../domain/importDates";
import { buildImportedTitle } from "../../../services/audioStorage";
import { ensureUniqueCountedTitle, fmtDuration, formatDate } from "../../../utils";
import { useTranslation } from "react-i18next";

function buildImportedProjectTitle(name?: string) {
  return buildImportedTitle(name);
}

export function CollectionModals() {
  const { t } = useTranslation();
  const { screen, management, importFlow, editModal } = useCollectionScreen();

  return (
    <>
      <CollectionActionsModal
        visible={management.collectionActionsOpen}
        title={management.managedCollection?.title ?? t("collection.title")}
        onRename={management.openRenameCollection}
        onCopy={management.openCopyCollection}
        onMove={management.openMoveCollection}
        onDelete={management.confirmDeleteCollection}
        onCancel={() => {
          management.setCollectionActionsOpen(false);
          management.setManagedCollectionId(null);
        }}
      />

      <QuickNameModal
        visible={management.collectionRenameModalOpen}
        title={t(management.managedCollection?.parentCollectionId ? "collection.renameSubcollection" : "collection.rename")}
        draftValue={management.collectionDraft}
        placeholderValue={management.managedCollection?.title ?? t("collection.title")}
        onChangeDraft={management.setCollectionDraft}
        onCancel={() => {
          management.setCollectionRenameModalOpen(false);
          management.setCollectionDraft("");
        }}
        onSave={management.saveRename}
        disableSaveWhenEmpty
      />

      <ClipNotesSheet
        visible={editModal.editModalOpen && editModal.editTargetIdea?.kind === "clip"}
        clipSubtitle={
          editModal.editTargetClip
            ? `${editModal.editTargetClip.durationMs ? fmtDuration(editModal.editTargetClip.durationMs) : "0:00"} • ${formatDate(editModal.editTargetClip.createdAt)}`
            : ""
        }
        titleDraft={editModal.editClipDraft}
        notesDraft={editModal.editClipNotesDraft}
        onChangeTitle={editModal.setEditClipDraft}
        onChangeNotes={editModal.setEditClipNotesDraft}
        onCancel={editModal.closeEditModal}
        onSave={editModal.saveStandaloneClipEdit}
      />

      <QuickNameModal
        visible={importFlow.importModalOpen}
        title={t(importFlow.importMode === "song-project" ? "collection.importSong" : "collection.importAudio")}
        draftValue={importFlow.importDraft}
        placeholderValue={
          importFlow.importMode === "song-project"
            ? buildImportedProjectTitle(importFlow.importAssets[0]?.name)
            : importFlow.importAssets[0]
              ? ensureUniqueCountedTitle(buildImportedTitle(importFlow.importAssets[0].name), screen.ideas.map((idea) => idea.title))
              : ""
        }
        onChangeDraft={importFlow.setImportDraft}
        onCancel={importFlow.resetImportModal}
        onSave={() => {
          void importFlow.saveImportedAudio();
        }}
        helperText={
          importFlow.importMode === "song-project"
            ? buildImportHelperText(
                `${t("collection.destinationSong", { collection: screen.currentCollection?.title ?? t("collection.title") })}\n${t("collection.selectedFiles", { count: importFlow.importAssets.length })}`,
                importFlow.importAssets,
                importFlow.importDatePreference
              )
            : buildImportHelperText(
                `${t("collection.destinationClip", { collection: screen.currentCollection?.title ?? t("collection.title") })}\n${t("collection.selectedFile", { name: importFlow.importAssets[0]?.name ?? t("collection.selectedAudio") })}`,
                importFlow.importAssets,
                importFlow.importDatePreference
              )
        }
        saveLabel={t("collection.import")}
        saveDisabled={false}
        cancelDisabled={false}
      />

      <CollectionMoveModal
        visible={!!management.collectionDestinationMode}
        title={
          management.collectionDestinationMode === "copy"
            ? management.managedCollection?.parentCollectionId
              ? t("collection.copySubcollection")
              : t("collection.copyCollection")
            : management.managedCollection?.parentCollectionId
              ? t("collection.moveSubcollection")
              : t("collection.moveCollection")
        }
        helperText={
          management.managedCollectionHasChildren
            ? t("collection.topLevelOnly", { action: t(management.collectionDestinationMode === "copy" ? "collection.copied" : "collection.moved") })
            : t("collection.chooseDestination", { action: t(management.collectionDestinationMode === "copy" ? "collection.copy" : "collection.move") })
        }
        confirmLabel={t(management.collectionDestinationMode === "copy" ? "common.copy" : "collection.move")}
        destinations={management.moveDestinations}
        selectedWorkspaceId={management.selectedMoveWorkspaceId}
        selectedParentCollectionId={management.selectedMoveParentCollectionId}
        onSelectDestination={(workspaceId, parentCollectionId) => {
          management.setSelectedMoveWorkspaceId(workspaceId);
          management.setSelectedMoveParentCollectionId(parentCollectionId);
        }}
        onCancel={() => {
          management.setCollectionDestinationMode(null);
          management.setSelectedMoveWorkspaceId(null);
          management.setSelectedMoveParentCollectionId(null);
          management.setManagedCollectionId(null);
        }}
        onConfirm={management.submitCollectionDestination}
      />
    </>
  );
}
