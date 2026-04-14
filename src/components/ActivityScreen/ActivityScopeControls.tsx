import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { styles } from "../../styles";
import { Collection, Workspace } from "../../types";
import { getHierarchyIconName } from "../../hierarchy";
import { sortWorkspacesWithPrimary } from "../../libraryNavigation";

type ActivityScopeControlsProps = {
  collectionScopeActive: boolean;
  workspaces: Workspace[];
  primaryWorkspaceId: string | null;
  workspaceLastOpenedAt: Record<string, number>;
  workspaceFilterId: string | null;
  topLevelCollections: Collection[];
  collectionFilterId: string | null;
  onSelectWorkspace: (workspaceId: string | null) => void;
  onSelectCollection: (collectionId: string | null) => void;
};

export function ActivityScopeControls({
  collectionScopeActive,
  workspaces,
  primaryWorkspaceId,
  workspaceLastOpenedAt,
  workspaceFilterId,
  topLevelCollections,
  collectionFilterId,
  onSelectWorkspace,
  onSelectCollection,
}: ActivityScopeControlsProps) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [collectionMenuOpen, setCollectionMenuOpen] = useState(false);
  const [workspaceAnchorX, setWorkspaceAnchorX] = useState(0);
  const [collectionAnchorX, setCollectionAnchorX] = useState(112);
  const selectedWorkspace =
    workspaceFilterId == null
      ? null
      : workspaces.find((workspace) => workspace.id === workspaceFilterId) ?? null;
  const selectedWorkspaceLabel =
    workspaceFilterId == null
      ? "All workspaces"
      : selectedWorkspace?.title ?? "Workspace";
  const selectedCollection =
    collectionFilterId == null
      ? null
      : topLevelCollections.find((collection) => collection.id === collectionFilterId) ?? null;
  const orderedWorkspaces = sortWorkspacesWithPrimary(
    workspaces,
    primaryWorkspaceId,
    "last-worked",
    workspaceLastOpenedAt
  );

  const closeMenus = () => {
    setWorkspaceMenuOpen(false);
    setCollectionMenuOpen(false);
  };

  return (
    <>
      {!collectionScopeActive ? (
        <View style={styles.ideasToolbar}>
          {workspaceMenuOpen || collectionMenuOpen ? (
            <Pressable style={styles.ideasToolbarBackdrop} onPress={closeMenus} />
          ) : null}

          <View style={styles.ideasUtilityRow}>
            <View style={styles.ideasUtilityRowLeft}>
              <View
                onLayout={(event) => {
                  setWorkspaceAnchorX(event.nativeEvent.layout.x);
                }}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.ideasUtilityChip,
                    workspaceMenuOpen ? styles.ideasUtilityChipOpen : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    setWorkspaceMenuOpen((prev) => !prev);
                    setCollectionMenuOpen(false);
                  }}
                >
                  <Ionicons
                    name={getHierarchyIconName("workspace")}
                    size={15}
                    color={workspaceFilterId == null ? "#84736f" : "#1b1c1a"}
                  />
                  <Text style={styles.ideasUtilityChipText} numberOfLines={1}>
                    {selectedWorkspaceLabel}
                  </Text>
                  <Ionicons
                    name={workspaceMenuOpen ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#84736f"
                  />
                </Pressable>
              </View>

              {selectedWorkspace ? (
                <View
                  onLayout={(event) => {
                    setCollectionAnchorX(event.nativeEvent.layout.x);
                  }}
                >
                  <Pressable
                    style={({ pressed }) => [
                      styles.ideasUtilityChip,
                      collectionMenuOpen ? styles.ideasUtilityChipOpen : null,
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={() => {
                      setCollectionMenuOpen((prev) => !prev);
                      setWorkspaceMenuOpen(false);
                    }}
                  >
                    <Ionicons
                      name={getHierarchyIconName("collection")}
                      size={15}
                      color={collectionFilterId == null ? "#84736f" : "#1b1c1a"}
                    />
                    <Text style={styles.ideasUtilityChipText} numberOfLines={1}>
                      {selectedCollection?.title ?? "All collections"}
                    </Text>
                    <Ionicons
                      name={collectionMenuOpen ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#84736f"
                    />
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          {workspaceMenuOpen ? (
            <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, { left: workspaceAnchorX }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.ideasSortMenuItem,
                  workspaceFilterId == null ? styles.ideasSortMenuItemActive : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => {
                  onSelectWorkspace(null);
                  onSelectCollection(null);
                  closeMenus();
                }}
              >
                <View style={styles.ideasMenuItemLead}>
                  <Ionicons name={getHierarchyIconName("workspace")} size={15} color="#84736f" />
                  <Text
                    style={[
                      styles.ideasSortMenuItemText,
                      workspaceFilterId == null ? styles.ideasSortMenuItemTextActive : null,
                    ]}
                  >
                    All workspaces
                  </Text>
                </View>
              </Pressable>
              {orderedWorkspaces.map((workspace) => (
                <Pressable
                  key={workspace.id}
                  style={({ pressed }) => [
                    styles.ideasSortMenuItem,
                    workspaceFilterId === workspace.id ? styles.ideasSortMenuItemActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    onSelectWorkspace(workspace.id);
                    onSelectCollection(null);
                    closeMenus();
                  }}
                >
                  <View style={styles.ideasMenuItemLead}>
                    <Ionicons name={getHierarchyIconName("workspace")} size={15} color="#84736f" />
                    <Text
                      style={[
                        styles.ideasSortMenuItemText,
                        workspaceFilterId === workspace.id
                          ? styles.ideasSortMenuItemTextActive
                          : null,
                      ]}
                    >
                      {workspace.title}
                    </Text>
                    {workspace.id === primaryWorkspaceId ? (
                      <Ionicons name="star" size={12} color="#c58b18" />
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          {selectedWorkspace && collectionMenuOpen ? (
            <View style={[styles.ideasSortMenu, styles.ideasPopoverMenu, { left: collectionAnchorX }]}>
              <Pressable
                style={({ pressed }) => [
                  styles.ideasSortMenuItem,
                  collectionFilterId == null ? styles.ideasSortMenuItemActive : null,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => {
                  onSelectCollection(null);
                  closeMenus();
                }}
              >
                <View style={styles.ideasMenuItemLead}>
                  <Ionicons name={getHierarchyIconName("collection")} size={15} color="#84736f" />
                  <Text
                    style={[
                      styles.ideasSortMenuItemText,
                      collectionFilterId == null ? styles.ideasSortMenuItemTextActive : null,
                    ]}
                  >
                    All collections
                  </Text>
                </View>
              </Pressable>
              {topLevelCollections.map((collection) => (
                <Pressable
                  key={collection.id}
                  style={({ pressed }) => [
                    styles.ideasSortMenuItem,
                    collectionFilterId === collection.id ? styles.ideasSortMenuItemActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    onSelectCollection(collection.id);
                    closeMenus();
                  }}
                >
                  <View style={styles.ideasMenuItemLead}>
                    <Ionicons name={getHierarchyIconName("collection")} size={15} color="#84736f" />
                    <Text
                      style={[
                        styles.ideasSortMenuItemText,
                        collectionFilterId === collection.id
                          ? styles.ideasSortMenuItemTextActive
                          : null,
                      ]}
                    >
                      {collection.title}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
