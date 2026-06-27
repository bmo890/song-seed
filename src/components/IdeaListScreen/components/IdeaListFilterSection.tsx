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
  showHidden: boolean;
  onToggleProjectStage: (stage: ProjectStage) => void;
  onClearProjectStages: () => void;
  onLyricsFilterModeChange: (mode: LyricsFilterMode) => void;
  onToggleShowHidden: () => void;
};

export function IdeaListFilterSection({
  selectedProjectStages,
  lyricsFilterMode,
  hiddenItemsCount,
  showHidden,
  onToggleProjectStage,
  onClearProjectStages,
  onLyricsFilterModeChange,
  onToggleShowHidden,
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
              showHidden ? styles.ideasUnhideAllPillActive : null,
              pressed ? styles.pressDown : null,
            ]}
            onPress={onToggleShowHidden}
            accessibilityRole="button"
            accessibilityState={{ selected: showHidden }}
            accessibilityLabel={showHidden ? "Tuck hidden items away" : "Show hidden items"}
          >
            <Ionicons
              name={showHidden ? "eye" : "eye-off-outline"}
              size={12}
              color={showHidden ? "#824f3f" : "#84736f"}
            />
            <Text
              style={[
                styles.ideasUnhideAllPillText,
                showHidden ? styles.ideasUnhideAllPillTextActive : null,
              ]}
            >
              {`${hiddenItemsCount} hidden`}
            </Text>
          </Pressable>
        ) : null
      }
    />
  );
}
