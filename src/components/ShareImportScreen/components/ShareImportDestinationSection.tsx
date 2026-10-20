import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "../../common/Press";
import { ListRow, ListRows } from "../../common/ListRow";
import { colors } from "../../../design/tokens";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import type { CollectionDestination } from "../types";
import { styles } from "../styles";
import { useTranslation } from "react-i18next";

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

/** Where the files go: the collection you were in, any other one, or a new one. */
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
  const { t } = useTranslation();
  const collectionIcon = getHierarchyIconName("collection");
  // The path only adds something when the collection sits inside another one.
  const currentMeta =
    currentCollectionPathLabel && currentCollection && currentCollectionPathLabel !== currentCollection.title
      ? `${t("shareImport.currentCollection")} · ${currentCollectionPathLabel}`
      : t("shareImport.currentCollection");
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t("shareImport.destination")}</Text>

      {!currentCollection && currentWorkspaceTitle ? (
        <Text style={styles.helperText}>
          {t("shareImport.importingInto", { workspace: currentWorkspaceTitle })}
        </Text>
      ) : null}

      <ListRows>
        {currentCollection ? (
          <ListRow
            icon={collectionIcon}
            title={currentCollection.title}
            meta={currentMeta}
            onPress={onImportIntoCurrentCollection}
          />
        ) : null}

        <Press
          // Haptics vocabulary: `light` — a section folds open or closed.
          haptic="light"
          style={styles.toggleRow}
          onPress={onToggleOtherCollections}
          accessibilityRole="button"
          accessibilityState={{ expanded: otherCollectionsExpanded }}
        >
          <View style={styles.toggleGlyph}>
            <Ionicons name="folder-open-outline" size={19} color={colors.textStrong} />
          </View>
          <Text style={styles.toggleLabel}>{t("shareImport.anotherCollection")}</Text>
          <Ionicons
            name={otherCollectionsExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={colors.textMuted}
          />
        </Press>

        {otherCollectionsExpanded
          ? otherCollectionDestinations.map((destination) => (
              <View key={`${destination.workspaceId}:${destination.collectionId}`} style={styles.nested}>
                <ListRow
                  icon={collectionIcon}
                  title={destination.pathLabel}
                  meta={destination.workspaceTitle}
                  onPress={() => onSelectDestination(destination)}
                />
              </View>
            ))
          : null}

        {targetWorkspaceTitle && !isResolvingShareAssets ? (
          <ListRow
            icon="add"
            title={t("shareImport.newCollection")}
            meta={t("shareImport.createIn", { workspace: targetWorkspaceTitle })}
            serifTitle={false}
            userTitle={false}
            onPress={onCreateNewCollection}
          />
        ) : null}
      </ListRows>

      {!targetWorkspaceTitle ? <Text style={styles.helperText}>{t("shareImport.noWorkspace")}</Text> : null}
    </View>
  );
}
