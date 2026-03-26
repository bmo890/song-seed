import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NavRow } from "../../common/NavRow";
import { SurfaceCard } from "../../common/SurfaceCard";
import { colors } from "../../../design/tokens";
import { getHierarchyIconColor, getHierarchyIconName } from "../../../hierarchy";
import type { CollectionDestination } from "../types";
import { styles } from "../styles";

type Props = {
  currentCollection: {
    title: string;
  } | null;
  currentCollectionPathLabel: string | null;
  currentWorkspaceTitle: string | null;
  otherCollectionsExpanded: boolean;
  otherCollectionDestinations: CollectionDestination[];
  targetWorkspaceTitle: string | null;
  isResolvingShareAssets: boolean;
  onToggleOtherCollections: () => void;
  onImportIntoCurrentCollection: () => void;
  onSelectDestination: (destination: CollectionDestination) => void;
  onCreateNewCollection: () => void;
};

export function ShareImportDestinationSection({
  currentCollection,
  currentCollectionPathLabel,
  currentWorkspaceTitle,
  otherCollectionsExpanded,
  otherCollectionDestinations,
  targetWorkspaceTitle,
  isResolvingShareAssets,
  onToggleOtherCollections,
  onImportIntoCurrentCollection,
  onSelectDestination,
  onCreateNewCollection,
}: Props) {
  return (
    <SurfaceCard>
      <Text style={styles.sectionTitle}>Destination</Text>

      {currentCollection ? (
        <NavRow
          icon={getHierarchyIconName("collection")}
          iconColor={getHierarchyIconColor("collection")}
          label={currentCollection.title}
          eyebrow="Current collection"
          accessory={
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textMuted}
            />
          }
          onPress={onImportIntoCurrentCollection}
        />
      ) : (
        <Text style={styles.helperText}>
          No current collection is active, so choose another collection or create a new
          one.
        </Text>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.toggleRow,
          pressed ? styles.pressDown : null,
        ]}
        onPress={onToggleOtherCollections}
      >
        <Text style={styles.toggleLabel}>Another collection</Text>
        <Ionicons
          name={otherCollectionsExpanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.textMuted}
        />
      </Pressable>

      {otherCollectionsExpanded ? (
        <View style={styles.collectionList}>
          {otherCollectionDestinations.map((destination) => (
            <NavRow
              key={`${destination.workspaceId}:${destination.collectionId}`}
              icon={getHierarchyIconName("collection")}
              iconColor={getHierarchyIconColor("collection")}
              label={destination.pathLabel}
              eyebrow={destination.workspaceTitle}
              nested
              accessory={
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              }
              onPress={() => onSelectDestination(destination)}
            />
          ))}
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.newCollectionRow,
          pressed ? styles.pressDown : null,
          !targetWorkspaceTitle || isResolvingShareAssets ? styles.disabled : null,
        ]}
        onPress={onCreateNewCollection}
        disabled={!targetWorkspaceTitle || isResolvingShareAssets}
      >
        <View style={styles.newCollectionCopy}>
          <Text style={styles.newCollectionTitle}>New collection from import</Text>
          <Text style={styles.newCollectionMeta}>
            {targetWorkspaceTitle
              ? `Create it in ${targetWorkspaceTitle} and add the shared files there.`
              : "No workspace is available for a new collection yet."}
          </Text>
        </View>
        <Ionicons name="add" size={16} color={colors.textSecondary} />
      </Pressable>

      {currentCollectionPathLabel || currentWorkspaceTitle ? (
        <Text style={styles.helperText}>
          {currentCollectionPathLabel
            ? `Current path: ${currentCollectionPathLabel}`
            : `Importing into ${currentWorkspaceTitle}`}
        </Text>
      ) : null}
    </SurfaceCard>
  );
}
