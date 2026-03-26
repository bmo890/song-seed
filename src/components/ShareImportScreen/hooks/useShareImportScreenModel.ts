import { useState } from "react";
import { Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useShareIntentContext } from "expo-share-intent";
import { useStore } from "../../../state/useStore";
import { appActions } from "../../../state/actions";
import { openCollectionAsBrowseRoot } from "../../../navigation";
import {
  buildImportedTitle,
  importAudioAsset,
  importAudioAssets,
  type ImportedAudioAsset,
} from "../../../services/audioStorage";
import { enqueueBackgroundWaveformHydration } from "../../../services/backgroundWaveformHydration";
import { useImportStore } from "../../../state/useImportStore";
import {
  getAllClips,
  checkImportDuplicates,
  showDuplicateReview,
} from "../../../services/importDuplicates";
import { ensureUniqueCountedTitle } from "../../../utils";
import {
  buildImportHelperText,
  buildImportedAssetDateMetadata,
  buildImportedIdeaDateMetadata,
  promptForImportDatePreference,
  type ImportDatePreference,
} from "../../../importDates";
import { useResolvedShareAssets } from "./useResolvedShareAssets";
import { useShareImportDestinations } from "./useShareImportDestinations";
import type { CollectionDestination, ShareImportScreenProps } from "../types";

function buildDefaultCollectionTitle(count: number) {
  return `Collection ${count + 1}`;
}

function buildImportedCollectionTitle(
  assets: ImportedAudioAsset[],
  collectionCount: number
) {
  if (assets.length === 1) {
    return buildImportedTitle(assets[0]?.name);
  }

  return buildDefaultCollectionTitle(collectionCount);
}

function buildImportedProjectTitle(assets: ImportedAudioAsset[]) {
  return buildImportedTitle(assets[0]?.name);
}

export function useShareImportScreenModel({
  fallbackCollectionId,
}: ShareImportScreenProps) {
  const navigation = useNavigation();
  const { shareIntent, hasShareIntent, resetShareIntent } = useShareIntentContext();
  const workspaces = useStore((s) => s.workspaces);
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const addCollection = useStore((s) => s.addCollection);
  const deleteCollection = useStore((s) => s.deleteCollection);
  const setActiveWorkspaceId = useStore((s) => s.setActiveWorkspaceId);
  const markCollectionOpened = useStore((s) => s.markCollectionOpened);
  const {
    activeWorkspace,
    currentCollectionWorkspace,
    currentCollection,
    targetWorkspace,
    topLevelCollectionCount,
    otherCollectionDestinations,
  } = useShareImportDestinations({
    workspaces,
    activeWorkspaceId,
    fallbackCollectionId,
  });
  const {
    shareAssets,
    importedAssets,
    previewNames,
    unsupportedOnly,
    isResolvingShareAssets,
  } = useResolvedShareAssets(shareIntent.files);
  const [importDatePreference, setImportDatePreference] =
    useState<ImportDatePreference>("import");
  const [otherCollectionsExpanded, setOtherCollectionsExpanded] = useState(
    !currentCollection
  );
  const [newCollectionModalOpen, setNewCollectionModalOpen] = useState(false);
  const [newCollectionDraft, setNewCollectionDraft] = useState("");
  const [projectTitleModalOpen, setProjectTitleModalOpen] = useState(false);
  const [projectTitleDraft, setProjectTitleDraft] = useState("");
  const [pendingCollectionDestination, setPendingCollectionDestination] =
    useState<CollectionDestination | null>(null);

  function closeScreen() {
    resetShareIntent();
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("Home" as never);
  }

  function finishToCollection(workspaceId: string, collectionId: string) {
    if (activeWorkspaceId !== workspaceId) {
      setActiveWorkspaceId(workspaceId);
    }
    markCollectionOpened(collectionId);
    resetShareIntent();
    openCollectionAsBrowseRoot(navigation, { collectionId });
  }

  async function resolveImportDatePreference(title: string) {
    setImportDatePreference("import");
    const nextPreference = await promptForImportDatePreference(importedAssets, title);
    if (!nextPreference) {
      return null;
    }

    setImportDatePreference(nextPreference);
    return nextPreference;
  }

  function getCollectionIdeaTitles(workspaceId: string, collectionId: string) {
    const workspace = workspaces.find((entry) => entry.id === workspaceId);
    return (
      workspace?.ideas
        .filter((idea) => idea.collectionId === collectionId)
        .map((idea) => idea.title) ?? []
    );
  }

  function importIntoExistingCollection(
    destination: CollectionDestination,
    mode: "single-clip" | "individual-clips" | "song-project",
    projectTitle?: string,
    datePreference: ImportDatePreference = importDatePreference
  ) {
    if (importedAssets.length === 0) return;

    const assetsIn = importedAssets;
    const baseTitles = getCollectionIdeaTitles(
      destination.workspaceId,
      destination.collectionId
    );

    function doImport(assets: ImportedAudioAsset[]) {
      if (assets.length === 0) return;

      const label =
        mode === "single-clip"
          ? buildImportedTitle(assets[0]!.name)
          : projectTitle?.trim() || buildImportedProjectTitle(assets);

      finishToCollection(destination.workspaceId, destination.collectionId);

      const jobId = `import-${Date.now()}`;
      useImportStore.getState().startJob({ id: jobId, label, total: assets.length });
      const nextTitles: string[] = [];

      void (async () => {
        try {
          const importedAt = Date.now();

          if (mode === "single-clip") {
            const asset = assets[0]!;
            const imported = await importAudioAsset(
              asset,
              `audio-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
            );
            const [importedDate] = buildImportedAssetDateMetadata(
              [asset],
              datePreference,
              importedAt
            );
            const title = ensureUniqueCountedTitle(
              buildImportedTitle(asset.name),
              baseTitles
            );
            const importedResult = appActions.importClipToCollection(
              destination.collectionId,
              {
                title,
                audioUri: imported.audioUri,
                durationMs: imported.durationMs,
                waveformPeaks: imported.waveformPeaks,
                createdAt: importedDate!.createdAt,
                importedAt: importedDate!.importedAt,
                sourceCreatedAt: importedDate!.sourceCreatedAt,
              }
            );
            enqueueBackgroundWaveformHydration({
              workspaceId: destination.workspaceId,
              ideaId: importedResult.ideaId,
              clipId: importedResult.clipId,
              audioUri: imported.audioUri,
            });
            useImportStore.getState().updateJob(jobId, {
              current: 1,
              status: "done",
            });
            return;
          }

          const { imported, failed } = await importAudioAssets(
            assets,
            (_asset, index) =>
              `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
            (current, _total, failedCount) => {
              useImportStore.getState().updateJob(jobId, {
                current,
                failed: failedCount,
              });
            },
            {
              lightweight: true,
              onImported:
                mode === "song-project"
                  ? undefined
                  : (asset) => {
                      const [importedDate] = buildImportedAssetDateMetadata(
                        [asset],
                        datePreference,
                        importedAt
                      );
                      const title = ensureUniqueCountedTitle(
                        buildImportedTitle(asset.name),
                        nextTitles
                      );
                      nextTitles.push(title);
                      const importedResult = appActions.importClipToCollection(
                        destination.collectionId,
                        {
                          title,
                          audioUri: asset.audioUri,
                          durationMs: asset.durationMs,
                          waveformPeaks: asset.waveformPeaks,
                          createdAt: importedDate!.createdAt,
                          importedAt: importedDate!.importedAt,
                          sourceCreatedAt: importedDate!.sourceCreatedAt,
                        }
                      );
                      enqueueBackgroundWaveformHydration({
                        workspaceId: destination.workspaceId,
                        ideaId: importedResult.ideaId,
                        clipId: importedResult.clipId,
                        audioUri: asset.audioUri,
                      });
                    },
            }
          );

          if (imported.length === 0) {
            useImportStore.getState().updateJob(jobId, { status: "error" });
            return;
          }

          if (mode === "song-project") {
            const importedDates = buildImportedAssetDateMetadata(
              imported,
              datePreference,
              importedAt
            );
            const ideaDateMetadata = buildImportedIdeaDateMetadata(importedDates);
            const projectClipTitles: string[] = [];
            const importedProject = appActions.importProjectToCollection(
              destination.collectionId,
              {
                title: projectTitle?.trim() || buildImportedProjectTitle(assets),
                createdAt: ideaDateMetadata.createdAt,
                importedAt: ideaDateMetadata.importedAt,
                sourceCreatedAt: ideaDateMetadata.sourceCreatedAt,
                clips: imported.map((asset, index) => ({
                  title: (() => {
                    const nextTitle = ensureUniqueCountedTitle(
                      buildImportedTitle(asset.name),
                      projectClipTitles
                    );
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
              }
            );
            imported.forEach((asset, index) => {
              const clipId = importedProject.clipIds[index];
              if (!clipId || !asset.audioUri) return;
              enqueueBackgroundWaveformHydration({
                workspaceId: destination.workspaceId,
                ideaId: importedProject.ideaId,
                clipId,
                audioUri: asset.audioUri,
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
    }

    const duplicateResult = checkImportDuplicates(assetsIn, getAllClips());

    if (duplicateResult.hasDuplicates) {
      showDuplicateReview(
        duplicateResult,
        () => doImport(duplicateResult.uniqueAssets),
        () => doImport(duplicateResult.allAssets)
      );
      return;
    }

    doImport(duplicateResult.allAssets);
  }

  async function promptForCollectionImport(destination: CollectionDestination) {
    if (isResolvingShareAssets) return;

    if (importedAssets.length <= 1) {
      const datePreference = await resolveImportDatePreference("Import from Share");
      if (!datePreference) return;
      importIntoExistingCollection(
        destination,
        "single-clip",
        undefined,
        datePreference
      );
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
              const datePreference = await resolveImportDatePreference(
                "Import from Share"
              );
              if (!datePreference) return;
              importIntoExistingCollection(
                destination,
                "individual-clips",
                undefined,
                datePreference
              );
            })();
          },
        },
        {
          text: "Import as song project",
          onPress: () => {
            void (async () => {
              const datePreference = await resolveImportDatePreference(
                "Import as Song Project"
              );
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
  }

  function importIntoNewCollection() {
    if (!targetWorkspace || importedAssets.length === 0) return;

    const assetsIn = importedAssets;
    const workspaceSnapshot = targetWorkspace;
    const datePreferenceSnapshot = importDatePreference;
    const draftSnapshot = newCollectionDraft;

    function doImport(assets: ImportedAudioAsset[]) {
      if (assets.length === 0) return;

      const label =
        draftSnapshot.trim() ||
        buildImportedCollectionTitle(assets, topLevelCollectionCount);

      const collectionId = addCollection(workspaceSnapshot.id, label, null);
      setNewCollectionModalOpen(false);
      setNewCollectionDraft("");
      finishToCollection(workspaceSnapshot.id, collectionId);

      const jobId = `import-${Date.now()}`;
      useImportStore.getState().startJob({ id: jobId, label, total: assets.length });
      const nextTitles: string[] = [];

      void (async () => {
        try {
          const importedAt = Date.now();
          const { imported, failed } = await importAudioAssets(
            assets,
            (_asset, index) =>
              `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
            (current, _total, failedCount) => {
              useImportStore.getState().updateJob(jobId, {
                current,
                failed: failedCount,
              });
            },
            {
              lightweight: true,
              onImported: (asset) => {
                const [importedDate] = buildImportedAssetDateMetadata(
                  [asset],
                  datePreferenceSnapshot,
                  importedAt
                );
                const clipTitle = ensureUniqueCountedTitle(
                  buildImportedTitle(asset.name),
                  nextTitles
                );
                nextTitles.push(clipTitle);
                const importedResult = appActions.importClipToCollection(collectionId, {
                  title: clipTitle,
                  audioUri: asset.audioUri,
                  durationMs: asset.durationMs,
                  waveformPeaks: asset.waveformPeaks,
                  createdAt: importedDate!.createdAt,
                  importedAt: importedDate!.importedAt,
                  sourceCreatedAt: importedDate!.sourceCreatedAt,
                });
                enqueueBackgroundWaveformHydration({
                  workspaceId: workspaceSnapshot.id,
                  ideaId: importedResult.ideaId,
                  clipId: importedResult.clipId,
                  audioUri: asset.audioUri,
                });
              },
            }
          );

          if (imported.length === 0) {
            deleteCollection(collectionId);
            useImportStore.getState().updateJob(jobId, { status: "error" });
            return;
          }

          useImportStore.getState().updateJob(jobId, {
            current: imported.length,
            failed: failed.length,
            status: failed.length === assets.length ? "error" : "done",
          });
        } catch (error) {
          console.warn("Share import new collection error", error);
          deleteCollection(collectionId);
          useImportStore.getState().updateJob(jobId, { status: "error" });
        } finally {
          setTimeout(() => useImportStore.getState().removeJob(jobId), 2500);
        }
      })();
    }

    const duplicateResult = checkImportDuplicates(assetsIn, getAllClips());

    if (duplicateResult.hasDuplicates) {
      showDuplicateReview(
        duplicateResult,
        () => doImport(duplicateResult.uniqueAssets),
        () => doImport(duplicateResult.allAssets)
      );
      return;
    }

    doImport(duplicateResult.allAssets);
  }

  return {
    hasShareIntent,
    shareAssets,
    importedAssets,
    previewNames,
    unsupportedOnly,
    isResolvingShareAssets,
    importDatePreference,
    currentCollection,
    currentCollectionWorkspace,
    otherCollectionsExpanded,
    setOtherCollectionsExpanded,
    otherCollectionDestinations,
    targetWorkspace,
    topLevelCollectionCount,
    newCollectionModalOpen,
    setNewCollectionModalOpen,
    newCollectionDraft,
    setNewCollectionDraft,
    projectTitleModalOpen,
    setProjectTitleModalOpen,
    projectTitleDraft,
    setProjectTitleDraft,
    pendingCollectionDestination,
    setPendingCollectionDestination,
    closeScreen,
    promptForCollectionImport,
    resolveImportDatePreference,
    importIntoNewCollection,
    buildImportedCollectionTitle,
    buildImportedProjectTitle,
    buildImportHelperText,
    importIntoExistingCollection,
  };
}
