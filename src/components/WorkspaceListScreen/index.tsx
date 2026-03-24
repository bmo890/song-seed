import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { appActions } from "../../state/actions";
import { WorkspaceModal } from "../modals/WorkspaceModal";
import { ClipboardBanner } from "../ClipboardBanner";
import { ScreenHeader } from "../common/ScreenHeader";
import { Button } from "../common/Button";
import { SelectionActionSheet } from "../common/SelectionActionSheet";
import { SelectionDock, type SelectionAction } from "../common/SelectionDock";
import { SectionHeader } from "../common/SectionHeader";
import { SegmentedControl } from "../common/SegmentedControl";
import { FilterSortControls } from "../common/FilterSortControls";
import { WorkspaceList } from "./WorkspaceList";
import { formatBytes } from "../../utils";
import { getWorkspaceListOrderState, sortWorkspacesWithPrimary } from "../../libraryNavigation";
import type { Workspace, WorkspaceListOrder } from "../../types";
import { useBrowseRootBackHandler } from "../../hooks/useBrowseRootBackHandler";

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
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [selectionMoreVisible, setSelectionMoreVisible] = useState(false);
  const [selectionDockHeight, setSelectionDockHeight] = useState(120);

  const editingWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === editId) ?? null,
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
  const activeWorkspaceCount = workspaces.filter((workspace) => !workspace.isArchived).length;
  const selectionMode = selectedWorkspaceIds.length > 0;
  const selectableWorkspaceIds = filteredWorkspaces.map((workspace) => workspace.id);
  const selectedWorkspaces = useMemo(
    () => workspaces.filter((workspace) => selectedWorkspaceIds.includes(workspace.id)),
    [selectedWorkspaceIds, workspaces]
  );
  const singleSelectedWorkspace = selectedWorkspaces.length === 1 ? selectedWorkspaces[0] ?? null : null;
  const allSelectableSelected =
    selectableWorkspaceIds.length > 0 &&
    selectableWorkspaceIds.every((workspaceId) => selectedWorkspaceIds.includes(workspaceId));
  const canDeselectAll =
    allSelectableSelected || (selectableWorkspaceIds.length === 0 && selectedWorkspaceIds.length > 0);

  useBrowseRootBackHandler({
    onBack: () => {
      if (selectedWorkspaceIds.length > 0) {
        setSelectedWorkspaceIds([]);
        setSelectionMoreVisible(false);
        return;
      }
    },
  });

  useEffect(() => {
    const visibleWorkspaceIdSet = new Set(filteredWorkspaces.map((workspace) => workspace.id));
    setSelectedWorkspaceIds((prev) => {
      const next = prev.filter((workspaceId) => visibleWorkspaceIdSet.has(workspaceId));
      if (next.length === prev.length && next.every((workspaceId, index) => workspaceId === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [filteredWorkspaces]);

  function closeModal() {
    setModalOpen(false);
    setEditId(null);
  }

  function openWorkspaceActions(workspaceId: string) {
    if (busyWorkspaceId) return;
    setEditId(workspaceId);
    setModalOpen(true);
  }

  function toggleWorkspaceSelection(workspaceId: string) {
    setSelectedWorkspaceIds((prev) =>
      prev.includes(workspaceId)
        ? prev.filter((candidateId) => candidateId !== workspaceId)
        : [...prev, workspaceId]
    );
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

  async function runSelectionWorkspaceArchive(action: "archive" | "restore") {
    if (selectedWorkspaces.length === 0) return;

    if (action === "archive" && activeWorkspaceCount - selectedWorkspaces.length < 1) {
      Alert.alert("Cannot archive", "You must keep at least one active workspace.");
      return;
    }

    setBusyWorkspaceId("__selection__");
    setBusyAction(action);
    setSelectionMoreVisible(false);

    const successes: string[] = [];
    const failures: string[] = [];

    try {
      for (const workspace of selectedWorkspaces) {
        try {
          if (action === "archive") {
            await appActions.archiveWorkspace(workspace.id);
          } else {
            await appActions.unarchiveWorkspace(workspace.id);
          }
          successes.push(workspace.title);
        } catch (error) {
          failures.push(
            `${workspace.title}: ${error instanceof Error ? error.message : `Could not ${action} this workspace.`}`
          );
        }
      }
    } finally {
      setBusyWorkspaceId(null);
      setBusyAction(null);
      setSelectedWorkspaceIds([]);
    }

    if (failures.length > 0) {
      Alert.alert(
        action === "archive" ? "Archive incomplete" : "Restore incomplete",
        [
          successes.length > 0
            ? `${successes.length} workspace${successes.length === 1 ? "" : "s"} ${action === "archive" ? "archived" : "restored"}.`
            : null,
          failures.join("\n"),
        ]
          .filter(Boolean)
          .join("\n\n")
      );
      return;
    }

    Alert.alert(
      action === "archive" ? "Workspaces archived" : "Workspaces restored",
      `${successes.length} workspace${successes.length === 1 ? "" : "s"} ${action === "archive" ? "archived" : "restored"}.`
    );
  }

  function confirmArchiveSelection(action: "archive" | "restore") {
    if (selectedWorkspaces.length === 0 || busyWorkspaceId) return;

    Alert.alert(
      action === "archive" ? "Archive workspaces?" : "Unarchive workspaces?",
      action === "archive"
        ? `Archive ${selectedWorkspaces.length} selected workspace${selectedWorkspaces.length === 1 ? "" : "s"}?`
        : `Restore ${selectedWorkspaces.length} selected workspace${selectedWorkspaces.length === 1 ? "" : "s"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action === "archive" ? "Archive" : "Unarchive",
          onPress: () => {
            void runSelectionWorkspaceArchive(action);
          },
        },
      ]
    );
  }

  function confirmDeleteSelection() {
    if (selectedWorkspaces.length === 0 || busyWorkspaceId) return;
    const deletingAllActiveSelection = !viewingArchived && activeWorkspaceCount <= selectedWorkspaces.length;

    Alert.alert(
      "Delete workspaces?",
      deletingAllActiveSelection
        ? `This will permanently delete ${selectedWorkspaces.length} workspace${selectedWorkspaces.length === 1 ? "" : "s"}. Song Seed will create a fresh empty workspace so the app still has an active home context. This cannot be undone.`
        : `This will permanently delete ${selectedWorkspaces.length} workspace${selectedWorkspaces.length === 1 ? "" : "s"}. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            selectedWorkspaces.forEach((workspace) => deleteWorkspace(workspace.id));
            setSelectedWorkspaceIds([]);
            setSelectionMoreVisible(false);
          },
        },
      ]
    );
  }

  function confirmArchiveWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;

    if (!workspace.isArchived && activeWorkspaceCount <= 1) {
      Alert.alert("Cannot archive", "You must keep at least one active workspace.");
      return;
    }

    if (workspace.isArchived) {
      Alert.alert(
        `Unarchive ${workspace.title}?`,
        "This restores the compressed audio and returns the workspace to the active list.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unarchive",
            onPress: () => {
              void runUnarchiveWorkspace(workspace.id);
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      `Archive ${workspace.title}?`,
      "This compresses the workspace audio, removes the workspace from the active list, and keeps it available to restore later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          onPress: () => {
            void runArchiveWorkspace(workspace.id);
          },
        },
      ]
    );
  }

  function confirmDeleteWorkspace(workspace: Workspace) {
    if (busyWorkspaceId) return;
    const deletingFinalActiveWorkspace = !workspace.isArchived && activeWorkspaceCount <= 1;

    Alert.alert(
      `Delete ${workspace.title}?`,
      deletingFinalActiveWorkspace
        ? `This will permanently delete ${workspace.ideas.length} ideas. Song Seed will create a fresh empty workspace so the app still has an active home context. This cannot be undone.`
        : `This will permanently delete ${workspace.ideas.length} ideas. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            deleteWorkspace(workspace.id);
            closeModal();
          },
        },
      ]
    );
  }

  const subtitle = viewingArchived
    ? "Archived workspaces stay out of the active list while their audio is stored in a compressed package."
    : primaryWorkspaceId
      ? "Your primary workspace stays first. The rest follow your chosen order."
      : "Choose a workspace to continue. Archived workspaces are kept separately.";
  const selectionDockActions: SelectionAction[] = singleSelectedWorkspace
    ? viewingArchived
      ? [
          {
            key: "rename",
            label: "Rename",
            icon: "create-outline",
            onPress: () => {
              openWorkspaceActions(singleSelectedWorkspace.id);
              setSelectedWorkspaceIds([]);
            },
          },
          {
            key: "restore",
            label: "Unarchive",
            icon: "arrow-up-circle-outline",
            onPress: () => confirmArchiveSelection("restore"),
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
            key: "rename",
            label: "Rename",
            icon: "create-outline",
            onPress: () => {
              openWorkspaceActions(singleSelectedWorkspace.id);
              setSelectedWorkspaceIds([]);
            },
          },
          {
            key: "primary",
            label: primaryWorkspaceId === singleSelectedWorkspace.id ? "Unset primary" : "Set primary",
            icon: primaryWorkspaceId === singleSelectedWorkspace.id ? "star" : "star-outline",
            onPress: () => {
              setPrimaryWorkspaceId(
                primaryWorkspaceId === singleSelectedWorkspace.id ? null : singleSelectedWorkspace.id
              );
              setSelectedWorkspaceIds([]);
            },
          },
          {
            key: "archive",
            label: "Archive",
            icon: "archive-outline",
            onPress: () => confirmArchiveSelection("archive"),
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
          key: viewingArchived ? "restore" : "archive",
          label: viewingArchived ? "Unarchive" : "Archive",
          icon: viewingArchived ? "arrow-up-circle-outline" : "archive-outline",
          onPress: () => confirmArchiveSelection(viewingArchived ? "restore" : "archive"),
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
      onPress: () => setSelectedWorkspaceIds(canDeselectAll ? [] : selectableWorkspaceIds),
      disabled: !canDeselectAll && selectableWorkspaceIds.length === 0,
    },
    {
      key: "delete",
      label: "Delete",
      icon: "trash-outline",
      tone: "danger",
      onPress: confirmDeleteSelection,
    },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Home" leftIcon="hamburger" />

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

      <ScrollView
        style={styles.flexFill}
        contentContainerStyle={[
          styles.libraryScrollContent,
          {
            paddingBottom: selectionMode ? selectionDockHeight + 24 + 24 : 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>{subtitle}</Text>

        <SegmentedControl
          options={[
            { key: "active", label: "Active" },
            { key: "archived", label: "Archived" },
          ]}
          selectedKey={viewingArchived ? "archived" : "active"}
          onSelect={(value) => setViewingArchived(value === "archived")}
        />

        {!selectionMode ? (
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
        ) : null}

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
          selectionMode={selectionMode}
          selectedWorkspaceIds={selectedWorkspaceIds}
          onToggleSelection={toggleWorkspaceSelection}
          onTogglePrimaryWorkspace={(workspaceId) => {
            setPrimaryWorkspaceId(primaryWorkspaceId === workspaceId ? null : workspaceId);
          }}
          onOpenWorkspaceActions={openWorkspaceActions}
        />
        {filteredWorkspaces.length === 0 ? (
          <Text style={styles.emptyText}>
            {viewingArchived ? "No archived workspaces yet." : "No active workspaces available."}
          </Text>
        ) : null}
      </ScrollView>

      {selectionMode ? (
        <>
          <SelectionDock
            count={selectedWorkspaceIds.length}
            actions={selectionDockActions}
            onDone={() => setSelectedWorkspaceIds([])}
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

      <WorkspaceModal
        visible={modalOpen}
        title={isEditing ? "Edit Workspace" : "New Workspace"}
        initialName={editingWorkspace?.title}
        initialDescription={editingWorkspace?.description}
        showArchiveAction={isEditing}
        archiveActionLabel={editingWorkspace?.isArchived ? "Unarchive" : "Archive"}
        archiveActionDisabled={!!busyWorkspaceId}
        showDelete={isEditing}
        deleteLabel="Delete permanently"
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
        onArchiveAction={() => {
          if (!editingWorkspace) return;
          confirmArchiveWorkspace(editingWorkspace);
        }}
        onDelete={() => {
          if (!editingWorkspace) return;
          confirmDeleteWorkspace(editingWorkspace);
        }}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
