import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { AppAlert } from "../common/AppAlert";
import { ScreenHeader } from "../common/ScreenHeader";
import { PageIntro } from "../common/PageIntro";
import { SearchField } from "../common/SearchField";
import { SurfaceCard } from "../common/SurfaceCard";
import { QuickNameModal } from "../modals/QuickNameModal";
import { CollectionMoveModal } from "../modals/CollectionMoveModal";
import { CollectionActionsModal } from "../modals/CollectionActionsModal";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../common/SelectionDock";
import { buildCollectionMoveDestinations, getCollectionDeleteScope } from "../../collectionManagement";
import { getCollectionSizeBytes, formatBytes } from "../../utils";
import { ensureUniqueCountedTitle } from "../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";
import {
  buildImportedTitle,
  importAudioAssets,
  pickAudioFiles,
  type ImportedAudioAsset,
} from "../../services/audioStorage";
import { enqueueBackgroundWaveformHydration } from "../../services/backgroundWaveformHydration";
import { useImportStore } from "../../state/useImportStore";
import { getAllClips, checkImportDuplicates, showDuplicateReview } from "../../services/importDuplicates";
import {
  buildWorkspaceBrowseEntries,
  type CollectionSearchMatchKind,
} from "../../libraryNavigation";
import { openCollectionInBrowse } from "../../navigation";
import {
  buildImportHelperText,
  buildImportedAssetDateMetadata,
  promptForImportDatePreference,
  type ImportDatePreference,
} from "../../importDates";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";

function buildDefaultCollectionTitle(count: number) {
  return `Collection ${count + 1}`;
}

function buildImportedCollectionTitle(assets: ImportedAudioAsset[], collectionCount: number) {
  if (assets.length === 1) {
    return buildImportedTitle(assets[0]?.name);
  }

  return buildDefaultCollectionTitle(collectionCount);
}

function collapseSelectedCollectionIds(
  collections: Array<{ id: string; parentCollectionId?: string | null }>,
  selectedIds: string[]
) {
  const selectedIdSet = new Set(selectedIds);
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]));

  return selectedIds.filter((id) => {
    let cursor = collectionMap.get(id)?.parentCollectionId ?? null;
    while (cursor) {
      if (selectedIdSet.has(cursor)) {
        return false;
      }
      cursor = collectionMap.get(cursor)?.parentCollectionId ?? null;
    }
    return true;
  });
}

export function WorkspaceBrowseScreen() {
  const navigation = useNavigation();

  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const addCollection = useStore((state) => state.addCollection);
  const updateCollection = useStore((state) => state.updateCollection);
  const moveCollection = useStore((state) => state.moveCollection);
  const deleteCollection = useStore((state) => state.deleteCollection);
  const markCollectionOpened = useStore((state) => state.markCollectionOpened);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const topLevelCollections = useMemo(
    () =>
      (activeWorkspace?.collections ?? []).filter(
        (collection) => !collection.parentCollectionId
      ),
    [activeWorkspace?.collections]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [importCollectionModalOpen, setImportCollectionModalOpen] = useState(false);
  const [importCollectionAssets, setImportCollectionAssets] = useState<ImportedAudioAsset[]>([]);
  const [importCollectionDatePreference, setImportCollectionDatePreference] = useState<ImportDatePreference>("import");
  const [importCollectionDraft, setImportCollectionDraft] = useState("");
  const [sizeMap, setSizeMap] = useState<Record<string, number>>({});
  const [managedCollectionId, setManagedCollectionId] = useState<string | null>(null);
  const [collectionActionsOpen, setCollectionActionsOpen] = useState(false);
  const [collectionRenameModalOpen, setCollectionRenameModalOpen] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState("");
  const [collectionDestinationMode, setCollectionDestinationMode] = useState<"move" | "copy" | null>(null);
  const [destinationCollectionIds, setDestinationCollectionIds] = useState<string[]>([]);
  const [selectedMoveWorkspaceId, setSelectedMoveWorkspaceId] = useState<string | null>(null);
  const [selectedMoveParentCollectionId, setSelectedMoveParentCollectionId] = useState<string | null>(null);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [selectionMoreVisible, setSelectionMoreVisible] = useState(false);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);

  useEffect(() => {
    const unsubscribe = (navigation as any).addListener?.("blur", () => {
      setSelectedCollectionIds([]);
      setSelectionMoreVisible(false);
    });
    return unsubscribe;
  }, [navigation]);

  const collectionEntries = useMemo(
    () => (activeWorkspace ? buildWorkspaceBrowseEntries(activeWorkspace, searchQuery) : []),
    [activeWorkspace, searchQuery]
  );
  const selectionMode = selectedCollectionIds.length > 0;
  const selectableCollectionIds = useMemo(
    () => collectionEntries.map((entry) => entry.collection.id),
    [collectionEntries]
  );
  const collapsedSelectedCollectionIds = useMemo(
    () => collapseSelectedCollectionIds(activeWorkspace?.collections ?? [], selectedCollectionIds),
    [activeWorkspace?.collections, selectedCollectionIds]
  );
  const selectedCollections = useMemo(
    () =>
      (activeWorkspace?.collections ?? []).filter((collection) =>
        collapsedSelectedCollectionIds.includes(collection.id)
      ),
    [activeWorkspace?.collections, collapsedSelectedCollectionIds]
  );
  const managedCollection =
    activeWorkspace?.collections.find((collection) => collection.id === managedCollectionId) ?? null;
  const destinationAnchorCollection = managedCollection ?? selectedCollections[0] ?? null;
  const moveDestinations = useMemo(
    () => buildCollectionMoveDestinations(workspaces, destinationAnchorCollection, activeWorkspaceId),
    [activeWorkspaceId, destinationAnchorCollection, workspaces]
  );
  const allSelectableSelected =
    selectableCollectionIds.length > 0 &&
    selectableCollectionIds.every((id) => selectedCollectionIds.includes(id));
  const canDeselectAll =
    allSelectableSelected || (selectableCollectionIds.length === 0 && selectedCollectionIds.length > 0);
  const singleSelectedCollection =
    selectedCollections.length === 1 ? selectedCollections[0] ?? null : null;

  useBrowseRootBackHandler({
    onBack: () => {
      if (selectedCollectionIds.length > 0) {
        setSelectedCollectionIds([]);
        setSelectionMoreVisible(false);
        return;
      }
      (navigation as any).navigate?.("Workspaces");
    },
  });

  useEffect(() => {
    if (!collectionDestinationMode) return;
    const firstDestination = moveDestinations[0] ?? null;
    setSelectedMoveWorkspaceId(firstDestination?.workspaceId ?? null);
    setSelectedMoveParentCollectionId(firstDestination?.parentCollectionId ?? null);
  }, [collectionDestinationMode, moveDestinations]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!activeWorkspace) return;
      const entries = await Promise.all(
        topLevelCollections.map(async (collection) => [
          collection.id,
          await getCollectionSizeBytes(activeWorkspace, collection.id),
        ] as const)
      );

      if (cancelled) return;
      setSizeMap((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const [collectionId, bytes] of entries) {
          if (next[collectionId] !== bytes) {
            next[collectionId] = bytes;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace, topLevelCollections]);

  if (!activeWorkspace) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScreenHeader title="Browse" leftIcon="hamburger" />
        <Text style={styles.subtitle}>Choose a workspace to browse its collections.</Text>
      </SafeAreaView>
    );
  }

  const openCollectionActions = (targetCollectionId: string) => {
    setManagedCollectionId(targetCollectionId);
    setCollectionActionsOpen(true);
  };

  const openRenameCollection = () => {
    if (!managedCollection) return;
    setCollectionActionsOpen(false);
    setCollectionDraft(managedCollection.title);
    setCollectionRenameModalOpen(true);
  };

  const openCollectionDestination = (mode: "move" | "copy", collectionIds: string[]) => {
    if (collectionIds.length === 0) return;
    setCollectionActionsOpen(false);
    if (moveDestinations.length === 0) {
      Alert.alert(
        mode === "copy" ? "No copy targets" : "No move targets",
        "There are no valid collection destinations available right now."
      );
      return;
    }
    setDestinationCollectionIds(collectionIds);
    setCollectionDestinationMode(mode);
  };

  const openMoveCollection = () => {
    if (!managedCollection) return;
    openCollectionDestination("move", [managedCollection.id]);
  };

  const openCopyCollection = () => {
    if (!managedCollection) return;
    openCollectionDestination("copy", [managedCollection.id]);
  };

  const confirmDeleteCollection = () => {
    if (!activeWorkspace || !managedCollection) return;
    const { childCollectionCount, itemCount } = getCollectionDeleteScope(activeWorkspace, managedCollection.id);
    setCollectionActionsOpen(false);
    AppAlert.destructive(
      "Delete collection?",
      `${managedCollection.title} will be removed${childCollectionCount > 0 ? ` along with ${childCollectionCount} subcollection${childCollectionCount === 1 ? "" : "s"}` : ""} and ${itemCount} item${itemCount === 1 ? "" : "s"}.`,
      () => {
        deleteCollection(managedCollection.id);
        setManagedCollectionId(null);
      }
    );
  };

  const submitCollectionDestination = () => {
    if (!selectedMoveWorkspaceId || !collectionDestinationMode) return;

    const collectionIds = destinationCollectionIds.length > 0
      ? collapseSelectedCollectionIds(activeWorkspace.collections, destinationCollectionIds)
      : managedCollection
        ? [managedCollection.id]
        : [];

    for (const collectionId of collectionIds) {
      const result =
        collectionDestinationMode === "move"
          ? moveCollection(collectionId, selectedMoveWorkspaceId, selectedMoveParentCollectionId)
          : appActions.copyCollection(collectionId, selectedMoveWorkspaceId, selectedMoveParentCollectionId);

      if (!result.ok) {
        Alert.alert(
          collectionDestinationMode === "move" ? "Move failed" : "Copy failed",
          result.error ?? `Could not ${collectionDestinationMode} this collection.`
        );
        return;
      }
    }

    setCollectionDestinationMode(null);
    setDestinationCollectionIds([]);
    setManagedCollectionId(null);
    setSelectedCollectionIds([]);
  };

  const confirmDeleteSelectedCollections = () => {
    if (!activeWorkspace || collapsedSelectedCollectionIds.length === 0) return;

    const scope = collapsedSelectedCollectionIds.reduce(
      (summary, collectionId) => {
        const next = getCollectionDeleteScope(activeWorkspace, collectionId);
        return {
          childCollectionCount: summary.childCollectionCount + next.childCollectionCount,
          itemCount: summary.itemCount + next.itemCount,
        };
      },
      { childCollectionCount: 0, itemCount: 0 }
    );

    Alert.alert(
      "Delete collections?",
      `${collapsedSelectedCollectionIds.length} collection${collapsedSelectedCollectionIds.length === 1 ? "" : "s"} will be removed${scope.childCollectionCount > 0 ? ` along with ${scope.childCollectionCount} subcollection${scope.childCollectionCount === 1 ? "" : "s"}` : ""} and ${scope.itemCount} item${scope.itemCount === 1 ? "" : "s"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            for (const collectionId of collapsedSelectedCollectionIds) {
              deleteCollection(collectionId);
            }
            setSelectedCollectionIds([]);
            setSelectionMoreVisible(false);
          },
        },
      ]
    );
  };

  const selectionDockActions: SelectionAction[] =
    singleSelectedCollection
      ? [
          {
            key: "rename",
            label: "Rename",
            icon: "create-outline",
            onPress: () => {
              setManagedCollectionId(singleSelectedCollection.id);
              setCollectionDraft(singleSelectedCollection.title);
              setCollectionRenameModalOpen(true);
            },
          },
          {
            key: "copy",
            label: "Copy",
            icon: "copy-outline",
            onPress: () => openCollectionDestination("copy", collapsedSelectedCollectionIds),
          },
          {
            key: "move",
            label: "Move",
            icon: "swap-horizontal-outline",
            onPress: () => openCollectionDestination("move", collapsedSelectedCollectionIds),
          },
          {
            key: "more",
            label: "More",
            icon: "ellipsis-horizontal",
            onPress: () => setSelectionMoreVisible(true),
          },
        ]
      : [
          {
            key: "copy",
            label: "Copy",
            icon: "copy-outline",
            onPress: () => openCollectionDestination("copy", collapsedSelectedCollectionIds),
          },
          {
            key: "move",
            label: "Move",
            icon: "swap-horizontal-outline",
            onPress: () => openCollectionDestination("move", collapsedSelectedCollectionIds),
          },
          {
            key: "more",
            label: "More",
            icon: "ellipsis-horizontal",
            onPress: () => setSelectionMoreVisible(true),
          },
        ];

  const selectionSheetActions: SelectionAction[] = [
    {
      key: "select-all",
      label: canDeselectAll ? "Deselect all" : "Select all",
      icon: canDeselectAll ? "remove-circle-outline" : "checkmark-circle-outline",
      onPress: () => setSelectedCollectionIds(canDeselectAll ? [] : selectableCollectionIds),
      disabled: !canDeselectAll && selectableCollectionIds.length === 0,
    },
    {
      key: "delete",
      label: "Delete",
      icon: "trash-outline",
      tone: "danger",
      onPress: confirmDeleteSelectedCollections,
    },
  ];

  const openAddCollectionFlow = () => {
    Alert.alert("Add collection", "Choose how to start this collection.", [
      {
        text: "New Collection",
        onPress: () => {
          setDraftTitle("");
          setModalOpen(true);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openCollectionImportFlow = async () => {
    const assets = await pickAudioFiles({ multiple: true });
    if (assets.length === 0) return;
    const datePreference = await promptForImportDatePreference(assets, "New collection from import");
    if (!datePreference) return;

    setImportCollectionAssets(assets);
    setImportCollectionDatePreference(datePreference);
    setImportCollectionDraft("");
    setImportCollectionModalOpen(true);
  };

  const resetImportCollectionModal = () => {
    setImportCollectionModalOpen(false);
    setImportCollectionAssets([]);
    setImportCollectionDatePreference("import");
    setImportCollectionDraft("");
  };

  const saveImportedCollection = () => {
    if (!activeWorkspaceId || importCollectionAssets.length === 0) return;

    const assetsSnapshot = importCollectionAssets;
    const datePreferenceSnapshot = importCollectionDatePreference;
    const draftSnapshot = importCollectionDraft;
    const workspaceIdSnapshot = activeWorkspaceId;

    function doImport(assets: ImportedAudioAsset[]) {
      if (assets.length === 0) return;

      const label =
        draftSnapshot.trim() ||
        buildImportedCollectionTitle(assets, topLevelCollections.length);

      // Create the collection and navigate immediately
      const collectionId = addCollection(workspaceIdSnapshot, label, null);
      resetImportCollectionModal();
      openCollectionInBrowse(navigation, { collectionId });

      const jobId = `import-${Date.now()}`;
      useImportStore.getState().startJob({ id: jobId, label, total: assets.length });
      const nextTitles: string[] = [];

      void (async () => {
        try {
          const importedAt = Date.now();
          const { imported, failed } = await importAudioAssets(
            assets,
            (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
            (current, total, failedCount) => {
              useImportStore.getState().updateJob(jobId, { current, failed: failedCount });
            },
            {
              lightweight: true,
              onImported: (asset) => {
                const [importedDate] = buildImportedAssetDateMetadata([asset], datePreferenceSnapshot, importedAt);
                const clipTitle = ensureUniqueCountedTitle(buildImportedTitle(asset.name), nextTitles);
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
                  workspaceId: workspaceIdSnapshot,
                  ideaId: importedResult.ideaId,
                  clipId: importedResult.clipId,
                  audioUri: asset.audioUri,
                });
              },
            }
          );

          // Data-loss guard: if nothing imported, remove the empty pre-created collection
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
          console.warn("Collection import error", error);
          // Data-loss guard: clean up the empty pre-created collection if the import errored
          deleteCollection(collectionId);
          useImportStore.getState().updateJob(jobId, { status: "error" });
        } finally {
          setTimeout(() => useImportStore.getState().removeJob(jobId), 2500);
        }
      })();
    }

    const duplicateResult = checkImportDuplicates(assetsSnapshot, getAllClips());

    if (duplicateResult.hasDuplicates) {
      showDuplicateReview(
        duplicateResult,
        () => doImport(duplicateResult.uniqueAssets),
        () => doImport(duplicateResult.allAssets)
      );
      return;
    }

    doImport(duplicateResult.allAssets);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Workspace" leftIcon="hamburger" />
      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={[
          styles.libraryScrollContent,
          {
            paddingBottom: selectionMode
              ? selectionDockHeight + 24 + Math.max(24, 12)
              : 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PageIntro
          title={activeWorkspace.title}
          subtitle="Browse collections by recent work, then move deeper into the workspace."
        />

        <SearchField
          value={searchQuery}
          placeholder="Search collections, songs, or clips..."
          onChangeText={setSearchQuery}
        />

        {!selectionMode ? (
          <View style={styles.inputRow}>
            <Pressable
              style={({ pressed }) => [styles.ideasHeaderSelectBtn, pressed ? styles.pressDown : null]}
              onPress={openAddCollectionFlow}
            >
              <Text style={styles.ideasHeaderSelectBtnText}>Add</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.listContent}>
          {collectionEntries.map((entry) => {
            const collection = entry.collection;
            const isSelected = selectedCollectionIds.includes(collection.id);
            return (
              <SurfaceCard
                key={collection.id}
                onPress={() => {
                  if (selectionMode) {
                    setSelectedCollectionIds((prev) =>
                      prev.includes(collection.id)
                        ? prev.filter((id) => id !== collection.id)
                        : [...prev, collection.id]
                    );
                    return;
                  }
                  markCollectionOpened(collection.id);
                  openCollectionInBrowse(navigation, { collectionId: collection.id });
                }}
                onLongPress={() => {
                  if (selectionMode) return;
                  setSelectedCollectionIds([collection.id]);
                }}
              >
                <View style={styles.cardTop}>
                  <View style={selectionMode ? styles.cardTitleRowCompact : styles.cardTitleRow}>
                    {selectionMode ? (
                      <View style={styles.cardSelectionLead}>
                        <View
                          style={[
                            styles.selectionIndicatorCircle,
                            isSelected ? styles.selectionIndicatorActive : null,
                          ]}
                        >
                          {isSelected ? <Text style={styles.selectionBadgeText}>✓</Text> : null}
                        </View>
                      </View>
                    ) : null}
                    <Ionicons
                      name={getHierarchyIconName("collection")}
                      size={18}
                      color={getHierarchyIconColor("collection")}
                    />
                    <Text style={styles.cardTitle}>
                      <HighlightedText value={collection.title} query={searchQuery} />
                    </Text>
                  </View>
                  {!selectionMode ? (
                    <View style={styles.workspaceBrowseCollectionActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.collectionInlineActionBtn,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() => openCollectionActions(collection.id)}
                      >
                        <Ionicons name="ellipsis-horizontal" size={15} color="#64748b" />
                      </Pressable>
                    </View>
                  ) : null}
                </View>

                <View style={styles.workspaceBrowseCollectionMetaRow}>
                  <Text style={styles.cardMeta}>
                    {entry.itemCount} {entry.itemCount === 1 ? "item" : "items"}
                  </Text>
                  <Text style={styles.cardMeta}>•</Text>
                  <Text style={styles.cardMeta}>{formatBytes(sizeMap[collection.id] ?? 0)}</Text>
                </View>

                {searchQuery.trim().length > 0 && entry.matches.length > 0 ? (
                  <View style={styles.workspaceBrowseMatchRow}>
                    {entry.matches.map((match, index) => (
                      <View
                        key={`${match.kind}-${match.label}-${index}`}
                        style={styles.workspaceBrowseMatchBadge}
                      >
                        <Ionicons
                          name={getMatchIcon(match.kind)}
                          size={12}
                          color="#64748b"
                        />
                        <Text style={styles.workspaceBrowseMatchText} numberOfLines={1}>
                          {getMatchLabel(match.kind)} <HighlightedText value={match.label} query={searchQuery} />
                          {match.context ? (
                            <Text style={styles.workspaceBrowseMatchContext}> in {match.context}</Text>
                          ) : null}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </SurfaceCard>
            );
          })}

          {collectionEntries.length === 0 ? (
            <SurfaceCard>
              <Text style={styles.cardTitle}>
                {searchQuery.trim().length > 0 ? "No matching collections" : "No collections yet"}
              </Text>
              <Text style={styles.cardMeta}>
                {searchQuery.trim().length > 0
                  ? "Try a different search."
                  : "Create a collection to start organizing songs and clips in this workspace."}
              </Text>
            </SurfaceCard>
          ) : null}
        </View>
      </ScrollView>

      {selectionMode ? (
        <>
          <SelectionDock
            count={selectedCollectionIds.length}
            actions={selectionDockActions}
            onDone={() => setSelectedCollectionIds([])}
            onLayout={(height) => {
              setSelectionDockHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
            }}
          />
          <SelectionActionSheet
            visible={selectionMoreVisible}
            title="Workspace actions"
            actions={selectionSheetActions}
            onClose={() => setSelectionMoreVisible(false)}
          />
        </>
      ) : null}

      <QuickNameModal
        visible={modalOpen}
        title="New Collection"
        draftValue={draftTitle}
        placeholderValue={buildDefaultCollectionTitle(topLevelCollections.length)}
        onChangeDraft={setDraftTitle}
        onCancel={() => {
          setModalOpen(false);
          setDraftTitle("");
        }}
        onSave={() => {
          if (!activeWorkspaceId) return;
          const title = draftTitle.trim() || buildDefaultCollectionTitle(topLevelCollections.length);
          const collectionId = addCollection(activeWorkspaceId, title, null);
          setModalOpen(false);
          setDraftTitle("");
          openCollectionInBrowse(navigation, { collectionId });
        }}
        helperText="Collections hold songs and clips."
        saveLabel="Create"
      />

      <QuickNameModal
        visible={importCollectionModalOpen}
        title="New Collection from Import"
        draftValue={importCollectionDraft}
        placeholderValue={buildImportedCollectionTitle(importCollectionAssets, topLevelCollections.length)}
        onChangeDraft={setImportCollectionDraft}
        onCancel={resetImportCollectionModal}
        onSave={() => {
          void saveImportedCollection();
        }}
        helperText={buildImportHelperText(
          `${importCollectionAssets.length} file${importCollectionAssets.length === 1 ? "" : "s"} will be added as individual clips in the new collection.`,
          importCollectionAssets,
          importCollectionDatePreference
        )}
        saveLabel="Create"
        saveDisabled={false}
        cancelDisabled={false}
      />

      <CollectionActionsModal
        visible={collectionActionsOpen}
        title={managedCollection?.title ?? "Collection"}
        onRename={openRenameCollection}
        onCopy={openCopyCollection}
        onMove={openMoveCollection}
        onDelete={confirmDeleteCollection}
        onCancel={() => {
          setCollectionActionsOpen(false);
          setManagedCollectionId(null);
        }}
      />

      <QuickNameModal
        visible={collectionRenameModalOpen}
        title="Rename collection"
        draftValue={collectionDraft}
        placeholderValue={managedCollection?.title ?? "Collection"}
        onChangeDraft={setCollectionDraft}
        onCancel={() => {
          setCollectionRenameModalOpen(false);
          setCollectionDraft("");
        }}
        onSave={() => {
          if (!activeWorkspaceId || !managedCollection) return;
          const nextTitle = collectionDraft.trim();
          if (!nextTitle) return;
          updateCollection(activeWorkspaceId, managedCollection.id, { title: nextTitle });
          setCollectionRenameModalOpen(false);
          setCollectionDraft("");
          setManagedCollectionId(null);
        }}
        disableSaveWhenEmpty
      />

      <CollectionMoveModal
        visible={!!collectionDestinationMode}
        title={collectionDestinationMode === "copy" ? "Copy Collection" : "Move Collection"}
        helperText={
          collectionDestinationMode === "copy"
            ? "Choose where to copy this collection."
            : "Choose the destination for this collection."
        }
        confirmLabel={collectionDestinationMode === "copy" ? "Copy" : "Move"}
        destinations={moveDestinations}
        selectedWorkspaceId={selectedMoveWorkspaceId}
        selectedParentCollectionId={selectedMoveParentCollectionId}
        onSelectDestination={(workspaceId, parentCollectionId) => {
          setSelectedMoveWorkspaceId(workspaceId);
          setSelectedMoveParentCollectionId(parentCollectionId);
        }}
        onCancel={() => {
          setCollectionDestinationMode(null);
          setDestinationCollectionIds([]);
        }}
        onConfirm={submitCollectionDestination}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

function getMatchIcon(kind: CollectionSearchMatchKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "collection":
      return getHierarchyIconName("collection");
    case "subcollection":
      return getHierarchyIconName("collection");
    case "song":
      return getHierarchyIconName("song");
    case "clip":
    default:
      return getHierarchyIconName("clip");
  }
}

function getMatchLabel(kind: CollectionSearchMatchKind) {
  switch (kind) {
    case "collection":
      return "Collection:";
    case "subcollection":
      return "Inside:";
    case "song":
      return "Song:";
    case "clip":
    default:
      return "Clip:";
  }
}

function HighlightedText({ value, query }: { value: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{value}</>;

  const lowerValue = value.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const matchIndex = lowerValue.indexOf(lowerNeedle);

  if (matchIndex < 0) return <>{value}</>;

  const before = value.slice(0, matchIndex);
  const match = value.slice(matchIndex, matchIndex + needle.length);
  const after = value.slice(matchIndex + needle.length);

  return (
    <>
      {before}
      <Text style={styles.workspaceBrowseMatchHighlight}>{match}</Text>
      {after}
    </>
  );
}
