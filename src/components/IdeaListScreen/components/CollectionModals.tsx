import { ClipNotesSheet } from "../../modals/ClipNotesSheet";
import { CollectionActionsModal } from "../../modals/CollectionActionsModal";
import { CollectionMoveModal } from "../../modals/CollectionMoveModal";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { useCollectionScreen } from "../provider/CollectionScreenProvider";
import { buildImportHelperText } from "../../../importDates";
import { buildImportedTitle } from "../../../services/audioStorage";
import { ensureUniqueCountedTitle, fmtDuration, formatDate } from "../../../utils";

function buildImportedProjectTitle(name?: string) {
  return buildImportedTitle(name);
}

export function CollectionModals() {
  const { screen, management, importFlow, editModal, store } = useCollectionScreen();

  return (
    <>
      <CollectionActionsModal
        visible={management.collectionActionsOpen}
        title={management.managedCollection?.title ?? "Collection"}
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
        title={management.managedCollection?.parentCollectionId ? "Rename subcollection" : "Rename collection"}
        draftValue={management.collectionDraft}
        placeholderValue={management.managedCollection?.title ?? "Collection"}
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
        clip={editModal.editTargetClip}
        idea={editModal.editTargetIdea?.kind === "clip" ? editModal.editTargetIdea : null}
        globalCustomTags={store.globalCustomTags}
        titleDraft={editModal.editClipDraft}
        notesDraft={editModal.editClipNotesDraft}
        onChangeTitle={editModal.setEditClipDraft}
        onChangeNotes={editModal.setEditClipNotesDraft}
        onCancel={editModal.closeEditModal}
        onSave={editModal.saveStandaloneClipEdit}
      />

      <QuickNameModal
        visible={importFlow.importModalOpen}
        title={importFlow.importMode === "song-project" ? "Import as Song Project" : "Import Audio"}
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
                `Destination: ${screen.currentCollection?.title ?? "Collection"} as one new song.\nFiles: ${importFlow.importAssets.length} selected audio file${importFlow.importAssets.length === 1 ? "" : "s"}`,
                importFlow.importAssets,
                importFlow.importDatePreference
              )
            : buildImportHelperText(
                `Destination: ${screen.currentCollection?.title ?? "Collection"} as a new clip card.\nFile: ${importFlow.importAssets[0]?.name ?? "Selected audio"}`,
                importFlow.importAssets,
                importFlow.importDatePreference
              )
        }
        saveLabel="Import"
        saveDisabled={false}
        cancelDisabled={false}
      />

      <CollectionMoveModal
        visible={!!management.collectionDestinationMode}
        title={
          management.collectionDestinationMode === "copy"
            ? management.managedCollection?.parentCollectionId
              ? "Copy Subcollection"
              : "Copy Collection"
            : management.managedCollection?.parentCollectionId
              ? "Move Subcollection"
              : "Move Collection"
        }
        helperText={
          management.managedCollectionHasChildren
            ? `Collections that already contain subcollections can only be ${management.collectionDestinationMode === "copy" ? "copied" : "moved"} to the top level.`
            : `Choose where to ${management.collectionDestinationMode === "copy" ? "copy" : "move"} this collection.`
        }
        confirmLabel={management.collectionDestinationMode === "copy" ? "Copy" : "Move"}
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
