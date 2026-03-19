import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { styles } from "../../styles";
import { colors, radii, spacing, text as textTokens } from "../../design/tokens";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { openCollectionAsBrowseRoot } from "../../navigation";
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
import { useImportStore } from "../../state/useImportStore";
import { extractSharedAudioAssets } from "../../services/shareImport";
import { buildCollectionPathLabel } from "../../libraryNavigation";
import { ensureUniqueCountedTitle, getCollectionById } from "../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";
import {
  buildImportHelperText,
  buildImportedAssetDateMetadata,
  buildImportedIdeaDateMetadata,
  promptForImportDatePreference,
  type ImportDatePreference,
} from "../../importDates";

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
  const [shareAssets, setShareAssets] = useState<{ assets: ImportedAudioAsset[]; rejectedCount: number }>({
    assets: [],
    rejectedCount: 0,
  });
  const [isResolvingShareAssets, setIsResolvingShareAssets] = useState(false);
  const [importDatePreference, setImportDatePreference] = useState<ImportDatePreference>("import");
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

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setImportDatePreference("import");

      if (!shareIntent.files?.length) {
        setShareAssets({ assets: [], rejectedCount: 0 });
        setIsResolvingShareAssets(false);
        return;
      }

      setIsResolvingShareAssets(true);
      try {
        const nextShareAssets = await extractSharedAudioAssets(shareIntent.files);
        if (!cancelled) {
          setShareAssets(nextShareAssets);
        }
      } finally {
        if (!cancelled) {
          setIsResolvingShareAssets(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [shareIntent.files]);

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
    openCollectionAsBrowseRoot(navigation, { collectionId });
  };

  const resolveImportDatePreference = async (title: string) => {
    const nextPreference = await promptForImportDatePreference(importedAssets, title);
    if (!nextPreference) {
      return null;
    }

    setImportDatePreference(nextPreference);
    return nextPreference;
  };

  const getCollectionIdeaTitles = (workspaceId: string, collectionId: string) => {
    const workspace = workspaces.find((entry) => entry.id === workspaceId);
    return workspace?.ideas.filter((idea) => idea.collectionId === collectionId).map((idea) => idea.title) ?? [];
  };

  const importIntoExistingCollection = (
    destination: CollectionDestination,
    mode: "single-clip" | "individual-clips" | "song-project",
    projectTitle?: string,
    datePreference: ImportDatePreference = importDatePreference
  ) => {
    if (importedAssets.length === 0) return;

    const assetsSnapshot = importedAssets;
    const label =
      mode === "single-clip"
        ? buildImportedTitle(assetsSnapshot[0]!.name)
        : projectTitle?.trim() || buildImportedProjectTitle(assetsSnapshot);
    const baseTitles = getCollectionIdeaTitles(destination.workspaceId, destination.collectionId);

    // Navigate away immediately
    finishToCollection(destination.workspaceId, destination.collectionId);

    const jobId = `import-${Date.now()}`;
    useImportStore.getState().startJob({ id: jobId, label, total: assetsSnapshot.length });

    void (async () => {
      try {
        const importedAt = Date.now();

        if (mode === "single-clip") {
          const asset = assetsSnapshot[0]!;
          const imported = await importAudioAsset(
            asset,
            `audio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
          );
          const [importedDate] = buildImportedAssetDateMetadata([asset], datePreference, importedAt);
          const title = ensureUniqueCountedTitle(buildImportedTitle(asset.name), baseTitles);
          appActions.importClipToCollection(destination.collectionId, {
            title,
            audioUri: imported.audioUri,
            durationMs: imported.durationMs,
            waveformPeaks: imported.waveformPeaks,
            createdAt: importedDate!.createdAt,
            importedAt: importedDate!.importedAt,
            sourceCreatedAt: importedDate!.sourceCreatedAt,
          });
          useImportStore.getState().updateJob(jobId, { current: 1, status: "done" });
          return;
        }

        const { imported, failed } = await importAudioAssets(
          assetsSnapshot,
          (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
          (current, total, failedCount) => {
            useImportStore.getState().updateJob(jobId, { current, failed: failedCount });
          }
        );

        if (imported.length === 0) {
          useImportStore.getState().updateJob(jobId, { status: "error" });
          return;
        }

        const importedDates = buildImportedAssetDateMetadata(imported, datePreference, importedAt);

        if (mode === "song-project") {
          const ideaDateMetadata = buildImportedIdeaDateMetadata(importedDates);
          const projectClipTitles: string[] = [];
          appActions.importProjectToCollection(destination.collectionId, {
            title: projectTitle?.trim() || buildImportedProjectTitle(assetsSnapshot),
            createdAt: ideaDateMetadata.createdAt,
            importedAt: ideaDateMetadata.importedAt,
            sourceCreatedAt: ideaDateMetadata.sourceCreatedAt,
            clips: imported.map((asset, index) => ({
              title: (() => {
                const nextTitle = ensureUniqueCountedTitle(buildImportedTitle(asset.name), projectClipTitles);
                projectClipTitles.push(nextTitle);
                return nextTitle;
              })(),
              audioUri: asset.audioUri,
              durationMs: asset.durationMs,
              waveformPeaks: asset.waveformPeaks,
              createdAt: importedDates[index]!.createdAt,
              importedAt: importedDates[index]!.importedAt,
              sourceCreatedAt: importedDates[index]!.sourceCreatedAt,
            })),
          });
        } else {
          const nextTitles = [...baseTitles];
          imported.forEach((asset, index) => {
            const importedDate = importedDates[index]!;
            const title = ensureUniqueCountedTitle(buildImportedTitle(asset.name), nextTitles);
            nextTitles.push(title);
            appActions.importClipToCollection(destination.collectionId, {
              title,
              audioUri: asset.audioUri,
              durationMs: asset.durationMs,
              waveformPeaks: asset.waveformPeaks,
              createdAt: importedDate.createdAt,
              importedAt: importedDate.importedAt,
              sourceCreatedAt: importedDate.sourceCreatedAt,
            });
          });
        }

        useImportStore.getState().updateJob(jobId, {
          current: imported.length,
          failed: failed.length,
          status: "done",
        });
      } catch (error) {
        console.warn("Share import error", error);
        useImportStore.getState().updateJob(jobId, { status: "error" });
      } finally {
        setTimeout(() => useImportStore.getState().removeJob(jobId), 2500);
      }
    })();
  };

  const promptForCollectionImport = async (destination: CollectionDestination) => {
    if (isResolvingShareAssets) return;

    if (importedAssets.length <= 1) {
      const datePreference = await resolveImportDatePreference("Import from Share");
      if (!datePreference) return;
      void importIntoExistingCollection(destination, "single-clip", undefined, datePreference);
      return;
    }

    Alert.alert(
      "Import from Share",
      `Choose how to add ${importedAssets.length} files into ${destination.collectionTitle}.`,
      [
        {
          text: "Import as individual clips",
          onPress: () => {
            void (async () => {
              const datePreference = await resolveImportDatePreference("Import from Share");
              if (!datePreference) return;
              await importIntoExistingCollection(destination, "individual-clips", undefined, datePreference);
            })();
          },
        },
        {
          text: "Import as song project",
          onPress: () => {
            void (async () => {
              const datePreference = await resolveImportDatePreference("Import as Song Project");
              if (!datePreference) return;
              setPendingCollectionDestination(destination);
              setProjectTitleDraft("");
              setProjectTitleModalOpen(true);
            })();
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const importIntoNewCollection = () => {
    if (!targetWorkspace || importedAssets.length === 0) return;

    const assetsSnapshot = importedAssets;
    const workspaceSnapshot = targetWorkspace;
    const datePreferenceSnapshot = importDatePreference;
    const label =
      newCollectionDraft.trim() ||
      buildImportedCollectionTitle(assetsSnapshot, topLevelCollectionCount);

    // Create collection, close modal, and navigate immediately
    const collectionId = addCollection(workspaceSnapshot.id, label, null);
    setNewCollectionModalOpen(false);
    setNewCollectionDraft("");
    finishToCollection(workspaceSnapshot.id, collectionId);

    const jobId = `import-${Date.now()}`;
    useImportStore.getState().startJob({ id: jobId, label, total: assetsSnapshot.length });

    void (async () => {
      try {
        const importedAt = Date.now();
        const { imported, failed } = await importAudioAssets(
          assetsSnapshot,
          (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
          (current, total, failedCount) => {
            useImportStore.getState().updateJob(jobId, { current, failed: failedCount });
          }
        );

        if (imported.length === 0) {
          deleteCollection(collectionId);
          useImportStore.getState().updateJob(jobId, { status: "error" });
          return;
        }

        const importedDates = buildImportedAssetDateMetadata(imported, datePreferenceSnapshot, importedAt);
        const nextTitles: string[] = [];

        imported.forEach((asset, index) => {
          const importedDate = importedDates[index]!;
          const clipTitle = ensureUniqueCountedTitle(buildImportedTitle(asset.name), nextTitles);
          nextTitles.push(clipTitle);
          appActions.importClipToCollection(collectionId, {
            title: clipTitle,
            audioUri: asset.audioUri,
            durationMs: asset.durationMs,
            waveformPeaks: asset.waveformPeaks,
            createdAt: importedDate.createdAt,
            importedAt: importedDate.importedAt,
            sourceCreatedAt: importedDate.sourceCreatedAt,
          });
        });

        useImportStore.getState().updateJob(jobId, {
          current: imported.length,
          failed: failed.length,
          status: failed.length === assetsSnapshot.length ? "error" : "done",
        });
      } catch (error) {
        console.warn("Share import new collection error", error);
        deleteCollection(collectionId);
        useImportStore.getState().updateJob(jobId, { status: "error" });
      } finally {
        setTimeout(() => useImportStore.getState().removeJob(jobId), 2500);
      }
    })();
  };

  const previewNames = importedAssets.slice(0, 4).map((asset) => buildImportedTitle(asset.name));
  const unsupportedOnly =
    !isResolvingShareAssets && importedAssets.length === 0 && (shareIntent.files?.length ?? 0) > 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Import from Share" leftIcon="back" onLeftPress={closeScreen} />

      <PageIntro
        title="Import from Share"
        subtitle={
          isResolvingShareAssets
            ? "Preparing the shared audio before import."
            : importedAssets.length > 0
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
              {isResolvingShareAssets
                ? "Preparing the shared audio so Song Seed can import it."
                : unsupportedOnly
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
                  onPress={() => {
                    void promptForCollectionImport({
                      workspaceId: currentCollection.workspaceId,
                      collectionId: currentCollection.id,
                      workspaceTitle: currentCollectionWorkspace?.title ?? "Current workspace",
                      collectionTitle: currentCollection.title,
                      pathLabel:
                        currentCollectionWorkspace
                          ? buildCollectionPathLabel(currentCollectionWorkspace, currentCollection.id)
                          : currentCollection.title,
                    });
                  }}
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
                      onPress={() => {
                        void promptForCollectionImport(destination);
                      }}
                    />
                  ))}
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  shareImportStyles.newCollectionRow,
                  pressed ? styles.pressDown : null,
                  !targetWorkspace || isResolvingShareAssets ? styles.btnDisabled : null,
                ]}
                onPress={() => {
                  void (async () => {
                    const datePreference = await resolveImportDatePreference("New Collection from Import");
                    if (!datePreference) return;
                    setNewCollectionDraft("");
                    setNewCollectionModalOpen(true);
                  })();
                }}
                disabled={!targetWorkspace || isResolvingShareAssets}
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
          setNewCollectionModalOpen(false);
          setNewCollectionDraft("");
        }}
        onSave={() => {
          importIntoNewCollection();
        }}
        helperText={buildImportHelperText(
          `${importedAssets.length} shared audio file${importedAssets.length === 1 ? "" : "s"} will be placed in the new collection as individual clips.`,
          importedAssets,
          importDatePreference
        )}
        saveLabel="Create"
        saveDisabled={!targetWorkspace}
        cancelDisabled={false}
      />

      <QuickNameModal
        visible={projectTitleModalOpen}
        title="Import as Song Project"
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
          `Create one new song in ${pendingCollectionDestination?.collectionTitle ?? "this collection"} and add the shared files as takes.`,
          importedAssets,
          importDatePreference
        )}
        saveLabel="Import"
        saveDisabled={false}
        cancelDisabled={false}
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
