import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { styles } from "../../../styles";
import { FilterSortBar } from "./FilterSortBar";
import { SearchField } from "../../common/SearchField";
import { colors } from "../../../design/tokens";

type ProjectStage = "seed" | "sprout" | "stem" | "song";
type LyricsFilterMode = "all" | "with" | "without";

type IdeaListFilterSectionProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedProjectStages: ProjectStage[];
  lyricsFilterMode: LyricsFilterMode;
  hiddenItemsCount: number;
  onToggleProjectStage: (stage: ProjectStage) => void;
  onClearProjectStages: () => void;
  onLyricsFilterModeChange: (mode: LyricsFilterMode) => void;
  onShowAll: () => void;
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
  hiddenItemsCount,
  onToggleProjectStage,
  onClearProjectStages,
  onLyricsFilterModeChange,
  onShowAll,
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
  if (searchQuery !== settled) {
    setSettled(searchQuery);
    setDraft(searchQuery);
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      closeSignal={filterSortCloseSignal}
      onMenuOpen={onFilterSortMenuOpen}
      controlsOverride={selectionControls}
      leadingSlot={
        <SearchField
          testID="collection-search"
          value={draft}
          placeholder={t("collection.searchPlaceholder")}
          onChangeText={handleSearchChange}
          tonal
        />
      }
      rightSlot={
        hiddenItemsCount > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.ideasUnhideAllPill,
              pressed ? styles.pressDown : null,
            ]}
            onPress={onShowAll}
            accessibilityRole="button"
            accessibilityLabel={t("common.showAllHidden", { count: hiddenItemsCount })}
          >
            <Ionicons name="eye-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.ideasUnhideAllPillText}>
              {t("common.showAllHidden", { count: hiddenItemsCount })}
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}
