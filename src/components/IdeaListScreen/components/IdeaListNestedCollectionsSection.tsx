import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Collection } from "../../../types";
import { styles } from "../../../styles";
import { colors, radii } from "../../../design/tokens";

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
                  name="folder-outline"
                  size={14}
                  color={colors.textSecondary}
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
                <Ionicons name="chevron-forward" size={13} color="#B8A8A3" />
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
    gap: 8,
    marginBottom: 12,
  },
  toggleRow: {
    minHeight: 42,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.3)",
    backgroundColor: colors.page,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleRowOpen: {
    borderColor: "rgba(215,194,189,0.5)",
    backgroundColor: colors.surface,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 12,
    color: "#1C1C19",
  },
  toggleMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
  },
  list: {
    gap: 8,
    paddingLeft: 8,
  },
  itemRow: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(215,194,189,0.3)",
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemMain: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 14,
    color: "#1C1C19",
    },
  chevronBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
