import { colors } from "../../../design/tokens";
import { StyleSheet, View } from "react-native";
import { EmptyState } from "../../common/EmptyState";
import type { WorkspaceCollectionBrowseEntry } from "../../../domain/libraryNavigation";
import { WorkspaceCollectionCard } from "./WorkspaceCollectionCard";
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
      {collectionEntries.length > 0 ? (
        // Rows on paper (2026-10-15): structure carries no surface; a hairline
        // above the first row and under each.
        <View style={listStyles.group}>
          {collectionEntries.map((entry, index) => {
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
        </View>
      ) : null}

      {collectionEntries.length === 0 ? (
        searchQuery.trim().length > 0 ? (
          <EmptyState
            compact
            icon="search-outline"
            title={t("workspaceBrowse.noMatches")}
            body={t("workspaceBrowse.trySearch")}
          />
        ) : (
          <EmptyState
            compact
            icon="folder-outline"
            title={t("workspaceBrowse.noCollections")}
            body={t("workspaceBrowse.createHint")}
          />
        )
      ) : null}
    </View>
  );
}

const listStyles = StyleSheet.create({
  list: {
    gap: 12,
  },
  group: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderMuted,
  },
});
