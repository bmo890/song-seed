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

export function ShareImportScreenContent({
  fallbackCollectionId,
}: ShareImportScreenProps) {
  const model = useShareImportScreenModel({ fallbackCollectionId });
  const currentCollection = model.currentCollection;
  const currentCollectionWorkspace = model.currentCollectionWorkspace;

  // An incoming .songstead/.zip archive (a shared songbook, setlist, or library
  // export) takes over the screen — it's a different flow from audio files.
  if (model.sharedArchive) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Import from Share" leftIcon="back" onLeftPress={model.closeScreen} />
        <PageIntro
          title="Someone sent you music"
          subtitle="A Songstead file — a shared songbook, setlist, or library export. Imports land as their own Library entry, kept apart from your collections."
        />
        <View style={archiveStyles.card}>
          <View style={archiveStyles.fileRow}>
            <View style={archiveStyles.fileIcon}>
              <Ionicons name="albums-outline" size={20} color={colors.primaryDeep} />
            </View>
            <Text style={archiveStyles.fileName} numberOfLines={1}>
              {model.sharedArchive.name ?? "Songstead archive"}
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
              accessibilityLabel="Import this file"
            >
              <Text style={archiveStyles.importLabel}>
                {model.isImportingArchive ? "Importing…" : "Import"}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [archiveStyles.ghostBtn, pressed ? { opacity: 0.7 } : null]}
              onPress={model.closeScreen}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={archiveStyles.ghostLabel}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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
