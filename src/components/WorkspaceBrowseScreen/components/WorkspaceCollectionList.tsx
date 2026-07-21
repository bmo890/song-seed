import { StyleSheet, Text, View } from "react-native";
import { SurfaceCard } from "../../common/SurfaceCard";
import type { WorkspaceCollectionBrowseEntry } from "../../../domain/libraryNavigation";
import { WorkspaceCollectionCard } from "./WorkspaceCollectionCard";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

export function WorkspaceCollectionList({
  collectionEntries,
  primaryCollectionId,
  searchQuery,
  selectionMode,
  selectedCollectionIds,
  onPressCollection,
  onLongPressCollection,
}: {
  collectionEntries: WorkspaceCollectionBrowseEntry[];
  primaryCollectionId: string | null;
  searchQuery: string;
  selectionMode: boolean;
  selectedCollectionIds: string[];
  onPressCollection: (collectionId: string) => void;
  onLongPressCollection: (collectionId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={listStyles.list}>
      {collectionEntries.map((entry) => {
        const collection = entry.collection;
        const isSelected = selectedCollectionIds.includes(collection.id);
        return (
          <WorkspaceCollectionCard
            key={collection.id}
            entry={entry}
            isPrimary={primaryCollectionId === collection.id}
            searchQuery={searchQuery}
            selectionMode={selectionMode}
            isSelected={isSelected}
            onPress={() => onPressCollection(collection.id)}
            onLongPress={() => onLongPressCollection(collection.id)}
          />
        );
      })}

      {collectionEntries.length === 0 ? (
        <SurfaceCard>
          <Text style={listStyles.emptyTitle}>
            {t(searchQuery.trim().length > 0 ? "workspaceBrowse.noMatches" : "workspaceBrowse.noCollections")}
          </Text>
          <Text style={listStyles.emptyMeta}>
            {searchQuery.trim().length > 0
              ? t("workspaceBrowse.trySearch")
              : t("workspaceBrowse.createHint")}
          </Text>
        </SurfaceCard>
      ) : null}
    </View>
  );
}

const listStyles = StyleSheet.create({
  list: {
    gap: 12,
  },
  emptyTitle: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15,
    color: "#1C1C19",
  },
  emptyMeta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
