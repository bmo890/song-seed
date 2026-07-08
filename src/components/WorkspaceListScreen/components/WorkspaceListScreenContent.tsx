import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../styles";
import { useWorkspaceListScreenModel } from "../hooks/useWorkspaceListScreenModel";
import { useStore } from "../../../state/useStore";
import { WorkspaceModal } from "../../modals/WorkspaceModal";
import { ClipboardBanner } from "../../ClipboardBanner";
import { SongTargetPickerBanner } from "../../SongTargetPickerBanner";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { WorkspaceList } from "./WorkspaceList";
import { AppAlert } from "../../common/AppAlert";

export function WorkspaceListScreenContent() {
  const model = useWorkspaceListScreenModel();
  const songTargetPicker = useStore((s) => s.songTargetPicker);
  const cancelSongTargetPicking = useStore((s) => s.cancelSongTargetPicking);
  const insets = useSafeAreaInsets();
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const navigation = useNavigation<any>();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

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

  const sortActive = model.data.workspaceListOrder !== "last-worked";
  const sortLabel = model.data.workspaceOrderOptions.find(
    (o) => o.key === model.data.workspaceListOrder
  )?.label ?? "Last worked";

  const hasArchived = model.data.archivedWorkspaces.length > 0;

  return (
    <SafeAreaView style={styles.screen}>

      {songTargetPicker ? (
        <SongTargetPickerBanner count={songTargetPicker.noteIds.length} onCancel={cancelSongTargetPicking} />
      ) : null}

      {model.clipClipboard ? (
        <ClipboardBanner
          count={model.clipClipboard.clipIds.length}
          mode={model.clipClipboard.mode}
          onCancel={model.cancelClipboard}
          actionLabel="Choose workspace"
          disabled={true}
          onAction={() => {
            AppAlert.info(
              "Choose a workspace",
              "You cannot paste items directly on Home. Open a workspace first."
            );
          }}
        />
      ) : null}

      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.hamburgerBtn, pressed ? styles.pressDown : null]}
            onPress={openDrawer}
            hitSlop={8}
          >
            <Ionicons name="menu-outline" size={22} color="#84736f" />
          </Pressable>
          <Text style={styles.eyebrow}>Creative Overview</Text>
          <Text style={styles.pageTitle}>Your Workspaces</Text>
        </View>

        {/* ── Sort control ─────────────────────────────────────────────────── */}
        <View style={styles.sortRow}>
          <View style={styles.sortMenuContainer}>
            {sortMenuOpen ? (
              <Pressable
                style={styles.sortMenuBackdrop}
                onPress={() => setSortMenuOpen(false)}
              />
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.sortPill,
                sortActive ? styles.sortPillActive : null,
                pressed ? styles.pressDown : null,
              ]}
              onPress={() => setSortMenuOpen((prev) => !prev)}
            >
              <Ionicons
                name="swap-vertical-outline"
                size={13}
                color={sortActive ? "#1b1c1a" : "#84736f"}
              />
              <Text
                style={[
                  styles.sortPillText,
                  sortActive ? styles.sortPillTextActive : null,
                ]}
              >
                {sortLabel}
              </Text>
            </Pressable>

            {sortMenuOpen ? (
              <View style={styles.sortMenu}>
                <View style={styles.orderMenuSection}>
                  <Text style={styles.orderMenuTitle}>Order</Text>
                  {model.data.workspaceOrderOptions.map((option) => {
                    const active = option.key === model.data.workspaceListOrder;
                    return (
                      <Pressable
                        key={option.key}
                        style={({ pressed }) => [
                          styles.orderMenuItem,
                          active ? styles.orderMenuItemActive : null,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() => {
                          model.actions.setWorkspaceListOrder(option.key);
                          setSortMenuOpen(false);
                        }}
                      >
                        <View style={styles.orderMenuItemLead}>
                          <Ionicons
                            name={option.icon as any}
                            size={14}
                            color={active ? "#1b1c1a" : "#84736f"}
                          />
                          <Text
                            style={[
                              styles.orderMenuItemText,
                              active ? styles.orderMenuItemTextActive : null,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </View>
                        {active ? (
                          <Ionicons name="checkmark" size={14} color="#B87D6B" />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Active workspace list ────────────────────────────────────────── */}
        <WorkspaceList
          workspaces={model.data.activeWorkspaces}
          primaryWorkspaceId={model.data.primaryWorkspaceId}
          editingWorkspaceId={model.modal.editId}
          busyWorkspaceId={model.data.busyWorkspaceId}
          busyLabel={model.data.busyLabel}
          onOpenWorkspaceActions={model.modal.openWorkspaceActions}
        />

        {model.data.activeWorkspaces.length === 0 ? (
          <Text style={styles.emptyText}>No active workspaces. Tap + to create one.</Text>
        ) : null}

        {/* ── Archived workspace section ─────────────────────────────────── */}
        {hasArchived ? (
          <View style={styles.archivedSection}>
            <View style={styles.archivedSectionHeader}>
              <Text style={styles.archivedHeading}>Archived</Text>
              <View style={styles.archivedDivider} />
            </View>

            <WorkspaceList
              workspaces={model.data.archivedWorkspaces}
              primaryWorkspaceId={model.data.primaryWorkspaceId}
              editingWorkspaceId={model.modal.editId}
              busyWorkspaceId={model.data.busyWorkspaceId}
              busyLabel={model.data.busyLabel}
              onOpenWorkspaceActions={model.modal.openWorkspaceActions}
            />
          </View>
        ) : null}

      </ScrollView>

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { bottom: playerDockHeight > 0 ? playerDockHeight + 12 : Math.max(32, insets.bottom + 16) },
          pressed ? styles.pressDown : null,
        ]}
        onPress={() => {
          model.modal.setEditId(null);
          model.modal.setModalOpen(true);
        }}
      >
        <Ionicons name="add" size={26} color="#ffffff" />
      </Pressable>

      {/* ── Workspace action sheet (ellipsis) ──────────────────────────────── */}
      <SelectionActionSheet
        visible={model.actionSheet.visible}
        title={model.actionSheet.workspace?.title ?? "Workspace"}
        actions={model.actionSheet.actions}
        onClose={model.actionSheet.close}
      />

      {/* ── Workspace edit modal ────────────────────────────────────────────── */}
      <WorkspaceModal
        visible={model.modal.modalOpen}
        title={model.modal.isEditing ? "Edit Workspace" : "New Workspace"}
        initialName={model.modal.editingWorkspace?.title}
        initialDescription={model.modal.editingWorkspace?.description}
        initialColor={model.modal.editingWorkspace?.color}
        initialAvatarKey={model.modal.editingWorkspace?.avatarKey}
        showArchiveAction={false}
        showDelete={false}
        onCancel={() => {
          if (model.data.busyWorkspaceId) return;
          model.modal.closeModal();
        }}
        onSave={model.modal.saveWorkspace}
        onArchiveAction={() => {}}
        onDelete={() => {}}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
