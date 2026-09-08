import { StyleSheet, View } from "react-native";
import { SurfaceCard } from "../../common/SurfaceCard";
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
        // One flat structural group (SurfaceCard's r8 shell, no padding) — the
        // rows inside carry their own insets and hairlines.
        <SurfaceCard style={listStyles.group}>
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
                divided={index > 0}
                onPress={() => onPressCollection(collection.id)}
                onLongPress={() => onLongPressCollection(collection.id)}
              />
            );
          })}
        </SurfaceCard>
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
    padding: 0,
    gap: 0,
    overflow: "hidden",
  },
});
