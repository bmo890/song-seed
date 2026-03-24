import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../styles";
import { useStore } from "../../state/useStore";
import { getIdeaSortState, getIdeaSortValue, IdeaSortMetric } from "../../ideaSort";
import { getHierarchyIconName } from "../../hierarchy";
import { FilterSortControls } from "../common/FilterSortControls";

type ProjectStage = "seed" | "sprout" | "semi" | "song";
type LyricsFilterMode = "all" | "with" | "without";

type FilterSortBarProps = {
  selectedProjectStages: ProjectStage[];
  onToggleProjectStage: (value: ProjectStage) => void;
  onClearProjectStages: () => void;
  lyricsFilterMode: LyricsFilterMode;
  onLyricsFilterModeChange: (value: LyricsFilterMode) => void;
  rightSlot?: ReactNode;
};

function getStageTone(stage: ProjectStage) {
  switch (stage) {
    case "seed":
      return {
        chipStyle: [styles.statusSeed, { borderColor: "#9ca3af" }],
        textStyle: styles.statusSeedText,
      };
    case "sprout":
      return {
        chipStyle: [styles.statusSprout, { borderColor: "#93c5fd" }],
        textStyle: styles.statusSproutText,
      };
    case "semi":
      return {
        chipStyle: [styles.statusSemi, { borderColor: "#fcd34d" }],
        textStyle: styles.statusSemiText,
      };
    case "song":
      return {
        chipStyle: [styles.statusSong, { borderColor: "#86efac" }],
        textStyle: styles.statusSongText,
      };
    default:
      return {
        chipStyle: null,
        textStyle: null,
      };
  }
}

function getFilterIcon(filter: "all" | "clips" | "projects") {
  switch (filter) {
    case "clips":
      return getHierarchyIconName("clip");
    case "projects":
      return getHierarchyIconName("song");
    case "all":
    default:
      return "layers-outline";
  }
}

function getSortMetricIcon(metric: IdeaSortMetric) {
  switch (metric) {
    case "created":
      return "calendar-outline";
    case "updated":
      return "refresh-outline";
    case "title":
      return "text-outline";
    case "length":
      return "time-outline";
    case "progress":
      return "pie-chart-outline";
    default:
      return "options-outline";
  }
}

export function FilterSortBar({
  selectedProjectStages,
  onToggleProjectStage,
  onClearProjectStages,
  lyricsFilterMode,
  onLyricsFilterModeChange,
  rightSlot,
}: FilterSortBarProps) {
  const ideasFilter = useStore((s) => s.ideasFilter);
  const ideasSort = useStore((s) => s.ideasSort);
  const setIdeasFilter = useStore((s) => s.setIdeasFilter);
  const setIdeasSort = useStore((s) => s.setIdeasSort);
  const { metric: activeSortMetric, direction: activeSortDirection } = getIdeaSortState(ideasSort);
  const sortMetricOptions: Array<{ key: IdeaSortMetric; label: string; icon: string }> = [
    { key: "created", label: "Created", icon: "calendar-outline" },
    { key: "updated", label: "Updated", icon: "refresh-outline" },
    { key: "title", label: "Title", icon: "text-outline" },
    { key: "length", label: "Length", icon: "time-outline" },
    { key: "progress", label: "Progress", icon: "pie-chart-outline" },
  ];

  const filterOptions = [
    { key: "all" as const, label: "All", icon: "layers-outline" },
    { key: "clips" as const, label: "Clips", icon: getHierarchyIconName("clip") },
    { key: "projects" as const, label: "Songs", icon: getHierarchyIconName("song") },
  ];
  const stageOptions = [
    { key: "seed" as const, label: "Seed" },
    { key: "sprout" as const, label: "Sprout" },
    { key: "semi" as const, label: "Semi" },
    { key: "song" as const, label: "Song" },
  ];
  const showProjectFilters = ideasFilter !== "clips";
  const hasActiveFilters =
    ideasFilter !== "all" || selectedProjectStages.length > 0 || lyricsFilterMode !== "all";
  const hasCustomSort = ideasSort !== "newest";
  const clearFilters = () => {
    setIdeasFilter("all");
    onClearProjectStages();
    onLyricsFilterModeChange("all");
  };
  const stageSummary = (() => {
    if (selectedProjectStages.length === 0) return "All";
    if (selectedProjectStages.length <= 2) {
      return selectedProjectStages
        .map((stage) => stage.charAt(0).toUpperCase() + stage.slice(1))
        .join(", ");
    }
    return `${selectedProjectStages.length} selected`;
  })();

  return (
    <FilterSortControls
      filter={{
        active: hasActiveFilters,
        valueIcon: getFilterIcon(ideasFilter),
        onClear: clearFilters,
        renderMenu: ({ close }) => (
          <>
          <View style={styles.ideasDropdownSectionStack}>
            <Text style={styles.ideasDropdownSectionToggleText}>Type</Text>
            {filterOptions.map((option) => {
              const active = option.key === ideasFilter;
              return (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [
                    styles.ideasSortMenuItem,
                    active ? styles.ideasSortMenuItemActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    setIdeasFilter(option.key);
                    if (option.key === "clips") {
                      onClearProjectStages();
                      onLyricsFilterModeChange("all");
                    }
                    close();
                  }}
                >
                  <View style={styles.ideasMenuItemLead}>
                    <Ionicons name={option.icon as any} size={15} color={active ? "#0f172a" : "#64748b"} />
                    <Text
                      style={[
                        styles.ideasSortMenuItemText,
                        active ? styles.ideasSortMenuItemTextActive : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={15} color="#0f172a" /> : null}
                </Pressable>
              );
            })}
          </View>

          {showProjectFilters ? (
            <>
              <View style={styles.ideasDropdownDivider} />
              <View style={styles.ideasDropdownSectionStack}>
                <View style={styles.ideasDropdownSectionToggle}>
                  <Text style={styles.ideasDropdownSectionToggleText}>Stage</Text>
                  <View style={styles.ideasDropdownSectionMeta}>
                    <Text style={styles.ideasDropdownSectionMetaText}>{stageSummary}</Text>
                  </View>
                </View>
                <View style={styles.ideasStageChipsWrap}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.ideasStageChip,
                      selectedProjectStages.length === 0 ? styles.ideasStageChipActive : null,
                      pressed ? styles.pressDown : null,
                    ]}
                    onPress={onClearProjectStages}
                  >
                    <Text
                      style={[
                        styles.ideasStageChipText,
                        selectedProjectStages.length === 0 ? styles.ideasStageChipTextActive : null,
                      ]}
                    >
                      All
                    </Text>
                  </Pressable>

                  {stageOptions.map((option) => {
                    const active = selectedProjectStages.includes(option.key);
                    const tone = getStageTone(option.key);
                    return (
                      <Pressable
                        key={option.key}
                        style={({ pressed }) => [
                          styles.ideasStageChip,
                          active ? tone.chipStyle : null,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() => onToggleProjectStage(option.key)}
                      >
                        <Text
                          style={[
                            styles.ideasStageChipText,
                            active ? tone.textStyle : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.ideasDropdownDivider} />
              <View style={styles.ideasDropdownSectionStack}>
                <Text style={styles.ideasDropdownSectionToggleText}>Lyrics</Text>
                <View style={styles.ideasStageChipsWrap}>
                  {([
                    { key: "all", label: "All" },
                    { key: "with", label: "With" },
                    { key: "without", label: "Without" },
                  ] as const).map((option) => {
                    const active = lyricsFilterMode === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        style={({ pressed }) => [
                          styles.ideasStageChip,
                          active ? styles.ideasStageChipActive : null,
                          pressed ? styles.pressDown : null,
                        ]}
                        onPress={() => onLyricsFilterModeChange(option.key)}
                      >
                        <Text
                          style={[
                            styles.ideasStageChipText,
                            active ? styles.ideasStageChipTextActive : null,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          ) : null}
          </>
        ),
      }}
      sort={{
        active: hasCustomSort,
        valueIcon: getSortMetricIcon(activeSortMetric),
        direction: activeSortDirection,
        renderMenu: ({ close }) => (
          <>
            <View style={styles.ideasSortDirectionRow}>
              <Text style={styles.ideasDropdownSectionToggleText}>Direction</Text>
              <View style={styles.ideasSortDirectionControls}>
                <Pressable
                  style={({ pressed }) => [
                    styles.ideasSortDirectionChip,
                    activeSortDirection === "asc" ? styles.ideasSortDirectionChipActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    setIdeasSort(getIdeaSortValue(activeSortMetric, "asc"));
                  }}
                >
                  <Ionicons name="arrow-up" size={14} color={activeSortDirection === "asc" ? "#ffffff" : "#475569"} />
                  <Text
                    style={[
                      styles.ideasSortDirectionChipText,
                      activeSortDirection === "asc" ? styles.ideasSortDirectionChipTextActive : null,
                    ]}
                  >
                    Asc
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.ideasSortDirectionChip,
                    activeSortDirection === "desc" ? styles.ideasSortDirectionChipActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    setIdeasSort(getIdeaSortValue(activeSortMetric, "desc"));
                  }}
                >
                  <Ionicons name="arrow-down" size={14} color={activeSortDirection === "desc" ? "#ffffff" : "#475569"} />
                  <Text
                    style={[
                      styles.ideasSortDirectionChipText,
                      activeSortDirection === "desc" ? styles.ideasSortDirectionChipTextActive : null,
                    ]}
                  >
                    Desc
                  </Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.ideasDropdownDivider} />
            {sortMetricOptions.map((option) => {
              const active = option.key === activeSortMetric;
              return (
                <Pressable
                  key={option.key}
                  style={({ pressed }) => [
                    styles.ideasSortMenuItem,
                    active ? styles.ideasSortMenuItemActive : null,
                    pressed ? styles.pressDown : null,
                  ]}
                  onPress={() => {
                    setIdeasSort(getIdeaSortValue(option.key, activeSortDirection));
                    close();
                  }}
                >
                  <View style={styles.ideasMenuItemLead}>
                    <Ionicons name={option.icon as any} size={15} color={active ? "#0f172a" : "#64748b"} />
                    <Text
                      style={[
                        styles.ideasSortMenuItemText,
                        active ? styles.ideasSortMenuItemTextActive : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={15} color="#0f172a" /> : null}
                </Pressable>
              );
            })}
          </>
        ),
      }}
      rightSlot={rightSlot}
    />
  );
}
