import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

export function WorkspaceListScreenContent() {
  const { t } = useTranslation();
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
  )?.label ?? t("workspaceList.lastWorked");

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
          actionLabel={t("workspaceList.chooseWorkspace")}
          disabled={true}
          onAction={() => {
            AppAlert.info(
              t("workspaceList.chooseWorkspaceTitle"),
              t("workspaceList.pasteHint")
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
            <Ionicons name="menu-outline" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.eyebrow}>{t("workspaceList.eyebrow")}</Text>
          <Text style={styles.pageTitle}>{t("workspaceList.title")}</Text>
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
                color={sortActive ? colors.textPrimary : colors.textSecondary}
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
                  <Text style={styles.orderMenuTitle}>{t("workspaceList.order")}</Text>
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
                            color={active ? colors.textPrimary : colors.textSecondary}
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
                          <Ionicons name="checkmark" size={14} color={colors.primary} />
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
          <Text style={styles.emptyText}>{t("workspaceList.empty")}</Text>
        ) : null}

        {/* ── Archived workspace section ─────────────────────────────────── */}
        {hasArchived ? (
          <View style={styles.archivedSection}>
            <View style={styles.archivedSectionHeader}>
              <Text style={styles.archivedHeading}>{t("workspaceList.archived")}</Text>
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
        testID="workspace-add"
        accessibilityRole="button"
        accessibilityLabel={t("workspaceList.newWorkspace")}
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
        <Ionicons name="add" size={26} color={colors.surface} />
      </Pressable>

      {/* ── Workspace action sheet (ellipsis) ──────────────────────────────── */}
      <SelectionActionSheet
        visible={model.actionSheet.visible}
        title={model.actionSheet.workspace?.title ?? t("workspaceList.workspace")}
        actions={model.actionSheet.actions}
        onClose={model.actionSheet.close}
      />

      {/* ── Workspace edit modal ────────────────────────────────────────────── */}
      <WorkspaceModal
        visible={model.modal.modalOpen}
        title={t(model.modal.isEditing ? "workspaceList.editWorkspace" : "workspaceList.newWorkspace")}
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

    </SafeAreaView>
  );
}
