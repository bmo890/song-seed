import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
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

/** One editorial-ink toggle row: leading dot (hollow → filled in `hue`) + word.
 *  Multi-select control language — chips are retired here. */
function InkToggle({
  label,
  active,
  hue,
  onPress,
}: {
  label: string;
  active: boolean;
  hue: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.ideasStageInk, pressed ? styles.pressDown : null]}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.ideasStageInkDot,
          active ? { backgroundColor: hue, borderColor: hue } : null,
        ]}
      />
      <Text
        style={[styles.ideasStageInkText, active ? styles.ideasStageInkTextActive : null]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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

  return (
    <Animated.View entering={FadeIn.duration(durations.fast)} style={[styles.ideasSortMenu, styles.ideasPopoverMenu, songClipToolbarStyles.menuOffsetRight]}>
      {/* Header row */}
      <View style={styles.ideasDropdownSectionToggle}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
          <Text style={styles.ideasDropdownSectionToggleText}>{t("songDetail.tags")}</Text>
        </View>
        {hasActiveFilters ? (
          <Pressable
            onPress={() => {
              setClipTagFilter([]);
              setClipGroupFilter([]);
              setClipBookmarkedOnly(false);
            }}
            hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
          >
            <Text style={songClipToolbarStyles.filterClearText}>{t("songDetail.clear")}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Tags (multiselect) — editorial ink; the tag's hue lives in the dot. */}
      <ScrollView
        style={styles.ideasStageChipsScroll}
        contentContainerStyle={styles.ideasStageInkWrap}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {allOptions.map((option) => {
          const isUntagged = option.key === "untagged";
          const tagColor = isUntagged
            ? null
            : getTagColor(option.key, projectCustomTags, globalCustomTags);
          return (
            <InkToggle
              key={option.key}
              label={
                isUntagged
                  ? t("songDetail.untagged")
                  : getTagLabel(option.key, projectCustomTags, globalCustomTags)
              }
              active={clipTagFilter.includes(option.key)}
              hue={tagColor?.text ?? colors.textMuted}
              onPress={() => toggleTag(option.key)}
            />
          );
        })}
      </ScrollView>

      <View style={styles.ideasDropdownDivider} />
      <View style={styles.ideasDropdownSectionToggle}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="bookmark-outline" size={12} color={colors.textMuted} />
          <Text style={styles.ideasDropdownSectionToggleText}>{t("songDetail.savedClips")}</Text>
        </View>
      </View>
      <View style={styles.ideasStageInkWrap}>
        <InkToggle
          label={t("songDetail.bookmarkedOnly")}
          active={clipBookmarkedOnly}
          hue={colors.primary}
          onPress={() => setClipBookmarkedOnly(!clipBookmarkedOnly)}
        />
      </View>

      {clipGroups.length > 0 ? (
        <>
          <View style={styles.ideasDropdownDivider} />
          <View style={styles.ideasDropdownSectionToggle}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="folder-open-outline" size={12} color={colors.textMuted} />
              <Text style={styles.ideasDropdownSectionToggleText}>{t("songDetail.groups")}</Text>
            </View>
          </View>
          <View style={styles.ideasStageInkWrap}>
            {clipGroups.map((group) => (
              <InkToggle
                key={group.id}
                label={group.name}
                active={clipGroupFilter.includes(group.id)}
                hue={colors.primary}
                onPress={() => toggleGroup(group.id)}
              />
            ))}
          </View>
        </>
      ) : null}

      {clipViewMode === "timeline" ? (
        <>
          <View style={styles.ideasDropdownDivider} />
          <View style={styles.ideasDropdownSectionToggle}>
            <Text style={styles.ideasDropdownSectionToggleText}>{t("songDetail.display")}</Text>
          </View>
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
        </>
      ) : null}
    </Animated.View>
  );
}
