import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScreenHeader } from "../../common/ScreenHeader";
import { PageIntro } from "../../common/PageIntro";
import { SearchField } from "../../common/SearchField";
import { spacing, text as textTokens } from "../../../design/tokens";
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
            color="#6a5751"
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
          <Ionicons name="chevron-forward" size={16} color="#9b8a84" />
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
          <Ionicons name="search-outline" size={28} color="#9b8a84" />
          <Text style={searchScreenStyles.emptyTitle}>Search your whole library</Text>
          <Text style={searchScreenStyles.emptyBody}>
            Find songs by lyric fragments, clips by notes, or notebook pages by anything inside them.
          </Text>
        </View>
      ) : model.resultCount === 0 ? (
        <View style={searchScreenStyles.emptyState}>
          <Ionicons name="documents-outline" size={28} color="#9b8a84" />
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
    marginBottom: 16,
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 48,
    gap: 12,
  },
  emptyTitle: {
    ...textTokens.sectionTitle,
    color: "#1b1c1a",
    textAlign: "center",
  },
  emptyBody: {
    ...textTokens.supporting,
    color: "#6a5751",
    textAlign: "center",
    lineHeight: 22,
  },
});
