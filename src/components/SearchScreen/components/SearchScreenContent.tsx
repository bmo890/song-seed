import { useEffect, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { SearchField } from "../../common/SearchField";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { styles } from "../../../styles";
import { getSearchMatchSourceLabel, type GlobalSearchResult } from "../../../search";
import { useSearchScreenModel } from "../hooks/useSearchScreenModel";

// The "index" of the archive — what a query actually reaches into. Doubles as the
// empty-state content, replacing the old lonely magnifier + repeated paragraph.
const SEARCH_DOMAINS: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: "Songs", icon: "albums-outline" },
  { label: "Clips", icon: "musical-notes-outline" },
  { label: "Lyrics", icon: "text-outline" },
  { label: "Chords", icon: "musical-note-outline" },
  { label: "Notes", icon: "document-text-outline" },
  { label: "Collections", icon: "folder-open-outline" },
  { label: "Lyrics Pad", icon: "book-outline" },
];

// Highlights every occurrence of `query` inside `value`. Used to mark the matched
// fragment inside a result snippet (lyrics, notes, chords) so the eye lands on it.
function HighlightedText({ value, query }: { value: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{value}</>;

  const lowerValue = value.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  const segments: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;

  while (cursor < value.length) {
    const matchIndex = lowerValue.indexOf(lowerNeedle, cursor);
    if (matchIndex < 0) {
      segments.push({ text: value.slice(cursor), match: false });
      break;
    }
    if (matchIndex > cursor) {
      segments.push({ text: value.slice(cursor, matchIndex), match: false });
    }
    segments.push({ text: value.slice(matchIndex, matchIndex + needle.length), match: true });
    cursor = matchIndex + needle.length;
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <Text key={index} style={searchScreenStyles.snippetHighlight}>
            {segment.text}
          </Text>
        ) : (
          segment.text
        )
      )}
    </>
  );
}

function getResultIconName(result: GlobalSearchResult): keyof typeof Ionicons.glyphMap {
  switch (result.kind) {
    case "song":
      return "albums-outline";
    case "clip":
      return "musical-notes-outline";
    case "note":
      return "document-text-outline";
    case "collection":
      return "folder-open-outline";
    case "workspace":
    default:
      return "home-outline";
  }
}

function SearchResultCard({
  result,
  query,
  animationIndex,
  onPress,
}: {
  result: GlobalSearchResult;
  query: string;
  animationIndex: number;
  onPress: () => void;
}) {
  // Each card fades + rises on mount. Because the list is keyed by result id, only
  // cards new to this query mount and animate — persistent ones stay put, so rapid
  // typing doesn't re-trigger a full cascade every keystroke.
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      delay: Math.min(animationIndex * 45, 260),
      useNativeDriver: true,
    }).start();
  }, [animationIndex, enter]);

  const animatedStyle = {
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };

  const showOpenIn =
    (result.kind === "song" || result.kind === "clip") && !!result.containerName;

  return (
    <Animated.View style={animatedStyle}>
    <Pressable
      style={({ pressed }) => [
        searchScreenStyles.resultCard,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
    >
      <View style={searchScreenStyles.resultHeaderRow}>
        <View style={searchScreenStyles.resultTitleRow}>
          <Ionicons
            name={getResultIconName(result)}
            size={16}
            color="#6a5751"
          />
          <Text style={searchScreenStyles.resultTitle} numberOfLines={1}>
            <HighlightedText value={result.title} query={query} />
          </Text>
        </View>
        <View style={searchScreenStyles.resultMetaRow}>
          <View style={searchScreenStyles.matchChip}>
            <Text style={searchScreenStyles.matchChipText}>
              {getSearchMatchSourceLabel(result.matchSource)}
            </Text>
          </View>
          {showOpenIn ? null : (
            <Ionicons name="chevron-forward" size={16} color="#9b8a84" />
          )}
        </View>
      </View>

      <Text style={searchScreenStyles.resultContext} numberOfLines={1}>
        {result.context}
      </Text>

      {result.snippet ? (
        <Text style={searchScreenStyles.resultSnippet} numberOfLines={2}>
          <HighlightedText value={result.snippet} query={query} />
        </Text>
      ) : null}

      {showOpenIn ? (
        <View style={searchScreenStyles.openInRow}>
          <Ionicons name="folder-open-outline" size={13} color={colors.primary} />
          <Text style={searchScreenStyles.openInText} numberOfLines={1}>
            Open in {result.containerName}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
    </Animated.View>
  );
}

// A single quick-filter pill. Active = terracotta fill; the count reads as a quiet
// suffix so the pill stays scannable.
function FilterPill({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        searchScreenStyles.filterPill,
        active ? searchScreenStyles.filterPillActive : null,
        pressed ? styles.pressDown : null,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[searchScreenStyles.filterPillLabel, active ? searchScreenStyles.filterPillLabelActive : null]}>
        {label}
      </Text>
      <Text style={[searchScreenStyles.filterPillCount, active ? searchScreenStyles.filterPillCountActive : null]}>
        {count}
      </Text>
    </Pressable>
  );
}

// A quiet editorial section rule — hairline · centered eyebrow · hairline.
function SectionRule({ label }: { label: string }) {
  return (
    <View style={searchScreenStyles.ruleRow}>
      <View style={searchScreenStyles.ruleLine} />
      <Text style={searchScreenStyles.ruleLabel}>{label}</Text>
      <View style={searchScreenStyles.ruleLine} />
    </View>
  );
}

function SearchLanding() {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: 90,
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const animatedStyle = {
    opacity: enter,
    transform: [
      {
        translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
      },
    ],
  };

  return (
    <Animated.View style={[searchScreenStyles.landing, animatedStyle]}>
      <SectionRule label="Search looks inside" />
      <View style={searchScreenStyles.domainWrap}>
        {SEARCH_DOMAINS.map((domain) => (
          <View key={domain.label} style={searchScreenStyles.domainChip}>
            <Ionicons name={domain.icon} size={13} color={colors.textSecondary} />
            <Text style={searchScreenStyles.domainLabel}>{domain.label}</Text>
          </View>
        ))}
      </View>
      <Text style={searchScreenStyles.landingHint}>
        Titles, notes, lyric lines, and chords — everywhere across your library.
      </Text>
    </Animated.View>
  );
}

export function SearchScreenContent() {
  const model = useSearchScreenModel();
  const shownCount = model.activeMatchFilter ? model.filteredResultCount : model.resultCount;
  const subtitle = model.hasQuery
    ? `${shownCount} match${shownCount === 1 ? "" : "es"}`
    : "Find a song by a lyric line, a clip by a note — anything by what's inside it.";
  const showFilterBar = model.hasQuery && model.matchFilters.length > 1;

  return (
    <SafeAreaView style={styles.screen}>
      {/* title intentionally blank: the editorial title below is the single heading */}
      <ScreenHeader title="" leftIcon="hamburger" />

      <View style={searchScreenStyles.intro}>
        <Text style={searchScreenStyles.eyebrow}>Your archive</Text>
        <Text style={searchScreenStyles.title}>Search</Text>
        <Text style={searchScreenStyles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>

      <SearchField
        value={model.searchQuery}
        placeholder="Search everything"
        onChangeText={model.setSearchQuery}
        containerStyle={searchScreenStyles.searchField}
      />

      {showFilterBar ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={searchScreenStyles.filterBar}
          contentContainerStyle={searchScreenStyles.filterBarContent}
        >
          <FilterPill
            label="All"
            count={model.resultCount}
            active={model.activeMatchFilter == null}
            onPress={() => model.setActiveMatchFilter(null)}
          />
          {model.matchFilters.map((option) => (
            <FilterPill
              key={option.key}
              label={option.label}
              count={option.count}
              active={model.activeMatchFilter === option.key}
              onPress={() =>
                model.setActiveMatchFilter(
                  model.activeMatchFilter === option.key ? null : option.key
                )
              }
            />
          ))}
        </ScrollView>
      ) : null}

      {!model.hasQuery ? (
        <SearchLanding />
      ) : model.resultCount === 0 ? (
        <View style={searchScreenStyles.noMatchWrap}>
          <SectionRule label="No matches" />
          <Text style={searchScreenStyles.noMatchBody}>
            Nothing matched “{model.debouncedSearchQuery.trim()}”. Try a shorter word or a lyric
            fragment.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={searchScreenStyles.resultsScroll}
          contentContainerStyle={searchScreenStyles.resultsContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {model.resultGroups.map((group, groupIndex) => {
            // Running offset so the fade-in cascades continuously across sections.
            const baseIndex = model.resultGroups
              .slice(0, groupIndex)
              .reduce((total, previous) => total + previous.items.length, 0);

            return (
              <View key={group.kind} style={searchScreenStyles.section}>
                <View style={searchScreenStyles.sectionHeaderRow}>
                  <Text style={searchScreenStyles.sectionTitle}>{group.label}</Text>
                  <Text style={searchScreenStyles.sectionCount}>{group.items.length}</Text>
                </View>

                <View style={searchScreenStyles.sectionStack}>
                  {group.items.map((result, itemIndex) => (
                    <SearchResultCard
                      key={result.id}
                      result={result}
                      query={model.debouncedSearchQuery}
                      animationIndex={baseIndex + itemIndex}
                      onPress={() => model.openResult(result)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const searchScreenStyles = StyleSheet.create({
  intro: {
    marginTop: 2,
    marginBottom: 16,
    gap: 4,
  },
  eyebrow: {
    ...textTokens.annotation,
    color: colors.primary,
  },
  title: {
    ...textTokens.pageTitle,
  },
  subtitle: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    lineHeight: 20,
    maxWidth: 320,
  },
  searchField: {
    marginBottom: 12,
  },
  filterBar: {
    flexGrow: 0,
    marginBottom: 14,
    marginHorizontal: -2,
  },
  filterBarContent: {
    gap: spacing.sm,
    paddingHorizontal: 2,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.round,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
  },
  filterPillLabel: {
    ...textTokens.caption,
    color: colors.textStrong,
  },
  filterPillLabelActive: {
    color: colors.onPrimary,
  },
  filterPillCount: {
    ...textTokens.caption,
    color: colors.textMuted,
    fontVariant: ["tabular-nums"],
  },
  filterPillCountActive: {
    color: colors.onPrimary,
    opacity: 0.85,
  },
  landing: {
    marginTop: spacing.xl,
    gap: 18,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  ruleLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: colors.borderSubtle,
  },
  ruleLabel: {
    ...textTokens.annotation,
    color: colors.textMuted,
  },
  domainWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  domainChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainer,
    borderRadius: radii.round,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  domainLabel: {
    ...textTokens.caption,
    color: colors.textStrong,
  },
  landingHint: {
    ...textTokens.supporting,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
  },
  noMatchWrap: {
    marginTop: spacing.xl,
    gap: 14,
  },
  noMatchBody: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: spacing.xl,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: 36,
    gap: 18,
  },
  section: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
  },
  sectionTitle: {
    ...textTokens.sectionTitle,
    color: "#1b1c1a",
    letterSpacing: 0.5,
  },
  sectionCount: {
    ...textTokens.caption,
    color: "#6a5751",
    backgroundColor: "#efeeea",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  sectionStack: {
    gap: 10,
  },
  resultCard: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  resultHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  resultTitleRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  resultTitle: {
    ...textTokens.body,
    fontWeight: "700",
    color: "#1b1c1a",
    flex: 1,
  },
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  matchChip: {
    borderRadius: 999,
    backgroundColor: "#efeeea",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchChipText: {
    ...textTokens.caption,
    color: "#824f3f",
  },
  resultContext: {
    ...textTokens.supporting,
    color: "#6a5751",
  },
  resultSnippet: {
    ...textTokens.body,
    color: "#524440",
    lineHeight: 21,
  },
  snippetHighlight: {
    fontWeight: "700",
    color: "#824f3f",
  },
  openInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  openInText: {
    ...textTokens.caption,
    color: colors.primary,
    flexShrink: 1,
  },
});
