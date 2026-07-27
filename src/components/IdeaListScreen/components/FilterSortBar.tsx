import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "../../../styles";
import { useStore } from "../../../state/useStore";
import { getIdeaSortState, getIdeaSortValue, IdeaSortMetric } from "../../../domain/ideaSort";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { FilterSortControls } from "../../common/FilterSortControls";
import { STAGE_INK } from "../../common/StageMark";
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
  /** Leading stretch of the toolbar row (the search field). */
  leadingSlot?: ReactNode;
  rightSlot?: ReactNode;
  /** Mutual-exclusivity with the overflow menu (see FilterSortControls). */
  closeSignal?: number;
  onMenuOpen?: () => void;
};

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
      return "leaf-outline";
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
  leadingSlot,
  rightSlot,
  closeSignal,
  onMenuOpen,
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
    { key: "progress", label: t("filters.stage"), icon: "leaf-outline" },
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
                    <Ionicons name={option.icon as any} size={15} color={active ? colors.primary : colors.textSecondary} />
                    <Text
                      style={[
                        styles.ideasSortMenuItemText,
                        active ? styles.ideasSortMenuItemTextActive : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={15} color={colors.primary} /> : null}
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
                {/* Multi-select = editorial ink: word + leading dot (hollow →
                    filled in the stage's own warm ink), never a capsule. */}
                <View style={styles.ideasStageInkWrap}>
                  <Pressable
                    style={({ pressed }) => [styles.ideasStageInk, pressed ? styles.pressDown : null]}
                    onPress={onClearProjectStages}
                    hitSlop={{ top: 6, bottom: 6 }}
                  >
                    <View
                      style={[
                        styles.ideasStageInkDot,
                        selectedProjectStages.length === 0
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : null,
                      ]}
                    />
                    <Text
                      style={[
                        styles.ideasStageInkText,
                        selectedProjectStages.length === 0 ? styles.ideasStageInkTextActive : null,
                      ]}
                    >
                      {t("filters.all")}
                    </Text>
                  </Pressable>

                  {stageOptions.map((option) => {
                    const active = selectedProjectStages.includes(option.key);
                    const ink = STAGE_INK[option.key] ?? colors.primary;
                    return (
                      <Pressable
                        key={option.key}
                        style={({ pressed }) => [styles.ideasStageInk, pressed ? styles.pressDown : null]}
                        onPress={() => onToggleProjectStage(option.key)}
                        hitSlop={{ top: 6, bottom: 6 }}
                      >
                        <View
                          style={[
                            styles.ideasStageInkDot,
                            active ? { backgroundColor: ink, borderColor: ink } : null,
                          ]}
                        />
                        <Text
                          style={[
                            styles.ideasStageInkText,
                            active ? styles.ideasStageInkTextActive : null,
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
                  <Ionicons name="arrow-up" size={14} color={activeSortDirection === "asc" ? colors.surface : colors.textSecondary} />
                  <Text
                    style={[
                      styles.ideasSortDirectionChipText,
                      activeSortDirection === "asc" ? styles.ideasSortDirectionChipTextActive : null,
                    ]}
                  >
                    {t("filters.asc")}
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
                  <Ionicons name="arrow-down" size={14} color={activeSortDirection === "desc" ? colors.surface : colors.textSecondary} />
                  <Text
                    style={[
                      styles.ideasSortDirectionChipText,
                      activeSortDirection === "desc" ? styles.ideasSortDirectionChipTextActive : null,
                    ]}
                  >
                    {t("filters.desc")}
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
                    <Ionicons name={option.icon as any} size={15} color={active ? colors.primary : colors.textSecondary} />
                    <Text
                      style={[
                        styles.ideasSortMenuItemText,
                        active ? styles.ideasSortMenuItemTextActive : null,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </View>
                  {active ? <Ionicons name="checkmark" size={15} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </>
        ),
      }}
      leadingSlot={leadingSlot}
      rightSlot={rightSlot}
      closeSignal={closeSignal}
      onMenuOpen={onMenuOpen}
    />
  );
}
