import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Press } from "../../common/Press";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { styles } from "../../../styles";
import { FilterSortBar } from "./FilterSortBar";
import { SearchField } from "../../common/SearchField";
import { colors, spacing } from "../../../design/tokens";

type ProjectStage = "seed" | "sprout" | "stem" | "song";
type LyricsFilterMode = "all" | "with" | "without";

type IdeaListFilterSectionProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedProjectStages: ProjectStage[];
  lyricsFilterMode: LyricsFilterMode;
  /** Clip tags in use in this collection — the tag filter's rows. */
  tagsInUse: string[];
  hiddenItemsCount: number;
  onToggleProjectStage: (stage: ProjectStage) => void;
  onClearProjectStages: () => void;
  onLyricsFilterModeChange: (mode: LyricsFilterMode) => void;
  onShowAll: () => void;
  /** What the filter keeps, or null when nothing is filtered. */
  filterSummary: { label: string; shown: number; total: number } | null;
  onClearFilters: () => void;
  /** Selection mode swaps the filter/sort controls for these, in place; the
   *  search field stays live so you can narrow the list while picking. */
  selectionControls?: ReactNode;
  /** Mutual-exclusivity with the collection overflow menu. */
  filterSortCloseSignal?: number;
  onFilterSortMenuOpen?: () => void;
};

export function IdeaListFilterSection({
  searchQuery,
  onSearchQueryChange,
  selectedProjectStages,
  lyricsFilterMode,
  tagsInUse,
  hiddenItemsCount,
  onToggleProjectStage,
  onClearProjectStages,
  onLyricsFilterModeChange,
  onShowAll,
  filterSummary,
  onClearFilters,
  selectionControls,
  filterSortCloseSignal,
  onFilterSortMenuOpen,
}: IdeaListFilterSectionProps) {
  const { t } = useTranslation();
  // Keystrokes stay in this field. Each one used to go through the screen model
  // (a provider render + the filter pipeline over every idea); the model now hears
  // the settled value, 160 ms after typing pauses. A clear is immediate. The draft
  // re-derives when the model's value changes from elsewhere (focus-idea clears it).
  const [draft, setDraft] = useState(searchQuery);
  const [settled, setSettled] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (searchQuery !== settled) {
    // The model's value wins over a keystroke still on the timer — otherwise the
    // timer would re-apply the old draft 160 ms after the model cleared it.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSettled(searchQuery);
    setDraft(searchQuery);
  }
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);
  const handleSearchChange = (value: string) => {
    setDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length === 0) {
      setSettled(value);
      onSearchQueryChange(value);
      return;
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      setSettled(value);
      onSearchQueryChange(value);
    }, 160);
  };
  return (
    <FilterSortBar
      selectedProjectStages={selectedProjectStages}
      onToggleProjectStage={onToggleProjectStage}
      onClearProjectStages={onClearProjectStages}
      lyricsFilterMode={lyricsFilterMode}
      onLyricsFilterModeChange={onLyricsFilterModeChange}
      tagsInUse={tagsInUse}
      footer={filterSummary ? <ActiveFilterLine summary={filterSummary} onClear={onClearFilters} /> : null}
      closeSignal={filterSortCloseSignal}
      onMenuOpen={onFilterSortMenuOpen}
      controlsOverride={selectionControls}
      leadingSlot={
        <SearchField
          testID="collection-search"
          value={draft}
          placeholder={t("collection.searchPlaceholder")}
          onChangeText={handleSearchChange}
        />
      }
      rightSlot={
        hiddenItemsCount > 0 ? (
          <Press
            haptic="none"
            style={styles.ideasUnhideAllPill}
            onPress={onShowAll}
            accessibilityRole="button"
            accessibilityLabel={t("common.showAllHidden", { count: hiddenItemsCount })}
          >
            <Ionicons name="eye-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.ideasUnhideAllPillText}>
              {t("common.showAllHidden", { count: hiddenItemsCount })}
            </Text>
          </Press>
        ) : null
      }
    />
  );
}

/**
 * The filter in words, under the search (founder, 2026-11-18): a filter left on
 * from another day read as every clip gone. Industry pattern (Mail's "Filtered
 * by", Photos' Filtered) in SongNook ink: the funnel and what it keeps, the count
 * it leaves of the whole, and Show all. Nothing shows while nothing is filtered.
 */
function ActiveFilterLine({
  summary,
  onClear,
}: {
  summary: { label: string; shown: number; total: number };
  onClear: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={filterLine.row} testID="collection-filter-line">
      <Ionicons name="funnel" size={12} color={colors.primaryDeep} />
      <Text style={filterLine.text} numberOfLines={1}>
        {t("collection.filterLine", { filters: summary.label, shown: summary.shown, total: summary.total })}
      </Text>
      <Press
        // Haptics vocabulary: tap, an acknowledged press.
        haptic="tap"
        onPress={onClear}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("filters.clearAll")}
      >
        <Text style={filterLine.clear}>{t("collection.filterShowAll")}</Text>
      </Press>
    </View>
  );
}

const filterLine = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  text: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontFamily: "PlusJakartaSans_500Medium",
    color: colors.textSecondary,
    fontVariant: ["tabular-nums"],
  },
  clear: {
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold",
    color: colors.primaryDeep,
  },
});
