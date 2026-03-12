import React, { useMemo, useState } from "react";
import { Alert, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
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
import { WorkspaceList } from "./WorkspaceList";

function defaultWorkspaceTitle() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = String(now.getFullYear());
  return `New Workspace ${dd}/${mm}/${yyyy}`;
}

export function WorkspaceListScreen() {
  const workspaces = useStore((s) => s.workspaces);
  const addWorkspace = useStore((s) => s.addWorkspace);
  const updateWorkspace = useStore((s) => s.updateWorkspace);
  const deleteWorkspace = useStore((s) => s.deleteWorkspace);
  const archiveWorkspace = useStore((s) => s.archiveWorkspace);

  const clipClipboard = useStore((s) => s.clipClipboard);
  const cancelClipboard = () => useStore.getState().setClipClipboard(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewingArchived, setViewingArchived] = useState(false);

  const editingWorkspace = useMemo(() => workspaces.find((ws) => ws.id === editId) ?? null, [workspaces, editId]);
  const isEditing = !!editId && !!editingWorkspace;
  const filteredWorkspaces = workspaces.filter(w => viewingArchived ? w.isArchived : !w.isArchived);

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

      <Text style={styles.subtitle}>Choose a workspace to continue.</Text>

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
          onPress={() => {
            setEditId(null);
            setModalOpen(true);
          }}
        />
      </View>

      <SectionHeader title="Workspaces" />

      <WorkspaceList
        workspaces={filteredWorkspaces}
        editingWorkspaceId={editId}
        onEditWorkspace={(id) => {
          setEditId(id);
          setModalOpen(true);
        }}
      />

      <WorkspaceModal
        visible={modalOpen}
        title={isEditing ? "Edit Workspace" : "New Workspace"}
        initialName={editingWorkspace?.title}
        initialDescription={editingWorkspace?.description}
        showDelete={isEditing}
        deleteLabel="Remove workspace"
        onCancel={() => {
          setModalOpen(false);
          setEditId(null);
        }}
        onSave={(name, description) => {
          const finalName = name || defaultWorkspaceTitle();
          if (isEditing && editingWorkspace) {
            updateWorkspace(editingWorkspace.id, { title: finalName, description });
          } else {
            addWorkspace(finalName, description);
          }
          setModalOpen(false);
          setEditId(null);
        }}
        onDelete={() => {
          if (!editingWorkspace) return;

          if (!editingWorkspace.isArchived && workspaces.filter(w => !w.isArchived).length <= 1) {
            Alert.alert("Cannot remove", "You must have at least one active workspace.");
            return;
          }

          const options: any[] = [
            { text: "Cancel", style: "cancel" }
          ];

          if (editingWorkspace.isArchived) {
            options.push({
              text: "Unarchive",
              onPress: () => {
                archiveWorkspace(editingWorkspace.id, false);
                setModalOpen(false);
                setEditId(null);
              }
            });
          } else {
            options.push({
              text: "Archive",
              onPress: () => {
                archiveWorkspace(editingWorkspace.id, true);
                setModalOpen(false);
                setEditId(null);
              }
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
                      setModalOpen(false);
                      setEditId(null);
                    }
                  }
                ]
              );
            },
          });

          Alert.alert(
            `Remove ${editingWorkspace.title}?`,
            `Do you want to archive this workspace to hide it, or delete it permanently?`,
            options
          );
        }}
      />

      <ExpoStatusBar style="dark" />
    </SafeAreaView>
  );
}
