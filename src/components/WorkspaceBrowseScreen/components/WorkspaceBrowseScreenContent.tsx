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
import { QuickNameModal } from "../../modals/QuickNameModal";
import { CollectionMoveModal } from "../../modals/CollectionMoveModal";
import { SelectionDock } from "../../common/SelectionDock";
import { SelectionTopBar } from "../../common/SelectionTopBar";
import { SearchField } from "../../common/SearchField";
import { PickerEyebrow } from "../../common/PickerEyebrow";
import { PickerFooter } from "../../common/PickerFooter";
import { WorkspacePickSheet } from "../../common/WorkspacePickSheet";
import { personalWorkspaces, receivedPackages } from "../../../domain/workspaceVisibility";
import { dirIcon } from "../../../design/directionalIcons";
import { useLibraryCollectorHandlers } from "../../../hooks/useLibraryCollectorHandlers";
import { getLibraryCollectorIcon } from "../../../domain/libraryCollectorPresentation";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { CollapsingHeaderOverlay } from "../../common/CollapsingHeaderOverlay";
import { useBrowseRootBackHandler } from "../../../hooks/useBrowseRootBackHandler";
import { useWorkspaceCollectionsModel } from "../hooks/useWorkspaceCollectionsModel";
import { useWorkspaceCollectionSelection } from "../hooks/useWorkspaceCollectionSelection";
import { useWorkspaceCollectionImportFlow } from "../hooks/useWorkspaceCollectionImportFlow";
import { WorkspaceCollectionList } from "./WorkspaceCollectionList";
import { WorkspaceAvatar } from "../../common/WorkspaceAvatar";
import { styles } from "../../../styles";
import { colors, radii, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

const DEFAULT_HEADER_HEIGHT = 220;

function WorkspaceBrowseInner() {
  const { t } = useTranslation();
  const theme = useWorkspaceTheme();
  const insets = useSafeAreaInsets();
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const navigation = useNavigation<any>();
  const libraryCollector = useStore((s) => s.libraryCollector);
  const pickingSongTarget = useStore((s) => s.songTargetPicker != null);
  const collectorHandlers = useLibraryCollectorHandlers(navigation);
  // The hub hosts a picker (a compilation collecting, or the Lyrics Pad choosing
  // a song): one eyebrow where the section label sat, one ✕ footer. Nothing to
  // commit here — the picking happens inside a collection.
  const pickerActive = libraryCollector != null || pickingSongTarget;
  const [pickerFooterHeight, setPickerFooterHeight] = useState(0);
  // While collecting, the identity block is the workspace switcher (the drawer
  // is closed to a picker): it opens this sheet, and a pick re-points the hub.
  const [workspaceSheetOpen, setWorkspaceSheetOpen] = useState(false);
  const pickCount = libraryCollector?.picks.length ?? 0;
  const collectionsModel = useWorkspaceCollectionsModel();
  const pickFromWorkspace = (workspaceId: string) => {
    // A received package is browsed by route param only — it never becomes
    // the active workspace (that would point the recorder at it).
    const picked = useStore.getState().workspaces.find((workspace) => workspace.id === workspaceId);
    if (picked?.origin !== "received") useStore.getState().setActiveWorkspaceId(workspaceId);
    navigation.setParams({ workspaceId });
  };
  const [searchOpen, setSearchOpen] = useState(false);
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

  // Back on the hub while collecting = ✕: the session ends and the compilation
  // that started it comes back (the drawer's own back would wander off to the
  // app's start route instead).
  useBrowseRootBackHandler(
    selectionModel.selectedCollectionIds.length > 0
      ? { onBack: () => selectionModel.setSelectedCollectionIds([]) }
      : libraryCollector
        ? { onBack: collectorHandlers.onCancel }
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
        <Text style={browseStyles.emptyMsg}>{t("workspaceBrowse.chooseWorkspace")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[browseStyles.screen, { backgroundColor: theme.bg }]}>
      {/* Fixed nav row — compact workspace identity fades in here as the block collapses */}
      <View style={browseStyles.navRow}>
        {libraryCollector ? (
          // A picker is a task, not a place: no menu. The lead is a back chevron
          // to the compilation this session is adding to — the same exit as ✕.
          <Pressable
            testID="header-back"
            accessibilityRole="button"
            accessibilityLabel={t("common.backTo", { label: libraryCollector.targetTitle })}
            style={({ pressed }) => [browseStyles.navBtn, pressed ? styles.pressDown : null]}
            onPress={collectorHandlers.onCancel}
            hitSlop={8}
          >
            <Ionicons name={dirIcon("chevron-back")} size={22} color={colors.textStrong} />
          </Pressable>
        ) : (
          <Pressable
            testID="header-menu"
            accessibilityLabel={t("workspaceBrowse.openMenu")}
            style={({ pressed }) => [browseStyles.navBtn, pressed ? styles.pressDown : null]}
            onPress={openDrawer}
            hitSlop={8}
          >
            <Ionicons name="menu-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        )}

        <ReAnimated.View style={[browseStyles.navCompact, compactTitleStyle]} pointerEvents="none">
          <WorkspaceAvatar
            name={collectionsModel.activeWorkspace.title}
            color={collectionsModel.activeWorkspace.color}
            avatarKey={collectionsModel.activeWorkspace.avatarKey}
            size={18}
          />
          <UserText value={collectionsModel.activeWorkspace.title} style={browseStyles.navCompactTitle} numberOfLines={1}>
            {collectionsModel.activeWorkspace.title}
          </UserText>
        </ReAnimated.View>

        {/* Search stays ON this page: the glyph opens a field in place and the
            collection list filters live beneath it, so the scope (this workspace)
            is shown, not explained. Closed by default so the hub doesn't wear a
            second search bar and read as another collection page. */}
        <Pressable
          testID="workspace-search"
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? t("common.cancel") : t("workspaceBrowse.searchLibrary")}
          style={({ pressed }) => [browseStyles.navBtn, pressed ? styles.pressDown : null]}
          onPress={() => {
            if (searchOpen) {
              collectionsModel.setSearchQuery("");
              setSearchOpen(false);
            } else {
              setSearchOpen(true);
            }
          }}
          hitSlop={8}
        >
          <Ionicons name={searchOpen ? "close" : "search-outline"} size={22} color={colors.textSecondary} />
        </Pressable>
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
                : pickerActive
                  ? pickerFooterHeight + 32
                  : 32,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Section label — or, while a picker is active, its eyebrow in the
              same slot: "ADDING TO SETLIST 1" says what these collections are for. */}
          {libraryCollector ? (
            <View style={browseStyles.sectionRow}>
              <PickerEyebrow
                testID="picker-eyebrow"
                icon={getLibraryCollectorIcon(libraryCollector.kind)}
                label={t("selection.addingTo", { title: libraryCollector.targetTitle })}
                userValue={libraryCollector.targetTitle}
              />
            </View>
          ) : pickingSongTarget ? (
            <View style={browseStyles.sectionRow}>
              <PickerEyebrow testID="picker-eyebrow" icon="document-text-outline" label={t("selection.pickingSongFor")} />
            </View>
          ) : !selectionModel.selectionMode ? (
            <View style={browseStyles.sectionRow}>
              <Text style={browseStyles.sectionLabel}>{t("workspaceBrowse.collections")}</Text>
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
              // A picker has one chrome; collection multi-select waits its turn.
              if (selectionModel.selectionMode || pickerActive) return;
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
            // While collecting, the identity block is the workspace switcher:
            // "PICKING FROM ▾ My Songs" — tap to pick from another workspace.
            <Pressable
              testID="workspace-identity"
              disabled={!libraryCollector}
              onPress={() => setWorkspaceSheetOpen(true)}
              accessibilityRole={libraryCollector ? "button" : undefined}
              accessibilityLabel={libraryCollector ? t("selection.pickFromWorkspace") : undefined}
              style={({ pressed }) => [
                browseStyles.identityBlock,
                { backgroundColor: theme.bg },
                pressed && libraryCollector ? styles.pressDown : null,
              ]}
            >
              <Text style={browseStyles.eyebrow}>
                {t(libraryCollector ? "workspaceBrowse.pickingFrom" : "workspaceBrowse.currentWorkspace")}
              </Text>
              <View style={browseStyles.titleRow}>
                <WorkspaceAvatar
                  name={collectionsModel.activeWorkspace.title}
                  color={collectionsModel.activeWorkspace.color}
                  avatarKey={collectionsModel.activeWorkspace.avatarKey}
                  size={40}
                />
                <UserText value={collectionsModel.activeWorkspace.title} style={browseStyles.pageTitle} numberOfLines={2}>
                  {collectionsModel.activeWorkspace.title}
                </UserText>
                {libraryCollector ? (
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} style={browseStyles.switchGlyph} />
                ) : null}
              </View>
            </Pressable>
          }
          pinned={
            <View style={{ backgroundColor: theme.bg }} pointerEvents="box-none">
              {/* On-demand search field, pinned under the nav so the filtered list
                  scrolls beneath it. */}
              {searchOpen && !selectionModel.selectionMode ? (
                <View style={browseStyles.searchWrapper}>
                  <SearchField
                    testID="workspace-search-field"
                    value={collectionsModel.searchQuery}
                    placeholder={t("workspaceBrowse.searchPlaceholder")}
                    onChangeText={collectionsModel.setSearchQuery}
                    autoFocus
                  />
                </View>
              ) : null}
              {selectionModel.selectionMode ? (
                <View style={browseStyles.searchWrapper}>
                  <SelectionTopBar
                    style={{ backgroundColor: theme.bg }}
                    count={selectionModel.selectedCollectionIds.length}
                    allSelected={selectionModel.canDeselectAll}
                    onSelectAll={() =>
                      selectionModel.setSelectedCollectionIds(selectionModel.selectableCollectionIds)
                    }
                    onCancel={() => selectionModel.setSelectedCollectionIds([])}
                  />
                </View>
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

      {/* Picker footer: ✕ plus a quiet pointer to where the picking happens —
          or, once the basket holds something from an earlier collection, the
          same "Add N" key the collection page shows. */}
      {pickerActive && !selectionModel.selectionMode ? (
        <PickerFooter
          onCancel={
            libraryCollector
              ? collectorHandlers.onCancel
              : () => useStore.getState().cancelSongTargetPicking()
          }
          cancelLabel={t(libraryCollector ? "common.stopAdding" : "common.cancel")}
          count={pickCount}
          onAdd={libraryCollector && pickCount > 0 ? collectorHandlers.onAdd : undefined}
          supportingText={libraryCollector && pickCount === 0 ? t("selection.pickCollection") : undefined}
          onLayout={(height) => setPickerFooterHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height))}
        />
      ) : null}

      <WorkspacePickSheet
        visible={workspaceSheetOpen}
        workspaces={personalWorkspaces(collectionsModel.workspaces).filter((workspace) => !workspace.isArchived)}
        receivedWorkspaces={receivedPackages(collectionsModel.workspaces)}
        currentWorkspaceId={collectionsModel.activeWorkspace.id}
        onPick={pickFromWorkspace}
        onClose={() => setWorkspaceSheetOpen(false)}
      />

      {/* FAB */}
      {!selectionModel.selectionMode && !pickerActive ? (
        <Pressable
          testID="workspace-add-collection"
          accessibilityRole="button"
          accessibilityLabel={t("workspaceBrowse.newCollection")}
          style={({ pressed }) => [
            browseStyles.fab,
            { bottom: playerDockHeight > 0 ? playerDockHeight + 12 : Math.max(32, insets.bottom + 16) },
            pressed ? styles.pressDown : null,
          ]}
          onPress={importFlow.openAddCollectionFlow}
        >
          <Ionicons name="add" size={26} color={colors.surface} />
        </Pressable>
      ) : null}

      {/* Modals */}
      <QuickNameModal
        visible={importFlow.modalOpen}
        title={t("workspaceBrowse.newCollectionTitle")}
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
        helperText={t("workspaceBrowse.collectionsHint")}
        saveLabel={t("workspaceBrowse.create")}
      />

      <QuickNameModal
        visible={importFlow.importCollectionModalOpen}
        title={t("workspaceBrowse.newCollectionFromImport")}
        draftValue={importFlow.importCollectionDraft}
        placeholderValue={importFlow.defaultImportedTitle}
        onChangeDraft={importFlow.setImportCollectionDraft}
        onCancel={importFlow.resetImportCollectionModal}
        onSave={importFlow.saveImportedCollection}
        helperText={importFlow.importHelperText}
        saveLabel={t("workspaceBrowse.create")}
      />

      <QuickNameModal
        visible={selectionModel.collectionRenameModalOpen}
        title={t("workspaceBrowse.editCollection")}
        draftValue={selectionModel.collectionDraft}
        placeholderValue={selectionModel.managedCollection?.title ?? t("common.collection")}
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
        title={t(selectionModel.collectionDestinationMode === "copy" ? "collection.copyCollection" : "collection.moveCollection")}
        helperText={t("collection.chooseDestination", {
          action: t(selectionModel.collectionDestinationMode === "copy" ? "collection.copy" : "collection.move"),
        })}
        confirmLabel={t(selectionModel.collectionDestinationMode === "copy" ? "common.copy" : "collection.move")}
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
        title={t("selection.collectionActions")}
        actions={selectionModel.selectionSheetActions}
        onClose={() => selectionModel.setSelectionMoreVisible(false)}
      />
      {/* Share… on one selected collection: Export · SongNook Send. */}
      <SelectionActionSheet
        visible={selectionModel.selectionShareVisible}
        onBack={() => selectionModel.setSelectionMoreVisible(true)}
        title={t("collection.shareTitle")}
        actions={selectionModel.selectionShareActions}
        onClose={() => selectionModel.setSelectionShareVisible(false)}
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
    paddingHorizontal: spacing.lg,
    gap: 0,
  },
  emptyMsg: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 14,
    color: colors.textSecondary,
    padding: 24,
  },

  // ── Fixed nav row ──────────────────────────────────────────────────────────
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
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
    fontFamily: "Lora_500Medium",
    fontSize: 17,
    color: "#1C1C19",
  },

  // ── Collapsible identity block ──────────────────────────────────────────────
  identityBlock: {
    paddingHorizontal: spacing.lg,
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
  // The "this opens a switcher" glyph beside the title while collecting.
  switchGlyph: {
    marginTop: 6,
  },
  pageTitle: {
    flex: 1,
    fontFamily: "Lora_500Medium",
    fontSize: 40,
    lineHeight: 50,
    color: "#1C1C19",
  },

  // ── Pinned search wrapper ──────────────────────────────────────────────────
  searchWrapper: {
    paddingHorizontal: spacing.lg,
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
    color: colors.textSecondary,
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
    borderRadius: radii.round,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#3D3732",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
});
