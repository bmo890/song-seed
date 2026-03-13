import React from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { WorkspaceCard } from "../cards/WorkspaceCard";
import { useStore } from "../../state/useStore";
import { Workspace } from "../../types";

type Props = {
  onEditWorkspace: (id: string) => void;
  onTogglePrimaryWorkspace: (id: string) => void;
  editingWorkspaceId: string | null;
  primaryWorkspaceId: string | null;
  workspaces: Workspace[];
  busyWorkspaceId?: string | null;
  busyLabel?: string | null;
};

export function WorkspaceList({
  onEditWorkspace,
  onTogglePrimaryWorkspace,
  editingWorkspaceId,
  primaryWorkspaceId,
  workspaces,
  busyWorkspaceId,
  busyLabel,
}: Props) {
  const navigation = useNavigation();
  const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useStore((s) => s.setActiveWorkspaceId);

  return (
    <View style={styles.listContent}>
      {workspaces.map((workspace) => (
        <WorkspaceCard
          key={workspace.id}
          workspace={workspace}
          isActive={workspace.id === activeWorkspaceId}
          isPrimary={workspace.id === primaryWorkspaceId}
          isEditing={workspace.id === editingWorkspaceId}
          isBusy={workspace.id === busyWorkspaceId}
          busyLabel={workspace.id === busyWorkspaceId ? busyLabel ?? undefined : undefined}
          onPress={() => {
            if (workspace.id === busyWorkspaceId) return;
            if (workspace.isArchived) {
              onEditWorkspace(workspace.id);
              return;
            }
            setActiveWorkspaceId(workspace.id);
            navigation.navigate("Browse" as never);
          }}
          onLongPress={() => {
            if (workspace.id === busyWorkspaceId) return;
            onEditWorkspace(workspace.id);
          }}
          onTogglePrimary={() => onTogglePrimaryWorkspace(workspace.id)}
        />
      ))}
    </View>
  );
}
