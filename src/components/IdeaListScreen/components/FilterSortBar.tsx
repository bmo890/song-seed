import { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { useStore } from "../../../state/useStore";
import { getIdeaSortState, getIdeaSortValue, getSortOrderOptions, IdeaSortMetric } from "../../../domain/ideaSort";
import { getHierarchyIconName } from "../../../domain/hierarchy";
import { FilterSortControls } from "../../common/FilterSortControls";
import { SegmentedControl } from "../../common/SegmentedControl";
import { InkOption } from "../../common/InkOption";
import {
  PopoverMenuFootLink,
  PopoverMenuLabel,
  PopoverMenuRule,
  PopoverMenuSection,
  PopoverRadioRow,
} from "../../common/PopoverMenu";
import { STAGE_INK } from "../../common/StageMark";
import { getTagColor, getTagLabel } from "../../IdeaDetailScreen/songClipControls";
import { UNTAGGED_FILTER_KEY } from "../../../domain/ideaTags";
import { colors, spacing } from "../../../design/tokens";
import { useTranslation } from "react-i18next";

type ProjectStage = "seed" | "sprout" | "stem" | "song";
type LyricsFilterMode = "all" | "with" | "without";

type FilterSortBarProps = {
  selectedProjectStages: ProjectStage[];
  onToggleProjectStage: (value: ProjectStage) => void;
  onClearProjectStages: () => void;
  lyricsFilterMode: LyricsFilterMode;
  onLyricsFilterModeChange: (value: LyricsFilterMode) => void;
  /** Clip tags in use in this collection — the tag filter's rows. */
  tagsInUse: string[];
  /** Leading stretch of the toolbar row (the search field). */
  leadingSlot?: ReactNode;
  rightSlot?: ReactNode;
  /** Selection mode: replaces the filter/sort glyphs in place (see FilterSortControls). */
  controlsOverride?: ReactNode;
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
  tagsInUse,
  leadingSlot,
  rightSlot,
  controlsOverride,
  closeSignal,
  onMenuOpen,
}: FilterSortBarProps) {
  const { t } = useTranslation();
  const ideasFilter = useStore((s) => s.ideasFilter);
  const ideasSort = useStore((s) => s.ideasSort);
  const setIdeasFilter = useStore((s) => s.setIdeasFilter);
  const setIdeasSort = useStore((s) => s.setIdeasSort);
  const ideasTagFilter = useStore((s) => s.ideasTagFilter);
  const setIdeasTagFilter = useStore((s) => s.setIdeasTagFilter);
  const globalCustomTags = useStore((s) => s.globalCustomClipTags);
  // Tags a clip could be narrowed to: the ones in use here, then custom tags
  // not yet used, then "untagged". Clip tags only (founder, 2026-10-03).
  const tagOptions = [
    ...tagsInUse,
    ...globalCustomTags.map((tag) => tag.key).filter((key) => !tagsInUse.includes(key)),
  ].map((key) => ({
    key,
    label: t(`clipTags.${key}`, { defaultValue: getTagLabel(key, undefined, globalCustomTags) }),
    ink: getTagColor(key, undefined, globalCustomTags).text,
  }));
  const toggleTag = (key: string) =>
    setIdeasTagFilter(
      ideasTagFilter.includes(key) ? ideasTagFilter.filter((item) => item !== key) : [...ideasTagFilter, key]
    );
  const { metric: activeSortMetric, direction: activeSortDirection } = getIdeaSortState(ideasSort);
  const sortMetricOptions: Array<{ key: IdeaSortMetric; label: string }> = [
    { key: "created", label: t("filters.created") },
    { key: "updated", label: t("filters.updated") },
    { key: "title", label: t("filters.title") },
    { key: "length", label: t("filters.length") },
    { key: "progress", label: t("filters.stage") },
  ];

  const typeOptions = [
    { key: "all" as const, label: t("filters.all") },
    { key: "clips" as const, label: t("filters.clips") },
    { key: "projects" as const, label: t("filters.songs") },
  ];
  const stageOptions = [
    { key: "seed" as const, label: t("stages.seed") },
    { key: "sprout" as const, label: t("stages.sprout") },
    { key: "stem" as const, label: t("stages.stem") },
    { key: "song" as const, label: t("stages.song") },
  ];
  const showProjectFilters = ideasFilter !== "clips" && ideasFilter !== "bookmarked";
  const showTagFilters = ideasFilter !== "projects" && (tagOptions.length > 0 || ideasTagFilter.length > 0);
  const hasActiveFilters =
    ideasFilter !== "all" ||
    selectedProjectStages.length > 0 ||
    lyricsFilterMode !== "all" ||
    ideasTagFilter.length > 0;
  const hasCustomSort = ideasSort !== "newest";
  const clearFilters = () => {
    setIdeasFilter("all");
    onClearProjectStages();
    onLyricsFilterModeChange("all");
    setIdeasTagFilter([]);
  };
  const typeValue = ideasFilter === "bookmarked" ? "all" : ideasFilter;
  const orderOptions = getSortOrderOptions(activeSortMetric);

  return (
    <FilterSortControls
      filter={{
        active: hasActiveFilters,
        valueIcon: getFilterIcon(ideasFilter),
        onClear: clearFilters,
        renderMenu: ({ close }) => (
          <>
            {/* One kind at a time is a single choice: ink tabs. Bookmarked
                spans every kind, so it is its own switch beneath (picking a
                kind turns it off, as before). */}
            <PopoverMenuLabel>{t("filters.show")}</PopoverMenuLabel>
            <PopoverMenuSection>
              <SegmentedControl
                options={typeOptions}
                value={typeValue}
                onChange={(key) => {
                  setIdeasFilter(key);
                  if (key === "clips") {
                    onClearProjectStages();
                    onLyricsFilterModeChange("all");
                  }
                  if (key === "projects") setIdeasTagFilter([]);
                }}
              />
              <InkOption
                label={t("songDetail.bookmarkedOnly")}
                selected={ideasFilter === "bookmarked"}
                onPress={() => setIdeasFilter(ideasFilter === "bookmarked" ? "all" : "bookmarked")}
                style={filterStyles.bookmarked}
              />
            </PopoverMenuSection>

            {showProjectFilters ? (
              <>
                <PopoverMenuRule />
                {/* Multi-select = editorial ink, each stage lit in its own ink.
                    Nothing lit means every stage. */}
                <PopoverMenuLabel>{t("filters.stage")}</PopoverMenuLabel>
                <PopoverMenuSection wrap>
                  {stageOptions.map((option) => (
                    <InkOption
                      key={option.key}
                      label={option.label}
                      selected={selectedProjectStages.includes(option.key)}
                      ink={STAGE_INK[option.key] ?? colors.primary}
                      onPress={() => onToggleProjectStage(option.key)}
                    />
                  ))}
                </PopoverMenuSection>
              </>
            ) : null}

            {showTagFilters ? (
              <>
                <PopoverMenuRule />
                <PopoverMenuLabel>{t("filters.tags")}</PopoverMenuLabel>
                <PopoverMenuSection wrap>
                  {[...tagOptions, { key: UNTAGGED_FILTER_KEY, label: t("filters.untagged"), ink: colors.textMuted }].map(
                    (option) => (
                      <InkOption
                        key={option.key}
                        label={option.label}
                        selected={ideasTagFilter.includes(option.key)}
                        ink={option.ink}
                        onPress={() => toggleTag(option.key)}
                      />
                    )
                  )}
                </PopoverMenuSection>
              </>
            ) : null}

            {hasActiveFilters ? (
              <PopoverMenuFootLink
                label={t("filters.clearAll")}
                onPress={() => {
                  clearFilters();
                  close();
                }}
              />
            ) : null}
          </>
        ),
      }}
      sort={{
        active: hasCustomSort,
        valueIcon: getSortMetricIcon(activeSortMetric),
        direction: activeSortDirection,
        renderMenu: () => (
          <>
            <PopoverMenuLabel>{t("filters.sortBy")}</PopoverMenuLabel>
            {sortMetricOptions.map((option) => (
              <PopoverRadioRow
                key={option.key}
                label={option.label}
                selected={option.key === activeSortMetric}
                // A field keeps its natural order when picked (newest, A–Z).
                onPress={() =>
                  setIdeasSort(
                    getIdeaSortValue(option.key, getSortOrderOptions(option.key)[0]!.direction)
                  )
                }
              />
            ))}
            <PopoverMenuRule />
            <PopoverMenuLabel>{t("filters.order")}</PopoverMenuLabel>
            <PopoverMenuSection>
              <SegmentedControl
                options={orderOptions.map((option) => ({ key: option.direction, label: t(option.labelKey) }))}
                value={activeSortDirection}
                onChange={(direction) => setIdeasSort(getIdeaSortValue(activeSortMetric, direction))}
              />
            </PopoverMenuSection>
          </>
        ),
      }}
      leadingSlot={leadingSlot}
      rightSlot={rightSlot}
      controlsOverride={controlsOverride}
      closeSignal={closeSignal}
      onMenuOpen={onMenuOpen}
    />
  );
}

const filterStyles = StyleSheet.create({
  bookmarked: {
    marginTop: spacing.sm,
  },
});
