import React from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useStore } from "../../../state/useStore";
import { styles } from "../styles";
import { WorkspaceCard } from "../../cards/WorkspaceCard";
import type { Workspace } from "../../../types";

type Props = {
  onOpenWorkspaceActions: (id: string) => void;
  editingWorkspaceId: string | null;
  primaryWorkspaceId: string | null;
  workspaces: Workspace[];
  busyWorkspaceId?: string | null;
  busyLabel?: string | null;
  selectionMode?: boolean;
  selectedWorkspaceIds?: string[];
  onToggleSelection?: (id: string) => void;
};

export function WorkspaceList({
  onOpenWorkspaceActions,
  editingWorkspaceId,
  primaryWorkspaceId,
  workspaces,
  busyWorkspaceId,
  busyLabel,
  selectionMode = false,
  selectedWorkspaceIds = [],
  onToggleSelection,
}: Props) {
  const navigation = useNavigation<any>();
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
          isSelected={selectedWorkspaceIds.includes(workspace.id)}
          selectionMode={selectionMode}
          isBusy={workspace.id === busyWorkspaceId}
          busyLabel={workspace.id === busyWorkspaceId ? busyLabel ?? undefined : undefined}
          onPress={() => {
            if (workspace.id === busyWorkspaceId) return;
            if (selectionMode) {
              onToggleSelection?.(workspace.id);
              return;
            }
            if (workspace.isArchived) {
              onOpenWorkspaceActions(workspace.id);
              return;
            }
            setActiveWorkspaceId(workspace.id);
            navigation.navigate("WorkspaceStack", { screen: "Browse" });
          }}
          onLongPress={() => {
            if (workspace.id === busyWorkspaceId) return;
            if (selectionMode) {
              onToggleSelection?.(workspace.id);
              return;
            }
            onToggleSelection?.(workspace.id);
          }}
        />
      ))}
    </View>
  );
}
