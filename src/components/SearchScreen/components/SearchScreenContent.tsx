import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { PageIntro } from "../../common/PageIntro";
import { SearchField } from "../../common/SearchField";
import { colors, radii, spacing, text as textTokens } from "../../../design/tokens";
import { styles } from "../../../styles";
import { getSearchMatchSourceLabel, type GlobalSearchResult } from "../../../search";
import { useSearchScreenModel } from "../hooks/useSearchScreenModel";

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
  onPress,
}: {
  result: GlobalSearchResult;
  onPress: () => void;
}) {
  return (
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
            color={colors.textSecondary}
          />
          <Text style={searchScreenStyles.resultTitle} numberOfLines={1}>
            {result.title}
          </Text>
        </View>
        <View style={searchScreenStyles.resultMetaRow}>
          <View style={searchScreenStyles.matchChip}>
            <Text style={searchScreenStyles.matchChipText}>
              {getSearchMatchSourceLabel(result.matchSource)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </View>

      <Text style={searchScreenStyles.resultContext} numberOfLines={1}>
        {result.context}
      </Text>

      {result.snippet ? (
        <Text style={searchScreenStyles.resultSnippet} numberOfLines={2}>
          {result.snippet}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function SearchScreenContent() {
  const model = useSearchScreenModel();
  const subtitle = model.hasQuery
    ? `${model.resultCount} match${model.resultCount === 1 ? "" : "es"} across titles, notes, clip notes, lyrics, chords, and Notepad.`
    : "Search across workspaces, collections, songs, clips, lyrics, notes, and Notepad.";

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenHeader title="Search" leftIcon="hamburger" />
      <PageIntro title="Search" subtitle={subtitle} />

      <SearchField
        value={model.searchQuery}
        placeholder="Search titles, lyrics, notes, and Notepad"
        onChangeText={model.setSearchQuery}
        containerStyle={searchScreenStyles.searchField}
      />

      {!model.hasQuery ? (
        <View style={searchScreenStyles.emptyState}>
          <Ionicons name="search-outline" size={28} color={colors.textMuted} />
          <Text style={searchScreenStyles.emptyTitle}>Search your whole library</Text>
          <Text style={searchScreenStyles.emptyBody}>
            Find songs by lyric fragments, clips by notes, or notebook pages by anything inside them.
          </Text>
        </View>
      ) : model.resultCount === 0 ? (
        <View style={searchScreenStyles.emptyState}>
          <Ionicons name="documents-outline" size={28} color={colors.textMuted} />
          <Text style={searchScreenStyles.emptyTitle}>No matches</Text>
          <Text style={searchScreenStyles.emptyBody}>
            Try a different word or phrase. Search looks through project notes, clip notes, lyrics, chords, and Notepad content.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={searchScreenStyles.resultsScroll}
          contentContainerStyle={searchScreenStyles.resultsContent}
          showsVerticalScrollIndicator={false}
        >
          {model.resultGroups.map((group) => (
            <View key={group.kind} style={searchScreenStyles.section}>
              <View style={searchScreenStyles.sectionHeaderRow}>
                <Text style={searchScreenStyles.sectionTitle}>{group.label}</Text>
                <Text style={searchScreenStyles.sectionCount}>{group.items.length}</Text>
              </View>

              <View style={searchScreenStyles.sectionStack}>
                {group.items.map((result) => (
                  <SearchResultCard
                    key={result.id}
                    result={result}
                    onPress={() => model.openResult(result)}
                  />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const searchScreenStyles = StyleSheet.create({
  searchField: {
    marginBottom: 14,
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    paddingBottom: 32,
    gap: 16,
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...textTokens.sectionTitle,
    color: colors.textPrimary,
  },
  sectionCount: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
  sectionStack: {
    gap: 8,
  },
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 6,
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
    color: colors.textPrimary,
    flex: 1,
  },
  resultMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  matchChip: {
    borderRadius: 999,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  matchChipText: {
    ...textTokens.caption,
    color: colors.textSecondary,
  },
  resultContext: {
    ...textTokens.supporting,
    color: colors.textSecondary,
  },
  resultSnippet: {
    ...textTokens.body,
    color: colors.textMuted,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 48,
    gap: 10,
  },
  emptyTitle: {
    ...textTokens.sectionTitle,
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyBody: {
    ...textTokens.supporting,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
