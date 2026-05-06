import { useRef, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SurfaceCard } from "../../common/SurfaceCard";
import type { CollectionSearchMatchKind } from "../../../libraryNavigation";
import type { Collection } from "../../../types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const DROPDOWN_WIDTH = 188;

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
  onRename: () => void;
  onSetPrimary: () => void;
};

function formatLastEdited(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return "Edited today";
  if (days === 1) return "Edited yesterday";
  if (days < 7) return `Edited ${days} days ago`;
  if (days < 14) return "Edited last week";
  return `Edited ${new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function getMatchLabel(kind: CollectionSearchMatchKind): string {
  switch (kind) {
    case "collection": return "Collection:";
    case "subcollection": return "Inside:";
    case "song": return "Song:";
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
  onRename,
  onSetPrimary,
}: WorkspaceCollectionCardProps) {
  const { collection, itemCount, childCollectionCount, matches } = entry;
  const ellipsisRef = useRef<View>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; right: number } | null>(null);

  function openDropdown() {
    ellipsisRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setDropdownPos({
        top: py + height + 6,
        right: SCREEN_WIDTH - px - width,
      });
    });
  }

  function closeDropdown() {
    setDropdownPos(null);
  }

  const metaParts = [
    `${itemCount} ${itemCount === 1 ? "seed" : "seeds"}`,
    childCollectionCount > 0
      ? `${childCollectionCount} ${childCollectionCount === 1 ? "sub-collection" : "sub-collections"}`
      : null,
    formatLastEdited(collection.updatedAt),
  ].filter(Boolean).join("  ·  ");

  return (
    <SurfaceCard onPress={onPress} onLongPress={onLongPress}>
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

        {!selectionMode ? (
          <Pressable
            ref={ellipsisRef}
            style={cardStyles.actionsBtn}
            onPress={openDropdown}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-vertical" size={14} color="#D7C2BD" />
          </Pressable>
        ) : null}
      </View>

      {/* Meta row */}
      <Text style={cardStyles.meta}>{metaParts}</Text>

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

      {/* Dropdown menu */}
      {dropdownPos ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeDropdown}
        >
          {/* Backdrop — tapping outside closes */}
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeDropdown} />

          <View style={[dropdownStyles.menu, { top: dropdownPos.top, right: dropdownPos.right }]}>
            {/* Rename */}
            <Pressable
              style={({ pressed }) => [dropdownStyles.item, pressed ? dropdownStyles.itemPressed : null]}
              onPress={() => { closeDropdown(); onRename(); }}
            >
              <Ionicons name="create-outline" size={14} color="#84736f" />
              <Text style={dropdownStyles.itemText}>Rename</Text>
            </Pressable>

            <View style={dropdownStyles.divider} />

            {/* Set as Primary — always shown, disabled when already primary */}
            <Pressable
              style={({ pressed }) => [
                dropdownStyles.item,
                isPrimary ? dropdownStyles.itemDisabled : null,
                pressed && !isPrimary ? dropdownStyles.itemPressed : null,
              ]}
              onPress={() => { if (!isPrimary) { closeDropdown(); onSetPrimary(); } }}
              disabled={isPrimary}
            >
              <Ionicons
                name="star-outline"
                size={14}
                color={isPrimary ? "#D7C2BD" : "#84736f"}
              />
              <Text style={[dropdownStyles.itemText, isPrimary ? dropdownStyles.itemTextDisabled : null]}>
                Set as Primary
              </Text>
            </Pressable>

          </View>
        </Modal>
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
  actionsBtn: {
    padding: 4,
    flexShrink: 0,
  },
  meta: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#84736f",
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

const dropdownStyles = StyleSheet.create({
  menu: {
    position: "absolute",
    width: DROPDOWN_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(215, 194, 189, 0.3)",
    shadowColor: "#3D3732",
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  itemPressed: {
    backgroundColor: "#F4F1ED",
  },
  itemDisabled: {
    opacity: 0.4,
  },
  itemDanger: {},
  itemText: {
    fontFamily: "PlusJakartaSans_500Medium",
    fontSize: 13,
    color: "#524440",
  },
  itemTextDisabled: {
    color: "#a89994",
  },
  itemTextDanger: {
    color: "#a83232",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(215, 194, 189, 0.25)",
    marginHorizontal: 14,
  },
});
