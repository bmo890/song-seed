import { ScrollView } from "react-native";
import { styles } from "../../styles";
import {
  getTagColor,
  getTagLabel,
  SONG_CLIP_TAG_OPTIONS,
  type SongClipGroupFilter,
  type SongClipTagFilter,
} from "../../songClipControls";
import type { ClipGroup, CustomTagDefinition } from "../../../../types";
import { songClipToolbarStyles } from "./styles";
import Animated, { FadeIn } from "react-native-reanimated";
import { durations } from "../../../../design/motion";
import { colors } from "../../../../design/tokens";
import { SegmentedControl } from "../../../common/SegmentedControl";
import { InkOption } from "../../../common/InkOption";
import {
  PopoverMenuFootLink,
  PopoverMenuLabel,
  PopoverMenuRule,
  PopoverMenuSection,
} from "../../../common/PopoverMenu";
import { useTranslation } from "react-i18next";

type SongClipFilterMenuProps = {
  clipViewMode: "timeline" | "evolution";
  clipTagFilter: SongClipTagFilter;
  setClipTagFilter: (filter: SongClipTagFilter) => void;
  clipGroupFilter: SongClipGroupFilter;
  setClipGroupFilter: (filter: SongClipGroupFilter) => void;
  clipBookmarkedOnly: boolean;
  setClipBookmarkedOnly: (value: boolean) => void;
  clipGroups: ClipGroup[];
  timelineMainTakesOnly: boolean;
  setTimelineMainTakesOnly: (value: boolean) => void;
  projectCustomTags: CustomTagDefinition[];
  globalCustomTags: CustomTagDefinition[];
  onClose: () => void;
};

export function SongClipFilterMenu({
  clipViewMode,
  clipTagFilter,
  setClipTagFilter,
  clipGroupFilter,
  setClipGroupFilter,
  clipBookmarkedOnly,
  setClipBookmarkedOnly,
  clipGroups,
  timelineMainTakesOnly,
  setTimelineMainTakesOnly,
  projectCustomTags,
  globalCustomTags,
  onClose,
}: SongClipFilterMenuProps) {
  const { t } = useTranslation();
  const toggleTag = (key: string) => {
    if (clipTagFilter.includes(key)) {
      setClipTagFilter(clipTagFilter.filter((k) => k !== key));
    } else {
      setClipTagFilter([...clipTagFilter, key]);
    }
  };
  const toggleGroup = (groupId: string) => {
    if (clipGroupFilter.includes(groupId)) {
      setClipGroupFilter(clipGroupFilter.filter((id) => id !== groupId));
    } else {
      setClipGroupFilter([...clipGroupFilter, groupId]);
    }
  };
  const hasActiveFilters =
    clipTagFilter.length > 0 || clipGroupFilter.length > 0 || clipBookmarkedOnly;

  const allOptions: { key: string; label: string }[] = [
    { key: "untagged", label: t("songDetail.untagged") },
    ...SONG_CLIP_TAG_OPTIONS.map((tag) => ({
      key: tag.key,
      label: t(`clipTags.${tag.key}`, { defaultValue: tag.label }),
    })),
    ...projectCustomTags.map((t) => ({ key: t.key, label: t.label })),
    ...globalCustomTags.map((t) => ({ key: t.key, label: t.label })),
  ];

  const clearAll = () => {
    setClipTagFilter([]);
    setClipGroupFilter([]);
    setClipBookmarkedOnly(false);
  };

  return (
    <Animated.View entering={FadeIn.duration(durations.fast)} style={[styles.ideasSortMenu, styles.ideasPopoverMenu, songClipToolbarStyles.menuOffsetRight]}>
      {/* The Ideas filter's recipe: caps labels, editorial ink, the tag's
          own colour in its dot, one Clear filters at the foot. */}
      <PopoverMenuLabel>{t("songDetail.tags")}</PopoverMenuLabel>
      <ScrollView
        style={styles.ideasStageChipsScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PopoverMenuSection wrap>
          {allOptions.map((option) => {
            const isUntagged = option.key === "untagged";
            const tagColor = isUntagged ? null : getTagColor(option.key, projectCustomTags, globalCustomTags);
            return (
              <InkOption
                key={option.key}
                label={
                  isUntagged
                    ? t("songDetail.untagged")
                    : getTagLabel(option.key, projectCustomTags, globalCustomTags)
                }
                selected={clipTagFilter.includes(option.key)}
                ink={tagColor?.text ?? colors.textMuted}
                onPress={() => toggleTag(option.key)}
              />
            );
          })}
        </PopoverMenuSection>
      </ScrollView>

      <PopoverMenuRule />
      <PopoverMenuSection>
        <InkOption
          label={t("songDetail.bookmarkedOnly")}
          selected={clipBookmarkedOnly}
          onPress={() => setClipBookmarkedOnly(!clipBookmarkedOnly)}
        />
      </PopoverMenuSection>

      {clipGroups.length > 0 ? (
        <>
          <PopoverMenuRule />
          <PopoverMenuLabel>{t("songDetail.groups")}</PopoverMenuLabel>
          <PopoverMenuSection wrap>
            {clipGroups.map((group) => (
              <InkOption
                key={group.id}
                label={group.name}
                selected={clipGroupFilter.includes(group.id)}
                onPress={() => toggleGroup(group.id)}
              />
            ))}
          </PopoverMenuSection>
        </>
      ) : null}

      {clipViewMode === "timeline" ? (
        <>
          <PopoverMenuRule />
          <PopoverMenuLabel>{t("songDetail.display")}</PopoverMenuLabel>
          <PopoverMenuSection>
            {/* Single-select — SegmentedControl, per the selection-controls law. */}
            <SegmentedControl
              options={[
                { key: "all", label: t("songDetail.allTakes") },
                { key: "main", label: t("songDetail.mainTakesOnly") },
              ]}
              value={timelineMainTakesOnly ? "main" : "all"}
              onChange={(key) => {
                setTimelineMainTakesOnly(key === "main");
                onClose();
              }}
            />
          </PopoverMenuSection>
        </>
      ) : null}

      {hasActiveFilters ? <PopoverMenuFootLink label={t("filters.clearAll")} onPress={clearAll} /> : null}
    </Animated.View>
  );
}
