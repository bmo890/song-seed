import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { useStore } from "../../../state/useStore";
import { getIdeaSortState, getIdeaSortValue, IdeaSortMetric } from "../../../domain/ideaSort";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { FilterSortControls } from "../../common/FilterSortControls";
import { colors } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

type ProjectStage = "seed" | "sprout" | "stem" | "song";
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
    case "stem":
      return {
        chipStyle: [styles.statusStem, { borderColor: "#fcd34d" }],
        textStyle: styles.statusStemText,
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

function getFilterIcon(filter: "all" | "clips" | "projects" | "bookmarked") {
  switch (filter) {
    case "clips":
      return getHierarchyIconName("clip");
    case "projects":
      return getHierarchyIconName("song");
    case "bookmarked":
      return "bookmark";
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
  const { t } = useTranslation();
  const ideasFilter = useStore((s) => s.ideasFilter);
  const ideasSort = useStore((s) => s.ideasSort);
  const setIdeasFilter = useStore((s) => s.setIdeasFilter);
  const setIdeasSort = useStore((s) => s.setIdeasSort);
  const { metric: activeSortMetric, direction: activeSortDirection } = getIdeaSortState(ideasSort);
  const sortMetricOptions: Array<{ key: IdeaSortMetric; label: string; icon: string }> = [
    { key: "created", label: t("filters.created"), icon: "calendar-outline" },
    { key: "updated", label: t("filters.updated"), icon: "refresh-outline" },
    { key: "title", label: t("filters.title"), icon: "text-outline" },
    { key: "length", label: t("filters.length"), icon: "time-outline" },
    { key: "progress", label: t("filters.progress"), icon: "pie-chart-outline" },
  ];

  const filterOptions = [
    { key: "all" as const, label: t("filters.all"), icon: "layers-outline" },
    { key: "clips" as const, label: t("filters.clips"), icon: getHierarchyIconName("clip") },
    { key: "projects" as const, label: t("filters.songs"), icon: getHierarchyIconName("song") },
    { key: "bookmarked" as const, label: t("filters.bookmarked"), icon: "bookmark" },
  ];
  const stageOptions = [
    { key: "seed" as const, label: t("stages.seed") },
    { key: "sprout" as const, label: t("stages.sprout") },
    { key: "stem" as const, label: t("stages.stem") },
    { key: "song" as const, label: t("stages.song") },
  ];
  const showProjectFilters = ideasFilter !== "clips" && ideasFilter !== "bookmarked";
  const hasActiveFilters =
    ideasFilter !== "all" || selectedProjectStages.length > 0 || lyricsFilterMode !== "all";
  const hasCustomSort = ideasSort !== "newest";
  const clearFilters = () => {
    setIdeasFilter("all");
    onClearProjectStages();
    onLyricsFilterModeChange("all");
  };
  const stageSummary = (() => {
    if (selectedProjectStages.length === 0) return t("filters.all");
    if (selectedProjectStages.length <= 2) {
      return selectedProjectStages
        .map((stage) => t(`stages.${stage}`))
        .join(", ");
    }
    return t("filters.selected", { count: selectedProjectStages.length });
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
            <Text style={styles.ideasDropdownSectionToggleText}>{t("filters.type")}</Text>
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
                  <Text style={styles.ideasDropdownSectionToggleText}>{t("filters.stage")}</Text>
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
                      {t("filters.all")}
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
                <Text style={styles.ideasDropdownSectionToggleText}>{t("filters.lyrics")}</Text>
                <View style={styles.ideasStageChipsWrap}>
                  {([
                    { key: "all", label: t("filters.all") },
                    { key: "with", label: t("filters.with") },
                    { key: "without", label: t("filters.without") },
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
              <Text style={styles.ideasDropdownSectionToggleText}>{t("filters.direction")}</Text>
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
                  <Ionicons name="arrow-up" size={14} color={activeSortDirection === "asc" ? colors.surface : "#475569"} />
                  <Text
                    style={[
                      styles.ideasSortDirectionChipText,
                      activeSortDirection === "asc" ? styles.ideasSortDirectionChipTextActive : null,
                    ]}
                  >
                    {t("filters.ascending")}
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
                  <Ionicons name="arrow-down" size={14} color={activeSortDirection === "desc" ? colors.surface : "#475569"} />
                  <Text
                    style={[
                      styles.ideasSortDirectionChipText,
                      activeSortDirection === "desc" ? styles.ideasSortDirectionChipTextActive : null,
                    ]}
                  >
                    {t("filters.descending")}
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
