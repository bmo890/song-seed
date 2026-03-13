import React from "react";
import { View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { styles } from "../../styles";
import { WorkspaceCard } from "../cards/WorkspaceCard";
import { useStore } from "../../state/useStore";
import { Workspace } from "../../types";

type Props = {
    onEditWorkspace: (id: string) => void;
    editingWorkspaceId: string | null;
    workspaces: Workspace[];
    busyWorkspaceId?: string | null;
    busyLabel?: string | null;
};

export function WorkspaceList({ onEditWorkspace, editingWorkspaceId, workspaces, busyWorkspaceId, busyLabel }: Props) {
    const navigation = useNavigation();
    const activeWorkspaceId = useStore((s) => s.activeWorkspaceId);
    const setActiveWorkspaceId = useStore((s) => s.setActiveWorkspaceId);

    return (
        <View style={styles.listContent}>
            {workspaces.map((ws) => (
                <WorkspaceCard
                    key={ws.id}
                    workspace={ws}
                    isActive={ws.id === activeWorkspaceId}
                    isEditing={ws.id === editingWorkspaceId}
                    isBusy={ws.id === busyWorkspaceId}
                    busyLabel={ws.id === busyWorkspaceId ? busyLabel ?? undefined : undefined}
                    onPress={() => {
                        if (ws.id === busyWorkspaceId) {
                            return;
                        }
                        if (ws.isArchived) {
                            onEditWorkspace(ws.id);
                            return;
                        }
                        setActiveWorkspaceId(ws.id);
                        navigation.navigate("Browse" as never);
                    }}
                    onLongPress={() => {
                        if (ws.id === busyWorkspaceId) {
                            return;
                        }
                        onEditWorkspace(ws.id);
                    }}
                />
            ))}
        </View>
    );
}
