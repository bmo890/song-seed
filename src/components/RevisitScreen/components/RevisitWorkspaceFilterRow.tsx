import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import type { RevisitSourceOption } from "../../../revisit";
import { revisitStyles } from "../styles";
import { RevisitSourceChip } from "./RevisitSourceChip";

type RevisitWorkspaceFilterRowProps = {
  option: RevisitSourceOption;
  collections: RevisitSourceOption[];
  expanded: boolean;
  onToggleWorkspace: () => void;
  onToggleExpand: () => void;
  onToggleCollection: (collectionId: string, included: boolean) => void;
};

function getCollectionLabel(option: RevisitSourceOption) {
  const dividerIndex = option.label.indexOf(" • ");
  if (dividerIndex === -1) return option.label;
  return option.label.slice(dividerIndex + 3);
}

export function RevisitWorkspaceFilterRow({
  option,
  collections,
  expanded,
  onToggleWorkspace,
  onToggleExpand,
  onToggleCollection,
}: RevisitWorkspaceFilterRowProps) {
  const excludedCollectionsCount = collections.filter((item) => !item.included).length;

  return (
    <View
      style={[
        revisitStyles.workspaceFilterRow,
        option.included ? revisitStyles.workspaceFilterRowIncluded : null,
      ]}
    >
      <View style={revisitStyles.workspaceFilterTopRow}>
        <Pressable
          style={({ pressed }) => [
            revisitStyles.workspaceIncludeToggle,
            option.included ? revisitStyles.workspaceIncludeToggleIncluded : null,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onToggleWorkspace}
        >
          <Ionicons
            name={option.included ? "checkmark-circle" : "ellipse-outline"}
            size={18}
            color={option.included ? "#9a3412" : "#94a3b8"}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            revisitStyles.workspaceFilterMain,
            pressed ? styles.pressDown : null,
          ]}
          onPress={onToggleExpand}
        >
          <View style={revisitStyles.workspaceFilterCopy}>
            <Text style={revisitStyles.workspaceFilterTitle}>{option.label}</Text>
            <Text style={styles.cardMeta}>
              {option.count} ideas
              {collections.length > 0 ? ` • ${collections.length} collections` : ""}
              {excludedCollectionsCount > 0 ? ` • ${excludedCollectionsCount} hidden` : ""}
            </Text>
          </View>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="#94a3b8"
          />
        </Pressable>
      </View>

      {expanded ? (
        <View style={revisitStyles.workspaceDropdown}>
          {option.included && collections.length > 0 ? (
            <View style={revisitStyles.filterWrap}>
              {collections.map((collection) => (
                <RevisitSourceChip
                  key={collection.id}
                  option={{ ...collection, label: getCollectionLabel(collection) }}
                  onPress={() => onToggleCollection(collection.id, !collection.included)}
                />
              ))}
            </View>
          ) : option.included ? (
            <Text style={styles.cardMeta}>No collections yet.</Text>
          ) : (
            <Text style={styles.cardMeta}>Include this workspace to filter collections.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
