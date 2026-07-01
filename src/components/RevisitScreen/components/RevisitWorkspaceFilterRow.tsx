import React from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import type { RevisitSourceOption } from "../../../revisit";
import { revisitStyles } from "../styles";
import { WorkspaceAvatar } from "../../common/WorkspaceAvatar";

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
  const hasCollections = collections.length > 0;
  const excludedCollectionsCount = collections.filter((item) => !item.included).length;

  const metaText =
    `${option.count} ${option.count === 1 ? "idea" : "ideas"}` +
    (hasCollections
      ? ` · ${collections.length} ${collections.length === 1 ? "collection" : "collections"}`
      : "") +
    (excludedCollectionsCount > 0 ? ` · ${excludedCollectionsCount} hidden` : "");

  return (
    <View
      style={[
        revisitStyles.sourceRow,
        option.included ? null : revisitStyles.sourceRowExcluded,
      ]}
    >
      <View style={revisitStyles.sourceTopRow}>
        <View style={option.included ? null : revisitStyles.sourceAvatarMuted}>
          <WorkspaceAvatar
            color={option.color}
            name={option.label}
            avatarKey={option.avatarKey}
            size={36}
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            revisitStyles.sourceCopy,
            pressed && hasCollections ? styles.pressDown : null,
          ]}
          onPress={hasCollections ? onToggleExpand : undefined}
          disabled={!hasCollections}
        >
          <Text style={revisitStyles.sourceTitle} numberOfLines={1}>
            {option.label}
          </Text>
          <View style={revisitStyles.sourceMetaRow}>
            <Text style={revisitStyles.sourceMeta} numberOfLines={1}>
              {metaText}
            </Text>
            {hasCollections ? (
              <Ionicons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={13}
                color="#a89994"
              />
            ) : null}
          </View>
        </Pressable>

        <Switch
          value={option.included}
          onValueChange={onToggleWorkspace}
          trackColor={{ false: "#E3DCD4", true: "#B87D6B" }}
          thumbColor="#ffffff"
        />
      </View>

      {expanded && hasCollections ? (
        option.included ? (
          <View style={revisitStyles.sourceCollections}>
            {collections.map((collection) => {
              const included = collection.included;
              return (
                <Pressable
                  key={collection.id}
                  style={({ pressed }) => [
                    revisitStyles.sourceCollectionRow,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => onToggleCollection(collection.id, !included)}
                  hitSlop={4}
                >
                  <Ionicons
                    name={included ? "checkmark-circle" : "ellipse-outline"}
                    size={17}
                    color={included ? "#824f3f" : "#c3b6ae"}
                  />
                  <Text
                    style={[
                      revisitStyles.sourceCollectionName,
                      included ? null : revisitStyles.sourceCollectionNameOff,
                    ]}
                    numberOfLines={1}
                  >
                    {getCollectionLabel(collection)}
                  </Text>
                  <Text style={revisitStyles.sourceCollectionCount}>{collection.count}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={revisitStyles.sourceHint}>
            Turn this workspace on to choose collections.
          </Text>
        )
      ) : null}
    </View>
  );
}
