import { StyleSheet, Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { Collection } from "../../../types";
import { styles } from "../../../styles";
import { colors, radii } from "../../../design/tokens";
import { useTranslation } from "react-i18next";
import { UserText } from "../../../i18n";

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
  const { t } = useTranslation();
  if (childCollections.length === 0) return null;

  return (
    <View style={nestedCollectionStyles.wrap}>
      <Press
        haptic="none"
        style={[nestedCollectionStyles.toggleRow,
          expanded ? nestedCollectionStyles.toggleRowOpen : null]}
        onPress={onToggleExpanded}
      >
        <View style={nestedCollectionStyles.toggleCopy}>
          <Text style={nestedCollectionStyles.toggleLabel}>{t("collection.nested")}</Text>
          <Text style={nestedCollectionStyles.toggleMeta}>
            {t("collection.nestedCount", { count: childCollections.length })}
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={15}
          color={colors.textSecondary}
        />
      </Press>

      {expanded ? (
        <View style={nestedCollectionStyles.list}>
          {childCollections.map((collection) => (
            <View key={collection.id} style={nestedCollectionStyles.itemRow}>
              <Press
                haptic="none"
                style={nestedCollectionStyles.itemMain}
                onPress={() => onOpenCollection(collection.id)}
                onLongPress={() => onOpenCollectionActions(collection.id)}
              >
                <Ionicons
                  name="folder-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <UserText style={nestedCollectionStyles.itemTitle} numberOfLines={1}>
                  {collection.title}
                </UserText>
              </Press>

              <Press
                haptic="none"
                style={nestedCollectionStyles.chevronBtn}
                onPress={() => onOpenCollection(collection.id)}
              >
                <Ionicons name={dirIcon("chevron-forward")} size={13} color="#B8A8A3" />
              </Press>
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
