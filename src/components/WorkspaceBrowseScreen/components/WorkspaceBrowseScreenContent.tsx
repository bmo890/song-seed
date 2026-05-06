import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useState, useMemo } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { WorkspaceThemeProvider, useWorkspaceTheme } from "../../../context/WorkspaceThemeContext";
import { SearchField } from "../../common/SearchField";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { CollectionMoveModal } from "../../modals/CollectionMoveModal";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { SelectionDock } from "../../common/SelectionDock";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useWorkspaceCollectionsModel } from "../hooks/useWorkspaceCollectionsModel";
import { useWorkspaceCollectionSelection } from "../hooks/useWorkspaceCollectionSelection";
import { useWorkspaceCollectionImportFlow } from "../hooks/useWorkspaceCollectionImportFlow";
import { WorkspaceCollectionList } from "./WorkspaceCollectionList";
import { getCollectionDeleteScope } from "../../../collectionManagement";

function WorkspaceBrowseInner() {
  const theme = useWorkspaceTheme();
  const navigation = useNavigation<any>();
  const collectionsModel = useWorkspaceCollectionsModel();
  const selectionModel = useWorkspaceCollectionSelection({
    navigation,
    workspaces: collectionsModel.workspaces,
    activeWorkspace: collectionsModel.activeWorkspace,
    activeWorkspaceId: collectionsModel.activeWorkspaceId,
    primaryCollectionId: collectionsModel.primaryCollectionId,
    setPrimaryCollectionId: collectionsModel.setPrimaryCollectionId,
    collectionEntries: collectionsModel.collectionEntries,
    updateCollection: collectionsModel.updateCollection,
    moveCollection: collectionsModel.moveCollection,
    deleteCollection: collectionsModel.deleteCollection,
  });
  const importFlow = useWorkspaceCollectionImportFlow({
    navigation,
    activeWorkspaceId: collectionsModel.activeWorkspace?.id ?? null,
    topLevelCollectionCount: collectionsModel.topLevelCollections.length,
    addCollection: collectionsModel.addCollection,
    deleteCollection: collectionsModel.deleteCollection,
  });

  // ── Per-card ellipsis action sheet ──────────────────────────────────────────
  const [actionSheetCollectionId, setActionSheetCollectionId] = useState<string | null>(null);
  const actionSheetCollection = useMemo(
    () =>
      actionSheetCollectionId
        ? (collectionsModel.activeWorkspace?.collections.find(
            (c) => c.id === actionSheetCollectionId
          ) ?? null)
        : null,
    [actionSheetCollectionId, collectionsModel.activeWorkspace?.collections]
  );
  const isPrimaryActionSheet =
    actionSheetCollectionId === collectionsModel.primaryCollectionId;

  const cardActions = useMemo(() => {
    if (!actionSheetCollection) return [];
    return [
      {
        key: "rename",
        label: "Rename",
        icon: "create-outline" as const,
        onPress: () => {
          setActionSheetCollectionId(null);
          selectionModel.openRenameFor(actionSheetCollection.id);
        },
      },
      {
        key: "primary",
        label: isPrimaryActionSheet ? "Unset Primary" : "Set as Primary",
        icon: isPrimaryActionSheet ? ("star" as const) : ("star-outline" as const),
        onPress: () => {
          setActionSheetCollectionId(null);
          if (!collectionsModel.activeWorkspaceId) return;
          collectionsModel.setPrimaryCollectionId(
            collectionsModel.activeWorkspaceId,
            isPrimaryActionSheet ? null : actionSheetCollection.id
          );
        },
      },
      {
        key: "delete",
        label: "Delete",
        icon: "trash-outline" as const,
        tone: "danger" as const,
        onPress: () => {
          setActionSheetCollectionId(null);
          if (!collectionsModel.activeWorkspace) return;
          const scope = getCollectionDeleteScope(
            collectionsModel.activeWorkspace,
            actionSheetCollection.id
          );
          Alert.alert(
            "Delete collection?",
            `"${actionSheetCollection.title}" will be removed${
              scope.childCollectionCount > 0
                ? ` along with ${scope.childCollectionCount} sub-collection${scope.childCollectionCount === 1 ? "" : "s"}`
                : ""
            } and ${scope.itemCount} seed${scope.itemCount === 1 ? "" : "s"}.`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => collectionsModel.deleteCollection(actionSheetCollection.id),
              },
            ]
          );
        },
      },
    ];
  }, [actionSheetCollection, isPrimaryActionSheet, collectionsModel, selectionModel]);

  useBrowseRootBackHandler(
    selectionModel.selectedCollectionIds.length > 0
      ? { onBack: () => selectionModel.setSelectedCollectionIds([]) }
      : true
  );

  function openDrawer() {
    let nav: any = navigation;
    while (nav) {
      if (typeof nav.openDrawer === "function") {
        nav.openDrawer();
        return;
      }
      nav = nav.getParent?.();
    }
  }

  if (!collectionsModel.activeWorkspace) {
    return (
      <SafeAreaView style={[browseStyles.screen, { backgroundColor: theme.bg }]}>
        <Text style={browseStyles.emptyMsg}>Choose a workspace to browse its collections.</Text>
      </SafeAreaView>
    );
  }

  const collectionCount = collectionsModel.topLevelCollections.length;

  return (
    <SafeAreaView style={[browseStyles.screen, { backgroundColor: theme.bg }]}>
      <ScrollView
        style={browseStyles.flexFill}
        contentContainerStyle={[
          browseStyles.scrollContent,
          {
            paddingBottom: selectionModel.selectionMode
              ? selectionModel.selectionDockHeight + 32
              : 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={browseStyles.header}>
          <Pressable
            style={({ pressed }) => [browseStyles.hamburgerBtn, pressed ? browseStyles.pressDown : null]}
            onPress={openDrawer}
            hitSlop={8}
          >
            <Ionicons name="menu-outline" size={22} color="#84736f" />
          </Pressable>
          <Text style={browseStyles.eyebrow}>Current Workspace</Text>
          <Text style={browseStyles.pageTitle}>{collectionsModel.activeWorkspace.title}</Text>
        </View>

        {/* ── Search ──────────────────────────────────────────────────────── */}
        <SearchField
          value={collectionsModel.searchQuery}
          placeholder="Search collections, seeds, or clips..."
          onChangeText={collectionsModel.setSearchQuery}
        />

        {/* ── Section row ─────────────────────────────────────────────────── */}
        {!selectionModel.selectionMode ? (
          <View style={browseStyles.sectionRow}>
            <Text style={browseStyles.sectionLabel}>
              Active Collections ({collectionCount})
            </Text>
            <Pressable
              style={({ pressed }) => [
                browseStyles.newCollectionBtn,
                pressed ? browseStyles.pressDown : null,
              ]}
              onPress={importFlow.openAddCollectionFlow}
            >
              <Ionicons name="add" size={14} color="#B87D6B" />
              <Text style={browseStyles.newCollectionBtnText}>New Collection</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Collection list ──────────────────────────────────────────────── */}
        <WorkspaceCollectionList
          collectionEntries={collectionsModel.collectionEntries}
          primaryCollectionId={collectionsModel.primaryCollectionId}
          searchQuery={collectionsModel.searchQuery}
          selectionMode={selectionModel.selectionMode}
          selectedCollectionIds={selectionModel.selectedCollectionIds}
          onPressCollection={(collectionId) => {
            if (selectionModel.selectionMode) {
              selectionModel.setSelectedCollectionIds((prev) =>
                prev.includes(collectionId)
                  ? prev.filter((id) => id !== collectionId)
                  : [...prev, collectionId]
              );
              return;
            }
            collectionsModel.openCollection(collectionId);
          }}
          onLongPressCollection={(collectionId) => {
            if (selectionModel.selectionMode) return;
            selectionModel.setSelectedCollectionIds([collectionId]);
          }}
          onOpenCollectionActions={(collectionId) => {
            if (selectionModel.selectionMode) return;
            setActionSheetCollectionId(collectionId);
          }}
        />
      </ScrollView>

      {/* ── Multi-select dock ────────────────────────────────────────────────── */}
      {selectionModel.selectionMode ? (
        <SelectionDock
          count={selectionModel.selectedCollectionIds.length}
          actions={selectionModel.selectionDockActions}
          onDone={() => selectionModel.setSelectedCollectionIds([])}
          onLayout={(height) => {
            selectionModel.setSelectionDockHeight((prev) =>
              Math.abs(prev - height) < 1 ? prev : height
            );
          }}
        />
      ) : null}

      {/* ── Per-card ellipsis action sheet ──────────────────────────────────── */}
      <SelectionActionSheet
        visible={!!actionSheetCollectionId}
        title={actionSheetCollection?.title ?? "Collection"}
        actions={cardActions}
        onClose={() => setActionSheetCollectionId(null)}
      />

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <QuickNameModal
        visible={importFlow.modalOpen}
        title="New Collection"
        draftValue={importFlow.draftTitle}
        placeholderValue={importFlow.defaultCollectionTitle}
        onChangeDraft={importFlow.setDraftTitle}
        onCancel={() => {
          importFlow.setModalOpen(false);
          importFlow.setDraftTitle("");
        }}
        onSave={importFlow.createCollection}
        helperText="Collections hold seeds and clips."
        saveLabel="Create"
      />

      <QuickNameModal
        visible={importFlow.importCollectionModalOpen}
        title="New Collection from Import"
        draftValue={importFlow.importCollectionDraft}
        placeholderValue={importFlow.defaultImportedTitle}
        onChangeDraft={importFlow.setImportCollectionDraft}
        onCancel={importFlow.resetImportCollectionModal}
        onSave={importFlow.saveImportedCollection}
        helperText={importFlow.importHelperText}
        saveLabel="Create"
      />

      <QuickNameModal
        visible={selectionModel.collectionRenameModalOpen}
        title="Rename collection"
        draftValue={selectionModel.collectionDraft}
        placeholderValue={selectionModel.managedCollection?.title ?? "Collection"}
        onChangeDraft={selectionModel.setCollectionDraft}
        onCancel={() => {
          selectionModel.setCollectionRenameModalOpen(false);
          selectionModel.setCollectionDraft("");
        }}
        onSave={selectionModel.renameCollection}
        disableSaveWhenEmpty
      />

      <CollectionMoveModal
        visible={!!selectionModel.collectionDestinationMode}
        title={selectionModel.collectionDestinationMode === "copy" ? "Copy Collection" : "Move Collection"}
        helperText={
          selectionModel.collectionDestinationMode === "copy"
            ? "Choose where to copy this collection."
            : "Choose the destination for this collection."
        }
        confirmLabel={selectionModel.collectionDestinationMode === "copy" ? "Copy" : "Move"}
        destinations={selectionModel.moveDestinations}
        selectedWorkspaceId={selectionModel.selectedMoveWorkspaceId}
        selectedParentCollectionId={selectionModel.selectedMoveParentCollectionId}
        onSelectDestination={(workspaceId, parentCollectionId) => {
          selectionModel.setSelectedMoveWorkspaceId(workspaceId);
          selectionModel.setSelectedMoveParentCollectionId(parentCollectionId);
        }}
        onCancel={() => {
          selectionModel.setCollectionDestinationMode(null);
          selectionModel.setDestinationCollectionIds([]);
        }}
        onConfirm={selectionModel.submitCollectionDestination}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}

export function WorkspaceBrowseScreenContent() {
  const route = useRoute<any>();
  const routeWorkspaceId = route.params?.workspaceId as string | undefined;
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const workspaceColor = useStore((s) =>
    s.workspaces.find((w) => w.id === (routeWorkspaceId ?? activeWorkspaceId))?.color
  );
  return (
    <WorkspaceThemeProvider color={workspaceColor}>
      <WorkspaceBrowseInner />
    </WorkspaceThemeProvider>
  );
}

const browseStyles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 0,
  },
  emptyMsg: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: "#84736f",
    padding: 24,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    paddingTop: 8,
    marginBottom: 28,
  },
  hamburgerBtn: {
    marginBottom: 20,
    alignSelf: "flex-start",
    padding: 4,
    marginLeft: -4,
  },
  eyebrow: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 11,
    lineHeight: 16,
    color: "#526351",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  pageTitle: {
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 40,
    lineHeight: 50,
    color: "#1C1C19",
  },

  // ── Section row ───────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 16,
  },
  sectionLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 10,
    lineHeight: 14,
    color: "#84736f",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  newCollectionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  newCollectionBtnText: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 11,
    color: "#B87D6B",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },

  // ── Shared pressable feedback ──────────────────────────────────────────────
  pressDown: {
    opacity: 0.6,
    transform: [{ scale: 0.97 }],
  },
});
