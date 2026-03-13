import React, { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { WorkspaceModal } from "../modals/WorkspaceModal";
import { ClipboardBanner } from "../ClipboardBanner";
import { ScreenHeader } from "../common/ScreenHeader";
import { AppBreadcrumbs } from "../common/AppBreadcrumbs";
import { Button } from "../common/Button";
import { SectionHeader } from "../common/SectionHeader";
import { SegmentedControl } from "../common/SegmentedControl";
import { FilterSortControls } from "../common/FilterSortControls";
import { WorkspaceList } from "./WorkspaceList";
import { formatBytes } from "../../utils";
import {
  getWorkspaceListOrderState,
  sortWorkspacesWithPrimary,
} from "../../libraryNavigation";
import type { WorkspaceListOrder } from "../../types";

function defaultWorkspaceTitle() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `New Workspace ${dd}/${mm}/${yyyy}`;
}

export function WorkspaceListScreen() {
  const workspaces = useStore((s) => s.workspaces);
  const primaryWorkspaceId = useStore((s) => s.primaryWorkspaceId);
  const setPrimaryWorkspaceId = useStore((s) => s.setPrimaryWorkspaceId);
  const workspaceListOrder = useStore((s) => s.workspaceListOrder);
  const setWorkspaceListOrder = useStore((s) => s.setWorkspaceListOrder);
  const workspaceLastOpenedAt = useStore((s) => s.workspaceLastOpenedAt);
  const addWorkspace = useStore((s) => s.addWorkspace);
  const updateWorkspace = useStore((s) => s.updateWorkspace);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);

  const clipClipboard = useStore((s) => s.clipClipboard);
  const cancelClipboard = () => useStore.getState().setClipClipboard(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewingArchived, setViewingArchived] = useState(false);
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"archive" | "restore" | null>(null);

  const editingWorkspace = useMemo(
    () => workspaces.find((ws) => ws.id === editId) ?? null,
    [workspaces, editId]
  );
  const isEditing = !!editId && !!editingWorkspace;
  const filteredWorkspaces = useMemo(
    () =>
      sortWorkspacesWithPrimary(
        workspaces.filter((workspace) => (viewingArchived ? workspace.isArchived : !workspace.isArchived)),
        primaryWorkspaceId,
        workspaceListOrder,
        workspaceLastOpenedAt
      ),
    [primaryWorkspaceId, viewingArchived, workspaceLastOpenedAt, workspaceListOrder, workspaces]
  );
  const workspaceOrderState = getWorkspaceListOrderState(workspaceListOrder);
  const workspaceOrderOptions: Array<{ key: WorkspaceListOrder; label: string; icon: string }> = [
    { key: "last-worked", label: "Last worked", icon: "time-outline" },
    { key: "least-recent", label: "Least recent", icon: "time-outline" },
    { key: "title-az", label: "Title A-Z", icon: "text-outline" },
    { key: "title-za", label: "Title Z-A", icon: "text-outline" },
  ];
  const busyLabel = busyAction === "archive" ? "ARCHIVING" : busyAction === "restore" ? "RESTORING" : null;

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
  }

  async function runArchiveWorkspace(workspaceId: string) {
    setBusyWorkspaceId(workspaceId);
    setBusyAction("archive");
    closeModal();

    try {
      const result = await appActions.archiveWorkspace(workspaceId);
      const summary = [
        `Packed ${result.archiveState.audioFileCount} audio file${result.archiveState.audioFileCount === 1 ? "" : "s"} into ${formatBytes(result.archiveState.packageSizeBytes)}.`,
        `Saved ${formatBytes(result.archiveState.savingsBytes)} on device while keeping the workspace structure and metadata live.`,
      ];
      if (result.warnings.length > 0) {
        summary.push(result.warnings.join(" "));
      }
      Alert.alert("Workspace archived", summary.join(" "));
    } catch (error) {
      Alert.alert("Archive failed", error instanceof Error ? error.message : "Could not archive this workspace.");
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
    }
  }

  async function runUnarchiveWorkspace(workspaceId: string) {
    setBusyWorkspaceId(workspaceId);
    setBusyAction("restore");
    closeModal();

    try {
      const result = await appActions.unarchiveWorkspace(workspaceId);
      const summary = ["Workspace audio was restored and the workspace is active again."];
      if (result.warnings.length > 0) {
        summary.push(result.warnings.join(" "));
      }
      Alert.alert("Workspace restored", summary.join(" "));
    } catch (error) {
      Alert.alert("Restore failed", error instanceof Error ? error.message : "Could not restore this workspace.");
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
    }
  }

  const subtitle = viewingArchived
    ? "Archived workspaces stay out of the active list while their audio is stored in a compressed package."
    : primaryWorkspaceId
      ? "Your primary workspace stays first. The rest follow your chosen order."
      : "Choose a workspace to continue. Archived workspaces are kept separately.";

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Home" leftIcon="hamburger" />
      <AppBreadcrumbs items={[{ key: "home", label: "Home", level: "home", active: true }]} />

      {clipClipboard ? (
        <ClipboardBanner
          count={clipClipboard.clipIds.length}
          mode={clipClipboard.mode}
          onCancel={cancelClipboard}
          actionLabel="Choose workspace"
          disabled={true}
          onAction={() => {
            Alert.alert("Choose a workspace", "You cannot paste items directly on Home. Open a workspace first.");
          }}
        />
      ) : null}

      <Text style={styles.subtitle}>{subtitle}</Text>

      <SegmentedControl
        options={[
          { key: "active", label: "Active" },
          { key: "archived", label: "Archived" },
        ]}
        selectedKey={viewingArchived ? "archived" : "active"}
        onSelect={(value) => setViewingArchived(value === "archived")}
      />

      <View style={styles.inputRow}>
        <Button
          label="New Workspace"
          disabled={!!busyWorkspaceId}
          onPress={() => {
            setEditId(null);
            setModalOpen(true);
          }}
        />
      </View>

      <SectionHeader title={viewingArchived ? "Archived Workspaces" : "Active Workspaces"} />

      <FilterSortControls
        sort={{
          active: workspaceListOrder !== "last-worked",
          valueIcon: workspaceOrderState.icon,
          direction: workspaceOrderState.direction,
          renderMenu: ({ close }) => (
            <View style={styles.ideasDropdownSectionStack}>
              <Text style={styles.ideasDropdownSectionToggleText}>Order</Text>
              {workspaceOrderOptions.map((option) => {
                const active = option.key === workspaceListOrder;
                return (
                  <Pressable
                    key={option.key}
                    style={({ pressed }) => [
                      styles.ideasSortMenuItem,
                      active ? styles.ideasSortMenuItemActive : null,
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={() => {
                      setWorkspaceListOrder(option.key);
                      close();
                    }}
                  >
                    <View style={styles.ideasMenuItemLead}>
                      <Ionicons
                        name={option.icon as any}
                        size={15}
                        color={active ? "#0f172a" : "#64748b"}
                      />
                      <Text
                        style={[
                          styles.ideasSortMenuItemText,
                          active ? styles.ideasSortMenuItemTextActive : null,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {active ? <Ionicons name="checkmark" size={15} color="#0f172a" /> : null}
                  </Pressable>
                );
              })}
            </View>
          ),
        }}
      />

      <WorkspaceList
        workspaces={filteredWorkspaces}
        primaryWorkspaceId={primaryWorkspaceId}
        editingWorkspaceId={editId}
        busyWorkspaceId={busyWorkspaceId}
        busyLabel={busyLabel}
        onTogglePrimaryWorkspace={(workspaceId) => {
          setPrimaryWorkspaceId(primaryWorkspaceId === workspaceId ? null : workspaceId);
        }}
        onEditWorkspace={(id) => {
          if (busyWorkspaceId) return;
          setEditId(id);
          setModalOpen(true);
        }}
      />
      {filteredWorkspaces.length === 0 ? (
        <Text style={styles.emptyText}>
          {viewingArchived ? "No archived workspaces yet." : "No active workspaces available."}
        </Text>
      ) : null}

      <WorkspaceModal
        visible={modalOpen}
        title={isEditing ? "Edit Workspace" : "New Workspace"}
        initialName={editingWorkspace?.title}
        initialDescription={editingWorkspace?.description}
        showDelete={isEditing}
        deleteLabel="Remove workspace"
        onCancel={() => {
          if (busyWorkspaceId) return;
          closeModal();
        }}
        onSave={(name, description) => {
          if (busyWorkspaceId) return;
          const finalName = name || defaultWorkspaceTitle();
          if (isEditing && editingWorkspace) {
            updateWorkspace(editingWorkspace.id, { title: finalName, description });
          } else {
            addWorkspace(finalName, description);
          }
          closeModal();
        }}
        onDelete={() => {
          if (!editingWorkspace || busyWorkspaceId) return;

          if (!editingWorkspace.isArchived && workspaces.filter((w) => !w.isArchived).length <= 1) {
            Alert.alert("Cannot remove", "You must have at least one active workspace.");
            return;
          }

          const options: any[] = [{ text: "Cancel", style: "cancel" }];

          if (editingWorkspace.isArchived) {
            options.push({
              text: "Unarchive",
              onPress: () => {
                void runUnarchiveWorkspace(editingWorkspace.id);
              },
            });
          } else {
            options.push({
              text: "Archive",
              onPress: () => {
                void runArchiveWorkspace(editingWorkspace.id);
              },
            });
          }

          options.push({
            text: "Delete permanently",
            style: "destructive",
            onPress: () => {
              Alert.alert(
                `Delete ${editingWorkspace.title}?`,
                `This will permanently delete ${editingWorkspace.ideas.length} ideas. This cannot be undone.`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => {
                      deleteWorkspace(editingWorkspace.id);
                      closeModal();
                    },
                  },
                ]
              );
            },
          });

          Alert.alert(
            `Remove ${editingWorkspace.title}?`,
            editingWorkspace.isArchived
              ? "Restore this workspace, or delete it permanently."
              : "Archive this workspace to compress and hide it, or delete it permanently.",
            options
          );
        }}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
