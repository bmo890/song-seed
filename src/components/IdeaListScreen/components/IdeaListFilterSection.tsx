import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { FilterSortBar } from "./FilterSortBar";

type ProjectStage = "seed" | "sprout" | "stem" | "song";
type LyricsFilterMode = "all" | "with" | "without";

type IdeaListFilterSectionProps = {
  selectedProjectStages: ProjectStage[];
  lyricsFilterMode: LyricsFilterMode;
  hiddenItemsCount: number;
  onToggleProjectStage: (stage: ProjectStage) => void;
  onClearProjectStages: () => void;
  onLyricsFilterModeChange: (mode: LyricsFilterMode) => void;
  onShowAll: () => void;
};

export function IdeaListFilterSection({
  selectedProjectStages,
  lyricsFilterMode,
  hiddenItemsCount,
  onToggleProjectStage,
  onClearProjectStages,
  onLyricsFilterModeChange,
  onShowAll,
}: IdeaListFilterSectionProps) {
  return (
    <FilterSortBar
      selectedProjectStages={selectedProjectStages}
      onToggleProjectStage={onToggleProjectStage}
      onClearProjectStages={onClearProjectStages}
      lyricsFilterMode={lyricsFilterMode}
      onLyricsFilterModeChange={onLyricsFilterModeChange}
      rightSlot={
        hiddenItemsCount > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.ideasUnhideAllPill,
              pressed ? styles.pressDown : null,
            ]}
            onPress={onShowAll}
            accessibilityRole="button"
            accessibilityLabel={`Show all hidden items, ${hiddenItemsCount} hidden`}
          >
            <Ionicons name="eye-outline" size={12} color="#84736f" />
            <Text style={styles.ideasUnhideAllPillText}>
              {`Show all (${hiddenItemsCount})`}
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}
