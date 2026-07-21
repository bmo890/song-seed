import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { ScreenHeader } from "../../common/ScreenHeader";
import { PageIntro } from "../../common/PageIntro";
import { buildCollectionPathLabel } from "../../../domain/libraryNavigation";
import { useShareImportScreenModel } from "../hooks/useShareImportScreenModel";
import { styles } from "../styles";
import type { ShareImportScreenProps } from "../types";
import { ShareImportIncomingSection } from "./ShareImportIncomingSection";
import { ShareImportDestinationSection } from "./ShareImportDestinationSection";
import { ShareImportNotesSection } from "./ShareImportNotesSection";
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
        <PageIntro
          title={t("shareImport.sentMusic")}
          subtitle={t("shareImport.archiveIntro")}
        />
        <View style={archiveStyles.card}>
          <View style={archiveStyles.fileRow}>
            <View style={archiveStyles.fileIcon}>
              <Ionicons name="albums-outline" size={20} color={colors.primaryDeep} />
            </View>
            <Text style={archiveStyles.fileName} numberOfLines={1}>
              {model.sharedArchive.name ?? t("shareImport.archiveName")}
            </Text>
          </View>
          <View style={archiveStyles.actions}>
            <Pressable
              style={({ pressed }) => [
                archiveStyles.importBtn,
                model.isImportingArchive ? { opacity: 0.6 } : null,
                pressed ? { opacity: 0.85 } : null,
              ]}
              onPress={() => void model.importSharedArchive()}
              disabled={model.isImportingArchive}
              accessibilityRole="button"
              accessibilityLabel={t("shareImport.importFile")}
            >
              <Text style={archiveStyles.importLabel}>
                {model.isImportingArchive ? t("shareImport.importing") : t("shareImport.import")}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [archiveStyles.ghostBtn, pressed ? { opacity: 0.7 } : null]}
              onPress={model.closeScreen}
              accessibilityRole="button"
              accessibilityLabel={t("shareImport.notNow")}
            >
              <Text style={archiveStyles.ghostLabel}>{t("shareImport.notNow")}</Text>
            </Pressable>
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

      <PageIntro
        title={t("shareImport.title")}
        subtitle={
          model.isResolvingShareAssets
            ? t("shareImport.preparing")
            : model.importedAssets.length > 0
              ? t("shareImport.audioReady", { count: model.importedAssets.length })
              : model.hasShareIntent
                ? t("shareImport.review")
                : t("shareImport.nothingWaiting")
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

const archiveStyles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  fileIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#EBD3CE",
    alignItems: "center",
    justifyContent: "center",
  },
  fileName: {
    ...textTokens.body,
    fontFamily: "PlusJakartaSans_700Bold",
    flex: 1,
    minWidth: 0,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  importBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radii.round,
    paddingVertical: 12,
    alignItems: "center",
  },
  importLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 13,
    color: colors.onPrimary,
  },
  ghostBtn: {
    borderWidth: 1,
    borderColor: colors.borderMuted,
    borderRadius: radii.round,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  ghostLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 13,
    color: colors.textStrong,
  },
});
