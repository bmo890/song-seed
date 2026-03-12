import { Text, View } from "react-native";
import { styles } from "../../styles";
import { FilterSortBar } from "./FilterSortBar";

type ProjectStage = "seed" | "sprout" | "semi" | "song";
type LyricsFilterMode = "all" | "with" | "without";

type IdeaListFilterSectionProps = {
  selectedProjectStages: ProjectStage[];
  lyricsFilterMode: LyricsFilterMode;
  showDateDividers: boolean;
  stickyDayLabel: string | null;
  stickyDayTop: number;
  onLayout: (top: number) => void;
  onToggleProjectStage: (stage: ProjectStage) => void;
  onClearProjectStages: () => void;
  onLyricsFilterModeChange: (mode: LyricsFilterMode) => void;
};

export function IdeaListFilterSection({
  selectedProjectStages,
  lyricsFilterMode,
  showDateDividers,
  stickyDayLabel,
  stickyDayTop,
  onLayout,
  onToggleProjectStage,
  onClearProjectStages,
  onLyricsFilterModeChange,
}: IdeaListFilterSectionProps) {
  return (
    <>
      <View
        onLayout={(evt) => {
          const { y, height } = evt.nativeEvent.layout;
          onLayout(y + height + 2);
        }}
      >
        <FilterSortBar
          selectedProjectStages={selectedProjectStages}
          onToggleProjectStage={onToggleProjectStage}
          onClearProjectStages={onClearProjectStages}
          lyricsFilterMode={lyricsFilterMode}
          onLyricsFilterModeChange={onLyricsFilterModeChange}
        />
      </View>

      {showDateDividers && stickyDayLabel ? (
        <View style={[styles.ideasStickyDayWrap, { top: stickyDayTop }]} pointerEvents="none">
          <View style={styles.ideasStickyDayChip}>
            <Text style={styles.ideasStickyDayChipText}>{stickyDayLabel}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}
