import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../design/tokens";
import { ScreenHeader } from "../../common/ScreenHeader";
import { Button } from "../../common/Button";
import { UserText } from "../../../i18n";
import { buildCollectionPathLabel } from "../../../domain/libraryNavigation";
import { useShareImportScreenModel } from "../hooks/useShareImportScreenModel";
import { styles } from "../styles";
import type { ShareImportScreenProps } from "../types";
import { ShareImportIncomingSection } from "./ShareImportIncomingSection";
import { ShareImportDestinationSection } from "./ShareImportDestinationSection";
import { ShareImportModals } from "./ShareImportModals";
import { useTranslation } from "react-i18next";

export function ShareImportScreenContent({
  fallbackCollectionId,
}: ShareImportScreenProps) {
  const { t } = useTranslation();
  const model = useShareImportScreenModel({ fallbackCollectionId });
  const currentCollection = model.currentCollection;
  const currentCollectionWorkspace = model.currentCollectionWorkspace;

  // An incoming .songnook/.zip archive (a shared songbook, setlist, or library
  // export) takes over the screen — it's a different flow from audio files.
  if (model.sharedArchive) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title={t("shareImport.title")} leftIcon="back" onLeftPress={model.closeScreen} />
        <View style={styles.content}>
          <Text style={styles.status}>{t("shareImport.sentMusic")}</Text>
          <View style={styles.archiveRow}>
            <Ionicons name="albums-outline" size={19} color={colors.textStrong} />
            <UserText style={styles.archiveName} numberOfLines={1}>
              {model.sharedArchive.name ?? t("shareImport.archiveName")}
            </UserText>
          </View>
          <View style={styles.archiveActions}>
            <Button
              label={model.isImportingArchive ? t("shareImport.importing") : t("shareImport.import")}
              onPress={() => void model.importSharedArchive()}
              disabled={model.isImportingArchive}
              accessibilityLabel={t("shareImport.importFile")}
              style={styles.archiveImport}
            />
            <Button label={t("shareImport.notNow")} variant="quiet" onPress={model.closeScreen} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader
        title={t("shareImport.title")}
        leftIcon="back"
        onLeftPress={model.closeScreen}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.status}>
          {model.isResolvingShareAssets
            ? t("shareImport.preparing")
            : model.importedAssets.length > 0
              ? t("shareImport.audioReady", { count: model.importedAssets.length })
              : model.hasShareIntent
                ? t("shareImport.review")
                : t("shareImport.nothingWaiting")}
        </Text>
        {/* The status line above already says "preparing" or "nothing waiting";
            the section appears once there is something to list or explain. */}
        {model.importedAssets.length > 0 || model.unsupportedOnly || model.shareAssets.rejectedCount > 0 ? (
          <ShareImportIncomingSection
            importedAssetCount={model.importedAssets.length}
            previewNames={model.previewNames}
            isResolvingShareAssets={model.isResolvingShareAssets}
            unsupportedOnly={model.unsupportedOnly}
            rejectedCount={model.shareAssets.rejectedCount}
          />
        ) : null}

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
                    currentCollectionWorkspace?.title ?? t("shareImport.currentWorkspace"),
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
                    t("shareImport.newCollection")
                  );
                  if (!datePreference) return;
                  model.setNewCollectionDraft("");
                  model.setNewCollectionModalOpen(true);
                })();
              }}
            />
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
