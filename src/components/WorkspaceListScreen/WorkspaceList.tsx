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
};

export function WorkspaceList({ onEditWorkspace, editingWorkspaceId, workspaces }: Props) {
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
                    onPress={() => {
                        setActiveWorkspaceId(ws.id);
                        navigation.navigate("Browse" as never);
                    }}
                    onLongPress={() => onEditWorkspace(ws.id)}
                />
            ))}
        </View>
    );
}
