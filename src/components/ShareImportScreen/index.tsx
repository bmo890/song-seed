import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { styles } from "../../styles";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { ScreenHeader } from "../common/ScreenHeader";
import { PageIntro } from "../common/PageIntro";
import { SurfaceCard } from "../common/SurfaceCard";
import { NavRow } from "../common/NavRow";
import { QuickNameModal } from "../modals/QuickNameModal";
import {
  buildImportedTitle,
  importAudioAsset,
  importAudioAssets,
  type ImportedAudioAsset,
} from "../../services/audioStorage";
import { extractSharedAudioAssets } from "../../services/shareImport";
import { buildCollectionPathLabel } from "../../libraryNavigation";
import { getCollectionById } from "../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";

type ShareImportScreenProps = {
  fallbackCollectionId: string | null;
};

type CollectionDestination = {
  workspaceId: string;
  collectionId: string;
  workspaceTitle: string;
  collectionTitle: string;
  pathLabel: string;
};

function buildDefaultCollectionTitle(count: number) {
  return `Collection ${count + 1}`;
}

function buildImportedCollectionTitle(assets: ImportedAudioAsset[], collectionCount: number) {
  if (assets.length === 1) {
    return buildImportedTitle(assets[0]?.name);
  }

  return buildDefaultCollectionTitle(collectionCount);
}

function buildImportedProjectTitle(assets: ImportedAudioAsset[]) {
  return buildImportedTitle(assets[0]?.name);
}

export function ShareImportScreen({ fallbackCollectionId }: ShareImportScreenProps) {
  const navigation = useNavigation();
  const { shareIntent, hasShareIntent, resetShareIntent } = useShareIntentContext();
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const addCollection = useStore((s) => s.addCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const setActiveWorkspaceId = useStore((s) => s.setActiveWorkspaceId);
  const markCollectionOpened = useStore((s) => s.markCollectionOpened);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const currentCollectionWorkspace =
    fallbackCollectionId
      ? workspaces.find((workspace) => !!getCollectionById(workspace, fallbackCollectionId)) ?? null
      : null;
  const currentCollection =
    fallbackCollectionId && currentCollectionWorkspace
      ? getCollectionById(currentCollectionWorkspace, fallbackCollectionId)
      : null;
  const shareAssets = useMemo(() => extractSharedAudioAssets(shareIntent.files), [shareIntent.files]);
  const importedAssets = shareAssets.assets;
  const targetWorkspace =
    (currentCollection && workspaces.find((workspace) => workspace.id === currentCollection.workspaceId)) ??
    activeWorkspace ??
    workspaces[0] ??
    null;
  const topLevelCollectionCount = targetWorkspace
    ? targetWorkspace.collections.filter((collection) => !collection.parentCollectionId).length
    : 0;
  const [otherCollectionsExpanded, setOtherCollectionsExpanded] = useState(!currentCollection);
  const [newCollectionModalOpen, setNewCollectionModalOpen] = useState(false);
  const [newCollectionDraft, setNewCollectionDraft] = useState("");
  const [projectTitleModalOpen, setProjectTitleModalOpen] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [pendingCollectionDestination, setPendingCollectionDestination] = useState<CollectionDestination | null>(
    null
  );
  const [isImporting, setIsImporting] = useState(false);

  const otherCollectionDestinations = useMemo(() => {
    const currentWorkspace = activeWorkspaceId;

    return workspaces
      .flatMap((workspace) =>
        workspace.collections.map((collection) => ({
          workspaceId: workspace.id,
          collectionId: collection.id,
          workspaceTitle: workspace.title,
          collectionTitle: collection.title,
          pathLabel: buildCollectionPathLabel(workspace, collection.id),
        }))
      )
      .filter((destination) => destination.collectionId !== currentCollection?.id)
      .sort((a, b) => {
        const aCurrent = a.workspaceId === currentWorkspace ? 0 : 1;
        const bCurrent = b.workspaceId === currentWorkspace ? 0 : 1;
        return (
          aCurrent - bCurrent ||
          a.workspaceTitle.localeCompare(b.workspaceTitle) ||
          a.pathLabel.localeCompare(b.pathLabel)
        );
      });
  }, [activeWorkspaceId, currentCollection?.id, workspaces]);

  const closeScreen = () => {
    resetShareIntent();
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home" as never);
  };

  const finishToCollection = (workspaceId: string, collectionId: string) => {
    if (activeWorkspaceId !== workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
    markCollectionOpened(collectionId);
    resetShareIntent();
    (navigation as any).navigate("CollectionDetail", { collectionId });
  };

  const importIntoExistingCollection = async (
    destination: CollectionDestination,
    mode: "single-clip" | "individual-clips" | "song-project",
    projectTitle?: string
  ) => {
    if (importedAssets.length === 0 || isImporting) return;

    try {
      setIsImporting(true);

      if (mode === "single-clip") {
        const asset = importedAssets[0]!;
        const imported = await importAudioAsset(
          asset,
          `audio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        );
        appActions.importClipToCollection(destination.collectionId, {
          title: buildImportedTitle(asset.name),
          audioUri: imported.audioUri,
          durationMs: imported.durationMs,
          waveformPeaks: imported.waveformPeaks,
        });
        finishToCollection(destination.workspaceId, destination.collectionId);
        return;
      }

      const { imported, failed } = await importAudioAssets(
        importedAssets,
        (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`
      );

      if (imported.length === 0) {
        Alert.alert("Import failed", "None of the shared audio files could be imported.");
        return;
      }

      if (mode === "song-project") {
        appActions.importProjectToCollection(destination.collectionId, {
          title: projectTitle?.trim() || buildImportedProjectTitle(importedAssets),
          clips: imported.map((asset) => ({
            title: buildImportedTitle(asset.name),
            audioUri: asset.audioUri,
            durationMs: asset.durationMs,
            waveformPeaks: asset.waveformPeaks,
          })),
        });
      } else {
        imported.forEach((asset) => {
          appActions.importClipToCollection(destination.collectionId, {
            title: buildImportedTitle(asset.name),
            audioUri: asset.audioUri,
            durationMs: asset.durationMs,
            waveformPeaks: asset.waveformPeaks,
          });
        });
      }

      finishToCollection(destination.workspaceId, destination.collectionId);

      if (failed.length > 0) {
        Alert.alert(
          "Import finished with issues",
          `${imported.length} shared file${imported.length === 1 ? "" : "s"} imported. ${failed.length} file${failed.length === 1 ? "" : "s"} could not be imported.`
        );
      }
    } catch (error) {
      console.warn("Share import error", error);
      Alert.alert("Import failed", "Could not import the shared audio into that collection.");
    } finally {
      setIsImporting(false);
    }
  };

  const promptForCollectionImport = (destination: CollectionDestination) => {
    if (importedAssets.length <= 1) {
      void importIntoExistingCollection(destination, "single-clip");
      return;
    }

    Alert.alert(
      "Import from Share",
      `Choose how to add ${importedAssets.length} files into ${destination.collectionTitle}.`,
      [
        {
          text: "Import as individual clips",
          onPress: () => {
            void importIntoExistingCollection(destination, "individual-clips");
          },
        },
        {
          text: "Import as song project",
          onPress: () => {
            setPendingCollectionDestination(destination);
            setProjectTitleDraft("");
            setProjectTitleModalOpen(true);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const importIntoNewCollection = async () => {
    if (!targetWorkspace || importedAssets.length === 0 || isImporting) return;

    const title =
      newCollectionDraft.trim() ||
      buildImportedCollectionTitle(importedAssets, topLevelCollectionCount);
    const collectionId = addCollection(targetWorkspace.id, title, null);

    try {
      setIsImporting(true);
      const { imported, failed } = await importAudioAssets(
        importedAssets,
        (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`
      );

      if (imported.length === 0) {
        deleteCollection(collectionId);
        Alert.alert("Import failed", "None of the shared audio files could be imported.");
        return;
      }

      imported.forEach((asset) => {
        appActions.importClipToCollection(collectionId, {
          title: buildImportedTitle(asset.name),
          audioUri: asset.audioUri,
          durationMs: asset.durationMs,
          waveformPeaks: asset.waveformPeaks,
        });
      });

      setNewCollectionModalOpen(false);
      setNewCollectionDraft("");
      finishToCollection(targetWorkspace.id, collectionId);

      if (failed.length > 0) {
        Alert.alert(
          "Import finished with issues",
          `${imported.length} shared file${imported.length === 1 ? "" : "s"} imported into ${title}. ${failed.length} file${failed.length === 1 ? "" : "s"} could not be imported.`
        );
      }
    } catch (error) {
      console.warn("Share import new collection error", error);
      deleteCollection(collectionId);
      Alert.alert("Import failed", "Could not create a new collection from the shared audio.");
    } finally {
      setIsImporting(false);
    }
  };

  const previewNames = importedAssets.slice(0, 4).map((asset) => buildImportedTitle(asset.name));
  const unsupportedOnly = importedAssets.length === 0 && (shareIntent.files?.length ?? 0) > 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Import from Share" leftIcon="back" onLeftPress={closeScreen} />

      <PageIntro
        title="Import from Share"
        subtitle={
          importedAssets.length > 0
            ? `${importedAssets.length} audio file${importedAssets.length === 1 ? "" : "s"} ready to import`
            : hasShareIntent
              ? "Review the shared content and choose where it should go."
              : "There is no shared audio waiting to import."
        }
      />

      <ScrollView
        style={shareImportStyles.scroll}
        contentContainerStyle={shareImportStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard>
          <Text style={shareImportStyles.sectionTitle}>Incoming audio</Text>
          {importedAssets.length > 0 ? (
            <>
              {previewNames.map((name, index) => (
                <View key={`${name}-${index}`} style={shareImportStyles.previewRow}>
                  <Ionicons name="musical-notes-outline" size={14} color={colors.textSecondary} />
                  <Text style={shareImportStyles.previewText} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
              ))}
              {importedAssets.length > previewNames.length ? (
                <Text style={shareImportStyles.helperText}>
                  +{importedAssets.length - previewNames.length} more shared audio files
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={shareImportStyles.helperText}>
              {unsupportedOnly
                ? "Song Seed can import shared audio files, but the current share payload does not contain supported audio."
                : "Nothing is waiting to be imported right now."}
            </Text>
          )}
          {shareAssets.rejectedCount > 0 ? (
            <Text style={shareImportStyles.warningText}>
              {shareAssets.rejectedCount} shared item{shareAssets.rejectedCount === 1 ? "" : "s"} will be skipped because they are not supported audio files.
            </Text>
          ) : null}
        </SurfaceCard>

        {importedAssets.length > 0 ? (
          <>
            <SurfaceCard>
              <Text style={shareImportStyles.sectionTitle}>Destination</Text>
              {currentCollection ? (
                <NavRow
                  icon={getHierarchyIconName("collection")}
                  iconColor={getHierarchyIconColor("collection")}
                  label={currentCollection.title}
                  eyebrow="Current collection"
                  accessory={<Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                  onPress={() =>
                    promptForCollectionImport({
                      workspaceId: currentCollection.workspaceId,
                      collectionId: currentCollection.id,
                      workspaceTitle: currentCollectionWorkspace?.title ?? "Current workspace",
                      collectionTitle: currentCollection.title,
                      pathLabel:
                        currentCollectionWorkspace
                          ? buildCollectionPathLabel(currentCollectionWorkspace, currentCollection.id)
                          : currentCollection.title,
                    })
                  }
                />
              ) : (
                <Text style={shareImportStyles.helperText}>
                  No current collection is active, so choose another collection or create a new one.
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  shareImportStyles.toggleRow,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => setOtherCollectionsExpanded((prev) => !prev)}
              >
                <Text style={shareImportStyles.toggleLabel}>Another collection</Text>
                <Ionicons
                  name={otherCollectionsExpanded ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.textMuted}
                />
              </Pressable>

              {otherCollectionsExpanded ? (
                <View style={shareImportStyles.collectionList}>
                  {otherCollectionDestinations.map((destination) => (
                    <NavRow
                      key={`${destination.workspaceId}:${destination.collectionId}`}
                      icon={getHierarchyIconName("collection")}
                      iconColor={getHierarchyIconColor("collection")}
                      label={destination.pathLabel}
                      eyebrow={destination.workspaceTitle}
                      nested
                      accessory={<Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                      onPress={() => promptForCollectionImport(destination)}
                    />
                  ))}
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  shareImportStyles.newCollectionRow,
                  pressed ? styles.pressDown : null,
                  !targetWorkspace || isImporting ? styles.btnDisabled : null,
                ]}
                onPress={() => {
                  setNewCollectionDraft("");
                  setNewCollectionModalOpen(true);
                }}
                disabled={!targetWorkspace || isImporting}
              >
                <View style={shareImportStyles.newCollectionCopy}>
                  <Text style={shareImportStyles.newCollectionTitle}>New collection from import</Text>
                  <Text style={shareImportStyles.newCollectionMeta}>
                    {targetWorkspace
                      ? `Create it in ${targetWorkspace.title} and add the shared files there.`
                      : "No workspace is available for a new collection yet."}
                  </Text>
                </View>
                <Ionicons name="add" size={16} color={colors.textSecondary} />
              </Pressable>
            </SurfaceCard>

            <SurfaceCard>
              <Text style={shareImportStyles.sectionTitle}>Notes</Text>
              <Text style={shareImportStyles.helperText}>
                Multiple files into an existing collection can become individual clips or one new song project. New collection from import keeps the shared files as individual clips.
              </Text>
            </SurfaceCard>
          </>
        ) : null}
      </ScrollView>

      <QuickNameModal
        visible={newCollectionModalOpen}
        title="New Collection from Import"
        draftValue={newCollectionDraft}
        placeholderValue={buildImportedCollectionTitle(importedAssets, topLevelCollectionCount)}
        onChangeDraft={setNewCollectionDraft}
        onCancel={() => {
          if (isImporting) return;
          setNewCollectionModalOpen(false);
          setNewCollectionDraft("");
        }}
        onSave={() => {
          void importIntoNewCollection();
        }}
        helperText={`${importedAssets.length} shared audio file${importedAssets.length === 1 ? "" : "s"} will be placed in the new collection as individual clips.`}
        saveLabel={isImporting ? "Importing..." : "Create"}
        saveDisabled={isImporting || !targetWorkspace}
        cancelDisabled={isImporting}
      />

      <QuickNameModal
        visible={projectTitleModalOpen}
        title="Import as Song Project"
        draftValue={projectTitleDraft}
        placeholderValue={buildImportedProjectTitle(importedAssets)}
        onChangeDraft={setProjectTitleDraft}
        onCancel={() => {
          if (isImporting) return;
          setProjectTitleModalOpen(false);
          setProjectTitleDraft("");
          setPendingCollectionDestination(null);
        }}
        onSave={() => {
          if (!pendingCollectionDestination) return;
          setProjectTitleModalOpen(false);
          void importIntoExistingCollection(
            pendingCollectionDestination,
            "song-project",
            projectTitleDraft.trim() || buildImportedProjectTitle(importedAssets)
          );
          setPendingCollectionDestination(null);
          setProjectTitleDraft("");
        }}
        helperText={`Create one new song in ${pendingCollectionDestination?.collectionTitle ?? "this collection"} and add the shared files as takes.`}
        saveLabel={isImporting ? "Importing..." : "Import"}
        saveDisabled={isImporting}
        cancelDisabled={isImporting}
      />
    </SafeAreaView>
  );
}

const shareImportStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...textTokens.sectionTitle,
    marginBottom: 2,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 24,
  },
  previewText: {
    flex: 1,
    ...textTokens.body,
    color: colors.textStrong,
  },
  helperText: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
  warningText: {
    ...textTokens.supporting,
    color: "#b45309",
  },
  toggleRow: {
    minHeight: 42,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  toggleLabel: {
    ...textTokens.caption,
    color: colors.textStrong,
  },
  collectionList: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  newCollectionRow: {
    minHeight: 46,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  newCollectionCopy: {
    flex: 1,
    gap: 2,
  },
  newCollectionTitle: {
    ...textTokens.body,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  newCollectionMeta: {
    ...textTokens.supporting,
  },
});
