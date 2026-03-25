import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Collection } from "../../../types";
import { styles } from "../../../styles";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { getHierarchyIconColor, getHierarchyIconName } from "../../../hierarchy";

type IdeaListNestedCollectionsSectionProps = {
  childCollections: Collection[];
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpenCollection: (collectionId: string) => void;
  onOpenCollectionActions: (collectionId: string) => void;
};

export function IdeaListNestedCollectionsSection({
  childCollections,
  expanded,
  onToggleExpanded,
  onOpenCollection,
  onOpenCollectionActions,
}: IdeaListNestedCollectionsSectionProps) {
  if (childCollections.length === 0) return null;

  return (
    <View style={nestedCollectionStyles.wrap}>
      <Pressable
        style={({ pressed }) => [
          nestedCollectionStyles.toggleRow,
          expanded ? nestedCollectionStyles.toggleRowOpen : null,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onToggleExpanded}
      >
        <View style={nestedCollectionStyles.toggleCopy}>
          <Text style={nestedCollectionStyles.toggleLabel}>Nested collections</Text>
          <Text style={nestedCollectionStyles.toggleMeta}>
            {childCollections.length} inside this collection
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={15}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={nestedCollectionStyles.list}>
          {childCollections.map((collection) => (
            <View key={collection.id} style={nestedCollectionStyles.itemRow}>
              <Pressable
                style={({ pressed }) => [
                  nestedCollectionStyles.itemMain,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => onOpenCollection(collection.id)}
                onLongPress={() => onOpenCollectionActions(collection.id)}
              >
                <Ionicons
                  name={getHierarchyIconName("collection")}
                  size={14}
                  color={getHierarchyIconColor("collection")}
                />
                <Text style={nestedCollectionStyles.itemTitle} numberOfLines={1}>
                  {collection.title}
                </Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  nestedCollectionStyles.chevronBtn,
                  pressed ? styles.pressDown : null,
                ]}
                onPress={() => onOpenCollection(collection.id)}
              >
                <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const nestedCollectionStyles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  toggleRow: {
    minHeight: 42,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  toggleRowOpen: {
    borderColor: colors.borderMuted,
    backgroundColor: colors.surface,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    ...textTokens.caption,
    color: colors.textStrong,
  },
  toggleMeta: {
    ...textTokens.supporting,
  },
  list: {
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  itemRow: {
    minHeight: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  itemMain: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemTitle: {
    flex: 1,
    ...textTokens.body,
    color: colors.textStrong,
    fontWeight: "600",
  },
  chevronBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
