import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../../common/SurfaceCard";
import type { CollectionSearchMatchKind } from "../../../domain/libraryNavigation";
import type { Collection } from "../../../types";
import { formatLastEdited } from "../../../utils";

type WorkspaceCollectionCardProps = {
  entry: {
    collection: Collection;
    itemCount: number;
    childCollectionCount: number;
    matches: Array<{ kind: CollectionSearchMatchKind; label: string; context?: string | null }>;
  };
  isPrimary: boolean;
  searchQuery: string;
  selectionMode: boolean;
  isSelected: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

function getMatchLabel(kind: CollectionSearchMatchKind): string {
  switch (kind) {
    case "collection": return "Collection:";
    case "subcollection": return "Inside:";
    case "song": return "Song:";
    case "notes": return "Notes:";
    case "lyrics": return "Lyrics:";
    case "chords": return "Chord:";
    case "clip":
    default: return "Clip:";
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
      <Text style={cardStyles.matchHighlight}>{match}</Text>
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
  onPress,
  onLongPress,
}: WorkspaceCollectionCardProps) {
  const { collection, itemCount, childCollectionCount, matches } = entry;

  const metaParts = [
    `${itemCount} ${itemCount === 1 ? "seed" : "seeds"}`,
    childCollectionCount > 0
      ? `${childCollectionCount} ${childCollectionCount === 1 ? "sub-collection" : "sub-collections"}`
      : null,
    formatLastEdited(collection.updatedAt),
  ].filter(Boolean).join("  ·  ");

  return (
    <SurfaceCard
      testID={`collection-card-${collection.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
      onPress={onPress}
      onLongPress={onLongPress}
      selected={isSelected}
    >
      {/* Title row */}
      <View style={cardStyles.cardTop}>
        {selectionMode ? (
          <View style={[cardStyles.selectionDot, isSelected ? cardStyles.selectionDotActive : null]}>
            {isSelected ? <Ionicons name="checkmark" size={10} color="#FFFFFF" /> : null}
          </View>
        ) : null}

        <Text style={cardStyles.title} numberOfLines={1}>
          <HighlightedText value={collection.title} query={searchQuery} />
        </Text>

        {isPrimary ? (
          <View style={cardStyles.primaryBadge}>
            <Ionicons name="star" size={10} color="#B87D6B" />
            <Text style={cardStyles.primaryLabel}>Primary</Text>
          </View>
        ) : null}
      </View>

      {/* Meta row */}
      <Text style={cardStyles.meta}>{metaParts}</Text>

      {/* Description */}
      {collection.description ? (
        <Text style={cardStyles.description} numberOfLines={2}>
          {collection.description}
        </Text>
      ) : null}

      {/* Search match badges */}
      {searchQuery.trim().length > 0 && matches.length > 0 ? (
        <View style={cardStyles.matchRow}>
          {matches.map((match, index) => (
            <View key={`${match.kind}-${match.label}-${index}`} style={cardStyles.matchBadge}>
              <Text style={cardStyles.matchText} numberOfLines={1}>
                {getMatchLabel(match.kind)}{" "}
                <HighlightedText value={match.label} query={searchQuery} />
                {match.context ? (
                  <Text style={cardStyles.matchContext}> in {match.context}</Text>
                ) : null}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

    </SurfaceCard>
  );
}

const cardStyles = StyleSheet.create({
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectionDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#D7C2BD",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectionDotActive: {
    backgroundColor: "#B87D6B",
    borderColor: "#B87D6B",
  },
  title: {
    flex: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
    color: "#1C1C19",
  },
  primaryBadge: {
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  primaryLabel: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 7,
    color: "#B87D6B",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    opacity: 0.85,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#84736f",
    marginTop: 6,
  },
  description: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#524440",
    marginTop: 6,
  },
  matchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  matchBadge: {
    backgroundColor: "#F4F1ED",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  matchText: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    color: "#524440",
  },
  matchHighlight: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: "#1C1C19",
  },
  matchContext: {
    color: "#84736f",
  },
});

