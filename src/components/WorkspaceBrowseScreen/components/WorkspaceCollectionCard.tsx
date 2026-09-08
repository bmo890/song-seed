import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { dirIcon } from "../../../design/directionalIcons";
import { colors, radii } from "../../../design/tokens";
import { styles } from "../../../styles";
import type { CollectionSearchMatchKind } from "../../../domain/libraryNavigation";
import type { Collection } from "../../../types";
import { formatLastEdited } from "../../../utils";
import { UserText } from "../../../i18n";
import { useTranslation } from "react-i18next";

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
  /** Draws the hairline above this row (every row but the first in a group). */
  divided?: boolean;
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
      <Text style={rowStyles.matchHighlight}>{match}</Text>
      {after}
    </>
  );
}

/**
 * A collection as a STRUCTURAL row (2026-09-07): folder glyph, name, count, and a
 * chevron, grouped in one flat surface. It used to wear the content-card recipe,
 * which made the workspace hub read as another collection page — the container
 * and its contents looked the same. Everything the card carried is still here:
 * selection dot, primary badge, description, and search-match badges.
 */
export function WorkspaceCollectionCard({
  entry,
  isPrimary,
  searchQuery,
  selectionMode,
  isSelected,
  divided = false,
  onPress,
  onLongPress,
}: WorkspaceCollectionCardProps) {
  const { t } = useTranslation();
  const { collection, itemCount, childCollectionCount, matches } = entry;

  const metaParts = [
    t("brand.ideaCount", { count: itemCount }),
    childCollectionCount > 0
      ? t("workspaceBrowse.subcollection", { count: childCollectionCount })
      : null,
    formatLastEdited(collection.updatedAt),
  ].filter(Boolean).join("  ·  ");

  return (
    <Pressable
      testID={`collection-card-${collection.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`}
      accessibilityRole="button"
      accessibilityState={selectionMode ? { selected: isSelected } : undefined}
      style={({ pressed }) => [
        rowStyles.row,
        divided ? rowStyles.rowDivided : null,
        isSelected ? rowStyles.rowSelected : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
    >
      {/* Leading glyph: the folder, or the selection dot while selecting */}
      {selectionMode ? (
        <View style={[rowStyles.selectionDot, isSelected ? rowStyles.selectionDotActive : null]}>
          {isSelected ? <Ionicons name="checkmark" size={10} color={colors.onPrimary} /> : null}
        </View>
      ) : (
        <Ionicons name="folder-outline" size={22} color={colors.primaryDeep} />
      )}

      <View style={rowStyles.copy}>
        <View style={rowStyles.titleRow}>
          <UserText value={collection.title} style={rowStyles.title} numberOfLines={1}>
            <HighlightedText value={collection.title} query={searchQuery} />
          </UserText>
          {isPrimary ? (
            <View style={rowStyles.primaryBadge}>
              <Ionicons name="star" size={10} color={colors.primary} />
              <Text style={rowStyles.primaryLabel}>{t("workspaceBrowse.primary")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={rowStyles.meta} numberOfLines={1}>{metaParts}</Text>
        {collection.description ? (
          <UserText value={collection.description} style={rowStyles.description} numberOfLines={2}>
            {collection.description}
          </UserText>
        ) : null}
        {searchQuery.trim().length > 0 && matches.length > 0 ? (
          <View style={rowStyles.matchRow}>
            {matches.map((match, index) => (
              <View key={`${match.kind}-${match.label}-${index}`} style={rowStyles.matchBadge}>
                <Text style={rowStyles.matchText} numberOfLines={1}>
                  {getMatchLabel(match.kind)}{" "}
                  <HighlightedText value={match.label} query={searchQuery} />
                  {match.context ? (
                    <Text style={rowStyles.matchContext}> in {match.context}</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {selectionMode ? null : (
        <Ionicons name={dirIcon("chevron-forward")} size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
  },
  rowSelected: {
    backgroundColor: colors.primarySurface,
  },
  selectionDot: {
    width: 18,
    height: 18,
    borderRadius: radii.round,
    borderWidth: 1.5,
    borderColor: colors.borderMuted,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectionDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 16,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  description: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: colors.textStrong,
    marginTop: 2,
  },
  primaryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  primaryLabel: {
    fontFamily: "PlusJakartaSans_700Bold",
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.primary,
  },
  matchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  matchBadge: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: "100%",
  },
  matchText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 11,
    color: colors.textStrong,
  },
  matchContext: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: colors.textSecondary,
  },
  matchHighlight: {
    fontFamily: "PlusJakartaSans_700Bold",
    color: colors.primaryDeep,
  },
});
