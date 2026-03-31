import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../../common/SurfaceCard";
import { styles } from "../styles";
import { formatBytes } from "../../../utils";
import { getHierarchyIconColor, getHierarchyIconName } from "../../../hierarchy";
import type { CollectionSearchMatchKind } from "../../../libraryNavigation";

type WorkspaceCollectionCardProps = {
  entry: {
    collection: { id: string; title: string };
    itemCount: number;
    matches: Array<{ kind: CollectionSearchMatchKind; label: string; context?: string | null }>;
  };
  isPrimary: boolean;
  searchQuery: string;
  selectionMode: boolean;
  isSelected: boolean;
  sizeBytes: number;
  onPress: () => void;
  onLongPress: () => void;
};

function getMatchIcon(kind: CollectionSearchMatchKind): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case "collection":
      return getHierarchyIconName("collection");
    case "subcollection":
      return getHierarchyIconName("collection");
    case "song":
      return getHierarchyIconName("song");
    case "clip":
    default:
      return getHierarchyIconName("clip");
  }
}

function getMatchLabel(kind: CollectionSearchMatchKind) {
  switch (kind) {
    case "collection":
      return "Collection:";
    case "subcollection":
      return "Inside:";
    case "song":
      return "Song:";
    case "clip":
    default:
      return "Clip:";
  }
}

function HighlightedText({ value, query }: { value: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{value}</>;

  const lowerValue = value.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const matchIndex = lowerValue.indexOf(lowerNeedle);

  if (matchIndex < 0) return <>{value}</>;

  const before = value.slice(0, matchIndex);
  const match = value.slice(matchIndex, matchIndex + needle.length);
  const after = value.slice(matchIndex + needle.length);

  return (
    <>
      {before}
      <Text style={styles.workspaceBrowseMatchHighlight}>{match}</Text>
      {after}
    </>
  );
}

export function WorkspaceCollectionCard({
  entry,
  isPrimary,
  searchQuery,
  selectionMode,
  isSelected,
  sizeBytes,
  onPress,
  onLongPress,
}: WorkspaceCollectionCardProps) {
  const collection = entry.collection;

  return (
    <SurfaceCard
      style={isPrimary ? styles.workspaceCardPrimary : null}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.cardTop}>
        <View style={selectionMode ? styles.cardTitleRowCompact : styles.cardTitleRow}>
          {selectionMode ? (
            <View style={styles.cardSelectionLead}>
              <View
                style={[
                  styles.selectionIndicatorCircle,
                  isSelected ? styles.selectionIndicatorActive : null,
                ]}
              >
                {isSelected ? <Text style={styles.selectionBadgeText}>✓</Text> : null}
              </View>
            </View>
          ) : null}
          <Ionicons
            name={getHierarchyIconName("collection")}
            size={18}
            color={getHierarchyIconColor("collection")}
          />
          <Text style={styles.cardTitle}>
            <HighlightedText value={collection.title} query={searchQuery} />
          </Text>
          {isPrimary ? <Ionicons name="star" size={14} color="#c58b18" /> : null}
        </View>

        <View style={styles.workspaceCardBadges}>
          {isPrimary ? <Text style={[styles.badge, styles.badgeArchived]}>MAIN</Text> : null}
        </View>
      </View>

      <View style={styles.workspaceBrowseCollectionMetaRow}>
        <Text style={styles.cardMeta}>
          {entry.itemCount} {entry.itemCount === 1 ? "item" : "items"}
        </Text>
        <Text style={styles.cardMeta}>•</Text>
        <Text style={styles.cardMeta}>{formatBytes(sizeBytes)}</Text>
      </View>

      {searchQuery.trim().length > 0 && entry.matches.length > 0 ? (
        <View style={styles.workspaceBrowseMatchRow}>
          {entry.matches.map((match, index) => (
            <View
              key={`${match.kind}-${match.label}-${index}`}
              style={styles.workspaceBrowseMatchBadge}
            >
              <Ionicons name={getMatchIcon(match.kind)} size={12} color="#64748b" />
              <Text style={styles.workspaceBrowseMatchText} numberOfLines={1}>
                {getMatchLabel(match.kind)}{" "}
                <HighlightedText value={match.label} query={searchQuery} />
                {match.context ? (
                  <Text style={styles.workspaceBrowseMatchContext}> in {match.context}</Text>
                ) : null}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </SurfaceCard>
  );
}
