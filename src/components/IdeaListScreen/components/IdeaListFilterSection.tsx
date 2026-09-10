import type { ReactNode } from "react";
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
          value={searchQuery}
          placeholder={t("collection.searchPlaceholder")}
          onChangeText={onSearchQueryChange}
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
