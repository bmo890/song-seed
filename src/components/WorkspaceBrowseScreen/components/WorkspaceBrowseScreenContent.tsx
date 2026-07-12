import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReAnimated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { WorkspaceThemeProvider, useWorkspaceTheme } from "../../../context/WorkspaceThemeContext";
import { SearchField } from "../../common/SearchField";
import { QuickNameModal } from "../../modals/QuickNameModal";
import { CollectionMoveModal } from "../../modals/CollectionMoveModal";
import { SelectionDock } from "../../common/SelectionDock";
import { SelectionTopBar } from "../../common/SelectionTopBar";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { CollapsingHeaderOverlay } from "../../common/CollapsingHeaderOverlay";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useWorkspaceCollectionsModel } from "../hooks/useWorkspaceCollectionsModel";
import { useWorkspaceCollectionSelection } from "../hooks/useWorkspaceCollectionSelection";
import { useWorkspaceCollectionImportFlow } from "../hooks/useWorkspaceCollectionImportFlow";
import { WorkspaceCollectionList } from "./WorkspaceCollectionList";
import { WorkspaceAvatar } from "../../common/WorkspaceAvatar";
import { styles } from "../../../styles";

const DEFAULT_HEADER_HEIGHT = 220;

function WorkspaceBrowseInner() {
  const theme = useWorkspaceTheme();
  const insets = useSafeAreaInsets();
  const playerDockHeight = useStore((s) => s.playerDockHeight);
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

  const [headerHeight, setHeaderHeight] = useState(DEFAULT_HEADER_HEIGHT);
  const scrollY = useSharedValue(0);
  const collapsibleHeaderHeight = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // Compact workspace identity fades in as the large identity block collapses.
  const compactTitleStyle = useAnimatedStyle(() => {
    const h = collapsibleHeaderHeight.value;
    if (h <= 0) return { opacity: 0 };
    return {
      opacity: interpolate(scrollY.value, [h * 0.45, h * 0.95], [0, 1], Extrapolation.CLAMP),
    };
  });

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
      {/* Fixed nav row — compact workspace identity fades in here as the block collapses */}
      <View style={browseStyles.navRow}>
        <Pressable
          style={({ pressed }) => [browseStyles.navBtn, pressed ? styles.pressDown : null]}
          onPress={openDrawer}
          hitSlop={8}
        >
          <Ionicons name="menu-outline" size={22} color="#84736f" />
        </Pressable>

        <ReAnimated.View style={[browseStyles.navCompact, compactTitleStyle]} pointerEvents="none">
          <WorkspaceAvatar
            name={collectionsModel.activeWorkspace.title}
            color={collectionsModel.activeWorkspace.color}
            avatarKey={collectionsModel.activeWorkspace.avatarKey}
            size={18}
          />
          <Text style={browseStyles.navCompactTitle} numberOfLines={1}>
            {collectionsModel.activeWorkspace.title}
          </Text>
        </ReAnimated.View>

        {/* Right spacer to balance the hamburger and keep compact title centred */}
        <View style={browseStyles.navBtn} />
      </View>

      {/* Stage: clips the identity block as it slides under the nav */}
      <View style={{ flex: 1, overflow: "hidden" }}>
        <ReAnimated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={browseStyles.flexFill}
          contentContainerStyle={[
            browseStyles.scrollContent,
            {
              paddingTop: headerHeight,
              paddingBottom: selectionModel.selectionMode
                ? selectionModel.selectionDockHeight + 32
                : 32,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Section label or breathing room */}
          {!selectionModel.selectionMode ? (
            <View style={browseStyles.sectionRow}>
              <Text style={browseStyles.sectionLabel}>
                Active Collections ({collectionCount})
              </Text>
            </View>
          ) : (
            <View style={{ height: 16 }} />
          )}

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
          />
        </ReAnimated.ScrollView>

        {/* Absolutely-positioned collapsing header overlay */}
        <CollapsingHeaderOverlay
          scrollY={scrollY}
          collapsibleHeight={collapsibleHeaderHeight}
          onHeaderHeight={setHeaderHeight}
          collapsible={
            <View style={[browseStyles.identityBlock, { backgroundColor: theme.bg }]}>
              <Text style={browseStyles.eyebrow}>Current Workspace</Text>
              <View style={browseStyles.titleRow}>
                <WorkspaceAvatar
                  name={collectionsModel.activeWorkspace.title}
                  color={collectionsModel.activeWorkspace.color}
                  avatarKey={collectionsModel.activeWorkspace.avatarKey}
                  size={40}
                />
                <Text style={browseStyles.pageTitle} numberOfLines={2}>
                  {collectionsModel.activeWorkspace.title}
                </Text>
              </View>
            </View>
          }
          pinned={
            <View style={{ backgroundColor: theme.bg }} pointerEvents="box-none">
              <View style={browseStyles.searchWrapper}>
                <SearchField
                  value={collectionsModel.searchQuery}
                  placeholder="Search collections, seeds, or clips..."
                  onChangeText={collectionsModel.setSearchQuery}
                />
              </View>
              {selectionModel.selectionMode ? (
                <SelectionTopBar
                  count={selectionModel.selectedCollectionIds.length}
                  allSelected={selectionModel.canDeselectAll}
                  onSelectAll={() =>
                    selectionModel.setSelectedCollectionIds(selectionModel.selectableCollectionIds)
                  }
                  onCancel={() => selectionModel.setSelectedCollectionIds([])}
                />
              ) : null}
            </View>
          }
        />
      </View>

      {/* Multi-select dock */}
      {selectionModel.selectionMode ? (
        <SelectionDock
          actions={selectionModel.selectionDockActions}
          onLayout={(height) => {
            selectionModel.setSelectionDockHeight((prev) =>
              Math.abs(prev - height) < 1 ? prev : height
            );
          }}
        />
      ) : null}

      {/* FAB */}
      {!selectionModel.selectionMode ? (
        <Pressable
          style={({ pressed }) => [
            browseStyles.fab,
            { bottom: playerDockHeight > 0 ? playerDockHeight + 12 : Math.max(32, insets.bottom + 16) },
            pressed ? styles.pressDown : null,
          ]}
          onPress={importFlow.openAddCollectionFlow}
        >
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
      ) : null}

      {/* Modals */}
      <QuickNameModal
        visible={importFlow.modalOpen}
        title="New Collection"
        draftValue={importFlow.draftTitle}
        placeholderValue={importFlow.defaultCollectionTitle}
        onChangeDraft={importFlow.setDraftTitle}
        descriptionValue={importFlow.draftDescription}
        onChangeDescription={importFlow.setDraftDescription}
        onCancel={() => {
          importFlow.setModalOpen(false);
          importFlow.setDraftTitle("");
          importFlow.setDraftDescription("");
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
        title="Edit collection"
        draftValue={selectionModel.collectionDraft}
        placeholderValue={selectionModel.managedCollection?.title ?? "Collection"}
        onChangeDraft={selectionModel.setCollectionDraft}
        descriptionValue={selectionModel.collectionDescriptionDraft}
        onChangeDescription={selectionModel.setCollectionDescriptionDraft}
        onCancel={() => {
          selectionModel.setCollectionRenameModalOpen(false);
          selectionModel.setCollectionDraft("");
          selectionModel.setCollectionDescriptionDraft("");
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

      <SelectionActionSheet
        visible={selectionModel.selectionMoreVisible}
        title="Collection actions"
        actions={selectionModel.selectionSheetActions}
        onClose={() => selectionModel.setSelectionMoreVisible(false)}
      />

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
    gap: 0,
  },
  emptyMsg: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: "#84736f",
    padding: 24,
  },

  // ── Fixed nav row ──────────────────────────────────────────────────────────
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  navCompact: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  navCompactTitle: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 17,
    color: "#1C1C19",
  },

  // ── Collapsible identity block ──────────────────────────────────────────────
  identityBlock: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 4,
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pageTitle: {
    flex: 1,
    fontFamily: "PlayfairDisplay_400Regular",
    fontSize: 40,
    lineHeight: 50,
    color: "#1C1C19",
  },

  // ── Pinned search wrapper ──────────────────────────────────────────────────
  searchWrapper: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },

  // ── Section row ───────────────────────────────────────────────────────────
  sectionRow: {
    marginTop: 16,
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

  // ── FAB ───────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 32,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#B87D6B",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3D3732",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
});
