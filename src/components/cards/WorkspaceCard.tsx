import { Pressable, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { Workspace } from "../../types";
import { getWorkspaceSizeBytes } from "../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";

type Props = {
    workspace: Workspace;
    isActive: boolean;
    isEditing: boolean;
    onPress: () => void;
    onLongPress: () => void;
};

export function WorkspaceCard({ workspace, isActive, isEditing, onPress, onLongPress }: Props) {
    const [sizeBytes, setSizeBytes] = useState<number>(0);
    const topLevelCollectionCount = workspace.collections.filter((collection) => !collection.parentCollectionId).length;

    useEffect(() => {
        let isMounted = true;
        getWorkspaceSizeBytes(workspace).then((bytes) => {
            if (isMounted) {
                setSizeBytes((prev) => (prev === bytes ? prev : bytes));
            }
        });
        return () => {
            isMounted = false;
        };
    }, [workspace.collections, workspace.ideas]);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 KB";
        const k = 1024;
        const decimals = 1;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    };

    return (
        <Pressable
            style={[styles.card, isEditing ? styles.cardEditing : null]}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={250}
        >
            <View style={styles.cardTop}>
                <View style={styles.cardTitleRow}>
                    <Ionicons
                      name={getHierarchyIconName("workspace")}
                      size={16}
                      color={getHierarchyIconColor("workspace")}
                    />
                    <Text style={styles.cardTitle}>{workspace.title}</Text>
                </View>
                {isActive ? <Text style={[styles.badge, styles.badgeCurrent]}>CURRENT</Text> : null}
            </View>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Text style={styles.cardMeta}>
                    {topLevelCollectionCount} {topLevelCollectionCount === 1 ? "collection" : "collections"}
                </Text>
                <Text style={styles.cardMeta}>•</Text>
                <Text style={styles.cardMeta}>{formatSize(sizeBytes)}</Text>
            </View>
            {workspace.description ? <Text style={styles.cardMeta}>{workspace.description}</Text> : null}
        </Pressable>
    );
}
