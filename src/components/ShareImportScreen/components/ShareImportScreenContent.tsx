import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenHeader } from "../../common/ScreenHeader";
import { PageIntro } from "../../common/PageIntro";
import { buildCollectionPathLabel } from "../../../libraryNavigation";
import { useShareImportScreenModel } from "../hooks/useShareImportScreenModel";
import { styles } from "../styles";
import type { ShareImportScreenProps } from "../types";
import { ShareImportIncomingSection } from "./ShareImportIncomingSection";
import { ShareImportDestinationSection } from "./ShareImportDestinationSection";
import { ShareImportNotesSection } from "./ShareImportNotesSection";
import { ShareImportModals } from "./ShareImportModals";

export function ShareImportScreenContent({
  fallbackCollectionId,
}: ShareImportScreenProps) {
  const model = useShareImportScreenModel({ fallbackCollectionId });
  const currentCollection = model.currentCollection;
  const currentCollectionWorkspace = model.currentCollectionWorkspace;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title="Import from Share"
        leftIcon="back"
        onLeftPress={model.closeScreen}
      />

      <PageIntro
        title="Import from Share"
        subtitle={
          model.isResolvingShareAssets
            ? "Preparing the shared audio before import."
            : model.importedAssets.length > 0
              ? `${model.importedAssets.length} audio file${
                  model.importedAssets.length === 1 ? "" : "s"
                } ready to import`
              : model.hasShareIntent
                ? "Review the shared content and choose where it should go."
                : "There is no shared audio waiting to import."
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ShareImportIncomingSection
          importedAssetCount={model.importedAssets.length}
          previewNames={model.previewNames}
          isResolvingShareAssets={model.isResolvingShareAssets}
          unsupportedOnly={model.unsupportedOnly}
          rejectedCount={model.shareAssets.rejectedCount}
        />

        {model.importedAssets.length > 0 ? (
          <>
            <ShareImportDestinationSection
              currentCollection={
                currentCollection
                  ? {
                      title: currentCollection.title,
                    }
                  : null
              }
              currentCollectionPathLabel={
                currentCollection && currentCollectionWorkspace
                  ? buildCollectionPathLabel(
                      currentCollectionWorkspace,
                      currentCollection.id
                    )
                  : null
              }
              currentWorkspaceTitle={currentCollectionWorkspace?.title ?? null}
              otherCollectionsExpanded={model.otherCollectionsExpanded}
              otherCollectionDestinations={model.otherCollectionDestinations}
              targetWorkspaceTitle={model.targetWorkspace?.title ?? null}
              isResolvingShareAssets={model.isResolvingShareAssets}
              onToggleOtherCollections={() =>
                model.setOtherCollectionsExpanded((prev) => !prev)
              }
              onImportIntoCurrentCollection={() => {
                if (!currentCollection) return;
                void model.promptForCollectionImport({
                  workspaceId: currentCollection.workspaceId,
                  collectionId: currentCollection.id,
                  workspaceTitle:
                    currentCollectionWorkspace?.title ?? "Current workspace",
                  collectionTitle: currentCollection.title,
                  pathLabel: currentCollectionWorkspace
                    ? buildCollectionPathLabel(
                        currentCollectionWorkspace,
                        currentCollection.id
                      )
                    : currentCollection.title,
                });
              }}
              onSelectDestination={(destination) => {
                void model.promptForCollectionImport(destination);
              }}
              onCreateNewCollection={() => {
                void (async () => {
                  const datePreference = await model.resolveImportDatePreference(
                    "New Collection from Import"
                  );
                  if (!datePreference) return;
                  model.setNewCollectionDraft("");
                  model.setNewCollectionModalOpen(true);
                })();
              }}
            />

            <ShareImportNotesSection />
          </>
        ) : null}
      </ScrollView>

      <ShareImportModals
        importedAssetCount={model.importedAssets.length}
        importedAssets={model.importedAssets}
        importDatePreference={model.importDatePreference}
        targetWorkspaceAvailable={!!model.targetWorkspace}
        topLevelCollectionCount={model.topLevelCollectionCount}
        newCollectionModalOpen={model.newCollectionModalOpen}
        newCollectionDraft={model.newCollectionDraft}
        setNewCollectionDraft={model.setNewCollectionDraft}
        setNewCollectionModalOpen={model.setNewCollectionModalOpen}
        importIntoNewCollection={model.importIntoNewCollection}
        projectTitleModalOpen={model.projectTitleModalOpen}
        projectTitleDraft={model.projectTitleDraft}
        setProjectTitleDraft={model.setProjectTitleDraft}
        setProjectTitleModalOpen={model.setProjectTitleModalOpen}
        pendingCollectionDestination={model.pendingCollectionDestination}
        setPendingCollectionDestination={model.setPendingCollectionDestination}
        importIntoExistingCollection={model.importIntoExistingCollection}
        buildImportedCollectionTitle={model.buildImportedCollectionTitle}
        buildImportedProjectTitle={model.buildImportedProjectTitle}
        buildImportHelperText={model.buildImportHelperText}
      />
    </SafeAreaView>
  );
}
