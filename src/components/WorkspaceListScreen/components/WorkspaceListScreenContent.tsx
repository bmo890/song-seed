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
import { PickerEyebrow } from "../../common/PickerEyebrow";
import { ScreenHeader } from "../../common/ScreenHeader";
import { PickerFooter } from "../../common/PickerFooter";
import { SelectionActionSheet } from "../../common/SelectionActionSheet";
import { EmptyState } from "../../common/EmptyState";
import { WorkspaceList } from "./WorkspaceList";
import { AppAlert } from "../../common/AppAlert";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { PopoverMenuLabel, PopoverRadioRow } from "../../common/PopoverMenu";

export function WorkspaceListScreenContent() {
  const { t } = useTranslation();
  const model = useWorkspaceListScreenModel();
  const songTargetPicker = useStore((s) => s.songTargetPicker);
  const cancelSongTargetPicking = useStore((s) => s.cancelSongTargetPicking);
  const insets = useSafeAreaInsets();
  const playerDockHeight = useStore((s) => s.playerDockHeight);
  const navigation = useNavigation<any>();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const sortActive = model.data.workspaceListOrder !== "last-worked";
  const sortLabel = model.data.workspaceOrderOptions.find(
    (o) => o.key === model.data.workspaceListOrder
  )?.label ?? t("workspaceList.lastWorked");

  const hasArchived = model.data.archivedWorkspaces.length > 0;
  const hasReceived = model.data.receivedWorkspaces.length > 0;

  return (
    <SafeAreaView style={styles.screen}>
      {/* A place (header rule, 2026-10-15): glyph-only nav row, large Lora title. */}
      <ScreenHeader title={t("workspaceList.title")} variant="place" leftIcon="hamburger" />

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

        {/* Choosing a song for lyrics: the picker eyebrow names the task, and
            a ✕ footer is the way out (2026-09-11). */}
        {songTargetPicker ? (
          <PickerEyebrow testID="picker-eyebrow" icon="document-text-outline" label={t("selection.pickingSongFor")} />
        ) : null}

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
                <PopoverMenuLabel>{t("workspaceList.order")}</PopoverMenuLabel>
                {model.data.workspaceOrderOptions.map((option) => (
                  <PopoverRadioRow
                    key={option.key}
                    label={option.label}
                    selected={option.key === model.data.workspaceListOrder}
                    onPress={() => {
                      model.actions.setWorkspaceListOrder(option.key);
                      setSortMenuOpen(false);
                    }}
                  />
                ))}
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
          <EmptyState
            compact
            icon="albums-outline"
            title={t("workspaceList.emptyTitle")}
            body={t("workspaceList.empty")}
          />
        ) : null}

        {/* ── From others — work imported from other people ──────────────── */}
        {/* Kept in its own group so someone else's songs never blur into yours.
            Appears only once you've actually imported something. */}
        {hasReceived ? (
          <View style={styles.archivedSection}>
            <Text style={styles.sectionLabel}>{t("workspaceList.fromOthers")}</Text>

            <WorkspaceList
              workspaces={model.data.receivedWorkspaces}
              primaryWorkspaceId={model.data.primaryWorkspaceId}
              editingWorkspaceId={model.modal.editId}
              busyWorkspaceId={model.data.busyWorkspaceId}
              busyLabel={model.data.busyLabel}
              onOpenWorkspaceActions={model.modal.openWorkspaceActions}
            />
          </View>
        ) : null}

        {/* ── Archived workspace section ─────────────────────────────────── */}
        {hasArchived ? (
          <View style={styles.archivedSection}>
            <Text style={styles.sectionLabel}>{t("workspaceList.archived")}</Text>

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

      {/* ── Picker footer (choosing a song for lyrics): ✕ is the way out ──── */}
      {songTargetPicker ? (
        <PickerFooter onCancel={cancelSongTargetPicking} cancelLabel={t("common.cancel")} />
      ) : null}

      {/* ── FAB ────────────────────────────────────────────────────────────── */}
      {songTargetPicker ? null : (
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
      )}

      {/* ── Workspace action sheet (ellipsis) ──────────────────────────────── */}
      <SelectionActionSheet
        visible={model.actionSheet.visible}
        title={model.actionSheet.workspace?.title ?? t("workspaceList.workspace")}
        actions={model.actionSheet.actions}
        onClose={model.actionSheet.close}
      />
      {/* Share… drills here: a file, or SongNook Send. */}
      <SelectionActionSheet
        visible={model.shareSheet.visible}
        title={t("workspaceList.shareTitle")}
        actions={model.shareSheet.actions}
        onClose={model.shareSheet.close}
        onBack={model.shareSheet.back}
      />

      {/* ── Workspace edit modal ────────────────────────────────────────────── */}
      <WorkspaceModal
        visible={model.modal.modalOpen}
        title={t(model.modal.isEditing ? "workspaceList.editWorkspace" : "workspaceList.newWorkspace")}
        initialName={model.modal.editingWorkspace?.title}
        initialDescription={model.modal.editingWorkspace?.description}
        initialColor={model.modal.editingWorkspace?.color}
        initialAvatarKey={model.modal.editingWorkspace?.avatarKey}
        onCancel={() => {
          if (model.data.busyWorkspaceId) return;
          model.modal.closeModal();
        }}
        onSave={model.modal.saveWorkspace}
      />

    </SafeAreaView>
  );
}
