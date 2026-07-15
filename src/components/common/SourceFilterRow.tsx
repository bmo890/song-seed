import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles as baseStyles } from "../../styles";
import { WorkspaceAvatar } from "./WorkspaceAvatar";
import { radii, colors } from "../../design/tokens";

/** A workspace or collection the user can include/exclude from a feed's sources.
 * Shared by Revisit and Activity so the two pages read as the same control. */
export type SourceFilterOption = {
  id: string;
  label: string;
  count: number;
  included: boolean;
  workspaceId?: string;
  color?: string;
  avatarKey?: number;
  isPrimary?: boolean;
};

type SourceFilterRowProps = {
  option: SourceFilterOption;
  collections: SourceFilterOption[];
  expanded: boolean;
  onToggleWorkspace: () => void;
  onToggleExpand: () => void;
  onToggleCollection: (collectionId: string, included: boolean) => void;
};

function getCollectionLabel(option: SourceFilterOption) {
  const dividerIndex = option.label.indexOf(" • ");
  if (dividerIndex === -1) return option.label;
  return option.label.slice(dividerIndex + 3);
}

function PrimaryTag() {
  return (
    <View style={styles.primaryTag}>
      <Ionicons name="star" size={9} color={colors.primaryDeep} />
      <Text style={styles.primaryTagText}>Primary</Text>
    </View>
  );
}

export function SourceFilterRow({
  option,
  collections,
  expanded,
  onToggleWorkspace,
  onToggleExpand,
  onToggleCollection,
}: SourceFilterRowProps) {
  const hasCollections = collections.length > 0;
  const excludedCollectionsCount = collections.filter((item) => !item.included).length;

  const metaText =
    `${option.count} ${option.count === 1 ? "idea" : "ideas"}` +
    (hasCollections
      ? ` · ${collections.length} ${collections.length === 1 ? "collection" : "collections"}`
      : "") +
    (excludedCollectionsCount > 0 ? ` · ${excludedCollectionsCount} hidden` : "");

  return (
    <View style={[styles.row, option.included ? null : styles.rowExcluded]}>
      <View style={styles.topRow}>
        <View style={option.included ? null : styles.avatarMuted}>
          <WorkspaceAvatar
            color={option.color}
            name={option.label}
            avatarKey={option.avatarKey}
            size={36}
          />
        </View>

        <Pressable
          style={({ pressed }) => [styles.copy, pressed && hasCollections ? baseStyles.pressDown : null]}
          onPress={hasCollections ? onToggleExpand : undefined}
          disabled={!hasCollections}
        >
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {option.label}
            </Text>
            {option.isPrimary ? <PrimaryTag /> : null}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={1}>
              {metaText}
            </Text>
            {hasCollections ? (
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={13} color={colors.textMuted} />
            ) : null}
          </View>
        </Pressable>

        <Switch
          value={option.included}
          onValueChange={onToggleWorkspace}
          trackColor={{ false: "#E3DCD4", true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>

      {expanded && hasCollections ? (
        option.included ? (
          <View style={styles.collections}>
            {collections.map((collection) => {
              const included = collection.included;
              return (
                <Pressable
                  key={collection.id}
                  style={({ pressed }) => [styles.collectionRow, pressed ? baseStyles.pressDown : null]}
                  onPress={() => onToggleCollection(collection.id, !included)}
                  hitSlop={4}
                >
                  <Ionicons
                    name={included ? "checkmark-circle" : "ellipse-outline"}
                    size={17}
                    color={included ? colors.primaryDeep : "#c3b6ae"}
                  />
                  <Text
                    style={[styles.collectionName, included ? null : styles.collectionNameOff]}
                    numberOfLines={1}
                  >
                    {getCollectionLabel(collection)}
                  </Text>
                  {collection.isPrimary ? <PrimaryTag /> : null}
                  <Text style={styles.collectionCount}>{collection.count}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.hint}>Turn this workspace on to choose collections.</Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: "#F8F4EE",
    borderRadius: radii.xl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  rowExcluded: {
    backgroundColor: "#F4F1EC",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarMuted: {
    opacity: 0.4,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  title: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Primary marker — star + label in the app's terracotta, shared by workspace
  // and collection rows.
  primaryTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F2E4DF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  primaryTagText: {
    fontSize: 9.5,
    fontFamily: "PlusJakartaSans_700Bold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: colors.primaryDeep,
  },
  // Collections as a quiet indented sub-list under a hairline, not chips.
  collections: {
    marginLeft: 48,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EBE3D8",
  },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
  },
  collectionName: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: "#4a3f3b",
  },
  collectionNameOff: {
    color: "#b3a49c",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  collectionCount: {
    marginLeft: "auto",
    fontSize: 12,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  hint: {
    marginLeft: 48,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EBE3D8",
    fontSize: 12,
    color: colors.textMuted,
  },
});
