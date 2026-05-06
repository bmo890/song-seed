import { StyleSheet, Text, View } from "react-native";
import { SurfaceCard } from "../../common/SurfaceCard";
import type { WorkspaceCollectionBrowseEntry } from "../../../libraryNavigation";
import { WorkspaceCollectionCard } from "./WorkspaceCollectionCard";

export function WorkspaceCollectionList({
  collectionEntries,
  primaryCollectionId,
  searchQuery,
  selectionMode,
  selectedCollectionIds,
  onPressCollection,
  onLongPressCollection,
  onOpenCollectionActions,
}: {
  collectionEntries: WorkspaceCollectionBrowseEntry[];
  primaryCollectionId: string | null;
  searchQuery: string;
  selectionMode: boolean;
  selectedCollectionIds: string[];
  onPressCollection: (collectionId: string) => void;
  onLongPressCollection: (collectionId: string) => void;
  onOpenCollectionActions: (collectionId: string) => void;
}) {
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
            onOpenActions={() => onOpenCollectionActions(collection.id)}
          />
        );
      })}

      {collectionEntries.length === 0 ? (
        <SurfaceCard>
          <Text style={listStyles.emptyTitle}>
            {searchQuery.trim().length > 0 ? "No matching collections" : "No collections yet"}
          </Text>
          <Text style={listStyles.emptyMeta}>
            {searchQuery.trim().length > 0
              ? "Try a different search."
              : "Create a collection to start organising seeds in this workspace."}
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
    color: "#84736f",
    marginTop: 4,
  },
});
