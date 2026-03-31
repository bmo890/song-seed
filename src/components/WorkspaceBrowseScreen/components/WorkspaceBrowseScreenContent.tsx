import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../styles";
import { ScreenHeader } from "../../common/ScreenHeader";
import { PageIntro } from "../../common/PageIntro";
import { SearchField } from "../../common/SearchField";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { CollectionMoveModal } from "../../modals/CollectionMoveModal";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock } from "../../common/SelectionDock";
import { useWorkspaceCollectionsModel } from "../hooks/useWorkspaceCollectionsModel";
import { useWorkspaceCollectionSelection } from "../hooks/useWorkspaceCollectionSelection";
import { useWorkspaceCollectionImportFlow } from "../hooks/useWorkspaceCollectionImportFlow";
import { WorkspaceCollectionList } from "./WorkspaceCollectionList";

export function WorkspaceBrowseScreenContent() {
  const navigation = useNavigation();
  const collectionsModel = useWorkspaceCollectionsModel();
  const selectionModel = useWorkspaceCollectionSelection({
    navigation,
    workspaces: collectionsModel.workspaces,
    activeWorkspace: collectionsModel.activeWorkspace,
    activeWorkspaceId: collectionsModel.activeWorkspaceId,
    primaryCollectionId: collectionsModel.primaryCollectionId,
    setPrimaryCollectionId: collectionsModel.setPrimaryCollectionId,
    collectionEntries: collectionsModel.collectionEntries,
    updateCollection: collectionsModel.updateCollection,
    moveCollection: collectionsModel.moveCollection,
    deleteCollection: collectionsModel.deleteCollection,
  });
  const importFlow = useWorkspaceCollectionImportFlow({
    navigation,
    activeWorkspaceId: collectionsModel.activeWorkspaceId,
    topLevelCollectionCount: collectionsModel.topLevelCollections.length,
    addCollection: collectionsModel.addCollection,
    deleteCollection: collectionsModel.deleteCollection,
  });

  useBrowseRootBackHandler(
    selectionModel.selectedCollectionIds.length > 0
      ? {
          onBack: () => {
            selectionModel.setSelectedCollectionIds([]);
            selectionModel.setSelectionMoreVisible(false);
          },
        }
      : true
  );

  if (!collectionsModel.activeWorkspace) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Browse" leftIcon="hamburger" />
        <Text style={styles.subtitle}>Choose a workspace to browse its collections.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Workspace" leftIcon="hamburger" />
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={[
          styles.libraryScrollContent,
          {
            paddingBottom: selectionModel.selectionMode
              ? selectionModel.selectionDockHeight + 24 + Math.max(24, 12)
              : 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PageIntro
          title={collectionsModel.activeWorkspace.title}
          subtitle="Browse collections by recent work, then move deeper into the workspace."
        />

        <SearchField
          value={collectionsModel.searchQuery}
          placeholder="Search collections, songs, or clips..."
          onChangeText={collectionsModel.setSearchQuery}
        />

        {!selectionModel.selectionMode ? (
          <View style={styles.inputRow}>
            <Pressable
              style={({ pressed }) => [styles.ideasHeaderSelectBtn, pressed ? styles.pressDown : null]}
              onPress={importFlow.openAddCollectionFlow}
            >
              <Text style={styles.ideasHeaderSelectBtnText}>Add</Text>
            </Pressable>
          </View>
        ) : null}

        <WorkspaceCollectionList
          collectionEntries={collectionsModel.collectionEntries}
          primaryCollectionId={collectionsModel.primaryCollectionId}
          searchQuery={collectionsModel.searchQuery}
          selectionMode={selectionModel.selectionMode}
          selectedCollectionIds={selectionModel.selectedCollectionIds}
          sizeMap={collectionsModel.sizeMap}
          onPressCollection={(collectionId) => {
            if (selectionModel.selectionMode) {
              selectionModel.setSelectedCollectionIds((prev) =>
                prev.includes(collectionId)
                  ? prev.filter((id) => id !== collectionId)
                  : [...prev, collectionId]
              );
              return;
            }
            collectionsModel.openCollection(collectionId);
          }}
          onLongPressCollection={(collectionId) => {
            if (selectionModel.selectionMode) return;
            selectionModel.setSelectedCollectionIds([collectionId]);
          }}
        />
      </ScrollView>

      {selectionModel.selectionMode ? (
        <>
          <SelectionDock
            count={selectionModel.selectedCollectionIds.length}
            actions={selectionModel.selectionDockActions}
            onDone={() => selectionModel.setSelectedCollectionIds([])}
            onLayout={(height) => {
              selectionModel.setSelectionDockHeight((prev) =>
                Math.abs(prev - height) < 1 ? prev : height
              );
            }}
          />
          <SelectionActionSheet
            visible={selectionModel.selectionMoreVisible}
            title="Workspace actions"
            actions={selectionModel.selectionSheetActions}
            onClose={() => selectionModel.setSelectionMoreVisible(false)}
          />
        </>
      ) : null}

      <QuickNameModal
        visible={importFlow.modalOpen}
        title="New Collection"
        draftValue={importFlow.draftTitle}
        placeholderValue={importFlow.defaultCollectionTitle}
        onChangeDraft={importFlow.setDraftTitle}
        onCancel={() => {
          importFlow.setModalOpen(false);
          importFlow.setDraftTitle("");
        }}
        onSave={importFlow.createCollection}
        helperText="Collections hold songs and clips."
        saveLabel="Create"
      />

      <QuickNameModal
        visible={importFlow.importCollectionModalOpen}
        title="New Collection from Import"
        draftValue={importFlow.importCollectionDraft}
        placeholderValue={importFlow.defaultImportedTitle}
        onChangeDraft={importFlow.setImportCollectionDraft}
        onCancel={importFlow.resetImportCollectionModal}
        onSave={() => {
          importFlow.saveImportedCollection();
        }}
        helperText={importFlow.importHelperText}
        saveLabel="Create"
        saveDisabled={false}
        cancelDisabled={false}
      />

      <QuickNameModal
        visible={selectionModel.collectionRenameModalOpen}
        title="Rename collection"
        draftValue={selectionModel.collectionDraft}
        placeholderValue={selectionModel.managedCollection?.title ?? "Collection"}
        onChangeDraft={selectionModel.setCollectionDraft}
        onCancel={() => {
          selectionModel.setCollectionRenameModalOpen(false);
          selectionModel.setCollectionDraft("");
        }}
        onSave={selectionModel.renameCollection}
        disableSaveWhenEmpty
      />

      <CollectionMoveModal
        visible={!!selectionModel.collectionDestinationMode}
        title={selectionModel.collectionDestinationMode === "copy" ? "Copy Collection" : "Move Collection"}
        helperText={
          selectionModel.collectionDestinationMode === "copy"
            ? "Choose where to copy this collection."
            : "Choose the destination for this collection."
        }
        confirmLabel={selectionModel.collectionDestinationMode === "copy" ? "Copy" : "Move"}
        destinations={selectionModel.moveDestinations}
        selectedWorkspaceId={selectionModel.selectedMoveWorkspaceId}
        selectedParentCollectionId={selectionModel.selectedMoveParentCollectionId}
        onSelectDestination={(workspaceId, parentCollectionId) => {
          selectionModel.setSelectedMoveWorkspaceId(workspaceId);
          selectionModel.setSelectedMoveParentCollectionId(parentCollectionId);
        }}
        onCancel={() => {
          selectionModel.setCollectionDestinationMode(null);
          selectionModel.setDestinationCollectionIds([]);
        }}
        onConfirm={selectionModel.submitCollectionDestination}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
