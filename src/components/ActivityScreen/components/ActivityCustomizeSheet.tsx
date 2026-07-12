import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "../../common/BottomSheet";
import { styles as baseStyles } from "../../../styles";
import { SourceFilterRow, type SourceFilterOption } from "../../common/SourceFilterRow";

type WorkspaceGroup = {
  workspace: SourceFilterOption;
  collections: SourceFilterOption[];
};

type ActivityCustomizeSheetProps = {
  visible: boolean;
  onClose: () => void;
  groups: WorkspaceGroup[];
  expandedWorkspaceId: string | null;
  setExpandedWorkspaceId: (updater: (prev: string | null) => string | null) => void;
  setWorkspaceIncluded: (workspaceId: string, included: boolean) => void;
  setCollectionIncluded: (collectionId: string, included: boolean) => void;
  hasSourceOverrides: boolean;
  resetSourceFilters: () => void;
};

export function ActivityCustomizeSheet({
  visible,
  onClose,
  groups,
  expandedWorkspaceId,
  setExpandedWorkspaceId,
  setWorkspaceIncluded,
  setCollectionIncluded,
  hasSourceOverrides,
  resetSourceFilters,
}: ActivityCustomizeSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Customize Activity</Text>

      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.sectionLabel}>Sources</Text>
          {hasSourceOverrides ? (
            <Pressable
              style={({ pressed }) => [styles.reset, pressed ? baseStyles.pressDown : null]}
              onPress={resetSourceFilters}
            >
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.sectionDesc}>
          Which workspaces and collections feed your activity heatmap.
        </Text>

        <View style={styles.list}>
          {groups.map(({ workspace, collections }) => (
            <SourceFilterRow
              key={workspace.id}
              option={workspace}
              collections={collections}
              expanded={expandedWorkspaceId === workspace.id}
              onToggleWorkspace={() => setWorkspaceIncluded(workspace.id, !workspace.included)}
              onToggleExpand={() =>
                setExpandedWorkspaceId((prev) => (prev === workspace.id ? null : workspace.id))
              }
              onToggleCollection={(collectionId, included) =>
                setCollectionIncluded(collectionId, included)
              }
            />
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: "PlayfairDisplay_600SemiBold",
    fontSize: 19,
    color: "#1b1c1a",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#84736f",
  },
  sectionDesc: {
    marginTop: -6,
    marginBottom: 12,
    fontSize: 12,
    lineHeight: 16,
    color: "#9a8b83",
  },
  reset: {
    borderRadius: 4,
    backgroundColor: "#e4deda",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  resetText: {
    fontSize: 12,
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1b1c1a",
  },
  list: {
    gap: 10,
    paddingBottom: 8,
  },
});
