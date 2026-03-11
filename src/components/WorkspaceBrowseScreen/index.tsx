import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { QuickNameModal } from "../modals/QuickNameModal";
import { CollectionMoveModal } from "../modals/CollectionMoveModal";
import { CollectionActionsModal } from "../modals/CollectionActionsModal";
import { buildCollectionMoveDestinations, getCollectionDeleteScope } from "../../collectionManagement";
import { getCollectionIdeaCount, getCollectionSizeBytes, formatBytes } from "../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";

function buildDefaultCollectionTitle(count: number) {
  return `Collection ${count + 1}`;
}

export function WorkspaceBrowseScreen() {
  const navigation = useNavigation();
  const rootNavigation = (navigation as any).getParent?.();
  const navigateRoot = (route: string, params?: object) =>
    (rootNavigation ?? navigation).navigate(route as never, params as never);

  const workspaces = useStore((state) => state.workspaces);
  const activeWorkspaceId = useStore((state) => state.activeWorkspaceId);
  const addCollection = useStore((state) => state.addCollection);
  const updateCollection = useStore((state) => state.updateCollection);
  const moveCollection = useStore((state) => state.moveCollection);
  const deleteCollection = useStore((state) => state.deleteCollection);
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

  const filteredCollections = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return topLevelCollections;
    return topLevelCollections.filter((collection) =>
      collection.title.toLowerCase().includes(needle)
    );
  }, [searchQuery, topLevelCollections]);

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

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title={activeWorkspace.title} leftIcon="hamburger" />
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

      <View style={styles.ideasSearchWrap}>
        <Ionicons name="search" size={16} color="#64748b" />
        <TextInput
          style={styles.ideasSearchInput}
          placeholder="Search collections..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery ? (
          <Pressable
            style={({ pressed }) => [styles.ideasSearchClear, pressed ? styles.pressDown : null]}
            onPress={() => setSearchQuery("")}
          >
            <Ionicons name="close" size={14} color="#64748b" />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.inputRow}>
        <Pressable
          style={({ pressed }) => [styles.ideasHeaderSelectBtn, pressed ? styles.pressDown : null]}
          onPress={() => {
            setDraftTitle("");
            setModalOpen(true);
          }}
        >
          <Text style={styles.ideasHeaderSelectBtnText}>New Collection</Text>
        </Pressable>
      </View>

      <View style={styles.listContent}>
        {filteredCollections.map((collection) => {
          const scopedItemCount = getCollectionIdeaCount(activeWorkspace, collection.id);
          const childCollectionCount = activeWorkspace.collections.filter(
            (candidate) => candidate.parentCollectionId === collection.id
          ).length;

          return (
            <Pressable
              key={collection.id}
              style={({ pressed }) => [styles.card, pressed ? styles.pressDown : null]}
              onPress={() => navigateRoot("CollectionDetail", { collectionId: collection.id })}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardTitleRow}>
                  <Ionicons
                    name={getHierarchyIconName("collection")}
                    size={18}
                    color={getHierarchyIconColor("collection")}
                  />
                  <Text style={styles.cardTitle}>{collection.title}</Text>
                </View>
                <View style={styles.workspaceBrowseCollectionActions}>
                  {childCollectionCount > 0 ? (
                    <View style={styles.contextPill}>
                      <Text style={styles.contextPillText}>
                        {childCollectionCount} {childCollectionCount === 1 ? "SUB" : "SUBS"}
                      </Text>
                    </View>
                  ) : null}
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
                  {scopedItemCount} {scopedItemCount === 1 ? "item" : "items"}
                </Text>
                <Text style={styles.cardMeta}>•</Text>
                <Text style={styles.cardMeta}>{formatBytes(sizeMap[collection.id] ?? 0)}</Text>
              </View>
            </Pressable>
          );
        })}

        {filteredCollections.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {searchQuery.trim().length > 0 ? "No matching collections" : "No collections yet"}
            </Text>
            <Text style={styles.cardMeta}>
              {searchQuery.trim().length > 0
                ? "Try a different search."
                : "Create a collection to start organizing songs and clips in this workspace."}
            </Text>
          </View>
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
          navigateRoot("CollectionDetail", { collectionId });
        }}
        helperText="Collections hold songs, clips, and optional subcollections."
        saveLabel="Create"
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
          setSelectedMoveWorkspaceId(null);
          setSelectedMoveParentCollectionId(null);
        }}
        onConfirm={submitCollectionMove}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
