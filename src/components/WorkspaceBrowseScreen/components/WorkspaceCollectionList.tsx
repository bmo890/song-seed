import { Text, View } from "react-native";
import { SurfaceCard } from "../../common/SurfaceCard";
import { styles } from "../styles";
import type { CollectionSearchMatchKind } from "../../../libraryNavigation";
import { WorkspaceCollectionCard } from "./WorkspaceCollectionCard";

export function WorkspaceCollectionList({
  collectionEntries,
  primaryCollectionId,
  searchQuery,
  selectionMode,
  selectedCollectionIds,
  sizeMap,
  onPressCollection,
  onLongPressCollection,
}: {
  collectionEntries: Array<{
    collection: { id: string; title: string };
    itemCount: number;
    matches: Array<{ kind: CollectionSearchMatchKind; label: string; context?: string | null }>;
  }>;
  primaryCollectionId: string | null;
  searchQuery: string;
  selectionMode: boolean;
  selectedCollectionIds: string[];
  sizeMap: Record<string, number>;
  onPressCollection: (collectionId: string) => void;
  onLongPressCollection: (collectionId: string) => void;
}) {
  return (
    <View style={styles.listContent}>
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
            sizeBytes={sizeMap[collection.id] ?? 0}
            onPress={() => onPressCollection(collection.id)}
            onLongPress={() => onLongPressCollection(collection.id)}
          />
        );
      })}

      {collectionEntries.length === 0 ? (
        <SurfaceCard>
          <Text style={styles.cardTitle}>
            {searchQuery.trim().length > 0 ? "No matching collections" : "No collections yet"}
          </Text>
          <Text style={styles.cardMeta}>
            {searchQuery.trim().length > 0
              ? "Try a different search."
              : "Create a collection to start organizing songs and clips in this workspace."}
          </Text>
        </SurfaceCard>
      ) : null}
    </View>
  );
}
