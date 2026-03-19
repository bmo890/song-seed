import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { PageIntro } from "../common/PageIntro";
import { SearchField } from "../common/SearchField";
import { SurfaceCard } from "../common/SurfaceCard";
import { QuickNameModal } from "../modals/QuickNameModal";
import { CollectionMoveModal } from "../modals/CollectionMoveModal";
import { CollectionActionsModal } from "../modals/CollectionActionsModal";
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

export function WorkspaceBrowseScreen() {
  const navigation = useNavigation();
  useBrowseRootBackHandler();

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
  const [collectionMoveModalOpen, setCollectionMoveModalOpen] = useState(false);
  const [selectedMoveWorkspaceId, setSelectedMoveWorkspaceId] = useState<string | null>(null);
  const [selectedMoveParentCollectionId, setSelectedMoveParentCollectionId] = useState<string | null>(null);

  const managedCollection =
    activeWorkspace?.collections.find((collection) => collection.id === managedCollectionId) ?? null;

  const moveDestinations = useMemo(
    () => buildCollectionMoveDestinations(workspaces, managedCollection, activeWorkspaceId),
    [activeWorkspaceId, managedCollection, workspaces]
  );

  useEffect(() => {
    if (!collectionMoveModalOpen) return;
    const firstDestination = moveDestinations[0] ?? null;
    setSelectedMoveWorkspaceId(firstDestination?.workspaceId ?? null);
    setSelectedMoveParentCollectionId(firstDestination?.parentCollectionId ?? null);
  }, [collectionMoveModalOpen, moveDestinations]);

  const collectionEntries = useMemo(
    () => (activeWorkspace ? buildWorkspaceBrowseEntries(activeWorkspace, searchQuery) : []),
    [activeWorkspace, searchQuery]
  );

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

  const openMoveCollection = () => {
    if (!managedCollection) return;
    setCollectionActionsOpen(false);
    if (moveDestinations.length === 0) {
      Alert.alert(
        "No move targets",
        "There are no valid destinations available for this collection right now."
      );
      return;
    }
    setCollectionMoveModalOpen(true);
  };

  const confirmDeleteCollection = () => {
    if (!activeWorkspace || !managedCollection) return;
    const { childCollectionCount, itemCount } = getCollectionDeleteScope(activeWorkspace, managedCollection.id);
    setCollectionActionsOpen(false);
    Alert.alert(
      "Delete collection?",
      `${managedCollection.title} will be removed${childCollectionCount > 0 ? ` along with ${childCollectionCount} subcollection${childCollectionCount === 1 ? "" : "s"}` : ""} and ${itemCount} item${itemCount === 1 ? "" : "s"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCollection(managedCollection.id);
            setManagedCollectionId(null);
          },
        },
      ]
    );
  };

  const submitCollectionMove = () => {
    if (!managedCollection || !selectedMoveWorkspaceId) return;
    const result = moveCollection(
      managedCollection.id,
      selectedMoveWorkspaceId,
      selectedMoveParentCollectionId
    );

    if (!result.ok) {
      Alert.alert("Move failed", result.error ?? "Could not move this collection.");
      return;
    }

    setCollectionMoveModalOpen(false);
    setManagedCollectionId(null);
  };

  const openAddCollectionFlow = () => {
    Alert.alert("Add collection", "Choose how to start this collection.", [
      {
        text: "New Collection",
        onPress: () => {
          setDraftTitle("");
          setModalOpen(true);
        },
      },
      {
        text: "New Collection from Import",
        onPress: () => {
          void openCollectionImportFlow();
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

      void (async () => {
        try {
          const importedAt = Date.now();
          const { imported, failed } = await importAudioAssets(
            assets,
            (_asset, index) => `audio-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
            (current, total, failedCount) => {
              useImportStore.getState().updateJob(jobId, { current, failed: failedCount });
            }
          );

          // Data-loss guard: if nothing imported, remove the empty pre-created collection
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
      <AppBreadcrumbs
        items={[
          {
            key: "home",
            label: "Home",
            level: "home",
            onPress: () => navigation.navigate("Workspaces" as never),
          },
          { key: "workspace", label: activeWorkspace.title, level: "workspace", active: true },
        ]}
      />

      <PageIntro
        title={activeWorkspace.title}
        subtitle="Browse collections by recent work, then move deeper into the workspace."
      />

      <SearchField
        value={searchQuery}
        placeholder="Search collections, songs, or clips..."
        onChangeText={setSearchQuery}
      />

      <View style={styles.inputRow}>
        <Pressable
          style={({ pressed }) => [styles.ideasHeaderSelectBtn, pressed ? styles.pressDown : null]}
          onPress={openAddCollectionFlow}
        >
          <Text style={styles.ideasHeaderSelectBtnText}>Add</Text>
        </Pressable>
      </View>

      <View style={styles.listContent}>
        {collectionEntries.map((entry) => {
          const collection = entry.collection;
          return (
            <SurfaceCard
              key={collection.id}
              onPress={() => {
                markCollectionOpened(collection.id);
                openCollectionInBrowse(navigation, { collectionId: collection.id });
              }}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleRow}>
                  <Ionicons
                    name={getHierarchyIconName("collection")}
                    size={18}
                    color={getHierarchyIconColor("collection")}
                  />
                  <Text style={styles.cardTitle}>
                    <HighlightedText value={collection.title} query={searchQuery} />
                  </Text>
                </View>
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
        visible={collectionMoveModalOpen}
        title="Move Collection"
        helperText="Choose the destination for this collection."
        destinations={moveDestinations}
        selectedWorkspaceId={selectedMoveWorkspaceId}
        selectedParentCollectionId={selectedMoveParentCollectionId}
        onSelectDestination={(workspaceId, parentCollectionId) => {
          setSelectedMoveWorkspaceId(workspaceId);
          setSelectedMoveParentCollectionId(parentCollectionId);
        }}
        onCancel={() => {
          setCollectionMoveModalOpen(false);
        }}
        onConfirm={submitCollectionMove}
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
