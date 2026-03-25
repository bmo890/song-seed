import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { FilterSortBar } from "./FilterSortBar";

type ProjectStage = "seed" | "sprout" | "semi" | "song";
type LyricsFilterMode = "all" | "with" | "without";

type IdeaListFilterSectionProps = {
  selectedProjectStages: ProjectStage[];
  lyricsFilterMode: LyricsFilterMode;
  showDateDividers: boolean;
  stickyDayLabel: string | null;
  stickyDayTop: number;
  hiddenItemsCount: number;
  onLayout: (top: number) => void;
  onToggleProjectStage: (stage: ProjectStage) => void;
  onClearProjectStages: () => void;
  onLyricsFilterModeChange: (mode: LyricsFilterMode) => void;
  onUnhideAll: () => void;
};

export function IdeaListFilterSection({
  selectedProjectStages,
  lyricsFilterMode,
  showDateDividers,
  stickyDayLabel,
  stickyDayTop,
  hiddenItemsCount,
  onLayout,
  onToggleProjectStage,
  onClearProjectStages,
  onLyricsFilterModeChange,
  onUnhideAll,
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
          rightSlot={
            hiddenItemsCount > 0 ? (
              <Pressable
                style={({ pressed }) => [styles.ideasUnhideAllPill, pressed ? styles.pressDown : null]}
                onPress={onUnhideAll}
              >
                <Ionicons name="eye-outline" size={12} color="#64748b" />
                <Text style={styles.ideasUnhideAllPillText}>{`Unhide all (${hiddenItemsCount})`}</Text>
              </Pressable>
            ) : null
          }
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
