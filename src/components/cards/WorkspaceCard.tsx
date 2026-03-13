import { Text, View } from "react-native";
import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { Workspace } from "../../types";
import { formatBytes, getWorkspaceSizeBytes } from "../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../hierarchy";
import { SurfaceCard } from "../common/SurfaceCard";

type Props = {
    workspace: Workspace;
    isActive: boolean;
    isEditing: boolean;
    isBusy?: boolean;
    busyLabel?: string;
    onPress: () => void;
    onLongPress: () => void;
};

export function WorkspaceCard({ workspace, isActive, isEditing, isBusy = false, busyLabel, onPress, onLongPress }: Props) {
    const [sizeBytes, setSizeBytes] = useState<number>(0);
    const topLevelCollectionCount = workspace.collections.filter((collection) => !collection.parentCollectionId).length;
    const itemCount = workspace.ideas.length;

    useEffect(() => {
        if (workspace.isArchived) {
            setSizeBytes(workspace.archiveState?.packageSizeBytes ?? 0);
            return;
        }

        let isMounted = true;
        getWorkspaceSizeBytes(workspace).then((bytes) => {
            if (isMounted) {
                setSizeBytes((prev) => (prev === bytes ? prev : bytes));
            }
        });
        return () => {
            isMounted = false;
        };
    }, [workspace.archiveState?.packageSizeBytes, workspace.collections, workspace.ideas, workspace.isArchived]);

    const archiveState = workspace.archiveState;
    const archiveSummary = workspace.isArchived
        ? archiveState
            ? `Package ${formatBytes(archiveState.packageSizeBytes)}`
            : "Hidden only"
        : formatBytes(sizeBytes);
    const savingsSummary =
        workspace.isArchived && archiveState
            ? `Saved ${formatBytes(archiveState.savingsBytes)}`
            : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
    const warningSummary =
        workspace.isArchived && archiveState?.missingFileCount
            ? `${archiveState.missingFileCount} missing file${archiveState.missingFileCount === 1 ? "" : "s"}`
            : null;

    return (
        <SurfaceCard
            style={isEditing ? styles.cardEditing : null}
            onPress={onPress}
            onLongPress={onLongPress}
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
                {isBusy ? (
                    <Text style={[styles.badge, styles.badgeArchived]}>{busyLabel ?? "WORKING"}</Text>
                ) : workspace.isArchived ? (
                    <Text style={[styles.badge, styles.badgeArchived]}>ARCHIVED</Text>
                ) : isActive ? (
                    <Text style={[styles.badge, styles.badgeCurrent]}>CURRENT</Text>
                ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <Text style={styles.cardMeta}>
                    {topLevelCollectionCount} {topLevelCollectionCount === 1 ? "collection" : "collections"}
                </Text>
                <Text style={styles.cardMeta}>•</Text>
                <Text style={styles.cardMeta}>{archiveSummary}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <Text style={styles.cardMeta}>{savingsSummary}</Text>
                {warningSummary ? (
                    <>
                        <Text style={styles.cardMeta}>•</Text>
                        <Text style={[styles.cardMeta, styles.cardMetaWarning]}>{warningSummary}</Text>
                    </>
                ) : null}
            </View>
            {workspace.description ? <Text style={styles.cardMeta}>{workspace.description}</Text> : null}
        </SurfaceCard>
    );
}
